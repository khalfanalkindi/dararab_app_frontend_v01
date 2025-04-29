"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Plus,
  Minus,
  Trash2,
  Search,
  UserPlus,
  Printer,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Users,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  Download,
} from "lucide-react"
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
import Link from "next/link"
import { AppSidebar } from "../../components/app-sidebar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import jsPDF from "jspdf"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"

interface Product {
  id: number;
  title_ar: string;
  title_en: string;
  isbn: string;
  genre_id: number;
  status_id: number;
  genre_name: string;
  status_name: string;
  author_name: string | null;
  translator_name: string | null;
  editions_count: number;
  stock: number | null;
  latest_price: string | null;
  latest_cost: string | null;
  cover_design_url: string | null;
  warehouse_stock?: number;
}

interface Customer {
  id: number
  institution_name: string
  contact_person: string
  phone: string
  email: string
  type?: number
}

interface CartItem {
  product: Product
  quantity: number
  discount_percent: number
}

interface Genre {
  id: number
  value: string
  display_name_en: string
}

interface Warehouse {
  id: number
  name_en: string
  name_ar: string
}

interface PaymentMethod {
  id: number
  value: string
  display_name_en: string
}

interface InvoiceType {
  id: number
  value: string
  display_name_en: string
}

interface SummaryData {
  product: number;
  latest_price: {
    price: number;
    date: string;
  };
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [genres, setGenres] = useState<Genre[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [invoiceTypes, setInvoiceTypes] = useState<InvoiceType[]>([])
  const [searchInput, setSearchInput] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<number | null>(null)
  const [selectedInvoiceType, setSelectedInvoiceType] = useState<number | null>(null)
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)
  const [customerSearchQuery, setCustomerSearchQuery] = useState("")
  const [newCustomer, setNewCustomer] = useState<Omit<Customer, "id">>({
    institution_name: "",
    contact_person: "",
    phone: "",
    email: "",
  })
  const [isNewCustomerDialogOpen, setIsNewCustomerDialogOpen] = useState(false)
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false)
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null)
  const [isGenreDropdownOpen, setIsGenreDropdownOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [discountPercentage, setDiscountPercentage] = useState<number>(0)
  const [taxPercentage, setTaxPercentage] = useState<number>(5)
  const [invoiceNotes, setInvoiceNotes] = useState("")
  const [todaySales, setTodaySales] = useState(0)
  const [totalCustomers, setTotalCustomers] = useState(0)
  const [popularProduct, setPopularProduct] = useState("")
  const printRef = useRef<HTMLDivElement>(null)
  const [showMetrics, setShowMetrics] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [showInvoiceControls, setShowInvoiceControls] = useState(false)
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [receiptData, setReceiptData] = useState<any>(null)
  const [isWarehouseDropdownOpen, setIsWarehouseDropdownOpen] = useState(false)

  // Add error handling for avatar image
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    target.src = "/placeholder.svg";
  };

  // Update the fetchData function
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("accessToken");
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      // Add warehouse_id to the query if selected
      const warehouseQuery = selectedWarehouse ? `?warehouse_id=${selectedWarehouse}` : '';
      
      // Fetch all data in parallel
      const [
        productsRes,
        customersRes,
        genresRes,
        warehousesRes,
        paymentMethodsRes,
        invoiceTypesRes
      ] = await Promise.all([
        fetch(`${API_URL}/inventory/pos-product-summary/${warehouseQuery}`, { headers }),
        fetch(`${API_URL}/sales/customers/`, { headers }),
        fetch(`${API_URL}/common/list-items/genre/`, { headers }),
        fetch(`${API_URL}/inventory/warehouses/`, { headers }),
        fetch(`${API_URL}/common/list-items/payment_method/`, { headers }),
        fetch(`${API_URL}/common/list-items/invoice_type/`, { headers })
      ]);

      if (!productsRes.ok) throw new Error("Failed to fetch products");
      if (!customersRes.ok) throw new Error("Failed to fetch customers");
      if (!genresRes.ok) throw new Error("Failed to fetch genres");
      if (!warehousesRes.ok) throw new Error("Failed to fetch warehouses");
      if (!paymentMethodsRes.ok) throw new Error("Failed to fetch payment methods");
      if (!invoiceTypesRes.ok) throw new Error("Failed to fetch invoice types");

      const productsData = await productsRes.json();
      const customersData = await customersRes.json();
      const genresData = await genresRes.json();
      const warehousesData = await warehousesRes.json();
      const paymentMethodsData = await paymentMethodsRes.json();
      const invoiceTypesData = await invoiceTypesRes.json();

      // Process products - filter only available products
      let availableProducts: Product[] = [];
      if (productsData.results) {
        availableProducts = productsData.results.filter((p: Product) => p.status_id === 17);
      } else {
        console.warn("Unexpected products data structure:", productsData);
      }

      // Process other data
      const customersArray = Array.isArray(customersData) ? customersData : customersData.results || [];
      const genresArray = Array.isArray(genresData) ? genresData : genresData.results || [];
      const warehousesArray = Array.isArray(warehousesData) ? warehousesData : warehousesData.results || [];
      const paymentMethodsArray = Array.isArray(paymentMethodsData) ? paymentMethodsData : paymentMethodsData.results || [];
      const invoiceTypesArray = Array.isArray(invoiceTypesData) ? invoiceTypesData : invoiceTypesData.results || [];

      // Set state with fetched data
      setProducts(availableProducts);
      setFilteredProducts(availableProducts);
      setCustomers(customersArray);
      setGenres(genresArray);
      setWarehouses(warehousesArray);
      setPaymentMethods(paymentMethodsArray);
      setInvoiceTypes(invoiceTypesArray);

      // Set default values if available
      if (paymentMethodsArray.length > 0) {
        setSelectedPaymentMethod(paymentMethodsArray[0].id);
      }
      if (invoiceTypesArray.length > 0) {
        setSelectedInvoiceType(invoiceTypesArray[0].id);
      }

      // Set default values for sales summary
      setTodaySales(0);
      setTotalCustomers(customersArray.length);
      setPopularProduct("N/A");

    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch initial data
  useEffect(() => {
    fetchData()
  }, [])

  // Update the useEffect for filtering products
  useEffect(() => {
    const filtered = products.filter((product) => {
      const matchesSearch =
        searchInput === "" ||
        product.title_en.toLowerCase().includes(searchInput.toLowerCase()) ||
        product.title_ar?.toLowerCase().includes(searchInput.toLowerCase()) ||
        product.isbn?.toLowerCase().includes(searchInput.toLowerCase());

      const matchesGenre = selectedGenre === null || product.genre_id === selectedGenre.id;

      return matchesSearch && matchesGenre;
    });

    setFilteredProducts(filtered);
  }, [products, searchInput, selectedGenre]);

  // Filter customers based on search query
  const filteredCustomers = customers.filter(
    (customer) =>
      customer.institution_name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
      customer.contact_person?.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
      customer.phone?.includes(customerSearchQuery) ||
      customer.email?.toLowerCase().includes(customerSearchQuery.toLowerCase()),
  )

  // Cart functions
  const addToCart = (product: Product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.product.id === product.id)
      if (existingItem) {
        return prevCart.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        )
      }
      return [...prevCart, { product, quantity: 1, discount_percent: 0 }]
    })
  }

  const removeFromCart = (productId: number) => {
    setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId))
  }

  const updateQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity < 1) {
      removeFromCart(productId)
      return
    }
    setCart((prevCart) =>
      prevCart.map((item) => (item.product.id === productId ? { ...item, quantity: newQuantity } : item)),
    )
  }

  const updateItemDiscount = (productId: number, discountPercent: number) => {
    setCart((prevCart) =>
      prevCart.map((item) => (item.product.id === productId ? { ...item, discount_percent: discountPercent } : item)),
    )
  }

  // Update the calculateItemTotal function to handle the new price format
  const calculateItemTotal = (item: CartItem) => {
    const price = item.product.latest_price ? parseFloat(item.product.latest_price) : 0;
    const quantity = item.quantity;
    const discount = item.discount_percent / 100;
    return price * quantity * (1 - discount);
  };

  const subtotal = cart.reduce((sum, item) => sum + calculateItemTotal(item), 0)
  const globalDiscountAmount = (subtotal * discountPercentage) / 100
  const discountedSubtotal = subtotal - globalDiscountAmount
  const tax = discountedSubtotal * (taxPercentage / 100)
  const total = discountedSubtotal + tax

  // Handle adding a new customer
  const handleAddCustomer = async () => {
    try {
      setIsSubmitting(true)
      const token = localStorage.getItem("accessToken")
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }

      const response = await fetch(`${API_URL}/sales/customers/`, {
        method: "POST",
        headers,
        body: JSON.stringify(newCustomer),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to create customer")
      }

      const customer = await response.json()
      setCustomers([...customers, customer])
      setSelectedCustomer(customer)
      setNewCustomer({
        institution_name: "",
        contact_person: "",
        phone: "",
        email: "",
      })
      setIsNewCustomerDialogOpen(false)
      toast({
        title: "Success",
        description: "Customer added successfully",
      })
    } catch (error) {
      console.error("Error adding customer:", error)
      toast({
        title: "Error",
        description: "Failed to add customer. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Update the handleCompleteSale function to calculate summary locally
  const handleCompleteSale = async () => {
    if (
      !selectedCustomer ||
      !selectedWarehouse ||
      !selectedPaymentMethod ||
      !selectedInvoiceType ||
      cart.length === 0
    ) {
      toast({
        title: "Missing Information",
        description: "Please select customer, warehouse, payment method, and invoice type before completing the sale.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)
      const token = localStorage.getItem("accessToken")
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }

      // 1. Create the invoice
      const invoiceData = {
        customer: selectedCustomer.id,
        warehouse: selectedWarehouse,
        invoice_type: selectedInvoiceType,
        payment_method: selectedPaymentMethod,
        is_returnable: true,
        notes: invoiceNotes,
        global_discount_percent: discountPercentage,
        tax_percent: taxPercentage,
      }

      const invoiceResponse = await fetch(`${API_URL}/sales/invoices/`, {
        method: "POST",
        headers,
        body: JSON.stringify(invoiceData),
      })

      if (!invoiceResponse.ok) {
        const errorData = await invoiceResponse.json()
        throw new Error(errorData.message || "Failed to create invoice")
      }

      const invoice = await invoiceResponse.json()
      const invoiceId = invoice.id

      // 2. Create invoice items
      for (const item of cart) {
        const itemData = {
          invoice: invoiceId,
          product: item.product.id,
          quantity: item.quantity,
          unit_price: item.product.latest_price ? parseFloat(item.product.latest_price) : 0,
          discount_percent: item.discount_percent,
          total_price: calculateItemTotal(item),
        }

        const itemResponse = await fetch(`${API_URL}/sales/invoice-items/`, {
          method: "POST",
          headers,
          body: JSON.stringify(itemData),
        })

        if (!itemResponse.ok) {
          const errorData = await itemResponse.json()
          throw new Error(errorData.message || "Failed to create invoice item")
        }
      }

      // 3. Create payment record
      const paymentData = {
        invoice: invoiceId,
        amount: parseFloat(total.toFixed(2)),
        payment_date: format(new Date(), "yyyy-MM-dd"),
        notes: "Payment received at time of sale",
      }

      const paymentResponse = await fetch(`${API_URL}/sales/payments/`, {
        method: "POST",
        headers,
        body: JSON.stringify(paymentData),
      })

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json()
        throw new Error(errorData.message || "Failed to create payment")
      }

      toast({
        title: "Success",
        description: "Sale completed successfully",
      })

      // Fetch invoice summary for receipt
      const summaryRes = await fetch(`${API_URL}/sales/invoices/${invoiceId}/summary/`, { headers })
      if (!summaryRes.ok) {
        throw new Error("Failed to fetch invoice summary for receipt")
      }
      const summary = await summaryRes.json()
      setReceiptData(summary)
      setIsPrintDialogOpen(true)

      // Update sales summary locally
      setTodaySales(prev => prev + total)
      setTotalCustomers(prev => prev + 1)
      // Find the most popular product in the cart
      const productCounts = new Map<number, number>()
      cart.forEach(item => {
        const count = productCounts.get(item.product.id) || 0
        productCounts.set(item.product.id, count + item.quantity)
      })
      let maxCount = 0
      let popularProductId = 0
      productCounts.forEach((count, productId) => {
        if (count > maxCount) {
          maxCount = count
          popularProductId = productId
        }
      })
      const popularProduct = products.find(p => p.id === popularProductId)
      if (popularProduct) {
        setPopularProduct(popularProduct.title_en)
      }
      setIsCartOpen(false)
      // Do NOT clear cart/customer here; do it after receipt is closed
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to complete sale. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Update the handlePrint function to properly display receipt data
  const handlePrint = () => {
    if (printRef.current) {
      try {
        const printWindow = window.open("", "_blank")
        if (printWindow) {
          printWindow.document.write("<html><head><title>Receipt</title>")
          printWindow.document.write(
            "<style>body { font-family: Arial, sans-serif; } table { width: 100%; border-collapse: collapse; } th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; } .receipt-header { text-align: center; margin-bottom: 20px; } .receipt-footer { margin-top: 20px; text-align: center; }</style>",
          )
          printWindow.document.write("</head><body>")
          printWindow.document.write(printRef.current.innerHTML)
          printWindow.document.write("</body></html>")
          printWindow.document.close()
          printWindow.print()
        }
      } catch (error) {
        console.error("Error printing:", error)
      }
    }
  }

  const handleDownloadPDF = () => {
    if (printRef.current) {
      const doc = new jsPDF({ unit: "pt", format: "a4" })
      doc.html(printRef.current, {
        callback: function (doc: any) {
          doc.save("receipt.pdf")
        },
        x: 10,
        y: 10,
        width: 500,
        windowWidth: 800,
      })
    }
  }

  // Add this function to handle invoice type switching
  const handleSwitchToReturn = () => {
    const returnType = invoiceTypes.find(type => type.display_name_en.toLowerCase() === "return")
    if (returnType) {
      setSelectedInvoiceType(returnType.id)
      setShowInvoiceControls(true)
    }
  }

  // Add new useEffect for warehouse changes
  useEffect(() => {
    if (selectedWarehouse) {
      fetchData();
    }
  }, [selectedWarehouse]);

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
                    <Link href="/">Home</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Point of Sale</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto flex items-center gap-2 px-4">
            <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="relative">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Cart
                  {cart.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs">
                      {cart.length}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[400px] sm:w-[540px] h-full overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Cart ({cart.length})</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label>Customer</Label>
                    <div className="flex gap-2">
                      <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={customerSearchOpen}
                            className="w-full justify-between"
                          >
                            {selectedCustomer ? selectedCustomer.institution_name : "Search customer..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0">
                          <Command>
                            <CommandInput
                              placeholder="Search customer..."
                              value={customerSearchQuery}
                              onValueChange={setCustomerSearchQuery}
                            />
                            <CommandList>
                              <CommandEmpty>No customer found.</CommandEmpty>
                              <CommandGroup>
                                {filteredCustomers.map((customer) => (
                                  <CommandItem
                                    key={customer.id}
                                    value={customer.institution_name}
                                    onSelect={() => {
                                      setSelectedCustomer(customer)
                                      setCustomerSearchOpen(false)
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedCustomer?.id === customer.id ? "opacity-100" : "opacity-0",
                                      )}
                                    />
                                    <div>
                                      <p>{customer.institution_name}</p>
                                      <p className="text-sm text-muted-foreground">
                                        {customer.contact_person || customer.phone}
                                      </p>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <Dialog open={isNewCustomerDialogOpen} onOpenChange={setIsNewCustomerDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="icon">
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add New Customer</DialogTitle>
                            <DialogDescription>
                              Enter the customer details below to add them to your system.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label htmlFor="institution_name">Institution Name</Label>
                              <Input
                                id="institution_name"
                                value={newCustomer.institution_name}
                                onChange={(e) =>
                                  setNewCustomer({ ...newCustomer, institution_name: e.target.value })
                                }
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="contact_person">Contact Person</Label>
                              <Input
                                id="contact_person"
                                value={newCustomer.contact_person}
                                onChange={(e) => setNewCustomer({ ...newCustomer, contact_person: e.target.value })}
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="phone">Phone</Label>
                              <Input
                                id="phone"
                                value={newCustomer.phone}
                                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="email">Email</Label>
                              <Input
                                id="email"
                                type="email"
                                value={newCustomer.email}
                                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsNewCustomerDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleAddCustomer} disabled={isSubmitting}>
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Adding...
                                </>
                              ) : (
                                "Add Customer"
                              )}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Invoice Settings</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => setShowInvoiceControls(!showInvoiceControls)}
                      >
                        {showInvoiceControls ? "Hide" : "Show"} Details
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Select
                        value={selectedWarehouse?.toString() || ""}
                        onValueChange={(value) => setSelectedWarehouse(Number(value))}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Select warehouse" />
                        </SelectTrigger>
                        <SelectContent>
                          {warehouses.map((warehouse) => (
                            <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                              {warehouse.name_en}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {showInvoiceControls && (
                        <>
                        <Select
                          value={selectedInvoiceType?.toString() || ""}
                          onValueChange={(value) => setSelectedInvoiceType(Number(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select invoice type" />
                          </SelectTrigger>
                          <SelectContent>
                            {invoiceTypes.map((type) => (
                              <SelectItem key={type.id} value={type.id.toString()}>
                                {type.display_name_en}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={selectedPaymentMethod?.toString() || ""}
                          onValueChange={(value) => setSelectedPaymentMethod(Number(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentMethods.map((method) => (
                              <SelectItem key={method.id} value={method.id.toString()}>
                                {method.display_name_en}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        </>
                      )}
                    </div>
                    {!showInvoiceControls && selectedInvoiceType && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {invoiceTypes.find(type => type.id === selectedInvoiceType)?.display_name_en}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={handleSwitchToReturn}
                        >
                          Switch to Return
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Items</Label>
                    <div className="border rounded-md p-4 space-y-4 max-h-[300px] overflow-y-auto">
                      {cart.length === 0 ? (
                        <p className="text-center text-muted-foreground">No items in cart</p>
                      ) : (
                        cart.map((item) => (
                          <div key={item.product.id} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium">{item.product.title_en}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {(item.product.latest_price ? parseFloat(item.product.latest_price).toFixed(3) : "N/A")} OMR
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <span className="w-8 text-center">{item.quantity}</span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => removeFromCart(item.product.id)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs">Item Discount:</Label>
                              <Select
                                value={item.discount_percent.toString()}
                                onValueChange={(value) => updateItemDiscount(item.product.id, Number(value))}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="0%" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="0">0%</SelectItem>
                                  <SelectItem value="5">5%</SelectItem>
                                  <SelectItem value="10">10%</SelectItem>
                                  <SelectItem value="15">15%</SelectItem>
                                  <SelectItem value="20">20%</SelectItem>
                                  <SelectItem value="25">25%</SelectItem>
                                  <SelectItem value="50">50%</SelectItem>
                                  <SelectItem value="75">75%</SelectItem>
                                  <SelectItem value="100">100%</SelectItem>
                                </SelectContent>
                              </Select>
                              <span className="text-xs ml-auto">
                                Total: {calculateItemTotal(item).toFixed(3)} OMR
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Input
                      placeholder="Add notes to invoice..."
                      value={invoiceNotes}
                      onChange={(e) => setInvoiceNotes(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2 bg-muted p-4 rounded-lg">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>{subtotal.toFixed(3)} OMR</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span>Discount</span>
                      <div className="flex items-center gap-2">
                        <Select
                          value={discountPercentage.toString()}
                          onValueChange={(value) => setDiscountPercentage(Number(value))}
                        >
                          <SelectTrigger className="w-[100px] h-8">
                            <SelectValue placeholder="0%" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0%</SelectItem>
                            <SelectItem value="5">5%</SelectItem>
                            <SelectItem value="10">10%</SelectItem>
                            <SelectItem value="15">15%</SelectItem>
                            <SelectItem value="20">20%</SelectItem>
                            <SelectItem value="25">25%</SelectItem>
                            <SelectItem value="50">50%</SelectItem>
                            <SelectItem value="75">75%</SelectItem>
                            <SelectItem value="100">100%</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="min-w-[60px] text-right">
                          {globalDiscountAmount > 0 ? `-${globalDiscountAmount.toFixed(3)}` : "0.000"} OMR
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span>Tax</span>
                      <div className="flex items-center gap-2">
                        <Select
                          value={taxPercentage.toString()}
                          onValueChange={(value) => setTaxPercentage(Number(value))}
                        >
                          <SelectTrigger className="w-[100px] h-8">
                            <SelectValue placeholder="5%" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0%</SelectItem>
                            <SelectItem value="5">5%</SelectItem>
                            <SelectItem value="7">7%</SelectItem>
                            <SelectItem value="10">10%</SelectItem>
                            <SelectItem value="15">15%</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="min-w-[60px] text-right">{tax.toFixed(3)} OMR</span>
                      </div>
                    </div>

                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span>{total.toFixed(3)} OMR</span>
                    </div>
                  </div>

                  <Button
                    className="w-full mt-4"
                    size="lg"
                    disabled={cart.length === 0 || isSubmitting || !selectedCustomer || !selectedWarehouse}
                    onClick={handleCompleteSale}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Complete Sale"
                    )}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <Button
              variant="outline"
              onClick={() => {
                setCart([])
                setSelectedCustomer(null)
                setInvoiceNotes("")
                setDiscountPercentage(0)
                setTaxPercentage(5)
              }}
            >
              New Sale
            </Button>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="min-h-[50vh] flex-1 rounded-xl bg-muted/50 p-6 md:min-h-min">
            {/* Metrics Toggle Button */}
            <div className="mb-4">
              <Button
                variant="ghost"
                className="w-full justify-between"
                onClick={() => setShowMetrics(!showMetrics)}
              >
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <span>Sales Metrics</span>
                </span>
                {showMetrics ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>

            {/* Dashboard Cards */}
            {showMetrics && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Today's Sales</p>
                      <h3 className="text-2xl font-bold">{todaySales.toFixed(3)} OMR</h3>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-primary" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Customers</p>
                      <h3 className="text-2xl font-bold">{totalCustomers}</h3>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Popular Product</p>
                      <h3 className="text-2xl font-bold">{popularProduct}</h3>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-primary" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Products Section - Now takes full width */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Products</CardTitle>
                <div className="flex items-center gap-2">
                  
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <div className="relative flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search products by title, ISBN..."
                          value={searchInput}
                          onChange={(e) => setSearchInput(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                      <Popover open={isWarehouseDropdownOpen} onOpenChange={setIsWarehouseDropdownOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsWarehouseDropdownOpen(true)}
                          >
                            {selectedWarehouse ? warehouses.find(w => w.id === selectedWarehouse)?.name_en : "All Warehouses"}
                            <ChevronDown className="ml-2 h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-0">
                          <Command>
                            <CommandInput placeholder="Search warehouses..." />
                            <CommandList>
                              <CommandEmpty>No warehouse found.</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  onSelect={() => {
                                    setSelectedWarehouse(null);
                                    setIsWarehouseDropdownOpen(false);
                                    fetchData(); // Refresh data when selecting "All Warehouses"
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedWarehouse === null ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  All Warehouses
                                </CommandItem>
                                {warehouses.map((warehouse) => (
                                  <CommandItem
                                    key={warehouse.id}
                                    onSelect={() => {
                                      setSelectedWarehouse(warehouse.id);
                                      setIsWarehouseDropdownOpen(false);
                                      fetchData(); // Refresh data when selecting a specific warehouse
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedWarehouse === warehouse.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {warehouse.name_en}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <Popover open={isGenreDropdownOpen} onOpenChange={setIsGenreDropdownOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsGenreDropdownOpen(true)}
                          >
                            {selectedGenre ? selectedGenre.display_name_en : "All Genres"}
                            <ChevronDown className="ml-2 h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-0">
                          <Command>
                            <CommandInput placeholder="Search genres..." />
                            <CommandList>
                              <CommandEmpty>No genre found.</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  onSelect={() => {
                                    setSelectedGenre(null);
                                    setIsGenreDropdownOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedGenre === null ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  All Genres
                                </CommandItem>
                                {genres.map((genre) => (
                                  <CommandItem
                                    key={genre.id}
                                    onSelect={() => {
                                      setSelectedGenre(genre);
                                      setIsGenreDropdownOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedGenre?.id === genre.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {genre.display_name_en}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedGenre && (
                        <div className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-full text-sm">
                          {selectedGenre.display_name_en}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-transparent"
                            onClick={() => setSelectedGenre(null)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      {selectedWarehouse && (
                        <div className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-full text-sm">
                          {warehouses.find(w => w.id === selectedWarehouse)?.name_en}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-transparent"
                            onClick={() => setSelectedWarehouse(null)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  {isLoading ? (
                    <div className="flex justify-center items-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="ml-2">Loading products...</span>
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">No products found</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {filteredProducts.map((product) => (
                        <Card key={product.id} className="cursor-pointer hover:shadow-md transition-shadow">
                          <CardContent className="p-2">
                            <div className="relative aspect-square rounded-md overflow-hidden mb-2">
                              <img
                                src={product.cover_design_url || "/placeholder.svg"}
                                alt={product.title_en}
                                className="w-full h-full object-cover"
                                onError={handleImageError}
                              />
                              {product.genre_name && (
                                <div className="absolute top-2 right-2">
                                  <span className="text-xs px-2 py-1 bg-primary/90 text-primary-foreground rounded-full">
                                    {product.genre_name}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="space-y-1">
                              <h3 className="font-medium text-sm line-clamp-1">{product.title_en}</h3>
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="font-bold text-sm">{(product.latest_price ? parseFloat(product.latest_price).toFixed(3) : "N/A")} OMR</p>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <p className="text-xs text-muted-foreground cursor-help">
                                          Stock: {product.stock || product.warehouse_stock || 0}
                                        </p>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <div className="space-y-1">
                                          <p className="font-medium">Stock Information</p>
                                          <p>Current Stock: {product.stock || product.warehouse_stock || 0}</p>
                                          <p>ISBN: {product.isbn || 'N/A'}</p>
                                          <p>Author: {product.author_name || 'N/A'}</p>
                                          <p>Translator: {product.translator_name || 'N/A'}</p>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                <Button 
                                  size="sm" 
                                  className="h-7 px-2 text-xs"
                                  onClick={() => addToCart(product)}
                                >
                                  Add
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Floating Action Button */}
        {cart.length > 0 && (
          <div className="fixed bottom-6 right-6 z-50">
            <Button
              size="lg"
              className="rounded-full h-14 w-14 shadow-lg"
              onClick={() => setIsConfirmDialogOpen(true)}
            >
              <CheckCircle2 className="h-6 w-6" />
            </Button>
          </div>
        )}

        {/* Confirm Sale Dialog */}
        <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Sale</DialogTitle>
              <DialogDescription>
                Review the sale details before completing the transaction.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Customer</span>
                  <span className="font-medium">
                    {selectedCustomer?.institution_name || "Walk-in Customer"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Items</span>
                  <span className="font-medium">{cart.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{subtotal.toFixed(3)} OMR</span>
                </div>
                {discountPercentage > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Discount</span>
                    <span className="font-medium text-green-600">
                      -{globalDiscountAmount.toFixed(3)} OMR
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Tax</span>
                  <span className="font-medium">{tax.toFixed(3)} OMR</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-lg">{total.toFixed(3)} OMR</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsConfirmDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCompleteSale}
                disabled={isSubmitting || !selectedCustomer || !selectedWarehouse}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Confirm Sale"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* Print Receipt Dialog */}
      <Dialog open={isPrintDialogOpen} onOpenChange={(open) => {
        setIsPrintDialogOpen(open);
        if (!open) {
          setReceiptData(null);
          setCart([]);
          setSelectedCustomer(null);
          setInvoiceNotes("");
          setDiscountPercentage(0);
          setTaxPercentage(5);
          // Reset the page (reload)
          window.location.reload();
        }
      }}>
        <DialogContent className="w-full max-w-md h-[90vh] flex flex-col">
          <div className="shrink-0">
            <DialogHeader>
              <DialogTitle>Receipt</DialogTitle>
              <DialogDescription>View, print, or download your receipt.</DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto my-4" ref={printRef}>
            <div className="p-4">
              <div className="receipt-header text-center mb-6">
                <h2 className="text-xl font-bold">Dar Arab For Publication & Translation</h2>
                <p>123 Main Street, Muscat, Oman</p>
                <p className="mt-2">Tel: +968 1234 5678</p>
                <p className="text-sm mt-2">Receipt #{receiptData?.id}</p>
                <p className="text-sm">{receiptData?.created_at_formatted || format(new Date(), "PPP")}</p>
              </div>
              <div className="mb-4">
                <p><strong>Customer:</strong> {receiptData?.customer_name || "Walk-in Customer"}</p>
                {receiptData?.customer_contact && (
                  <p className="whitespace-pre-line text-xs text-muted-foreground">{receiptData.customer_contact}</p>
                )}
              </div>
              <table className="w-full mb-4">
                <thead>
                  <tr>
                    <th className="text-left">Item</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Disc%</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptData?.items?.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td>{item.product_name}</td>
                      <td className="text-right">{item.quantity}</td>
                      <td className="text-right">{item.unit_price?.toFixed(3)}</td>
                      <td className="text-right">{item.discount_percent}%</td>
                      <td className="text-right">{item.total_price?.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="text-right"><strong>Subtotal:</strong></td>
                    <td className="text-right">{receiptData?.total_amount?.toFixed(3)} OMR</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="text-right"><strong>Total Paid:</strong></td>
                    <td className="text-right">{receiptData?.total_paid?.toFixed(3)} OMR</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="text-right"><strong>Remaining:</strong></td>
                    <td className="text-right">{receiptData?.remaining_amount?.toFixed(3)} OMR</td>
                  </tr>
                </tfoot>
              </table>
              {receiptData?.notes && (
                <div className="mb-4 p-2 border rounded">
                  <p><strong>Notes:</strong> {receiptData.notes}</p>
                </div>
              )}
              <div className="receipt-footer text-center mt-6">
                <p>Thank you for your purchase!</p>
                <p className="text-sm">Visit us again soon</p>
              </div>
            </div>
          </div>
          <div className="shrink-0 flex flex-col gap-2 sm:flex-row sm:justify-end pt-2 border-t bg-white">
            <Button variant="outline" onClick={handlePrint} aria-label="Print" title="Print">
              <Printer className="h-5 w-5" />
            </Button>
            <Button variant="outline" onClick={handleDownloadPDF} aria-label="Download as PDF" title="Download as PDF">
              <Download className="h-5 w-5" />
            </Button>
            <Button onClick={() => setIsPrintDialogOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
}
