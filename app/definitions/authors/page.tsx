"use client"

import { PageBreadcrumb, useAppCrumbs } from "@/components/page-breadcrumb"
import { DocumentTitle } from "@/components/document-title"
import { useLanguage } from "@/components/language-context"
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

interface Author {
  id: number
  name: string
  bio: string
}

export default function AuthorManagement() {
  const { t } = useLanguage()
  const { dashboard: dashboardCrumb, definitions: definitionsCrumb } = useAppCrumbs()
  const [authors, setAuthors] = useState<Author[]>([])
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
  const [deleteAuthorId, setDeleteAuthorId] = useState<number | null>(null)
  const [editAuthor, setEditAuthor] = useState<Author | null>(null)
  const [isAddAuthorOpen, setIsAddAuthorOpen] = useState(false)
  const [isEditAuthorOpen, setIsEditAuthorOpen] = useState(false)
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

  // AbortController refs for request cancellation
  const fetchAuthorsAbortControllerRef = useRef<AbortController | null>(null)

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
    toast.error(options?.title || t("toasts.error"), { description: errorMessage })
  }, [t])

  useEffect(() => {
    fetchAuthors(currentPage, pageSize)

    // Cleanup: abort pending requests on unmount
    return () => {
      fetchAuthorsAbortControllerRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial + page/size driven by handlers
  }, [])

  const fetchAuthors = async (page: number = currentPage, size: number = pageSize) => {
    // Abort previous request if still pending
    fetchAuthorsAbortControllerRef.current?.abort()
    fetchAuthorsAbortControllerRef.current = new AbortController()

    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(size),
        ordering: "name",
      })
      const res = await fetchWithRetry(
        `${API_URL}/inventory/authors/?${params.toString()}`,
        {
          headers,
          signal: fetchAuthorsAbortControllerRef.current.signal
        }
      )

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }

      const data = await res.json()
      const authorsData = Array.isArray(data) ? data : data.results || []

      setAuthors(authorsData)
      setTotalCount(
        Array.isArray(data)
          ? authorsData.length
          : typeof data.count === "number"
            ? data.count
            : authorsData.length,
      )
      setCurrentPage(page)
      setPageSize(size)
    } catch (error) {
      handleError(error, "Failed to fetch authors")
      setAuthors([])
      setTotalCount(0)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle page change
  const handlePageChange = (newPage: number) => {
    fetchAuthors(newPage, pageSize)
  }

  // Handle items per page change
  const handlePageSizeChange = (size: number) => {
    fetchAuthors(1, size)
  }

  // Handle adding a new author
  const handleAddAuthor = async () => {
    try {
      const res = await fetchWithRetry(`${API_URL}/inventory/authors/`, {
        method: "POST",
        headers,
        body: JSON.stringify(newAuthor),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.detail || "Failed to add author")
      }

      const data = await res.json()
      setIsAddAuthorOpen(false)

      // Reset form
      setNewAuthor({
        name: "",
        bio: "",
      })

      await fetchAuthors(1, pageSize)

      // Show toast notification
      toast.success(t("definitionsToasts.added", { entity: t("definitions.authors.title") }))

      // Show alert message
      showAlert("success", `New author "${data.name}" has been successfully added to the system.`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      handleError(error, "Failed to add author")
      showAlert("error", "Failed to add author. Please try again.")
    }
  }

  // Handle updating an author
  const handleUpdateAuthor = async () => {
    if (!editAuthor) return

    try {
      const res = await fetchWithRetry(`${API_URL}/inventory/authors/${editAuthor.id}/`, {
        method: "PUT",
        headers,
        body: JSON.stringify(editAuthor),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.detail || "Failed to update author")
      }

      const responseData = await res.json()

      setEditAuthor(null)
      setIsEditAuthorOpen(false)
      await fetchAuthors(currentPage, pageSize)

      // Show toast notification
      toast.success(t("definitionsToasts.updated", { entity: t("definitions.authors.title") }))

      // Show alert message
      showAlert("success", `Author "${responseData.name}" has been successfully updated.`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      handleError(error, "Failed to update author")
      const errorMessage = error instanceof Error ? error.message : "Failed to update author"
      showAlert("error", `Failed to update author: ${errorMessage}`)
    }
  }

  // Handle deleting an author
  const handleDeleteAuthor = async () => {
    if (deleteAuthorId === null) return

    try {
      const authorToDelete = authors.find((a) => a.id === deleteAuthorId)
      if (!authorToDelete) return

      const res = await fetchWithRetry(`${API_URL}/inventory/authors/${deleteAuthorId}/delete/`, {
        method: "DELETE",
        headers,
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.detail || "Failed to delete author")
      }

      setDeleteAuthorId(null)
      setIsDeleteAlertOpen(false)

      const nextPage =
        authors.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage
      await fetchAuthors(nextPage, pageSize)

      // Show toast notification
      toast.success(t("definitionsToasts.deleted", { entity: t("definitions.authors.title") }), { description: t("definitionsToasts.deletedDesc", { name: authorToDelete.name }) })

      // Show alert message
      showAlert("warning", `Author "${authorToDelete.name}" has been permanently deleted from the system.`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      handleError(error, "Failed to delete author")
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
    <>
      <DocumentTitle title={t("definitions.authors.title")} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <PageBreadcrumb items={[dashboardCrumb, definitionsCrumb, { label: t("nav.authors") }]} />
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
            <h2 className="text-xl font-semibold mb-4">{t("definitions.authors.management")}</h2>
            <p className="mb-6">{t("definitions.authors.description")}</p>

            <div className="border rounded-md">
              <div className="bg-muted p-4 flex justify-between items-center">
                <h3 className="font-medium">{t("definitions.authors.title")}</h3>
                <Dialog open={isAddAuthorOpen} onOpenChange={setIsAddAuthorOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-primary text-primary-foreground">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      {t("definitions.authors.add")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("definitions.authors.addNew")}</DialogTitle>
                      <DialogDescription>{t("definitions.authors.addDescription")}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="name">{t("definitions.authors.name")}</Label>
                        <Input
                          id="name"
                          value={newAuthor.name}
                          onChange={(e) => setNewAuthor({ ...newAuthor, name: e.target.value })}
                          placeholder="Enter author name"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="bio">{t("definitions.authors.bio")}</Label>
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
                        {t("common.cancel")}
                      </Button>
                      <Button onClick={handleAddAuthor}>{t("definitions.authors.add")}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("definitions.authors.name")}</TableHead>
                      <TableHead>{t("definitions.authors.bio")}</TableHead>
                      <TableHead className="text-right">{t("common.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableSkeleton columns={3} rows={5} hasActions />
                    ) : authors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="py-8 text-center">
                          {t("definitions.authors.empty")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      authors.map((author) => (
                        <TableRow key={author.id}>
                          <TableCell className="font-medium">{author.name}</TableCell>
                          <TableCell>{author.bio || "No bio available"}</TableCell>
                          <TableCell className="text-right">
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
                                  <span className="sr-only">{t("common.edit")}</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => openDeleteDialog(author.id)}
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
                                    <DropdownMenuItem onClick={() => openEditDialog(author)}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      {t("common.edit")}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => openDeleteDialog(author.id)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      {t("common.delete")}
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

      {/* Edit Author Dialog */}
      <Dialog open={isEditAuthorOpen} onOpenChange={setIsEditAuthorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("definitions.authors.editTitle")}</DialogTitle>
            <DialogDescription>{t("definitions.authors.editDescription")}</DialogDescription>
          </DialogHeader>
          {editAuthor && (
            <div className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">{t("definitions.authors.name")}</Label>
                <Input
                  id="edit-name"
                  value={editAuthor.name}
                  onChange={(e) => setEditAuthor({ ...editAuthor, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-bio">{t("definitions.authors.bio")}</Label>
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
              {t("common.cancel")}
            </Button>
            <Button onClick={handleUpdateAuthor}>{t("common.saveChanges")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={isDeleteAlertOpen}
        onOpenChange={setIsDeleteAlertOpen}
        description={
          deleteAuthorId !== null ? (
            <>
              You are about to delete{" "}
              <strong>{authors.find((a) => a.id === deleteAuthorId)?.name}</strong>. This action cannot be undone.
              This will permanently remove the author from your system.
            </>
          ) : (
            ""
          )
        }
        onConfirm={handleDeleteAuthor}
      />
    </>
  )
}
