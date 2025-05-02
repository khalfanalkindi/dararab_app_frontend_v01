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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://dararabappbackendv01-production.up.railway.app/api"

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
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [actionAlert, setActionAlert] = useState<{
    type: "success" | "error" | "warning" | null
    message: string
  }>({
    type: null,
    message: "",
  })
  const [isLoading, setIsLoading] = useState(true)

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

  useEffect(() => {
    fetchWarehouses()
    fetchWarehouseTypes()
  }, [])

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
  }

  const fetchWarehouseTypes = async () => {
    try {
      const res = await fetch(`${API_URL}/common/list-items/warehouse_type`, { headers })
      const data = await res.json()
      const typesData = Array.isArray(data) ? data : data.results || []
      setWarehouseTypes(typesData)
    } catch (error) {
      console.error("Error fetching warehouse types:", error)
      setWarehouseTypes([])
    }
  }

  const fetchWarehouses = async () => {
    try {
      const res = await fetch(`${API_URL}/inventory/warehouses/`, { headers })
      const data = await res.json()
      // Ensure data is an array
      const warehousesData = Array.isArray(data) ? data : data.results || []
      setWarehouses(warehousesData)
    } catch (error) {
      console.error("Error fetching warehouses:", error)
      // Set empty array on error
      setWarehouses([])
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  // Handle adding a new warehouse
  const handleAddWarehouse = async () => {
    try {
      const res = await fetch(`${API_URL}/inventory/warehouses/`, {
        method: "POST",
        headers,
        body: JSON.stringify(newWarehouse),
      })

      if (!res.ok) throw new Error("Failed to add warehouse")

      const data = await res.json()
      setWarehouses([...warehouses, data])

      // Reset form
      setNewWarehouse({
        name_en: "",
        name_ar: "",
        type: null,
        location: "",
      })

      setIsAddWarehouseOpen(false)

      // Show toast notification
      toast({
        title: "Warehouse Added Successfully",
        description: `${data.name_ar} / ${data.name_en} has been added to the system.`,
        variant: "default",
      })

      // Show alert message
      showAlert("success", `New warehouse "${data.name_ar} / ${data.name_en}" has been successfully added to the system.`)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add warehouse",
        variant: "destructive",
      })
      showAlert("error", "Failed to add warehouse. Please try again.")
    }
  }

  // Handle updating a warehouse
  const handleUpdateWarehouse = async () => {
    if (!editWarehouse) return

    try {
      const res = await fetch(`${API_URL}/inventory/warehouses/${editWarehouse.id}/`, {
        method: "PUT",
        headers,
        body: JSON.stringify(editWarehouse),
      })

      const responseData = await res.json()

      if (!res.ok) {
        throw new Error(JSON.stringify(responseData))
      }

      setWarehouses(warehouses.map((w) => (w.id === responseData.id ? responseData : w)))
      setEditWarehouse(null)
      setIsEditWarehouseOpen(false)

      // Show toast notification
      toast({
        title: "Warehouse Updated Successfully",
        description: `${responseData.name_ar} / ${responseData.name_en} has been updated.`,
        variant: "default",
      })

      // Show alert message
      showAlert("success", `Warehouse "${responseData.name_ar} / ${responseData.name_en}" has been successfully updated.`)
    } catch (error) {
      console.error("Update error:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to update warehouse"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      showAlert("error", `Failed to update warehouse: ${errorMessage}`)
    }
  }

  // Handle deleting a warehouse
  const handleDeleteWarehouse = async () => {
    if (deleteWarehouseId === null) return

    try {
      const warehouseToDelete = warehouses.find((w) => w.id === deleteWarehouseId)
      if (!warehouseToDelete) return

      const res = await fetch(`${API_URL}/inventory/warehouses/${deleteWarehouseId}/delete/`, {
        method: "DELETE",
        headers,
      })

      if (!res.ok) throw new Error("Failed to delete warehouse")

      setWarehouses(warehouses.filter((w) => w.id !== deleteWarehouseId))
      setDeleteWarehouseId(null)
      setIsDeleteAlertOpen(false)
      setDeleteConfirm("")

      // Show toast notification
      toast({
        title: "Warehouse Deleted",
        description: `${warehouseToDelete.name_ar} / ${warehouseToDelete.name_en} has been permanently removed from the system.`,
        variant: "destructive",
      })

      // Show alert message
      showAlert("warning", `Warehouse "${warehouseToDelete.name_ar} / ${warehouseToDelete.name_en}" has been permanently deleted from the system.`)
    } catch (error) {
      console.error("Delete error:", error)
      toast({
        title: "Error",
        description: "Failed to delete warehouse",
        variant: "destructive",
      })
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
                  <BreadcrumbPage>Warehouses</BreadcrumbPage>
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
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-sm border-b">
                        <th className="text-left font-medium p-2">Name (AR/EN)</th>
                        <th className="text-left font-medium p-2">Type</th>
                        <th className="text-left font-medium p-2">Location</th>
                        <th className="text-right font-medium p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center">
                            Loading warehouses...
                          </td>
                        </tr>
                      ) : warehouses.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center">
                            No warehouses found
                          </td>
                        </tr>
                      ) : (
                        warehouses.map((warehouse) => (
                          <tr key={warehouse.id} className="border-b last:border-0">
                            <td className="p-2 font-medium">
                              {warehouse.name_ar} / {warehouse.name_en}
                            </td>
                            <td className="p-2">{warehouse.type?.name || "No type"}</td>
                            <td className="p-2">{warehouse.location || "No location"}</td>
                            <td className="p-2 text-right">
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
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteWarehouseId !== null && (
                <>
                  You are about to delete{" "}
                  <strong>
                    {warehouses.find((w) => w.id === deleteWarehouseId)?.name_ar} /{" "}
                    {warehouses.find((w) => w.id === deleteWarehouseId)?.name_en}
                  </strong>
                  . This action cannot be undone. This will permanently remove the warehouse from your system.
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
              onClick={handleDeleteWarehouse}
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


