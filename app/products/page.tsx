"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import dynamic from "next/dynamic"
import Link from "next/link"
import { AppSidebar } from "../../components/app-sidebar"
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
import {
  Edit,
  Book,
  AlertCircle,
  CheckCircle2,
  PlusCircle,
  Trash2,
  MoreHorizontal,
  Loader2,
  Search,
  ImageIcon,
  MoveRight,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { format } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import React from 'react'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { ErrorBoundary } from "@/components/ErrorBoundary"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://dararabappbackendv01-production.up.railway.app/api"

const BookDetailsDialog = dynamic(() => import("./components/book-details-dialog").then((mod) => mod.BookDetailsDialog), {
  loading: () => null,
  ssr: false,
})

const AddBookDialog = dynamic(() => import("./components/add-book-dialog").then((mod) => mod.AddBookDialog), {
  loading: () => null,
  ssr: false,
})

const TransferDialog = dynamic(() => import("./components/transfer-dialog").then((m) => m.TransferDialog), {
  loading: () => null,
  ssr: false,
})

const DeleteDialog = dynamic(() => import("./components/delete-dialog").then((m) => m.DeleteDialog), {
  loading: () => null,
  ssr: false,
})

const AddInventoryDialog = dynamic(() => import("./components/add-inventory-dialog").then((m) => m.AddInventoryDialog), {
  loading: () => null,
  ssr: false,
})

const EditBookDialog = dynamic(() => import("./components/edit-book-dialog").then((m) => m.EditBookDialog), {
  loading: () => null,
  ssr: false,
})

// Book interface
export interface PrintRun {
  id?: number;
  product: number;
  edition_number: number;
  price: number;
  price_omr: number;
  status: Status | null;
  notes: string;
  published_at?: string;
}

export interface BookInterface {
  id?: number;
  isbn: string;
  title_en: string;
  title_ar: string;
  genre: Genre | null;
  status: Status | null;
  language: Language | null;
  cover_design: string | null; // Can be file path or URL
  cover_image?: string | null; // For file uploads
  cover_url?: string | null; // For external URLs
  author: Author | null;
  translator: Translator | null;
  rights_owner: RightsOwner | null;
  reviewer: Reviewer | null;
  is_direct_product: boolean;
  print_runs: PrintRun[];
  price?: number;
  price_omr?: number;
  editions?: {
    published_at: string;
  }[];
  inventory?: Inventory[];  // Add inventory property
}

// Genre interface
export interface Genre {
  id: number;
  value: string;
  display_name_en: string;
}

// Status interface
export interface Status {
  id: number;
  value: string;
  display_name_en: string;
}

// Language interface
export interface Language {
  id: number;
  value: string;
  display_name_en: string;
}

// Warehouse interface
export interface Warehouse {
  id: number;
  name_en: string;
  name_ar: string;
  type: number | null;
  location: string;
}

// Inventory interface
export interface Inventory {
  id?: number;  // Make id optional since new inventory items won't have an id
  product: number;
  warehouse: number;
  quantity: number;
  notes: string;
  warehouse_name?: string; // For UI display
}

// Transfer interface
export interface Transfer {
  id?: number
  product: number
  from_warehouse: number
  to_warehouse: number
  quantity: number
  shipping_cost: number
  transfer_date: string
}

// Status interface for API responses
export interface StatusObject {
  id: number
  value: string
  display_name_en: string
}

export interface InventoryItem {
  warehouse: number;
  quantity: number;
}

// Add these interfaces at the top with other interfaces
export interface Author {
  id: number;
  name: string;
}

export interface Translator {
  id: number;
  name: string;
}

export interface RightsOwner {
  id: number;
  name: string;
}

export interface Reviewer {
  id: number;
  name: string;
}

export interface ProductSummary {
  id: number;
  title_ar: string;
  title_en: string;
  isbn: string;
  genre_id: number;
  status_id: number;
  genre_name: string;
  status_name: string;
  author_name: string;
  translator_name: string;
  editions_count: number;
  stock: number;
  latest_price: string;
  latest_price_omr: string;
  cover_design_url: string;
}

// Add this interface near the other interfaces
export interface NewInventory {
  warehouse: string;
  quantity: number;
}

export default function BookManagement() {
  // State for books and filters
  const [productSummaries, setProductSummaries] = useState<ProductSummary[]>([]);
  const [genres, setGenres] = useState<Genre[]>([])
  const [statusOptions, setStatusOptions] = useState<StatusObject[]>([])
  const [languages, setLanguages] = useState<Language[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedBook, setSelectedBook] = useState<BookInterface | null>(null)
  const [selectedBookInventory, setSelectedBookInventory] = useState<Inventory[]>([])
  const [isBookDetailsOpen, setIsBookDetailsOpen] = useState(false)
  const [isAddBookOpen, setIsAddBookOpen] = useState(false)
  const [isEditBookOpen, setIsEditBookOpen] = useState(false)
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
  const [isTransferOpen, setIsTransferOpen] = useState(false)
  const [isAddInventoryOpen, setIsAddInventoryOpen] = useState(false)
  const [deleteBookId, setDeleteBookId] = useState<number | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false) // Keep for backward compatibility if needed
  // Individual action loading states
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const [printRunStatusOptions, setPrintRunStatusOptions] = useState<StatusObject[]>([]);
  const [activeTab, setActiveTab] = useState("basic");
  const [actionAlert, setActionAlert] = useState<{
    type: "success" | "error" | "warning" | null
    message: string
  }>({
    type: null,
    message: "",
  })

  // New book state with default values
  const [newBook, setNewBook] = useState<BookInterface>({
    isbn: "",
    title_en: "",
    title_ar: "",
    genre: null,
    status: null,
    language: null,
    cover_design: null,
    cover_image: null,
    cover_url: null,
    is_direct_product: false,
    author: null,
    translator: null,
    rights_owner: null,
    reviewer: null,
    print_runs: []
  });

  // Transfer state
  const [transfer, setTransfer] = useState<Partial<Transfer>>({
    product: 0,
    from_warehouse: 0,
    to_warehouse: 0,
    quantity: 1,
    shipping_cost: 0,
    transfer_date: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
  })

  // New book inventory state
  const [newBookInventory, setNewBookInventory] = useState<InventoryItem[]>([])

  const [editBookInventory, setEditBookInventory] = useState<Array<{
    id?: number;
    product: number;
    warehouse: number;
    quantity: number;
    notes: string;
  }>>([]);

  // Add these state variables in the BookManagement component
  const [authors, setAuthors] = useState<Author[]>([]);
  const [translators, setTranslators] = useState<Translator[]>([]);
  const [rightsOwners, setRightsOwners] = useState<RightsOwner[]>([]);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);

  // Add this state declaration with the other useState calls
  const [newInventory, setNewInventory] = useState<NewInventory>({
    warehouse: "",
    quantity: 0,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0); // Server-side total count
  
  // Sorting state
  const [sortField, setSortField] = useState<string>("id") // Default: id
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  
  // Cache keys for localStorage
  const CACHE_KEYS = {
    BOOTSTRAP: 'products_bootstrap_data',
    BOOTSTRAP_TIMESTAMP: 'products_bootstrap_timestamp',
  }
  const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes in milliseconds
  
  // AbortController refs for request cancellation
  const abortControllerRef = useRef<AbortController | null>(null)
  const bootstrapAbortControllerRef = useRef<AbortController | null>(null)
  const aggregatedAbortControllerRef = useRef<AbortController | null>(null)
  
  // Cache for aggregated product data (keyed by product ID) - using ref to avoid dependency issues
  const productCacheRef = useRef<Map<number, {
    product: BookInterface;
    inventory: Inventory[];
    print_runs: PrintRun[];
  }>>(new Map());
  
  // Cover design input type state
  const [coverInputType, setCoverInputType] = useState<'upload' | 'url'>('upload');
  const [editCoverInputType, setEditCoverInputType] = useState<'upload' | 'url'>('upload');

  // Show alert message
  const showAlert = (type: "success" | "error" | "warning", message: string) => {
    setActionAlert({ type, message })
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setActionAlert({ type: null, message: "" })
    }, 5000)
  }

  // Headers for API requests - memoized to prevent recreation on every render
  const getHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
  }), [])

  // Retry utility function with exponential backoff
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
        
        // Don't retry on network errors if this was the last attempt
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
            }, { once: true })
          }
        })
      }
    }
    
    // If we get here, all retries failed
    throw lastError || new Error('Request failed after retries')
  }, [])

  // Fetch product summaries with server-side filtering and pagination
  const fetchProductSummaries = useCallback(async (page: number = 1, pageSizeParam: number = pageSize) => {
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    
    try {
      setIsLoading(true);
      const token = localStorage.getItem("accessToken");
      if (!token) {
        showAlert("error", "Authentication token not found");
        return;
      }

      const headers = getHeaders();
      
      // Build query parameters
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("page_size", pageSizeParam.toString());
      
      if (debouncedSearchQuery) {
        params.append("search", debouncedSearchQuery);
      }
      if (selectedGenre) {
        params.append("genre_id", selectedGenre);
      }
      if (selectedStatus) {
        params.append("status_id", selectedStatus);
      }
      
      // Add ordering parameter
      if (sortField) {
        params.append("ordering", sortField);
      }

      const response = await fetchWithRetry(`${API_URL}/inventory/product-summary/?${params.toString()}`, { 
        headers,
        signal: abortController.signal
      });
      
      // Handle 401 Unauthorized - token expired or invalid
      if (response.status === 401) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        showAlert("error", "Session expired. Please log in again.");
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
        return;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch product summaries: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Handle paginated response structure
      const results = data.results ?? [];
      const count = data.count ?? 0;
      
      setProductSummaries(results);
      setTotalCount(count);

      return { results, count };
    } catch (error) {
      // Handle AbortError silently
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching product summaries:", error);
      }
      toast({
        title: "Error",
        description: "Failed to load product summaries",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearchQuery, selectedGenre, selectedStatus, pageSize, sortField]);

  // Calculate total pages from server-side count
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Memoized lookup Maps for O(1) access instead of O(n) .find() calls
  const statusMap = useMemo(() => {
    const map = new Map<number, string>()
    statusOptions.forEach(status => {
      map.set(status.id, status.display_name_en)
    })
    return map
  }, [statusOptions])

  const genreMap = useMemo(() => {
    const map = new Map<number, string>()
    genres.forEach(genre => {
      map.set(genre.id, genre.display_name_en)
    })
    return map
  }, [genres])

  const languageMap = useMemo(() => {
    const map = new Map<number, string>()
    languages.forEach(language => {
      map.set(language.id, language.display_name_en)
    })
    return map
  }, [languages])

  // Get status name by ID - O(1) lookup using Map
  const getStatusName = useCallback((status: Status | number | null) => {
    if (!status) return 'Unknown';
    const statusId = typeof status === 'object' ? status.id : status;
    return statusMap.get(statusId) || 'Unknown';
  }, [statusMap]);

  // Get genre name by ID - O(1) lookup using Map
  const getGenreName = useCallback((genre: Genre | number | null) => {
    if (!genre) return 'Unknown';
    const genreId = typeof genre === 'object' ? genre.id : genre;
    return genreMap.get(genreId) || 'Unknown';
  }, [genreMap]);

  // Get language name by ID - O(1) lookup using Map
  const getLanguageName = useCallback((language: Language | number | null) => {
    if (!language) return 'Unknown';
    const languageId = typeof language === 'object' ? language.id : language;
    return languageMap.get(languageId) || 'Unknown';
  }, [languageMap]);

  // Fetch bootstrap data (genres, statuses, etc.) with caching
  const fetchBootstrapData = useCallback(async (forceRefresh: boolean = false) => {
    try {
      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        const cachedData = localStorage.getItem(CACHE_KEYS.BOOTSTRAP)
        const cachedTimestamp = localStorage.getItem(CACHE_KEYS.BOOTSTRAP_TIMESTAMP)
        
        if (cachedData && cachedTimestamp) {
          const timestamp = parseInt(cachedTimestamp, 10)
          const now = Date.now()
          
          // Use cached data if it's still valid (within cache duration)
          if (now - timestamp < CACHE_DURATION) {
            try {
              const data = JSON.parse(cachedData)
              setGenres(data.genres ?? [])
              setStatusOptions(data.statuses ?? [])
              setLanguages(data.languages ?? [])
              setWarehouses(data.warehouses ?? [])
              setAuthors(data.authors ?? [])
              setTranslators(data.translators ?? [])
              setRightsOwners(data.rights_owners ?? [])
              setReviewers(data.reviewers ?? [])
              setPrintRunStatusOptions(data.print_run_statuses ?? [])
              if (process.env.NODE_ENV !== 'production') {
                console.log("Using cached bootstrap data")
              }
              return data
            } catch (parseError) {
              if (process.env.NODE_ENV !== 'production') {
                console.error("Error parsing cached data:", parseError)
              }
              // Clear invalid cache and fetch fresh data
              localStorage.removeItem(CACHE_KEYS.BOOTSTRAP)
              localStorage.removeItem(CACHE_KEYS.BOOTSTRAP_TIMESTAMP)
            }
          } else {
            if (process.env.NODE_ENV !== 'production') {
              console.log("Cache expired, fetching fresh data")
            }
          }
        }
      }
      
      // Fetch fresh data from API
      const token = localStorage.getItem("accessToken");
      if (!token) {
        showAlert("error", "Authentication token not found. Please log in.");
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
        return;
      }

      const headers = getHeaders();
      
      const bootstrapRes = await fetchWithRetry(`${API_URL}/inventory/bootstrap/`, { 
        headers,
        signal: bootstrapAbortControllerRef.current?.signal
      });
      
      // Handle 401 Unauthorized - token expired or invalid
      if (bootstrapRes.status === 401) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        showAlert("error", "Session expired. Please log in again.");
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
        return;
      }
      
      if (!bootstrapRes.ok) {
        throw new Error(`Failed to fetch bootstrap data: ${bootstrapRes.status} ${bootstrapRes.statusText}`);
      }

      const data = await bootstrapRes.json();

      // Update state
      setGenres(data.genres ?? [])
      setStatusOptions(data.statuses ?? [])
      setLanguages(data.languages ?? [])
      setWarehouses(data.warehouses ?? [])
      setAuthors(data.authors ?? [])
      setTranslators(data.translators ?? [])
      setRightsOwners(data.rights_owners ?? [])
      setReviewers(data.reviewers ?? [])
      setPrintRunStatusOptions(data.print_run_statuses ?? [])
      
      // Cache the data
      try {
        localStorage.setItem(CACHE_KEYS.BOOTSTRAP, JSON.stringify(data))
        localStorage.setItem(CACHE_KEYS.BOOTSTRAP_TIMESTAMP, Date.now().toString())
        if (process.env.NODE_ENV !== 'production') {
          console.log("Bootstrap data cached successfully")
        }
      } catch (cacheError) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn("Failed to cache bootstrap data:", cacheError)
        }
        // Continue even if caching fails
      }
      
      return data
    } catch (error) {
      // Handle AbortError silently
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching bootstrap data:", error)
      }
      throw error
    }
  }, [])

  // Load bootstrap data and initial product summaries
  useEffect(() => {
    // Cancel previous bootstrap request if still pending
    if (bootstrapAbortControllerRef.current) {
      bootstrapAbortControllerRef.current.abort()
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController()
    bootstrapAbortControllerRef.current = abortController
    
    const loadBootstrapData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch bootstrap data (use cache if available)
        await fetchBootstrapData(false);

        // Fetch initial product summaries (page 1)
        await fetchProductSummaries(1, pageSize);
      } catch (error) {
        // Handle AbortError silently
        if (error instanceof Error && error.name === 'AbortError') {
          return // Request was cancelled, ignore
        }
        
        if (process.env.NODE_ENV !== 'production') {
          console.error("Error loading bootstrap data:", error);
        }
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to load data",
          variant: "destructive",
        });
        setIsLoading(false);
      }
    };
  
    loadBootstrapData();
    
    // Cleanup: abort request when component unmounts
    return () => {
      abortController.abort()
    }
  }, []); // Only run on mount

  // Debounce search query to avoid too many API requests
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms delay for better responsiveness

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Refetch product summaries when filters or page size change (reset to page 1)
  useEffect(() => {
    // Skip if bootstrap data hasn't loaded yet (genres/statuses are empty)
    if (genres.length === 0 && statusOptions.length === 0) {
      return;
    }
    
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [debouncedSearchQuery, selectedGenre, selectedStatus, pageSize, sortField]);

  // Fetch data when page changes or when filters/pageSize change
  useEffect(() => {
    // Skip if bootstrap data hasn't loaded yet
    if (genres.length === 0 && statusOptions.length === 0) {
      return;
    }
    
    fetchProductSummaries(currentPage, pageSize);
    
    // Cleanup: abort request when dependencies change or component unmounts
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [currentPage, fetchProductSummaries, pageSize]);
  
  // Cleanup: Cancel all pending requests on component unmount
  useEffect(() => {
    return () => {
      // Cancel main requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      // Cancel bootstrap requests
      if (bootstrapAbortControllerRef.current) {
        bootstrapAbortControllerRef.current.abort()
      }
      // Cancel aggregated requests
      if (aggregatedAbortControllerRef.current) {
        aggregatedAbortControllerRef.current.abort()
      }
    }
  }, [])
  
  

  // Fetch aggregated product data (with caching)
  const fetchAggregatedProduct = useCallback(async (productId: number, useCache: boolean = true) => {
    // Check cache first
    if (useCache && productCacheRef.current.has(productId)) {
      return productCacheRef.current.get(productId)!;
    }

    // Cancel previous aggregated request if still pending
    if (aggregatedAbortControllerRef.current) {
      aggregatedAbortControllerRef.current.abort()
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController()
    aggregatedAbortControllerRef.current = abortController

      const token = localStorage.getItem("accessToken");
      if (!token) {
      throw new Error("Authentication token not found");
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

    // Fetch aggregated data
    const response = await fetchWithRetry(`${API_URL}/inventory/products/${productId}/aggregated/`, { 
      headers,
      signal: abortController.signal
    });
    
    // Handle 401 Unauthorized - token expired or invalid
    if (response.status === 401) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      showAlert("error", "Session expired. Please log in again.");
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
      throw new Error("Session expired");
    }
    
    if (!response.ok) {
      // Try to get error details from response
      let errorMessage = `Failed to fetch aggregated product data: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        // If response is not JSON, use the status text
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
        
        // Process inventory data
    const processedInventory = (data.inventory ?? []).map((item: any) => {
          const wid = typeof item.warehouse === "object" ? item.warehouse.id : item.warehouse;
          const wh = warehouses.find((w) => w.id === wid);
          return {
            ...item,
            warehouse: wid,
        warehouse_name: wh?.name_en ?? item.warehouse?.name_en ?? "Unknown",
          };
        });

        // Process print runs data
    const processedPrintRuns = data.print_runs ?? [];
        
        // Determine input type based on cover_design
    const isUrlType = isUrl(data.product.cover_design);
        
    const aggregatedData = {
      product: {
        ...data.product,
          print_runs: processedPrintRuns,
        cover_url: isUrlType ? data.product.cover_design : null,
        cover_image: !isUrlType ? data.product.cover_design : null
      },
      inventory: processedInventory,
      print_runs: processedPrintRuns,
    };
        
    // Update cache
    productCacheRef.current.set(productId, aggregatedData);

    return aggregatedData;
  }, [warehouses]);
        
  // Open book details modal
  const openBookDetails = async (book: BookInterface | ProductSummary) => {
    try {
      setIsLoading(true);
      const productId = book.id!;
      
      const aggregatedData = await fetchAggregatedProduct(productId);
      
      setEditCoverInputType(isUrl(aggregatedData.product.cover_design) ? 'url' : 'upload');
      setSelectedBook(aggregatedData.product);
      setSelectedBookInventory(aggregatedData.inventory);
      setIsBookDetailsOpen(true);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error opening book details:", error);
      }
      showAlert("error", "Failed to load book details");
    } finally {
      setIsLoading(false);
    }
  };

  // Open edit book modal
  const openEditBook = async (book: BookInterface | ProductSummary) => {
    try {
      setIsLoading(true);
      const productId = book.id!;
      
      const aggregatedData = await fetchAggregatedProduct(productId);
        
      // Add warehouse information to inventory items for edit form
      const inventoryWithWarehouses = aggregatedData.inventory.map((item: any) => {
          return {
            id: item.id,
          product: item.product || productId,
          warehouse: typeof item.warehouse === "object" ? item.warehouse.id : item.warehouse,
            quantity: item.quantity,
            notes: item.notes || '',
          warehouse_name: item.warehouse_name || ''
          };
        });
      
      setEditCoverInputType(isUrl(aggregatedData.product.cover_design) ? 'url' : 'upload');
        setEditBookInventory(inventoryWithWarehouses);
      setSelectedBook({
        ...aggregatedData.product,
        inventory: inventoryWithWarehouses,
      });

      // Set active tab to basic information
      setActiveTab("basic");
      setIsEditBookOpen(true);
    } catch (error) {
      // Handle AbortError silently
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error opening edit book:", error);
      }
      showAlert("error", "Failed to load book details");
    } finally {
      setIsLoading(false);
    }
  };

  // Open transfer modal
  const openTransferModal = (book: BookInterface | ProductSummary) => {
    setSelectedBook(book as BookInterface);
    setIsTransferOpen(true);
  };

  // Open delete confirmation
  const openDeleteDialog = (bookId: number | undefined) => {
    if (!bookId) {
      showAlert("error", "Invalid book ID");
      return;
    }
    try {
      setDeleteBookId(bookId);
      setDeleteConfirm("");
      setIsDeleteAlertOpen(true);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error opening delete dialog:", error);
      }
      showAlert("error", "Failed to open delete dialog");
    }
  };

  // Close all modals
  const handleModalClose = () => {
    setIsBookDetailsOpen(false);
    setIsEditBookOpen(false);
    setIsTransferOpen(false);
    setIsAddInventoryOpen(false);
    setIsDeleteAlertOpen(false);
    resetTransfer();
  };

  // Add this function with other state management functions
  const resetTransfer = () => {
    setTransfer({
      product: 0,
      from_warehouse: 0,
      to_warehouse: 0,
      quantity: 1,
      shipping_cost: 0,
      transfer_date: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
    });
  };

  // Handle adding a new book
  const handleAddBook = async () => {
    // Validate cover URL if using URL input type
    if (coverInputType === 'url' && newBook.cover_url && !newBook.cover_url.startsWith("https://dararab.co.uk/")) {
      showAlert("error", "Cover URL must start with https://dararab.co.uk/");
      return;
    }

    setIsCreating(true);
    
    // Create optimistic book with temporary ID
    const tempId = Date.now()
    const optimisticBook: ProductSummary = {
      id: tempId,
      title_ar: newBook.title_ar,
      title_en: newBook.title_en,
      isbn: newBook.isbn,
      genre_id: newBook.genre?.id || 0,
      status_id: newBook.status?.id || 0,
      genre_name: getGenreName(newBook.genre),
      status_name: getStatusName(newBook.status),
      author_name: newBook.author?.name || "-",
      translator_name: newBook.translator?.name || "-",
      editions_count: newBook.print_runs.length,
      stock: newBookInventory.reduce((sum, inv) => sum + inv.quantity, 0),
      latest_price: newBook.print_runs[0]?.price?.toString() || "0",
      latest_price_omr: newBook.print_runs[0]?.price_omr?.toString() || "0",
      cover_design_url: newBook.cover_url || "",
    }
    
    // Optimistically add to UI immediately
    setProductSummaries(prev => [optimisticBook, ...prev])
    setTotalCount(prev => prev + 1)
    
    // Close dialog immediately for better UX
    setIsAddBookOpen(false)
    
    try {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        // Rollback: Remove optimistic book if token not found
        setProductSummaries(prev => prev.filter(book => book.id !== tempId))
        setTotalCount(prev => Math.max(0, prev - 1))
        setIsAddBookOpen(true)
        showAlert("error", "Authentication token not found");
        setIsSubmitting(false);
        return;
      }

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      // 1. Create basic book information
      const formData = new FormData();
      formData.append("isbn", newBook.isbn);
      formData.append("title_en", newBook.title_en);
      formData.append("title_ar", newBook.title_ar);
      if (newBook.genre?.id) formData.append("genre_id", newBook.genre.id.toString());
      if (newBook.status?.id) formData.append("status_id", newBook.status.id.toString());
      if (newBook.language?.id) formData.append("language_id", newBook.language.id.toString());
      if (newBook.author?.id) formData.append("author_id", newBook.author.id.toString());
      if (newBook.translator?.id) formData.append("translator_id", newBook.translator.id.toString());
      if (newBook.rights_owner?.id) formData.append("rights_owner_id", newBook.rights_owner.id.toString());
      if (newBook.reviewer?.id) formData.append("reviewer_id", newBook.reviewer.id.toString());
      formData.append("is_direct_product", newBook.is_direct_product.toString());
      
      // Handle cover design - either file upload or URL
      if (coverInputType === 'upload' && newBook.cover_image) {
        // Convert base64 to file if needed
        if (typeof newBook.cover_image === 'string' && newBook.cover_image.startsWith('data:')) {
          const response = await fetch(newBook.cover_image);
          const blob = await response.blob();
          const file = new File([blob], 'cover.jpg', { type: 'image/jpeg' });
          formData.append("cover_design", file);
        } else {
          formData.append("cover_design", newBook.cover_image);
        }
      } else if (coverInputType === 'url' && newBook.cover_url) {
        formData.append("cover_design", newBook.cover_url);
      }

      const basicInfoResponse = await fetchWithRetry(`${API_URL}/inventory/products/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!basicInfoResponse.ok) {
        const errorData = await basicInfoResponse.json();
        throw new Error(errorData.message || "Failed to create basic information");
      }

      const createdBook = await basicInfoResponse.json();

      // 2. Create print runs using bulk endpoint
      if (newBook.print_runs.length > 0) {
        const printRunData = newBook.print_runs.map(printRun => ({
          product_id: createdBook.id,
          edition_number: printRun.edition_number,
          price: printRun.price,
          price_omr: printRun.price_omr,
          status_id: printRun.status?.id,
          notes: printRun.notes,
          published_at: printRun.published_at,
        }));

        const printRunResponse = await fetchWithRetry(
          `${API_URL}/inventory/print-runs/bulk/`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(printRunData),
          }
        );

        if (!printRunResponse.ok) {
          const errorData = await printRunResponse.json();
          throw new Error(errorData.detail || errorData.message || "Failed to create print runs");
        }
      }

      // 3. Create inventory using bulk endpoint
      if (newBookInventory.length > 0) {
        const inventoryData = newBookInventory.map(item => ({
          product_id: createdBook.id,
          warehouse_id: item.warehouse,
          quantity: item.quantity,
          notes: '',
        }));

        const inventoryResponse = await fetchWithRetry(
          `${API_URL}/inventory/inventory/bulk/`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(inventoryData),
          }
        );

        if (!inventoryResponse.ok) {
          const errorData = await inventoryResponse.json();
          throw new Error(errorData.detail || errorData.message || "Failed to create inventory");
        }
      }

      // Replace optimistic book with server response
      const serverBook: ProductSummary = {
        id: createdBook.id,
        title_ar: createdBook.title_ar,
        title_en: createdBook.title_en,
        isbn: createdBook.isbn,
        genre_id: createdBook.genre?.id || createdBook.genre_id || 0,
        status_id: createdBook.status?.id || createdBook.status_id || 0,
        genre_name: getGenreName(createdBook.genre || createdBook.genre_id),
        status_name: getStatusName(createdBook.status || createdBook.status_id),
        author_name: createdBook.author?.name || "-",
        translator_name: createdBook.translator?.name || "-",
        editions_count: createdBook.print_runs?.length || newBook.print_runs.length,
        stock: createdBook.stock || newBookInventory.reduce((sum, inv) => sum + inv.quantity, 0),
        latest_price: createdBook.latest_price || newBook.print_runs[0]?.price?.toString() || "0",
        latest_price_omr: createdBook.latest_price_omr || newBook.print_runs[0]?.price_omr?.toString() || "0",
        cover_design_url: createdBook.cover_design_url || newBook.cover_url || "",
      }
      
      setProductSummaries(prev => prev.map(book => book.id === tempId ? serverBook : book))

      // Reset form
      setNewBook({
        isbn: "",
        title_en: "",
        title_ar: "",
        genre: null,
        status: null,
        language: null,
        cover_design: null,
        cover_image: null,
        cover_url: null,
        author: null,
        translator: null,
        rights_owner: null,
        reviewer: null,
        is_direct_product: false,
        print_runs: [],
      });
      setCoverInputType('upload');
      setNewBookInventory([]);
      
      showAlert("success", "Book created successfully");
      
      // Refresh to ensure consistency
      await fetchProductSummaries(currentPage, pageSize);
    } catch (error: any) {
      // Handle AbortError silently
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      
      // Rollback: Remove optimistic book on error
      setProductSummaries(prev => prev.filter(book => book.id !== tempId))
      setTotalCount(prev => Math.max(0, prev - 1))
      
      // Reopen dialog so user can retry
      setIsAddBookOpen(true)
      
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error creating book:", error);
      }
      showAlert("error", error.message || "Failed to create book");
    } finally {
      setIsCreating(false);
    }
  };

  // 1) Basic info
async function handleUpdateBasic() {
  if (!selectedBook?.id) return;
  
  // Validate cover URL if using URL input type
  if (editCoverInputType === 'url' && selectedBook.cover_url && !selectedBook.cover_url.startsWith("https://dararab.co.uk/")) {
    showAlert("error", "Cover URL must start with https://dararab.co.uk/");
    return;
  }
  
  const formData = new FormData();
  
  // Required fields
  formData.append("isbn", selectedBook.isbn);
  formData.append("title_ar", selectedBook.title_ar);
  formData.append("title_en", selectedBook.title_en);
  
  // Optional fields with null handling
  if (selectedBook.genre?.id) {
    formData.append("genre_id", selectedBook.genre.id.toString());
  }
  if (selectedBook.status?.id) {
    formData.append("status_id", selectedBook.status.id.toString());
  }
  if (selectedBook.language?.id) {
    formData.append("language_id", selectedBook.language.id.toString());
  }
  if (selectedBook.author?.id) {
    formData.append("author_id", selectedBook.author.id.toString());
  }
  if (selectedBook.translator?.id) {
    formData.append("translator_id", selectedBook.translator.id.toString());
  }
  if (selectedBook.rights_owner?.id) {
    formData.append("rights_owner_id", selectedBook.rights_owner.id.toString());
  }
  if (selectedBook.reviewer?.id) {
    formData.append("reviewer_id", selectedBook.reviewer.id.toString());
  }
  
  // Boolean field
  formData.append("is_direct_product", selectedBook.is_direct_product.toString());
  
  // Handle cover design - either file upload or URL
  if (editCoverInputType === 'upload' && selectedBook.cover_image) {
    // Convert base64 to file if needed
    if (typeof selectedBook.cover_image === 'string' && selectedBook.cover_image.startsWith('data:')) {
      const response = await fetch(selectedBook.cover_image);
      const blob = await response.blob();
      const file = new File([blob], 'cover.jpg', { type: 'image/jpeg' });
      formData.append("cover_design", file);
    } else {
      formData.append("cover_design", selectedBook.cover_image);
    }
  } else if (editCoverInputType === 'url' && selectedBook.cover_url) {
    formData.append("cover_design", selectedBook.cover_url);
  }

  // Log the data being sent
  const res = await fetchWithRetry(
    `${API_URL}/inventory/products/${selectedBook.id}/`,
    { 
      method: "PUT", 
      headers: { 
        Authorization: `Bearer ${localStorage.getItem("accessToken")}` 
      }, 
      body: formData 
    }
  );
  
  if (!res.ok) {
    const errorData = await res.json();
    if (process.env.NODE_ENV !== 'production') {
      console.error('Update error:', errorData);
    }
    throw new Error(errorData.message || "Failed to update basic info");
  }

  // After successful update, refresh the product summaries with current filters and pagination
  await fetchProductSummaries(currentPage, pageSize);
}

async function handleUpdateDetails() {
  if (!selectedBook?.id) return;
  const token = localStorage.getItem("accessToken");
  if (!token) {
    showAlert("error", "Authentication token not found");
      return;
    }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }

  try {
    // Use bulk endpoint for print runs
    if (selectedBook.print_runs && selectedBook.print_runs.length > 0) {
      const printRunData = selectedBook.print_runs.map(run => ({
        id: run.id || undefined,
          product_id: selectedBook.id,
          edition_number: run.edition_number,
          price: run.price,
          price_omr: run.price_omr,
          status_id: run.status?.id,
          notes: run.notes,
          published_at: run.published_at,
      }));

        const response = await fetchWithRetry(
        `${API_URL}/inventory/print-runs/bulk/`,
        { method: 'POST', headers, body: JSON.stringify(printRunData) }
      );

        if (!response.ok) {
          const errorData = await response.json();
          if (process.env.NODE_ENV !== 'production') {
            console.error('Bulk update failed:', errorData);
          }
          throw new Error(errorData.detail || errorData.message || "Failed to update print runs");
      }
    }

    showAlert("success", "Print runs synchronized successfully")
  } catch (error: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error in handleUpdateDetails:', error)
    }
    showAlert("error", error.message)
    throw error
  }
}



// 3) Inventory & warehouses
async function handleUpdateInventory() {
  if (!selectedBook) return;

  const token = localStorage.getItem("accessToken");
  if (!token) {
    showAlert("error", "Authentication required");
      return;
    }
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  try {
    // Use bulk endpoint for inventory
    if (selectedBookInventory.length > 0) {
      const inventoryData = selectedBookInventory.map(record => ({
        id: record.id || undefined,
        product_id: selectedBook.id,
        warehouse_id: record.warehouse,
        quantity: record.quantity,
        notes: record.notes || '',
      }));

      const res = await fetchWithRetry(`${API_URL}/inventory/inventory/bulk/`, {
        method: "POST",
        headers,
        body: JSON.stringify(inventoryData),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (process.env.NODE_ENV !== 'production') {
          console.error("Bulk inventory update failed:", errData);
        }
        throw new Error(errData.detail || errData.message || "Failed to update inventory");
      }
    }

    // Re-fetch aggregated data to sync UI and update cache
    if (selectedBook.id) {
      const aggregatedData = await fetchAggregatedProduct(selectedBook.id, false);
      setSelectedBookInventory(aggregatedData.inventory);
    }

    showAlert("success", "Inventory saved successfully");
  } catch (err: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.error("Inventory error:", err);
    }
    showAlert("error", err.message);
  }
}


  // Handle column header click for sorting
  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      // Toggle between asc and desc
      const newOrder = sortOrder === "asc" ? "desc" : "asc"
      setSortOrder(newOrder)
      setSortField(newOrder === "asc" ? field : `-${field}`)
    } else if (sortField === `-${field}`) {
      // Currently descending, switch to ascending
      setSortOrder("asc")
      setSortField(field)
    } else {
      // New field, default to descending
      setSortOrder("desc")
      setSortField(`-${field}`)
    }
  }, [sortField, sortOrder])

  // Get sort indicator for a column
  const getSortIndicator = useCallback((field: string) => {
    const isActive = sortField === field || sortField === `-${field}`
    if (!isActive) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-30" />
    }
    if (sortField === `-${field}`) {
      return <ArrowDown className="h-4 w-4 ml-1" />
    }
    return <ArrowUp className="h-4 w-4 ml-1" />
  }, [sortField])

  const resetFilters = () => {
    setSearchQuery("")
    setSelectedGenre(null)
    setSelectedStatus(null)
    setCurrentPage(1)
    setSortField("id")
    setSortOrder("asc")
  }

  // Helper function to get full image URL
  const getImageUrl = (url: string | null) => {
    if (!url) return "/placeholder.svg"
    if (url.startsWith('http')) return url
    // Remove any leading slash to avoid double slashes
    const cleanUrl = url.startsWith('/') ? url.slice(1) : url
    // Construct the full URL using the API base URL
    return `${API_URL.replace('/api', '')}${cleanUrl}`
  }

  // Helper function to check if a string is a URL
  const isUrl = (str: string | null) => {
    if (!str) return false
    try {
      new URL(str)
      return true
    } catch {
      return false
    }
  }

  // Handle adding inventory
  const handleAddInventory = async () => {
    if (!selectedBook) return;

    try {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        showAlert("error", "Authentication token not found");
        return;
      }

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      // Create new inventory item
      const payload = {
        product: selectedBook.id,
        warehouse: newInventory.warehouse,
        quantity: newInventory.quantity,
      };

      const response = await fetchWithRetry(`${API_URL}/inventory/inventory/`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create inventory");
      }

      // Refresh the inventory data
      const inventoryResponse = await fetchWithRetry(
        `${API_URL}/inventory/inventory/?product_id=${selectedBook.id}`,
        { headers }
      );

      if (!inventoryResponse.ok) {
        throw new Error("Failed to refresh inventory data");
      }

      const inventoryData = await inventoryResponse.json();
      const invArr = Array.isArray(inventoryData) ? inventoryData : inventoryData.results ?? [];

      const enhancedInventory = invArr.map((item: any) => {
        const wid = typeof item.warehouse === "object"
          ? item.warehouse.id
          : item.warehouse;
        const wh = warehouses.find((w) => w.id === wid);
        return {
          ...item,
          warehouse: wid,
          warehouse_name: wh?.name_en ?? "Unknown",
        };
      });

      setSelectedBookInventory(enhancedInventory);
      setNewInventory({ warehouse: "", quantity: 0 });
      showAlert("success", "Inventory added successfully");
    } catch (error: any) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error adding inventory:", error);
      }
      showAlert("error", error.message || "Failed to add inventory");
    }
  };

  const handleUpdatePrintRun = async (productId: number, printRun: PrintRun) => {
    try {
      const response = await fetchWithRetry(`${API_URL}/inventory/products/${productId}/print-runs/update/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(printRun),
      });

      if (!response.ok) {
        throw new Error('Failed to update print run');
      }

      const updatedPrintRun = await response.json();
      return updatedPrintRun;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error updating print run:', error);
      }
      throw error;
    }
  };

  const handleDeletePrintRun = async (productId: number, editionNumber: number) => {
    try {
      const response = await fetchWithRetry(`${API_URL}/inventory/products/${productId}/print-runs/delete/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ edition_number: editionNumber }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete print run');
      }

      return true;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error deleting print run:', error);
      }
      throw error;
    }
  };

  const handleDeleteBook = async () => {
    if (!deleteBookId) return;
    
    setIsDeleting(true);
    
    // Store book for rollback
    const bookToDelete = productSummaries.find(book => book.id === deleteBookId)
    if (!bookToDelete) {
      setIsDeleting(false);
      return;
    }
    
    // Optimistically remove from UI immediately
    setProductSummaries(prev => prev.filter(book => book.id !== deleteBookId))
    setTotalCount(prev => Math.max(0, prev - 1))
    
    // Close dialog immediately for better UX
    setIsDeleteAlertOpen(false);
    const deletedId = deleteBookId;
    setDeleteBookId(null);
    setDeleteConfirm("");
    
    try {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        showAlert("error", "Authentication token not found");
        return;
      }

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const response = await fetchWithRetry(`${API_URL}/inventory/products/${deletedId}/delete/`, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete book");
      }

      showAlert("success", "Book deleted successfully");
      
      // Refresh to ensure consistency
      await fetchProductSummaries(currentPage, pageSize);
    } catch (error: any) {
      // Handle AbortError silently
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      
      // Rollback: Restore book on error
      setProductSummaries(prev => {
        const index = prev.findIndex(book => book.id === deletedId)
        if (index === -1) {
          // Book not found, add it back at the beginning
          return [bookToDelete, ...prev]
        }
        return prev
      })
      setTotalCount(prev => prev + 1)
      
      // Reopen dialog so user can retry
      setDeleteBookId(deletedId)
      setIsDeleteAlertOpen(true)
      
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error deleting book:", error);
      }
      showAlert("error", error.message || "Failed to delete book");
    } finally {
      setIsDeleting(false);
    }
  };

  // Refresh data using server-side filtering and pagination
  const refreshData = async () => {
    await fetchProductSummaries(currentPage, pageSize);
  };

  // Update handleSaveChanges to use refreshData
  const handleSaveChanges = async () => {
    if (!selectedBook?.id) return;
    
    // Validate cover URL if using URL input type
    if (editCoverInputType === 'url' && selectedBook?.cover_url && !selectedBook.cover_url.startsWith("https://dararab.co.uk/")) {
      showAlert("error", "Cover URL must start with https://dararab.co.uk/");
      return;
    }

    setIsUpdating(true);
    
    // Store original book for rollback
    const originalBook = productSummaries.find(book => book.id === selectedBook.id)
    if (!originalBook) {
      setIsUpdating(false);
      return;
    }
    
    // Create optimistic update
    const optimisticBook: ProductSummary = {
      id: selectedBook.id,
      title_ar: selectedBook.title_ar || "",
      title_en: selectedBook.title_en || "",
      isbn: selectedBook.isbn || "",
      genre_id: selectedBook.genre?.id || 0,
      status_id: selectedBook.status?.id || 0,
      genre_name: getGenreName(selectedBook.genre),
      status_name: getStatusName(selectedBook.status),
      author_name: selectedBook.author?.name || "-",
      translator_name: selectedBook.translator?.name || "-",
      editions_count: selectedBook.print_runs?.length || 0,
      stock: originalBook.stock, // Keep original stock
      latest_price: originalBook.latest_price, // Keep original price
      latest_price_omr: originalBook.latest_price_omr, // Keep original price OMR
      cover_design_url: selectedBook.cover_url || originalBook.cover_design_url || "",
    }
    
    // Optimistically update UI immediately
    setProductSummaries(prev => prev.map(book => book.id === selectedBook.id ? optimisticBook : book))
    
    // Close dialog immediately for better UX
    setIsEditBookOpen(false);
    
    try {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        showAlert("error", "Authentication token not found");
        return;
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Update book details
      const bookRes = await fetchWithRetry(`${API_URL}/inventory/products/${selectedBook.id}/`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          title_en: selectedBook.title_en,
          title_ar: selectedBook.title_ar,
          isbn: selectedBook.isbn,
          genre_id: selectedBook.genre?.id,
          status_id: selectedBook.status?.id,
          language_id: selectedBook.language?.id,
          author_id: selectedBook.author?.id,
          translator_id: selectedBook.translator?.id,
          rights_owner_id: selectedBook.rights_owner?.id,
          reviewer_id: selectedBook.reviewer?.id,
          is_direct_product: selectedBook.is_direct_product,
        }),
      });

      if (!bookRes.ok) {
        const errorData = await bookRes.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update book");
      }
      
      const bookResData = await bookRes.json();

      // Update print runs using bulk endpoint
      if (selectedBook.print_runs && selectedBook.print_runs.length > 0) {
        const printRunData = selectedBook.print_runs.map(printRun => ({
          id: printRun.id || undefined,
          product_id: selectedBook.id,
              edition_number: printRun.edition_number,
              price: printRun.price,
              price_omr: printRun.price_omr,
              status_id: printRun.status?.id,
              notes: printRun.notes,
              published_at: printRun.published_at,
        }));

        const printRunResponse = await fetchWithRetry(`${API_URL}/inventory/print-runs/bulk/`, {
            method: 'POST',
            headers,
          body: JSON.stringify(printRunData),
        });

        if (!printRunResponse.ok) {
          const errorData = await printRunResponse.json();
          throw new Error(errorData.detail || errorData.message || "Failed to update print runs");
        }
      }

      // Update inventory items using bulk endpoint
      if (editBookInventory.length > 0) {
        const inventoryData = editBookInventory.map(item => ({
          id: item.id || undefined,
              product_id: selectedBook.id,
              warehouse_id: item.warehouse,
              quantity: item.quantity,
              notes: item.notes || '',
        }));

        const inventoryResponse = await fetchWithRetry(`${API_URL}/inventory/inventory/bulk/`, {
            method: 'POST',
            headers,
          body: JSON.stringify(inventoryData),
          });

        if (!inventoryResponse.ok) {
          const errorData = await inventoryResponse.json();
          throw new Error(errorData.detail || errorData.message || "Failed to update inventory");
        }
      }

      // Replace with server response to ensure consistency
      const updatedBook: ProductSummary = {
        id: bookResData.id,
        title_ar: bookResData.title_ar,
        title_en: bookResData.title_en,
        isbn: bookResData.isbn,
        genre_id: bookResData.genre?.id || bookResData.genre_id || 0,
        status_id: bookResData.status?.id || bookResData.status_id || 0,
        genre_name: getGenreName(bookResData.genre || bookResData.genre_id),
        status_name: getStatusName(bookResData.status || bookResData.status_id),
        author_name: bookResData.author?.name || "-",
        translator_name: bookResData.translator?.name || "-",
        editions_count: bookResData.print_runs?.length || selectedBook.print_runs?.length || 0,
        stock: bookResData.stock ?? originalBook.stock,
        latest_price: bookResData.latest_price || originalBook.latest_price,
        latest_price_omr: bookResData.latest_price_omr || originalBook.latest_price_omr,
        cover_design_url: bookResData.cover_design_url || selectedBook.cover_url || originalBook.cover_design_url || "",
      }
      
      setProductSummaries(prev => prev.map(book => book.id === selectedBook.id ? updatedBook : book))
      
      // Invalidate cache
      if (selectedBook.id) {
        productCacheRef.current.delete(selectedBook.id);
      }
      
      showAlert("success", "Book updated successfully");
      
      // Refresh to ensure consistency
      await fetchProductSummaries(currentPage, pageSize);
    } catch (error) {
      // Handle AbortError silently
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      
      // Rollback: Restore original book on error
      setProductSummaries(prev => prev.map(book => book.id === selectedBook.id ? originalBook : book))
      
      // Reopen dialog so user can retry
      setIsEditBookOpen(true)
      
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error updating book:", error);
      }
      showAlert("error", error instanceof Error ? error.message : "Failed to update book");
    } finally {
      setIsUpdating(false);
    }
  };

  // Update handleTransfer to use refreshData
  const handleTransfer = async () => {
    if (!selectedBook?.id) {
      showAlert("error", "No book selected for transfer");
      return;
    }

    try {
      setIsLoading(true);
      const token = localStorage.getItem("accessToken");
      if (!token) {
        showAlert("error", "Authentication token not found");
        return;
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // First, create the transfer record
      const transferPayload = {
        product: selectedBook.id,
        from_warehouse: transfer.from_warehouse,
        to_warehouse: transfer.to_warehouse,
        quantity: transfer.quantity,
        shipping_cost: transfer.shipping_cost,
        transfer_date: transfer.transfer_date
      };

      const transferRes = await fetchWithRetry(`${API_URL}/inventory/transfers/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(transferPayload),
      });

      if (!transferRes.ok) {
        const errorData = await transferRes.json();
        if (process.env.NODE_ENV !== 'production') {
          console.error('Transfer error:', errorData);
        }
        throw new Error(errorData.detail || "Failed to create transfer");
      }

      // Get current inventory for both warehouses
      // Force fresh fetch before using inventory
    const fromInventoryRes = await fetchWithRetry(`${API_URL}/inventory/inventory/?product_id=${selectedBook.id}&warehouse_id=${transfer.from_warehouse}`, { headers });
    const fromData = await fromInventoryRes.json();
    const fromInventory = fromData.results?.[0];

      // const fromInventoryRes = await fetch(`${API_URL}/inventory/inventory/?product=${selectedBook.id}&warehouse=${transfer.from_warehouse}`, { headers });
      // if (!fromInventoryRes.ok) throw new Error("Failed to fetch source warehouse inventory");
      // const fromInventoryData = await fromInventoryRes.json();
      // const fromInventory = Array.isArray(fromInventoryData) ? fromInventoryData[0] : fromInventoryData.results?.[0];

      // const toInventoryRes = await fetch(`${API_URL}/inventory/inventory/?product=${selectedBook.id}&warehouse=${transfer.to_warehouse}`, { headers });
      // if (!toInventoryRes.ok) throw new Error("Failed to fetch destination warehouse inventory");
      // const toInventoryData = await toInventoryRes.json();
      // const toInventory = toInventoryData?.[0];
      //const toInventory = Array.isArray(toInventoryData) ? toInventoryData[0] : toInventoryData.results?.[0];

      const toRes = await fetchWithRetry(`${API_URL}/inventory/inventory/?product_id=${selectedBook.id}&warehouse_id=${transfer.to_warehouse}`, {
      headers,
    });
      const toData = await toRes.json();
      const toInventory = toData.results.find((inv: { warehouse?: { id: number } }) => inv.warehouse?.id === transfer.to_warehouse);


      const transferQuantity = transfer.quantity || 0;

      // Update source warehouse inventory using the product-specific endpoint
      if (fromInventory) {
        const newFromQuantity = fromInventory.quantity - transferQuantity;
        if (newFromQuantity < 0) {
          throw new Error("Insufficient quantity in source warehouse");
        }
        const updateFromRes = await fetchWithRetry(`${API_URL}/inventory/inventory/product/${selectedBook.id}/update/`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            product_id: selectedBook.id,
            warehouse_id: transfer.from_warehouse,
            quantity: newFromQuantity,
            notes: fromInventory.notes || ''
          }),
        });
        if (!updateFromRes.ok) {
          const errorData = await updateFromRes.json();
          if (process.env.NODE_ENV !== 'production') {
            console.error('Update source inventory error:', errorData);
          }
          throw new Error(errorData.detail || "Failed to update source warehouse inventory");
        }
      }
      // Update destination warehouse inventory using the product-specific endpoint
      if (toInventory) {
  const newToQuantity = (toInventory?.quantity || 0) + (transfer.quantity || 0);
  
  const updateToRes = await fetchWithRetry(`${API_URL}/inventory/inventory/product/${selectedBook.id}/update/`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      product_id: selectedBook.id,
      warehouse_id: transfer.to_warehouse,
      quantity: newToQuantity,
      notes: toInventory.notes || ''
    }),
  });

  if (!updateToRes.ok) {
    const errorData = await updateToRes.json();
    if (process.env.NODE_ENV !== 'production') {
      console.error('Update destination inventory error:', errorData);
    }
    throw new Error(errorData.detail || "Failed to update destination warehouse inventory");
  }
} else {
  // Create new destination inventory
  const createToRes = await fetchWithRetry(`${API_URL}/inventory/inventory/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      product_id: selectedBook.id,
      warehouse_id: transfer.to_warehouse,
      quantity: transferQuantity,
      notes: ''
    }),
  });

  if (!createToRes.ok) {
    const errorData = await createToRes.json();
    if (process.env.NODE_ENV !== 'production') {
      console.error('Create destination inventory error:', errorData);
    }
    throw new Error(errorData.detail || "Failed to create destination warehouse inventory");
  }
}


      // Refresh product summaries with current filters and pagination
      await fetchProductSummaries(currentPage, pageSize);
      
      // Refresh inventory data for the selected book
      const inventoryRes = await fetchWithRetry(`${API_URL}/inventory/inventory/?product=${selectedBook.id}`, { headers });
      if (inventoryRes.ok) {
      const inventoryData = await inventoryRes.json();
        const updatedInventory = Array.isArray(inventoryData) ? inventoryData : inventoryData.results ?? [];
        if (selectedBook) {
        setSelectedBook({
          ...selectedBook,
          inventory: updatedInventory
        });
        }
      }

      // Reset transfer form and close modal
      resetTransfer();
      setIsTransferOpen(false);
      showAlert("success", "Transfer completed successfully");

      // Data already refreshed above
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error creating transfer:", error);
      }
      showAlert("error", error instanceof Error ? error.message : "Failed to create transfer");
    } finally {
      setIsTransferring(false);
    }
  };

  // Update the warehouse find function type
  const findWarehouse = (warehouses: Warehouse[], wid: number): Warehouse | undefined => {
    return warehouses.find((w: Warehouse) => w.id === wid);
  };

  // Update the handleAddPrintRun function with proper type checking
  const handleAddPrintRun = () => {
    if (!selectedBook || !selectedBook.id) return;
    
    const newEdition: PrintRun = {
      product: selectedBook.id,
      edition_number: selectedBook.print_runs.length + 1,
      price: 0,
      price_omr: 0,
      status: null,
      notes: "",
    };

    const updatedBook: BookInterface = {
      ...selectedBook,
      print_runs: [...selectedBook.print_runs, newEdition],
    };

    setSelectedBook(updatedBook);
  };

  
  // Update the inventory item handling functions
  const handleInventoryItemChange = (index: number, field: string, value: any) => {
    if (!selectedBookInventory) return;
    
    const updatedInventory = [...selectedBookInventory];
    updatedInventory[index] = {
      ...updatedInventory[index],
      [field]: value
    };
    setSelectedBookInventory(updatedInventory);
  };

  const handleRemoveInventoryItem = (index: number) => {
    if (!selectedBookInventory) return;
    
    const updatedInventory = selectedBookInventory.filter((_, i) => i !== index);
    setSelectedBookInventory(updatedInventory);
  };

  const handleAddInventoryItem = () => {
    const newItem = {
      product: selectedBook?.id || 0,
      warehouse: warehouses[0]?.id || 0,
      quantity: 0,
      notes: ""
    };
    
    if (isEditBookOpen) {
      setEditBookInventory([...editBookInventory, newItem]);
    } else if (selectedBookInventory) {
      setSelectedBookInventory([...selectedBookInventory, newItem]);
    }
  };

  // Virtualization setup for table rows
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const shouldVirtualize = productSummaries.length > 20 // Only virtualize if more than 20 items

  const rowVirtualizer = useVirtualizer({
    count: productSummaries.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 80, // Estimated row height in pixels
    overscan: 5, // Render 5 extra items above and below viewport
  })

  const virtualItems = shouldVirtualize ? rowVirtualizer.getVirtualItems() : []
  const totalSize = shouldVirtualize ? rowVirtualizer.getTotalSize() : 0

  // Update totalPages when search or filters are applied

  return (
    <ErrorBoundary>
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
                  <BreadcrumbPage>Books</BreadcrumbPage>
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h2 className="text-xl font-semibold">Book Management</h2>
                <p className="text-muted-foreground">Manage your book inventory and availability</p>
              </div>
              <Button onClick={() => setIsAddBookOpen(true)} className="bg-primary text-primary-foreground">
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Book
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by ISBN, title, author or translator..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="flex-1">
                <Select 
                  value={selectedGenre || "all"} 
                  onValueChange={(value) => {
                    setSelectedGenre(value === "all" ? null : value)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by genre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Genres</SelectItem>
                    {genres.map((genre) => (
                      <SelectItem key={genre.id} value={genre.id.toString()}>
                        {genre.display_name_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Select 
                  value={selectedStatus || "all"} 
                  onValueChange={(value) => {
                    setSelectedStatus(value === "all" ? null : value)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {statusOptions.map((status) => (
                      <SelectItem key={status.id} value={status.id.toString()}>
                        {status.display_name_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={resetFilters}>
                Reset Filters
              </Button>
            </div>

            {/* Books Table */}
            <div className="border rounded-md">
              <div className="bg-muted p-4 flex justify-between items-center">
                <h3 className="font-medium">Books</h3>
                {(searchQuery || selectedGenre || selectedStatus) && (
                  <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 px-2 text-xs">
                    Clear Filters
                  </Button>
                )}
              </div>
              <div className="p-0">
                <div 
                  className="overflow-x-auto" 
                  ref={tableContainerRef} 
                  style={{ 
                    height: shouldVirtualize ? '600px' : 'auto', 
                    overflowY: shouldVirtualize ? 'auto' : 'visible',
                    position: 'relative'
                  }}
                >
                  <table className="w-full border-collapse">
                    <thead className={shouldVirtualize ? "sticky top-0 bg-background z-10" : ""}>
                      <tr className="text-sm border-b">
                        <th 
                          className="p-3 text-left font-medium cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort("title_en")}
                        >
                          <div className="flex items-center">
                            Book
                            {getSortIndicator("title_en")}
                          </div>
                        </th>
                        <th 
                          className="p-3 text-left font-medium cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort("isbn")}
                        >
                          <div className="flex items-center">
                            ISBN
                            {getSortIndicator("isbn")}
                          </div>
                        </th>
                        <th className="p-3 text-left font-medium">Authors</th>
                        <th className="p-3 text-left font-medium">Translators</th>
                        <th className="p-3 text-left font-medium">Genre</th>
                        <th 
                          className="p-3 text-left font-medium cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort("latest_price")}
                        >
                          <div className="flex items-center">
                            Price
                            {getSortIndicator("latest_price")}
                          </div>
                        </th>
                        <th 
                          className="p-3 text-left font-medium cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort("status_id")}
                        >
                          <div className="flex items-center">
                            Status
                            {getSortIndicator("status")}
                          </div>
                        </th>
                        <th className="p-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody style={{ position: 'relative', height: shouldVirtualize && totalSize > 0 ? `${totalSize}px` : 'auto' }}>
                      {isLoading ? (
                        // Skeleton loaders matching table structure (8 rows)
                        Array.from({ length: 8 }).map((_, index) => (
                          <tr key={`skeleton-${index}`} className="border-b last:border-0">
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                <Skeleton className="h-10 w-10 rounded-md flex-shrink-0" />
                                <div className="flex-1 space-y-2">
                                  <Skeleton className="h-4 w-32" />
                                  <Skeleton className="h-3 w-24" />
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              <Skeleton className="h-4 w-24" />
                            </td>
                            <td className="p-3">
                              <Skeleton className="h-4 w-28" />
                            </td>
                            <td className="p-3">
                              <Skeleton className="h-4 w-28" />
                            </td>
                            <td className="p-3">
                              <Skeleton className="h-5 w-20" />
                            </td>
                            <td className="p-3">
                              <div className="flex flex-col gap-1">
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-3 w-20" />
                              </div>
                            </td>
                            <td className="p-3">
                              <Skeleton className="h-5 w-24" />
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-2">
                                <Skeleton className="h-8 w-8 rounded" />
                                <Skeleton className="h-8 w-8 rounded" />
                                <Skeleton className="h-8 w-8 rounded" />
                                <Skeleton className="h-8 w-8 rounded" />
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : productSummaries.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center">
                            <div className="flex flex-col items-center">
                              <Book className="h-12 w-12 text-muted-foreground mb-2" />
                              <p className="font-medium mb-1">No books found</p>
                              <p className="text-muted-foreground text-sm mb-4">
                                {searchQuery || selectedGenre || selectedStatus
                                  ? "Try adjusting your filters"
                                  : "Add your first book to get started"}
                              </p>
                              {searchQuery || selectedGenre || selectedStatus ? (
                                <Button variant="outline" size="sm" onClick={resetFilters}>
                                  Clear Filters
                                </Button>
                              ) : (
                                <Button size="sm" onClick={() => setIsAddBookOpen(true)}>
                                  <PlusCircle className="h-4 w-4 mr-2" />
                                  Add Book
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : shouldVirtualize && virtualItems.length > 0 ? (
                        <>
                          {/* Spacer for items before the first visible item */}
                          <tr>
                            <td colSpan={8} style={{ height: virtualItems[0]?.start ?? 0 }} />
                          </tr>
                          {/* Render only visible items */}
                          {virtualItems.map((virtualItem) => {
                            const book = productSummaries[virtualItem.index]
                            if (!book) return null
                            return (
                              <tr
                                key={book.id}
                                data-index={virtualItem.index}
                                ref={rowVirtualizer.measureElement}
                                className="border-b last:border-0 hover:bg-muted/50"
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  width: '100%',
                                  height: `${virtualItem.size}px`,
                                  transform: `translateY(${virtualItem.start}px)`,
                                  display: 'table-row',
                                }}
                              >
                                <td className="p-3">
                                  <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                                      {book.cover_design_url ? (
                                        <img
                                          src={book.cover_design_url}
                                          alt={`Book ${book.isbn}`}
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <div className="h-full w-full flex items-center justify-center">
                                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <p className="font-medium">{book.title_en}</p>
                                      <p className="text-xs text-muted-foreground line-clamp-1">
                                        {book.title_ar}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3">
                                  <p className="font-mono text-sm">{book.isbn}</p>
                                </td>
                                <td className="p-3">
                                  <span className="text-sm">{book.author_name || "-"}</span>
                                </td>
                                <td className="p-3">
                                  <span className="text-sm">{book.translator_name || "-"}</span>
                                </td>
                                <td className="p-3">
                                  <Badge variant="outline" className="font-normal">
                                    {book.genre_name || 'Unknown'}
                                  </Badge>
                                </td>
                                <td className="p-3">
                                  <div className="flex flex-col">
                                    <span className="font-medium">${book.latest_price || 0}</span>
                                    <span className="text-xs text-muted-foreground">PriceOMR: OMR{book.latest_price_omr || 0}</span>
                                  </div>
                                </td>
                                <td className="p-3">
                                  <Badge
                                    className={`${
                                      book.status_name === "Available"
                                        ? "bg-green-100 text-green-800 hover:bg-green-100 border-green-200"
                                        : book.status_name === "unavailable"
                                          ? "bg-red-100 text-red-800 hover:bg-red-100 border-red-200"
                                          : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200"
                                    }`}
                                  >
                                    {book.status_name || 'Unknown'}
                                  </Badge>
                                </td>
                                <td className="p-3 text-right">
                                  <div className="flex justify-end gap-2">
                                    {/* Desktop view - separate buttons */}
                                    <div className="hidden sm:flex gap-2">
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => openBookDetails(book)}
                                      >
                                        <Book className="h-4 w-4" />
                                        <span className="sr-only">View Details</span>
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => openEditBook(book)}
                                      >
                                        <Edit className="h-4 w-4" />
                                        <span className="sr-only">Edit</span>
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => openTransferModal(book)}
                                      >
                                        <MoveRight className="h-4 w-4" />
                                        <span className="sr-only">Transfer</span>
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={() => openDeleteDialog(book.id)}
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
                                          <DropdownMenuItem onClick={() => openBookDetails(book)}>
                                            <Book className="h-4 w-4 mr-2" />
                                            View Details
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => openEditBook(book)}>
                                            <Edit className="h-4 w-4 mr-2" />
                                            Edit
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => openTransferModal(book)}>
                                            <MoveRight className="h-4 w-4 mr-2" />
                                            Transfer
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            className="text-destructive"
                                            onClick={() => openDeleteDialog(book.id)}
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
                            )
                          })}
                          {/* Spacer for items after the last visible item */}
                          <tr>
                            <td colSpan={8} style={{ height: totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0) }} />
                          </tr>
                        </>
                      ) : (
                        productSummaries.map((book) => (
                          <tr key={book.id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                                  {book.cover_design_url ? (
                                    <img
                                      src={book.cover_design_url}
                                      alt={`Book ${book.isbn}`}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center">
                                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium">{book.title_en}</p>
                                  <p className="text-xs text-muted-foreground line-clamp-1">
                                    {book.title_ar}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              <p className="font-mono text-sm">{book.isbn}</p>
                            </td>
                            <td className="p-3">
                              <span className="text-sm">{book.author_name || "-"}</span>
                            </td>
                            <td className="p-3">
                              <span className="text-sm">{book.translator_name || "-"}</span>
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="font-normal">
                                {book.genre_name || 'Unknown'}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <div className="flex flex-col">
                                <span className="font-medium">${book.latest_price || 0}</span>
                                <span className="text-xs text-muted-foreground">PriceOMR: OMR{book.latest_price_omr || 0}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge
                                className={`${
                                  book.status_name === "Available"
                                    ? "bg-green-100 text-green-800 hover:bg-green-100 border-green-200"
                                    : book.status_name === "unavailable"
                                      ? "bg-red-100 text-red-800 hover:bg-red-100 border-red-200"
                                      : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200"
                                }`}
                              >
                                {book.status_name || 'Unknown'}
                              </Badge>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-2">
                                {/* Desktop view - separate buttons */}
                                <div className="hidden sm:flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openBookDetails(book)}
                                  >
                                    <Book className="h-4 w-4" />
                                    <span className="sr-only">View Details</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openEditBook(book)}
                                  >
                                    <Edit className="h-4 w-4" />
                                    <span className="sr-only">Edit</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openTransferModal(book)}
                                  >
                                    <MoveRight className="h-4 w-4" />
                                    <span className="sr-only">Transfer</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => openDeleteDialog(book.id)}
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
                                      <DropdownMenuItem onClick={() => openBookDetails(book)}>
                                        <Book className="h-4 w-4 mr-2" />
                                        View Details
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => openEditBook(book)}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => openTransferModal(book)}>
                                        <MoveRight className="h-4 w-4 mr-2" />
                                        Transfer
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => openDeleteDialog(book.id)}
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
              </div>
            </div>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Items per page:</span>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* Book Details Modal */}
      <BookDetailsDialog
        open={isBookDetailsOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleModalClose()
          }
        }}
        selectedBook={selectedBook}
        selectedBookInventory={selectedBookInventory}
        getImageUrl={getImageUrl}
        getGenreName={getGenreName}
        getLanguageName={getLanguageName}
        getStatusName={getStatusName}
        onClose={() => setIsBookDetailsOpen(false)}
        onEdit={(book) => {
          void openEditBook(book)
                      }}
        onTransfer={(book) => openTransferModal(book)}
      />

      {/* Add Book Dialog */}
      <AddBookDialog
        open={isAddBookOpen}
        onOpenChange={(open) => setIsAddBookOpen(open)}
        onClose={() => setIsAddBookOpen(false)}
        formRef={formRef}
        onSubmit={() => {
          void handleAddBook()
            }}
        newBook={newBook}
        setNewBook={setNewBook}
        coverInputType={coverInputType}
        setCoverInputType={setCoverInputType}
        genres={genres}
        statusOptions={statusOptions}
        languages={languages}
        authors={authors}
        translators={translators}
        rightsOwners={rightsOwners}
        reviewers={reviewers}
        warehouses={warehouses}
        newBookInventory={newBookInventory}
        setNewBookInventory={setNewBookInventory}
        getImageUrl={getImageUrl}
        isSubmitting={isCreating}
      />

      {/* Edit Book Dialog */}
      <EditBookDialog
        open={isEditBookOpen}
        onOpenChange={(open) => setIsEditBookOpen(open)}
        onClose={() => setIsEditBookOpen(false)}
        formRef={formRef}
        selectedBook={selectedBook}
        setSelectedBook={(b) => setSelectedBook(b)}
        activeTab={activeTab}
        setActiveTab={(v) => setActiveTab(v)}
        genres={genres}
        statusOptions={statusOptions}
        languages={languages}
        authors={authors}
        translators={translators}
        editCoverInputType={editCoverInputType}
        setEditCoverInputType={(v) => setEditCoverInputType(v)}
        printRunStatusOptions={printRunStatusOptions}
        editBookInventory={editBookInventory}
        setEditBookInventory={(v) => setEditBookInventory(v)}
        warehouses={warehouses}
        handleAddInventoryItem={handleAddInventoryItem}
        handleSaveChanges={handleSaveChanges}
        isSubmitting={isUpdating}
      />

      {/* Transfer Dialog */}
      <TransferDialog
        open={isTransferOpen}
        onOpenChange={(open) => {
          if (!open) handleModalClose()
        }}
        onClose={handleModalClose}
        selectedBook={selectedBook}
        warehouses={warehouses}
        transfer={transfer}
        setTransfer={(t) => setTransfer(t)}
        onSubmit={handleTransfer}
        isLoading={isTransferring}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteDialog
        open={isDeleteAlertOpen}
        onOpenChange={(open) => {
          if (!open) handleModalClose()
        }}
        onClose={handleModalClose}
        deleteBookId={deleteBookId}
        productSummaries={productSummaries}
        deleteConfirm={deleteConfirm}
        setDeleteConfirm={setDeleteConfirm}
        onDelete={handleDeleteBook}
        isSubmitting={isDeleting}
      />

      {/* Add Inventory Dialog */}
      <AddInventoryDialog
        open={isAddInventoryOpen}
        onOpenChange={(open) => {
          if (!open) handleModalClose()
        }}
        onClose={() => setIsAddInventoryOpen(false)}
        isAddBookOpen={isAddBookOpen}
        selectedBook={selectedBook}
        warehouses={warehouses}
        items={newBookInventory}
        setItems={setNewBookInventory}
        onSubmit={handleAddInventory}
        isSubmitting={isSubmitting}
      />
    </SidebarProvider>
    </ErrorBoundary>
  )
}
