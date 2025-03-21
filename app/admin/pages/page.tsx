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
import { Edit, Trash2, MoreHorizontal, PlusCircle, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react"
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"

export default function PagesManagement() {
  const [pages, setPages] = useState([])
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
  const [pageToDelete, setPageToDelete] = useState(null)
  const [editingPage, setEditingPage] = useState(null)
  const [isAddPageOpen, setIsAddPageOpen] = useState(false)
  const [isEditPageOpen, setIsEditPageOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [actionAlert, setActionAlert] = useState({
    type: null,
    message: "",
  })
  const [isLoading, setIsLoading] = useState(true)

  // Form state for new page
  const [newPage, setNewPage] = useState({
    name: "",
    name_ar: "",
    url: "",
  })

  // Show alert message
  const showAlert = (type, message) => {
    setActionAlert({ type, message })
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setActionAlert({ type: null, message: "" })
    }, 5000)
  }

  useEffect(() => {
    const fetchPages = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`${API_URL}/pages/`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
        })
        if (!response.ok) throw new Error("Failed to fetch pages")
        setPages(await response.json())
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to fetch pages",
          variant: "destructive",
        })
        showAlert("error", "Failed to fetch pages. Please try again later.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchPages()
  }, [])

  // Handle adding a new page
  const handleAddPage = async () => {
    try {
      const response = await fetch(`${API_URL}/pages/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify(newPage),
      })

      if (!response.ok) throw new Error("Failed to add page")

      const addedPage = await response.json()
      setPages([...pages, addedPage])
      setNewPage({
        name: "",
        name_ar: "",
        url: "",
      })
      setIsAddPageOpen(false)

      // Show toast notification
      toast({
        title: "Page Added Successfully",
        description: `${addedPage.name} has been added to the system.`,
        variant: "default",
      })

      // Show alert message
      showAlert("success", `New page "${addedPage.name}" has been successfully added to the system.`)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add page",
        variant: "destructive",
      })
    }
  }

  // Handle updating a page
  const handleUpdatePage = async () => {
    if (!editingPage) return

    try {
      const response = await fetch(`${API_URL}/pages/${editingPage.id}/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify(editingPage),
      })

      if (!response.ok) throw new Error("Failed to update page")

      const updatedPage = await response.json()
      setPages(pages.map((page) => (page.id === updatedPage.id ? updatedPage : page)))
      setIsEditPageOpen(false)

      // Show toast notification
      toast({
        title: "Page Updated Successfully",
        description: `${updatedPage.name} has been updated.`,
        variant: "default",
      })

      // Show alert message
      showAlert("success", `Page "${updatedPage.name}" has been successfully updated.`)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update page",
        variant: "destructive",
      })
    }
  }

  // Handle deleting a page
  const handleDeletePage = async () => {
    if (pageToDelete === null) return

    try {
      const pageToDeleteData = pages.find((p) => p.id === pageToDelete)
      if (!pageToDeleteData) return

      const response = await fetch(`${API_URL}/pages/${pageToDelete}/delete/`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      })

      if (!response.ok) throw new Error("Failed to delete page")

      setPages(pages.filter((page) => page.id !== pageToDelete))
      setPageToDelete(null)
      setIsDeleteAlertOpen(false)
      setDeleteConfirm("")

      // Show toast notification
      toast({
        title: "Page Deleted",
        description: `${pageToDeleteData.name} has been permanently removed from the system.`,
        variant: "destructive",
      })

      // Show alert message
      showAlert("warning", `Page "${pageToDeleteData.name}" has been permanently deleted from the system.`)
    } catch (error) {
      console.error("Delete error:", error)
      toast({
        title: "Error",
        description: "Failed to delete page",
        variant: "destructive",
      })
    }
  }

  // Open edit dialog with page data
  const openEditDialog = (page) => {
    setEditingPage({ ...page })
    setIsEditPageOpen(true)
  }

  // Open delete confirmation
  const openDeleteDialog = (pageId) => {
    setPageToDelete(pageId)
    setIsDeleteAlertOpen(true)
  }

  // Format URL for display
  const formatUrl = (url) => {
    if (!url) return ""
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url
    }
    return `/${url.replace(/^\//, "")}`
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
                  <BreadcrumbPage>Pages</BreadcrumbPage>
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
            <h2 className="text-xl font-semibold mb-4">Page Management</h2>
            <p className="mb-6">Manage website pages and their URLs.</p>

            <div className="border rounded-md">
              <div className="bg-muted p-4 flex justify-between items-center">
                <h3 className="font-medium">Pages</h3>
                <Dialog open={isAddPageOpen} onOpenChange={setIsAddPageOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-primary text-primary-foreground">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Page
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Page</DialogTitle>
                      <DialogDescription>Create a new page for your website.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="name">Page Name (English)</Label>
                        <Input
                          id="name"
                          value={newPage.name}
                          onChange={(e) => setNewPage({ ...newPage, name: e.target.value })}
                          placeholder="Enter page name in English"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="name_ar">Page Name (Arabic)</Label>
                        <Input
                          id="name_ar"
                          value={newPage.name_ar}
                          onChange={(e) => setNewPage({ ...newPage, name_ar: e.target.value })}
                          placeholder="Enter page name in Arabic"
                          dir="rtl"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="url">Page URL</Label>
                        <Input
                          id="url"
                          value={newPage.url}
                          onChange={(e) => setNewPage({ ...newPage, url: e.target.value })}
                          placeholder="e.g., about-us or /contact"
                        />
                        <p className="text-xs text-muted-foreground">
                          Enter the URL path without the domain. For example: "about-us" or "/contact"
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddPageOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddPage}>Add Page</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-5 font-medium text-sm mb-2 border-b pb-2">
                  <div>Page Name (English)</div>
                  <div>Page Name (Arabic)</div>
                  <div className="col-span-2">URL</div>
                  <div className="text-right">Actions</div>
                </div>
                {isLoading ? (
                  <div className="py-8 text-center">Loading pages...</div>
                ) : pages.length === 0 ? (
                  <div className="py-8 text-center">No pages found</div>
                ) : (
                  pages.map((page) => (
                    <div key={page.id} className="grid grid-cols-5 text-sm py-3 border-b last:border-0 items-center">
                      <div className="font-medium">{page.name}</div>
                      <div className="text-right" className="text-center">
                        {page.name_ar || "لا يوجد اسم بالعربية"}
                      </div>
                      <div className="col-span-2 flex items-center">
                        <span className="truncate">{formatUrl(page.url)}</span>
                        {page.url && (
                          <a
                            href={formatUrl(page.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-blue-500 hover:text-blue-700"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span className="sr-only">Open page</span>
                          </a>
                        )}
                      </div>
                      <div className="flex justify-end gap-2">
                        {/* Desktop view - separate buttons */}
                        <div className="hidden sm:flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(page)}
                          >
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => openDeleteDialog(page.id)}
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
                              <DropdownMenuItem onClick={() => openEditDialog(page)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => openDeleteDialog(page.id)}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* Edit Page Dialog */}
      <Dialog open={isEditPageOpen} onOpenChange={setIsEditPageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Page</DialogTitle>
            <DialogDescription>Update page information.</DialogDescription>
          </DialogHeader>
          {editingPage && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Page Name (English)</Label>
                <Input
                  id="edit-name"
                  value={editingPage.name || ""}
                  onChange={(e) => setEditingPage({ ...editingPage, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-name_ar">Page Name (Arabic)</Label>
                <Input
                  id="edit-name_ar"
                  value={editingPage.name_ar || ""}
                  onChange={(e) => setEditingPage({ ...editingPage, name_ar: e.target.value })}
                  dir="rtl"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-url">Page URL</Label>
                <Input
                  id="edit-url"
                  value={editingPage.url || ""}
                  onChange={(e) => setEditingPage({ ...editingPage, url: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the URL path without the domain. For example: "about-us" or "/contact"
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditPageOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePage}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {pageToDelete !== null && (
                <>
                  You are about to delete <strong>{pages.find((p) => p.id === pageToDelete)?.name}</strong>. This action
                  cannot be undone. This will permanently remove the page from your website.
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
              onClick={handleDeletePage}
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

