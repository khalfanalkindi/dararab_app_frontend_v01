"use client"

import { PageBreadcrumb, DASHBOARD_CRUMB, DEFINITIONS_CRUMB } from "@/components/page-breadcrumb"
import { DocumentTitle } from "@/components/document-title"
import { TableSkeleton } from "@/components/table-skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { fetchWithRetry } from "@/lib/apiClient"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Edit, Trash2, MoreHorizontal, PlusCircle, AlertCircle, CheckCircle2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { API_URL } from "@/lib/config"
import { ListPagination } from "@/components/list-pagination"

interface RightsOwner {
  id: number
  name: string
  contact_info?: string
  bio?: string // For backward compatibility if API returns both
}

export default function RightsOwnerManagement() {
  const [rightsOwners, setRightsOwners] = useState<RightsOwner[]>([])
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
  const [deleteRightsOwnerId, setDeleteRightsOwnerId] = useState<number | null>(null)
  const [editRightsOwner, setEditRightsOwner] = useState<RightsOwner | null>(null)
  const [isAddRightsOwnerOpen, setIsAddRightsOwnerOpen] = useState(false)
  const [isEditRightsOwnerOpen, setIsEditRightsOwnerOpen] = useState(false)
  const [actionAlert, setActionAlert] = useState<{
    type: "success" | "error" | "warning" | null
    message: string
  }>({
    type: null,
    message: "",
  })
  const [isLoading, setIsLoading] = useState(true)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [totalCount, setTotalCount] = useState(0)

  // Form state for new rights owner
  const [newRightsOwner, setNewRightsOwner] = useState<Partial<RightsOwner>>({
    name: "",
    contact_info: "",
  })

  // Show alert message
  const showAlert = (type: "success" | "error" | "warning", message: string) => {
    setActionAlert({ type, message })
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setActionAlert({ type: null, message: "" })
    }, 5000)
  }

  // AbortController refs for request cancellation
  const fetchRightsOwnersAbortControllerRef = useRef<AbortController | null>(null)

  // Memoized headers to prevent recreation on every render
  const headers = useMemo(() => {
    const token = localStorage.getItem("accessToken")
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }
  }, [])

// Standardized error handling utility
  const handleError = useCallback((
    error: unknown,
    defaultMessage: string,
    options?: {
      title?: string
      duration?: number
    }
  ) => {
    // Ignore abort errors silently
    if (error instanceof DOMException && error.name === 'AbortError') {
      return
    }

    // Log error in development
    if (process.env.NODE_ENV !== 'production') {
      console.error("Error:", error)
    }

    // Extract error message
    let errorMessage = defaultMessage
    if (error instanceof Error) {
      errorMessage = error.message || defaultMessage
    }

    // Show toast notification
    toast.error(options?.title || "Error", { description: errorMessage })
  }, [])

  useEffect(() => {
    fetchRightsOwners(currentPage, pageSize)

    // Cleanup: abort pending requests on unmount
    return () => {
      fetchRightsOwnersAbortControllerRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial + page/size driven by handlers
  }, [])

  const fetchRightsOwners = async (page: number = currentPage, size: number = pageSize) => {
    // Abort previous request if still pending
    fetchRightsOwnersAbortControllerRef.current?.abort()
    fetchRightsOwnersAbortControllerRef.current = new AbortController()

    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(size),
        ordering: "name",
      })
      const res = await fetchWithRetry(
        `${API_URL}/inventory/rights-owners/?${params.toString()}`,
        {
          headers,
          signal: fetchRightsOwnersAbortControllerRef.current.signal
        }
      )

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }

      const data = await res.json()
      const rightsOwnersData = Array.isArray(data) ? data : data.results || []

      setRightsOwners(rightsOwnersData)
      setTotalCount(
        Array.isArray(data)
          ? rightsOwnersData.length
          : typeof data.count === "number"
            ? data.count
            : rightsOwnersData.length,
      )
      setCurrentPage(page)
      setPageSize(size)
    } catch (error) {
      handleError(error, "Failed to fetch rights owners")
      setRightsOwners([])
      setTotalCount(0)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle page change
  const handlePageChange = (newPage: number) => {
    fetchRightsOwners(newPage, pageSize)
  }

  // Handle items per page change
  const handlePageSizeChange = (size: number) => {
    fetchRightsOwners(1, size)
  }

  // Handle adding a new rights owner
  const handleAddRightsOwner = async () => {
    try {
      const res = await fetchWithRetry(`${API_URL}/inventory/rights-owners/`, {
        method: "POST",
        headers,
        body: JSON.stringify(newRightsOwner),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.detail || "Failed to add rights owner")
      }

      const data = await res.json()
      setIsAddRightsOwnerOpen(false)

      // Reset form
      setNewRightsOwner({
        name: "",
        contact_info: "",
      })

      await fetchRightsOwners(1, pageSize)

      // Show toast notification
      toast.success("Rights Owner Added Successfully", { description: "${data.name} has been added to the system." })

      // Show alert message
      showAlert("success", `New rights owner "${data.name}" has been successfully added to the system.`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      handleError(error, "Failed to add rights owner")
      showAlert("error", "Failed to add rights owner. Please try again.")
    }
  }

  // Handle updating a rights owner
  const handleUpdateRightsOwner = async () => {
    if (!editRightsOwner) return

    try {
      const res = await fetchWithRetry(`${API_URL}/inventory/rights-owners/${editRightsOwner.id}/`, {
        method: "PUT",
        headers,
        body: JSON.stringify(editRightsOwner),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.detail || "Failed to update rights owner")
      }

      const responseData = await res.json()

      setEditRightsOwner(null)
      setIsEditRightsOwnerOpen(false)
      await fetchRightsOwners(currentPage, pageSize)

      // Show toast notification
      toast.success("Rights Owner Updated Successfully", { description: "${responseData.name} has been updated." })

      // Show alert message
      showAlert("success", `Rights owner "${responseData.name}" has been successfully updated.`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      handleError(error, "Failed to update rights owner")
      const errorMessage = error instanceof Error ? error.message : "Failed to update rights owner"
      showAlert("error", `Failed to update rights owner: ${errorMessage}`)
    }
  }

  // Handle deleting a rights owner
  const handleDeleteRightsOwner = async () => {
    if (deleteRightsOwnerId === null) return

    try {
      const rightsOwnerToDelete = rightsOwners.find((r) => r.id === deleteRightsOwnerId)
      if (!rightsOwnerToDelete) return

      const res = await fetchWithRetry(`${API_URL}/inventory/rights-owners/${deleteRightsOwnerId}/delete/`, {
        method: "DELETE",
        headers,
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.detail || "Failed to delete rights owner")
      }

      setDeleteRightsOwnerId(null)
      setIsDeleteAlertOpen(false)

      const nextPage =
        rightsOwners.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage
      await fetchRightsOwners(nextPage, pageSize)

      // Show toast notification
      toast.error("Rights Owner Deleted", { description: "${rightsOwnerToDelete.name} has been permanently removed from the system." })

      // Show alert message
      showAlert("warning", `Rights owner "${rightsOwnerToDelete.name}" has been permanently deleted from the system.`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      handleError(error, "Failed to delete rights owner")
      showAlert("error", "Failed to delete rights owner. Please try again.")
    }
  }

  // Open edit dialog with rights owner data
  const openEditDialog = (rightsOwner: RightsOwner) => {
    setEditRightsOwner(rightsOwner)
    setIsEditRightsOwnerOpen(true)
  }

  // Open delete confirmation
  const openDeleteDialog = (rightsOwnerId: number) => {
    setDeleteRightsOwnerId(rightsOwnerId)
    setIsDeleteAlertOpen(true)
  }

  return (
    <>
      <DocumentTitle title="Rights Owners" />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <PageBreadcrumb items={[DASHBOARD_CRUMB, DEFINITIONS_CRUMB, { label: "Rights Owners" }]} />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {/* Action Alert */}
          {actionAlert.type && (
            <Alert
              variant={actionAlert.type === "warning" ? "destructive" : "default"}
              className={actionAlert.type === "success" ? "border-green-500 text-green-500" : ""}
            >
              {actionAlert.type === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {actionAlert.type === "success"
                  ? "Success"
                  : actionAlert.type === "warning"
                    ? "Warning"
                    : "Information"}
              </AlertTitle>
              <AlertDescription>{actionAlert.message}</AlertDescription>
            </Alert>
          )}

          <div className="min-h-[50vh] flex-1 rounded-xl bg-muted/50 p-6 md:min-h-min">
            <h2 className="text-xl font-semibold mb-4">Rights Owner Management</h2>
            <p className="mb-6">Manage rights owners and their information.</p>

            <div className="border rounded-md">
              <div className="bg-muted p-4 flex justify-between items-center">
                <h3 className="font-medium">Rights Owners</h3>
                <Dialog open={isAddRightsOwnerOpen} onOpenChange={setIsAddRightsOwnerOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-primary text-primary-foreground">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Rights Owner
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Rights Owner</DialogTitle>
                      <DialogDescription>Create a new rights owner entry.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          value={newRightsOwner.name}
                          onChange={(e) => setNewRightsOwner({ ...newRightsOwner, name: e.target.value })}
                          placeholder="Enter rights owner name"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="contact_info">Contact Info</Label>
                        <Textarea
                          id="contact_info"
                          value={newRightsOwner.contact_info || ""}
                          onChange={(e) => setNewRightsOwner({ ...newRightsOwner, contact_info: e.target.value })}
                          placeholder="Enter rights owner contact information"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddRightsOwnerOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddRightsOwner}>Add Rights Owner</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact Info</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableSkeleton columns={3} rows={5} hasActions />
                    ) : rightsOwners.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="py-8 text-center">
                          No rights owners found
                        </TableCell>
                      </TableRow>
                    ) : (
                      rightsOwners.map((rightsOwner) => (
                        <TableRow key={rightsOwner.id}>
                          <TableCell className="font-medium">{rightsOwner.name}</TableCell>
                          <TableCell>{rightsOwner.contact_info || rightsOwner.bio || "No contact info available"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {/* Desktop view - separate buttons */}
                              <div className="hidden sm:flex gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEditDialog(rightsOwner)}
                                >
                                  <Edit className="h-4 w-4" />
                                  <span className="sr-only">Edit</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => openDeleteDialog(rightsOwner.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete</span>
                                </Button>
                              </div>

                              {/* Mobile view - dropdown menu */}
                              <div className="sm:hidden">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="h-4 w-4" />
                                      <span className="sr-only">Actions</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => openEditDialog(rightsOwner)}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => openDeleteDialog(rightsOwner.id)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {/* Pagination Controls */}
                {!isLoading && totalCount > 0 && (
                  <ListPagination
                    currentPage={currentPage}
                    pageSize={pageSize}
                    totalCount={totalCount}
                    disabled={isLoading}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* Edit Rights Owner Dialog */}
      <Dialog open={isEditRightsOwnerOpen} onOpenChange={setIsEditRightsOwnerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Rights Owner</DialogTitle>
            <DialogDescription>Update rights owner information.</DialogDescription>
          </DialogHeader>
          {editRightsOwner && (
            <div className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editRightsOwner.name}
                  onChange={(e) => setEditRightsOwner({ ...editRightsOwner, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-contact_info">Contact Info</Label>
                <Textarea
                  id="edit-contact_info"
                  value={editRightsOwner.contact_info || editRightsOwner.bio || ""}
                  onChange={(e) => setEditRightsOwner({ ...editRightsOwner, contact_info: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditRightsOwnerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRightsOwner}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={isDeleteAlertOpen}
        onOpenChange={setIsDeleteAlertOpen}
        description={
          deleteRightsOwnerId !== null ? (
            <>
              You are about to delete{" "}
              <strong>{rightsOwners.find((r) => r.id === deleteRightsOwnerId)?.name}</strong>. This action cannot be undone.
              This will permanently remove the rights owner from your system.
            </>
          ) : (
            ""
          )
        }
        onConfirm={handleDeleteRightsOwner}
      />
    </>
  )
}
