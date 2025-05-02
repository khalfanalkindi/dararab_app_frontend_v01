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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://dararabappbackendv01-production.up.railway.app/api"

type Role = {
  id: number;
  name: string;
  name_ar: string;
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
  const [roleToDelete, setRoleToDelete] = useState<number | null>(null)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false)
  const [isEditRoleOpen, setIsEditRoleOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [actionAlert, setActionAlert] = useState<{
    type: "success" | "error" | "warning" | null;
    message: string;
  }>({
    type: null,
    message: "",
  })
  const [isLoading, setIsLoading] = useState(true)

  // Form state for new role
  const [newRole, setNewRole] = useState({
    name: "",
    name_ar: "",
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
    const fetchRoles = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`${API_URL}/roles/`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
        })
        if (!response.ok) throw new Error("Failed to fetch roles")
        setRoles(await response.json())
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to fetch roles",
          variant: "destructive",
        })
        showAlert("error", "Failed to fetch roles. Please try again later.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchRoles()
  }, [])

  // Handle adding a new role
  const handleAddRole = async () => {
    try {
      const response = await fetch(`${API_URL}/roles/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify(newRole),
      })

      if (!response.ok) throw new Error("Failed to add role")

      const addedRole = await response.json()
      setRoles([...roles, addedRole])
      setNewRole({
        name: "",
        name_ar: "",
      })
      setIsAddRoleOpen(false)

      // Show toast notification
      toast({
        title: "Role Added Successfully",
        description: `${addedRole.name} has been added to the system.`,
        variant: "default",
      })

      // Show alert message
      showAlert("success", `New role "${addedRole.name}" has been successfully added to the system.`)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add role",
        variant: "destructive",
      })
    }
  }

  // Handle updating a role
  const handleUpdateRole = async () => {
    if (!editingRole) return

    try {
      const response = await fetch(`${API_URL}/roles/${editingRole.id}/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify(editingRole),
      })

      if (!response.ok) throw new Error("Failed to update role")

      const updatedRole = await response.json()
      setRoles(roles.map((role) => (role.id === updatedRole.id ? updatedRole : role)))
      setIsEditRoleOpen(false)

      // Show toast notification
      toast({
        title: "Role Updated Successfully",
        description: `${updatedRole.name} has been updated.`,
        variant: "default",
      })

      // Show alert message
      showAlert("success", `Role "${updatedRole.name}" has been successfully updated.`)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      })
    }
  }

  // Handle deleting a role
  const handleDeleteRole = async () => {
    if (roleToDelete === null) return

    try {
      const roleToDeleteData = roles.find((r) => r.id === roleToDelete)
      if (!roleToDeleteData) return

      // Updated to use the correct delete endpoint
      const response = await fetch(`${API_URL}/roles/${roleToDelete}/delete/`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      })

      if (!response.ok) throw new Error("Failed to delete role")

      setRoles(roles.filter((role) => role.id !== roleToDelete))
      setRoleToDelete(null)
      setIsDeleteAlertOpen(false)
      setDeleteConfirm("")

      // Show toast notification
      toast({
        title: "Role Deleted",
        description: `${roleToDeleteData.name} has been permanently removed from the system.`,
        variant: "destructive",
      })

      // Show alert message
      showAlert("warning", `Role "${roleToDeleteData.name}" has been permanently deleted from the system.`)
    } catch (error) {
      console.error("Delete error:", error)
      toast({
        title: "Error",
        description: "Failed to delete role",
        variant: "destructive",
      })
    }
  }

  // Open edit dialog with role data
  const openEditDialog = (role: Role) => {
    setEditingRole({ ...role })
    setIsEditRoleOpen(true)
  }

  // Open delete confirmation
  const openDeleteDialog = (roleId: number) => {
    setRoleToDelete(roleId)
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
                  <BreadcrumbPage>Roles</BreadcrumbPage>
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
            <h2 className="text-xl font-semibold mb-4">Role Management</h2>
            <p className="mb-6">Configure user roles and permission sets for your application.</p>

            <div className="border rounded-md">
              <div className="bg-muted p-4 flex justify-between items-center">
                <h3 className="font-medium">Roles</h3>
                <Dialog open={isAddRoleOpen} onOpenChange={setIsAddRoleOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-primary text-primary-foreground">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Role
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Role</DialogTitle>
                      <DialogDescription>Create a new role with specific permissions.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="name">Role Name (English)</Label>
                        <Input
                          id="name"
                          value={newRole.name}
                          onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                          placeholder="Enter role name in English"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="name_ar">Role Name (Arabic)</Label>
                        <Input
                          id="name_ar"
                          value={newRole.name_ar}
                          onChange={(e) => setNewRole({ ...newRole, name_ar: e.target.value })}
                          placeholder="Enter role name in Arabic"
                          dir="rtl"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddRoleOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddRole}>Add Role</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-4 font-medium text-sm mb-2 border-b pb-2">
                  <div>Role Name (English)</div>
                  <div className="col-span-2">Role Name (Arabic)</div>
                  <div className="text-right">Actions</div>
                </div>
                {isLoading ? (
                  <div className="py-8 text-center">Loading roles...</div>
                ) : roles.length === 0 ? (
                  <div className="py-8 text-center">No roles found</div>
                ) : (
                  roles.map((role) => (
                    <div key={role.id} className="grid grid-cols-4 text-sm py-3 border-b last:border-0 items-center">
                      <div className="font-medium">{role.name}</div>
                      <div className="col-span-2 text-right" dir="rtl">
                        {role.name_ar || "لا يوجد اسم بالعربية"}
                      </div>
                      <div className="flex justify-end gap-2">
                        {/* Desktop view - separate buttons */}
                        <div className="hidden sm:flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(role)}
                          >
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => openDeleteDialog(role.id)}
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
                              <DropdownMenuItem onClick={() => openEditDialog(role)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => openDeleteDialog(role.id)}>
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

      {/* Edit Role Dialog */}
      <Dialog open={isEditRoleOpen} onOpenChange={setIsEditRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>Update role information.</DialogDescription>
          </DialogHeader>
          {editingRole && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Role Name (English)</Label>
                <Input
                  id="edit-name"
                  value={editingRole.name || ""}
                  onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-name_ar">Role Name (Arabic)</Label>
                <Input
                  id="edit-name_ar"
                  value={editingRole.name_ar || ""}
                  onChange={(e) => setEditingRole({ ...editingRole, name_ar: e.target.value })}
                  dir="rtl"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditRoleOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRole}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {roleToDelete !== null && (
                <>
                  You are about to delete <strong>{roles.find((r) => r.id === roleToDelete)?.name}</strong>. This action
                  cannot be undone. Users assigned to this role may lose access to certain features.
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
              onClick={handleDeleteRole}
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

