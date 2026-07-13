"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { PageBreadcrumb, DASHBOARD_CRUMB } from "@/components/page-breadcrumb"
import { DocumentTitle } from "@/components/document-title"

import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2, Loader2, User } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { API_URL } from "@/lib/config"
import { fetchWithRetry } from "@/lib/apiClient"
import { parseApiErrorBody } from "@/lib/apiErrors"
import { cacheUserData, displayNameFromUser } from "@/lib/user-profile"

type UserData = {
  id?: number
  username: string
  first_name: string
  last_name: string
  email: string
  phone_number: string
  role: string
}

type ProfileForm = {
  username: string
  first_name: string
  last_name: string
  email: string
  phone_number: string
}

type PasswordForm = {
  current_password: string
  new_password: string
  confirm_password: string
}

function mapApiUser(data: Record<string, unknown>): UserData {
  const roleName =
    (typeof data.role_name === "string" && data.role_name) ||
    (typeof data.role === "string" && data.role) ||
    ""
  return {
    id: typeof data.id === "number" ? data.id : undefined,
    username: String(data.username || ""),
    first_name: String(data.first_name || ""),
    last_name: String(data.last_name || ""),
    email: String(data.email || ""),
    phone_number: String(data.phone_number || ""),
    role: roleName,
  }
}

function saveUserDataToLocalStorage(user: UserData) {
  cacheUserData({
    id: user.id,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    name: displayNameFromUser(user),
    email: user.email,
    phone_number: user.phone_number,
    role: user.role,
    role_name: user.role,
  })
}

function emptyUser(): UserData {
  return {
    username: "",
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    role: "",
  }
}

export default function AccountPage() {
  const [userData, setUserData] = useState<UserData>(emptyUser)
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    username: "",
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
  })
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    current_password: "",
    new_password: "",
    confirm_password: "",
  })
  const [errors, setErrors] = useState({
    email: "",
    username: "",
    phone_number: "",
    current_password: "",
    new_password: "",
    confirm_password: "",
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  type AlertType = "success" | "error" | "warning" | "info" | null
  const [actionAlert, setActionAlert] = useState<{ type: AlertType; message: string }>({
    type: null,
    message: "",
  })

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
    }),
    [],
  )

  const showAlert = (type: Exclude<AlertType, null>, message: string) => {
    setActionAlert({ type, message })
    setTimeout(() => {
      setActionAlert({ type: null, message: "" })
    }, 5000)
  }

  const applyUser = useCallback((mapped: UserData) => {
    setUserData(mapped)
    setProfileForm({
      username: mapped.username,
      first_name: mapped.first_name,
      last_name: mapped.last_name,
      email: mapped.email,
      phone_number: mapped.phone_number,
    })
    saveUserDataToLocalStorage(mapped)
  }, [])

  const loadProfile = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetchWithRetry(`${API_URL}/auth/me/`, { headers })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || body.error || `Failed to load profile (${res.status})`)
      }
      const data = await res.json()
      applyUser(mapApiUser(data))
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      const message = error instanceof Error ? error.message : "Failed to load profile"
      toast.error("Error", { description: message })
      showAlert("error", message)

      // Fall back to cached localStorage (never invent demo user data)
      try {
        const stored = localStorage.getItem("userData")
        if (stored) {
          applyUser(mapApiUser(JSON.parse(stored)))
        }
      } catch {
        /* ignore */
      }
    } finally {
      setIsLoading(false)
    }
  }, [applyUser, headers])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setProfileForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: "" }))
    }
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setPasswordForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: "" }))
    }
  }

  const validateProfile = () => {
    const next = { ...errors, email: "", username: "", phone_number: "" }
    let isValid = true
    if (!profileForm.username.trim()) {
      next.username = "Username is required"
      isValid = false
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (profileForm.email && !emailRegex.test(profileForm.email)) {
      next.email = "Please enter a valid email address"
      isValid = false
    }
    setErrors(next)
    return isValid
  }

  const validatePassword = () => {
    const next = {
      ...errors,
      current_password: "",
      new_password: "",
      confirm_password: "",
    }
    let isValid = true
    if (!passwordForm.current_password) {
      next.current_password = "Current password is required"
      isValid = false
    }
    if (!passwordForm.new_password || passwordForm.new_password.length < 8) {
      next.new_password = "Password must be at least 8 characters long"
      isValid = false
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      next.confirm_password = "Passwords do not match"
      isValid = false
    }
    setErrors(next)
    return isValid
  }

  const parseApiErrors = (body: Record<string, unknown>) => {
    const parsed = parseApiErrorBody(body, "Request failed")
    const fieldErrors: Partial<typeof errors> = {}
    for (const key of Object.keys(errors)) {
      const fromStandard = parsed.field_errors[key]
      if (fromStandard?.length) {
        fieldErrors[key as keyof typeof errors] = String(fromStandard[0])
        continue
      }
      // Legacy top-level field keys (pre-normalization clients / older responses)
      const val = body[key]
      if (Array.isArray(val) && val.length) {
        fieldErrors[key as keyof typeof errors] = String(val[0])
      } else if (typeof val === "string" && val) {
        fieldErrors[key as keyof typeof errors] = val
      }
    }
    if (Object.keys(fieldErrors).length) {
      setErrors((prev) => ({ ...prev, ...fieldErrors }))
    }
    return parsed.detail
  }

  const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validateProfile()) return

    setIsSavingProfile(true)
    try {
      const res = await fetchWithRetry(`${API_URL}/auth/me/`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          username: profileForm.username.trim(),
          first_name: profileForm.first_name.trim(),
          last_name: profileForm.last_name.trim(),
          email: profileForm.email.trim(),
          phone_number: profileForm.phone_number.trim() || null,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(parseApiErrors(body))
      }
      const mapped = mapApiUser(body)
      applyUser(mapped)
      toast.success("Profile Updated", { description: "Your account information has been saved." })
      showAlert("success", "Your account information has been updated successfully")
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      const message = error instanceof Error ? error.message : "Failed to update profile"
      toast.error("Error", { description: message })
      showAlert("error", message)
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validatePassword()) return

    setIsSavingPassword(true)
    try {
      const res = await fetchWithRetry(`${API_URL}/auth/change-password/`, {
        method: "POST",
        headers,
        body: JSON.stringify(passwordForm),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(parseApiErrors(body))
      }
      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      })
      toast.success("Password Updated", { description: "Your password has been changed successfully." })
      showAlert("success", "Your password has been updated successfully")
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      const message = error instanceof Error ? error.message : "Failed to change password"
      toast.error("Error", { description: message })
      showAlert("error", message)
    } finally {
      setIsSavingPassword(false)
    }
  }

  const resetProfileForm = () => {
    setProfileForm({
      username: userData.username,
      first_name: userData.first_name,
      last_name: userData.last_name,
      email: userData.email,
      phone_number: userData.phone_number,
    })
    setErrors((prev) => ({
      ...prev,
      email: "",
      username: "",
      phone_number: "",
    }))
  }

  const resetPasswordForm = () => {
    setPasswordForm({
      current_password: "",
      new_password: "",
      confirm_password: "",
    })
    setErrors((prev) => ({
      ...prev,
      current_password: "",
      new_password: "",
      confirm_password: "",
    }))
  }

  return (
      <SidebarInset>
        <DocumentTitle title="My Account" />
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <PageBreadcrumb items={[DASHBOARD_CRUMB, { label: "My Account" }]} />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {actionAlert.type && (
            <Alert
              variant={actionAlert.type === "warning" || actionAlert.type === "error" ? "destructive" : "default"}
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
                    : actionAlert.type === "error"
                      ? "Error"
                      : "Information"}
              </AlertTitle>
              <AlertDescription>{actionAlert.message}</AlertDescription>
            </Alert>
          )}

          <div className="min-h-[50vh] flex-1 rounded-xl bg-muted/50 p-6 md:min-h-min">
            <h2 className="text-xl font-semibold mb-4">My Account</h2>
            <p className="mb-6">View and update your account information.</p>

            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading profile…
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1">
                  <CardHeader>
                    <CardTitle>Profile Summary</CardTitle>
                    <CardDescription>Your account information</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-4">
                      <User className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium">
                      {userData.first_name || userData.last_name
                        ? `${userData.first_name} ${userData.last_name}`.trim()
                        : userData.username || "—"}
                    </h3>
                    <p className="text-sm text-muted-foreground">{userData.username || "—"}</p>
                    <p className="text-sm text-muted-foreground mt-1">{userData.email || "—"}</p>
                    <div className="mt-4 w-full">
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm font-medium">Role</span>
                        <span className="text-sm">{userData.role || "—"}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm font-medium">Phone</span>
                        <span className="text-sm">{userData.phone_number || "—"}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="md:col-span-2">
                  <Tabs defaultValue="profile" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="profile">Profile Information</TabsTrigger>
                      <TabsTrigger value="password">Change Password</TabsTrigger>
                    </TabsList>
                    <TabsContent value="profile">
                      <Card>
                        <CardHeader>
                          <CardTitle>Edit Profile</CardTitle>
                          <CardDescription>Update your personal information</CardDescription>
                        </CardHeader>
                        <form onSubmit={handleProfileSubmit}>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="first_name">First Name</Label>
                                <Input
                                  id="first_name"
                                  name="first_name"
                                  value={profileForm.first_name}
                                  onChange={handleProfileChange}
                                  placeholder="First name"
                                  disabled={isSavingProfile}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="last_name">Last Name</Label>
                                <Input
                                  id="last_name"
                                  name="last_name"
                                  value={profileForm.last_name}
                                  onChange={handleProfileChange}
                                  placeholder="Last name"
                                  disabled={isSavingProfile}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="username">Username</Label>
                              <Input
                                id="username"
                                name="username"
                                value={profileForm.username}
                                onChange={handleProfileChange}
                                placeholder="Username"
                                disabled={isSavingProfile}
                                className={errors.username ? "border-red-500" : ""}
                              />
                              {errors.username && <p className="text-sm text-red-500">{errors.username}</p>}
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="email">Email</Label>
                              <Input
                                id="email"
                                name="email"
                                type="email"
                                value={profileForm.email}
                                onChange={handleProfileChange}
                                placeholder="Email address"
                                disabled={isSavingProfile}
                                className={errors.email ? "border-red-500" : ""}
                              />
                              {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="phone_number">Phone Number</Label>
                              <Input
                                id="phone_number"
                                name="phone_number"
                                value={profileForm.phone_number}
                                onChange={handleProfileChange}
                                placeholder="Phone number"
                                disabled={isSavingProfile}
                                className={errors.phone_number ? "border-red-500" : ""}
                              />
                              {errors.phone_number && (
                                <p className="text-sm text-red-500">{errors.phone_number}</p>
                              )}
                            </div>
                          </CardContent>
                          <CardFooter className="flex justify-between">
                            <Button
                              variant="outline"
                              type="button"
                              onClick={resetProfileForm}
                              disabled={isSavingProfile}
                            >
                              Cancel
                            </Button>
                            <Button type="submit" disabled={isSavingProfile}>
                              {isSavingProfile ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Saving…
                                </>
                              ) : (
                                "Save Changes"
                              )}
                            </Button>
                          </CardFooter>
                        </form>
                      </Card>
                    </TabsContent>
                    <TabsContent value="password">
                      <Card>
                        <CardHeader>
                          <CardTitle>Change Password</CardTitle>
                          <CardDescription>Update your password</CardDescription>
                        </CardHeader>
                        <form onSubmit={handlePasswordSubmit}>
                          <CardContent className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="current_password">Current Password</Label>
                              <Input
                                id="current_password"
                                name="current_password"
                                type="password"
                                value={passwordForm.current_password}
                                onChange={handlePasswordChange}
                                placeholder="Enter your current password"
                                disabled={isSavingPassword}
                                className={errors.current_password ? "border-red-500" : ""}
                              />
                              {errors.current_password && (
                                <p className="text-sm text-red-500">{errors.current_password}</p>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="new_password">New Password</Label>
                              <Input
                                id="new_password"
                                name="new_password"
                                type="password"
                                value={passwordForm.new_password}
                                onChange={handlePasswordChange}
                                placeholder="Enter new password"
                                disabled={isSavingPassword}
                                className={errors.new_password ? "border-red-500" : ""}
                              />
                              {errors.new_password && (
                                <p className="text-sm text-red-500">{errors.new_password}</p>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="confirm_password">Confirm New Password</Label>
                              <Input
                                id="confirm_password"
                                name="confirm_password"
                                type="password"
                                value={passwordForm.confirm_password}
                                onChange={handlePasswordChange}
                                placeholder="Confirm new password"
                                disabled={isSavingPassword}
                                className={errors.confirm_password ? "border-red-500" : ""}
                              />
                              {errors.confirm_password && (
                                <p className="text-sm text-red-500">{errors.confirm_password}</p>
                              )}
                            </div>
                          </CardContent>
                          <CardFooter className="flex justify-between">
                            <Button
                              variant="outline"
                              type="button"
                              onClick={resetPasswordForm}
                              disabled={isSavingPassword}
                            >
                              Cancel
                            </Button>
                            <Button type="submit" disabled={isSavingPassword}>
                              {isSavingPassword ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Updating…
                                </>
                              ) : (
                                "Update Password"
                              )}
                            </Button>
                          </CardFooter>
                        </form>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            )}
          </div>
        </div>
      </SidebarInset>
)
}
