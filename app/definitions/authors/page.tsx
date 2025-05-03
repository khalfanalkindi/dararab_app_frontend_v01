"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://dararabappbackendv01-production.up.railway.app/api"

interface Author {
  id: number
  name: string
  bio: string
}

export default function AuthorManagement() {
  const [authors, setAuthors] = useState<Author[]>([])
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
  const [deleteAuthorId, setDeleteAuthorId] = useState<number | null>(null)
  const [editAuthor, setEditAuthor] = useState<Author | null>(null)
  const [isAddAuthorOpen, setIsAddAuthorOpen] = useState(false)
  const [isEditAuthorOpen, setIsEditAuthorOpen] = useState(false)
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

  // Form state for new author
  const [newAuthor, setNewAuthor] = useState<Partial<Author>>({
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

  useEffect(() => {
    fetchAuthors()
  }, [])

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
  }

  const fetchAuthors = async () => {
    try {
      const res = await fetch(`${API_URL}/inventory/authors/`, { headers })
      const data = await res.json()
      // Ensure data is an array
      const authorsData = Array.isArray(data) ? data : data.results || []
      setAuthors(authorsData)
      setTotalItems(authorsData.length)
    } catch (error) {
      console.error("Error fetching authors:", error)
      // Set empty array on error
      setAuthors([])
      setTotalItems(0)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate pagination values
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentAuthors = authors.slice(startIndex, endIndex)

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  // Handle items per page change
  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value))
    setCurrentPage(1) // Reset to first page when changing items per page
  }

  // Handle adding a new author
  const handleAddAuthor = async () => {
    try {
      const res = await fetch(`${API_URL}/inventory/authors/`, {
        method: "POST",
        headers,
        body: JSON.stringify(newAuthor),
      })

      if (!res.ok) throw new Error("Failed to add author")

      const data = await res.json()
      setAuthors([...authors, data])
      setTotalItems(totalItems + 1)

      // Reset form
      setNewAuthor({
        name: "",
        bio: "",
      })

      setIsAddAuthorOpen(false)

      // Show toast notification
      toast({
        title: "Author Added Successfully",
        description: `${data.name} has been added to the system.`,
        variant: "default",
      })

      // Show alert message
      showAlert("success", `New author "${data.name}" has been successfully added to the system.`)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add author",
        variant: "destructive",
      })
      showAlert("error", "Failed to add author. Please try again.")
    }
  }

  // Handle updating an author
  const handleUpdateAuthor = async () => {
    if (!editAuthor) return

    try {
      const res = await fetch(`${API_URL}/inventory/authors/${editAuthor.id}/`, {
        method: "PUT",
        headers,
        body: JSON.stringify(editAuthor),
      })

      const responseData = await res.json()

      if (!res.ok) {
        throw new Error(JSON.stringify(responseData))
      }

      setAuthors(authors.map((a) => (a.id === responseData.id ? responseData : a)))
      setEditAuthor(null)
      setIsEditAuthorOpen(false)

      // Show toast notification
      toast({
        title: "Author Updated Successfully",
        description: `${responseData.name} has been updated.`,
        variant: "default",
      })

      // Show alert message
      showAlert("success", `Author "${responseData.name}" has been successfully updated.`)
    } catch (error) {
      console.error("Update error:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to update author"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      showAlert("error", `Failed to update author: ${errorMessage}`)
    }
  }

  // Handle deleting an author
  const handleDeleteAuthor = async () => {
    if (deleteAuthorId === null) return

    try {
      const authorToDelete = authors.find((a) => a.id === deleteAuthorId)
      if (!authorToDelete) return

      const res = await fetch(`${API_URL}/inventory/authors/${deleteAuthorId}/delete/`, {
        method: "DELETE",
        headers,
      })

      if (!res.ok) throw new Error("Failed to delete author")

      setAuthors(authors.filter((a) => a.id !== deleteAuthorId))
      setTotalItems(totalItems - 1)
      setDeleteAuthorId(null)
      setIsDeleteAlertOpen(false)
      setDeleteConfirm("")

      // Show toast notification
      toast({
        title: "Author Deleted",
        description: `${authorToDelete.name} has been permanently removed from the system.`,
        variant: "destructive",
      })

      // Show alert message
      showAlert("warning", `Author "${authorToDelete.name}" has been permanently deleted from the system.`)
    } catch (error) {
      console.error("Delete error:", error)
      toast({
        title: "Error",
        description: "Failed to delete author",
        variant: "destructive",
      })
      showAlert("error", "Failed to delete author. Please try again.")
    }
  }

  // Open edit dialog with author data
  const openEditDialog = (author: Author) => {
    setEditAuthor(author)
    setIsEditAuthorOpen(true)
  }

  // Open delete confirmation
  const openDeleteDialog = (authorId: number) => {
    setDeleteAuthorId(authorId)
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
                  <BreadcrumbPage>Authors</BreadcrumbPage>
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
            <h2 className="text-xl font-semibold mb-4">Author Management</h2>
            <p className="mb-6">Manage authors and their information.</p>

            <div className="border rounded-md">
              <div className="bg-muted p-4 flex justify-between items-center">
                <h3 className="font-medium">Authors</h3>
                <Dialog open={isAddAuthorOpen} onOpenChange={setIsAddAuthorOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-primary text-primary-foreground">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Author
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Author</DialogTitle>
                      <DialogDescription>Create a new author entry.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          value={newAuthor.name}
                          onChange={(e) => setNewAuthor({ ...newAuthor, name: e.target.value })}
                          placeholder="Enter author name"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="bio">Bio</Label>
                        <Textarea
                          id="bio"
                          value={newAuthor.bio || ""}
                          onChange={(e) => setNewAuthor({ ...newAuthor, bio: e.target.value })}
                          placeholder="Enter author biography"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddAuthorOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddAuthor}>Add Author</Button>
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
                        <th className="text-left font-medium p-2">Bio</th>
                        <th className="text-right font-medium p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={3} className="py-8 text-center">
                            Loading authors...
                          </td>
                        </tr>
                      ) : currentAuthors.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-8 text-center">
                            No authors found
                          </td>
                        </tr>
                      ) : (
                        currentAuthors.map((author) => (
                          <tr key={author.id} className="border-b last:border-0">
                            <td className="p-2 font-medium">{author.name}</td>
                            <td className="p-2">{author.bio || "No bio available"}</td>
                            <td className="p-2 text-right">
                              <div className="flex justify-end gap-2">
                                {/* Desktop view - separate buttons */}
                                <div className="hidden sm:flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openEditDialog(author)}
                                  >
                                    <Edit className="h-4 w-4" />
                                    <span className="sr-only">Edit</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => openDeleteDialog(author.id)}
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
                                      <DropdownMenuItem onClick={() => openEditDialog(author)}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => openDeleteDialog(author.id)}
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
                {!isLoading && authors.length > 0 && (
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

      {/* Edit Author Dialog */}
      <Dialog open={isEditAuthorOpen} onOpenChange={setIsEditAuthorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Author</DialogTitle>
            <DialogDescription>Update author information.</DialogDescription>
          </DialogHeader>
          {editAuthor && (
            <div className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editAuthor.name}
                  onChange={(e) => setEditAuthor({ ...editAuthor, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-bio">Bio</Label>
                <Textarea
                  id="edit-bio"
                  value={editAuthor.bio || ""}
                  onChange={(e) => setEditAuthor({ ...editAuthor, bio: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditAuthorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateAuthor}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteAuthorId !== null && (
                <>
                  You are about to delete{" "}
                  <strong>{authors.find((a) => a.id === deleteAuthorId)?.name}</strong>. This action cannot be undone.
                  This will permanently remove the author from your system.
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
              onClick={handleDeleteAuthor}
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


