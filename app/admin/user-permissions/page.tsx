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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"

type User = {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
}

type Page = {
  id: number;
  name: string;
}

type Permission = {
  id: number;
  user: number | User;
  page: number | Page;
  resource: string;
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export default function UserBasedPermissions() {
  const [userPermissions, setUserPermissions] = useState<Permission[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [pages, setPages] = useState<Page[]>([])
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
  const [permissionToDelete, setPermissionToDelete] = useState<number | null>(null)
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null)
  const [isAddPermissionOpen, setIsAddPermissionOpen] = useState(false)
  const [isEditPermissionOpen, setIsEditPermissionOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [actionAlert, setActionAlert] = useState<{
    type: "success" | "error" | "warning" | null;
    message: string;
  }>({
    type: null,
    message: "",
  })
  const [isLoading, setIsLoading] = useState(true)

  // Update the newPermission state to match the model
  const [newPermission, setNewPermission] = useState({
    user: "",
    page: "",
    can_view: false,
    can_add: false,
    can_edit: false,
    can_delete: false,
  })

  // Show alert message
  const showAlert = (type: "success" | "error" | "warning", message: string) => {
    setActionAlert({ type, message })
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setActionAlert({ type: null, message: "" })
    }, 5000)
  }

  // Add pages fetch to the useEffect
  useEffect(() => {
    const fetchUserPermissions = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`${API_URL}/permissions/users/`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
        })
        if (!response.ok) throw new Error("Failed to fetch user permissions")
        setUserPermissions(await response.json())
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to fetch user permissions",
          variant: "destructive",
        })
        showAlert("error", "Failed to fetch user permissions. Please try again later.")
      } finally {
        setIsLoading(false)
      }
    }

    const fetchUsers = async () => {
      try {
        const response = await fetch(`${API_URL}/users/`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
        })
        if (!response.ok) throw new Error("Failed to fetch users")
        setUsers(await response.json())
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to fetch users",
          variant: "destructive",
        })
      }
    }

    const fetchPages = async () => {
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
      }
    }

    fetchUserPermissions()
    fetchUsers()
    fetchPages()
  }, [])

  // Handle adding a new permission
  const handleAddPermission = async () => {
    try {
      const response = await fetch(`${API_URL}/permissions/users/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify(newPermission),
      })

      if (!response.ok) throw new Error("Failed to add permission")

      const addedPermission = await response.json()
      setUserPermissions([...userPermissions, addedPermission])

      // Reset form
      setNewPermission({
        user: "",
        page: "",
        can_view: false,
        can_add: false,
        can_edit: false,
        can_delete: false,
      })
      setIsAddPermissionOpen(false)

      // Update the userName and resourceName references in handleAddPermission
      // Get user name for the message
      const user = users.find((u) => u.id.toString() === newPermission.user.toString())
      const userName = user
        ? user.first_name && user.last_name
          ? `${user.first_name} ${user.last_name}`
          : user.username
        : "User"
      // Get page name for the message
      const pageName = pages.find((p) => p.id.toString() === newPermission.page.toString())?.name || "Page"

      // Show toast notification
      toast({
        title: "Permission Added Successfully",
        description: `Permission for ${userName} on ${pageName} has been added.`,
        variant: "default",
      })

      // Show alert message
      showAlert("success", `New permission for ${userName} on ${pageName} has been successfully added.`)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add permission",
        variant: "destructive",
      })
    }
  }

  // Handle updating a permission
  const handleUpdatePermission = async () => {
    if (!editingPermission) return

    try {
      const response = await fetch(`${API_URL}/permissions/users/${editingPermission.id}/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify(editingPermission),
      })

      if (!response.ok) throw new Error("Failed to update permission")

      const updatedPermission = await response.json()
      setUserPermissions(userPermissions.map((perm) => (perm.id === updatedPermission.id ? updatedPermission : perm)))
      setIsEditPermissionOpen(false)

      // Get user name for the message
      const userName = getUserName(editingPermission.user)
      const resourceName = editingPermission.resource

      // Show toast notification
      toast({
        title: "Permission Updated Successfully",
        description: `Permission for ${userName} on ${resourceName} has been updated.`,
        variant: "default",
      })

      // Show alert message
      showAlert("success", `Permission for ${userName} on ${resourceName} has been successfully updated.`)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update permission",
        variant: "destructive",
      })
    }
  }

  // Handle deleting a permission
  const handleDeletePermission = async () => {
    if (permissionToDelete === null) return

    try {
      const permToDeleteData = userPermissions.find((p) => p.id === permissionToDelete)
      if (!permToDeleteData) return

      // Get user name for the message
      const userName = getUserName(permToDeleteData.user)
      const resourceName = permToDeleteData.resource

      const response = await fetch(`${API_URL}/permissions/users/${permissionToDelete}/delete/`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      })

      if (!response.ok) throw new Error("Failed to delete permission")

      setUserPermissions(userPermissions.filter((perm) => perm.id !== permissionToDelete))
      setPermissionToDelete(null)
      setIsDeleteAlertOpen(false)
      setDeleteConfirm("")

      // Show toast notification
      toast({
        title: "Permission Deleted",
        description: `Permission for ${userName} on ${resourceName} has been removed.`,
        variant: "destructive",
      })

      // Show alert message
      showAlert("warning", `Permission for ${userName} on ${resourceName} has been permanently deleted.`)
    } catch (error) {
      console.error("Delete error:", error)
      toast({
        title: "Error",
        description: "Failed to delete permission",
        variant: "destructive",
      })
    }
  }

  // Open edit dialog with permission data
  const openEditDialog = (permission: Permission) => {
    setEditingPermission({ ...permission })
    setIsEditPermissionOpen(true)
  }

  // Open delete confirmation
  const openDeleteDialog = (permissionId: number) => {
    setPermissionToDelete(permissionId)
    setIsDeleteAlertOpen(true)
  }

  // Get user name by ID
  const getUserName = (userId: number | User) => {
    if (typeof userId === "object") {
      if (userId?.first_name && userId?.last_name) {
        return `${userId.first_name} ${userId.last_name}`
      }
      return userId?.username || "Unknown User"
    }

    const user = users.find((u) => u.id.toString() === userId?.toString())
    if (!user) return "Unknown User"

    return user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.username
  }

  // Get page name by ID
  const getPageName = (pageId: number | Page) => {
    if (typeof pageId === "object" && pageId?.name) {
      return pageId.name
    }
    const page = pages.find((p) => p.id.toString() === pageId?.toString())
    return page ? page.name : "Unknown Page"
  }

  // Format resource name for display
  const formatResourceName = (resource: string) => {
    if (!resource) return "Unknown"
    return resource.charAt(0).toUpperCase() + resource.slice(1)
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
                  <BreadcrumbPage>User Permissions</BreadcrumbPage>
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
            <h2 className="text-xl font-semibold mb-4">User-Based Permissions</h2>
            <p className="mb-6">Manage specific permissions for individual users in your application.</p>

            <div className="border rounded-md">
              <div className="bg-muted p-4 flex justify-between items-center">
                <h3 className="font-medium">User Permissions</h3>
                <Dialog open={isAddPermissionOpen} onOpenChange={setIsAddPermissionOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-primary text-primary-foreground">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Permission
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New User Permission</DialogTitle>
                      <DialogDescription>Define permissions for a specific user.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="user">User</Label>
                        <Select
                          value={newPermission.user}
                          onValueChange={(value) => setNewPermission({ ...newPermission, user: value })}
                        >
                          <SelectTrigger id="user">
                            <SelectValue placeholder="Select user" />
                          </SelectTrigger>
                          <SelectContent>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id.toString()}>
                                {user.first_name && user.last_name
                                  ? `${user.first_name} ${user.last_name}`
                                  : user.username}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="page">Page</Label>
                        <Select
                          value={newPermission.page}
                          onValueChange={(value) => setNewPermission({ ...newPermission, page: value })}
                        >
                          <SelectTrigger id="page">
                            <SelectValue placeholder="Select page" />
                          </SelectTrigger>
                          <SelectContent>
                            {pages.map((page) => (
                              <SelectItem key={page.id} value={page.id.toString()}>
                                {page.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Permissions</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="can_view"
                              checked={newPermission.can_view}
                              onChange={(e) => setNewPermission({ ...newPermission, can_view: e.target.checked })}
                            />
                            <label
                              htmlFor="can_view"
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              Can View
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="can_add"
                              checked={newPermission.can_add}
                              onChange={(e) => setNewPermission({ ...newPermission, can_add: e.target.checked })}
                            />
                            <label
                              htmlFor="can_add"
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              Can Add
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="can_edit"
                              checked={newPermission.can_edit}
                              onChange={(e) => setNewPermission({ ...newPermission, can_edit: e.target.checked })}
                            />
                            <label
                              htmlFor="can_edit"
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              Can Edit
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="can_delete"
                              checked={newPermission.can_delete}
                              onChange={(e) => setNewPermission({ ...newPermission, can_delete: e.target.checked })}
                            />
                            <label
                              htmlFor="can_delete"
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              Can Delete
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddPermissionOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddPermission}>Add Permission</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-7 font-medium text-sm mb-2 border-b pb-2">
                  <div className="col-span-2">User</div>
                  <div className="col-span-2">Page</div>
                  <div className="col-span-2">Permissions</div>
                  <div className="text-right">Actions</div>
                </div>
                {isLoading ? (
                  <div className="py-8 text-center">Loading permissions...</div>
                ) : userPermissions.length === 0 ? (
                  <div className="py-8 text-center">No permissions found</div>
                ) : (
                  userPermissions.map((permission) => (
                    <div
                      key={permission.id}
                      className="grid grid-cols-7 text-sm py-3 border-b last:border-0 items-center"
                    >
                      <div className="col-span-2 font-medium">{getUserName(permission.user)}</div>
                      <div className="col-span-2">{getPageName(permission.page)}</div>
                      <div className="col-span-2">
                        <div className="flex flex-wrap gap-1">
                          {permission.can_view && (
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                              View
                            </span>
                          )}
                          {permission.can_add && (
                            <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-700/10">
                              Add
                            </span>
                          )}
                          {permission.can_edit && (
                            <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700 ring-1 ring-inset ring-yellow-700/10">
                              Edit
                            </span>
                          )}
                          {permission.can_delete && (
                            <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-700/10">
                              Delete
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        {/* Desktop view - separate buttons */}
                        <div className="hidden sm:flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(permission)}
                          >
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => openDeleteDialog(permission.id)}
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
                              <DropdownMenuItem onClick={() => openEditDialog(permission)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => openDeleteDialog(permission.id)}
                              >
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

      {/* Edit Permission Dialog */}
      <Dialog open={isEditPermissionOpen} onOpenChange={setIsEditPermissionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Permission</DialogTitle>
            <DialogDescription>Update permissions for this user.</DialogDescription>
          </DialogHeader>
          {editingPermission && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-user">User</Label>
                <Select
                  value={editingPermission.user?.toString() || ""}
                  onValueChange={(value) => setEditingPermission({ ...editingPermission, user: parseInt(value) })}
                >
                  <SelectTrigger id="edit-user">
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-page">Page</Label>
                <Select
                  value={editingPermission.page?.toString() || ""}
                  onValueChange={(value) => setEditingPermission({ ...editingPermission, page: parseInt(value) })}
                >
                  <SelectTrigger id="edit-page">
                    <SelectValue placeholder="Select page" />
                  </SelectTrigger>
                  <SelectContent>
                    {pages.map((page) => (
                      <SelectItem key={page.id} value={page.id.toString()}>
                        {page.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Permissions</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-can_view"
                      checked={editingPermission.can_view}
                      onChange={(e) => setEditingPermission({ ...editingPermission, can_view: e.target.checked })}
                    />
                    <label
                      htmlFor="edit-can_view"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Can View
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-can_add"
                      checked={editingPermission.can_add}
                      onChange={(e) => setEditingPermission({ ...editingPermission, can_add: e.target.checked })}
                    />
                    <label
                      htmlFor="edit-can_add"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Can Add
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-can_edit"
                      checked={editingPermission.can_edit}
                      onChange={(e) => setEditingPermission({ ...editingPermission, can_edit: e.target.checked })}
                    />
                    <label
                      htmlFor="edit-can_edit"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Can Edit
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-can_delete"
                      checked={editingPermission.can_delete}
                      onChange={(e) => setEditingPermission({ ...editingPermission, can_delete: e.target.checked })}
                    />
                    <label
                      htmlFor="edit-can_delete"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Can Delete
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditPermissionOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePermission}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {permissionToDelete !== null && (
                <>
                  You are about to delete permission for{" "}
                  <strong>
                    {getUserName(userPermissions.find((p) => p.id === permissionToDelete)?.user || 0)} on{" "}
                    {getPageName(userPermissions.find((p) => p.id === permissionToDelete)?.page || 0)}
                  </strong>
                  . This action cannot be undone and may affect this user's access to this resource.
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
              onClick={handleDeletePermission}
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

