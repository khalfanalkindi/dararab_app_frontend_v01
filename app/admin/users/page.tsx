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
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

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
  const { t } = useLanguage()
  const { dashboard: dashboardCrumb, admin: adminCrumb } = useAppCrumbs()
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<number | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [isEditUserOpen, setIsEditUserOpen] = useState(false)
  const [actionAlert, setActionAlert] = useState<{
    type: "success" | "error" | "warning" | null;
    message: string;
  }>({
    type: null,
    message: "",
  })
  const [isLoading, setIsLoading] = useState(true)

  // AbortController refs for request cancellation
  const fetchUsersAbortControllerRef = useRef<AbortController | null>(null)
  const fetchRolesAbortControllerRef = useRef<AbortController | null>(null)
  const addUserAbortControllerRef = useRef<AbortController | null>(null)
  const updateUserAbortControllerRef = useRef<AbortController | null>(null)
  const deleteUserAbortControllerRef = useRef<AbortController | null>(null)

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
      // Cancel previous request if any
      if (fetchUsersAbortControllerRef.current) {
        fetchUsersAbortControllerRef.current.abort()
      }
      
      const controller = new AbortController()
      fetchUsersAbortControllerRef.current = controller
      
      setIsLoading(true)
      try {
        const response = await fetchWithRetry(`${API_URL}/users/`, {
          headers,
          signal: controller.signal,
        })
        if (!response.ok) throw new Error("Failed to fetch users")
        const data = await response.json()
        setUsers(Array.isArray(data) ? data : data.results || [])
      } catch (error) {
        handleError(error, "Failed to fetch users")
        showAlert("error", "Failed to fetch users. Please try again later.")
      } finally {
        setIsLoading(false)
      }
    }

    const fetchRoles = async () => {
      // Cancel previous request if any
      if (fetchRolesAbortControllerRef.current) {
        fetchRolesAbortControllerRef.current.abort()
      }
      
      const controller = new AbortController()
      fetchRolesAbortControllerRef.current = controller
      
      try {
        const response = await fetchWithRetry(`${API_URL}/roles/`, {
          headers,
          signal: controller.signal,
        })
        if (!response.ok) throw new Error("Failed to fetch roles")
        const data = await response.json()
        setRoles(Array.isArray(data) ? data : data.results || [])
      } catch (error) {
        handleError(error, "Failed to fetch roles")
      }
    }

    fetchUsers()
    fetchRoles()

    // Cleanup: abort pending requests on unmount
    return () => {
      if (fetchUsersAbortControllerRef.current) {
        fetchUsersAbortControllerRef.current.abort()
      }
      if (fetchRolesAbortControllerRef.current) {
        fetchRolesAbortControllerRef.current.abort()
      }
    }
  }, [fetchWithRetry, handleError, headers])

  // Handle adding a new user
  const handleAddUser = async () => {
    // Cancel previous request if any
    if (addUserAbortControllerRef.current) {
      addUserAbortControllerRef.current.abort()
    }
    
    const controller = new AbortController()
    addUserAbortControllerRef.current = controller
    
    try {
      const response = await fetchWithRetry(`${API_URL}/users/`, {
        method: "POST",
        headers,
        body: JSON.stringify(newUser),
        signal: controller.signal,
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
      toast.success(t("adminToasts.added", { entity: t("admin.permissions.user") }))

      // Show alert message
      showAlert("success", `New user "${userName}" has been successfully added to the system.`)
    } catch (error) {
      handleError(error, "Failed to add user")
    }
  }

  // Handle updating a user
  const handleUpdateUser = async () => {
    if (!editingUser) return

    // Cancel previous request if any
    if (updateUserAbortControllerRef.current) {
      updateUserAbortControllerRef.current.abort()
    }
    
    const controller = new AbortController()
    updateUserAbortControllerRef.current = controller

    try {
      const response = await fetchWithRetry(`${API_URL}/users/${editingUser.id}/`, {
        method: "PUT",
        headers,
        body: JSON.stringify(editingUser),
        signal: controller.signal,
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
      toast.success(t("adminToasts.updated", { entity: t("admin.permissions.user") }))

      // Show alert message
      showAlert("success", `User "${userName}" has been successfully updated.`)
    } catch (error) {
      handleError(error, "Failed to update user")
    }
  }

  // Handle deleting a user
  const handleDeleteUser = async () => {
    if (userToDelete === null) return

    // Cancel previous request if any
    if (deleteUserAbortControllerRef.current) {
      deleteUserAbortControllerRef.current.abort()
    }
    
    const controller = new AbortController()
    deleteUserAbortControllerRef.current = controller

    try {
      const userToDeleteData = users.find((u) => u.id === userToDelete)
      if (!userToDeleteData) return

      // Get the user name for the success message
      const firstName = userToDeleteData.first_name || ""
      const lastName = userToDeleteData.last_name || ""
      const userName = firstName && lastName ? `${firstName} ${lastName}` : userToDeleteData.username || "User"

      const response = await fetchWithRetry(`${API_URL}/users/${userToDelete}/`, {
        method: "DELETE",
        headers,
        signal: controller.signal,
      })

      if (!response.ok) throw new Error("Failed to delete user")

      setUsers(users.filter((user) => user.id !== userToDelete))
      setUserToDelete(null)
      setIsDeleteAlertOpen(false)

      // Show toast notification
      toast.success(t("adminToasts.deleted", { entity: t("admin.permissions.user") }))

      // Show alert message
      showAlert("warning", `User "${userName}" has been permanently deleted from the system.`)
    } catch (error) {
      handleError(error, "Failed to delete user")
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
    <ErrorBoundary>
    <>
      <DocumentTitle title={t("nav.users")} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <PageBreadcrumb items={[dashboardCrumb, adminCrumb, { label: t("nav.users") }]} />
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
            <h2 className="text-xl font-semibold mb-4">{t("admin.users.management")}</h2>
            <p className="mb-6">{t("admin.users.description")}</p>

            <div className="border rounded-md">
              <div className="bg-muted p-4 flex justify-between items-center">
                <h3 className="font-medium">{t("nav.users")}</h3>
                <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-primary text-primary-foreground">
                      <UserPlus className="h-4 w-4 mr-2" />
                      {t("admin.users.add")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("admin.users.addNew")}</DialogTitle>
                      <DialogDescription>Enter the details for the new user account.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="first_name">{t("admin.users.firstName")}</Label>
                          <Input
                            id="first_name"
                            value={newUser.first_name}
                            onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                            placeholder={t("admin.users.firstName")}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="last_name">{t("admin.users.lastName")}</Label>
                          <Input
                            id="last_name"
                            value={newUser.last_name}
                            onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
                            placeholder={t("admin.users.lastName")}
                          />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="username">{t("admin.users.username")}</Label>
                        <Input
                          id="username"
                          value={newUser.username}
                          onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                          placeholder={t("admin.users.username")}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="email">{t("admin.users.email")}</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newUser.email}
                          onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                          placeholder={t("admin.users.email")}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="phone_number">{t("admin.users.phone")}</Label>
                        <Input
                          id="phone_number"
                          value={newUser.phone_number}
                          onChange={(e) => setNewUser({ ...newUser, phone_number: e.target.value })}
                          placeholder={t("admin.users.phone")}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="role">{t("admin.users.role")}</Label>
                        <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                          <SelectTrigger id="role">
                            <SelectValue placeholder={t("admin.permissions.selectRole")} />
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
                        <Label htmlFor="password">{t("admin.users.password")}</Label>
                        <Input
                          id="password"
                          type="password"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          placeholder={t("admin.users.password")}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>
                        {t("common.cancel")}
                      </Button>
                      <Button onClick={handleAddUser}>{t("admin.users.add")}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-5 font-medium text-sm mb-2 border-b pb-2">
                  <div>{t("admin.users.username")}</div>
                  <div>{t("admin.users.email")}</div>
                  <div>{t("admin.users.role")}</div>
                  <div>{t("common.status")}</div>
                  <div className="text-right">{t("common.actions")}</div>
                </div>
                {isLoading ? (
                  <div className="py-8 text-center">{t("admin.users.loading")}</div>
                ) : users.length === 0 ? (
                  <div className="py-8 text-center">{t("admin.users.empty")}</div>
                ) : (
                  users.map((user) => (
                    <div key={user.id} className="grid grid-cols-5 text-sm py-3 border-b last:border-0 items-center">
                      <div>{user.username || `${user.first_name} ${user.last_name}`}</div>
                      <div>{user.email}</div>
                      <div>{typeof user.role === "object" ? user.role.name : user.role}</div>
                      <div>
                        {user.is_active !== undefined
                          ? user.is_active
                            ? t("admin.users.active")
                            : t("admin.users.inactive")
                          : t("admin.users.active")}
                      </div>
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
                            <span className="sr-only">{t("common.edit")}</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => openDeleteDialog(user.id)}
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
                              <DropdownMenuItem onClick={() => openEditDialog(user)}>
                                <Edit className="h-4 w-4 mr-2" />
                                {t("common.edit")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => openDeleteDialog(user.id)}>
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

      {/* Edit User Dialog */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.users.editTitle")}</DialogTitle>
            <DialogDescription>Update user information and permissions.</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-first_name">{t("admin.users.firstName")}</Label>
                  <Input
                    id="edit-first_name"
                    value={editingUser.first_name || ""}
                    onChange={(e) => setEditingUser({ ...editingUser, first_name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-last_name">{t("admin.users.lastName")}</Label>
                  <Input
                    id="edit-last_name"
                    value={editingUser.last_name || ""}
                    onChange={(e) => setEditingUser({ ...editingUser, last_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-username">{t("admin.users.username")}</Label>
                <Input
                  id="edit-username"
                  value={editingUser.username || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-email">{t("admin.users.email")}</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingUser.email || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-phone_number">{t("admin.users.phone")}</Label>
                <Input
                  id="edit-phone_number"
                  value={editingUser.phone_number || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, phone_number: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-role">{t("admin.users.role")}</Label>
                <Select
                  value={editingUser.role?.toString() || ""}
                  onValueChange={(value) => setEditingUser({ ...editingUser, role: parseInt(value) })}
                >
                  <SelectTrigger id="edit-role">
                    <SelectValue placeholder={t("admin.permissions.selectRole")} />
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
              {t("common.cancel")}
            </Button>
            <Button onClick={handleUpdateUser}>{t("common.saveChanges")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={isDeleteAlertOpen}
        onOpenChange={setIsDeleteAlertOpen}
        description={
          userToDelete !== null ? (
            <>
              You are about to delete{" "}
              <strong>
                {users.find((u) => u.id === userToDelete)?.first_name}{" "}
                {users.find((u) => u.id === userToDelete)?.last_name}
              </strong>
              . This action cannot be undone. This will permanently delete the user account and remove their data
              from our servers.
            </>
          ) : (
            ""
          )
        }
        onConfirm={handleDeleteUser}
      />
    </>
  </ErrorBoundary>
  )
}
