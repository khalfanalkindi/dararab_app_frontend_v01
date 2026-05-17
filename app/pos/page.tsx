"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ReceiptContent } from "@/components/receipt/ReceiptContent"
import { API_URL } from "@/lib/config"

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
  latest_price_omr: string | null;
  price: string | null;
  price_omr: string | null;
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
  customer_type?: number | null
}

interface CartItem {
  product: Product
  quantity: number
  discount_percent: number
  is_paid: boolean
  paid_amount: number
}

/** Replace one line so totals that depend on the whole cart (e.g. store + global discount split) stay consistent. */
function replaceCartItemForTotals(cart: CartItem[], replacement: CartItem): CartItem[] {
  return cart.map((c) => (c.product.id === replacement.product.id ? replacement : c))
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
  location: string
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

// Custom hook for cart calculations - consolidates all payment-related calculations
const useCartCalculations = (
  cart: CartItem[],
  discountPercentage: number,
  taxPercentage: number,
  calculateItemTotal: (item: CartItem) => number,
  calculateItemSubtotal: (item: CartItem) => number,
) => {
  // Calculate subtotal from all cart items (BEFORE global discount)
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + calculateItemSubtotal(item), 0);
  }, [cart, calculateItemSubtotal]);

  // Stable signature for cart + global discount so effects (e.g. payment sync) react when only global % changes
  const cartTotalSignature = useMemo(() => {
    const g = Math.max(0, Math.min(100, discountPercentage || 0));
    if (cart.length === 0) return `g:${g}`;
    const lines = cart
      .map((item) => {
        const price = item.product.price || item.product.latest_price;
        const priceValue = price ? parseFloat(price) : 0;
        return `${item.product.id}:${item.quantity}:${item.discount_percent}:${priceValue}`;
      })
      .join("|");
    return `${lines}|g:${g}`;
  }, [cart, discountPercentage]);

  // Safe discount percentage (clamped to 0-100)
  const safeDiscountPercentage = useMemo(() => {
    return Math.max(0, Math.min(100, discountPercentage || 0));
  }, [discountPercentage]);

  // Global discount amount (total discount amount)
  const globalDiscountAmount = useMemo(() => {
    return (subtotal * safeDiscountPercentage) / 100;
  }, [subtotal, safeDiscountPercentage]);

  // Subtotal after global discount: sum of per-line totals (each line applies the same global % to its subtotal for store/individual)
  const discountedSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  }, [cart, calculateItemTotal]);

  // Safe tax percentage (clamped to 0-100)
  const safeTaxPercentage = useMemo(() => {
    return Math.max(0, Math.min(100, taxPercentage || 0));
  }, [taxPercentage]);

  // Tax amount
  const tax = useMemo(() => {
    return discountedSubtotal * (safeTaxPercentage / 100);
  }, [discountedSubtotal, safeTaxPercentage]);

  // Grand total
  const total = useMemo(() => {
    return discountedSubtotal + tax;
  }, [discountedSubtotal, tax]);

  // Total paid amount from all items
  const totalPaidAmount = useMemo(() => {
    const sum = cart.reduce((sum, item) => {
      const paidAmount = isNaN(item.paid_amount) ? 0 : Math.max(0, item.paid_amount);
      return sum + paidAmount;
    }, 0);
    return Number(sum.toFixed(3));
  }, [cart]);

  // Total unpaid amount
  const totalUnpaidAmount = useMemo(() => {
    const unpaid = Math.max(0, total - totalPaidAmount);
    return Number(unpaid.toFixed(3));
  }, [total, totalPaidAmount]);

  // Filtered items
  const paidItems = useMemo(() => {
    return cart.filter(item => item.is_paid);
  }, [cart]);

  const unpaidItems = useMemo(() => {
    return cart.filter(item => !item.is_paid);
  }, [cart]);

  // Check if any items have partial payments
  // Uses tolerance check to handle floating point precision issues
  const hasPartialPayment = useMemo(() => {
    return cart.some((item) => {
      const target = calculateItemTotal(item)
      const paidAmount = item.paid_amount
      const difference = Math.abs(paidAmount - target)
      return paidAmount > 0.001 && difference >= 0.001 && paidAmount < target
    })
  }, [cart, calculateItemTotal])

  return {
    subtotal,
    cartTotalSignature,
    safeDiscountPercentage,
    globalDiscountAmount,
    discountedSubtotal,
    safeTaxPercentage,
    tax,
    total,
    totalPaidAmount,
    totalUnpaidAmount,
    paidItems,
    unpaidItems,
    hasPartialPayment,
  };
};

// Constants
const FETCH_TIMEOUT = 30000; // 30 seconds timeout for fetch requests

// Standardized error handling utility
const handleError = (
  error: unknown,
  defaultMessage: string,
  options?: {
    title?: string;
    duration?: number;
    onError?: (error: Error) => void;
  }
) => {
  // Ignore abort errors silently
  if (error instanceof Error && error.name === 'AbortError') {
    return;
  }

  // Log error in development
  if (process.env.NODE_ENV !== 'production') {
    console.error("Error:", error);
  }

  // Extract error message
  let errorMessage = defaultMessage;
  if (error instanceof Error) {
    errorMessage = error.message || defaultMessage;
  }

  // Call custom error handler if provided
  if (options?.onError && error instanceof Error) {
    options.onError(error);
  }

  // Show toast notification
  toast({
    title: options?.title || "Error",
    description: errorMessage,
    variant: "destructive",
    duration: options?.duration || 5000,
  });
};

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [genres, setGenres] = useState<Genre[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [invoiceTypes, setInvoiceTypes] = useState<InvoiceType[]>([])
  const [searchInput, setSearchInput] = useState("")
  const [debouncedSearchInput, setDebouncedSearchInput] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<number | null>(null)
  
  // Ref to prevent infinite loops when allocating payments
  const isAllocatingRef = useRef(false)
  // Ref to prevent infinite loops when syncing payment status
  const syncingRef = useRef(false)
  // Ref to store the latest allocatePayInFull function
  const allocatePayInFullRef = useRef<(() => void) | undefined>(undefined)
  /** Product ids where the user edited "Paid amount" — auto-reconcile skips these lines (paid is clamped to line total). */
  const manualPaidAmountLineIdsRef = useRef<Set<number>>(new Set())
  const [selectedInvoiceType, setSelectedInvoiceType] = useState<number | null>(null)
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)
  const [customerSearchQuery, setCustomerSearchQuery] = useState("")
  const [debouncedCustomerSearchQuery, setDebouncedCustomerSearchQuery] = useState("")
  const [newCustomer, setNewCustomer] = useState<Omit<Customer, "id">>({
    customer_type: null,
    institution_name: "",
    contact_person: "",
    phone: "",
    email: "",
  })
  const [customerTypes, setCustomerTypes] = useState<any[]>([])
  // Consolidated dialog state - only one dialog can be open at a time
  type DialogType = "newCustomer" | "print" | null
  const [activeDialog, setActiveDialog] = useState<DialogType>(null)
  /** Separate from activeDialog so closing confirm after sale does not overwrite `print` via onOpenChange. */
  const [confirmSaleOpen, setConfirmSaleOpen] = useState(false)
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null)
  const [isGenreDropdownOpen, setIsGenreDropdownOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAddingCustomer, setIsAddingCustomer] = useState(false)
  const [processingItems, setProcessingItems] = useState<Set<number>>(new Set())
  const [discountPercentage, setDiscountPercentage] = useState<number>(30)
  const [taxPercentage, setTaxPercentage] = useState<number>(0)
  const [invoiceNotes, setInvoiceNotes] = useState("")
  const [todaySales, setTodaySales] = useState(0)
  const [totalCustomers, setTotalCustomers] = useState(0)
  const [popularProduct, setPopularProduct] = useState("")
  const [showMetrics, setShowMetrics] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  // AbortController refs for request cancellation
  const abortControllerRef = useRef<AbortController | null>(null)
  const salesMetricsAbortControllerRef = useRef<AbortController | null>(null)
  // Track last fetch parameters to prevent unnecessary refetches
  const lastFetchParamsRef = useRef<{
    warehouseId: number | null;
    search: string;
    genreId: number | null;
    page: number;
  }>({
    warehouseId: null,
    search: '',
    genreId: null,
    page: 1,
  })
  const [receiptData, setReceiptData] = useState<any>(null)
  const [isWarehouseDropdownOpen, setIsWarehouseDropdownOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50) // Increased default page size for better UX
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0) // Total count from server

  // Add error handling for avatar image
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    target.src = "/placeholder.svg";
  };

  // Exponential backoff retry utility
  const fetchWithRetry = useCallback(async (
    url: string,
    options: RequestInit = {},
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<Response> => {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Check if request was aborted
        if (options.signal?.aborted) {
          throw new DOMException('The operation was aborted.', 'AbortError')
        }
        
        const response = await fetch(url, options)
        
        // Don't retry on successful responses
        if (response.ok) {
          return response
        }
        
        // Don't retry on 4xx client errors (except 429 Too Many Requests)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return response // Return the error response without retrying
        }
        
        // For 5xx server errors or 429, throw to trigger retry
        if (response.status >= 500 || response.status === 429) {
          throw new Error(`Server error: ${response.status} ${response.statusText}`)
        }
        
        // For other errors, return the response
        return response
      } catch (error) {
        lastError = error as Error
        
        // Don't retry on AbortError
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error
        }
        
        // Don't retry if this was the last attempt
        if (attempt === maxRetries) {
          break
        }
        
        // Calculate exponential backoff delay: baseDelay * 2^attempt
        const delay = baseDelay * Math.pow(2, attempt)
        
        // Wait before retrying (respect abort signal)
        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(resolve, delay)
          
          // If aborted during wait, clear timeout and reject
          if (options.signal) {
            options.signal.addEventListener('abort', () => {
              clearTimeout(timeoutId)
              reject(new DOMException('The operation was aborted.', 'AbortError'))
            })
          }
        })
      }
    }
    
    // If we get here, all retries failed
    throw lastError || new Error('Request failed after retries')
  }, [])

  // Update the fetchData function - only fetch basic data, not products
  const fetchData = async () => {
    // Abort previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Create new AbortController for this request
    const controller = new AbortController()
    abortControllerRef.current = controller

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
        invoiceTypesRes,
        customerTypesRes
      ] = await Promise.all([
        fetchWithRetry(`${API_URL}/sales/customers/`, { headers, signal: controller.signal }),
        fetchWithRetry(`${API_URL}/common/list-items/genre/`, { headers, signal: controller.signal }),
        fetchWithRetry(`${API_URL}/inventory/warehouses/`, { headers, signal: controller.signal }),
        fetchWithRetry(`${API_URL}/common/list-items/payment_method/`, { headers, signal: controller.signal }),
        fetchWithRetry(`${API_URL}/common/list-items/invoice_type/`, { headers, signal: controller.signal }),
        fetchWithRetry(`${API_URL}/common/list-items/customer_type/`, { headers, signal: controller.signal })
      ]);

      if (!customersRes.ok) throw new Error("Failed to fetch customers");
      if (!genresRes.ok) throw new Error("Failed to fetch genres");
      if (!warehousesRes.ok) throw new Error("Failed to fetch warehouses");
      if (!paymentMethodsRes.ok) throw new Error("Failed to fetch payment methods");
      if (!invoiceTypesRes.ok) throw new Error("Failed to fetch invoice types");
      if (!customerTypesRes.ok) throw new Error("Failed to fetch customer types");

      const customersData = await customersRes.json();
      const genresData = await genresRes.json();
      const warehousesData = await warehousesRes.json();
      const paymentMethodsData = await paymentMethodsRes.json();
      const invoiceTypesData = await invoiceTypesRes.json();
      const customerTypesData = await customerTypesRes.json();

      // Process other data
      const customersArray = Array.isArray(customersData) ? customersData : customersData.results || [];
      const genresArray = Array.isArray(genresData) ? genresData : genresData.results || [];
      const warehousesArray = Array.isArray(warehousesData) ? warehousesData : warehousesData.results || [];
      const paymentMethodsArray = Array.isArray(paymentMethodsData) ? paymentMethodsData : paymentMethodsData.results || [];
      const invoiceTypesArray = Array.isArray(invoiceTypesData) ? invoiceTypesData : invoiceTypesData.results || [];
      const customerTypesArray = Array.isArray(customerTypesData) ? customerTypesData : customerTypesData.results || [];

      // Set state with fetched data
      setCustomers(customersArray);
      setGenres(genresArray);
      setWarehouses(warehousesArray);
      setPaymentMethods(paymentMethodsArray);
      setInvoiceTypes(invoiceTypesArray);
      setCustomerTypes(customerTypesArray);

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
      handleError(error, "Failed to load data. Please try again.");
    }
  };

  // Fetch initial data - only fetch basic data, not products
  useEffect(() => {
    fetchData()
    fetchSalesMetrics()
    
    // Cleanup: abort all pending requests on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (salesMetricsAbortControllerRef.current) {
        salesMetricsAbortControllerRef.current.abort()
      }
    }
  }, [])

  // Debounce search input to reduce filter operations while typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchInput(searchInput);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Debounce customer search query to reduce filter operations while typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCustomerSearchQuery(customerSearchQuery);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [customerSearchQuery]);

  // Server-side filtering: refetch products when search, genre, or warehouse changes
  useEffect(() => {
    if (selectedWarehouse) {
      // Reset to page 1 when filters change
      setCurrentPage(1);
      fetchProducts(
        selectedWarehouse,
        debouncedSearchInput,
        selectedGenre?.id || null,
        1, // Always start at page 1 when filters change
        0  // retryCount
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchInput, selectedGenre, selectedWarehouse]);

  // Server-side pagination: refetch products when page or pageSize changes
  useEffect(() => {
    if (selectedWarehouse && currentPage > 0) {
      fetchProducts(
        selectedWarehouse,
        debouncedSearchInput,
        selectedGenre?.id || null,
        currentPage,
        0  // retryCount
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize]); // Only trigger on page/pageSize changes, use current filter values from closure

  // Filter customers based on search query - memoized to prevent recalculation on every render
  // Uses debounced query to reduce filtering operations while typing
  const filteredCustomers = useMemo(() => {
    return customers.filter(
      (customer) =>
        customer.institution_name.toLowerCase().includes(debouncedCustomerSearchQuery.toLowerCase()) ||
        customer.contact_person?.toLowerCase().includes(debouncedCustomerSearchQuery.toLowerCase()) ||
        customer.phone?.includes(debouncedCustomerSearchQuery) ||
        customer.email?.toLowerCase().includes(debouncedCustomerSearchQuery.toLowerCase()),
    );
  }, [customers, debouncedCustomerSearchQuery]);

  const isStoreCustomer = useMemo(() => {
    if (!selectedCustomer?.customer_type) return false
    const customerType = customerTypes.find((ct) => ct.id === selectedCustomer.customer_type)
    return customerType?.value === "store"
  }, [selectedCustomer, customerTypes])

  // Line-level discount only applies to store customers; clear when not store (e.g. individual).
  useEffect(() => {
    if (isStoreCustomer) return
    setCart((prev) => {
      if (prev.length === 0) return prev
      if (!prev.some((i) => i.discount_percent !== 0)) return prev
      return prev.map((i) => ({ ...i, discount_percent: 0 }))
    })
  }, [isStoreCustomer])

  // Cart functions
  const addToCart = (product: Product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.product.id === product.id);
      if (existingItem) {
        // increment quantity FIRST, then allocate later
        // Use updateCartItem pattern for consistency
        return prevCart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      // New line item: for Individual customers, mark as paid immediately
      // Otherwise, starts unpaid; allocation is handled centrally
      const newItem = {
        product,
        quantity: 1,
        discount_percent: 0,
        is_paid: isIndividualCustomer, // Auto-paid for Individual customers
        paid_amount: 0, // Will be calculated by the Individual customer effect
      };
      return [...prevCart, newItem];
    });

    // If current payment method is cash-like, auto-allocate to GRAND TOTAL
    // (slight timeout lets React commit state before we read totals)
    // Skip for Individual customers (handled by separate effect)
    setTimeout(() => {
      if (isIndividualCustomer) return;
      // Store (cash or outstanding) and non-individual cash: reconcile line paid amounts to match payment method
      allocatePayInFullRef.current?.();
    }, 0);
  }

  const removeFromCart = (productId: number) => {
    manualPaidAmountLineIdsRef.current.delete(productId)
    setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId))
  }

  // ---------------------------------------------------------------------------
  // Payment & discount rules (line totals use calculateItemSubtotal / calculateItemTotal):
  // STORE — cash or outstanding: item discount only on that line; global discount same % on every line's
  //         post–item-discount subtotal (e.g. 50% global → each line × 0.5). Outstanding: lines default
  //         unpaid (paid 0); cash: lines default fully paid at line total. Partial only if user edits Paid amount.
  // INDIVIDUAL — cash only: no line item discount; same global % on each line's list amount (e.g. 50% → $10→$5, $20→$10).
  //         Invoice API stores discount on lines only (global_discount_percent: 0) to avoid double discount.
  // ---------------------------------------------------------------------------

  const getLineGross = useCallback((item: CartItem) => {
    const price = item.product.price || item.product.latest_price;
    const priceValue = price ? parseFloat(price) : 0;
    return priceValue * item.quantity;
  }, []);

  const appliesGlobalDiscountPerLine = useMemo(() => {
    if (!discountPercentage || !selectedCustomer?.customer_type) return false;
    const customerType = customerTypes.find((ct) => ct.id === selectedCustomer.customer_type)?.value;
    return customerType === "store" || customerType === "individual";
  }, [discountPercentage, selectedCustomer, customerTypes]);

  // Update the calculateItemTotal function to handle the new price format
  // Memoized with useCallback to prevent recreation on every render
  // Calculate item total before global discount (with item-level discount only)
  const calculateItemSubtotal = useCallback((item: CartItem) => {
    const price = item.product.price || item.product.latest_price;
    const priceValue = price ? parseFloat(price) : 0;
    const quantity = item.quantity;
    // Per-line discount applies only for store customers; global invoice discount is handled in calculateItemTotal.
    const lineDiscountPercent = isStoreCustomer ? item.discount_percent : 0;
    const discount = Math.max(0, Math.min(100, lineDiscountPercent)) / 100;
    const total = priceValue * quantity * (1 - discount);
    return isNaN(total) ? 0 : Math.max(0, total); // Prevent NaN and negative values
  }, [isStoreCustomer]);

  // Calculate item total: after line subtotal, store & individual apply the same invoice global % to each line.
  const calculateItemTotal = useCallback((item: CartItem, currentCart?: CartItem[]) => {
    const itemSubtotal = calculateItemSubtotal(item);
    const cartToUse = currentCart ?? cart;

    if (!discountPercentage || cartToUse.length === 0) {
      return isNaN(itemSubtotal) ? 0 : Math.max(0, Number(itemSubtotal.toFixed(3)));
    }

    const customerTypeValue = selectedCustomer?.customer_type
      ? customerTypes.find((ct) => ct.id === selectedCustomer.customer_type)?.value
      : null;

    const appliesGlobalPerLine = customerTypeValue === "store" || customerTypeValue === "individual";
    if (!appliesGlobalPerLine) {
      return isNaN(itemSubtotal) ? 0 : Math.max(0, Number(itemSubtotal.toFixed(3)));
    }

    const safeGlobalFraction = Math.max(0, Math.min(100, discountPercentage)) / 100;
    const itemTotal = itemSubtotal * (1 - safeGlobalFraction);
    return isNaN(itemTotal) ? 0 : Math.max(0, Number(itemTotal.toFixed(3)));
  }, [cart, discountPercentage, calculateItemSubtotal, selectedCustomer, customerTypes]);

  const getEffectiveLineDiscountPercent = useCallback(
    (item: CartItem, cartOverride?: CartItem[]) => {
      const gross = getLineGross(item);
      if (gross <= 1e-9) return 0;
      const net = calculateItemTotal(item, cartOverride ?? cart);
      return Math.max(0, Math.min(100, Number((100 * (1 - net / gross)).toFixed(3))));
    },
    [getLineGross, calculateItemTotal, cart],
  );

  const getLinePaymentTargetTotal = useCallback(
    (item: CartItem, cartOverride?: CartItem[]) => calculateItemTotal(item, cartOverride ?? cart),
    [cart, calculateItemTotal],
  )

  // Use the custom hook for all cart calculations
  const {
    subtotal,
    cartTotalSignature,
    globalDiscountAmount,
    discountedSubtotal,
    tax,
    total,
    totalPaidAmount,
    totalUnpaidAmount,
    paidItems,
    unpaidItems,
    hasPartialPayment,
  } = useCartCalculations(cart, discountPercentage, taxPercentage, calculateItemTotal, calculateItemSubtotal);


  // Helper function to update a cart item, reducing repetition
  // FIXED: Passes current cart to updater to avoid stale closures
  const updateCartItem = useCallback((productId: number, updater: (item: CartItem, currentCart: CartItem[]) => CartItem) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product.id === productId) {
          return updater(item, prevCart);
        }
        return item;
      })
    );
  }, []);

  /** How much to set paid_amount after qty/discount change when the user did not manually set a partial paid amount. */
  const resolveNextPaidAmount = (
    productId: number,
    item: CartItem,
    currentCart: CartItem[],
    mergedCart: CartItem[],
    updatedItem: CartItem,
  ): number => {
    const newTarget = getLinePaymentTargetTotal(updatedItem, mergedCart);
    const oldTarget = getLinePaymentTargetTotal(item, currentCart);
    const pm = paymentMethods.find((m) => m.id === selectedPaymentMethod)?.display_name_en.toLowerCase() || "";
    const isCash = pm.includes("cash");
    const isOutstanding = pm.includes("outstanding");

    if (manualPaidAmountLineIdsRef.current.has(productId)) {
      return Math.min(Math.max(0, item.paid_amount), newTarget);
    }
    if (isStoreCustomer && isOutstanding) {
      return 0;
    }
    if (isCash && !isOutstanding) {
      const wasFullyPaid = Math.abs(item.paid_amount - oldTarget) < 0.001;
      if (wasFullyPaid) return newTarget;
      return item.paid_amount;
    }
    if (isOutstanding) {
      return 0;
    }
    const wasFullyPaid = Math.abs(item.paid_amount - oldTarget) < 0.001;
    return wasFullyPaid ? newTarget : item.paid_amount;
  };

  const updateQuantity = (productId: number, newQuantity: number) => {
    const q = Math.floor(Number(newQuantity))
    if (!Number.isFinite(q) || q < 1) {
      removeFromCart(productId)
      return
    }
    updateCartItem(productId, (item, currentCart) => {
      const updatedItem = { ...item, quantity: q };
      const mergedCart = replaceCartItemForTotals(currentCart, updatedItem);
      const newItemPaymentTarget = getLinePaymentTargetTotal(updatedItem, mergedCart);

      const nextPaid = resolveNextPaidAmount(productId, item, currentCart, mergedCart, updatedItem);

      const updatedWithPayment = {
        ...updatedItem,
        paid_amount: Number(nextPaid.toFixed(3)),
      };

      return syncItemPaymentStatus(updatedWithPayment, newItemPaymentTarget);
    });
  }

  const handleQuantityInputChange = (productId: number, rawValue: string) => {
    const parsedQuantity = parseInt(rawValue, 10);
    if (isNaN(parsedQuantity)) return;
    updateQuantity(productId, parsedQuantity);
  }

  const updateItemDiscount = (productId: number, discountPercent: number) => {
    if (!isStoreCustomer) return
    updateCartItem(productId, (item, currentCart) => {
      const updatedItem = { ...item, discount_percent: discountPercent };
      const mergedCart = replaceCartItemForTotals(currentCart, updatedItem);
      const newItemPaymentTarget = getLinePaymentTargetTotal(updatedItem, mergedCart);

      const nextPaid = resolveNextPaidAmount(productId, item, currentCart, mergedCart, updatedItem);

      const updatedWithPayment = {
        ...updatedItem,
        paid_amount: Number(nextPaid.toFixed(3)),
      };

      return syncItemPaymentStatus(updatedWithPayment, newItemPaymentTarget);
    });
  }

  const updateItemPaymentStatus = (productId: number, isPaid: boolean) => {
    manualPaidAmountLineIdsRef.current.delete(productId)
    updateCartItem(productId, (item, currentCart) => {
      const paymentTarget = getLinePaymentTargetTotal(item, currentCart);
      return {
        ...item,
        is_paid: isPaid,
        paid_amount: isPaid ? paymentTarget : 0
      };
    });
  }

  const updateItemPaidAmount = (productId: number, paidAmount: number) => {
    updateCartItem(productId, (item, currentCart) => {
      const paymentTarget = getLinePaymentTargetTotal(item, currentCart);
      const validPaidAmount = Math.min(Math.max(0, paidAmount), paymentTarget);
      const tol = 0.001;
      if (validPaidAmount > tol && validPaidAmount < paymentTarget - tol) {
        manualPaidAmountLineIdsRef.current.add(productId);
      } else {
        manualPaidAmountLineIdsRef.current.delete(productId);
      }
      const updatedItem = {
        ...item,
        paid_amount: validPaidAmount
      };
      return syncItemPaymentStatus(updatedItem, paymentTarget);
    });
  }

  // Check if selected warehouse is in Muscat (for OMR price display)
  const isMuscatWarehouse = useMemo(() => {
    if (!selectedWarehouse) return false;
    const warehouse = warehouses.find(w => w.id === selectedWarehouse);
    return warehouse?.location === 'Muscat';
  }, [selectedWarehouse, warehouses]);

  // Helper function to get display price (OMR for Muscat, $ otherwise)
  const getDisplayPrice = useCallback((product: Product | { price?: string | null; price_omr?: string | null; latest_price?: string | null; latest_price_omr?: string | null }): string | null => {
    if (isMuscatWarehouse) {
      return product.price_omr || product.latest_price_omr || null;
    }
    return product.price || product.latest_price || null;
  }, [isMuscatWarehouse]);

  // Helper function to get currency symbol/label
  const getCurrencyLabel = useCallback((): string => {
    return isMuscatWarehouse ? 'OMR' : '$';
  }, [isMuscatWarehouse]);

  // Allocate payments for cash transactions - items should be fully paid at their individual totals
  // Check if selected customer is Individual type (using value "individual" instead of ID)
  const isIndividualCustomer = useMemo(() => {
    if (!selectedCustomer?.customer_type) return false;
    const customerType = customerTypes.find(ct => ct.id === selectedCustomer.customer_type);
    return customerType?.value === 'individual';
  }, [selectedCustomer, customerTypes]);

  // Auto-set Cash payment method for Individual customers
  useEffect(() => {
    if (isIndividualCustomer && paymentMethods.length > 0) {
      const cashMethod = paymentMethods.find(m => 
        m.display_name_en.toLowerCase().includes('cash')
      );
      if (cashMethod && selectedPaymentMethod !== cashMethod.id) {
        setSelectedPaymentMethod(cashMethod.id);
      }
    }
  }, [isIndividualCustomer, paymentMethods, selectedPaymentMethod]);

  // Auto-apply payment to all items for Individual customers
  useEffect(() => {
    // Prevent re-entrancy to avoid infinite loops
    if (isAllocatingRef.current) return;
    
    if (isIndividualCustomer && cart.length > 0 && selectedPaymentMethod) {
      const paymentMethod = paymentMethods.find(m => m.id === selectedPaymentMethod);
      if (paymentMethod && !paymentMethod.display_name_en.toLowerCase().includes('outstanding')) {
        isAllocatingRef.current = true;
        
        try {
          // Auto-mark all items as paid for Individual customers with Cash payment
          // Only update if items are not already fully paid to prevent loops
          // Use functional update and calculateItemTotal inside to avoid dependency on it
          setCart(prevCart => {
            const updatedCart = prevCart.map(item => {
              const paymentTarget = calculateItemTotal(item, prevCart);
              const pid = item.product.id;
              if (manualPaidAmountLineIdsRef.current.has(pid)) {
                const p = Math.min(Math.max(0, item.paid_amount), paymentTarget);
                const clamped = Number(p.toFixed(3));
                return syncItemPaymentStatus({ ...item, paid_amount: clamped }, paymentTarget);
              }
              if (item.is_paid && Math.abs(item.paid_amount - paymentTarget) < 0.001) {
                return item;
              }
              return {
                ...item,
                is_paid: true,
                paid_amount: Number(paymentTarget.toFixed(3))
              };
            });
            // Only update state if something changed
            const hasChanges = updatedCart.some((item, index) => {
              const prevItem = prevCart[index];
              return !prevItem || 
                item.is_paid !== prevItem.is_paid || 
                Math.abs(item.paid_amount - prevItem.paid_amount) >= 0.001;
            });
            return hasChanges ? updatedCart : prevCart;
          });
        } finally {
          // Reset the flag after a short delay to allow state updates to complete
          setTimeout(() => {
            isAllocatingRef.current = false;
          }, 0);
        }
      }
    }
    // Note: calculateItemTotal is NOT in dependencies - we use it inside the functional update
    // This prevents infinite loops when cart changes
  }, [isIndividualCustomer, selectedPaymentMethod, cart.length, discountPercentage, cartTotalSignature]); // Re-run when global % or line amounts change

  // Validation function for payment amounts
  const validatePaymentAmounts = () => {
    for (const item of cart) {
      const target = getLinePaymentTargetTotal(item);
      if (item.paid_amount > target + 0.0001) {
        return false;
      }
    }
    return true;
  }

  // Helper function to get payment status badge
  // Uses tolerance check to handle floating point precision issues
  const getPaymentStatusBadge = (item: CartItem) => {
    const target = getLinePaymentTargetTotal(item);
    const paidAmount = item.paid_amount;
    const difference = Math.abs(paidAmount - target);
    const isFullyPaid = difference < 0.001 || paidAmount >= target;
    const isPartiallyPaid = paidAmount > 0.001 && !isFullyPaid;
    
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
    const target = getLinePaymentTargetTotal(item);
    return Math.abs(item.paid_amount - target) < 0.001;
  }

  // Helper function to sync payment status based on paid_amount vs itemTotal
  // This ensures is_paid flag matches the actual payment status
  const syncItemPaymentStatus = useCallback((item: CartItem, itemTotal: number): CartItem => {
    const paidAmount = item.paid_amount;
    const difference = Math.abs(paidAmount - itemTotal);
    const isFullyPaid = difference < 0.001 || paidAmount >= itemTotal;
    const isPartiallyPaid = paidAmount > 0.001 && !isFullyPaid;
    
    // Update is_paid flag to match actual payment status
    // is_paid should be true if fully paid OR partially paid (has some payment)
    const newIsPaid = isFullyPaid || isPartiallyPaid;
    
    // Only update if status changed to avoid unnecessary re-renders
    if (item.is_paid !== newIsPaid) {
      return {
        ...item,
        is_paid: newIsPaid
      };
    }
    return item;
  }, [])

  // Reconcile line paid_amount / is_paid with payment method (store cash vs outstanding, other cash, etc.).
  // Lines the user edited in "Paid amount" (manual partial) are only clamped, not reset to defaults.
  const allocatePayInFull = useCallback(() => {
    if (isAllocatingRef.current) return;
    isAllocatingRef.current = true;

    try {
      setCart((prevCart) => {
        if (prevCart.length === 0) return prevCart;

        const pm =
          paymentMethods.find((m) => m.id === selectedPaymentMethod)?.display_name_en.toLowerCase() || "";
        const isCash = pm.includes("cash");
        const isOutstanding = pm.includes("outstanding");

        const nextCart = prevCart.map((it) => {
          const target = Number(calculateItemTotal(it, prevCart).toFixed(3));
          const pid = it.product.id;

          if (manualPaidAmountLineIdsRef.current.has(pid)) {
            const p = Math.min(Math.max(0, it.paid_amount), target);
            return syncItemPaymentStatus({ ...it, paid_amount: Number(p.toFixed(3)) }, target);
          }

          if (isStoreCustomer && isOutstanding) {
            return { ...it, is_paid: false, paid_amount: 0 };
          }
          if (isCash && !isOutstanding) {
            return { ...it, is_paid: true, paid_amount: target };
          }
          if (isOutstanding) {
            return { ...it, is_paid: false, paid_amount: 0 };
          }
          return { ...it, is_paid: true, paid_amount: target };
        });

        const changed = nextCart.some((n, i) => {
          const prevItem = prevCart[i];
          if (!prevItem) return true;
          const paidAmountChanged = Math.abs(n.paid_amount - prevItem.paid_amount) > 0.001;
          const paidStatusChanged = n.is_paid !== prevItem.is_paid;
          return paidAmountChanged || paidStatusChanged;
        });
        return changed ? nextCart : prevCart;
      });
    } finally {
      setTimeout(() => {
        isAllocatingRef.current = false;
      }, 0);
    }
  }, [calculateItemTotal, selectedPaymentMethod, paymentMethods, isStoreCustomer, syncItemPaymentStatus]);

  useEffect(() => {
    allocatePayInFullRef.current = allocatePayInFull;
  }, [allocatePayInFull]);

  useEffect(() => {
    if (selectedPaymentMethod == null) return;
    manualPaidAmountLineIdsRef.current.clear();
    const t = setTimeout(() => allocatePayInFullRef.current?.(), 0);
    return () => clearTimeout(t);
  }, [selectedPaymentMethod]);

  // Function to apply payment method to existing items
  const applyPaymentMethodToExistingItems = () => {
    if (!selectedPaymentMethod || cart.length === 0) return;
    
    const paymentMethod = paymentMethods.find(m => m.id === selectedPaymentMethod);
    if (!paymentMethod) return;
    
    const isOutstanding = paymentMethod.display_name_en.toLowerCase().includes('outstanding');
    
    manualPaidAmountLineIdsRef.current.clear()
    setCart(prevCart => prevCart.map(item => {
      const target = calculateItemTotal(item, prevCart);
      return {
        ...item,
        is_paid: !isOutstanding,
        paid_amount: !isOutstanding ? target : 0
      };
    }));
  }

  // Handle adding a new customer
  const handleAddCustomer = async () => {
    // Create AbortController for this request
    const controller = new AbortController()
    
    try {
      setIsAddingCustomer(true)
      const token = localStorage.getItem("accessToken")
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }

      const response = await fetchWithRetry(`${API_URL}/sales/customers/`, {
        method: "POST",
        headers,
        body: JSON.stringify(newCustomer),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to create customer")
      }

      const customer = await response.json()
      setCustomers([...customers, customer])
      setSelectedCustomer(customer)
      setNewCustomer({
        customer_type: null,
        institution_name: "",
        contact_person: "",
        phone: "",
        email: "",
      })
      setActiveDialog(null)
      toast({
        title: "Success",
        description: "Customer added successfully",
      })
    } catch (error) {
      handleError(error, "Failed to add customer. Please try again.");
    } finally {
      setIsAddingCustomer(false)
    }
  }

  // Rollback helper function to delete created invoice items and invoice on error
  const rollbackSaleCreation = async (
    invoiceId: number,
    invoiceItemIds: number[],
    headers: HeadersInit,
    signal?: AbortSignal
  ) => {
    const rollbackErrors: string[] = []
    
    // Delete invoice items in reverse order (best effort)
    for (const itemId of [...invoiceItemIds].reverse()) {
      try {
        const deleteResponse = await fetch(`${API_URL}/sales/invoice-items/${itemId}/delete/`, {
          method: "DELETE",
          headers,
          signal,
        })
        if (!deleteResponse.ok) {
          rollbackErrors.push(`Failed to delete invoice item ${itemId}`)
        }
      } catch (error) {
        rollbackErrors.push(`Error deleting invoice item ${itemId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    
    // Delete invoice (best effort)
    try {
      const deleteInvoiceResponse = await fetch(`${API_URL}/sales/invoices/${invoiceId}/delete/`, {
        method: "DELETE",
        headers,
        signal,
      })
      if (!deleteInvoiceResponse.ok) {
        rollbackErrors.push(`Failed to delete invoice ${invoiceId}`)
      }
    } catch (error) {
      rollbackErrors.push(`Error deleting invoice ${invoiceId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
    
    if (rollbackErrors.length > 0 && process.env.NODE_ENV !== 'production') {
      console.error("Rollback errors:", rollbackErrors)
    }
    
    return rollbackErrors
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
      handleError(
        new Error("Missing required information"),
        "Please select customer, warehouse, payment method, and invoice type before completing the sale.",
        { title: "Missing Information" }
      );
      return
    }

    if (!validatePaymentAmounts()) {
      handleError(
        new Error("Invalid payment amounts"),
        "One or more items have payment amounts exceeding their total cost.",
        { title: "Invalid Payment Amounts" }
      );
      return
    }

    // Create AbortController for this sale operation
    const controller = new AbortController()

    // Declare variables at function scope for error handling
    let invoiceId: number | undefined
    let createdInvoiceItemIds: number[] = []
    let createdPaymentId: number | null = null
    let headers: HeadersInit | undefined

    try {
      setIsSubmitting(true)
      const token = localStorage.getItem("accessToken")
      headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }

      // Round to 3 decimal places to match display
      const roundedTotal = Number(total.toFixed(3));
      // Use memoized totalPaidAmount (already calculated and rounded)
      const finalPaidAmount = Number(totalPaidAmount.toFixed(3));

      // 1. Create the invoice with updated field names
      const invoiceData = {
        customer_id: selectedCustomer.id,
        warehouse_id: selectedWarehouse,
        invoice_type_id: selectedInvoiceType,
        payment_method_id: selectedPaymentMethod,
        is_returnable: true,
        notes: invoiceNotes,
        global_discount_percent: appliesGlobalDiscountPerLine ? 0 : discountPercentage,
        tax_percent: taxPercentage,
        total_amount: roundedTotal, // Grand total after global discount and tax
        total_paid: finalPaidAmount, // Sum of individual item paid amounts (from memoized totalPaidAmount)
        remaining_amount: 0, // When fully paid, remaining is 0
      }

      const invoiceResponse = await fetchWithRetry(`${API_URL}/sales/invoices/`, {
        method: "POST",
        headers,
        body: JSON.stringify(invoiceData),
        signal: controller.signal,
      })

      if (!invoiceResponse.ok) {
        const errorData = await invoiceResponse.json()
        if (process.env.NODE_ENV !== 'production') {
          console.error("Invoice creation error:", errorData)
        }
        throw new Error(errorData.message || errorData.detail || "Failed to create invoice")
      }

      const invoice = await invoiceResponse.json()
      invoiceId = invoice.id

      // 2. Create invoice items with payment status (sequentially to ensure order)
      // Track created items with IDs for potential rollback
      createdInvoiceItemIds = []
      
      // Track processing items for UI feedback
      setProcessingItems(new Set(cart.map(item => item.product.id)))
      
      // Effective line discount % vs list gross (unit_price × qty) so API discount_percent matches total_price (line + global % on line)
      for (const item of cart) {
        const itemTotal = calculateItemTotal(item, cart);
        const unitPrice = (() => {
          const price = item.product.price || item.product.latest_price;
          return price ? parseFloat(price) : 0;
        })();
        const gross = unitPrice * item.quantity;
        let effectiveDiscountPercent = item.discount_percent;
        if (gross > 1e-9) {
          effectiveDiscountPercent = getEffectiveLineDiscountPercent(item, cart);
        }
        
        const itemData = {
          invoice: invoiceId,
          product: item.product.id,
          quantity: item.quantity,
          unit_price: (() => {
            const price = item.product.price || item.product.latest_price;
            return price ? parseFloat(price) : 0;
          })(),
          discount_percent: effectiveDiscountPercent,
          total_price: itemTotal,
          paid_amount: item.paid_amount,
          remaining_amount: itemTotal - item.paid_amount,
          is_paid: item.is_paid,
        }

        const itemResponse = await fetchWithRetry(`${API_URL}/sales/invoice-items/`, {
          method: "POST",
          headers,
          body: JSON.stringify(itemData),
          signal: controller.signal,
        })

        if (!itemResponse.ok) {
          const errorData = await itemResponse.json()
          if (process.env.NODE_ENV !== 'production') {
            console.error("Invoice item creation error:", errorData)
          }
          throw new Error(errorData.message || errorData.detail || "Failed to create invoice item")
        }

        const createdItem = await itemResponse.json()
        createdInvoiceItemIds.push(createdItem.id)
        
        // Update processing state: remove this item from processing set
        setProcessingItems(prev => {
          const next = new Set(prev)
          next.delete(item.product.id)
          return next
        })
      }

      // 3. Batch fetch all inventory records in parallel
      // Update processing state to show inventory fetching
      setProcessingItems(new Set(cart.map(item => item.product.id)))
      const inventoryFetchPromises = cart.map(item =>
        fetchWithRetry(`${API_URL}/inventory/inventory/?product_id=${item.product.id}&warehouse_id=${selectedWarehouse}`, { 
          headers,
          signal: controller.signal,
        })
          .then(res => {
            if (!res.ok) {
              throw new Error(`Failed to fetch inventory for product ${item.product.id}`)
            }
            return res.json()
          })
          .then(data => ({
            productId: item.product.id,
            productName: item.product.title_en,
            quantity: item.quantity,
            inventory: data.results?.[0] || null
          }))
      )

      const inventoryResults = await Promise.allSettled(inventoryFetchPromises)
      
      // Check for any fetch failures
      const fetchErrors = inventoryResults
        .map((result, index) => ({ result, index }))
        .filter(({ result }) => result.status === 'rejected')
      
      if (fetchErrors.length > 0) {
        const errorMessages = fetchErrors.map(({ result, index }) => {
          const productName = cart[index]?.product?.title_en || `Product ${cart[index]?.product?.id}`
          const reason = result.status === 'rejected' ? result.reason : null
          return `${productName}: ${reason instanceof Error ? reason.message : 'Failed to fetch inventory'}`
        }).join('; ')
        throw new Error(`Failed to fetch inventory data: ${errorMessages}`)
      }

      // Extract inventory data and validate quantities
      const inventoryUpdates = []
      const validationErrors = []

      for (const result of inventoryResults) {
        if (result.status === 'fulfilled') {
          const { productId, productName, quantity, inventory } = result.value
          
          if (!inventory) {
            validationErrors.push(`No inventory found for product ${productName} in selected warehouse`)
            continue
          }

          const newQuantity = inventory.quantity - quantity
          if (newQuantity < 0) {
            validationErrors.push(`Insufficient stock for product ${productName}. Available: ${inventory.quantity}, Requested: ${quantity}`)
            continue
          }

          inventoryUpdates.push({
            id: inventory.id,
            product_id: productId,
            warehouse_id: selectedWarehouse,
            quantity: newQuantity,
            notes: inventory.notes || ''
          })
        }
      }

      // If any validation errors, throw before making any updates
      if (validationErrors.length > 0) {
        throw new Error(`Inventory validation failed:\n${validationErrors.join('\n')}`)
      }

      // 4. Batch update all inventory using bulk API
      if (inventoryUpdates.length > 0) {
        // Keep processing state for inventory update
        setProcessingItems(new Set(cart.map(item => item.product.id)))
        
        const bulkUpdateResponse = await fetchWithRetry(`${API_URL}/inventory/inventory/bulk/`, {
          method: "POST",
          headers,
          body: JSON.stringify(inventoryUpdates),
          signal: controller.signal,
        })

        if (!bulkUpdateResponse.ok) {
          const errorData = await bulkUpdateResponse.json()
          if (process.env.NODE_ENV !== 'production') {
            console.error("Bulk inventory update error:", errorData)
          }
          
          // Rollback: Delete created invoice items and invoice
          if (invoiceId !== undefined) {
            await rollbackSaleCreation(invoiceId, createdInvoiceItemIds, headers, controller.signal)
          }
          
          throw new Error(
            `Failed to update inventory: ${errorData.detail || errorData.message || "Unknown error"}. ` +
            `The sale has been rolled back. Please try again.`
          )
        }
      }

      // 5. Create payment record for all sales (both cash and outstanding)
      // Clear processing items as inventory update is complete
      setProcessingItems(new Set())
      
      const paymentData = {
        invoice: invoiceId,
        amount: parseFloat(finalPaidAmount.toFixed(2)), // sum of individual item payments (matches total when fully paid)
        payment_date: format(new Date(), "yyyy-MM-dd"),
      };

      const paymentResponse = await fetchWithRetry(`${API_URL}/sales/payments/`, {
        method: "POST",
        headers,
        body: JSON.stringify(paymentData),
        signal: controller.signal,
      })

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json()
        
        // Rollback: Delete created invoice items and invoice (payment not created yet, so no need to delete it)
        if (invoiceId !== undefined) {
          await rollbackSaleCreation(invoiceId, createdInvoiceItemIds, headers, controller.signal)
        }
        
        throw new Error(
          `Failed to create payment: ${errorData.message || "Unknown error"}. ` +
          `The sale has been rolled back. Please try again.`
        )
      }

      const payment = await paymentResponse.json()
      createdPaymentId = payment.id

      const remainingAmount = roundedTotal - finalPaidAmount;
      toast({
        title: "Success",
        description: Math.abs(remainingAmount) < 0.001
          ? "Sale completed successfully - Fully Paid" 
          : `Sale completed successfully - ${remainingAmount.toFixed(3)} ${getCurrencyLabel()} remaining`,
      })

      // Fetch invoice summary for receipt
      const summaryRes = await fetchWithRetry(`${API_URL}/sales/invoices/${invoiceId}/summary/`, { 
        headers,
        signal: controller.signal,
      })
      if (!summaryRes.ok) {
        throw new Error("Failed to fetch invoice summary for receipt")
      }
      const summary = await summaryRes.json()
      setConfirmSaleOpen(false)
      setReceiptData(summary)
      queueMicrotask(() => {
        setActiveDialog("print")
      })

      // Update sales summary locally - use the total amount (which matches paid amount when fully paid)
      setTodaySales(prev => prev + roundedTotal)
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
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      
      let errorMessage = "Failed to complete sale. Please try again."
      let needsManualReconciliation = false
      
      if (error instanceof Error) {
        if (error.message.includes("composite_id")) {
          errorMessage = "Backend error: Invoice creation failed due to composite_id constraint. Please contact support."
        } else if (error.message.includes("Duplicate entry")) {
          errorMessage = "Backend error: Duplicate invoice entry. Please try again."
        } else if (error.message.includes("rolled back")) {
          // Rollback was already attempted
          errorMessage = error.message
        } else if (error.message.includes("Failed to fetch inventory") || error.message.includes("Inventory validation failed")) {
          // These errors occur before inventory update, so no rollback needed
          errorMessage = error.message
        } else {
          // For other errors that might occur after invoice creation, attempt rollback
          // Check if we have invoiceId (means invoice was created)
          if (invoiceId !== undefined && headers) {
            try {
              await rollbackSaleCreation(invoiceId, createdInvoiceItemIds || [], headers, controller.signal)
              errorMessage = `${error.message} The sale has been rolled back. Please try again.`
            } catch (rollbackError) {
              // Rollback failed - need manual reconciliation
              needsManualReconciliation = true
              errorMessage = `${error.message} Rollback failed. Invoice ID: ${invoiceId}. Please contact support for manual reconciliation.`
              if (process.env.NODE_ENV !== 'production') {
                console.error("Rollback failed:", rollbackError)
              }
            }
          } else {
            errorMessage = error.message
          }
        }
      }
      
      handleError(
        error,
        errorMessage,
        {
          title: needsManualReconciliation ? "Error - Manual Reconciliation Required" : "Error",
          duration: needsManualReconciliation ? 10000 : 5000,
        }
      )
    } finally {
      setIsSubmitting(false)
      setProcessingItems(new Set()) // Clear processing items on completion or error
    }
  }




  // Separate function to fetch products only with retry mechanism
  // Now supports server-side filtering and pagination
  const fetchProducts = async (warehouseId: number, search?: string, genreId?: number | null, page: number = 1, retryCount = 0) => {
    // Normalize search parameter
    const normalizedSearch = (search || '').trim();
    const normalizedGenreId = genreId || null;
    
    // Check if we're fetching the same data we already have (skip if retrying)
    // This prevents unnecessary refetches when cart closes or component re-renders
    if (retryCount === 0) {
      const lastParams = lastFetchParamsRef.current;
      if (
        lastParams.warehouseId === warehouseId &&
        lastParams.search === normalizedSearch &&
        lastParams.genreId === normalizedGenreId &&
        lastParams.page === page
      ) {
        // Same parameters as last successful fetch, no need to refetch
        return;
      }
    }
    
    try {
      setIsLoading(true);
      const token = localStorage.getItem("accessToken");
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      // Build query parameters
      const queryParams = new URLSearchParams();
      queryParams.append('warehouse_id', warehouseId.toString());
      queryParams.append('page', page.toString());
      queryParams.append('page_size', pageSize.toString());
      
      // Add server-side search filter
      if (search && search.trim()) {
        queryParams.append('search', search.trim());
      }
      
      // Add server-side genre filter
      if (genreId) {
        queryParams.append('genre_id', genreId.toString());
      }
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      
      const productsRes = await fetch(`${API_URL}/inventory/pos-product-summary/?${queryParams.toString()}`, { 
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (productsRes.ok) {
        const productsData = await productsRes.json();
        
        let availableProducts: Product[] = [];
        let totalItems = 0;
        
        // Handle paginated response (DRF format)
        if (productsData.results) {
          availableProducts = productsData.results.filter((p: Product) => p.status_id === 2);
          totalItems = productsData.count || availableProducts.length;
        } else if (Array.isArray(productsData)) {
          // Fallback for non-paginated response
          availableProducts = productsData.filter((p: Product) => p.status_id === 2);
          totalItems = availableProducts.length;
        }
        
        setProducts(availableProducts);
        setTotalCount(totalItems);
        
        // Calculate total pages from server count
        const calculatedTotalPages = Math.ceil(totalItems / pageSize);
        setTotalPages(calculatedTotalPages || 1);
        
        // Update last fetch params after successful fetch
        lastFetchParamsRef.current = {
          warehouseId,
          search: normalizedSearch,
          genreId: normalizedGenreId,
          page,
        };
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Failed to fetch products:', productsRes.status, productsRes.statusText);
        }
        const errorText = await productsRes.text();
        if (process.env.NODE_ENV !== 'production') {
          console.error('Error response:', errorText);
        }
        setProducts([]);
        setTotalCount(0);
        setTotalPages(1);
        // Reset last fetch params on error
        lastFetchParamsRef.current = {
          warehouseId: null,
          search: '',
          genreId: null,
          page: 1,
        };
        handleError(
          new Error(`Failed to load products for warehouse. Status: ${productsRes.status}`),
          "Failed to load products for warehouse. Please try again."
        );
      }
          } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Error fetching products:', error);
        }
        
        // Retry logic for network errors
        if (retryCount < 2 && (error instanceof Error && error.name === 'AbortError' || error instanceof TypeError)) {
          setTimeout(() => {
            fetchProducts(warehouseId, debouncedSearchInput, selectedGenre?.id || null, page, retryCount + 1);
          }, 1000 * (retryCount + 1)); // Exponential backoff
          return;
        }
        
        setProducts([]);
        if (error instanceof Error && error.name === 'AbortError') {
          handleError(error, "Request timed out. Please try again.", { title: "Timeout" });
        } else {
          handleError(error, "Failed to load products. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    };

  // Update the useEffect for warehouse changes to fetch products when warehouse is selected
  // Note: This will trigger the server-side filtering useEffect when warehouse changes
  // because selectedWarehouse is in its dependencies, so we don't need to call fetchProducts here
  useEffect(() => {
    if (selectedWarehouse) {
      // Reset to page 1 when warehouse changes
      setCurrentPage(1);
      // Reset fetch params to force fetch when warehouse changes
      lastFetchParamsRef.current = {
        warehouseId: null, // Force fetch by setting to null
        search: '',
        genreId: null,
        page: 1,
      };
      // fetchProducts will be called by the server-side filtering useEffect
      fetchSalesMetrics();
    } else {
      // Clear products when no warehouse is selected
      setProducts([]);
      setIsLoading(false);
      // Reset fetch params
      lastFetchParamsRef.current = {
        warehouseId: null,
        search: '',
        genreId: null,
        page: 1,
      };
    }
  }, [selectedWarehouse]);

  // Global payment status sync effect - ensures payment status is always consistent
  // This catches any edge cases where payment status might get out of sync
  // Runs after cart changes to ensure is_paid flag matches paid_amount vs itemTotal
  // Uses a ref to prevent infinite loops
  useEffect(() => {
    if (cart.length === 0) return;
    if (isAllocatingRef.current) return; // Skip if already allocating to prevent loops
    if (syncingRef.current) return; // Skip if already syncing to prevent loops
    
    syncingRef.current = true;
    
    // Use functional update to access latest cart state
    setCart(prevCart => {
      let hasChanges = false;
      const syncedCart = prevCart.map(item => {
        const paymentTarget = getLinePaymentTargetTotal(item, prevCart);
        const syncedItem = syncItemPaymentStatus(item, paymentTarget);
        if (syncedItem !== item) {
          hasChanges = true;
        }
        return syncedItem;
      });
      
      // Only update if something changed to prevent unnecessary re-renders
      return hasChanges ? syncedCart : prevCart;
    });
    
    // Reset flag after state update
    setTimeout(() => {
      syncingRef.current = false;
    }, 0);
  }, [cartTotalSignature]); // Only trigger when cart values change (not on every render)

  // Auto-reallocate when anything affecting the grand total changes.
  // Store: both cash (full line pay) and outstanding (unpaid lines at 0); individual cash: full line pay.
  // Partial only comes from user-edited Paid amount (tracked in manualPaidAmountLineIdsRef).
  useEffect(() => {
    if (!selectedPaymentMethod) return;
    const pm = paymentMethods.find(m => m.id === selectedPaymentMethod)?.display_name_en.toLowerCase() || "";
    const isCash = pm.includes("cash");
    // Store (cash or outstanding) or any cash checkout (incl. individual)
    if (!isStoreCustomer && !isCash) return;
    if (cart.length === 0) return;
    if (isAllocatingRef.current) return;

    if (allocatePayInFullRef.current) {
      allocatePayInFullRef.current();
    }
  }, [
    selectedPaymentMethod,
    discountPercentage,
    taxPercentage,
    cartTotalSignature,
    selectedCustomer?.customer_type,
    isStoreCustomer,
  ]);

  // Add PaginationControls to the products section
  const PaginationControls = () => {
    const startItem = totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0;
    const endItem = Math.min(currentPage * pageSize, totalCount);
    
    return (
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {totalCount > 0 ? (
              <>Showing {startItem}-{endItem} of {totalCount} products</>
            ) : (
              <>No products found</>
            )}
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
              <SelectItem value="25">25</SelectItem>
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
  };

  // Function to reset/clear sale state (used by New Sale button and receipt close)
  const handleNewSale = () => {
    setCart([])
    setSelectedCustomer(null)
    setSelectedWarehouse(null)
    setProducts([])
    setInvoiceNotes("")
    setDiscountPercentage(30)
    setTaxPercentage(0)
    setSearchInput("")
    setSelectedGenre(null)
    setReceiptData(null)
    setConfirmSaleOpen(false)
  }

  const fetchSalesMetrics = async () => {
    // Abort previous request if still pending
    if (salesMetricsAbortControllerRef.current) {
      salesMetricsAbortControllerRef.current.abort()
    }
    
    // Create new AbortController for this request
    const controller = new AbortController()
    salesMetricsAbortControllerRef.current = controller

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
      const salesResponse = await fetchWithRetry(`${API_URL}/sales/invoices/?created_at=${today}`, { 
        headers,
        signal: controller.signal,
      })
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
      handleError(error, "Failed to load sales metrics. Please try again.");
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
                      <Dialog open={activeDialog === 'newCustomer'} onOpenChange={(open) => setActiveDialog(open ? 'newCustomer' : null)}>
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
                            <Button variant="outline" onClick={() => setActiveDialog(null)}>
                              Cancel
                            </Button>
                            <Button onClick={handleAddCustomer} disabled={isAddingCustomer}>
                              {isAddingCustomer ? (
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
                        disabled={isIndividualCustomer}
                      >
                        <SelectTrigger className={isIndividualCustomer ? "bg-muted cursor-not-allowed" : ""}>
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentMethods
                            .filter((method) => method.value.toLowerCase() !== 'postpaid')
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
                    {(selectedPaymentMethod || isIndividualCustomer) && (
                      <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                        <div className="flex items-center justify-between">
                          <div>
                            {isIndividualCustomer ? (
                              <>
                                <strong>Payment Method:</strong> Cash - Items will be marked as paid by default
                              </>
                            ) : (
                              <>
                                <strong>Payment Method:</strong> {paymentMethods.find(m => m.id === selectedPaymentMethod)?.display_name_en}
                                {paymentMethods.find(m => m.id === selectedPaymentMethod)?.display_name_en.toLowerCase().includes('outstanding') 
                                  ? ' - Items will be marked as unpaid by default'
                                  : ' - Items will be marked as paid by default'
                                }
                              </>
                            )}
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
                          const lineTotal = calculateItemTotal(item);
                          const remainingAmount = Math.max(0, lineTotal - item.paid_amount);
                          const paidAmount = item.paid_amount;
                          const difference = Math.abs(paidAmount - lineTotal);
                          // Use tolerance check to handle floating point precision
                          const isFullyPaid = difference < 0.001 || paidAmount >= lineTotal;
                          const isPartiallyPaid = paidAmount > 0.001 && !isFullyPaid;
                          
                          return (
                            <div key={item.product.id} className={`space-y-2 p-3 rounded-lg border relative ${
                              isFullyPaid ? 'bg-green-50 border-green-200' : 
                              isPartiallyPaid ? 'bg-orange-50 border-orange-200' : 
                              'bg-white border-gray-200'
                            } ${processingItems.has(item.product.id) ? 'opacity-60' : ''}`}>
                              {processingItems.has(item.product.id) && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg z-10">
                                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1">
                                  <Checkbox
                                    checked={item.is_paid}
                                    onChange={(e) => updateItemPaymentStatus(item.product.id, e.target.checked)}
                                    disabled={isIndividualCustomer}
                                    className="shrink-0"
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-medium">{item.product.title_en}</h4>
                                      {getPaymentStatusBadge(item)}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      {(() => {
                                        const displayPrice = getDisplayPrice(item.product);
                                        return displayPrice ? `${parseFloat(displayPrice).toFixed(3)} ${getCurrencyLabel()}` : "N/A";
                                      })()}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateQuantity(item.product.id, Number(item.quantity) - 1)}
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <Input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={item.quantity}
                                    onChange={(e) => handleQuantityInputChange(item.product.id, e.target.value)}
                                    onBlur={(e) => {
                                      const parsedQuantity = parseInt(e.target.value, 10);
                                      if (isNaN(parsedQuantity) || parsedQuantity < 1) {
                                        updateQuantity(item.product.id, 1);
                                      }
                                    }}
                                    className="h-8 w-16 text-center"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateQuantity(item.product.id, Number(item.quantity) + 1)}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                  <Button type="button" variant="ghost" size="sm" onClick={() => removeFromCart(item.product.id)}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Label className="text-xs">Item Discount{isStoreCustomer ? "" : " (store only)"}:</Label>
                                <Select
                                  value={item.discount_percent.toString()}
                                  onValueChange={(value) => updateItemDiscount(item.product.id, Number(value))}
                                  disabled={!isStoreCustomer}
                                >
                                  <SelectTrigger className={cn("h-7 text-xs", !isStoreCustomer && "bg-muted cursor-not-allowed")}>
                                    <SelectValue placeholder="0%" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="0">0%</SelectItem>
                                    <SelectItem value="5">5%</SelectItem>
                                    <SelectItem value="10">10%</SelectItem>
                                    <SelectItem value="15">15%</SelectItem>
                                    <SelectItem value="20">20%</SelectItem>
                                    <SelectItem value="25">25%</SelectItem>
                                    <SelectItem value="30">30%</SelectItem>
                                    <SelectItem value="40">40%</SelectItem>
                                    <SelectItem value="50">50%</SelectItem>
                                    <SelectItem value="60">60%</SelectItem>
                                    <SelectItem value="75">75%</SelectItem>
                                    <SelectItem value="80">80%</SelectItem>
                                    <SelectItem value="90">90%</SelectItem>
                                    <SelectItem value="100">100%</SelectItem>
                                  </SelectContent>
                                </Select>
                                <span className="text-xs ml-auto">
                                  Total: {lineTotal.toFixed(3)} {getCurrencyLabel()}
                                </span>
                              </div>

                              {item.is_paid && (
                                <div className="flex items-center gap-2 pt-2 border-t">
                                  <Label className="text-xs">Paid Amount:</Label>
                                  <Input
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    max={lineTotal}
                                    value={item.paid_amount}
                                    onChange={(e) => updateItemPaidAmount(item.product.id, parseFloat(e.target.value) || 0)}
                                    className="h-7 text-xs w-24"
                                    placeholder="0.000"
                                  />
                                  <span className="text-xs text-muted-foreground">
                                    {remainingAmount > 0 ? `Remaining: ${remainingAmount.toFixed(3)} ${getCurrencyLabel()}` : "Fully Paid"}
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
                      <span>{subtotal.toFixed(3)} {getCurrencyLabel()}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span>Discount</span>
                      <div className="flex items-center gap-2">
                        <Select
                          value={discountPercentage.toString()}
                          onValueChange={(value) => {
                            setDiscountPercentage(Number(value))
                            setTimeout(() => {
                              allocatePayInFullRef.current?.()
                            }, 0)
                          }}
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
                            <SelectItem value="30">30%</SelectItem>
                            <SelectItem value="40">40%</SelectItem>
                            <SelectItem value="50">50%</SelectItem>
                            <SelectItem value="60">60%</SelectItem>
                            <SelectItem value="75">75%</SelectItem>
                            <SelectItem value="80">80%</SelectItem>
                            <SelectItem value="90">90%</SelectItem>
                            <SelectItem value="100">100%</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="min-w-[60px] text-right">
                          {globalDiscountAmount > 0 ? `-${globalDiscountAmount.toFixed(3)}` : "0.000"} {getCurrencyLabel()}
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
                        <span className="min-w-[60px] text-right">{tax.toFixed(3)} {getCurrencyLabel()}</span>
                      </div>
                    </div>

                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span>{total.toFixed(3)} {getCurrencyLabel()}</span>
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
                                {total.toFixed(3)} {getCurrencyLabel()}
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
                                {totalUnpaidAmount.toFixed(3)} {getCurrencyLabel()}
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
                                {cart.filter(item => {
                                  const target = calculateItemTotal(item);
                                  const paidAmount = item.paid_amount;
                                  const difference = Math.abs(paidAmount - target);
                                  return paidAmount > 0.001 && difference >= 0.001 && paidAmount < target;
                                }).length} items
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
                        {totalUnpaidAmount.toFixed(3)} {getCurrencyLabel()}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    className="w-full mt-4"
                    size="lg"
                    disabled={cart.length === 0 || isSubmitting || !selectedCustomer || !selectedWarehouse || isNaN(totalUnpaidAmount) || totalUnpaidAmount < 0}
                    onPointerDown={(e) => {
                      if (e.pointerType === "mouse" && e.button !== 0) return
                      e.preventDefault()
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void handleCompleteSale()}
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
                          {totalUnpaidAmount > 0 ? `Pay ${totalUnpaidAmount.toFixed(3)} ${getCurrencyLabel()}` : "Fully Paid"}
                        </span>
                      </div>
                    )}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <Button
              variant="outline"
              onClick={handleNewSale}
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
                      <h3 className="text-2xl font-bold">{todaySales.toFixed(3)} {getCurrencyLabel()}</h3>
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
                  ) : products.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="flex flex-col items-center gap-4">
                        <p className="text-muted-foreground">No products found in this warehouse</p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            fetchProducts(selectedWarehouse, debouncedSearchInput, selectedGenre?.id || null, currentPage);
                          }}
                        >
                          Retry Load Products
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {products.map((product) => (
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
                                    <p className="font-bold text-sm">
                                      {(() => {
                                        const displayPrice = getDisplayPrice(product);
                                        return displayPrice ? `${parseFloat(displayPrice).toFixed(3)} ${getCurrencyLabel()}` : "N/A";
                                      })()}
                                    </p>
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
              onClick={() => setConfirmSaleOpen(true)}
            >
              <CheckCircle2 className="h-6 w-6" />
            </Button>
          </div>
        )}

        {/* Confirm Sale Dialog */}
        <Dialog open={confirmSaleOpen} onOpenChange={setConfirmSaleOpen}>
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
                  <span className="font-medium">{subtotal.toFixed(3)} {getCurrencyLabel()}</span>
                </div>
                {discountPercentage > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Discount</span>
                    <span className="font-medium text-green-600">
                      -{globalDiscountAmount.toFixed(3)} {getCurrencyLabel()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Tax</span>
                  <span className="font-medium">{tax.toFixed(3)} {getCurrencyLabel()}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-lg">{total.toFixed(3)} {getCurrencyLabel()}</span>
                </div>
                
                {/* Payment Summary */}
                {(totalPaidAmount > 0 || hasPartialPayment) && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Amount Paid</span>
                        <span className="font-medium text-green-600">{total.toFixed(3)} {getCurrencyLabel()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Amount Due</span>
                        <span className="font-medium text-red-600">{totalUnpaidAmount.toFixed(3)} {getCurrencyLabel()}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmSaleOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onPointerDown={(e) => {
                  if (e.pointerType === "mouse" && e.button !== 0) return
                  e.preventDefault()
                }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void handleCompleteSale()}
                disabled={isSubmitting || !selectedCustomer || !selectedWarehouse || isNaN(totalUnpaidAmount) || totalUnpaidAmount < 0}
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
                      {totalUnpaidAmount > 0 ? `Pay ${totalUnpaidAmount.toFixed(3)} ${getCurrencyLabel()}` : "Fully Paid"}
                    </span>
                  </div>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* Print Receipt Dialog */}
      <Dialog open={activeDialog === 'print'} onOpenChange={(open) => {
        setActiveDialog(open ? 'print' : null);
        if (!open) {
          // Clear all cart and sale-related state when closing receipt (same as New Sale)
          handleNewSale();
          // Reset payment method and invoice type to defaults
          if (paymentMethods.length > 0) {
            setSelectedPaymentMethod(paymentMethods[0].id);
          }
          if (invoiceTypes.length > 0) {
            setSelectedInvoiceType(invoiceTypes[0].id);
          }
        }
      }}>
        <DialogContent className="w-full max-w-md h-[90vh] flex flex-col">
          <div className="shrink-0">
            <DialogHeader>
              <DialogTitle>Receipt</DialogTitle>
              <DialogDescription>View, print, or download your receipt.</DialogDescription>
            </DialogHeader>
          </div>
          {receiptData && (
            <ReceiptContent
              receiptData={{
                id: receiptData.id,
                composite_id: receiptData.composite_id,
                customer_name: receiptData.customer_name || selectedCustomer?.institution_name || "Walk-in Customer",
                customer_contact: receiptData.customer_contact || selectedCustomer?.contact_person || "",
                warehouse_name: receiptData.warehouse_name || warehouses.find(w => w.id === selectedWarehouse)?.name_en || "N/A",
                warehouse_location: warehouses.find(w => w.id === selectedWarehouse)?.location || "",
                invoice_type_name: receiptData.invoice_type_name || invoiceTypes.find(t => t.id === selectedInvoiceType)?.display_name_en || "N/A",
                payment_method_name: receiptData.payment_method_name || paymentMethods.find(m => m.id === selectedPaymentMethod)?.display_name_en || "N/A",
                items: cart.map((item, idx) => ({
                  id: idx,
                  product_name: item.product.title_en,
                  product: {
                    id: item.product.id,
                    title_en: item.product.title_en,
                    price: item.product.price,
                    price_omr: item.product.price_omr,
                    latest_price: item.product.latest_price,
                    latest_price_omr: item.product.latest_price_omr,
                  },
                  quantity: item.quantity,
                  unit_price: (() => {
                    const price = item.product.price || item.product.latest_price;
                    return price ? parseFloat(price) : 0;
                  })(),
                  discount_percent: getEffectiveLineDiscountPercent(item),
                  total_price: calculateItemTotal(item),
                  paid_amount: item.paid_amount,
                  is_paid: item.is_paid,
                })),
                total_amount: total,
                total_paid: totalPaidAmount,
                remaining_amount: totalUnpaidAmount,
                notes: receiptData.notes || invoiceNotes,
                created_at_formatted: receiptData.created_at_formatted || format(new Date(), "PPP"),
                global_discount_percent: discountPercentage,
                tax_percent: taxPercentage,
                // Pass POS-specific calculated values
                subtotal,
                globalDiscountAmount,
                tax,
                total,
                totalUnpaidAmount,
                hasPartialPayment,
              }}
              currencyLabel={getCurrencyLabel()}
              getDisplayPrice={(item) => {
                // For receipt items, check if product exists
                if (item.product) {
                  return getDisplayPrice(item.product);
                }
                // Fallback to unit_price if no product data
                return item.unit_price ? item.unit_price.toString() : null;
              }}
              onClose={() => {
                handleNewSale();
                if (paymentMethods.length > 0) {
                  setSelectedPaymentMethod(paymentMethods[0].id);
                }
                if (invoiceTypes.length > 0) {
                  setSelectedInvoiceType(invoiceTypes[0].id);
                }
                setActiveDialog(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
}
