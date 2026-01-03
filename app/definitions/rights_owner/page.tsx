"use client"

import Link from "next/link"
import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { AppSidebar } from "../../../components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Edit, Trash2, MoreHorizontal, PlusCircle, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { API_URL } from "@/lib/config"

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
  const [deleteConfirm, setDeleteConfirm] = useState("")
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
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [totalItems, setTotalItems] = useState(0)

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

  // fetchWithRetry utility with exponential backoff
  const fetchWithRetry = useCallback(async (
    url: string,
    options: RequestInit = {},
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<Response> => {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, options)
        
        // For 5xx errors or 429, throw to trigger retry
        if (response.status >= 500 || response.status === 429) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        return response
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        // Don't retry on AbortError
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error
        }
        
        // Don't retry on 4xx client errors (except 429)
        if (error instanceof Error && error.message.includes('HTTP 4')) {
          throw error
        }
        
        // If this was the last attempt, throw the error
        if (attempt === maxRetries) {
          break
        }
        
        // Wait before retrying (exponential backoff)
        const delay = baseDelay * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw lastError || new Error('Unknown error in fetchWithRetry')
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
    toast({
      title: options?.title || "Error",
      description: errorMessage,
      variant: "destructive",
      duration: options?.duration || 5000,
    })
  }, [])

  useEffect(() => {
    fetchRightsOwners()
    
    // Cleanup: abort pending requests on unmount
    return () => {
      fetchRightsOwnersAbortControllerRef.current?.abort()
    }
  }, [])

  const fetchRightsOwners = async () => {
    // Abort previous request if still pending
    fetchRightsOwnersAbortControllerRef.current?.abort()
    fetchRightsOwnersAbortControllerRef.current = new AbortController()

    try {
      const res = await fetchWithRetry(
        `${API_URL}/inventory/rights-owners/?page_size=1000`,
        {
          headers,
          signal: fetchRightsOwnersAbortControllerRef.current.signal
        }
      )
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }
      
      const data = await res.json()
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('API Response:', data)
      }
      
      // Handle the response structure with results array
      const rightsOwnersData = data.results || []
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('Processed Rights Owners:', rightsOwnersData)
      }
      
      setRightsOwners(rightsOwnersData)
      setTotalItems(data.count || rightsOwnersData.length)
    } catch (error) {
      handleError(error, "Failed to fetch rights owners")
      setRightsOwners([])
      setTotalItems(0)
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate pagination values
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentRightsOwners = rightsOwners.slice(startIndex, endIndex)

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  // Handle items per page change
  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value))
    setCurrentPage(1) // Reset to first page when changing items per page
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
      setRightsOwners([...rightsOwners, data])
      setTotalItems(totalItems + 1)

      // Reset form
      setNewRightsOwner({
        name: "",
        contact_info: "",
      })

      setIsAddRightsOwnerOpen(false)

      // Show toast notification
      toast({
        title: "Rights Owner Added Successfully",
        description: `${data.name} has been added to the system.`,
        variant: "default",
      })

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

      setRightsOwners(rightsOwners.map((r) => (r.id === responseData.id ? responseData : r)))
      setEditRightsOwner(null)
      setIsEditRightsOwnerOpen(false)

      // Show toast notification
      toast({
        title: "Rights Owner Updated Successfully",
        description: `${responseData.name} has been updated.`,
        variant: "default",
      })

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

      setRightsOwners(rightsOwners.filter((r) => r.id !== deleteRightsOwnerId))
      setTotalItems(totalItems - 1)
      setDeleteRightsOwnerId(null)
      setIsDeleteAlertOpen(false)
      setDeleteConfirm("")

      // Show toast notification
      toast({
        title: "Rights Owner Deleted",
        description: `${rightsOwnerToDelete.name} has been permanently removed from the system.`,
        variant: "destructive",
      })

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
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink asChild>
                    <Link href="/admin">Admin</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Rights Owners</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
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
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-sm border-b">
                        <th className="text-left font-medium p-2">Name</th>
                        <th className="text-left font-medium p-2">Contact Info</th>
                        <th className="text-right font-medium p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={3} className="py-8 text-center">
                            Loading rights owners...
                          </td>
                        </tr>
                      ) : currentRightsOwners.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-8 text-center">
                            No rights owners found
                          </td>
                        </tr>
                      ) : (
                        currentRightsOwners.map((rightsOwner) => (
                          <tr key={rightsOwner.id} className="border-b last:border-0">
                            <td className="p-2 font-medium">{rightsOwner.name}</td>
                            <td className="p-2">{rightsOwner.contact_info || rightsOwner.bio || "No contact info available"}</td>
                            <td className="p-2 text-right">
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
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {!isLoading && rightsOwners.length > 0 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Items per page:</span>
                      <Select
                        value={itemsPerPage.toString()}
                        onValueChange={handleItemsPerPageChange}
                      >
                        <SelectTrigger className="h-8 w-[70px]">
                          <SelectValue placeholder={itemsPerPage} />
                        </SelectTrigger>
                        <SelectContent side="top">
                          {[10, 20, 30, 40, 50].map((pageSize) => (
                            <SelectItem key={pageSize} value={pageSize.toString()}>
                              {pageSize}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span className="sr-only">Previous page</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                          <span className="sr-only">Next page</span>
                        </Button>
                      </div>
                    </div>
                  </div>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteRightsOwnerId !== null && (
                <>
                  You are about to delete{" "}
                  <strong>{rightsOwners.find((r) => r.id === deleteRightsOwnerId)?.name}</strong>. This action cannot be undone.
                  This will permanently remove the rights owner from your system.
                  <div className="mt-4">
                    <Label htmlFor="confirm-delete">Type "DELETE" to confirm</Label>
                    <Input
                      id="confirm-delete"
                      value={deleteConfirm}
                      onChange={(e) => setDeleteConfirm(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirm("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRightsOwner}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteConfirm !== "DELETE"}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  )
}


