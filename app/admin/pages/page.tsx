"use client"

import { ErrorBoundary } from "@/components/ErrorBoundary"
import { DocumentTitle } from "@/components/document-title"
import { PageBreadcrumb, useAppCrumbs } from "@/components/page-breadcrumb"
import { useLanguage } from "@/components/language-context"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { API_URL } from "@/lib/config"
import { fetchWithRetry } from "@/lib/apiClient"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
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
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// Define page type
type Page = {
  id: number;
  name: string;
  name_ar: string;
  url: string;
}

export default function PagesManagement() {
  const { t } = useLanguage()
  const { dashboard: dashboardCrumb, admin: adminCrumb } = useAppCrumbs()
  const [pages, setPages] = useState<Page[]>([])
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
  const [pageToDelete, setPageToDelete] = useState<number | null>(null)
  const [editingPage, setEditingPage] = useState<Page | null>(null)
  const [isAddPageOpen, setIsAddPageOpen] = useState(false)
  const [isEditPageOpen, setIsEditPageOpen] = useState(false)
  const [actionAlert, setActionAlert] = useState<{
    type: "success" | "error" | "warning" | null;
    message: string;
  }>({
    type: null,
    message: "",
  })
  const [isLoading, setIsLoading] = useState(true)

  // AbortController refs for request cancellation
  const fetchPagesAbortControllerRef = useRef<AbortController | null>(null)
  const addPageAbortControllerRef = useRef<AbortController | null>(null)
  const updatePageAbortControllerRef = useRef<AbortController | null>(null)
  const deletePageAbortControllerRef = useRef<AbortController | null>(null)

  // Memoized headers object
  const headers = useMemo(() => {
    const token = localStorage.getItem("accessToken")
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }
  }, [])

// Standardized error handling utility
  const handleError = useCallback((error: unknown, defaultMessage: string) => {
    // Silently handle AbortError (request cancellation)
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Request aborted')
      }
      return
    }

    const errorMessage = error instanceof Error ? error.message : defaultMessage
    
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error:', errorMessage, error)
    }

    toast.error(t("toasts.error"), { description: errorMessage })
  }, [t])

  // Form state for new page
  const [newPage, setNewPage] = useState<Omit<Page, 'id'>>({
    name: "",
    name_ar: "",
    url: "",
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
    const fetchPages = async () => {
      // Cancel previous request if any
      if (fetchPagesAbortControllerRef.current) {
        fetchPagesAbortControllerRef.current.abort()
      }
      
      const controller = new AbortController()
      fetchPagesAbortControllerRef.current = controller
      
      setIsLoading(true)
      try {
        const response = await fetchWithRetry(`${API_URL}/pages/`, {
          headers,
          signal: controller.signal,
        })
        if (!response.ok) throw new Error("Failed to fetch pages")
        const data = await response.json()
        // Handle both array and paginated response formats
        setPages(Array.isArray(data) ? data : data.results || [])
      } catch (error) {
        handleError(error, "Failed to fetch pages")
        showAlert("error", "Failed to fetch pages. Please try again later.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchPages()

    // Cleanup: abort pending requests on unmount
    return () => {
      if (fetchPagesAbortControllerRef.current) {
        fetchPagesAbortControllerRef.current.abort()
      }
    }
  }, [fetchWithRetry, handleError, headers])

  // Handle adding a new page
  const handleAddPage = async () => {
    // Cancel previous request if any
    if (addPageAbortControllerRef.current) {
      addPageAbortControllerRef.current.abort()
    }
    
    const controller = new AbortController()
    addPageAbortControllerRef.current = controller
    
    try {
      const response = await fetchWithRetry(`${API_URL}/pages/`, {
        method: "POST",
        headers,
        body: JSON.stringify(newPage),
        signal: controller.signal,
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
      toast.success(t("adminToasts.added", { entity: t("admin.permissions.page") }))

      // Show alert message
      showAlert("success", `New page "${addedPage.name}" has been successfully added to the system.`)
    } catch (error) {
      handleError(error, "Failed to add page")
    }
  }

  // Handle updating a page
  const handleUpdatePage = async () => {
    if (!editingPage) return

    // Cancel previous request if any
    if (updatePageAbortControllerRef.current) {
      updatePageAbortControllerRef.current.abort()
    }
    
    const controller = new AbortController()
    updatePageAbortControllerRef.current = controller

    try {
      const response = await fetchWithRetry(`${API_URL}/pages/${editingPage.id}/`, {
        method: "PUT",
        headers,
        body: JSON.stringify(editingPage),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error("Failed to update page")

      const updatedPage = await response.json()
      setPages(pages.map((page) => (page.id === updatedPage.id ? updatedPage : page)))
      setIsEditPageOpen(false)

      // Show toast notification
      toast.success(t("adminToasts.updated", { entity: t("admin.permissions.page") }))

      // Show alert message
      showAlert("success", `Page "${updatedPage.name}" has been successfully updated.`)
    } catch (error) {
      handleError(error, "Failed to update page")
    }
  }

  // Handle deleting a page
  const handleDeletePage = async () => {
    if (pageToDelete === null) return

    // Cancel previous request if any
    if (deletePageAbortControllerRef.current) {
      deletePageAbortControllerRef.current.abort()
    }
    
    const controller = new AbortController()
    deletePageAbortControllerRef.current = controller

    try {
      const pageToDeleteData = pages.find((p) => p.id === pageToDelete)
      if (!pageToDeleteData) return

      const response = await fetchWithRetry(`${API_URL}/pages/${pageToDelete}/delete/`, {
        method: "DELETE",
        headers,
        signal: controller.signal,
      })

      if (!response.ok) throw new Error("Failed to delete page")

      setPages(pages.filter((page) => page.id !== pageToDelete))
      setPageToDelete(null)
      setIsDeleteAlertOpen(false)

      // Show toast notification
      toast.success(t("adminToasts.deleted", { entity: t("admin.permissions.page") }))

      // Show alert message
      showAlert("warning", `Page "${pageToDeleteData.name}" has been permanently deleted from the system.`)
    } catch (error) {
      handleError(error, "Failed to delete page")
    }
  }

  // Open edit dialog with page data
  const openEditDialog = (page: Page) => {
    setEditingPage({ ...page })
    setIsEditPageOpen(true)
  }

  // Open delete confirmation
  const openDeleteDialog = (pageId: number) => {
    setPageToDelete(pageId)
    setIsDeleteAlertOpen(true)
  }

  // Format URL for display
  const formatUrl = (url: string) => {
    if (!url) return ""
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url
    }
    return `/${url.replace(/^\//, "")}`
  }

  return (
    <ErrorBoundary>
    <>
      <DocumentTitle title={t("nav.pages")} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <PageBreadcrumb items={[dashboardCrumb, adminCrumb, { label: t("nav.pages") }]} />
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
            <h2 className="text-xl font-semibold mb-4">{t("admin.pages.management")}</h2>
            <p className="mb-6">{t("admin.pages.description")}</p>

            <div className="border rounded-md">
              <div className="bg-muted p-4 flex justify-between items-center">
                <h3 className="font-medium">{t("nav.pages")}</h3>
                <Dialog open={isAddPageOpen} onOpenChange={setIsAddPageOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-primary text-primary-foreground">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      {t("admin.pages.add")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("admin.pages.addNew")}</DialogTitle>
                      <DialogDescription>Create a new page for your website.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="name">{t("admin.pages.nameEn")}</Label>
                        <Input
                          id="name"
                          value={newPage.name}
                          onChange={(e) => setNewPage({ ...newPage, name: e.target.value })}
                          placeholder={t("admin.pages.nameEn")}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="name_ar">{t("admin.pages.nameAr")}</Label>
                        <Input
                          id="name_ar"
                          value={newPage.name_ar}
                          onChange={(e) => setNewPage({ ...newPage, name_ar: e.target.value })}
                          placeholder={t("admin.pages.nameAr")}
                          dir="rtl"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="url">{t("admin.pages.url")}</Label>
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
                        {t("common.cancel")}
                      </Button>
                      <Button onClick={handleAddPage}>{t("admin.pages.add")}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-5 font-medium text-sm mb-2 border-b pb-2">
                  <div>{t("admin.pages.nameEn")}</div>
                  <div>{t("admin.pages.nameAr")}</div>
                  <div className="col-span-2">{t("admin.pages.url")}</div>
                  <div className="text-right">{t("common.actions")}</div>
                </div>
                {isLoading ? (
                  <div className="py-8 text-center">{t("admin.pages.loading")}</div>
                ) : pages.length === 0 ? (
                  <div className="py-8 text-center">{t("admin.pages.empty")}</div>
                ) : (
                  pages.map((page) => (
                    <div key={page.id} className="grid grid-cols-5 text-sm py-3 border-b last:border-0 items-center">
                      <div className="font-medium">{page.name}</div>
                      <div className="text-right">
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
                            <span className="sr-only">{t("common.edit")}</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => openDeleteDialog(page.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">{t("common.delete")}</span>
                          </Button>
                        </div>

                        {/* Mobile view - dropdown menu */}
                        <div className="sm:hidden">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">{t("common.actions")}</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>{t("common.actions")}</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => openEditDialog(page)}>
                                <Edit className="h-4 w-4 mr-2" />
                                {t("common.edit")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => openDeleteDialog(page.id)}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t("common.delete")}
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
            <DialogTitle>{t("admin.pages.editTitle")}</DialogTitle>
            <DialogDescription>Update page information.</DialogDescription>
          </DialogHeader>
          {editingPage && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">{t("admin.pages.nameEn")}</Label>
                <Input
                  id="edit-name"
                  value={editingPage.name || ""}
                  onChange={(e) => setEditingPage({ ...editingPage, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-name_ar">{t("admin.pages.nameAr")}</Label>
                <Input
                  id="edit-name_ar"
                  value={editingPage.name_ar || ""}
                  onChange={(e) => setEditingPage({ ...editingPage, name_ar: e.target.value })}
                  dir="rtl"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-url">{t("admin.pages.url")}</Label>
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
              {t("common.cancel")}
            </Button>
            <Button onClick={handleUpdatePage}>{t("common.saveChanges")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={isDeleteAlertOpen}
        onOpenChange={setIsDeleteAlertOpen}
        description={
          pageToDelete !== null ? (
            <>
              You are about to delete <strong>{pages.find((p) => p.id === pageToDelete)?.name}</strong>. This action
              cannot be undone. This will permanently remove the page from your website.
            </>
          ) : (
            ""
          )
        }
        onConfirm={handleDeletePage}
      />
    </>
  </ErrorBoundary>
  )
}
