"use client"

import Link from "next/link"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { AppSidebar } from "../../components/app-sidebar"
import ProjectContractsModal from "@/components/ProjectContractsModal"
import { ErrorBoundary } from "@/components/ErrorBoundary"
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
import { Edit, Trash2, MoreHorizontal, PlusCircle, AlertCircle, CheckCircle2, FileText, PenTool, Languages, Crown, Eye, User, Users, ArrowUpDown, ArrowUp, ArrowDown, Loader2, Package } from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { API_URL } from "@/lib/config"

interface Project {
  id: number
  title_ar: string
  title_original: string | null
  manuscript: string
  description: string
  approval_status: boolean
  progress_status: { id: number; display_name_en: string } | null
  status: { id: number; display_name_en: string } | null
  type: { id: number; display_name_en: string } | null
  author: { id: number; name: string } | null
  translator: { id: number; name: string } | null
  rights_owner: { id: number; name: string } | null
  reviewer: { id: number; name: string } | null
  has_product?: boolean
  all_contracts_closed?: boolean
}

interface Contract {
  id: number
  title: string | null
  project: {
    id: number
    title_ar: string
    title_original: string | null
  }
  contract_type: { id: number; display_name_en: string } | null
  status: { id: number; display_name_en: string } | null
  contracted_party_details?: {
    id: number
    name: string
    type: string
  }
  commission_percent: number | null
  fixed_amount: number | null
  free_copies: number | null
  contract_duration: number | null
  start_date: string | null
  end_date: string | null
  signed_by?: {
    id: number
    username: string
    first_name: string
    last_name: string
  }
  payment_schedule: string
  notes: string | null
  created_at: string
  updated_at: string
}

export default function ProjectManagement() {
  const [projects, setProjects] = useState<Project[]>([])
  const [progressOptions, setProgressOptions] = useState<{ id: number; display_name_en: string }[]>([])
  const [statusOptions, setStatusOptions] = useState<{ id: number; display_name_en: string }[]>([])
  const [typeOptions, setTypeOptions] = useState<{ id: number; display_name_en: string }[]>([])
  const [authors, setAuthors] = useState<{ id: number; name: string }[]>([])
  const [translators, setTranslators] = useState<{ id: number; name: string }[]>([])
  const [rightsOwners, setRightsOwners] = useState<{ id: number; name: string }[]>([])
  const [reviewers, setReviewers] = useState<{ id: number; name: string }[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
  const [deleteProjectId, setDeleteProjectId] = useState<number | null>(null)
  const [editProject, setEditProject] = useState<Project | null>(null)
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false)
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [actionAlert, setActionAlert] = useState<{
    type: "success" | "error" | "warning" | null
    message: string
  }>({
    type: null,
    message: "",
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isContractsLoading, setIsContractsLoading] = useState(false)
  const [isContractsModalOpen, setIsContractsModalOpen] = useState(false)
  const [selectedProjectForContracts, setSelectedProjectForContracts] = useState<Project | null>(null)
  
  // Individual action loading states
  const [isAdding, setIsAdding] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [convertingProjectId, setConvertingProjectId] = useState<number | null>(null)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [totalCount, setTotalCount] = useState(0)
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("")
  const [activeSearchQuery, setActiveSearchQuery] = useState("") // Active search query used for API calls
  const [filterApprovalStatus, setFilterApprovalStatus] = useState<string>("all") // "all", "approved", "not_approved"
  
  // Sorting state
  const [sortField, setSortField] = useState<string>("-created_at") // Default: newest first
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  
  // Cache keys for localStorage
  const CACHE_KEYS = {
    BOOTSTRAP: 'projects_bootstrap_data',
    BOOTSTRAP_TIMESTAMP: 'projects_bootstrap_timestamp',
  }
  const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes in milliseconds
  
  // AbortController refs for request cancellation
  const abortControllerRef = useRef<AbortController | null>(null)
  const contractsAbortControllerRef = useRef<AbortController | null>(null)

  // Form state for new project with default values
  const [newProject, setNewProject] = useState<Partial<Project>>({
    title_ar: "",
    title_original: "", // English Title
    manuscript: "", // Hidden field, kept for future use
    description: "",
    approval_status: true, // Default: Approved
    progress_status: null, // Will be set after options are loaded
    status: null, // Will be set after options are loaded
    type: null,
    author: null,
    translator: null,
    rights_owner: null,
    reviewer: null,
  })
  
  // Debounced handlers for form inputs (300ms delay for validation if needed)
  // Note: State updates are immediate for responsive UI, debouncing is available for future validation
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const createDebouncedHandler = useCallback((field: keyof Partial<Project>, value: string, onDebounced?: (value: string) => void) => {
    // Update state immediately for responsive UI
    setNewProject(prev => ({ ...prev, [field]: value }))
    
    // Clear previous timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }
    
    // Debounced callback (useful for validation, API calls, etc. if needed in future)
    debounceTimeoutRef.current = setTimeout(() => {
      if (onDebounced) {
        onDebounced(value)
      }
      // Future: Add validation logic here if needed
      // Example: validateField(field, value)
    }, 300)
  }, [])
  
  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  // Show alert message
  const showAlert = (type: "success" | "error" | "warning", message: string) => {
    setActionAlert({ type, message })
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setActionAlert({ type: null, message: "" })
    }, 5000)
  }

  // Memoize headers to avoid recreating on every render
  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
  }), [])

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
  }, [])

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

  const fetchProjects = useCallback(async (page?: number, pageSizeParam?: number, signal?: AbortSignal) => {
    try {
      const pageToUse = page ?? currentPage
      const pageSizeToUse = pageSizeParam ?? pageSize
      
      const params = new URLSearchParams()
      params.append("page", pageToUse.toString())
      params.append("page_size", pageSizeToUse.toString())
      
      // Add search parameter
      if (activeSearchQuery.trim()) {
        params.append("search", activeSearchQuery.trim())
      }
      
      // Add approval status filter
      if (filterApprovalStatus !== "all") {
        params.append("approval_status", filterApprovalStatus === "approved" ? "true" : "false")
      }
      
      // Add ordering parameter
      if (sortField) {
        params.append("ordering", sortField)
      }
      
      const res = await fetchWithRetry(`${API_URL}/inventory/projects/?${params.toString()}`, { 
        headers,
        signal: signal || abortControllerRef.current?.signal
      })
      
      if (!res.ok) {
        const errorText = await res.text()
        if (process.env.NODE_ENV !== 'production') {
          console.error("API Error Response:", errorText)
        }
        throw new Error(`Failed to fetch projects: ${res.status} ${res.statusText}`)
      }
      
      const data = await res.json()
      if (process.env.NODE_ENV !== 'production') {
        console.log("Projects API Response:", data) // Debug log
      }
      
      // Handle different response formats:
      // 1. Paginated response: { results: [], count: number, next: string, previous: string }
      // 2. Direct array: []
      let projectsData: Project[] = []
      let count = 0
      
      if (Array.isArray(data)) {
        // Direct array response (no pagination)
        projectsData = data
        count = data.length
      } else if (data && Array.isArray(data.results)) {
        // Paginated response
        projectsData = data.results
        count = data.count || data.results.length
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.warn("Unexpected projects data format:", data)
        }
        projectsData = []
        count = 0
      }
      
      setProjects(projectsData)
      setTotalCount(count)
    } catch (error) {
      // Don't handle AbortError - it's expected when cancelling requests
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching projects:", error)
      }
      // Set empty array on error
      setProjects([])
      setTotalCount(0)
      // Don't throw error - let other fetches continue
    }
  }, [currentPage, pageSize, activeSearchQuery, filterApprovalStatus, sortField])

  // Fetch bootstrap data (all static data in one call) with caching
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
              setProgressOptions((data.progress_options || []).sort((a: { id: number }, b: { id: number }) => a.id - b.id))
              setStatusOptions((data.status_options || []).sort((a: { id: number }, b: { id: number }) => a.id - b.id))
              setTypeOptions((data.type_options || []).sort((a: { id: number }, b: { id: number }) => a.id - b.id))
              setAuthors((data.authors || []).sort((a: { id: number }, b: { id: number }) => a.id - b.id))
              setTranslators((data.translators || []).sort((a: { id: number }, b: { id: number }) => a.id - b.id))
              setRightsOwners((data.rights_owners || []).sort((a: { id: number }, b: { id: number }) => a.id - b.id))
              setReviewers((data.reviewers || []).sort((a: { id: number }, b: { id: number }) => a.id - b.id))
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
      const res = await fetchWithRetry(`${API_URL}/inventory/projects/bootstrap/`, { 
        headers,
        signal: abortControllerRef.current?.signal
      })
      
      if (!res.ok) {
        throw new Error(`Failed to fetch bootstrap data: ${res.status} ${res.statusText}`)
      }
      
      const data = await res.json()
      
      // Update state (sorted by ID)
      setProgressOptions((data.progress_options || []).sort((a: { id: number }, b: { id: number }) => a.id - b.id))
      setStatusOptions((data.status_options || []).sort((a: { id: number }, b: { id: number }) => a.id - b.id))
      setTypeOptions((data.type_options || []).sort((a: { id: number }, b: { id: number }) => a.id - b.id))
      setAuthors((data.authors || []).sort((a: { id: number }, b: { id: number }) => a.id - b.id))
      setTranslators((data.translators || []).sort((a: { id: number }, b: { id: number }) => a.id - b.id))
      setRightsOwners((data.rights_owners || []).sort((a: { id: number }, b: { id: number }) => a.id - b.id))
      setReviewers((data.reviewers || []).sort((a: { id: number }, b: { id: number }) => a.id - b.id))
      
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
      // Don't handle AbortError - it's expected when cancelling requests
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching bootstrap data:", error)
      }
      // Set empty arrays on error
      setProgressOptions([])
      setStatusOptions([])
      setTypeOptions([])
      setAuthors([])
      setTranslators([])
      setRightsOwners([])
      setReviewers([])
      throw error
    }
  }, [])

  // Handle search button click
  const handleSearch = useCallback(() => {
    setActiveSearchQuery(searchQuery)
    setCurrentPage(1)
  }, [searchQuery])
  
  // Handle reset button click
  const handleReset = useCallback(() => {
    setSearchQuery("")
    setActiveSearchQuery("")
    setFilterApprovalStatus("all")
    setSortField("-created_at")
    setSortOrder("desc")
    setCurrentPage(1)
  }, [])
  
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
    setCurrentPage(1)
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
  
  // Reset to page 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1)
  }, [activeSearchQuery, filterApprovalStatus])
  
  // Initial data fetch on mount and when pagination changes
  useEffect(() => {
    // Cancel previous requests if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Create new AbortController for this effect
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    
    const fetchData = async () => {
      setIsLoading(true)
      try {
        // Fetch bootstrap data (static data) and projects (dynamic, paginated) in parallel
        const results = await Promise.allSettled([
          fetchBootstrapData(false), // Use cache if available
          fetchProjects(currentPage, pageSize, abortController.signal),
        ])
        
        // Check for any rejected promises
        const errors = results.filter(result => result.status === 'rejected')
        if (errors.length > 0) {
          if (process.env.NODE_ENV !== 'production') {
            console.error("Some data failed to load:", errors)
          }
          const failedCount = errors.length
          if (failedCount === results.length) {
            // All requests failed
            toast({
              title: "Error",
              description: "Failed to fetch data. Please try again later.",
              variant: "destructive",
            })
          } else {
            // Some requests failed
            toast({
              title: "Warning",
              description: `Some data failed to load (${failedCount} of ${results.length} requests)`,
              variant: "destructive",
            })
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error("Unexpected error in fetchData:", error)
        }
        toast({
          title: "Error",
          description: "Failed to fetch data",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
    
    // Cleanup: abort requests when component unmounts or dependencies change
    return () => {
      abortController.abort()
    }
  }, [currentPage, pageSize, activeSearchQuery, filterApprovalStatus, sortField, fetchProjects, fetchBootstrapData])

  // Set default values for new project after options are loaded
  useEffect(() => {
    if (progressOptions.length > 0 && statusOptions.length > 0) {
      const createdStatus = progressOptions.find((opt) => opt.display_name_en === "Created")
      const draftStatus = statusOptions.find((opt) => opt.display_name_en === "Draft")

      setNewProject((prev) => ({
        ...prev,
        progress_status: createdStatus || null,
        status: draftStatus || null,
      }))
    }
  }, [progressOptions, statusOptions])

  // Clear contracts when edit dialog is closed
  useEffect(() => {
    if (!isEditProjectOpen) {
      // Cancel any pending contracts request
      if (contractsAbortControllerRef.current) {
        contractsAbortControllerRef.current.abort()
        contractsAbortControllerRef.current = null
      }
      setContracts([])
    }
  }, [isEditProjectOpen])
  
  // Cleanup: Cancel all pending requests on component unmount
  useEffect(() => {
    return () => {
      // Cancel main requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      // Cancel contracts requests
      if (contractsAbortControllerRef.current) {
        contractsAbortControllerRef.current.abort()
      }
    }
  }, [])

  // Fetch contracts when edit dialog opens with a project
  useEffect(() => {
    if (isEditProjectOpen && editProject?.id && !isContractsLoading) {
      fetchContractsForProject(editProject.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditProjectOpen, editProject?.id])

  // Fetch contracts for a project
  const fetchContractsForProject = async (projectId: number) => {
    // Cancel previous contracts request if still pending
    if (contractsAbortControllerRef.current) {
      contractsAbortControllerRef.current.abort()
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController()
    contractsAbortControllerRef.current = abortController
    
    setIsContractsLoading(true)
    try {
      const res = await fetchWithRetry(`${API_URL}/inventory/contracts/?project_id=${projectId}`, { 
        headers,
        signal: abortController.signal
      })
      if (!res.ok) throw new Error("Failed to fetch contracts")
      const data = await res.json()
      
      // Handle different possible response formats
      let contractsData: Contract[] = []
      if (Array.isArray(data)) {
        contractsData = data
      } else if (data && data.results && Array.isArray(data.results)) {
        contractsData = data.results
      } else if (data && data.contracts && Array.isArray(data.contracts)) {
        contractsData = data.contracts
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.error("Unexpected contracts data format:", data)
        }
      }

      // Backend now handles filtering by project_id, so no client-side filtering needed
      setContracts(contractsData)
    } catch (error) {
      // Don't handle AbortError - it's expected when cancelling requests
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching contracts:", error)
      }
      setContracts([])
    } finally {
      setIsContractsLoading(false)
    }
  }

  // Get person name from contract (helper function)
  const getPersonNameFromContract = useCallback((contract: Contract) => {
    if (contract.contracted_party_details?.name) {
      return contract.contracted_party_details.name
    }
    
    // Fallback to project's assigned person
    const contractTypeName = contract.contract_type?.display_name_en.toLowerCase() || ""
    if (contractTypeName.includes('author') && editProject?.author) {
      return editProject.author.name
    }
    if (contractTypeName.includes('translator') && editProject?.translator) {
      return editProject.translator.name
    }
    if (contractTypeName.includes('rights') && editProject?.rights_owner) {
      return editProject.rights_owner.name
    }
    if (contractTypeName.includes('reviewer') && editProject?.reviewer) {
      return editProject.reviewer.name
    }
    
    return "Unknown"
  }, [editProject])

  // Memoized: Get people from contracts by type
  const peopleFromContracts = useMemo(() => {
    const getPeopleByType = (personType: string): string[] => {
      const contractsForType = contracts.filter(contract => {
        const contractTypeName = contract.contract_type?.display_name_en.toLowerCase() || ""
        return contractTypeName.includes(personType.toLowerCase())
      })
      
      // Return unique people names
      const peopleNames = contractsForType.map(contract => getPersonNameFromContract(contract))
      return [...new Set(peopleNames)] // Remove duplicates
    }

    return {
      authors: getPeopleByType('author'),
      translators: getPeopleByType('translator'),
      rightsOwners: getPeopleByType('rights'),
      reviewers: getPeopleByType('reviewer'),
    }
  }, [contracts, getPersonNameFromContract])

  // Memoized: Get other people from contracts (not author, translator, rights, reviewer)
  const otherPeopleFromContracts = useMemo(() => {
    const otherContracts = contracts.filter(contract => {
      const contractTypeName = contract.contract_type?.display_name_en.toLowerCase() || ""
      return !contractTypeName.includes('author') && 
             !contractTypeName.includes('translator') && 
             !contractTypeName.includes('rights') && 
             !contractTypeName.includes('reviewer')
    })
    
    // Group by contract type and return unique people names
    const groupedPeople: { [key: string]: string[] } = {}
    otherContracts.forEach(contract => {
      const contractType = contract.contract_type?.display_name_en || 'Unknown'
      const personName = getPersonNameFromContract(contract)
      
      if (!groupedPeople[contractType]) {
        groupedPeople[contractType] = []
      }
      if (!groupedPeople[contractType].includes(personName)) {
        groupedPeople[contractType].push(personName)
      }
    })
    
    return groupedPeople
  }, [contracts, getPersonNameFromContract])

  // Legacy function wrappers for backward compatibility (now use memoized values)
  const getPeopleFromContracts = (personType: string): string[] => {
    switch (personType.toLowerCase()) {
      case 'author':
        return peopleFromContracts.authors
      case 'translator':
        return peopleFromContracts.translators
      case 'rights':
        return peopleFromContracts.rightsOwners
      case 'reviewer':
        return peopleFromContracts.reviewers
      default:
        return []
    }
  }

  const getOtherPeopleFromContracts = () => {
    return otherPeopleFromContracts
  }

  // Memoized lookup maps for efficient O(1) lookups instead of O(n) .find() calls
  const progressOptionsMap = useMemo(() => {
    const map = new Map<number, { id: number; display_name_en: string }>()
    progressOptions.forEach((opt) => {
      map.set(opt.id, opt)
    })
    return map
  }, [progressOptions])

  const statusOptionsMap = useMemo(() => {
    const map = new Map<number, { id: number; display_name_en: string }>()
    statusOptions.forEach((opt) => {
      map.set(opt.id, opt)
    })
    return map
  }, [statusOptions])

  const typeOptionsMap = useMemo(() => {
    const map = new Map<number, { id: number; display_name_en: string }>()
    typeOptions.forEach((opt) => {
      map.set(opt.id, opt)
    })
    return map
  }, [typeOptions])

  const authorsMap = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>()
    authors.forEach((author) => {
      map.set(author.id, author)
    })
    return map
  }, [authors])

  const translatorsMap = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>()
    translators.forEach((translator) => {
      map.set(translator.id, translator)
    })
    return map
  }, [translators])

  const rightsOwnersMap = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>()
    rightsOwners.forEach((rightsOwner) => {
      map.set(rightsOwner.id, rightsOwner)
    })
    return map
  }, [rightsOwners])

  const reviewersMap = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>()
    reviewers.forEach((reviewer) => {
      map.set(reviewer.id, reviewer)
    })
    return map
  }, [reviewers])

  // Handle adding a new project
  const handleAddProject = async () => {
    setIsAdding(true)
    
    // Create optimistic project with temporary ID
    const tempId = Date.now() // Temporary ID for optimistic update
    const optimisticProject: Project = {
      id: tempId,
      title_ar: newProject.title_ar || "",
      title_original: newProject.title_original || null,
      manuscript: newProject.manuscript || "",
      description: newProject.description || "",
      approval_status: newProject.approval_status ?? false,
      progress_status: newProject.progress_status || null,
      status: newProject.status || null,
      type: newProject.type || null,
      author: newProject.author || null,
      translator: newProject.translator || null,
      rights_owner: newProject.rights_owner || null,
      reviewer: newProject.reviewer || null,
    }
    
    // Optimistically add to UI immediately
    setProjects(prev => [optimisticProject, ...prev])
    setTotalCount(prev => prev + 1)
    
    // Close dialog immediately for better UX
    setIsAddProjectOpen(false)
    
    // Reset form with default values
    const createdStatus = progressOptions.find((opt) => opt.display_name_en === "Created")
    const draftStatus = statusOptions.find((opt) => opt.display_name_en === "Draft")
    setNewProject({
      title_ar: "",
      title_original: "",
      manuscript: "",
      description: "",
      approval_status: false,
      progress_status: createdStatus || null,
      status: draftStatus || null,
      type: null,
      author: null,
      translator: null,
      rights_owner: null,
      reviewer: null,
    })
    
    try {
      // Create base data with required fields
      const formattedData: any = {
        title_ar: newProject.title_ar,
        title_original: newProject.title_original,
        manuscript: newProject.manuscript,
        description: newProject.description,
        approval_status: newProject.approval_status,
      }

      // Only add foreign key fields if they have values
      if (newProject.progress_status?.id) {
        formattedData.progress_status_id = newProject.progress_status.id
      }
      if (newProject.status?.id) {
        formattedData.status_id = newProject.status.id
      }
      if (newProject.type?.id) {
        formattedData.type_id = newProject.type.id
      }
      if (newProject.author?.id) {
        formattedData.author_id = newProject.author.id
      }
      if (newProject.translator?.id) {
        formattedData.translator_id = newProject.translator.id
      }
      if (newProject.rights_owner?.id) {
        formattedData.rights_owner_id = newProject.rights_owner.id
      }
      if (newProject.reviewer?.id) {
        formattedData.reviewer_id = newProject.reviewer.id
      }

      const abortController = new AbortController()
      const res = await fetchWithRetry(`${API_URL}/inventory/projects/`, {
        method: "POST",
        headers,
        body: JSON.stringify(formattedData),
        signal: abortController.signal,
      })

      if (!res.ok) {
        abortController.abort()
        throw new Error("Failed to add project")
      }

      const data = await res.json()
      
      // Replace optimistic project with real data from server
      setProjects(prev => prev.map(p => p.id === tempId ? data : p))
      
      // Refresh to get accurate count and ensure consistency
      await fetchProjects(currentPage, pageSize)

      // Show toast notification
      toast({
        title: "Project Added Successfully",
        description: `${data.title_ar} has been added to the system.`,
        variant: "default",
      })
    } catch (error) {
      // Handle AbortError silently
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      
      // Rollback: Remove optimistic project on error
      setProjects(prev => prev.filter(p => p.id !== tempId))
      setTotalCount(prev => Math.max(0, prev - 1))
      
      // Reopen dialog so user can retry
      setIsAddProjectOpen(true)
      setNewProject({
        title_ar: optimisticProject.title_ar,
        title_original: optimisticProject.title_original || "",
        manuscript: optimisticProject.manuscript,
        description: optimisticProject.description,
        approval_status: optimisticProject.approval_status,
        progress_status: optimisticProject.progress_status,
        status: optimisticProject.status,
        type: optimisticProject.type,
        author: optimisticProject.author,
        translator: optimisticProject.translator,
        rights_owner: optimisticProject.rights_owner,
        reviewer: optimisticProject.reviewer,
      })
      
      toast({
        title: "Error",
        description: "Failed to add project. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsAdding(false)
    }
  }

  // Handle updating a project
  const handleUpdateProject = async () => {
    if (!editProject) return

    setIsUpdating(true)
    
    // Store original project for rollback
    const originalProject = projects.find(p => p.id === editProject.id)
    if (!originalProject) {
      setIsUpdating(false)
      return
    }
    
    // Optimistically update UI immediately
    setProjects(prev => prev.map(p => p.id === editProject.id ? editProject : p))
    
    // Close dialog immediately for better UX
    setEditProject(null)
    setIsEditProjectOpen(false)
    setContracts([]) // Clear contracts when dialog is closed
    
    try {
      // Create base data with required fields
      const formattedData: any = {
        title_ar: editProject.title_ar,
        title_original: editProject.title_original,
        manuscript: editProject.manuscript,
        description: editProject.description,
        approval_status: editProject.approval_status,
      }

      // Only add foreign key fields if they have values
      if (editProject.progress_status?.id) {
        formattedData.progress_status_id = editProject.progress_status.id
      }
      if (editProject.status?.id) {
        formattedData.status_id = editProject.status.id
      }
      if (editProject.type?.id) {
        formattedData.type_id = editProject.type.id
      }
      if (editProject.author?.id) {
        formattedData.author_id = editProject.author.id
      }
      if (editProject.translator?.id) {
        formattedData.translator_id = editProject.translator.id
      }
      if (editProject.rights_owner?.id) {
        formattedData.rights_owner_id = editProject.rights_owner.id
      }
      if (editProject.reviewer?.id) {
        formattedData.reviewer_id = editProject.reviewer.id
      }

      const abortController = new AbortController()
      const res = await fetchWithRetry(`${API_URL}/inventory/projects/${editProject.id}/`, {
        method: "PUT",
        headers,
        body: JSON.stringify(formattedData),
        signal: abortController.signal,
      })

      const responseData = await res.json()

      if (!res.ok) {
        throw new Error(JSON.stringify(responseData))
      }

      // Replace with server response to ensure consistency
      setProjects(prev => prev.map(p => p.id === editProject.id ? responseData : p))

      // Show toast notification
      toast({
        title: "Project Updated Successfully",
        description: `${responseData.title_ar} has been updated.`,
        variant: "default",
      })

      // Refresh projects list to ensure consistency
      fetchProjects(currentPage, pageSize)
    } catch (error) {
      // Handle AbortError silently
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      
      // Rollback: Restore original project on error
      setProjects(prev => prev.map(p => p.id === originalProject.id ? originalProject : p))
      
      // Reopen dialog so user can retry
      setEditProject(originalProject)
      setIsEditProjectOpen(true)
      
      if (process.env.NODE_ENV !== 'production') {
        console.error("Update error:", error)
      }
      const errorMessage = error instanceof Error ? error.message : "Failed to update project"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  // Handle converting project to product
  const handleConvertToProduct = async (project: Project) => {
    setConvertingProjectId(project.id)
    setIsConverting(true)
    
    try {
      const abortController = new AbortController()
      const res = await fetchWithRetry(`${API_URL}/inventory/projects/${project.id}/convert-to-product/`, {
        method: "POST",
        headers,
        signal: abortController.signal,
      })

      const responseData = await res.json()

      if (!res.ok) {
        throw new Error(responseData.error || "Failed to convert project to product")
      }

      // Show success toast
      toast({
        title: "Project Converted Successfully",
        description: `${project.title_ar} has been converted to a product.`,
        variant: "default",
      })

      // Refresh projects list
      await fetchProjects(currentPage, pageSize)
    } catch (error) {
      // Handle AbortError silently
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.error("Conversion error:", error)
      }
      
      const errorMessage = error instanceof Error ? error.message : "Failed to convert project to product"
      toast({
        title: "Conversion Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsConverting(false)
      setConvertingProjectId(null)
    }
  }

  // Handle deleting a project
  const handleDeleteProject = async () => {
    if (deleteProjectId === null) return

    setIsDeleting(true)
    
    // Store project for rollback
    const projectToDelete = projects.find((p) => p.id === deleteProjectId)
    if (!projectToDelete) {
      setIsDeleting(false)
      return
    }
    
    // Optimistically remove from UI immediately
    setProjects(prev => prev.filter(p => p.id !== deleteProjectId))
    setTotalCount(prev => Math.max(0, prev - 1))
    
    // Close dialog immediately for better UX
    setDeleteProjectId(null)
    setIsDeleteAlertOpen(false)
    setDeleteConfirm("")
    
    try {
      const abortController = new AbortController()
      const res = await fetchWithRetry(`${API_URL}/inventory/projects/${deleteProjectId}/delete/`, {
        method: "DELETE",
        headers,
        signal: abortController.signal,
      })

      if (!res.ok) throw new Error("Failed to delete project")

      // Refresh projects list - if current page becomes empty, go to previous page
      const remainingOnPage = projects.length - 1
      if (remainingOnPage === 0 && currentPage > 1) {
        setCurrentPage(prev => prev - 1)
      } else {
        await fetchProjects(currentPage, pageSize)
      }

      // Show toast notification
      toast({
        title: "Project Deleted",
        description: `${projectToDelete.title_ar} has been permanently removed from the system.`,
        variant: "destructive",
      })
    } catch (error) {
      // Handle AbortError silently
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      
      // Rollback: Restore project on error
      setProjects(prev => {
        // Find the correct position to insert (maintain sort order)
        const index = prev.findIndex(p => p.id > projectToDelete.id)
        if (index === -1) {
          return [...prev, projectToDelete]
        }
        return [...prev.slice(0, index), projectToDelete, ...prev.slice(index)]
      })
      setTotalCount(prev => prev + 1)
      
      if (process.env.NODE_ENV !== 'production') {
        console.error("Delete error:", error)
      }
      toast({
        title: "Error",
        description: "Failed to delete project. The project has been restored.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // Open edit dialog with project data
  const openEditDialog = (project: Project) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Opening edit dialog for project ${project.id}: ${project.title_ar}`)
    }
    
    // Use Map lookups (O(1)) instead of .find() (O(n)) for better performance
    const projectForEdit = {
      ...project,
      progress_status: project.progress_status?.id ? (progressOptionsMap.get(project.progress_status.id) || null) : null,
      status: project.status?.id ? (statusOptionsMap.get(project.status.id) || null) : null,
      type: project.type?.id ? (typeOptionsMap.get(project.type.id) || null) : null,
      author: project.author?.id ? (authorsMap.get(project.author.id) || null) : null,
      translator: project.translator?.id ? (translatorsMap.get(project.translator.id) || null) : null,
      rights_owner: project.rights_owner?.id ? (rightsOwnersMap.get(project.rights_owner.id) || null) : null,
      reviewer: project.reviewer?.id ? (reviewersMap.get(project.reviewer.id) || null) : null,
    }

    // Clear everything first
    setContracts([])
    setEditProject(null)
    
    // Set the new project and open dialog
    // Contracts will be fetched automatically via useEffect when dialog opens
    setEditProject(projectForEdit)
    setIsEditProjectOpen(true)
  }

  // Open delete confirmation
  const openDeleteDialog = (projectId: number) => {
    setDeleteProjectId(projectId)
    setIsDeleteAlertOpen(true)
  }

  // Open contracts modal
  const openContractsModal = (project: Project) => {
    setSelectedProjectForContracts(project)
    setIsContractsModalOpen(true)
  }

  // Get progress status name by ID
  const getProgressStatusName = (statusId: string | { id: number; display_name_en: string }) => {
    if (typeof statusId === "object" && statusId?.display_name_en) {
      return statusId.display_name_en
    }
    const status = progressOptions.find((s) => s.id.toString() === statusId?.toString())
    return status ? status.display_name_en : "Unknown Status"
  }

  // Get status name by ID
  const getStatusName = (statusId: string | { id: number; display_name_en: string }) => {
    if (typeof statusId === "object" && statusId?.display_name_en) {
      return statusId.display_name_en
    }
    const status = statusOptions.find((s) => s.id.toString() === statusId?.toString())
    return status ? status.display_name_en : "Unknown Status"
  }

  // Get type name by ID
  const getTypeName = (typeId: string | { id: number; display_name_en: string }) => {
    if (typeof typeId === "object" && typeId?.display_name_en) {
      return typeId.display_name_en
    }
    const type = typeOptions.find((t) => t.id.toString() === typeId?.toString())
    return type ? type.display_name_en : "Unknown Type"
  }

  // Get person name by ID
  const getPersonName = (
    personId: string | { id: number; name: string },
    personList: { id: number; name: string }[],
  ) => {
    if (typeof personId === "object" && personId?.name) {
      return personId.name
    }
    const person = personList.find((p) => p.id.toString() === personId?.toString())
    return person ? person.name : "Unknown"
  }

  // Helper function to calculate progress percentage (pure function)
  const calculateProgressPercentage = (status: string | { id: number; display_name_en: string } | null): number => {
    if (!status) return 0
    
    const statusName = typeof status === "object" ? status.display_name_en : status
    
    switch (statusName.toLowerCase()) {
      case "reviewing":
        return 16.67 // ~17% (1/6)
      case "translating":
        return 33.33 // ~33% (2/6)
      case "editing":
        return 50 // 50% (3/6)
      case "designing":
        return 66.67 // ~67% (4/6)
      case "printing":
        return 83.33 // ~83% (5/6)
      case "completed":
        return 100 // 100% (6/6)
      default:
        return 50 // Default to 50% for unknown statuses
    }
  }

  // Filter progress options: exclude "translating" for Original Book type
  const getFilteredProgressOptions = useCallback((projectType: { id: number; display_name_en: string } | null | undefined) => {
    if (!projectType) return progressOptions
    
    // Check if type is "Original Book" (by ID 23 or display name)
    const isOriginalBook = projectType.id === 23 || 
                          projectType.display_name_en?.toLowerCase() === "original book" ||
                          projectType.display_name_en?.toLowerCase() === "original"
    
    if (isOriginalBook) {
      // Filter out "translating" option
      return progressOptions.filter(option => 
        option.display_name_en?.toLowerCase() !== "translating"
      )
    }
    
    return progressOptions
  }, [progressOptions])

  // Memoized: Calculate progress percentages for all projects at once
  const projectProgressPercentages = useMemo(() => {
    const percentages = new Map<number, number>()
    projects.forEach(project => {
      percentages.set(project.id, calculateProgressPercentage(project.progress_status))
    })
    return percentages
  }, [projects])

  // Wrapper function for backward compatibility (now uses memoized values)
  const getProgressPercentage = (status: string | { id: number; display_name_en: string } | null, projectId?: number): number => {
    // If projectId is provided, use memoized value
    if (projectId !== undefined && projectProgressPercentages.has(projectId)) {
      return projectProgressPercentages.get(projectId)!
    }
    // Fallback to calculation (for cases where projectId is not available)
    return calculateProgressPercentage(status)
  }

  // Virtualization: Only virtualize if we have more than 30 items (optimization threshold)
  const shouldVirtualize = projects.length > 30
  const rowHeight = 80 // Estimated row height in pixels
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(600) // Default height

  // Calculate visible range for virtualization
  const virtualizedData = useMemo(() => {
    if (!shouldVirtualize) {
      return { 
        visibleProjects: projects, 
        startIndex: 0, 
        endIndex: projects.length,
        totalHeight: 0,
        offsetY: 0,
      }
    }

    const visibleStart = Math.floor(scrollTop / rowHeight)
    const visibleEnd = Math.min(
      visibleStart + Math.ceil(containerHeight / rowHeight) + 2, // +2 for buffer
      projects.length
    )
    const startIndex = Math.max(0, visibleStart - 1) // -1 for buffer
    const endIndex = Math.min(projects.length, visibleEnd)

    return {
      visibleProjects: projects.slice(startIndex, endIndex),
      startIndex,
      endIndex,
      totalHeight: projects.length * rowHeight,
      offsetY: startIndex * rowHeight,
    }
  }, [projects, scrollTop, containerHeight, shouldVirtualize, rowHeight])

  // Handle scroll for virtualization
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  // Measure container height
  useEffect(() => {
    if (containerRef.current && shouldVirtualize) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerHeight(entry.contentRect.height)
        }
      })
      resizeObserver.observe(containerRef.current)
      return () => resizeObserver.disconnect()
    }
  }, [shouldVirtualize])

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
                  <BreadcrumbPage>Projects</BreadcrumbPage>
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
            <h2 className="text-xl font-semibold mb-4">Project Management</h2>
            <p className="mb-6">Manage projects and their progress status.</p>

            {/* Search and Filter Section */}
            <div className="mb-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Search Input */}
                <div className="md:col-span-2">
                  <Label htmlFor="search">Search Projects</Label>
                  <Input
                    id="search"
                    placeholder="Search by title (Arabic or English)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch()
                      }
                    }}
                    className="w-full"
                  />
                </div>
                
                {/* Approval Status Filter */}
                <div>
                  <Label htmlFor="filter-approval">Approval Status</Label>
                  <Select value={filterApprovalStatus} onValueChange={setFilterApprovalStatus}>
                    <SelectTrigger id="filter-approval">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="not_approved">Not Approved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-end gap-2">
                  <Button
                    onClick={handleSearch}
                    className="flex-1"
                  >
                    Search
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    className="flex-1"
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </div>

            <div className="border rounded-md">
              <div className="bg-muted p-4 flex justify-between items-center">
                <h3 className="font-medium">Projects</h3>
                <Dialog open={isAddProjectOpen} onOpenChange={setIsAddProjectOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-primary text-primary-foreground">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Project
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add New Project</DialogTitle>
                      <DialogDescription>Create a new project for your inventory.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                      {/* Basic Information Section */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Basic Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="title_ar">Title (Arabic)</Label>
                            <Input
                              id="title_ar"
                              value={newProject.title_ar}
                              onChange={(e) => createDebouncedHandler("title_ar", e.target.value)}
                              placeholder="Enter project title in Arabic"
                              dir="rtl"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="title_original">English Title</Label>
                            <Input
                              id="title_original"
                              value={newProject.title_original || ""}
                              onChange={(e) => createDebouncedHandler("title_original", e.target.value)}
                              placeholder="Enter title in English"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                              id="description"
                              value={newProject.description || ""}
                              onChange={(e) => createDebouncedHandler("description", e.target.value)}
                              placeholder="Enter project description"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="type">Type</Label>
                            <Select
                              value={newProject.type?.id?.toString() || ""}
                              onValueChange={(value) =>
                                setNewProject({
                                  ...newProject,
                                  type: typeOptions.find((opt) => opt.id.toString() === value) || null,
                                })
                              }
                            >
                              <SelectTrigger id="type">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                {typeOptions.map((option) => (
                                  <SelectItem key={option.id} value={option.id.toString()}>
                                    {option.display_name_en}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="approval_status">Approval Status</Label>
                            <Switch
                              id="approval_status"
                              checked={newProject.approval_status}
                              onCheckedChange={(checked) => setNewProject({ ...newProject, approval_status: checked })}
                            />
                            <p className="text-xs text-muted-foreground">
                              {newProject.approval_status ? "Approved" : "Not Approved"}
                            </p>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="status">Status</Label>
                            <Select
                              value={newProject.status?.id?.toString() || ""}
                              onValueChange={(value) =>
                                setNewProject({
                                  ...newProject,
                                  status: statusOptions.find((opt) => opt.id.toString() === value) || null,
                                })
                              }
                            >
                              <SelectTrigger id="status">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                              <SelectContent>
                                {statusOptions.map((option) => (
                                  <SelectItem key={option.id} value={option.id.toString()}>
                                    {option.display_name_en}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="progress_status">Progress Status</Label>
                            <Select
                              value={newProject.progress_status?.id?.toString() || ""}
                              onValueChange={(value) =>
                                setNewProject({
                                  ...newProject,
                                  progress_status: progressOptions.find((opt) => opt.id.toString() === value) || null,
                                })
                              }
                            >
                              <SelectTrigger id="progress_status">
                                <SelectValue placeholder="Select progress status" />
                              </SelectTrigger>
                              <SelectContent>
                                {getFilteredProgressOptions(newProject.type).map((option) => (
                                  <SelectItem key={option.id} value={option.id.toString()}>
                                    {option.display_name_en}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddProjectOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddProject} disabled={isAdding}>
                        {isAdding ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          "Add Project"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="p-4">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 bg-background z-10">
                      <tr className="text-sm border-b">
                        <th 
                          className="text-left font-medium p-2 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleSort("title_ar")}
                        >
                          <div className="flex items-center">
                            Project Title (Arabic)
                            {getSortIndicator("title_ar")}
                          </div>
                        </th>
                        <th 
                          className="text-left font-medium p-2 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleSort("title_original")}
                        >
                          <div className="flex items-center">
                            Project Title (English)
                            {getSortIndicator("title_original")}
                          </div>
                        </th>
                        <th className="text-left font-medium p-2">Type</th>
                        <th 
                          className="text-left font-medium p-2 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleSort("approval_status")}
                        >
                          <div className="flex items-center">
                            Approval Status
                            {getSortIndicator("approval_status")}
                          </div>
                        </th>
                        <th className="text-left font-medium p-2">Progress Status</th>
                        <th className="text-right font-medium p-2">Actions</th>
                      </tr>
                    </thead>
                  </table>
                  {shouldVirtualize ? (
                    <div
                      ref={containerRef}
                      className="overflow-y-auto overflow-x-auto"
                      style={{ maxHeight: '600px' }}
                      onScroll={handleScroll}
                    >
                      <div style={{ height: virtualizedData.totalHeight, position: 'relative' }}>
                        <table className="w-full border-collapse">
                          <tbody>
                            {virtualizedData.offsetY > 0 && (
                              <tr style={{ height: virtualizedData.offsetY }}>
                                <td colSpan={6}></td>
                              </tr>
                            )}
                            {isLoading ? (
                              // Skeleton loaders matching table structure
                              Array.from({ length: 5 }).map((_, index) => (
                                <tr key={`skeleton-${index}`} className="border-b">
                                  <td className="p-2">
                                    <Skeleton className="h-5 w-32" />
                                  </td>
                                  <td className="p-2">
                                    <Skeleton className="h-5 w-40" />
                                  </td>
                                  <td className="p-2">
                                    <Skeleton className="h-5 w-24" />
                                  </td>
                                  <td className="p-2">
                                    <Skeleton className="h-6 w-20 rounded-full" />
                                  </td>
                                  <td className="p-2">
                                    <Skeleton className="h-5 w-28" />
                                  </td>
                                  <td className="p-2 text-right">
                                    <div className="flex justify-end gap-2">
                                      <Skeleton className="h-8 w-8 rounded" />
                                      <Skeleton className="h-8 w-8 rounded" />
                                    </div>
                                  </td>
                                </tr>
                              ))
                            ) : virtualizedData.visibleProjects.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="py-8 text-center">
                                  No projects found
                                </td>
                              </tr>
                            ) : (
                              virtualizedData.visibleProjects.map((project) => (
                                <tr key={project.id} className="border-b last:border-0">
                                  <td className="p-2 font-medium">{project.title_ar}</td>
                                  <td className="p-2">{project.title_original || "No English Title"}</td>
                                  <td className="p-2">
                                    {project.type ? (
                                      <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10">
                                        {typeof project.type === "object"
                                          ? project.type.display_name_en
                                          : getTypeName(project.type)}
                                      </span>
                                    ) : (
                                      "Not set"
                                    )}
                                  </td>
                                  <td className="p-2">
                                    {project.approval_status ? (
                                      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-700/10">
                                        <CheckCircle2 className="h-4 w-4 mr-1" />
                                        Approved
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-700/10">
                                        <AlertCircle className="h-4 w-4 mr-1" />
                                        Not Approved
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2">
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-muted-foreground">
                                          {project.progress_status ? (
                                            typeof project.progress_status === "object"
                                              ? project.progress_status.display_name_en
                                              : getProgressStatusName(project.progress_status)
                                          ) : (
                                            "Not set"
                                          )}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {getProgressPercentage(project.progress_status, project.id).toFixed(0)}%
                                        </span>
                                      </div>
                                      <Progress 
                                        value={getProgressPercentage(project.progress_status, project.id)} 
                                        className="h-2"
                                      />
                                    </div>
                                  </td>
                                  <td className="p-2 text-right">
                                    <div className="flex justify-end gap-2">
                                      {/* Desktop view - separate buttons */}
                                      <div className="hidden sm:flex gap-2">
                                        {/* Convert to Product button - only shown when all conditions are met */}
                                        {project.status?.display_name_en?.toLowerCase() === "finalized" &&
                                         project.progress_status?.display_name_en?.toLowerCase() === "completed" &&
                                         project.all_contracts_closed === true &&
                                         project.has_product !== true && (
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 text-green-600 hover:text-green-800"
                                            title="Convert to Product"
                                            onClick={() => handleConvertToProduct(project)}
                                            disabled={isConverting && convertingProjectId === project.id}
                                          >
                                            {isConverting && convertingProjectId === project.id ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <Package className="h-4 w-4" />
                                            )}
                                            <span className="sr-only">Convert to Product</span>
                                          </Button>
                                        )}
                                        {/* Contract button - only shown for approved projects */}
                                        {project.approval_status && (
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 text-blue-600 hover:text-blue-800"
                                            title="Contracts"
                                            onClick={() => openContractsModal(project)}
                                          >
                                            <FileText className="h-4 w-4" />
                                            <span className="sr-only">Contracts</span>
                                          </Button>
                                        )}
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => openEditDialog(project)}
                                        >
                                          <Edit className="h-4 w-4" />
                                          <span className="sr-only">Edit</span>
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          className="h-8 w-8 text-destructive hover:text-destructive"
                                          onClick={() => openDeleteDialog(project.id)}
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
                                            {project.status?.display_name_en?.toLowerCase() === "finalized" &&
                                             project.progress_status?.display_name_en?.toLowerCase() === "completed" &&
                                             project.all_contracts_closed === true &&
                                             project.has_product !== true && (
                                              <DropdownMenuItem 
                                                onClick={() => handleConvertToProduct(project)}
                                                disabled={isConverting && convertingProjectId === project.id}
                                              >
                                                {isConverting && convertingProjectId === project.id ? (
                                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                ) : (
                                                  <Package className="h-4 w-4 mr-2" />
                                                )}
                                                Convert to Product
                                              </DropdownMenuItem>
                                            )}
                                            {project.approval_status && (
                                              <DropdownMenuItem onClick={() => openContractsModal(project)}>
                                                <FileText className="h-4 w-4 mr-2" />
                                                Contracts
                                              </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem onClick={() => openEditDialog(project)}>
                                              <Edit className="h-4 w-4 mr-2" />
                                              Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                              className="text-destructive"
                                              onClick={() => openDeleteDialog(project.id)}
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
                            {(projects.length - virtualizedData.endIndex) * rowHeight > 0 && (
                              <tr style={{ height: (projects.length - virtualizedData.endIndex) * rowHeight }}>
                                <td colSpan={6}></td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div
                      ref={containerRef}
                      className="overflow-y-auto"
                      style={{ maxHeight: '600px' }}
                    >
                      <table className="w-full border-collapse">
                        <tbody>
                          {isLoading ? (
                            // Skeleton loaders matching table structure
                            Array.from({ length: 5 }).map((_, index) => (
                              <tr key={`skeleton-${index}`} className="border-b">
                                <td className="p-2">
                                  <Skeleton className="h-5 w-32" />
                                </td>
                                <td className="p-2">
                                  <Skeleton className="h-5 w-40" />
                                </td>
                                <td className="p-2">
                                  <Skeleton className="h-5 w-24" />
                                </td>
                                <td className="p-2">
                                  <Skeleton className="h-6 w-20 rounded-full" />
                                </td>
                                <td className="p-2">
                                  <Skeleton className="h-5 w-28" />
                                </td>
                                <td className="p-2 text-right">
                                  <div className="flex justify-end gap-2">
                                    <Skeleton className="h-8 w-8 rounded" />
                                    <Skeleton className="h-8 w-8 rounded" />
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : projects.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center">
                                No projects found
                              </td>
                            </tr>
                          ) : (
                            projects.map((project) => (
                              <tr key={project.id} className="border-b last:border-0">
                                <td className="p-2 font-medium">{project.title_ar}</td>
                                <td className="p-2">{project.title_original || "No English Title"}</td>
                                <td className="p-2">
                                  {project.type ? (
                                    <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10">
                                      {typeof project.type === "object"
                                        ? project.type.display_name_en
                                        : getTypeName(project.type)}
                                    </span>
                                  ) : (
                                    "Not set"
                                  )}
                                </td>
                                <td className="p-2">
                                  {project.approval_status ? (
                                    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-700/10">
                                      <CheckCircle2 className="h-4 w-4 mr-1" />
                                      Approved
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-700/10">
                                      <AlertCircle className="h-4 w-4 mr-1" />
                                      Not Approved
                                    </span>
                                  )}
                                </td>
                                <td className="p-2">
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-medium text-muted-foreground">
                                        {project.progress_status ? (
                                          typeof project.progress_status === "object"
                                            ? project.progress_status.display_name_en
                                            : getProgressStatusName(project.progress_status)
                                        ) : (
                                          "Not set"
                                        )}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {getProgressPercentage(project.progress_status, project.id).toFixed(0)}%
                                      </span>
                                    </div>
                                    <Progress 
                                      value={getProgressPercentage(project.progress_status, project.id)} 
                                      className="h-2"
                                    />
                                  </div>
                                </td>
                                <td className="p-2 text-right">
                                  <div className="flex justify-end gap-2">
                                    {/* Desktop view - separate buttons */}
                                    <div className="hidden sm:flex gap-2">
                                      {/* Convert to Product button - only shown when all conditions are met */}
                                      {project.status?.display_name_en?.toLowerCase() === "finalized" &&
                                       project.progress_status?.display_name_en?.toLowerCase() === "completed" &&
                                       project.all_contracts_closed === true &&
                                       project.has_product !== true && (
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          className="h-8 w-8 text-green-600 hover:text-green-800"
                                          title="Convert to Product"
                                          onClick={() => handleConvertToProduct(project)}
                                          disabled={isConverting && convertingProjectId === project.id}
                                        >
                                          {isConverting && convertingProjectId === project.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <Package className="h-4 w-4" />
                                          )}
                                          <span className="sr-only">Convert to Product</span>
                                        </Button>
                                      )}
                                      {/* Contract button - only shown for approved projects */}
                                      {project.approval_status && (
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          className="h-8 w-8 text-blue-600 hover:text-blue-800"
                                          title="Contracts"
                                          onClick={() => openContractsModal(project)}
                                        >
                                          <FileText className="h-4 w-4" />
                                          <span className="sr-only">Contracts</span>
                                        </Button>
                                      )}
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => openEditDialog(project)}
                                      >
                                        <Edit className="h-4 w-4" />
                                        <span className="sr-only">Edit</span>
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={() => openDeleteDialog(project.id)}
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
                                          {project.status?.display_name_en?.toLowerCase() === "finalized" &&
                                           project.progress_status?.display_name_en?.toLowerCase() === "completed" &&
                                           project.all_contracts_closed === true &&
                                           project.has_product !== true && (
                                            <DropdownMenuItem 
                                              onClick={() => handleConvertToProduct(project)}
                                              disabled={isConverting && convertingProjectId === project.id}
                                            >
                                              {isConverting && convertingProjectId === project.id ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                              ) : (
                                                <Package className="h-4 w-4 mr-2" />
                                              )}
                                              Convert to Product
                                            </DropdownMenuItem>
                                          )}
                                          {project.approval_status && (
                                            <DropdownMenuItem onClick={() => openContractsModal(project)}>
                                              <FileText className="h-4 w-4 mr-2" />
                                              Contracts
                                            </DropdownMenuItem>
                                          )}
                                          <DropdownMenuItem onClick={() => openEditDialog(project)}>
                                            <Edit className="h-4 w-4 mr-2" />
                                            Edit
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            className="text-destructive"
                                            onClick={() => openDeleteDialog(project.id)}
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
                  )}
                </div>
              </div>
              
              {/* Pagination Controls */}
              {!isLoading && totalCount > 0 && (
                <div className="flex items-center justify-between mt-4 px-4 pb-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage} of {Math.max(1, Math.ceil(totalCount / pageSize))}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.max(1, Math.ceil(totalCount / pageSize))))}
                      disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                    >
                      Next
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Items per page:</span>
                    <Select
                      value={pageSize.toString()}
                      onValueChange={(value) => {
                        setPageSize(Number(value))
                        setCurrentPage(1)
                      }}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">
                      ({totalCount} total)
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* Edit Project Dialog */}
      <Dialog open={isEditProjectOpen} onOpenChange={setIsEditProjectOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update project information.</DialogDescription>
          </DialogHeader>
          {editProject && (
            <div className="space-y-6 py-4">
              {/* Basic Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-title_ar">Title (Arabic)</Label>
                    <Input
                      id="edit-title_ar"
                      value={editProject.title_ar || ""}
                      onChange={(e) => setEditProject({ ...editProject, title_ar: e.target.value })}
                      dir="rtl"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-title_original">English Title</Label>
                    <Input
                      id="edit-title_original"
                      value={editProject.title_original || ""}
                      onChange={(e) => setEditProject({ ...editProject, title_original: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-description">Description</Label>
                    <Textarea
                      id="edit-description"
                      value={editProject.description || ""}
                      onChange={(e) => setEditProject({ ...editProject, description: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-type">Type</Label>
                    <Select
                      value={editProject.type?.id?.toString() || ""}
                      onValueChange={(value) =>
                        setEditProject({
                          ...editProject,
                          type: typeOptions.find((opt) => opt.id.toString() === value) || null,
                        })
                      }
                    >
                      <SelectTrigger id="edit-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {typeOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id.toString()}>
                            {option.display_name_en}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-approval_status">Approval Status</Label>
                    <Switch
                      id="edit-approval_status"
                      checked={editProject.approval_status}
                      onCheckedChange={(checked) => setEditProject({ ...editProject, approval_status: checked })}
                    />
                    <p className="text-xs text-muted-foreground">
                      {editProject.approval_status ? "Approved" : "Not Approved"}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-status">Status</Label>
                    <Select
                      value={editProject.status?.id?.toString() || ""}
                      onValueChange={(value) =>
                        setEditProject({
                          ...editProject,
                          status: statusOptions.find((opt) => opt.id.toString() === value) || null,
                        })
                      }
                    >
                      <SelectTrigger id="edit-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id.toString()}>
                            {option.display_name_en}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-progress_status">Progress Status</Label>
                    <Select
                      value={editProject.progress_status?.id?.toString() || ""}
                      onValueChange={(value) =>
                        setEditProject({
                          ...editProject,
                          progress_status: progressOptions.find((opt) => opt.id.toString() === value) || null,
                        })
                      }
                    >
                      <SelectTrigger id="edit-progress_status">
                        <SelectValue placeholder="Select progress status" />
                      </SelectTrigger>
                      <SelectContent>
                        {getFilteredProgressOptions(editProject.type).map((option) => (
                          <SelectItem key={option.id} value={option.id.toString()}>
                            {option.display_name_en}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator className="my-2" />

              {/* People Section - Read Only */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  People Information
                </h3>
                {isContractsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <span className="ml-3 text-muted-foreground">Loading people from contracts...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {getPeopleFromContracts('author').length > 0 && (
                      <div className="group relative overflow-hidden rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.02]">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-blue-100 rounded-full -translate-y-10 translate-x-10 opacity-20 group-hover:opacity-30 transition-opacity"></div>
                        <div className="relative flex items-start gap-3">
                          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <PenTool className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-blue-900 mb-1">Author</h4>
                            <div className="space-y-1">
                              {getPeopleFromContracts('author').map((name, index) => (
                                <div key={index} className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                  <span className="text-sm text-blue-800 font-medium">{name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {getPeopleFromContracts('translator').length > 0 && (
                      <div className="group relative overflow-hidden rounded-lg border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.02]">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-green-100 rounded-full -translate-y-10 translate-x-10 opacity-20 group-hover:opacity-30 transition-opacity"></div>
                        <div className="relative flex items-start gap-3">
                          <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <Languages className="h-5 w-5 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-green-900 mb-1">Translator</h4>
                            <div className="space-y-1">
                              {getPeopleFromContracts('translator').map((name, index) => (
                                <div key={index} className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                  <span className="text-sm text-green-800 font-medium">{name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {getPeopleFromContracts('rights').length > 0 && (
                      <div className="group relative overflow-hidden rounded-lg border border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50 p-4 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.02]">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-purple-100 rounded-full -translate-y-10 translate-x-10 opacity-20 group-hover:opacity-30 transition-opacity"></div>
                        <div className="relative flex items-start gap-3">
                          <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                            <Crown className="h-5 w-5 text-purple-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-purple-900 mb-1">Rights Owner</h4>
                            <div className="space-y-1">
                              {getPeopleFromContracts('rights').map((name, index) => (
                                <div key={index} className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                                  <span className="text-sm text-purple-800 font-medium">{name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {getPeopleFromContracts('reviewer').length > 0 && (
                      <div className="group relative overflow-hidden rounded-lg border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-4 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.02]">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-orange-100 rounded-full -translate-y-10 translate-x-10 opacity-20 group-hover:opacity-30 transition-opacity"></div>
                        <div className="relative flex items-start gap-3">
                          <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                            <Eye className="h-5 w-5 text-orange-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-orange-900 mb-1">Reviewer</h4>
                            <div className="space-y-1">
                              {getPeopleFromContracts('reviewer').map((name, index) => (
                                <div key={index} className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                                  <span className="text-sm text-orange-800 font-medium">{name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Other People from Contracts */}
                    {Object.keys(getOtherPeopleFromContracts()).length > 0 && 
                     Object.entries(getOtherPeopleFromContracts()).map(([contractType, people]) => (
                       <div key={contractType} className="group relative overflow-hidden rounded-lg border border-gray-200 bg-gradient-to-br from-gray-50 to-slate-50 p-4 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.02]">
                         <div className="absolute top-0 right-0 w-20 h-20 bg-gray-100 rounded-full -translate-y-10 translate-x-10 opacity-20 group-hover:opacity-30 transition-opacity"></div>
                         <div className="relative flex items-start gap-3">
                           <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                             <Users className="h-5 w-5 text-gray-600" />
                           </div>
                           <div className="flex-1 min-w-0">
                             <h4 className="font-semibold text-gray-900 mb-1">{contractType}</h4>
                             <div className="space-y-1">
                               {people.map((name, index) => (
                                 <div key={index} className="flex items-center gap-2">
                                   <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                   <span className="text-sm text-gray-800 font-medium">{name}</span>
                                 </div>
                               ))}
                             </div>
                           </div>
                         </div>
                       </div>
                     ))}
                    
                    {getPeopleFromContracts('author').length === 0 && 
                     getPeopleFromContracts('translator').length === 0 && 
                     getPeopleFromContracts('rights').length === 0 && 
                     getPeopleFromContracts('reviewer').length === 0 && 
                     Object.keys(getOtherPeopleFromContracts()).length === 0 && (
                      <div className="col-span-full text-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                        <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <h4 className="text-lg font-medium text-gray-600 mb-2">No People Assigned</h4>
                        <p className="text-gray-500">No people have been assigned to this project yet.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditProjectOpen(false)
              setContracts([]) // Clear contracts when dialog is closed
            }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateProject} disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteProjectId !== null && (
                <>
                  You are about to delete <strong>{projects.find((p) => p.id === deleteProjectId)?.title_ar}</strong>.
                  This action cannot be undone. This will permanently remove the project from your system.
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
              onClick={handleDeleteProject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteConfirm !== "DELETE" || isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Project Contracts Modal */}
      <ProjectContractsModal
        open={isContractsModalOpen}
        onOpenChange={setIsContractsModalOpen}
        project={selectedProjectForContracts}
        token={localStorage.getItem("accessToken") || ""}
      />
    </SidebarProvider>
    </ErrorBoundary>
  )
}

