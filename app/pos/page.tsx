"use client"

import { ErrorBoundary } from "@/components/ErrorBoundary"
import { DocumentTitle } from "@/components/document-title"
import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { PageBreadcrumb, useAppCrumbs } from "@/components/page-breadcrumb"
import { useLanguage } from "@/components/language-context"
import { Button } from "@/components/ui/button"
import { fetchWithRetry } from "@/lib/apiClient"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { toast } from "sonner"
import { format } from "date-fns"
import { API_URL } from "@/lib/config"
import { PosMetrics } from "./components/pos-metrics"
import { PosProductGrid } from "./components/pos-product-grid"
import { PosCart } from "./components/pos-cart"
import { PosPayments } from "./components/pos-payments"
import { PosCheckout } from "./components/pos-checkout"
import type {
  CartItem,
  Customer,
  DialogType,
  Genre,
  InvoiceType,
  ListItemValue,
  NewCustomerForm,
  PaymentMethod,
  Product,
  Warehouse,
} from "./components/types"

function normalizeListItemValue(value: string | null | undefined): string {
  return (value || "").toLowerCase().replace(/[^a-z0-9]/g, "")
}

/** Replace one line so totals that depend on the whole cart (e.g. store + global discount split) stay consistent. */
function replaceCartItemForTotals(cart: CartItem[], replacement: CartItem): CartItem[] {
  return cart.map((c) => (c.product.id === replacement.product.id ? replacement : c))
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

  // Subtotal after discounts: sum of per-line net totals
  const discountedSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  }, [cart, calculateItemTotal]);

  // Total discount amount (global and/or per-line; subtotal is always gross list sum)
  const globalDiscountAmount = useMemo(() => {
    return Math.max(0, subtotal - discountedSubtotal);
  }, [subtotal, discountedSubtotal]);

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
  toast.error(options?.title || "Error", { description: errorMessage });
};

export default function POSPage() {
  const { t } = useLanguage()
  const { dashboard: dashboardCrumb } = useAppCrumbs()
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
  const [newCustomer, setNewCustomer] = useState<NewCustomerForm>({
    customer_type: null,
    institution_name: "",
    contact_person: "",
    phone: "",
    email: "",
  })
  const [customerTypes, setCustomerTypes] = useState<any[]>([])
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
        customerTypesRes,
        warehouseTypesRes,
      ] = await Promise.all([
        fetchWithRetry(`${API_URL}/sales/customers/`, { headers, signal: controller.signal }),
        fetchWithRetry(`${API_URL}/common/list-items/genre/`, { headers, signal: controller.signal }),
        fetchWithRetry(`${API_URL}/inventory/warehouses/`, { headers, signal: controller.signal }),
        fetchWithRetry(`${API_URL}/common/list-items/payment_method/`, { headers, signal: controller.signal }),
        fetchWithRetry(`${API_URL}/common/list-items/invoice_type/`, { headers, signal: controller.signal }),
        fetchWithRetry(`${API_URL}/common/list-items/customer_type/`, { headers, signal: controller.signal }),
        fetchWithRetry(`${API_URL}/common/list-items/warehouse_type/`, { headers, signal: controller.signal }),
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
      const warehouseTypesData = warehouseTypesRes.ok
        ? await warehouseTypesRes.json()
        : [];

      // Process other data
      const customersArray = Array.isArray(customersData) ? customersData : customersData.results || [];
      const genresArray = Array.isArray(genresData) ? genresData : genresData.results || [];
      const rawWarehousesArray: Warehouse[] = Array.isArray(warehousesData)
        ? warehousesData
        : warehousesData.results || [];
      const paymentMethodsArray = Array.isArray(paymentMethodsData) ? paymentMethodsData : paymentMethodsData.results || [];
      const invoiceTypesArray = Array.isArray(invoiceTypesData) ? invoiceTypesData : invoiceTypesData.results || [];
      const customerTypesArray = Array.isArray(customerTypesData) ? customerTypesData : customerTypesData.results || [];
      const warehouseTypesArray: ListItemValue[] = Array.isArray(warehouseTypesData)
        ? warehouseTypesData
        : warehouseTypesData.results || [];
      const warehouseTypeById = new Map(
        warehouseTypesArray.map((type) => [type.id, type.value]),
      );
      const warehousesArray = rawWarehousesArray.map((warehouse) => ({
        ...warehouse,
        type_value:
          typeof warehouse.type === "number"
            ? warehouseTypeById.get(warehouse.type) || null
            : warehouse.type?.value || null,
      }));

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

  // Select the invoice type from the selected warehouse type:
  // null/mainstore -> mainstore invoice, bookfair -> bookfair invoice.
  // The user can still override the automatically selected value afterwards.
  useEffect(() => {
    if (!selectedWarehouse || invoiceTypes.length === 0) return

    const warehouse = warehouses.find((item) => item.id === selectedWarehouse)
    if (!warehouse) return

    let warehouseTypeValue: string | null | undefined
    if (warehouse.type == null) {
      warehouseTypeValue = "mainstore"
    } else if (typeof warehouse.type === "number") {
      warehouseTypeValue = warehouse.type_value
    } else {
      warehouseTypeValue = warehouse.type.value
    }

    const normalizedWarehouseType = normalizeListItemValue(warehouseTypeValue)
    const desiredInvoiceType =
      normalizedWarehouseType === "bookfair"
        ? "bookfair"
        : normalizedWarehouseType === "mainstore"
          ? "mainstore"
          : null

    if (!desiredInvoiceType) return

    const matchingInvoiceType = invoiceTypes.find(
      (type) => normalizeListItemValue(type.value) === desiredInvoiceType,
    )
    if (matchingInvoiceType) {
      setSelectedInvoiceType(matchingInvoiceType.id)
    }
  }, [selectedWarehouse, warehouses, invoiceTypes])

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
    const availableStock = getAvailableStock(product)
    const productWithStock = {
      ...product,
      warehouse_stock: selectedWarehouse ? availableStock : product.warehouse_stock,
    }

    let blockedByStock = false

    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.product.id === product.id)
      const requestedQty = existingItem ? existingItem.quantity + 1 : 1

      if (requestedQty > availableStock) {
        blockedByStock = true
        return prevCart
      }

      if (existingItem) {
        return prevCart.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                product: { ...item.product, warehouse_stock: availableStock },
              }
            : item
        )
      }

      const newItem = {
        product: productWithStock,
        quantity: 1,
        discount_percent: 0,
        is_paid: isIndividualCustomer,
        paid_amount: 0,
      }
      return [...prevCart, newItem]
    })

    if (blockedByStock) {
      showInsufficientStockToast(availableStock)
      return
    }

    setTimeout(() => {
      if (isIndividualCustomer) return
      allocatePayInFullRef.current?.()
    }, 0)
  }

  const removeFromCart = (productId: number) => {
    manualPaidAmountLineIdsRef.current.delete(productId)
    setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId))
  }

  // ---------------------------------------------------------------------------
  // Payment & discount rules (subtotal = gross list sum; calculateItemTotal = net per line):
  // STORE — either global % on each line's gross OR per-line item discount, never both. Changing global clears
  //         line discounts; changing any line discount clears global. Outstanding: lines default unpaid; cash: full pay.
  // INDIVIDUAL — cash only: no line discount; same global % on each line gross. API: global_discount_percent 0, discount on lines.
  // ---------------------------------------------------------------------------

  const cartHasStoreItemDiscount = useMemo(
    () => isStoreCustomer && cart.some((i) => i.discount_percent > 0),
    [isStoreCustomer, cart],
  );

  const getLineGross = useCallback((item: CartItem) => {
    const price = item.product.price || item.product.latest_price;
    const priceValue = price ? parseFloat(price) : 0;
    return priceValue * item.quantity;
  }, []);

  const getLineGrossOmr = useCallback((item: CartItem) => {
    const price = item.product.price_omr || item.product.latest_price_omr;
    const priceValue = price ? parseFloat(price) : 0;
    return priceValue * item.quantity;
  }, []);

  const appliesGlobalDiscountPerLine = useMemo(() => {
    if (!discountPercentage || !selectedCustomer?.customer_type) return false;
    const customerType = customerTypes.find((ct) => ct.id === selectedCustomer.customer_type)?.value;
    if (customerType === "individual") return true;
    if (customerType === "store") return !cart.some((i) => i.discount_percent > 0);
    return false;
  }, [discountPercentage, selectedCustomer, customerTypes, cart]);

  const calculateItemSubtotal = useCallback(
    (item: CartItem) => getLineGross(item),
    [getLineGross],
  );

  const calculateItemDisplaySubtotal = useCallback(
    (item: CartItem) => getLineGrossOmr(item),
    [getLineGrossOmr],
  );

  const calculateItemTotal = useCallback(
    (item: CartItem, currentCart?: CartItem[]) => {
      const gross = getLineGross(item);
      const cartToUse = currentCart ?? cart;

      const customerTypeValue = selectedCustomer?.customer_type
        ? customerTypes.find((ct) => ct.id === selectedCustomer.customer_type)?.value
        : null;

      const globalPct = Math.max(0, Math.min(100, discountPercentage || 0));

      if (customerTypeValue === "store") {
        const hasItemDiscount = cartToUse.some((i) => i.discount_percent > 0);
        if (hasItemDiscount) {
          const lineDisc = Math.max(0, Math.min(100, item.discount_percent)) / 100;
          return Number((gross * (1 - lineDisc)).toFixed(3));
        }
        if (globalPct > 0) {
          return Number((gross * (1 - globalPct / 100)).toFixed(3));
        }
        return Number(gross.toFixed(3));
      }

      if (customerTypeValue === "individual") {
        if (globalPct > 0) {
          return Number((gross * (1 - globalPct / 100)).toFixed(3));
        }
        return Number(gross.toFixed(3));
      }

      return Number(gross.toFixed(3));
    },
    [cart, discountPercentage, getLineGross, selectedCustomer, customerTypes],
  );

  const calculateItemDisplayTotal = useCallback(
    (item: CartItem, currentCart?: CartItem[]) => {
      const gross = getLineGrossOmr(item);
      const cartToUse = currentCart ?? cart;

      const customerTypeValue = selectedCustomer?.customer_type
        ? customerTypes.find((ct) => ct.id === selectedCustomer.customer_type)?.value
        : null;

      const globalPct = Math.max(0, Math.min(100, discountPercentage || 0));

      if (customerTypeValue === "store") {
        const hasItemDiscount = cartToUse.some((i) => i.discount_percent > 0);
        if (hasItemDiscount) {
          const lineDisc = Math.max(0, Math.min(100, item.discount_percent)) / 100;
          return Number((gross * (1 - lineDisc)).toFixed(3));
        }
        if (globalPct > 0) {
          return Number((gross * (1 - globalPct / 100)).toFixed(3));
        }
        return Number(gross.toFixed(3));
      }

      if (customerTypeValue === "individual") {
        if (globalPct > 0) {
          return Number((gross * (1 - globalPct / 100)).toFixed(3));
        }
        return Number(gross.toFixed(3));
      }

      return Number(gross.toFixed(3));
    },
    [cart, discountPercentage, getLineGrossOmr, selectedCustomer, customerTypes],
  );

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

  const displayCartCalcs = useCartCalculations(
    cart,
    discountPercentage,
    taxPercentage,
    calculateItemDisplayTotal,
    calculateItemDisplaySubtotal,
  );

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
    let q = Math.floor(Number(newQuantity))
    if (!Number.isFinite(q) || q < 1) {
      removeFromCart(productId)
      return
    }

    const cartItem = cart.find((item) => item.product.id === productId)
    if (!cartItem) return

    const availableStock = getAvailableStock(cartItem.product)
    if (q > availableStock) {
      showInsufficientStockToast(availableStock)
      if (availableStock < 1) {
        removeFromCart(productId)
        return
      }
      q = availableStock
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
    if (discountPercent > 0) {
      setDiscountPercentage(0)
    }
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

  /** Stock for the selected warehouse (not total across all warehouses). */
  const getAvailableStock = useCallback((product: Product): number => {
    if (selectedWarehouse) {
      const fresh = products.find((p) => p.id === product.id)
      const source = fresh ?? product
      return source.warehouse_stock ?? 0
    }
    return product.stock ?? 0
  }, [selectedWarehouse, products])

  const showInsufficientStockToast = useCallback((availableStock: number) => {
    toast.error(t("posToasts.insufficientStock"), { description: availableStock > 0
          ? `Only ${availableStock} item(s) available in this warehouse.`
          : "This product is out of stock in the selected warehouse." })
  }, [t])

  /** Convert a USD line amount to OMR for on-screen display (Muscat only). */
  const usdToDisplayForLine = useCallback(
    (usdAmount: number, item: CartItem) => {
      if (!isMuscatWarehouse) return usdAmount;
      const usdTotal = calculateItemTotal(item);
      const displayTotal = calculateItemDisplayTotal(item);
      if (usdTotal <= 1e-9) return 0;
      return Number(((usdAmount / usdTotal) * displayTotal).toFixed(3));
    },
    [isMuscatWarehouse, calculateItemTotal, calculateItemDisplayTotal],
  );

  /** Convert an on-screen OMR amount back to USD for storage/API (Muscat only). */
  const displayToUsdForLine = useCallback(
    (displayAmount: number, item: CartItem) => {
      if (!isMuscatWarehouse) return displayAmount;
      const usdTotal = calculateItemTotal(item);
      const displayTotal = calculateItemDisplayTotal(item);
      if (displayTotal <= 1e-9) return 0;
      return Number(((displayAmount / displayTotal) * usdTotal).toFixed(3));
    },
    [isMuscatWarehouse, calculateItemTotal, calculateItemDisplayTotal],
  );

  const getLineTotalForDisplay = useCallback(
    (item: CartItem) =>
      isMuscatWarehouse ? calculateItemDisplayTotal(item) : calculateItemTotal(item),
    [isMuscatWarehouse, calculateItemDisplayTotal, calculateItemTotal],
  );

  const uiSubtotal = isMuscatWarehouse ? displayCartCalcs.subtotal : subtotal;
  const uiGlobalDiscountAmount = isMuscatWarehouse ? displayCartCalcs.globalDiscountAmount : globalDiscountAmount;
  const uiTax = isMuscatWarehouse ? displayCartCalcs.tax : tax;
  const uiTotal = isMuscatWarehouse ? displayCartCalcs.total : total;
  const uiTotalPaidAmount = useMemo(() => {
    if (!isMuscatWarehouse) return totalPaidAmount;
    return Number(
      cart.reduce((sum, item) => sum + usdToDisplayForLine(item.paid_amount, item), 0).toFixed(3),
    );
  }, [isMuscatWarehouse, cart, totalPaidAmount, usdToDisplayForLine]);
  const uiTotalUnpaidAmount = useMemo(() => {
    if (!isMuscatWarehouse) return totalUnpaidAmount;
    return Number(Math.max(0, uiTotal - uiTotalPaidAmount).toFixed(3));
  }, [isMuscatWarehouse, totalUnpaidAmount, uiTotal, uiTotalPaidAmount]);

  const uiTodaySales = useMemo(() => {
    if (!isMuscatWarehouse || todaySales <= 0) return todaySales;
    const rateProduct =
      cart.find((item) => {
        const usd = parseFloat(item.product.price || item.product.latest_price || "0");
        const omr = parseFloat(item.product.price_omr || item.product.latest_price_omr || "0");
        return usd > 0 && omr > 0;
      })?.product ||
      products.find((product) => {
        const usd = parseFloat(product.price || product.latest_price || "0");
        const omr = parseFloat(product.price_omr || product.latest_price_omr || "0");
        return usd > 0 && omr > 0;
      });
    if (rateProduct) {
      const usd = parseFloat(rateProduct.price || rateProduct.latest_price || "0");
      const omr = parseFloat(rateProduct.price_omr || rateProduct.latest_price_omr || "0");
      if (usd > 0) return Number((todaySales * (omr / usd)).toFixed(3));
    }
    return todaySales;
  }, [isMuscatWarehouse, todaySales, cart, products]);

  const formatMoney = useCallback(
    (amount: number) => `${amount.toFixed(3)} ${getCurrencyLabel()}`,
    [getCurrencyLabel],
  );

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
      return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">{t("pos.status.paid")}</span>;
    } else if (isPartiallyPaid) {
      return <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">{t("pos.status.partial")}</span>;
    } else if (item.is_paid && item.paid_amount === 0) {
      return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">{t("pos.status.unpaid")}</span>;
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
      toast.success(t("toasts.success"), { description: t("posToasts.customerAdded") })
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
          .then(data => {
            const results = Array.isArray(data?.results)
              ? data.results
              : Array.isArray(data)
                ? data
                : []
            const inventory =
              results.find(
                (row: { product_id?: number; product?: { id?: number } }) =>
                  row.product_id === item.product.id || row.product?.id === item.product.id
              ) ?? results[0] ?? null
            return {
              productId: item.product.id,
              productName: item.product.title_en,
              quantity: item.quantity,
              inventory,
            }
          })
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

      const cartSnapshot = [...cart]

      const remainingAmount = roundedTotal - finalPaidAmount;
      const displayRemaining =
        isMuscatWarehouse && roundedTotal > 0
          ? Number(((remainingAmount / roundedTotal) * displayCartCalcs.total).toFixed(3))
          : remainingAmount;
      toast.success(t("posToasts.saleCompleted"), {
        description:
          Math.abs(remainingAmount) < 0.001
            ? t("posToasts.fullyPaid")
            : t("posToasts.amountRemaining", {
                amount: `${displayRemaining.toFixed(3)} ${getCurrencyLabel()}`,
              }),
        duration: 4500,
      })

      // Fetch invoice summary for receipt (fallback to local data if API fails — sale is already saved)
      let summary: Record<string, unknown> | null = null
      try {
        const summaryRes = await fetchWithRetry(`${API_URL}/sales/invoices/${invoiceId}/summary/`, {
          headers,
          signal: controller.signal,
        })
        if (summaryRes.ok) {
          summary = await summaryRes.json()
        }
      } catch (summaryError) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn("Invoice summary fetch failed, using local receipt data:", summaryError)
        }
      }

      if (!summary) {
        summary = {
          id: invoice.id,
          composite_id: invoice.composite_id ?? String(invoice.id),
          customer_name: selectedCustomer.institution_name,
          customer_contact: [
            selectedCustomer.contact_person,
            selectedCustomer.phone,
            selectedCustomer.email,
          ].filter(Boolean).join(" · ") || "No Contact Information",
          warehouse_name: warehouses.find((w) => w.id === selectedWarehouse)?.name_en ?? "N/A",
          invoice_type_name: invoiceTypes.find((t) => t.id === selectedInvoiceType)?.display_name_en ?? "N/A",
          payment_method_name: paymentMethods.find((m) => m.id === selectedPaymentMethod)?.display_name_en ?? "N/A",
          notes: invoiceNotes,
          created_at_formatted: format(new Date(), "PPP"),
          total_amount: roundedTotal,
          total_paid: finalPaidAmount,
          remaining_amount: remainingAmount,
          items: cartSnapshot.map((item) => ({
            product_name: item.product.title_ar || item.product.title_en,
            quantity: item.quantity,
            unit_price: parseFloat(item.product.price || item.product.latest_price || "0"),
            discount_percent: item.discount_percent,
            total_price: calculateItemTotal(item, cartSnapshot),
          })),
        }
        toast.success(t("posToasts.saleSaved"))
      }

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
      cartSnapshot.forEach(item => {
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
      
      let errorMessage = t("posToasts.saleFailed")
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
        } else if (createdPaymentId) {
          // Payment succeeded — sale is saved; never roll back for post-payment UI errors
          errorMessage =
            `${error.message} The sale was saved successfully (invoice #${invoiceId}). ` +
            "Check the Invoices page if the receipt did not appear."
        } else if (invoiceId !== undefined && headers) {
          try {
            await rollbackSaleCreation(invoiceId, createdInvoiceItemIds || [], headers, controller.signal)
            errorMessage = `${error.message} The sale has been rolled back. Please try again.`
          } catch (rollbackError) {
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
      
      handleError(
        error,
        errorMessage,
        {
          title: t("toasts.error"),
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
      <ErrorBoundary>
      <DocumentTitle title={t("pos.title")} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <PageBreadcrumb items={[dashboardCrumb, { label: t("pos.title") }]} />
          </div>
          <div className="ml-auto flex items-center gap-2 px-4">
            <PosCart
              isCartOpen={isCartOpen}
              onCartOpenChange={setIsCartOpen}
              cart={cart}
              selectedCustomer={selectedCustomer}
              filteredCustomers={filteredCustomers}
              customerSearchOpen={customerSearchOpen}
              onCustomerSearchOpenChange={setCustomerSearchOpen}
              customerSearchQuery={customerSearchQuery}
              onCustomerSearchQueryChange={setCustomerSearchQuery}
              onSelectCustomer={setSelectedCustomer}
              activeDialog={activeDialog}
              onActiveDialogChange={setActiveDialog}
              newCustomer={newCustomer}
              onNewCustomerChange={setNewCustomer}
              customerTypes={customerTypes}
              isAddingCustomer={isAddingCustomer}
              onAddCustomer={handleAddCustomer}
              selectedPaymentMethod={selectedPaymentMethod}
              paymentMethods={paymentMethods}
              isIndividualCustomer={isIndividualCustomer}
              onApplyPaymentMethodToExistingItems={applyPaymentMethodToExistingItems}
              processingItems={processingItems}
              isStoreCustomer={isStoreCustomer}
              discountPercentage={discountPercentage}
              onUpdateItemPaymentStatus={updateItemPaymentStatus}
              onUpdateQuantity={updateQuantity}
              onQuantityInputChange={handleQuantityInputChange}
              onQuantityBlur={(productId, rawValue) => {
                const parsedQuantity = parseInt(rawValue, 10)
                if (isNaN(parsedQuantity) || parsedQuantity < 1) {
                  updateQuantity(productId, 1)
                }
              }}
              onRemoveFromCart={removeFromCart}
              onUpdateItemDiscount={updateItemDiscount}
              onUpdateItemPaidAmount={updateItemPaidAmount}
              getAvailableStock={getAvailableStock}
              getDisplayPrice={getDisplayPrice}
              getCurrencyLabel={getCurrencyLabel}
              calculateItemTotal={calculateItemTotal}
              getLineTotalForDisplay={getLineTotalForDisplay}
              usdToDisplayForLine={usdToDisplayForLine}
              displayToUsdForLine={displayToUsdForLine}
              formatMoney={formatMoney}
              renderPaymentStatusBadge={getPaymentStatusBadge}
              paymentsSection={
                <PosPayments
                  selectedWarehouse={selectedWarehouse}
                  warehouses={warehouses}
                  selectedInvoiceType={selectedInvoiceType}
                  invoiceTypes={invoiceTypes}
                  onInvoiceTypeChange={setSelectedInvoiceType}
                  selectedPaymentMethod={selectedPaymentMethod}
                  paymentMethods={paymentMethods}
                  isIndividualCustomer={isIndividualCustomer}
                  onPaymentMethodChange={setSelectedPaymentMethod}
                  invoiceNotes={invoiceNotes}
                  onInvoiceNotesChange={setInvoiceNotes}
                  discountPercentage={discountPercentage}
                  onDiscountPercentageChange={setDiscountPercentage}
                  cartHasStoreItemDiscount={cartHasStoreItemDiscount}
                  isStoreCustomer={isStoreCustomer}
                  onClearStoreItemDiscounts={() =>
                    setCart((prev) => prev.map((i) => ({ ...i, discount_percent: 0 })))
                  }
                  onReallocatePayments={() => allocatePayInFullRef.current?.()}
                  taxPercentage={taxPercentage}
                  onTaxPercentageChange={setTaxPercentage}
                  formatMoney={formatMoney}
                  getCurrencyLabel={getCurrencyLabel}
                  uiSubtotal={uiSubtotal}
                  uiGlobalDiscountAmount={uiGlobalDiscountAmount}
                  uiTax={uiTax}
                  uiTotal={uiTotal}
                  uiTotalPaidAmount={uiTotalPaidAmount}
                  uiTotalUnpaidAmount={uiTotalUnpaidAmount}
                  totalPaidAmount={totalPaidAmount}
                  hasPartialPayment={hasPartialPayment}
                  paidItems={paidItems}
                  unpaidItems={unpaidItems}
                  cart={cart}
                  calculateItemTotal={calculateItemTotal}
                  cartLength={cart.length}
                  isSubmitting={isSubmitting}
                  selectedCustomer={selectedCustomer}
                  totalUnpaidAmount={totalUnpaidAmount}
                  onCompleteSale={handleCompleteSale}
                />
              }
            />
            <Button
              variant="outline"
              onClick={handleNewSale}
            >
              {t("pos.header.newSale")}
            </Button>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="min-h-[50vh] flex-1 rounded-xl bg-muted/50 p-6 md:min-h-min">
            <PosMetrics
              showMetrics={showMetrics}
              onToggleMetrics={() => setShowMetrics(!showMetrics)}
              todaySalesFormatted={formatMoney(uiTodaySales)}
              totalCustomers={totalCustomers}
              popularProduct={popularProduct}
            />
            <PosProductGrid
              searchInput={searchInput}
              onSearchInputChange={setSearchInput}
              selectedWarehouse={selectedWarehouse}
              warehouses={warehouses}
              isWarehouseDropdownOpen={isWarehouseDropdownOpen}
              onWarehouseDropdownOpenChange={setIsWarehouseDropdownOpen}
              onSelectWarehouse={(id) => setSelectedWarehouse(id)}
              onClearWarehouse={() => {
                setSelectedWarehouse(null)
                setProducts([])
              }}
              selectedGenre={selectedGenre}
              genres={genres}
              isGenreDropdownOpen={isGenreDropdownOpen}
              onGenreDropdownOpenChange={setIsGenreDropdownOpen}
              onSelectGenre={setSelectedGenre}
              isLoading={isLoading}
              products={products}
              currentPage={currentPage}
              pageSize={pageSize}
              totalPages={totalPages}
              totalCount={totalCount}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              onRetryLoadProducts={() => {
                if (selectedWarehouse) {
                  fetchProducts(selectedWarehouse, debouncedSearchInput, selectedGenre?.id || null, currentPage)
                }
              }}
              onAddToCart={addToCart}
              getDisplayPrice={getDisplayPrice}
              getCurrencyLabel={getCurrencyLabel}
              getAvailableStock={getAvailableStock}
              onImageError={handleImageError}
            />
          </div>
        </div>

        <PosCheckout
          cartLength={cart.length}
          confirmSaleOpen={confirmSaleOpen}
          onConfirmSaleOpenChange={setConfirmSaleOpen}
          selectedCustomer={selectedCustomer}
          discountPercentage={discountPercentage}
          totalPaidAmount={totalPaidAmount}
          hasPartialPayment={hasPartialPayment}
          formatMoney={formatMoney}
          getCurrencyLabel={getCurrencyLabel}
          uiSubtotal={uiSubtotal}
          uiGlobalDiscountAmount={uiGlobalDiscountAmount}
          uiTax={uiTax}
          uiTotal={uiTotal}
          uiTotalPaidAmount={uiTotalPaidAmount}
          uiTotalUnpaidAmount={uiTotalUnpaidAmount}
          totalUnpaidAmount={totalUnpaidAmount}
          isSubmitting={isSubmitting}
          selectedWarehouse={selectedWarehouse}
          onCompleteSale={handleCompleteSale}
          activeDialog={activeDialog}
          onActiveDialogChange={setActiveDialog}
          onNewSale={handleNewSale}
          onResetPaymentDefaults={() => {
            if (paymentMethods.length > 0) {
              setSelectedPaymentMethod(paymentMethods[0].id)
            }
            if (invoiceTypes.length > 0) {
              setSelectedInvoiceType(invoiceTypes[0].id)
            }
          }}
          receiptData={receiptData}
          cart={cart}
          warehouses={warehouses}
          invoiceTypes={invoiceTypes}
          selectedInvoiceType={selectedInvoiceType}
          paymentMethods={paymentMethods}
          selectedPaymentMethod={selectedPaymentMethod}
          invoiceNotes={invoiceNotes}
          isMuscatWarehouse={isMuscatWarehouse}
          getDisplayPrice={getDisplayPrice}
          getEffectiveLineDiscountPercent={getEffectiveLineDiscountPercent}
          calculateItemDisplayTotal={calculateItemDisplayTotal}
          calculateItemTotal={calculateItemTotal}
          usdToDisplayForLine={usdToDisplayForLine}
          appliesGlobalDiscountPerLine={appliesGlobalDiscountPerLine}
          taxPercentage={taxPercentage}
        />
      </SidebarInset>
  </ErrorBoundary>
  )
}
