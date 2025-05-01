"use client"

import { useState } from "react"
import { AppSidebar } from "../../components/app-sidebar"
import Link from "next/link"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2, User } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function AccountPage() {
  // Get user data from localStorage
  const [userData, setUserData] = useState(() => {
    // Default user data
    const defaultData = {
      username: "khalfanalkindi",
      first_name: "Khalfan",
      last_name: "Ali",
      email: "khalfan@example.com",
      phone_number: "93424324",
      role: "Admin",
    }

    // Try to get user data from localStorage
    if (typeof window !== "undefined") {
      const storedUserData = localStorage.getItem("userData")
      if (storedUserData) {
        try {
          const parsedData = JSON.parse(storedUserData)
          return {
            username: parsedData.username || defaultData.username,
            first_name: parsedData.first_name || parsedData.name?.split(" ")[0] || defaultData.first_name,
            last_name: parsedData.last_name || parsedData.name?.split(" ")[1] || defaultData.last_name,
            email: parsedData.email || defaultData.email,
            phone_number: parsedData.phone_number || defaultData.phone_number,
            role: parsedData.role || defaultData.role,
          }
        } catch (error) {
          console.error("Error parsing user data:", error)
        }
      }
    }

    return defaultData
  })

  // Form state
  const [formData, setFormData] = useState({
    ...userData,
    password: "",
    new_password: "",
    confirm_password: "",
  })

  // Validation errors
  const [errors, setErrors] = useState({
    email: "",
    new_password: "",
    confirm_password: "",
  })

  // Alert state
  const [actionAlert, setActionAlert] = useState({
    type: null,
    message: "",
  })

  // Show alert message
  const showAlert = (type, message) => {
    setActionAlert({ type, message })
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setActionAlert({ type: null, message: "" })
    }, 5000)
  }

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })

    // Clear validation errors when user types
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: "",
      })
    }
  }

  // Validate form
  const validateForm = () => {
    let isValid = true
    const newErrors = { ...errors }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (formData.email && !emailRegex.test(formData.email)) {
      newErrors.email = "Please enter a valid email address"
      isValid = false
    }

    // Password validation
    if (formData.new_password) {
      if (formData.new_password.length < 8) {
        newErrors.new_password = "Password must be at least 8 characters long"
        isValid = false
      }

      if (formData.new_password !== formData.confirm_password) {
        newErrors.confirm_password = "Passwords do not match"
        isValid = false
      }
    }

    setErrors(newErrors)
    return isValid
  }

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    // Check if current password is provided when changing password
    if ((formData.new_password || formData.confirm_password) && !formData.password) {
      toast({
        title: "Current Password Required",
        description: "Please enter your current password to change your password",
        variant: "destructive",
      })
      return
    }

    // In a real app, you would send this data to an API
    // For now, we'll just update the local state and show a success message
    const updatedUserData = {
      username: formData.username,
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email,
      phone_number: formData.phone_number,
      role: userData.role, // Role shouldn't be changeable by the user
    }

    setUserData(updatedUserData)
    saveUserDataToLocalStorage(updatedUserData)

    // Reset password fields
    setFormData({
      ...formData,
      password: "",
      new_password: "",
      confirm_password: "",
    })

    // Show success message
    toast({
      title: "Profile Updated",
      description: "Your account information has been updated successfully",
      variant: "default",
    })

    showAlert("success", "Your account information has been updated successfully")
  }

  // Save user data to localStorage
  const saveUserDataToLocalStorage = (userData) => {
    try {
      // Get existing data first
      const existingData = localStorage.getItem("userData")
      let parsedData = {}

      if (existingData) {
        parsedData = JSON.parse(existingData)
      }

      // Update with new data
      const updatedData = {
        ...parsedData,
        username: userData.username,
        first_name: userData.first_name,
        last_name: userData.last_name,
        name: `${userData.first_name} ${userData.last_name}`,
        email: userData.email,
        phone_number: userData.phone_number,
      }

      localStorage.setItem("userData", JSON.stringify(updatedData))
    } catch (error) {
      console.error("Error saving user data to localStorage:", error)
    }
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
                  <BreadcrumbPage>My Account</BreadcrumbPage>
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
            <h2 className="text-xl font-semibold mb-4">My Account</h2>
            <p className="mb-6">View and update your account information.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Profile Summary Card */}
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
                    {userData.first_name} {userData.last_name}
                  </h3>
                  <p className="text-sm text-muted-foreground">{userData.username}</p>
                  <p className="text-sm text-muted-foreground mt-1">{userData.email}</p>
                  <div className="mt-4 w-full">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-sm font-medium">Role</span>
                      <span className="text-sm">{userData.role}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-sm font-medium">Phone</span>
                      <span className="text-sm">{userData.phone_number}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Edit Profile Form */}
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
                      <form onSubmit={handleSubmit}>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="first_name">First Name</Label>
                              <Input
                                id="first_name"
                                name="first_name"
                                value={formData.first_name}
                                onChange={handleChange}
                                placeholder="First name"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="last_name">Last Name</Label>
                              <Input
                                id="last_name"
                                name="last_name"
                                value={formData.last_name}
                                onChange={handleChange}
                                placeholder="Last name"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                              id="username"
                              name="username"
                              value={formData.username}
                              onChange={handleChange}
                              placeholder="Username"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                              id="email"
                              name="email"
                              type="email"
                              value={formData.email}
                              onChange={handleChange}
                              placeholder="Email address"
                              className={errors.email ? "border-red-500" : ""}
                            />
                            {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="phone_number">Phone Number</Label>
                            <Input
                              id="phone_number"
                              name="phone_number"
                              value={formData.phone_number}
                              onChange={handleChange}
                              placeholder="Phone number"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="password">Current Password (required to save changes)</Label>
                            <Input
                              id="password"
                              name="password"
                              type="password"
                              value={formData.password}
                              onChange={handleChange}
                              placeholder="Enter your current password"
                            />
                          </div>
                        </CardContent>
                        <CardFooter className="flex justify-between">
                          <Button
                            variant="outline"
                            type="button"
                            onClick={() =>
                              setFormData({ ...userData, password: "", new_password: "", confirm_password: "" })
                            }
                          >
                            Cancel
                          </Button>
                          <Button type="submit">Save Changes</Button>
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
                      <form onSubmit={handleSubmit}>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="password">Current Password</Label>
                            <Input
                              id="password"
                              name="password"
                              type="password"
                              value={formData.password}
                              onChange={handleChange}
                              placeholder="Enter your current password"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="new_password">New Password</Label>
                            <Input
                              id="new_password"
                              name="new_password"
                              type="password"
                              value={formData.new_password}
                              onChange={handleChange}
                              placeholder="Enter new password"
                              className={errors.new_password ? "border-red-500" : ""}
                            />
                            {errors.new_password && <p className="text-sm text-red-500">{errors.new_password}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="confirm_password">Confirm New Password</Label>
                            <Input
                              id="confirm_password"
                              name="confirm_password"
                              type="password"
                              value={formData.confirm_password}
                              onChange={handleChange}
                              placeholder="Confirm new password"
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
                            onClick={() =>
                              setFormData({ ...userData, password: "", new_password: "", confirm_password: "" })
                            }
                          >
                            Cancel
                          </Button>
                          <Button type="submit">Update Password</Button>
                        </CardFooter>
                      </form>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}