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

interface Translator {
  id: number
  name: string
  bio: string
}

export default function TranslatorManagement() {
  const [translators, setTranslators] = useState<Translator[]>([])
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
  const [deleteTranslatorId, setDeleteTranslatorId] = useState<number | null>(null)
  const [editTranslator, setEditTranslator] = useState<Translator | null>(null)
  const [isAddTranslatorOpen, setIsAddTranslatorOpen] = useState(false)
  const [isEditTranslatorOpen, setIsEditTranslatorOpen] = useState(false)
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

  // Form state for new translator
  const [newTranslator, setNewTranslator] = useState<Partial<Translator>>({
    name: "",
    bio: "",
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
  const fetchTranslatorsAbortControllerRef = useRef<AbortController | null>(null)

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
    fetchTranslators(currentPage, pageSize)

    // Cleanup: abort pending requests on unmount
    return () => {
      fetchTranslatorsAbortControllerRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial + page/size driven by handlers
  }, [])

  const fetchTranslators = async (page: number = currentPage, size: number = pageSize) => {
    // Abort previous request if still pending
    fetchTranslatorsAbortControllerRef.current?.abort()
    fetchTranslatorsAbortControllerRef.current = new AbortController()

    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(size),
        ordering: "name",
      })
      const res = await fetchWithRetry(
        `${API_URL}/inventory/translators/?${params.toString()}`,
        {
          headers,
          signal: fetchTranslatorsAbortControllerRef.current.signal
        }
      )

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }

      const data = await res.json()
      const translatorsData = Array.isArray(data) ? data : data.results || []

      setTranslators(translatorsData)
      setTotalCount(
        Array.isArray(data)
          ? translatorsData.length
          : typeof data.count === "number"
            ? data.count
            : translatorsData.length,
      )
      setCurrentPage(page)
      setPageSize(size)
    } catch (error) {
      handleError(error, "Failed to fetch translators")
      setTranslators([])
      setTotalCount(0)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle page change
  const handlePageChange = (newPage: number) => {
    fetchTranslators(newPage, pageSize)
  }

  // Handle items per page change
  const handlePageSizeChange = (size: number) => {
    fetchTranslators(1, size)
  }

  // Handle adding a new translator
  const handleAddTranslator = async () => {
    try {
      const res = await fetchWithRetry(`${API_URL}/inventory/translators/`, {
        method: "POST",
        headers,
        body: JSON.stringify(newTranslator),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.detail || "Failed to add translator")
      }

      const data = await res.json()
      setIsAddTranslatorOpen(false)

      // Reset form
      setNewTranslator({
        name: "",
        bio: "",
      })

      await fetchTranslators(1, pageSize)

      // Show toast notification
      toast.success("Translator Added Successfully", { description: "${data.name} has been added to the system." })

      // Show alert message
      showAlert("success", `New translator "${data.name}" has been successfully added to the system.`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      handleError(error, "Failed to add translator")
      showAlert("error", "Failed to add translator. Please try again.")
    }
  }

  // Handle updating a translator
  const handleUpdateTranslator = async () => {
    if (!editTranslator) return

    try {
      const res = await fetchWithRetry(`${API_URL}/inventory/translators/${editTranslator.id}/`, {
        method: "PUT",
        headers,
        body: JSON.stringify(editTranslator),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.detail || "Failed to update translator")
      }

      const responseData = await res.json()

      setEditTranslator(null)
      setIsEditTranslatorOpen(false)
      await fetchTranslators(currentPage, pageSize)

      // Show toast notification
      toast.success("Translator Updated Successfully", { description: "${responseData.name} has been updated." })

      // Show alert message
      showAlert("success", `Translator "${responseData.name}" has been successfully updated.`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      handleError(error, "Failed to update translator")
      const errorMessage = error instanceof Error ? error.message : "Failed to update translator"
      showAlert("error", `Failed to update translator: ${errorMessage}`)
    }
  }

  // Handle deleting a translator
  const handleDeleteTranslator = async () => {
    if (deleteTranslatorId === null) return

    try {
      const translatorToDelete = translators.find((t) => t.id === deleteTranslatorId)
      if (!translatorToDelete) return

      const res = await fetchWithRetry(`${API_URL}/inventory/translators/${deleteTranslatorId}/delete/`, {
        method: "DELETE",
        headers,
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.detail || "Failed to delete translator")
      }

      setDeleteTranslatorId(null)
      setIsDeleteAlertOpen(false)

      const nextPage =
        translators.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage
      await fetchTranslators(nextPage, pageSize)

      // Show toast notification
      toast.error("Translator Deleted", { description: "${translatorToDelete.name} has been permanently removed from the system." })

      // Show alert message
      showAlert("warning", `Translator "${translatorToDelete.name}" has been permanently deleted from the system.`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      handleError(error, "Failed to delete translator")
      showAlert("error", "Failed to delete translator. Please try again.")
    }
  }

  // Open edit dialog with translator data
  const openEditDialog = (translator: Translator) => {
    setEditTranslator(translator)
    setIsEditTranslatorOpen(true)
  }

  // Open delete confirmation
  const openDeleteDialog = (translatorId: number) => {
    setDeleteTranslatorId(translatorId)
    setIsDeleteAlertOpen(true)
  }

  return (
    <>
      <DocumentTitle title="Translators" />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <PageBreadcrumb items={[DASHBOARD_CRUMB, DEFINITIONS_CRUMB, { label: "Translators" }]} />
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
            <h2 className="text-xl font-semibold mb-4">Translator Management</h2>
            <p className="mb-6">Manage translators and their information.</p>

            <div className="border rounded-md">
              <div className="bg-muted p-4 flex justify-between items-center">
                <h3 className="font-medium">Translators</h3>
                <Dialog open={isAddTranslatorOpen} onOpenChange={setIsAddTranslatorOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-primary text-primary-foreground">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Translator
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Translator</DialogTitle>
                      <DialogDescription>Create a new translator entry.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          value={newTranslator.name}
                          onChange={(e) => setNewTranslator({ ...newTranslator, name: e.target.value })}
                          placeholder="Enter translator name"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="bio">Bio</Label>
                        <Textarea
                          id="bio"
                          value={newTranslator.bio || ""}
                          onChange={(e) => setNewTranslator({ ...newTranslator, bio: e.target.value })}
                          placeholder="Enter translator biography"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddTranslatorOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddTranslator}>Add Translator</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Bio</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableSkeleton columns={3} rows={5} hasActions />
                    ) : translators.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="py-8 text-center">
                          No translators found
                        </TableCell>
                      </TableRow>
                    ) : (
                      translators.map((translator) => (
                        <TableRow key={translator.id}>
                          <TableCell className="font-medium">{translator.name}</TableCell>
                          <TableCell>{translator.bio || "No bio available"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {/* Desktop view - separate buttons */}
                              <div className="hidden sm:flex gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEditDialog(translator)}
                                >
                                  <Edit className="h-4 w-4" />
                                  <span className="sr-only">Edit</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => openDeleteDialog(translator.id)}
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
                                    <DropdownMenuItem onClick={() => openEditDialog(translator)}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => openDeleteDialog(translator.id)}
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

      {/* Edit Translator Dialog */}
      <Dialog open={isEditTranslatorOpen} onOpenChange={setIsEditTranslatorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Translator</DialogTitle>
            <DialogDescription>Update translator information.</DialogDescription>
          </DialogHeader>
          {editTranslator && (
            <div className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editTranslator.name}
                  onChange={(e) => setEditTranslator({ ...editTranslator, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-bio">Bio</Label>
                <Textarea
                  id="edit-bio"
                  value={editTranslator.bio || ""}
                  onChange={(e) => setEditTranslator({ ...editTranslator, bio: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditTranslatorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateTranslator}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={isDeleteAlertOpen}
        onOpenChange={setIsDeleteAlertOpen}
        description={
          deleteTranslatorId !== null ? (
            <>
              You are about to delete{" "}
              <strong>{translators.find((t) => t.id === deleteTranslatorId)?.name}</strong>. This action cannot be undone.
              This will permanently remove the translator from your system.
            </>
          ) : (
            ""
          )
        }
        onConfirm={handleDeleteTranslator}
      />
    </>
  )
}
