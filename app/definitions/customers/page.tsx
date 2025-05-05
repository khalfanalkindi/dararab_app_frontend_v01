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
import { Edit, Trash2, MoreHorizontal, PlusCircle, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://dararabappbackendv01-production.up.railway.app/api"

interface Customer {
  id: number
  type?: number | null
  institution_name: string
  contact_person: string | null
  phone: string | null
  email: string | null
}

export default function CustomerManagement() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
  const [deleteCustomerId, setDeleteCustomerId] = useState<number | null>(null)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false)
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [actionAlert, setActionAlert] = useState<{
    type: "success" | "error" | "warning" | null
    message: string
  }>({
    type: null,
    message: "",
  })
  const [isLoading, setIsLoading] = useState(true)
  const [customerTypes, setCustomerTypes] = useState<any[]>([])

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [totalItems, setTotalItems] = useState(0)

  // Form state for new customer
  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({
    institution_name: "",
    contact_person: "",
    phone: "",
    email: "",
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
    fetchCustomers()
    fetchCustomerTypes()
  }, [])

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
  }

  const fetchCustomerTypes = async () => {
    try {
      const res = await fetch(`${API_URL}/common/list-items/customer_type/`, { headers })
      const data = await res.json()
      setCustomerTypes(data.results || [])
    } catch (error) {
      console.error("Error fetching customer types:", error)
    }
  }

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${API_URL}/sales/customers/?page_size=1000`, { headers })
      const data = await res.json()
      console.log('API Response:', data) // Debug log
      
      // Handle the response structure with results array
      const customersData = data.results || []
      
      console.log('Processed Customers:', customersData) // Debug log
      setCustomers(customersData)
      setTotalItems(data.count || customersData.length)
    } catch (error) {
      console.error("Error fetching customers:", error)
      setCustomers([])
      setTotalItems(0)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate pagination values
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentCustomers = customers.slice(startIndex, endIndex)

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  // Handle items per page change
  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value))
    setCurrentPage(1) // Reset to first page when changing items per page
  }

  // Handle adding a new customer
  const handleAddCustomer = async () => {
    try {
      const res = await fetch(`${API_URL}/sales/customers/`, {
        method: "POST",
        headers,
        body: JSON.stringify(newCustomer),
      })

      if (!res.ok) throw new Error("Failed to add customer")

      const data = await res.json()
      setCustomers([...customers, data])
      setTotalItems(totalItems + 1)

      // Reset form
      setNewCustomer({
        institution_name: "",
        contact_person: "",
        phone: "",
        email: "",
      })

      setIsAddCustomerOpen(false)

      // Show toast notification
      toast({
        title: "Customer Added Successfully",
        description: `${data.institution_name} has been added to the system.`,
        variant: "default",
      })

      // Show alert message
      showAlert("success", `New customer "${data.institution_name}" has been successfully added to the system.`)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add customer",
        variant: "destructive",
      })
      showAlert("error", "Failed to add customer. Please try again.")
    }
  }

  // Handle updating a customer
  const handleUpdateCustomer = async () => {
    if (!editCustomer) return

    try {
      const res = await fetch(`${API_URL}/sales/customers/${editCustomer.id}/`, {
        method: "PUT",
        headers,
        body: JSON.stringify(editCustomer),
      })

      const responseData = await res.json()

      if (!res.ok) {
        throw new Error(JSON.stringify(responseData))
      }

      setCustomers(customers.map((c) => (c.id === responseData.id ? responseData : c)))
      setEditCustomer(null)
      setIsEditCustomerOpen(false)

      // Show toast notification
      toast({
        title: "Customer Updated Successfully",
        description: `${responseData.institution_name} has been updated.`,
        variant: "default",
      })

      // Show alert message
      showAlert("success", `Customer "${responseData.institution_name}" has been successfully updated.`)
    } catch (error) {
      console.error("Update error:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to update customer"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      showAlert("error", `Failed to update customer: ${errorMessage}`)
    }
  }

  // Handle deleting a customer
  const handleDeleteCustomer = async () => {
    if (deleteCustomerId === null) return

    try {
      const customerToDelete = customers.find((c) => c.id === deleteCustomerId)
      if (!customerToDelete) return

      const res = await fetch(`${API_URL}/sales/customers/${deleteCustomerId}/delete/`, {
        method: "DELETE",
        headers,
      })

      if (!res.ok) throw new Error("Failed to delete customer")

      setCustomers(customers.filter((c) => c.id !== deleteCustomerId))
      setTotalItems(totalItems - 1)
      setDeleteCustomerId(null)
      setIsDeleteAlertOpen(false)
      setDeleteConfirm("")

      // Show toast notification
      toast({
        title: "Customer Deleted",
        description: `${customerToDelete.institution_name} has been permanently removed from the system.`,
        variant: "destructive",
      })

      // Show alert message
      showAlert("warning", `Customer "${customerToDelete.institution_name}" has been permanently deleted from the system.`)
    } catch (error) {
      console.error("Delete error:", error)
      toast({
        title: "Error",
        description: "Failed to delete customer",
        variant: "destructive",
      })
      showAlert("error", "Failed to delete customer. Please try again.")
    }
  }

  // Open edit dialog with customer data
  const openEditDialog = (customer: Customer) => {
    setEditCustomer(customer)
    setIsEditCustomerOpen(true)
  }

  // Open delete confirmation
  const openDeleteDialog = (customerId: number) => {
    setDeleteCustomerId(customerId)
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
                  <BreadcrumbPage>Customers</BreadcrumbPage>
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
            <h2 className="text-xl font-semibold mb-4">Customer Management</h2>
            <p className="mb-6">Manage customers and their information.</p>

            <div className="border rounded-md">
              <div className="bg-muted p-4 flex justify-between items-center">
                <h3 className="font-medium">Customers</h3>
                <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-primary text-primary-foreground">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Customer
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Customer</DialogTitle>
                      <DialogDescription>Create a new customer entry.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="type">Customer Type</Label>
                        <Select
                          value={newCustomer.type?.toString() || ""}
                          onValueChange={(value) => setNewCustomer({ ...newCustomer, type: Number(value) })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer type" />
                          </SelectTrigger>
                          <SelectContent>
                            {customerTypes.map((type) => (
                              <SelectItem key={type.id} value={type.id.toString()}>
                                {type.name_en}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="institution_name">Institution Name</Label>
                        <Input
                          id="institution_name"
                          value={newCustomer.institution_name}
                          onChange={(e) => setNewCustomer({ ...newCustomer, institution_name: e.target.value })}
                          placeholder="Enter institution name"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="contact_person">Contact Person</Label>
                        <Input
                          id="contact_person"
                          value={newCustomer.contact_person || ""}
                          onChange={(e) => setNewCustomer({ ...newCustomer, contact_person: e.target.value })}
                          placeholder="Enter contact person name"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          value={newCustomer.phone || ""}
                          onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                          placeholder="Enter phone number"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newCustomer.email || ""}
                          onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                          placeholder="Enter email address"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddCustomerOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddCustomer}>Add Customer</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="p-4">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-sm border-b">
                        <th className="text-left font-medium p-2">Type</th>
                        <th className="text-left font-medium p-2">Institution Name</th>
                        <th className="text-left font-medium p-2">Contact Person</th>
                        <th className="text-left font-medium p-2">Phone</th>
                        <th className="text-left font-medium p-2">Email</th>
                        <th className="text-right font-medium p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center">
                            Loading customers...
                          </td>
                        </tr>
                      ) : currentCustomers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center">
                            No customers found
                          </td>
                        </tr>
                      ) : (
                        currentCustomers.map((customer) => (
                          <tr key={customer.id} className="border-b last:border-0">
                            <td className="p-2">
                              {customerTypes.find(t => t.id === customer.type)?.name_en || "N/A"}
                            </td>
                            <td className="p-2 font-medium">{customer.institution_name}</td>
                            <td className="p-2">{customer.contact_person || "N/A"}</td>
                            <td className="p-2">{customer.phone || "N/A"}</td>
                            <td className="p-2">{customer.email || "N/A"}</td>
                            <td className="p-2 text-right">
                              <div className="flex justify-end gap-2">
                                {/* Desktop view - separate buttons */}
                                <div className="hidden sm:flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openEditDialog(customer)}
                                  >
                                    <Edit className="h-4 w-4" />
                                    <span className="sr-only">Edit</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => openDeleteDialog(customer.id)}
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
                                      <DropdownMenuItem onClick={() => openEditDialog(customer)}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => openDeleteDialog(customer.id)}
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

                {/* Pagination Controls */}
                {!isLoading && customers.length > 0 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Items per page:</span>
                      <Select
                        value={itemsPerPage.toString()}
                        onValueChange={handleItemsPerPageChange}
                      >
                        <SelectTrigger className="h-8 w-[70px]">
                          <SelectValue placeholder={itemsPerPage} />
                        </SelectTrigger>
                        <SelectContent side="top">
                          {[10, 20, 30, 40, 50].map((pageSize) => (
                            <SelectItem key={pageSize} value={pageSize.toString()}>
                              {pageSize}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span className="sr-only">Previous page</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                          <span className="sr-only">Next page</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* Edit Customer Dialog */}
      <Dialog open={isEditCustomerOpen} onOpenChange={setIsEditCustomerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>Update customer information.</DialogDescription>
          </DialogHeader>
          {editCustomer && (
            <div className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-type">Customer Type</Label>
                <Select
                  value={editCustomer.type?.toString() || ""}
                  onValueChange={(value) => setEditCustomer({ ...editCustomer, type: Number(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer type" />
                  </SelectTrigger>
                  <SelectContent>
                    {customerTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.name_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-institution_name">Institution Name</Label>
                <Input
                  id="edit-institution_name"
                  value={editCustomer.institution_name}
                  onChange={(e) => setEditCustomer({ ...editCustomer, institution_name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-contact_person">Contact Person</Label>
                <Input
                  id="edit-contact_person"
                  value={editCustomer.contact_person || ""}
                  onChange={(e) => setEditCustomer({ ...editCustomer, contact_person: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={editCustomer.phone || ""}
                  onChange={(e) => setEditCustomer({ ...editCustomer, phone: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editCustomer.email || ""}
                  onChange={(e) => setEditCustomer({ ...editCustomer, email: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditCustomerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateCustomer}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCustomerId !== null && (
                <>
                  You are about to delete{" "}
                  <strong>{customers.find((c) => c.id === deleteCustomerId)?.institution_name}</strong>. This action cannot be undone.
                  This will permanently remove the customer from your system.
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
              onClick={handleDeleteCustomer}
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


