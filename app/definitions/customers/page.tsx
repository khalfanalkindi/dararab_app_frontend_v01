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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { API_URL } from "@/lib/config"
import { ListPagination } from "@/components/list-pagination"

interface Customer {
  id: number
  customer_type?: number | null
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
  const [pageSize, setPageSize] = useState(25)
  const [totalCount, setTotalCount] = useState(0)

  // Form state for new customer
  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({
    customer_type: undefined,
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

  // AbortController refs for request cancellation
  const fetchCustomersAbortControllerRef = useRef<AbortController | null>(null)
  const fetchCustomerTypesAbortControllerRef = useRef<AbortController | null>(null)

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
    fetchCustomers(currentPage, pageSize)
    fetchCustomerTypes()

    // Cleanup: abort pending requests on unmount
    return () => {
      fetchCustomersAbortControllerRef.current?.abort()
      fetchCustomerTypesAbortControllerRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial + page/size driven by handlers
  }, [])

  const fetchCustomerTypes = async () => {
    // Abort previous request if still pending
    fetchCustomerTypesAbortControllerRef.current?.abort()
    fetchCustomerTypesAbortControllerRef.current = new AbortController()

    try {
      const res = await fetchWithRetry(
        `${API_URL}/common/list-items/customer_type/`,
        {
          headers,
          signal: fetchCustomerTypesAbortControllerRef.current.signal
        }
      )

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }

      const data = await res.json()
      setCustomerTypes(data.results || [])
    } catch (error) {
      handleError(error, "Failed to fetch customer types")
    }
  }

  const fetchCustomers = async (page: number = currentPage, size: number = pageSize) => {
    // Abort previous request if still pending
    fetchCustomersAbortControllerRef.current?.abort()
    fetchCustomersAbortControllerRef.current = new AbortController()

    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(size),
        ordering: "institution_name",
      })
      const res = await fetchWithRetry(
        `${API_URL}/sales/customers/?${params.toString()}`,
        {
          headers,
          signal: fetchCustomersAbortControllerRef.current.signal
        }
      )

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }

      const data = await res.json()
      const customersData = Array.isArray(data) ? data : data.results || []

      setCustomers(customersData)
      setTotalCount(
        Array.isArray(data)
          ? customersData.length
          : typeof data.count === "number"
            ? data.count
            : customersData.length,
      )
      setCurrentPage(page)
      setPageSize(size)
    } catch (error) {
      handleError(error, "Failed to fetch customers")
      setCustomers([])
      setTotalCount(0)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle page change
  const handlePageChange = (newPage: number) => {
    fetchCustomers(newPage, pageSize)
  }

  // Handle items per page change
  const handlePageSizeChange = (size: number) => {
    fetchCustomers(1, size)
  }

  // Handle adding a new customer
  const handleAddCustomer = async () => {
    try {
      const res = await fetchWithRetry(`${API_URL}/sales/customers/`, {
        method: "POST",
        headers,
        body: JSON.stringify(newCustomer),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.detail || "Failed to add customer")
      }

      const data = await res.json()
      setIsAddCustomerOpen(false)

      // Reset form
      setNewCustomer({
        customer_type: undefined,
        institution_name: "",
        contact_person: "",
        phone: "",
        email: "",
      })

      await fetchCustomers(1, pageSize)

      // Show toast notification
      toast.success("Customer Added Successfully", { description: "${data.institution_name} has been added to the system." })

      // Show alert message
      showAlert("success", `New customer "${data.institution_name}" has been successfully added to the system.`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      handleError(error, "Failed to add customer")
      showAlert("error", "Failed to add customer. Please try again.")
    }
  }

  // Handle updating a customer
  const handleUpdateCustomer = async () => {
    if (!editCustomer) return

    try {
      const res = await fetchWithRetry(`${API_URL}/sales/customers/${editCustomer.id}/`, {
        method: "PUT",
        headers,
        body: JSON.stringify(editCustomer),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.detail || "Failed to update customer")
      }

      const responseData = await res.json()

      setEditCustomer(null)
      setIsEditCustomerOpen(false)
      await fetchCustomers(currentPage, pageSize)

      // Show toast notification
      toast.success("Customer Updated Successfully", { description: "${responseData.institution_name} has been updated." })

      // Show alert message
      showAlert("success", `Customer "${responseData.institution_name}" has been successfully updated.`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      handleError(error, "Failed to update customer")
      const errorMessage = error instanceof Error ? error.message : "Failed to update customer"
      showAlert("error", `Failed to update customer: ${errorMessage}`)
    }
  }

  // Handle deleting a customer
  const handleDeleteCustomer = async () => {
    if (deleteCustomerId === null) return

    try {
      const customerToDelete = customers.find((c) => c.id === deleteCustomerId)
      if (!customerToDelete) return

      const res = await fetchWithRetry(`${API_URL}/sales/customers/${deleteCustomerId}/delete/`, {
        method: "DELETE",
        headers,
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.detail || "Failed to delete customer")
      }

      setDeleteCustomerId(null)
      setIsDeleteAlertOpen(false)

      const nextPage =
        customers.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage
      await fetchCustomers(nextPage, pageSize)

      // Show toast notification
      toast.error("Customer Deleted", { description: "${customerToDelete.institution_name} has been permanently removed from the system." })

      // Show alert message
      showAlert("warning", `Customer "${customerToDelete.institution_name}" has been permanently deleted from the system.`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      handleError(error, "Failed to delete customer")
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
    <>
      <DocumentTitle title="Customers" />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <PageBreadcrumb items={[DASHBOARD_CRUMB, DEFINITIONS_CRUMB, { label: "Customers" }]} />
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
                        <Label htmlFor="customer_type">Customer Type</Label>
                        <Select
                          value={newCustomer.customer_type?.toString() || ""}
                          onValueChange={(value) => setNewCustomer({ ...newCustomer, customer_type: value ? Number(value) : null })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer type" />
                          </SelectTrigger>
                          <SelectContent>
                            {customerTypes.map((type) => (
                              <SelectItem key={type.id} value={type.id.toString()}>
                                {type.display_name_en || type.name_en}
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Institution Name</TableHead>
                      <TableHead>Contact Person</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableSkeleton columns={6} rows={5} hasActions />
                    ) : customers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center">
                          No customers found
                        </TableCell>
                      </TableRow>
                    ) : (
                      customers.map((customer) => (
                        <TableRow key={customer.id}>
                          <TableCell>
                            {customerTypes.find(t => t.id === customer.customer_type)?.display_name_en || customerTypes.find(t => t.id === customer.customer_type)?.name_en || "N/A"}
                          </TableCell>
                          <TableCell className="font-medium">{customer.institution_name}</TableCell>
                          <TableCell>{customer.contact_person || "N/A"}</TableCell>
                          <TableCell>{customer.phone || "N/A"}</TableCell>
                          <TableCell>{customer.email || "N/A"}</TableCell>
                          <TableCell className="text-right">
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
                <Label htmlFor="edit-customer_type">Customer Type</Label>
                <Select
                  value={editCustomer.customer_type?.toString() || ""}
                  onValueChange={(value) => setEditCustomer({ ...editCustomer, customer_type: value ? Number(value) : null })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer type" />
                  </SelectTrigger>
                  <SelectContent>
                    {customerTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.display_name_en || type.name_en}
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

      <DeleteConfirmDialog
        open={isDeleteAlertOpen}
        onOpenChange={setIsDeleteAlertOpen}
        description={
          deleteCustomerId !== null ? (
            <>
              You are about to delete{" "}
              <strong>{customers.find((c) => c.id === deleteCustomerId)?.institution_name}</strong>. This action cannot be undone.
              This will permanently remove the customer from your system.
            </>
          ) : (
            ""
          )
        }
        onConfirm={handleDeleteCustomer}
      />
    </>
  )
}
