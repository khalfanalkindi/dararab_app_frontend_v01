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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { API_URL } from "@/lib/config"
import { ListPagination } from "@/components/list-pagination"

interface ListItem {
  id: number
  name: string
}

interface Warehouse {
  id: number
  name_en: string
  name_ar: string
  type: ListItem | null
  location: string
}

export default function WarehouseManagement() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [warehouseTypes, setWarehouseTypes] = useState<ListItem[]>([])
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
  const [deleteWarehouseId, setDeleteWarehouseId] = useState<number | null>(null)
  const [editWarehouse, setEditWarehouse] = useState<Warehouse | null>(null)
  const [isAddWarehouseOpen, setIsAddWarehouseOpen] = useState(false)
  const [isEditWarehouseOpen, setIsEditWarehouseOpen] = useState(false)
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

  // Form state for new warehouse
  const [newWarehouse, setNewWarehouse] = useState<Partial<Warehouse>>({
    name_en: "",
    name_ar: "",
    type: null,
    location: "",
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
  const fetchWarehousesAbortControllerRef = useRef<AbortController | null>(null)
  const fetchWarehouseTypesAbortControllerRef = useRef<AbortController | null>(null)

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
    fetchWarehouses(currentPage, pageSize)
    fetchWarehouseTypes()

    // Cleanup: abort pending requests on unmount
    return () => {
      fetchWarehousesAbortControllerRef.current?.abort()
      fetchWarehouseTypesAbortControllerRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial + page/size driven by handlers
  }, [])

  const fetchWarehouseTypes = async () => {
    // Abort previous request if still pending
    fetchWarehouseTypesAbortControllerRef.current?.abort()
    fetchWarehouseTypesAbortControllerRef.current = new AbortController()

    try {
      const res = await fetchWithRetry(
        `${API_URL}/common/list-items/warehouse_type`,
        {
          headers,
          signal: fetchWarehouseTypesAbortControllerRef.current.signal
        }
      )

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }

      const data = await res.json()
      const typesData = Array.isArray(data) ? data : data.results || []
      setWarehouseTypes(typesData)
    } catch (error) {
      handleError(error, "Failed to fetch warehouse types")
      setWarehouseTypes([])
    }
  }

  const fetchWarehouses = async (page: number = currentPage, size: number = pageSize) => {
    // Abort previous request if still pending
    fetchWarehousesAbortControllerRef.current?.abort()
    fetchWarehousesAbortControllerRef.current = new AbortController()

    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(size),
        ordering: "name_en",
      })
      const res = await fetchWithRetry(
        `${API_URL}/inventory/warehouses/?${params.toString()}`,
        {
          headers,
          signal: fetchWarehousesAbortControllerRef.current.signal
        }
      )

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }

      const data = await res.json()
      const warehousesData = Array.isArray(data) ? data : data.results || []

      setWarehouses(warehousesData)
      setTotalCount(
        Array.isArray(data)
          ? warehousesData.length
          : typeof data.count === "number"
            ? data.count
            : warehousesData.length,
      )
      setCurrentPage(page)
      setPageSize(size)
    } catch (error) {
      handleError(error, "Failed to fetch warehouses")
      setWarehouses([])
      setTotalCount(0)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle page change
  const handlePageChange = (newPage: number) => {
    fetchWarehouses(newPage, pageSize)
  }

  // Handle items per page change
  const handlePageSizeChange = (size: number) => {
    fetchWarehouses(1, size)
  }

  // Handle adding a new warehouse
  const handleAddWarehouse = async () => {
    try {
      const res = await fetchWithRetry(`${API_URL}/inventory/warehouses/`, {
        method: "POST",
        headers,
        body: JSON.stringify(newWarehouse),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.detail || "Failed to add warehouse")
      }

      const data = await res.json()
      setIsAddWarehouseOpen(false)

      // Reset form
      setNewWarehouse({
        name_en: "",
        name_ar: "",
        type: null,
        location: "",
      })

      await fetchWarehouses(1, pageSize)

      // Show toast notification
      toast.success("Warehouse Added Successfully", { description: "${data.name_ar} / ${data.name_en} has been added to the system." })

      // Show alert message
      showAlert("success", `New warehouse "${data.name_ar} / ${data.name_en}" has been successfully added to the system.`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      handleError(error, "Failed to add warehouse")
      showAlert("error", "Failed to add warehouse. Please try again.")
    }
  }

  // Handle updating a warehouse
  const handleUpdateWarehouse = async () => {
    if (!editWarehouse) return

    try {
      const res = await fetchWithRetry(`${API_URL}/inventory/warehouses/${editWarehouse.id}/`, {
        method: "PUT",
        headers,
        body: JSON.stringify(editWarehouse),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.detail || "Failed to update warehouse")
      }

      const responseData = await res.json()

      setEditWarehouse(null)
      setIsEditWarehouseOpen(false)
      await fetchWarehouses(currentPage, pageSize)

      // Show toast notification
      toast.success("Warehouse Updated Successfully", { description: "${responseData.name_ar} / ${responseData.name_en} has been updated." })

      // Show alert message
      showAlert("success", `Warehouse "${responseData.name_ar} / ${responseData.name_en}" has been successfully updated.`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      handleError(error, "Failed to update warehouse")
      const errorMessage = error instanceof Error ? error.message : "Failed to update warehouse"
      showAlert("error", `Failed to update warehouse: ${errorMessage}`)
    }
  }

  // Handle deleting a warehouse
  const handleDeleteWarehouse = async () => {
    if (deleteWarehouseId === null) return

    try {
      const warehouseToDelete = warehouses.find((w) => w.id === deleteWarehouseId)
      if (!warehouseToDelete) return

      const res = await fetchWithRetry(`${API_URL}/inventory/warehouses/${deleteWarehouseId}/delete/`, {
        method: "DELETE",
        headers,
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.detail || "Failed to delete warehouse")
      }

      setDeleteWarehouseId(null)
      setIsDeleteAlertOpen(false)

      const nextPage =
        warehouses.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage
      await fetchWarehouses(nextPage, pageSize)

      // Show toast notification
      toast.error("Warehouse Deleted", { description: "${warehouseToDelete.name_ar} / ${warehouseToDelete.name_en} has been permanently removed from the system." })

      // Show alert message
      showAlert("warning", `Warehouse "${warehouseToDelete.name_ar} / ${warehouseToDelete.name_en}" has been permanently deleted from the system.`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      handleError(error, "Failed to delete warehouse")
      showAlert("error", "Failed to delete warehouse. Please try again.")
    }
  }

  // Open edit dialog with warehouse data
  const openEditDialog = (warehouse: Warehouse) => {
    setEditWarehouse(warehouse)
    setIsEditWarehouseOpen(true)
  }

  // Open delete confirmation
  const openDeleteDialog = (warehouseId: number) => {
    setDeleteWarehouseId(warehouseId)
    setIsDeleteAlertOpen(true)
  }

  return (
    <>
      <DocumentTitle title="Warehouses" />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <PageBreadcrumb items={[DASHBOARD_CRUMB, DEFINITIONS_CRUMB, { label: "Warehouses" }]} />
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
            <h2 className="text-xl font-semibold mb-4">Warehouse Management</h2>
            <p className="mb-6">Manage warehouses and their information.</p>

            <div className="border rounded-md">
              <div className="bg-muted p-4 flex justify-between items-center">
                <h3 className="font-medium">Warehouses</h3>
                <Dialog open={isAddWarehouseOpen} onOpenChange={setIsAddWarehouseOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-primary text-primary-foreground">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Warehouse
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Warehouse</DialogTitle>
                      <DialogDescription>Create a new warehouse entry.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="name_en">English Name</Label>
                        <Input
                          id="name_en"
                          value={newWarehouse.name_en}
                          onChange={(e) => setNewWarehouse({ ...newWarehouse, name_en: e.target.value })}
                          placeholder="Enter warehouse name in English"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="name_ar">Arabic Name</Label>
                        <Input
                          id="name_ar"
                          value={newWarehouse.name_ar}
                          onChange={(e) => setNewWarehouse({ ...newWarehouse, name_ar: e.target.value })}
                          placeholder="Enter warehouse name in Arabic"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="type">Type</Label>
                        <Select
                          value={newWarehouse.type?.id?.toString()}
                          onValueChange={(value) => {
                            const selectedType = warehouseTypes.find((t) => t.id.toString() === value)
                            setNewWarehouse({ ...newWarehouse, type: selectedType || null })
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select warehouse type" />
                          </SelectTrigger>
                          <SelectContent>
                            {warehouseTypes.map((type) => (
                              <SelectItem key={type.id} value={type.id.toString()}>
                                {type.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="location">Location</Label>
                        <Input
                          id="location"
                          value={newWarehouse.location}
                          onChange={(e) => setNewWarehouse({ ...newWarehouse, location: e.target.value })}
                          placeholder="Enter warehouse location"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddWarehouseOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddWarehouse}>Add Warehouse</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name (AR/EN)</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableSkeleton columns={4} rows={5} hasActions />
                    ) : warehouses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center">
                          No warehouses found
                        </TableCell>
                      </TableRow>
                    ) : (
                      warehouses.map((warehouse) => (
                        <TableRow key={warehouse.id}>
                          <TableCell className="font-medium">
                            {warehouse.name_ar} / {warehouse.name_en}
                          </TableCell>
                          <TableCell>{warehouse.type?.name || "No type"}</TableCell>
                          <TableCell>{warehouse.location || "No location"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {/* Desktop view - separate buttons */}
                              <div className="hidden sm:flex gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEditDialog(warehouse)}
                                >
                                  <Edit className="h-4 w-4" />
                                  <span className="sr-only">Edit</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => openDeleteDialog(warehouse.id)}
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
                                    <DropdownMenuItem onClick={() => openEditDialog(warehouse)}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => openDeleteDialog(warehouse.id)}
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

      {/* Edit Warehouse Dialog */}
      <Dialog open={isEditWarehouseOpen} onOpenChange={setIsEditWarehouseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Warehouse</DialogTitle>
            <DialogDescription>Update warehouse information.</DialogDescription>
          </DialogHeader>
          {editWarehouse && (
            <div className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name_en">English Name</Label>
                <Input
                  id="edit-name_en"
                  value={editWarehouse.name_en}
                  onChange={(e) => setEditWarehouse({ ...editWarehouse, name_en: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-name_ar">Arabic Name</Label>
                <Input
                  id="edit-name_ar"
                  value={editWarehouse.name_ar}
                  onChange={(e) => setEditWarehouse({ ...editWarehouse, name_ar: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-type">Type</Label>
                <Select
                  value={editWarehouse.type?.id?.toString()}
                  onValueChange={(value) => {
                    const selectedType = warehouseTypes.find((t) => t.id.toString() === value)
                    setEditWarehouse({ ...editWarehouse, type: selectedType || null })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select warehouse type" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouseTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-location">Location</Label>
                <Input
                  id="edit-location"
                  value={editWarehouse.location}
                  onChange={(e) => setEditWarehouse({ ...editWarehouse, location: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditWarehouseOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateWarehouse}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={isDeleteAlertOpen}
        onOpenChange={setIsDeleteAlertOpen}
        description={
          deleteWarehouseId !== null ? (
            <>
              You are about to delete{" "}
              <strong>
                {warehouses.find((w) => w.id === deleteWarehouseId)?.name_ar} /{" "}
                {warehouses.find((w) => w.id === deleteWarehouseId)?.name_en}
              </strong>
              . This action cannot be undone. This will permanently remove the warehouse from your system.
            </>
          ) : (
            ""
          )
        }
        onConfirm={handleDeleteWarehouse}
      />
    </>
  )
}
