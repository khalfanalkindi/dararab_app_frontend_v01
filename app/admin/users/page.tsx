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
import { Edit, Trash2, MoreHorizontal, UserPlus, AlertCircle, CheckCircle2 } from "lucide-react"
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
import { toast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// Sample user data
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://dararabappbackendv01-production.up.railway.app/api"

type User = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: number | { id: number; name: string };
  is_active: boolean;
  phone_number: string;
}

type Role = {
  id: number;
  name: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<number | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [isEditUserOpen, setIsEditUserOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [actionAlert, setActionAlert] = useState<{
    type: "success" | "error" | "warning" | null;
    message: string;
  }>({
    type: null,
    message: "",
  })
  const [isLoading, setIsLoading] = useState(true)

  // Form state for new user
  const [newUser, setNewUser] = useState({
    username: "",
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    role: "",
    password: "",
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
    const fetchUsers = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`${API_URL}/users/`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
        })
        if (!response.ok) throw new Error("Failed to fetch users")
        const data = await response.json()
        setUsers(Array.isArray(data) ? data : data.results || [])
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to fetch users",
          variant: "destructive",
        })
        showAlert("error", "Failed to fetch users. Please try again later.")
      } finally {
        setIsLoading(false)
      }
    }

    const fetchRoles = async () => {
      try {
        const response = await fetch(`${API_URL}/roles/`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
        })
        if (!response.ok) throw new Error("Failed to fetch roles")
        const data = await response.json()
        setRoles(Array.isArray(data) ? data : data.results || [])
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to fetch roles",
          variant: "destructive",
        })
      }
    }

    fetchUsers()
    fetchRoles()
  }, [])

  // Handle adding a new user
  const handleAddUser = async () => {
    try {
      const response = await fetch(`${API_URL}/users/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify(newUser),
      })

      if (!response.ok) throw new Error("Failed to add user")

      const addedUser = await response.json()
      setUsers([...users, addedUser])

      // Get the user name for the success message
      const firstName = newUser.first_name || addedUser.first_name || ""
      const lastName = newUser.last_name || addedUser.last_name || ""
      const userName =
        firstName && lastName ? `${firstName} ${lastName}` : newUser.username || addedUser.username || "User"

      setNewUser({
        username: "",
        first_name: "",
        last_name: "",
        email: "",
        phone_number: "",
        role: "",
        password: "",
      })
      setIsAddUserOpen(false)

      // Show toast notification
      toast({
        title: "User Added Successfully",
        description: `${userName} has been added to the system.`,
        variant: "default",
      })

      // Show alert message
      showAlert("success", `New user "${userName}" has been successfully added to the system.`)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add user",
        variant: "destructive",
      })
    }
  }

  // Handle updating a user
  const handleUpdateUser = async () => {
    if (!editingUser) return

    try {
      const response = await fetch(`${API_URL}/users/${editingUser.id}/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify(editingUser),
      })

      if (!response.ok) throw new Error("Failed to update user")

      const updatedUser = await response.json()
      setUsers(users.map((user) => (user.id === updatedUser.id ? updatedUser : user)))
      setIsEditUserOpen(false)

      // Get the user name for the success message
      const firstName = editingUser.first_name || updatedUser.first_name || ""
      const lastName = editingUser.last_name || updatedUser.last_name || ""
      const userName =
        firstName && lastName ? `${firstName} ${lastName}` : editingUser.username || updatedUser.username || "User"

      // Show toast notification
      toast({
        title: "User Updated Successfully",
        description: `${userName}'s information has been updated.`,
        variant: "default",
      })

      // Show alert message
      showAlert("success", `User "${userName}" has been successfully updated.`)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      })
    }
  }

  // Handle deleting a user
  const handleDeleteUser = async () => {
    if (userToDelete === null) return

    try {
      const userToDeleteData = users.find((u) => u.id === userToDelete)
      if (!userToDeleteData) return

      // Get the user name for the success message
      const firstName = userToDeleteData.first_name || ""
      const lastName = userToDeleteData.last_name || ""
      const userName = firstName && lastName ? `${firstName} ${lastName}` : userToDeleteData.username || "User"

      const response = await fetch(`${API_URL}/users/${userToDelete}/`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      })

      if (!response.ok) throw new Error("Failed to delete user")

      setUsers(users.filter((user) => user.id !== userToDelete))
      setUserToDelete(null)
      setIsDeleteAlertOpen(false)
      setDeleteConfirm("")

      // Show toast notification
      toast({
        title: "User Deleted",
        description: `${userName} has been permanently removed from the system.`,
        variant: "destructive",
      })

      // Show alert message
      showAlert("warning", `User "${userName}" has been permanently deleted from the system.`)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      })
    }
  }

  // Open edit dialog with user data
  const openEditDialog = (user: any) => {
    // Create a copy of the user object with proper handling for nested properties
    const userForEdit = {
      ...user,
      // If role is an object with an id property, extract just the id
      role: typeof user.role === "object" && user.role?.id ? user.role.id.toString() : user.role?.toString(),
    }

    // Set the editing user state
    setEditingUser(userForEdit)
    setIsEditUserOpen(true)
  }

  // Open delete confirmation
  const openDeleteDialog = (userId: number) => {
    setUserToDelete(userId)
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
                  <BreadcrumbPage>Users</BreadcrumbPage>
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
            <h2 className="text-xl font-semibold mb-4">User Management</h2>
            <p className="mb-6">Manage user accounts, permissions, and access levels.</p>

            <div className="border rounded-md">
              <div className="bg-muted p-4 flex justify-between items-center">
                <h3 className="font-medium">Users</h3>
                <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-primary text-primary-foreground">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add User
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New User</DialogTitle>
                      <DialogDescription>Enter the details for the new user account.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="first_name">First Name</Label>
                          <Input
                            id="first_name"
                            value={newUser.first_name}
                            onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                            placeholder="First name"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="last_name">Last Name</Label>
                          <Input
                            id="last_name"
                            value={newUser.last_name}
                            onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
                            placeholder="Last name"
                          />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={newUser.username}
                          onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                          placeholder="Username"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newUser.email}
                          onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                          placeholder="Email address"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="phone_number">Phone Number</Label>
                        <Input
                          id="phone_number"
                          value={newUser.phone_number}
                          onChange={(e) => setNewUser({ ...newUser, phone_number: e.target.value })}
                          placeholder="Phone number"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="role">Role</Label>
                        <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                          <SelectTrigger id="role">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={role.id.toString()}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          placeholder="Password"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddUser}>Add User</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-5 font-medium text-sm mb-2 border-b pb-2">
                  <div>Username</div>
                  <div>Email</div>
                  <div>Role</div>
                  <div>Status</div>
                  <div className="text-right">Actions</div>
                </div>
                {isLoading ? (
                  <div className="py-8 text-center">Loading users...</div>
                ) : users.length === 0 ? (
                  <div className="py-8 text-center">No users found</div>
                ) : (
                  users.map((user) => (
                    <div key={user.id} className="grid grid-cols-5 text-sm py-3 border-b last:border-0 items-center">
                      <div>{user.username || `${user.first_name} ${user.last_name}`}</div>
                      <div>{user.email}</div>
                      <div>{typeof user.role === "object" ? user.role.name : user.role}</div>
                      <div>{user.is_active !== undefined ? (user.is_active ? "Active" : "Inactive") : "Active"}</div>
                      <div className="flex justify-end gap-2">
                        {/* Desktop view - separate buttons */}
                        <div className="hidden sm:flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(user)}
                          >
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => openDeleteDialog(user.id)}
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
                              <DropdownMenuItem onClick={() => openEditDialog(user)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => openDeleteDialog(user.id)}>
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

      {/* Edit User Dialog */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information and permissions.</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-first_name">First Name</Label>
                  <Input
                    id="edit-first_name"
                    value={editingUser.first_name || ""}
                    onChange={(e) => setEditingUser({ ...editingUser, first_name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-last_name">Last Name</Label>
                  <Input
                    id="edit-last_name"
                    value={editingUser.last_name || ""}
                    onChange={(e) => setEditingUser({ ...editingUser, last_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-username">Username</Label>
                <Input
                  id="edit-username"
                  value={editingUser.username || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingUser.email || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-phone_number">Phone Number</Label>
                <Input
                  id="edit-phone_number"
                  value={editingUser.phone_number || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, phone_number: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select
                  value={editingUser.role?.toString() || ""}
                  onValueChange={(value) => setEditingUser({ ...editingUser, role: parseInt(value) })}
                >
                  <SelectTrigger id="edit-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id.toString()}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditUserOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {userToDelete !== null && (
                <>
                  You are about to delete{" "}
                  <strong>
                    {users.find((u) => u.id === userToDelete)?.first_name}{" "}
                    {users.find((u) => u.id === userToDelete)?.last_name}
                  </strong>
                  . This action cannot be undone. This will permanently delete the user account and remove their data
                  from our servers.
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
              onClick={handleDeleteUser}
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

