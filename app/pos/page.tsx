"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
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
  FileText,
  Image,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://dararabappbackendv01-production.up.railway.app/api"

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
  is_paid: boolean
  paid_amount: number
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
  const [taxPercentage, setTaxPercentage] = useState<number>(0)
  const [invoiceNotes, setInvoiceNotes] = useState("")
  const [todaySales, setTodaySales] = useState(0)
  const [totalCustomers, setTotalCustomers] = useState(0)
  const [popularProduct, setPopularProduct] = useState("")
  const printRef = useRef<HTMLDivElement>(null)
  const [showMetrics, setShowMetrics] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [receiptData, setReceiptData] = useState<any>(null)
  const [isWarehouseDropdownOpen, setIsWarehouseDropdownOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(1)

  // Add error handling for avatar image
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    target.src = "/placeholder.svg";
  };

  // Update the fetchData function - only fetch basic data, not products
  const fetchData = async () => {
    try {
      const token = localStorage.getItem("accessToken");
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      // Fetch all basic data in parallel (except products which need warehouse selection)
      const [
        customersRes,
        genresRes,
        warehousesRes,
        paymentMethodsRes,
        invoiceTypesRes
      ] = await Promise.all([
        fetch(`${API_URL}/sales/customers/`, { headers }),
        fetch(`${API_URL}/common/list-items/genre/`, { headers }),
        fetch(`${API_URL}/inventory/warehouses/`, { headers }),
        fetch(`${API_URL}/common/list-items/payment_method/`, { headers }),
        fetch(`${API_URL}/common/list-items/invoice_type/`, { headers })
      ]);

      if (!customersRes.ok) throw new Error("Failed to fetch customers");
      if (!genresRes.ok) throw new Error("Failed to fetch genres");
      if (!warehousesRes.ok) throw new Error("Failed to fetch warehouses");
      if (!paymentMethodsRes.ok) throw new Error("Failed to fetch payment methods");
      if (!invoiceTypesRes.ok) throw new Error("Failed to fetch invoice types");

      const customersData = await customersRes.json();
      const genresData = await genresRes.json();
      const warehousesData = await warehousesRes.json();
      const paymentMethodsData = await paymentMethodsRes.json();
      const invoiceTypesData = await invoiceTypesRes.json();

      // Process other data
      const customersArray = Array.isArray(customersData) ? customersData : customersData.results || [];
      const genresArray = Array.isArray(genresData) ? genresData : genresData.results || [];
      const warehousesArray = Array.isArray(warehousesData) ? warehousesData : warehousesData.results || [];
      const paymentMethodsArray = Array.isArray(paymentMethodsData) ? paymentMethodsData : paymentMethodsData.results || [];
      const invoiceTypesArray = Array.isArray(invoiceTypesData) ? invoiceTypesData : invoiceTypesData.results || [];

      // Set state with fetched data
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
      setTotalCustomers(customersArray.length);
      setPopularProduct("N/A");

    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load data. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Fetch initial data - only fetch basic data, not products
  useEffect(() => {
    fetchData()
    fetchSalesMetrics()
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

    // Calculate pagination
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    setTotalPages(totalPages);
    
    // Ensure current page is valid
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }

    // Get paginated results
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedResults = filtered.slice(startIndex, endIndex);

    setFilteredProducts(paginatedResults);
  }, [products, searchInput, selectedGenre, currentPage, pageSize]);

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
      
      // Determine default payment behavior based on selected payment method
      const itemTotal = (product.latest_price ? parseFloat(product.latest_price) : 0) * 1; // quantity = 1
      let isPaid = true;
      let paidAmount = itemTotal;
      
      if (selectedPaymentMethod) {
        const paymentMethod = paymentMethods.find(m => m.id === selectedPaymentMethod);
        if (paymentMethod) {
          const isOutstanding = paymentMethod.display_name_en.toLowerCase().includes('outstanding');
          isPaid = !isOutstanding;
          paidAmount = !isOutstanding ? itemTotal : 0;
        }
      }
      
      return [...prevCart, { 
        product, 
        quantity: 1, 
        discount_percent: 0, 
        is_paid: isPaid, 
        paid_amount: paidAmount 
      }]
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
      prevCart.map((item) => {
        if (item.product.id === productId) {
          const newItemTotal = (item.product.latest_price ? parseFloat(item.product.latest_price) : 0) * newQuantity * (1 - item.discount_percent / 100);
          return { 
            ...item, 
            quantity: newQuantity,
            // If item was fully paid, update paid amount to new total
            // If item was partially paid or unpaid, keep the same paid amount
            paid_amount: item.is_paid && Math.abs(item.paid_amount - (item.product.latest_price ? parseFloat(item.product.latest_price) : 0) * item.quantity * (1 - item.discount_percent / 100)) < 0.001
              ? newItemTotal 
              : item.paid_amount
          };
        }
        return item;
      }),
    )
  }

  const updateItemDiscount = (productId: number, discountPercent: number) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product.id === productId) {
          const newItemTotal = (item.product.latest_price ? parseFloat(item.product.latest_price) : 0) * item.quantity * (1 - discountPercent / 100);
          return { 
            ...item, 
            discount_percent: discountPercent,
            // If item was fully paid, update paid amount to new total
            // If item was partially paid or unpaid, keep the same paid amount
            paid_amount: item.is_paid && Math.abs(item.paid_amount - (item.product.latest_price ? parseFloat(item.product.latest_price) : 0) * item.quantity * (1 - item.discount_percent / 100)) < 0.001
              ? newItemTotal 
              : item.paid_amount
          };
        }
        return item;
      }),
    )
  }

  const updateItemPaymentStatus = (productId: number, isPaid: boolean) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product.id === productId) {
          const itemTotal = calculateItemTotal(item);
          return { 
            ...item, 
            is_paid: isPaid, 
            paid_amount: isPaid ? itemTotal : 0 
          };
        }
        return item;
      }),
    )
  }

  const updateItemPaidAmount = (productId: number, paidAmount: number) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product.id === productId) {
          const itemTotal = calculateItemTotal(item);
          const validPaidAmount = Math.min(Math.max(0, paidAmount), itemTotal);
          return { 
            ...item, 
            paid_amount: validPaidAmount,
            is_paid: validPaidAmount > 0
          };
        }
        return item;
      }),
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

  // Payment calculations
  const totalPaidAmount = cart.reduce((sum, item) => sum + item.paid_amount, 0)
  
  // If all items are fully paid, include tax in paid amount
  const allItemsFullyPaid = cart.every(item => {
    const itemTotal = calculateItemTotal(item);
    return item.paid_amount >= itemTotal;
  });
  
  const effectivePaidAmount = allItemsFullyPaid ? totalPaidAmount + tax : totalPaidAmount;
  const totalUnpaidAmount = total - effectivePaidAmount
  const paidItems = cart.filter(item => item.is_paid)
  const unpaidItems = cart.filter(item => !item.is_paid)
  const hasPartialPayment = cart.some(item => item.paid_amount > 0 && item.paid_amount < calculateItemTotal(item))
  
  // Note: Items are added to cart as paid by default
  
  // Validation function for payment amounts
  const validatePaymentAmounts = () => {
    for (const item of cart) {
      const itemTotal = calculateItemTotal(item);
      if (item.paid_amount > itemTotal) {
        return false;
      }
    }
    return true;
  }

  // Helper function to get payment status badge
  const getPaymentStatusBadge = (item: CartItem) => {
    const itemTotal = calculateItemTotal(item);
    const isFullyPaid = item.paid_amount >= itemTotal;
    const isPartiallyPaid = item.paid_amount > 0 && item.paid_amount < itemTotal;
    
    if (isFullyPaid) {
      return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Paid</span>;
    } else if (isPartiallyPaid) {
      return <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">Partial</span>;
    } else if (item.is_paid && item.paid_amount === 0) {
      return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">Unpaid</span>;
    }
    return null;
  }

  // Helper function to check if item is fully paid
  const isItemFullyPaid = (item: CartItem) => {
    const itemTotal = calculateItemTotal(item);
    return Math.abs(item.paid_amount - itemTotal) < 0.001;
  }

  // Function to apply payment method to existing items
  const applyPaymentMethodToExistingItems = () => {
    if (!selectedPaymentMethod) return;
    
    const paymentMethod = paymentMethods.find(m => m.id === selectedPaymentMethod);
    if (!paymentMethod) return;
    
    const isOutstanding = paymentMethod.display_name_en.toLowerCase().includes('outstanding');
    
    setCart(prevCart => prevCart.map(item => {
      const itemTotal = calculateItemTotal(item);
      return {
        ...item,
        is_paid: !isOutstanding,
        paid_amount: !isOutstanding ? itemTotal : 0
      };
    }));
  }

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

  // Update the handleCompleteSale function to use the new field names
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

    if (!validatePaymentAmounts()) {
      toast({
        title: "Invalid Payment Amounts",
        description: "One or more items have payment amounts exceeding their total cost.",
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

      // 1. Create the invoice with updated field names
      const invoiceData = {
        customer_id: selectedCustomer.id,
        warehouse_id: selectedWarehouse,
        invoice_type_id: selectedInvoiceType,
        payment_method_id: selectedPaymentMethod,
        is_returnable: true,
        notes: invoiceNotes,
        global_discount_percent: discountPercentage,
        tax_percent: taxPercentage,
      }
      
      console.log("Creating invoice with data:", invoiceData)

      const invoiceResponse = await fetch(`${API_URL}/sales/invoices/`, {
        method: "POST",
        headers,
        body: JSON.stringify(invoiceData),
      })

      if (!invoiceResponse.ok) {
        const errorData = await invoiceResponse.json()
        console.error("Invoice creation error:", errorData)
        throw new Error(errorData.message || errorData.detail || "Failed to create invoice")
      }

      const invoice = await invoiceResponse.json()
      const invoiceId = invoice.id

      // 2. Create invoice items with payment status
      for (const item of cart) {
        const itemTotal = calculateItemTotal(item);
        const itemData = {
          invoice: invoiceId,
          product: item.product.id,
          quantity: item.quantity,
          unit_price: item.product.latest_price ? parseFloat(item.product.latest_price) : 0,
          discount_percent: item.discount_percent,
          total_price: itemTotal,
          paid_amount: item.paid_amount,
          remaining_amount: itemTotal - item.paid_amount,
          is_paid: item.is_paid,
        }

        const itemResponse = await fetch(`${API_URL}/sales/invoice-items/`, {
          method: "POST",
          headers,
          body: JSON.stringify(itemData),
        })

        if (!itemResponse.ok) {
          const errorData = await itemResponse.json()
          console.error("Invoice item creation error:", errorData)
          throw new Error(errorData.message || errorData.detail || "Failed to create invoice item")
        }

        // Update inventory stock after creating invoice item
        const inventoryResponse = await fetch(`${API_URL}/inventory/inventory/?product_id=${item.product.id}&warehouse_id=${selectedWarehouse}`, { headers });
        if (!inventoryResponse.ok) {
          throw new Error("Failed to fetch inventory data");
        }
        const inventoryData = await inventoryResponse.json();
        const inventory = inventoryData.results?.[0];

        if (inventory) {
          // Update existing inventory
          const newQuantity = inventory.quantity - item.quantity;
          if (newQuantity < 0) {
            throw new Error(`Insufficient stock for product ${item.product.title_en}`);
          }

          const updateInventoryResponse = await fetch(`${API_URL}/inventory/inventory/product/${item.product.id}/update/`, {
            method: "PUT",
            headers,
            body: JSON.stringify({
              product_id: item.product.id,
              warehouse_id: selectedWarehouse,
              quantity: newQuantity,
              notes: inventory.notes || ''
            }),
          });

          if (!updateInventoryResponse.ok) {
            const errorData = await updateInventoryResponse.json();
            throw new Error(errorData.detail || "Failed to update inventory");
          }
        } else {
          throw new Error(`No inventory found for product ${item.product.title_en} in selected warehouse`);
        }
      }

      // 3. Create payment record for all sales (both cash and outstanding)
      const paymentData = {
        invoice: invoiceId,
        amount: parseFloat(totalPaidAmount.toFixed(2)),
        payment_date: format(new Date(), "yyyy-MM-dd"),
        notes: `Payment received at time of sale. Total: ${total.toFixed(3)} OMR, Paid: ${totalPaidAmount.toFixed(3)} OMR, Due: ${totalUnpaidAmount.toFixed(3)} OMR`,
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
        description: totalUnpaidAmount === 0 
          ? "Sale completed successfully - Fully Paid" 
          : `Sale completed successfully - ${totalUnpaidAmount.toFixed(3)} OMR remaining`,
      })

      // Fetch invoice summary for receipt
      const summaryRes = await fetch(`${API_URL}/sales/invoices/${invoiceId}/summary/`, { headers })
      if (!summaryRes.ok) {
        throw new Error("Failed to fetch invoice summary for receipt")
      }
      const summary = await summaryRes.json()
      setReceiptData(summary)
      setIsPrintDialogOpen(true)

      // Update sales summary locally - only count the amount actually paid
      setTodaySales(prev => prev + totalPaidAmount)
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
      console.error("Sale completion error:", error)
      let errorMessage = "Failed to complete sale. Please try again."
      
      if (error instanceof Error) {
        if (error.message.includes("composite_id")) {
          errorMessage = "Backend error: Invoice creation failed due to composite_id constraint. Please contact support."
        } else if (error.message.includes("Duplicate entry")) {
          errorMessage = "Backend error: Duplicate invoice entry. Please try again."
        } else {
          errorMessage = error.message
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
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
          printWindow.document.write(`
            <style>
              @media print {
                @page { 
                  size: auto; 
                  margin: 0; 
                }
                body { 
                  font-family: monospace; 
                  font-size: 12px; 
                  line-height: 1.3; 
                  margin: 0; 
                  padding: 15px; 
                  width: 100%; 
                }
                .receipt-container { 
                  width: 100% !important; 
                  max-width: 100% !important; 
                  margin: 0 !important; 
                  padding: 0 !important; 
                }
              }
              body { 
                font-family: monospace; 
                font-size: 12px; 
                line-height: 1.3; 
                margin: 0; 
                padding: 15px; 
                width: 100%; 
              }
            </style>
          `)
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
      import('html2canvas').then((html2canvas) => {
        // Wait for content to render
        setTimeout(() => {
          // First generate the image
          html2canvas.default(printRef.current!, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            allowTaint: true,
            logging: true,
            width: printRef.current?.scrollWidth,
            height: printRef.current?.scrollHeight
          }).then(canvas => {
            // Get image dimensions
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            
            // Create PDF with image dimensions
            const doc = new jsPDF({
              unit: 'px',
              format: [imgWidth, imgHeight],
              orientation: imgHeight > imgWidth ? 'portrait' : 'landscape'
            });
            
            // Convert canvas to image data
            const imgData = canvas.toDataURL('image/png');
            
            // Add image to PDF
            doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            
            // Save PDF
            doc.save('receipt.pdf');
          }).catch(error => {
            console.error('Error generating PDF:', error)
          });
        }, 500)
      });
    }
  }

  const handleDownloadImage = () => {
    if (printRef.current) {
      import('html2canvas').then((html2canvas) => {
        // Wait for content to render
        setTimeout(() => {
          html2canvas.default(printRef.current!, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            allowTaint: true,
            logging: true,
            width: printRef.current?.scrollWidth,
            height: printRef.current?.scrollHeight
          }).then(canvas => {
            const link = document.createElement('a')
            link.download = 'receipt.png'
            link.href = canvas.toDataURL()
            link.click()
          }).catch(error => {
            console.error('Error generating image:', error)
          })
        }, 500)
      })
    }
  }



  // Separate function to fetch products only with retry mechanism
  const fetchProducts = async (warehouseId: number, retryCount = 0) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("accessToken");
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      console.log(`Fetching products for warehouse ${warehouseId}`);
      const warehouseQuery = `warehouse_id=${warehouseId}&`;
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const productsRes = await fetch(`${API_URL}/inventory/pos-product-summary/?${warehouseQuery}page_size=1000`, { 
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      console.log('Products response status:', productsRes.status);
      
      if (productsRes.ok) {
        const productsData = await productsRes.json();
        console.log('Products data:', productsData);
        
        let availableProducts: Product[] = [];
        if (productsData.results) {
          availableProducts = productsData.results.filter((p: Product) => p.status_id === 2);
          console.log(`Found ${availableProducts.length} available products`);
        } else if (Array.isArray(productsData)) {
          availableProducts = productsData.filter((p: Product) => p.status_id === 2);
          console.log(`Found ${availableProducts.length} available products (array format)`);
        } else {
          console.warn("Unexpected products data structure:", productsData);
        }
        
        setProducts(availableProducts);
        setFilteredProducts(availableProducts);
      } else {
        console.error('Failed to fetch products:', productsRes.status, productsRes.statusText);
        const errorText = await productsRes.text();
        console.error('Error response:', errorText);
        setProducts([]);
        setFilteredProducts([]);
        toast({
          title: "Error",
          description: `Failed to load products for warehouse. Status: ${productsRes.status}`,
          variant: "destructive",
        });
      }
          } catch (error) {
        console.error('Error fetching products:', error);
        
        // Retry logic for network errors
        if (retryCount < 2 && (error instanceof Error && error.name === 'AbortError' || error instanceof TypeError)) {
          console.log(`Retrying fetch products (attempt ${retryCount + 1})`);
          setTimeout(() => {
            fetchProducts(warehouseId, retryCount + 1);
          }, 1000 * (retryCount + 1)); // Exponential backoff
          return;
        }
        
        setProducts([]);
        setFilteredProducts([]);
        if (error instanceof Error && error.name === 'AbortError') {
          toast({
            title: "Timeout",
            description: "Request timed out. Please try again.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: "Failed to load products. Please try again.",
            variant: "destructive",
          });
        }
      } finally {
        setIsLoading(false);
      }
    };

  // Update the useEffect for warehouse changes to fetch products when warehouse is selected
  useEffect(() => {
    if (selectedWarehouse && !isCartOpen) {
      fetchProducts(selectedWarehouse);
      fetchSalesMetrics();
    } else if (!selectedWarehouse) {
      // Clear products when no warehouse is selected
      setProducts([]);
      setFilteredProducts([]);
      setIsLoading(false);
    }
  }, [selectedWarehouse, isCartOpen]);

  // Commented out to prevent infinite loop - payment method logic is now handled in addToCart
  // useEffect(() => {
  //   if (selectedPaymentMethod && cart.length > 0) {
  //     const paymentMethod = paymentMethods.find(m => m.id === selectedPaymentMethod);
  //     if (paymentMethod) {
  //       const isOutstanding = paymentMethod.display_name_en.toLowerCase().includes('outstanding');
  //       
  //       // Only update items that haven't been manually configured yet
  //       setCart(prevCart => prevCart.map(item => {
  //         // Calculate item total inline to avoid dependency issues
  //         const price = item.product.latest_price ? parseFloat(item.product.latest_price) : 0;
  //         const quantity = item.quantity;
  //         const discount = item.discount_percent / 100;
  //         const itemTotal = price * quantity * (1 - discount);
  //         
  //         // Only update if this looks like a newly added item (paid amount matches total exactly)
  //         // and the user hasn't manually changed the payment status
  //         const isNewlyAdded = Math.abs(item.paid_amount - itemTotal) < 0.001;
  //         const shouldUpdate = isNewlyAdded && (
  //           (isOutstanding && item.is_paid) || (!isOutstanding && !item.is_paid)
  //         );
  //         
  //         if (shouldUpdate) {
  //           return {
  //             ...item,
  //             is_paid: !isOutstanding,
  //             paid_amount: !isOutstanding ? itemTotal : 0
  //           };
  //         }
  //         // Don't change items that user has manually configured
  //         return item;
  //       }));
  //     }
  //   }
  // }, [selectedPaymentMethod, paymentMethods]);

  // Add PaginationControls to the products section
  const PaginationControls = () => (
    <div className="flex items-center justify-between mt-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </span>
        <Select
          value={pageSize.toString()}
          onValueChange={(value) => {
            setPageSize(Number(value));
            setCurrentPage(1); // Reset to first page when changing page size
          }}
        >
          <SelectTrigger className="h-8 w-[70px]">
            <SelectValue placeholder={pageSize} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(1)}
          disabled={currentPage === 1}
        >
          First
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
        >
          Next
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(totalPages)}
          disabled={currentPage === totalPages}
        >
          Last
        </Button>
      </div>
    </div>
  );

  const fetchSalesMetrics = async () => {
    try {
      const token = localStorage.getItem("accessToken")
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }

      // Get today's date in Oman timezone
      const now = new Date()
      const omanDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Muscat' }))
      const today = omanDate.toISOString().split('T')[0] // This will give YYYY-MM-DD in Oman timezone
      
      // Fetch today's sales using created_at field
      const salesResponse = await fetch(`${API_URL}/sales/invoices/?created_at=${today}`, { headers })
      const salesData = await salesResponse.json()

      // Calculate today's total sales
      const todayTotal = salesData.results?.reduce((sum: number, invoice: any) => {
        return sum + (parseFloat(invoice.total_amount) || 0)
      }, 0) || 0
      setTodaySales(todayTotal)

      // Set popular product to N/A for now
      setPopularProduct("N/A")

      // Total customers is already set from the customers fetch in fetchData
    } catch (error) {
      console.error("Error fetching sales metrics:", error)
      toast({
        title: "Error",
        description: "Failed to load sales metrics. Please try again.",
        variant: "destructive",
      })
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
                    <Label>Invoice Settings</Label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                            <span className="text-sm">
                              {selectedWarehouse ? warehouses.find(w => w.id === selectedWarehouse)?.name_en : "No warehouse selected"}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                            <span className="text-sm">
                              {selectedInvoiceType ? invoiceTypes.find(type => type.id === selectedInvoiceType)?.display_name_en : "No invoice type selected"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Select
                        value={selectedPaymentMethod?.toString() || ""}
                        onValueChange={(value) => setSelectedPaymentMethod(Number(value))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentMethods
                            .filter((method) => method.display_name_en.toLowerCase() !== 'Post Paid')
                            .map((method) => (
                              <SelectItem key={method.id} value={method.id.toString()}>
                                {method.display_name_en}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Items</Label>
                    {selectedPaymentMethod && (
                      <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                        <div className="flex items-center justify-between">
                          <div>
                            <strong>Payment Method:</strong> {paymentMethods.find(m => m.id === selectedPaymentMethod)?.display_name_en}
                            {paymentMethods.find(m => m.id === selectedPaymentMethod)?.display_name_en.toLowerCase().includes('outstanding') 
                              ? ' - Items will be marked as unpaid by default'
                              : ' - Items will be marked as paid by default'
                            }
                          </div>
                          {cart.length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={applyPaymentMethodToExistingItems}
                              className="h-6 text-xs"
                            >
                              Apply to All Items
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="border rounded-md p-4 space-y-4 max-h-[300px] overflow-y-auto">
                      {cart.length === 0 ? (
                        <p className="text-center text-muted-foreground">No items in cart</p>
                      ) : (
                        cart.map((item) => {
                          const itemTotal = calculateItemTotal(item);
                          const remainingAmount = itemTotal - item.paid_amount;
                          const isFullyPaid = item.paid_amount >= itemTotal;
                          const isPartiallyPaid = item.paid_amount > 0 && item.paid_amount < itemTotal;
                          
                          return (
                            <div key={item.product.id} className={`space-y-2 p-3 rounded-lg border ${
                              isFullyPaid ? 'bg-green-50 border-green-200' : 
                              isPartiallyPaid ? 'bg-orange-50 border-orange-200' : 
                              'bg-white border-gray-200'
                            }`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1">
                                  <Checkbox
                                    checked={item.is_paid}
                                    onChange={(e) => updateItemPaymentStatus(item.product.id, e.target.checked)}
                                    className="shrink-0"
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-medium">{item.product.title_en}</h4>
                                      {getPaymentStatusBadge(item)}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      {(item.product.latest_price ? parseFloat(item.product.latest_price).toFixed(3) : "N/A")} OMR
                                    </p>
                                  </div>
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
                                  Total: {itemTotal.toFixed(3)} OMR
                                </span>
                              </div>

                              {item.is_paid && (
                                <div className="flex items-center gap-2 pt-2 border-t">
                                  <Label className="text-xs">Paid Amount:</Label>
                                  <Input
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    max={itemTotal}
                                    value={item.paid_amount}
                                    onChange={(e) => updateItemPaidAmount(item.product.id, parseFloat(e.target.value) || 0)}
                                    className="h-7 text-xs w-24"
                                    placeholder="0.000"
                                  />
                                  <span className="text-xs text-muted-foreground">
                                    {remainingAmount > 0 ? `Remaining: ${remainingAmount.toFixed(3)} OMR` : "Fully Paid"}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })
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

                    {/* Payment Summary Section */}
                    {(totalPaidAmount > 0 || hasPartialPayment) && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Payment Summary</span>
                          </div>
                          
                          {paidItems.length > 0 && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                Paid Items ({paidItems.length})
                              </span>
                              <span className="text-green-600 font-medium">
                                {effectivePaidAmount.toFixed(3)} OMR
                              </span>
                            </div>
                          )}
                          
                          {unpaidItems.length > 0 && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                Unpaid Items ({unpaidItems.length})
                              </span>
                              <span className="text-red-600 font-medium">
                                {totalUnpaidAmount.toFixed(3)} OMR
                              </span>
                            </div>
                          )}
                          
                          {hasPartialPayment && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                Partial Payments
                              </span>
                              <span className="text-orange-600 font-medium">
                                {cart.filter(item => item.paid_amount > 0 && item.paid_amount < calculateItemTotal(item)).length} items
                              </span>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Amount Due</span>
                      <span className={totalUnpaidAmount > 0 ? "text-red-600" : "text-green-600"}>
                        {totalUnpaidAmount.toFixed(3)} OMR
                      </span>
                    </div>
                  </div>

                  <Button
                    className="w-full mt-4"
                    size="lg"
                    disabled={cart.length === 0 || isSubmitting || !selectedCustomer || !selectedWarehouse || totalUnpaidAmount < 0}
                    onClick={handleCompleteSale}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <span>Complete Sale</span>
                        <span className="text-sm">
                          {totalUnpaidAmount > 0 ? `Pay ${totalUnpaidAmount.toFixed(3)} OMR` : "Fully Paid"}
                        </span>
                      </div>
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
                setSelectedWarehouse(null)
                setProducts([])
                setFilteredProducts([])
                setInvoiceNotes("")
                setDiscountPercentage(0)
                setTaxPercentage(0)
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
                            {selectedWarehouse ? warehouses.find(w => w.id === selectedWarehouse)?.name_en : "Select Warehouse"}
                            <ChevronDown className="ml-2 h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-0">
                          <Command>
                            <CommandInput placeholder="Search warehouses..." />
                            <CommandList>
                              <CommandEmpty>No warehouse found.</CommandEmpty>
                              <CommandGroup>
                                {warehouses.map((warehouse) => (
                                  <CommandItem
                                    key={warehouse.id}
                                    onSelect={() => {
                                      setSelectedWarehouse(warehouse.id);
                                      setIsWarehouseDropdownOpen(false);
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
                            onClick={() => {
                              setSelectedWarehouse(null);
                              setProducts([]);
                              setFilteredProducts([]);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  {!selectedWarehouse ? (
                    <div className="text-center py-12">
                      <div className="flex flex-col items-center gap-4">
                        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                          <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">Select a Warehouse</h3>
                          <p className="text-muted-foreground">Please select a warehouse to view available products</p>
                        </div>
                      </div>
                    </div>
                  ) : isLoading ? (
                    <div className="flex justify-center items-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="ml-2">Loading products for {warehouses.find(w => w.id === selectedWarehouse)?.name_en}...</span>
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="flex flex-col items-center gap-4">
                        <p className="text-muted-foreground">No products found in this warehouse</p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            console.log('Debug: Fetching products for warehouse', selectedWarehouse);
                            fetchProducts(selectedWarehouse);
                          }}
                        >
                          Retry Load Products
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
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
                      <PaginationControls />
                    </>
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
                
                {/* Payment Summary */}
                {(totalPaidAmount > 0 || hasPartialPayment) && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Amount Paid</span>
                        <span className="font-medium text-green-600">{totalPaidAmount.toFixed(3)} OMR</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Amount Due</span>
                        <span className="font-medium text-red-600">{totalUnpaidAmount.toFixed(3)} OMR</span>
                      </div>
                    </div>
                  </>
                )}
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
                disabled={isSubmitting || !selectedCustomer || !selectedWarehouse || totalUnpaidAmount < 0}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <div className="flex items-center justify-between w-full">
                    <span>Confirm Sale</span>
                    <span className="text-sm">
                      {totalUnpaidAmount > 0 ? `Pay ${totalUnpaidAmount.toFixed(3)} OMR` : "Fully Paid"}
                    </span>
                  </div>
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
          setTaxPercentage(0);
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
            <div className="receipt-container" style={{
              width: '280px',
              maxWidth: '280px',
              margin: '0 auto',
              padding: '8px',
              fontFamily: 'monospace',
              fontSize: '10px',
              lineHeight: '1.1',
              backgroundColor: 'white',
              minHeight: '100%'
            }}>
              <div className="receipt-header text-center mb-2" style={{ borderBottom: '1px dashed #000', paddingBottom: '6px' }}>
                <h2 style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 3px 0' }}>Dar Arab For Publication & Translation</h2>
                <p style={{ fontSize: '9px', margin: '2px 0' }}>123 Main Street, Muscat, Oman</p>
                <p style={{ fontSize: '9px', margin: '2px 0' }}>Tel: +968 1234 5678</p>
                <p style={{ fontSize: '9px', margin: '3px 0 0 0' }}>Receipt #{receiptData?.id}</p>
                <p style={{ fontSize: '9px', margin: '2px 0' }}>{receiptData?.created_at_formatted || format(new Date(), "PPP")}</p>
              </div>
              
              <div className="mb-2" style={{ fontSize: '9px' }}>
                <p style={{ margin: '2px 0' }}><strong>Customer:</strong> {receiptData?.customer_name || "Walk-in Customer"}</p>
                {receiptData?.customer_contact && (
                  <p style={{ margin: '2px 0', fontSize: '8px' }}>{receiptData.customer_contact}</p>
                )}
                <p style={{ margin: '2px 0' }}><strong>Payment:</strong> {paymentMethods.find(m => m.id === selectedPaymentMethod)?.display_name_en || "N/A"}</p>
                <p style={{ margin: '2px 0' }}><strong>Type:</strong> {invoiceTypes.find(t => t.id === selectedInvoiceType)?.display_name_en || "N/A"}</p>
                <p style={{ margin: '2px 0' }}><strong>Warehouse:</strong> {warehouses.find(w => w.id === selectedWarehouse)?.name_en || "N/A"}</p>
              </div>
              
              <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '6px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 'bold', marginBottom: '3px' }}>
                  <span>Item</span>
                  <span>Qty</span>
                  <span>Price</span>
                  <span>Total</span>
                  <span>Status</span>
                </div>
                
                {cart.map((cartItem, idx) => {
                  const itemTotal = calculateItemTotal(cartItem);
                  const isPaid = cartItem.is_paid;
                  const paidAmount = cartItem.paid_amount;
                  
                  return (
                    <div key={idx} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'flex-start',
                      fontSize: '8px',
                      marginBottom: '2px',
                      paddingBottom: '2px',
                      borderBottom: '1px dotted #ccc'
                    }}>
                      <div style={{ flex: '2', wordBreak: 'break-word', marginRight: '2px' }}>
                        {cartItem.product.title_en}
                      </div>
                      <div style={{ flex: '0.3', textAlign: 'center' }}>{cartItem.quantity}</div>
                      <div style={{ flex: '0.5', textAlign: 'right' }}>{(cartItem.product.latest_price ? parseFloat(cartItem.product.latest_price) : 0).toFixed(3)}</div>
                      <div style={{ flex: '0.5', textAlign: 'right' }}>{itemTotal.toFixed(3)}</div>
                      <div style={{ flex: '0.4', textAlign: 'right', fontSize: '7px' }}>
                        {isPaid ? (
                          <span style={{ color: '#16a34a' }}>
                            {paidAmount >= itemTotal ? "Paid" : "Partial"}
                          </span>
                        ) : (
                          <span style={{ color: '#dc2626' }}>Outstanding</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div style={{ marginTop: '6px', fontSize: '9px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span>Subtotal:</span>
                  <span>{subtotal.toFixed(3)} OMR</span>
                </div>
                {discountPercentage > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span>Discount ({discountPercentage}%):</span>
                    <span style={{ color: '#16a34a' }}>-{globalDiscountAmount.toFixed(3)} OMR</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span>Tax ({taxPercentage}%):</span>
                  <span>{tax.toFixed(3)} OMR</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '2px' }}>
                  <span>TOTAL:</span>
                  <span>{total.toFixed(3)} OMR</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span>Total Paid:</span>
                  <span style={{ color: '#16a34a' }}>{totalPaidAmount.toFixed(3)} OMR</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontWeight: 'bold' }}>
                  <span>Amount Due:</span>
                  <span style={{ color: totalUnpaidAmount > 0 ? '#dc2626' : '#16a34a' }}>{totalUnpaidAmount.toFixed(3)} OMR</span>
                </div>
                {hasPartialPayment && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '8px' }}>
                    <span style={{ color: '#ea580c' }}>Partial Payments:</span>
                    <span style={{ color: '#ea580c' }}>{cart.filter(item => item.paid_amount > 0 && item.paid_amount < calculateItemTotal(item)).length} items</span>
                  </div>
                )}
              </div>
              
              {receiptData?.notes && (
                <div style={{ marginTop: '6px', padding: '4px', border: '1px dashed #000', fontSize: '8px' }}>
                  <p style={{ margin: '0', fontWeight: 'bold' }}>Notes:</p>
                  <p style={{ margin: '2px 0 0 0' }}>{receiptData.notes}</p>
                </div>
              )}
              
              <div className="receipt-footer text-center mt-2" style={{ borderTop: '1px dashed #000', paddingTop: '4px', fontSize: '8px' }}>
                <p style={{ margin: '2px 0' }}>Thank you for your purchase!</p>
                <p style={{ margin: '2px 0', fontSize: '7px' }}>Visit us again soon</p>
              </div>
            </div>
          </div>
          <div className="shrink-0 flex flex-col gap-2 sm:flex-row sm:justify-end pt-2 border-t bg-white">
            <Button variant="outline" onClick={handlePrint} aria-label="Print" title="Print">
              <Printer className="h-5 w-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" aria-label="Download" title="Download">
                  <Download className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDownloadPDF}>
                  <FileText className="h-4 w-4 mr-2" />
                  Download as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadImage}>
                  <Image className="h-4 w-4 mr-2" />
                  Download as Image
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => setIsPrintDialogOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
}

