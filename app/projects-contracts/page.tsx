"use client"

import type React from "react"

import Link from "next/link"
import { useState, useEffect, useRef, useMemo, useCallback } from "react"
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
  FileText,
  AlertCircle,
  CheckCircle2,
  PlusCircle,
  ArrowLeft,
  Calendar,
  DollarSign,
  FileSignature,
  Clock,
  User,
  Trash2,
  Printer,
  Loader2,
  Search,
  X,
} from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { format, parseISO } from "date-fns"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { API_URL } from "@/lib/config"

interface Project {
  id: number
  title_ar: string
  title_original: string | null
  approval_status: boolean
  type: { id: number; display_name_en: string } | null
}

interface ContractType {
  id: number
  display_name_en: string
}

interface ContractStatus {
  id: number
  display_name_en: string
  value: string
  display_name_ar?: string
  is_active?: boolean
}

interface RoyaltiesType {
  id: number
  display_name_en: string
}

interface ApiUser {
  id: number
  username: string
  email: string
  phone_number: string | null
  is_active: boolean
  first_name: string
  last_name: string
  full_name?: string
}

// Update the Contract interface to better match the model
interface Contract {
  id: number
  title: string | null
  project: {
    id: number
    title_ar: string
    title_original: string | null
  }
  project_id: number
  commission_percent: number | null
  fixed_amount: number | null
  free_copies: number | null
  contract_duration: number | null
  payment_schedule: string
  contract_type_id: number
  contract_type?: ContractType
  content_type_id: number
  end_date: string | null
  notes: string | null
  object_id: number
  signed_by_id: number | null
  signed_by?: ApiUser
  start_date: string | null
  status_id: number | null
  status?: ContractStatus
  royalties_type_id: number | null
  royalties_type?: RoyaltiesType
  created_at: string
  updated_at: string
  contracted_party_details?: {
    id: number
    name: string
    type: string
  }
  contracted_party_id_value?: number
  contracted_party_type_value?: string
}

// Add interfaces for the different contracted party types
interface Author {
  id: number
  name: string
}

interface Translator {
  id: number
  name: string
}

interface RightsOwner {
  id: number
  name: string
}

interface Reviewer {
  id: number
  name: string
}

export default function ProjectContract() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [isContractsModalOpen, setIsContractsModalOpen] = useState(false)
  const [modalView, setModalView] = useState<"list" | "create" | "edit">("list")
  const [contracts, setContracts] = useState<Contract[]>([])
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [contractTypes, setContractTypes] = useState<ContractType[]>([])
  const [contractStatuses, setContractStatuses] = useState<ContractStatus[]>([])
  const [royaltiesTypes, setRoyaltiesTypes] = useState<RoyaltiesType[]>([])
  const [signatories, setSignatories] = useState<ApiUser[]>([])
  // Add state for contracted parties
  const [newContract, setNewContract] = useState<Partial<Contract>>({})
  const [authors, setAuthors] = useState<Author[]>([])
  const [translators, setTranslators] = useState<Translator[]>([])
  const [rightsOwners, setRightsOwners] = useState<RightsOwner[]>([])
  const [reviewers, setReviewers] = useState<Reviewer[]>([])
  const [selectedContractType, setSelectedContractType] = useState<number | null>(null)
  const [contentTypes, setContentTypes] = useState<{ id: number; model: string }[]>([])
  const [selectedContractedParty, setSelectedContractedParty] = useState<number | null>(null)
  // Add state for "Add New" modal
  const [isAddPartyModalOpen, setIsAddPartyModalOpen] = useState(false)
  const [newParty, setNewParty] = useState<{ name: string; bio?: string; contact_info?: string }>({
    name: "",
    bio: "",
    contact_info: "",
  })
  const [isCreatingParty, setIsCreatingParty] = useState(false)
  const [actionAlert, setActionAlert] = useState<{
    type: "success" | "error" | "warning" | null
    message: string
  }>({
    type: null,
    message: "",
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isContractsLoading, setIsContractsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [contractToDelete, setContractToDelete] = useState<Contract | null>(null)
  
  // Pagination state for projects
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [totalCount, setTotalCount] = useState(0)
  
  // Search state for projects
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  
  // Cache keys for localStorage
  const CACHE_KEYS = {
    BOOTSTRAP: 'contracts_bootstrap_data',
    BOOTSTRAP_TIMESTAMP: 'contracts_bootstrap_timestamp',
  }
  const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes in milliseconds
  
  // AbortController refs for request cancellation
  const abortControllerRef = useRef<AbortController | null>(null)
  const contractsAbortControllerRef = useRef<AbortController | null>(null)

  // Function to calculate months between two dates
  const calculateMonthsBetween = (startDate: string, endDate: string): number => {
    if (!startDate || !endDate) return 0
    
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    if (start > end) return 0
    
    const yearDiff = end.getFullYear() - start.getFullYear()
    const monthDiff = end.getMonth() - start.getMonth()
    const dayDiff = end.getDate() - start.getDate()
    
    let months = yearDiff * 12 + monthDiff
    
    // If the end day is before the start day, subtract one month
    if (dayDiff < 0) {
      months -= 1
    }
    
    return Math.max(0, months)
  }

  // Function to update contract duration when dates change
  const updateContractDuration = useCallback(() => {
    if (!formRef.current) return
    
    const startDateInput = formRef.current.querySelector('[name="start_date"]') as HTMLInputElement
    const endDateInput = formRef.current.querySelector('[name="end_date"]') as HTMLInputElement
    const durationInput = formRef.current.querySelector('[name="contract_duration"]') as HTMLInputElement
    
    if (startDateInput && endDateInput && durationInput) {
      const startDate = startDateInput.value
      const endDate = endDateInput.value
      
      if (startDate && endDate) {
        const months = calculateMonthsBetween(startDate, endDate)
        durationInput.value = months.toString()
      } else {
        durationInput.value = ""
      }
    }
  }, [])

  // Debounced handler for date inputs
  const handleDateChange = useCallback(() => {
    const timeoutId = setTimeout(() => {
      updateContractDuration()
    }, 300) // 300ms debounce
    
    return () => clearTimeout(timeoutId)
  }, [updateContractDuration])

  // Show alert message
  const showAlert = (type: "success" | "error" | "warning", message: string) => {
    setActionAlert({ type, message })
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setActionAlert({ type: null, message: "" })
    }, 5000)
  }

  // Headers for API requests (memoized)
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

  // Memoized lookup maps for O(1) lookups
  const contractTypesMap = useMemo(() => {
    const map = new Map<number, ContractType>()
    contractTypes.forEach(type => {
      map.set(type.id, type)
    })
    return map
  }, [contractTypes])

  const contractStatusesMap = useMemo(() => {
    const map = new Map<number, ContractStatus>()
    contractStatuses.forEach(status => {
      map.set(status.id, status)
    })
    return map
  }, [contractStatuses])

  const signatoriesMap = useMemo(() => {
    const map = new Map<number, ApiUser>()
    signatories.forEach(signatory => {
      map.set(signatory.id, signatory)
    })
    return map
  }, [signatories])

  const authorsMap = useMemo(() => {
    const map = new Map<number, Author>()
    authors.forEach(author => {
      map.set(author.id, author)
    })
    return map
  }, [authors])

  const translatorsMap = useMemo(() => {
    const map = new Map<number, Translator>()
    translators.forEach(translator => {
      map.set(translator.id, translator)
    })
    return map
  }, [translators])

  const rightsOwnersMap = useMemo(() => {
    const map = new Map<number, RightsOwner>()
    rightsOwners.forEach(rightsOwner => {
      map.set(rightsOwner.id, rightsOwner)
    })
    return map
  }, [rightsOwners])

  const reviewersMap = useMemo(() => {
    const map = new Map<number, Reviewer>()
    reviewers.forEach(reviewer => {
      map.set(reviewer.id, reviewer)
    })
    return map
  }, [reviewers])

  const contentTypesMap = useMemo(() => {
    const map = new Map<number, { id: number; model: string }>()
    contentTypes.forEach(ct => {
      map.set(ct.id, ct)
    })
    return map
  }, [contentTypes])

  const contentTypeByModelMap = useMemo(() => {
    const map = new Map<string, { id: number; model: string }>()
    contentTypes.forEach(ct => {
      map.set(ct.model.toLowerCase(), ct)
    })
    return map
  }, [contentTypes])

  // Fetch bootstrap data (all static data in one call) with caching
  const fetchBootstrapData = useCallback(async (forceRefresh: boolean = false) => {
    // Cancel previous bootstrap request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    
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
              
              // Debug logging for cached data
              if (process.env.NODE_ENV !== 'production') {
                console.log("Using cached bootstrap data:", {
                  contract_types_count: data.contract_types?.length || 0,
                  contract_statuses_count: data.contract_statuses?.length || 0,
                  signatories_count: data.signatories?.length || 0,
                  contract_types: data.contract_types,
                })
              }
              
              // Projects are fetched separately with pagination, not from bootstrap
              const sortedContractTypes = (data.contract_types || []).sort((a: ContractType, b: ContractType) => a.id - b.id)
              const sortedContractStatuses = (data.contract_statuses || []).sort((a: ContractStatus, b: ContractStatus) => a.id - b.id)
              const sortedRoyaltiesTypes = (data.royalties_types || []).sort((a: RoyaltiesType, b: RoyaltiesType) => a.id - b.id)
              const sortedSignatories = (data.signatories || []).sort((a: ApiUser, b: ApiUser) => a.id - b.id)
              const sortedAuthors = (data.authors || []).sort((a: Author, b: Author) => a.id - b.id)
              const sortedTranslators = (data.translators || []).sort((a: Translator, b: Translator) => a.id - b.id)
              const sortedRightsOwners = (data.rights_owners || []).sort((a: RightsOwner, b: RightsOwner) => a.id - b.id)
              const sortedReviewers = (data.reviewers || []).sort((a: Reviewer, b: Reviewer) => a.id - b.id)
              
              setContractTypes(sortedContractTypes)
              setContractStatuses(sortedContractStatuses)
              setRoyaltiesTypes(sortedRoyaltiesTypes)
              setSignatories(sortedSignatories)
              setAuthors(sortedAuthors)
              setTranslators(sortedTranslators)
              setRightsOwners(sortedRightsOwners)
              setReviewers(sortedReviewers)
              
              if (process.env.NODE_ENV !== 'production') {
                console.log("Cached state updated:", {
                  contractTypes_count: sortedContractTypes.length,
                  contractStatuses_count: sortedContractStatuses.length,
                  royaltiesTypes_count: sortedRoyaltiesTypes.length,
                  signatories_count: sortedSignatories.length,
                })
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
      const res = await fetchWithRetry(`${API_URL}/inventory/contracts/bootstrap/`, { 
        headers,
        signal: abortController.signal,
      })
      
      if (!res.ok) {
        throw new Error(`Failed to fetch bootstrap data: ${res.status} ${res.statusText}`)
      }
      
      const data = await res.json()
      
      // Debug logging
      if (process.env.NODE_ENV !== 'production') {
        console.log("Bootstrap data received:", {
          contract_types_count: data.contract_types?.length || 0,
          contract_statuses_count: data.contract_statuses?.length || 0,
          signatories_count: data.signatories?.length || 0,
          contract_types: data.contract_types,
        })
      }
      
      // Update state (sorted by ID)
      // Projects are fetched separately with pagination, not from bootstrap
      const sortedContractTypes = (data.contract_types || []).sort((a: ContractType, b: ContractType) => a.id - b.id)
      const sortedContractStatuses = (data.contract_statuses || []).sort((a: ContractStatus, b: ContractStatus) => a.id - b.id)
      const sortedRoyaltiesTypes = (data.royalties_types || []).sort((a: RoyaltiesType, b: RoyaltiesType) => a.id - b.id)
      const sortedSignatories = (data.signatories || []).sort((a: ApiUser, b: ApiUser) => a.id - b.id)
      const sortedAuthors = (data.authors || []).sort((a: Author, b: Author) => a.id - b.id)
      const sortedTranslators = (data.translators || []).sort((a: Translator, b: Translator) => a.id - b.id)
      const sortedRightsOwners = (data.rights_owners || []).sort((a: RightsOwner, b: RightsOwner) => a.id - b.id)
      const sortedReviewers = (data.reviewers || []).sort((a: Reviewer, b: Reviewer) => a.id - b.id)
      
      setContractTypes(sortedContractTypes)
      setContractStatuses(sortedContractStatuses)
      setRoyaltiesTypes(sortedRoyaltiesTypes)
      setSignatories(sortedSignatories)
      setAuthors(sortedAuthors)
      setTranslators(sortedTranslators)
      setRightsOwners(sortedRightsOwners)
      setReviewers(sortedReviewers)
      
      if (process.env.NODE_ENV !== 'production') {
        console.log("State updated:", {
          contractTypes_count: sortedContractTypes.length,
          contractStatuses_count: sortedContractStatuses.length,
          royaltiesTypes_count: sortedRoyaltiesTypes.length,
          signatories_count: sortedSignatories.length,
        })
      }
      
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
      // Set empty arrays on error (projects are fetched separately)
      setContractTypes([])
      setContractStatuses([])
      setRoyaltiesTypes([])
      setSignatories([])
      setAuthors([])
      setTranslators([])
      setRightsOwners([])
      setReviewers([])
      toast({
        title: "Error",
        description: "Failed to load data. Please try again later.",
        variant: "destructive",
      })
      throw error
    }
  }, [headers])

  // Fetch projects with pagination
  const fetchProjects = useCallback(async (page?: number, pageSizeParam?: number) => {
    // Cancel previous projects request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    
    try {
      const pageToUse = page ?? currentPage
      const pageSizeToUse = pageSizeParam ?? pageSize
      
      const params = new URLSearchParams()
      params.append("page", pageToUse.toString())
      params.append("page_size", pageSizeToUse.toString())
      params.append("approval_status", "true") // Only fetch approved projects
      
      const res = await fetchWithRetry(`${API_URL}/inventory/projects/?${params.toString()}`, { 
        headers,
        signal: abortController.signal,
      })
      
      if (!res.ok) {
        throw new Error(`Failed to fetch projects: ${res.status} ${res.statusText}`)
      }
      
      const data = await res.json()
      
      // Handle paginated response
      let projectsData: Project[] = []
      let count = 0
      
      if (Array.isArray(data)) {
        projectsData = data
        count = data.length
      } else if (data && Array.isArray(data.results)) {
        projectsData = data.results
        count = data.count || data.results.length
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.error("Unexpected projects data format:", data)
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
      toast({
        title: "Error",
        description: "Failed to fetch projects",
        variant: "destructive",
      })
      setProjects([])
      setTotalCount(0)
    }
  }, [currentPage, pageSize, headers])

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        // Load bootstrap data first, then projects
        await fetchBootstrapData()
        await fetchProjects(1, pageSize)
      } catch (error) {
        // Errors already handled in individual functions
      } finally {
        setIsLoading(false)
      }
    }
    
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  // Fetch projects when pagination changes (but not on initial load)
  useEffect(() => {
    if (!isLoading) {
      fetchProjects(currentPage, pageSize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize]) // Only depend on pagination params

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
      if (process.env.NODE_ENV !== 'production') {
        console.log("Fetching contracts for project:", projectId)
      }
      const res = await fetchWithRetry(`${API_URL}/inventory/contracts/?project_id=${projectId}`, { 
        headers,
        signal: abortController.signal,
      })
      if (!res.ok) throw new Error("Failed to fetch contracts")
      const data = await res.json()
      if (process.env.NODE_ENV !== 'production') {
        console.log("Fetched contracts:", data)
      }
      
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
      toast({
        title: "Error",
        description: "Failed to fetch contracts",
        variant: "destructive",
      })
    } finally {
      setIsContractsLoading(false)
    }
  }

  const openContractsModal = async (project: Project) => {
    setSelectedProject(project)
    setIsContractsModalOpen(true)
    setModalView("list")
    
    // Ensure bootstrap data is loaded before opening modal
    if (contractTypes.length === 0 || contractStatuses.length === 0 || signatories.length === 0) {
      if (process.env.NODE_ENV !== 'production') {
        console.log("Bootstrap data missing, fetching...")
      }
      try {
        await fetchBootstrapData(true) // Force refresh to ensure data is loaded
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error("Error fetching bootstrap data for modal:", error)
        }
      }
    }
    
    fetchContractsForProject(project.id)
  }

  const getStatusColor = (statusCode: string | undefined) => {
    if (!statusCode) return "bg-gray-100 text-gray-800 border-gray-300"

    switch (statusCode.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800 border-green-300"
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-300"
      case "draft":
        return "bg-blue-100 text-blue-700 border-blue-300"
      case "expired":
        return "bg-gray-100 text-gray-800 border-gray-300"
      case "terminated":
        return "bg-red-100 text-red-800 border-red-300"
      default:
        return "bg-gray-100 text-gray-800 border-gray-300"
    }
  }

  const getTypeIcon = useCallback((typeId: number | undefined) => {
    if (!typeId) return <FileText className="h-4 w-4" />
    const type = contractTypesMap.get(typeId)
    if (!type) return <FileText className="h-4 w-4" />

    const typeName = type.display_name_en.toLowerCase()

    if (typeName.includes("author")) return <User className="h-4 w-4" />
    if (typeName.includes("translator")) return <FileSignature className="h-4 w-4" />
    if (typeName.includes("right")) return <FileText className="h-4 w-4" />
    if (typeName.includes("print")) return <Printer className="h-4 w-4" />

    return <FileText className="h-4 w-4" />
  }, [contractTypesMap])

  const getTypeColor = useCallback((typeId: number | undefined) => {
    if (!typeId) return "bg-gray-100 text-gray-800 border-gray-300"
    const type = contractTypesMap.get(typeId)
    if (!type) return "bg-gray-100 text-gray-800 border-gray-300"

    const typeName = type.display_name_en.toLowerCase()

    if (typeName.includes("author")) return "bg-purple-100 text-purple-800 border-purple-300"
    if (typeName.includes("translator")) return "bg-indigo-100 text-indigo-800 border-indigo-300"
    if (typeName.includes("right")) return "bg-cyan-100 text-cyan-800 border-cyan-300"
    if (typeName.includes("print")) return "bg-orange-100 text-orange-800 border-orange-300"

    return "bg-gray-100 text-gray-800 border-gray-300"
  }, [contractTypesMap])

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not set"
    try {
      return format(parseISO(dateString), "MMM d, yyyy")
    } catch (e) {
      return dateString
    }
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "Not set"
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  const getStatusName = useCallback((statusId: number | null) => {
    if (!statusId) return "Not set"
    const status = contractStatusesMap.get(statusId)
    return status ? status.display_name_en : "Unknown"
  }, [contractStatusesMap])

  const getStatusCode = useCallback((statusId: number | null) => {
    if (!statusId) return ""
    const status = contractStatusesMap.get(statusId)
    return status?.value || ""
  }, [contractStatusesMap])

  const getTypeName = useCallback((typeId: number | null) => {
    if (!typeId) return "Not set"
    const type = contractTypesMap.get(typeId)
    return type ? type.display_name_en : "Unknown"
  }, [contractTypesMap])

  const getSignatoryName = useCallback((signatoryId: number | null, signedBy?: ApiUser) => {
    if (signedBy) {
      // Handle the API response structure where full_name is a single field
      if ('full_name' in signedBy) {
        return signedBy.full_name
      }
      // Fallback to the original structure with first_name and last_name
      return `${signedBy.first_name} ${signedBy.last_name}`.trim() || signedBy.username
    }
    if (!signatoryId) return "Not set"
    const signatory = signatoriesMap.get(signatoryId)
    return signatory ? `${signatory.first_name} ${signatory.last_name}`.trim() || signatory.username : "Unknown"
  }, [signatoriesMap])

  // Add function to get content type ID based on contract type
  const getContentTypeIdForContractType = useCallback((contractTypeId: number | null) => {
    if (!contractTypeId) return null

    const contractType = contractTypesMap.get(contractTypeId)
    if (!contractType) return null

    const typeName = contractType.display_name_en.toLowerCase()

    if (typeName.includes("author")) {
      return contentTypeByModelMap.get("author")?.id || null
    }
    if (typeName.includes("translator")) {
      return contentTypeByModelMap.get("translator")?.id || null
    }
    if (typeName.includes("rights")) {
      return contentTypeByModelMap.get("rightsowner")?.id || null
    }
    if (typeName.includes("reviewer")) {
      return contentTypeByModelMap.get("reviewer")?.id || null
    }

    return null
  }, [contractTypesMap, contentTypeByModelMap])

  // Add function to get contracted party options based on contract type
  const getContractedPartyOptions = useCallback((contractedPartyType?: string | null) => {
    // If a specific type is provided, use that
    if (contractedPartyType) {
      switch (contractedPartyType.toLowerCase()) {
        case 'author':
          return Array.from(authorsMap.values())
        case 'translator':
          return Array.from(translatorsMap.values())
        case 'rightsowner':
          return Array.from(rightsOwnersMap.values())
        case 'reviewer':
          return Array.from(reviewersMap.values())
        default:
          return []
      }
    }
    
    // Otherwise use the selected contract type
    if (!selectedContractType) {
      return []
    }

    const contractType = contractTypesMap.get(selectedContractType)
    if (!contractType) {
      return []
    }

    const typeName = contractType.display_name_en.toLowerCase()

    if (typeName.includes("author")) {
      return Array.from(authorsMap.values())
    }
    if (typeName.includes("translator")) {
      return Array.from(translatorsMap.values())
    }
    if (typeName.includes("rights")) {
      return Array.from(rightsOwnersMap.values())
    }
    if (typeName.includes("reviewer")) {
      return Array.from(reviewersMap.values())
    }

    return []
  }, [selectedContractType, contractTypesMap, authorsMap, translatorsMap, rightsOwnersMap, reviewersMap])

  // Helper function to determine contracted party type from contract type
  const getContractedPartyTypeFromContractType = useCallback((contractTypeId: number | null) => {
    if (!contractTypeId) {
      return null
    }
    
    const contractType = contractTypesMap.get(contractTypeId)
    if (!contractType) {
      return null
    }
    
    const typeName = contractType.display_name_en.toLowerCase()
    
    if (typeName.includes('author')) {
      return 'author'
    }
    if (typeName.includes('translator')) {
      return 'translator'
    }
    if (typeName.includes('rights') || typeName.includes('rightsowner')) {
      return 'rightsowner'
    }
    if (typeName.includes('reviewer')) {
      return 'reviewer'
    }
    if (typeName.includes('printer') || typeName.includes('printing')) {
      return 'printer'
    }
    
    return null
  }, [contractTypesMap])

  // Update handleCreateContract to reset selectedContractType
  const handleCreateContract = () => {
    setModalView("create")
    setSelectedContract(null)
    setSelectedContractType(null)
    setSelectedContractedParty(null)
  }

  // Update handleSubmitContract to handle content_type and object_id
  const handleSubmitContract = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formRef.current || !selectedProject) return

    const isCreate = modalView === "create"
    setIsSubmitting(true)
    if (isCreate) {
      setIsCreating(true)
    } else {
      setIsUpdating(true)
    }

    try {
      const formData = new FormData(formRef.current)

      const contractTypeId = formData.get("contract_type_id")
        ? Number.parseInt(formData.get("contract_type_id") as string)
        : null
      const contentTypeId = getContentTypeIdForContractType(contractTypeId)
      const contractedPartyId = formData.get("contracted_party_id") 
        ? Number.parseInt(formData.get("contracted_party_id") as string)
        : null

      // Get the contracted party type based on the contract type
      const contractedPartyType = getContractedPartyTypeFromContractType(contractTypeId)

      const contractData: any = {
        title: formData.get("title"),
        project_id: selectedProject.id,
        contract_type_id_write: contractTypeId,
        status_id_write: formData.get("status_id") ? Number.parseInt(formData.get("status_id") as string) : null,
        signed_by_id: formData.get("signed_by_id") ? Number.parseInt(formData.get("signed_by_id") as string) : null,
        start_date: formData.get("start_date") || null,
        end_date: formData.get("end_date") || null,
        notes: formData.get("notes") || null,
        payment_schedule: formData.get("payment_schedule") || "",
        royalties_type_id_write: formData.get("royalties_type_id") ? Number.parseInt(formData.get("royalties_type_id") as string) : null,
        commission_percent: formData.get("commission_percent")
          ? Number.parseFloat(formData.get("commission_percent") as string)
          : null,
        fixed_amount: formData.get("fixed_amount") ? Number.parseFloat(formData.get("fixed_amount") as string) : null,
        free_copies: formData.get("free_copies") ? Number.parseInt(formData.get("free_copies") as string) : null,
        contract_duration: formData.get("contract_duration")
          ? Number.parseInt(formData.get("contract_duration") as string)
          : null,
        content_type_id: contentTypeId,
        object_id: contractedPartyId,
        contracted_party_type: contractedPartyType,
        contracted_party_id: contractedPartyId,
      }

      // Log the data being sent
      if (process.env.NODE_ENV !== 'production') {
        console.log("Sending contract data:", contractData)
      }

      // Create AbortController for this request
      const abortController = new AbortController()

      let res

      if (modalView === "create") {
        // Create new contract
        res = await fetchWithRetry(`${API_URL}/inventory/contracts/`, {
          method: "POST",
          headers,
          body: JSON.stringify(contractData),
          signal: abortController.signal,
        })
      } else {
        // Update existing contract
        if (!selectedContract) return

        res = await fetchWithRetry(`${API_URL}/inventory/contracts/${selectedContract.id}/`, {
          method: "PUT",
          headers,
          body: JSON.stringify(contractData),
          signal: abortController.signal,
        })
      }

      if (!res.ok) {
        const errorText = await res.text()
        if (process.env.NODE_ENV !== 'production') {
          console.error("Error response:", errorText)
        }
        try {
          const errorData = JSON.parse(errorText)
          throw new Error(errorData.detail || JSON.stringify(errorData))
        } catch (e) {
          throw new Error(`Failed to save contract: ${errorText}`)
        }
      }

      const savedContract = await res.json()
      if (process.env.NODE_ENV !== 'production') {
        console.log("Saved contract response:", savedContract)
      }

      if (modalView === "create") {
        setContracts([...contracts, savedContract])
        toast({
          title: "Contract Created",
          description: "New contract has been added",
          variant: "default",
        })
      } else {
        setContracts(contracts.map((c) => (c.id === savedContract.id ? savedContract : c)))
        toast({
          title: "Contract Updated",
          description: "Contract has been updated",
          variant: "default",
        })
      }

      setModalView("list")
    } catch (error) {
      // Don't handle AbortError - it's expected when cancelling requests
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error saving contract:", error)
      }
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save contract",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
      setIsCreating(false)
      setIsUpdating(false)
    }
  }

  // Add function to get contracted party name
  const getContractedPartyName = useCallback((contract: Contract) => {
    if (!contract.content_type_id || !contract.object_id) return "Not set"

    const contentType = contentTypesMap.get(contract.content_type_id)
    if (!contentType) return "Unknown"

    const model = contentType.model.toLowerCase()

    if (model === "author") {
      return authorsMap.get(contract.object_id)?.name || "Unknown Author"
    }
    if (model === "translator") {
      return translatorsMap.get(contract.object_id)?.name || "Unknown Translator"
    }
    if (model === "rightsowner") {
      return rightsOwnersMap.get(contract.object_id)?.name || "Unknown Rights Owner"
    }
    if (model === "reviewer") {
      return reviewersMap.get(contract.object_id)?.name || "Unknown Reviewer"
    }

    return "Unknown"
  }, [contentTypesMap, authorsMap, translatorsMap, rightsOwnersMap, reviewersMap])

  const handleBackToList = () => {
    setModalView("list")
  }

  const handleDeleteContract = async (contract: Contract) => {
    if (!selectedProject) return
    setContractToDelete(contract)
    setDeleteConfirmation("")
  }

  const confirmDelete = async () => {
    if (!contractToDelete || deleteConfirmation !== "DELETE") return

    // Store original state for rollback
    const originalContracts = [...contracts]
    const contractIdToDelete = contractToDelete.id

    // Optimistic update - remove contract immediately
    setContracts(contracts.filter((c) => c.id !== contractIdToDelete))
    setContractToDelete(null)
    setDeleteConfirmation("")

    // Create AbortController for this request
    const abortController = new AbortController()
    setIsDeleting(true)

    try {
      const res = await fetchWithRetry(`${API_URL}/inventory/contracts/${contractIdToDelete}/delete/`, {
        method: "DELETE",
        headers,
        signal: abortController.signal,
      })

      if (!res.ok) {
        throw new Error("Failed to delete contract")
      }

      toast({
        title: "Contract Deleted",
        description: "Contract has been deleted",
        variant: "default",
      })
    } catch (error) {
      // Rollback on error
      setContracts(originalContracts)
      setContractToDelete(contracts.find((c) => c.id === contractIdToDelete) || null)
      
      // Don't handle AbortError - it's expected when cancelling requests
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error deleting contract:", error)
      }
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete contract",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // Fetch contracts when selected project changes
  useEffect(() => {
    if (selectedProject?.id) {
      fetchContractsForProject(selectedProject.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject?.id])

  // Calculate duration when form is loaded with existing data
  useEffect(() => {
    if (modalView === "edit" && selectedContract && formRef.current) {
      // Use requestAnimationFrame to ensure the form is rendered before calculating
      requestAnimationFrame(() => {
        updateContractDuration()
      })
    }
  }, [modalView, selectedContract])

  // Debug: Log contractTypes when modal opens
  useEffect(() => {
    if (isContractsModalOpen && (modalView === "create" || modalView === "edit")) {
      if (process.env.NODE_ENV !== 'production') {
        console.log("Modal opened - contractTypes state:", {
          count: contractTypes.length,
          types: contractTypes,
          contractStatuses_count: contractStatuses.length,
          signatories_count: signatories.length,
        })
      }
    }
  }, [isContractsModalOpen, modalView, contractTypes, contractStatuses, signatories])

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Filter projects by search query
  const filteredProjects = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return projects
    }
    
    const query = debouncedSearchQuery.toLowerCase().trim()
    return projects.filter((project: Project) => {
      const titleAr = project.title_ar?.toLowerCase() || ""
      const titleOriginal = project.title_original?.toLowerCase() || ""
      return titleAr.includes(query) || titleOriginal.includes(query)
    })
  }, [projects, debouncedSearchQuery])

  // Update handleEditContract to set selectedContractType
  const handleEditContract = (contract: Contract) => {
    const enrichedContract = {
      ...contract,
      contract_type: contract.contract_type_id ? contractTypesMap.get(contract.contract_type_id) : undefined,
      status: contract.status_id ? contractStatusesMap.get(contract.status_id) : undefined,
      signed_by: contract.signed_by_id ? signatoriesMap.get(contract.signed_by_id) : undefined,
      signed_by_id: contract.signed_by_id ?? contract.signed_by?.id ?? null,
      contracted_party_id_value: contract.contracted_party_details?.id ?? contract.object_id,
      contracted_party_type_value: contract.contracted_party_details?.type,
    }

    setSelectedContract(enrichedContract)
    setSelectedContractType(contract.contract_type_id)
    setSelectedContractedParty(contract.contracted_party_details?.id ?? contract.object_id ?? null)
    setModalView("edit")
  }

  // Helper function to get project type name
  const getProjectTypeName = (project: Project | null) => {
    if (!project || !project.type) return null
    const typeName = project.type.display_name_en.toLowerCase()
    
    // Handle different possible project type names
    if (typeName.includes('original')) return 'original'
    if (typeName.includes('from_arabic') || typeName.includes('from arabic')) return 'from_arabic'
    if (typeName.includes('to_arabic') || typeName.includes('to arabic')) return 'to_arabic'
    
    return typeName
  }

  // Helper function to determine which fields should be shown based on Contract Type (contracted party type)
  // Simplified logic: author, translator, rights_owner show all three; others show only advance pay
  const getVisibleFields = (projectType: string | null, contractedPartyType: string | null) => {
    if (!contractedPartyType) {
      return {
        commission_percent: false,
        fixed_amount: false,
        free_copies: false
      }
    }

    const party = contractedPartyType.toLowerCase()

    // If contract type is author, translator, or rights_owner → show all three fields
    if (party === 'author' || party === 'translator' || party === 'rightsowner') {
      return {
        commission_percent: true,  // Royalties
        free_copies: true,          // Free Copies
        fixed_amount: true          // Advance Pay
      }
    }

    // For all other contract types (reviewer, printer, etc.) → show only advance pay
    return {
      commission_percent: false,   // Hide Royalties
      free_copies: false,          // Hide Free Copies
      fixed_amount: true            // Show only Advance Pay
    }
  }

  // Get current visible fields
  const visibleFields = getVisibleFields(
    getProjectTypeName(selectedProject),
    selectedContract?.contracted_party_type_value || 
    (selectedContractType ? getContractedPartyTypeFromContractType(selectedContractType) : null)
  )

  // Handler to create a new party (author, translator, rights owner, or reviewer)
  const handleCreateParty = async () => {
    if (!selectedContractType) return

    const partyType = getContractedPartyTypeFromContractType(selectedContractType)
    if (!partyType || (partyType !== 'author' && partyType !== 'translator' && partyType !== 'rightsowner' && partyType !== 'reviewer')) {
      return
    }

    if (!newParty.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Name is required",
        variant: "destructive",
      })
      return
    }

    setIsCreatingParty(true)
    try {
      let endpoint = ''
      let payload: any = { name: newParty.name.trim() }

      if (partyType === 'author') {
        endpoint = `${API_URL}/inventory/authors/`
        payload.bio = newParty.bio || ''
      } else if (partyType === 'translator') {
        endpoint = `${API_URL}/inventory/translators/`
        payload.bio = newParty.bio || ''
      } else if (partyType === 'rightsowner') {
        endpoint = `${API_URL}/inventory/rights-owners/`
        payload.contact_info = newParty.contact_info || ''
      } else if (partyType === 'reviewer') {
        endpoint = `${API_URL}/inventory/reviewers/`
        payload.bio = newParty.bio || ''
      }

      const res = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        throw new Error(`Failed to create ${partyType}`)
      }

      const createdParty = await res.json()

      // Refresh bootstrap data to get the new party
      await fetchBootstrapData(true) // Force refresh

      // Auto-select the newly created party
      setSelectedContractedParty(createdParty.id)
      
      // Update the form select value
      if (formRef.current) {
        const contractedPartySelect = formRef.current.querySelector('[name="contracted_party_id"]') as HTMLSelectElement
        if (contractedPartySelect) {
          contractedPartySelect.value = createdParty.id.toString()
        }
      }

      // Update selected contract if editing
      if (selectedContract) {
        setSelectedContract({
          ...selectedContract,
          contracted_party_id_value: createdParty.id,
          contracted_party_type_value: partyType,
        })
      }

      // Reset form and close modal
      setNewParty({ name: "", bio: "", contact_info: "" })
      setIsAddPartyModalOpen(false)

      toast({
        title: "Success",
        description: `${partyType === 'rightsowner' ? 'Rights Owner' : partyType === 'reviewer' ? 'Reviewer' : partyType.charAt(0).toUpperCase() + partyType.slice(1)} "${createdParty.name}" has been created and selected.`,
        variant: "default",
      })
    } catch (error: any) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error creating party:", error)
      }
      toast({
        title: "Error",
        description: `Failed to create ${partyType}. Please try again.`,
        variant: "destructive",
      })
    } finally {
      setIsCreatingParty(false)
    }
  }

  // Helper function to get visible fields for a contract in the list
  const getContractVisibleFields = (contract: Contract) => {
    const projectType = getProjectTypeName(selectedProject)
    const contractedPartyType = contract.contracted_party_details?.type || 
      (contract.contract_type_id ? getContractedPartyTypeFromContractType(contract.contract_type_id) : null)
    
    return getVisibleFields(projectType, contractedPartyType)
  }

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
                  <BreadcrumbPage>Project Contracts</BreadcrumbPage>
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Project Contracts</h2>
                <p className="text-muted-foreground">Manage contracts for your approved projects.</p>
              </div>
            </div>

            {/* Search Input */}
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search projects by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                // Skeleton loaders matching project card structure
                Array.from({ length: 6 }).map((_, index) => (
                  <div key={`skeleton-project-${index}`} className="group relative overflow-hidden rounded-xl border bg-background p-6 shadow-sm">
                    <div className="mb-8">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2 mb-4" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                    <div className="flex justify-between items-center">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-9 w-24 rounded-md" />
                    </div>
                  </div>
                ))
              ) : filteredProjects.length === 0 ? (
                <div className="col-span-full flex items-center justify-center py-12 border rounded-xl bg-muted/30">
                  <div className="flex flex-col items-center p-6">
                    <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-medium mb-2">
                      {searchQuery ? "No projects found" : "No approved projects found"}
                    </h3>
                    <p className="text-muted-foreground text-center">
                      {searchQuery
                        ? `No projects match "${searchQuery}". Try a different search term.`
                        : "There are no approved projects available for contracts."}
                    </p>
                    {searchQuery && (
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => setSearchQuery("")}
                      >
                        Clear Search
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                {filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    className="group relative overflow-hidden rounded-xl border bg-background p-6 shadow-sm transition-all hover:shadow-md"
                  >
                    {/* Project Info */}
                    <div className="mb-8">
                      <h3 className="text-xl font-semibold mb-1" dir="rtl">
                        {project.title_ar}
                      </h3>
                      {project.title_original && <p className="text-muted-foreground">{project.title_original}</p>}
                      {project.type && (
                        <div className="mt-2">
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                            {project.type.display_name_en}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Contracts Button */}
                    <div className="mt-auto">
                      <Button
                        variant="outline"
                        className="w-full transition-all group-hover:bg-primary group-hover:text-primary-foreground"
                        onClick={() => openContractsModal(project)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        View Contracts
                      </Button>
                    </div>

                    {/* Decorative Element */}
                    <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-primary/40 via-primary to-primary/40 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                ))}
                
                {/* Pagination Controls */}
                {!isLoading && totalCount > 0 && (
                  <div className="col-span-full flex items-center justify-between mt-4 px-4 pb-4">
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
                </>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* Contracts Modal */}
      <Dialog open={isContractsModalOpen} onOpenChange={setIsContractsModalOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto z-50">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              {modalView !== "list" && (
                <Button variant="ghost" size="icon" className="mr-2 h-8 w-8" onClick={handleBackToList}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              {selectedProject?.title_ar}{" "}
              {selectedProject?.title_original && (
                <span className="text-muted-foreground ml-2">({selectedProject.title_original})</span>
              )}
            </DialogTitle>
            <DialogDescription>
              {modalView === "list" && "Manage contracts for this project"}
              {modalView === "create" && "Create a new contract"}
              {modalView === "edit" && "Edit contract details"}
            </DialogDescription>
          </DialogHeader>

          {/* Delete Confirmation Dialog */}
          <Dialog open={!!contractToDelete} onOpenChange={() => setContractToDelete(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Contract</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this contract? This action cannot be undone.
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Contract Details:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>Title: {contractToDelete?.title || "Untitled"}</li>
                      <li>Type: {getTypeName(contractToDelete?.contract_type_id ?? null)}</li>
                      <li>Status: {getStatusName(contractToDelete?.status_id ?? null)}</li>
                    </ul>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Type DELETE to confirm:</p>
                    <Input
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      placeholder="Type DELETE"
                      className="w-full"
                    />
                  </div>
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setContractToDelete(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDelete}
                  disabled={deleteConfirmation !== "DELETE" || isDeleting}
                >
                  {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Delete Contract
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {modalView === "list" && (
            <div className="py-4">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium">Project Contracts</h3>
                <Button onClick={handleCreateContract}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Contract
                </Button>
              </div>

              {isContractsLoading ? (
                // Skeleton loaders matching contract card structure
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={`skeleton-contract-${index}`} className="relative border rounded-lg overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-muted"></div>
                      <div className="p-4 pl-6">
                        <div className="flex justify-between items-start mb-3">
                          <Skeleton className="h-5 w-48" />
                          <div className="flex space-x-2">
                            <Skeleton className="h-8 w-8 rounded" />
                            <Skeleton className="h-8 w-8 rounded" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                          <div>
                            <Skeleton className="h-3 w-24 mb-1" />
                            <Skeleton className="h-4 w-32" />
                          </div>
                          <div>
                            <Skeleton className="h-3 w-20 mb-1" />
                            <Skeleton className="h-4 w-28" />
                          </div>
                          <div>
                            <Skeleton className="h-3 w-20 mb-1" />
                            <Skeleton className="h-4 w-28" />
                          </div>
                          <div>
                            <Skeleton className="h-3 w-20 mb-1" />
                            <Skeleton className="h-4 w-32" />
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Skeleton className="h-6 w-20 rounded-full" />
                          <Skeleton className="h-6 w-24 rounded-full" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : contracts.length === 0 ? (
                <div className="text-center py-8 border rounded-md bg-muted/30">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No contracts available</h3>
                  <p className="text-muted-foreground">Add your first contract to get started.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {contracts.map((contract) => (
                      <div
                        key={contract.id}
                        className="relative border rounded-lg overflow-hidden transition-all hover:shadow-md"
                      >
                        {/* Colorful status indicator */}
                        <div
                          className={`absolute top-0 left-0 w-1 h-full ${getStatusColor(getStatusCode(contract.status_id)).split(" ")[0]}`}
                        ></div>

                        <div className="p-4 pl-6">
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="text-lg font-medium">{contract.title || "Untitled Contract"}</h4>
                            <div className="flex space-x-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => handleEditContract(contract)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteContract(contract)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1 flex items-center">
                                <User className="h-3 w-3 mr-1" /> Contracted Party
                              </p>
                              <p className="text-sm">{getContractedPartyName(contract)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1 flex items-center">
                                <Calendar className="h-3 w-3 mr-1" /> Start Date
                              </p>
                              <p className="text-sm">{formatDate(contract.start_date)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1 flex items-center">
                                <Calendar className="h-3 w-3 mr-1" /> End Date
                              </p>
                              <p className="text-sm">{formatDate(contract.end_date)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1 flex items-center">
                                <User className="h-3 w-3 mr-1" /> Signed By
                              </p>
                              <p className="text-sm">{getSignatoryName(contract.signed_by_id, contract.signed_by)}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                            {(() => {
                              const contractVisibleFields = getContractVisibleFields(contract)
                              const visibleItems = []
                              
                              if (contractVisibleFields.commission_percent) {
                                visibleItems.push(
                                  <div key="commission_percent">
                                    <p className="text-xs text-muted-foreground mb-1 flex items-center">
                                      <DollarSign className="h-3 w-3 mr-1" /> Royalties
                                    </p>
                                    <p className="text-sm">
                                      {contract.commission_percent !== null ? `${contract.commission_percent}%` : "Not set"}
                                    </p>
                                  </div>
                                )
                              }
                              
                              if (contractVisibleFields.free_copies) {
                                visibleItems.push(
                                  <div key="free_copies">
                                    <p className="text-xs text-muted-foreground mb-1 flex items-center">
                                      <FileText className="h-3 w-3 mr-1" /> Free Copies
                                    </p>
                                    <p className="text-sm">
                                      {contract.free_copies !== null ? contract.free_copies : "Not set"}
                                    </p>
                                  </div>
                                )
                              }
                              
                              if (contractVisibleFields.fixed_amount) {
                                visibleItems.push(
                                  <div key="fixed_amount">
                                    <p className="text-xs text-muted-foreground mb-1 flex items-center">
                                      <DollarSign className="h-3 w-3 mr-1" /> Advanced Amount
                                    </p>
                                    <p className="text-sm">
                                      {contract.fixed_amount !== null ? formatCurrency(contract.fixed_amount) : "Not set"}
                                    </p>
                                  </div>
                                )
                              }
                              
                              visibleItems.push(
                                <div key="duration">
                                  <p className="text-xs text-muted-foreground mb-1 flex items-center">
                                    <Clock className="h-3 w-3 mr-1" /> Duration
                                  </p>
                                  <p className="text-sm">
                                    {contract.contract_duration !== null ? `${contract.contract_duration} months` : "Not set"}
                                  </p>
                                </div>
                              )
                              
                              visibleItems.push(
                                <div key="created">
                                  <p className="text-xs text-muted-foreground mb-1 flex items-center">
                                    <Calendar className="h-3 w-3 mr-1" /> Created
                                  </p>
                                  <p className="text-sm">{formatDate(contract.created_at)}</p>
                                </div>
                              )
                              
                              return visibleItems
                            })()}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1 flex items-center">
                                <FileSignature className="h-3 w-3 mr-1" /> Contracted Party
                              </p>
                              <p className="text-sm">{getContractedPartyName(contract)}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 mt-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${getStatusColor(getStatusCode(contract.status_id))}`}
                            >
                              <Clock className="h-3 w-3 mr-1" />
                              {getStatusName(contract.status_id)}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${getTypeColor(contract.contract_type_id)}`}
                            >
                              {getTypeIcon(contract.contract_type_id)}
                              <span className="ml-1">{getTypeName(contract.contract_type_id)}</span>
                            </span>
                          </div>

                          {contract.notes && (
                            <div className="mt-3 text-sm text-muted-foreground bg-muted/30 p-2 rounded-md">
                              {contract.notes}
                            </div>
                          )}

                          {contract.payment_schedule && (
                            <div className="mt-3">
                              <p className="text-xs text-muted-foreground mb-1">Payment Schedule</p>
                              <div className="text-sm bg-muted/30 p-2 rounded-md">{contract.payment_schedule}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

{(modalView === "create" || modalView === "edit") && (
  <form ref={formRef} onSubmit={handleSubmitContract} className="py-4 space-y-4">

    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="title">Contract Title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={selectedContract?.title || ""}
          placeholder="Enter contract title"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contract_type_id">Contract Type</Label>
        <Select
          name="contract_type_id"
          defaultValue={selectedContract?.contract_type_id?.toString() || ""}
          onValueChange={(value) => {
            const newContractTypeId = Number.parseInt(value)
            setSelectedContractType(newContractTypeId)
            setSelectedContractedParty(null) // Reset contracted party selection
            // Update the selected contract with new contract type and reset contracted party
            if (selectedContract) {
              const newContractedPartyType = getContractedPartyTypeFromContractType(newContractTypeId)
              setSelectedContract({
                ...selectedContract,
                contract_type_id: newContractTypeId,
                contracted_party_type_value: newContractedPartyType || undefined,
                contracted_party_id_value: undefined
              })
            }
            // Reset the contracted party dropdown
            if (formRef.current) {
              const contractedPartySelect = formRef.current.querySelector('[name="contracted_party_id"]') as HTMLSelectElement
              if (contractedPartySelect) {
                contractedPartySelect.value = ""
                contractedPartySelect.blur() // Remove focus before hiding
              }
            }
          }}
          required
        >
          <SelectTrigger id="contract_type_id">
            <SelectValue placeholder="Select contract type" />
          </SelectTrigger>
          <SelectContent className="z-[100]">
            {contractTypes.length > 0 ? (
              contractTypes.map((type) => (
                <SelectItem key={type.id} value={type.id.toString()}>
                  {type.display_name_en || `Type ${type.id}`}
                </SelectItem>
              ))
            ) : (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading contract types...</div>
            )}
          </SelectContent>
        </Select>
      </div>

      {selectedContractType && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="contracted_party_id">Contracted Party</Label>
            {(() => {
              const partyType = getContractedPartyTypeFromContractType(selectedContractType)
              const showAddButton = partyType === 'author' || partyType === 'translator' || partyType === 'rightsowner' || partyType === 'reviewer'
              return showAddButton ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setIsAddPartyModalOpen(true)}
                >
                  <PlusCircle className="h-3 w-3 mr-1" />
                  Add New
                </Button>
              ) : null
            })()}
          </div>
          <Select
            name="contracted_party_id"
            defaultValue={selectedContract?.contracted_party_id_value?.toString() || ""}
            required
            onValueChange={(value) => {
              const partyId = Number.parseInt(value)
              setSelectedContractedParty(partyId)
            }}
            onOpenChange={(open) => {
              if (!open) {
                // Remove focus when closing the select
                const select = formRef.current?.querySelector('[name="contracted_party_id"]') as HTMLSelectElement
                if (select) {
                  select.blur()
                }
              }
            }}
          >
            <SelectTrigger id="contracted_party_id">
              <SelectValue placeholder="Select contracted party" />
            </SelectTrigger>
            <SelectContent className="z-[100]">
              {getContractedPartyOptions(
                selectedContract?.contracted_party_type_value
              ).map((party: any) => (
                <SelectItem key={party.id} value={party.id.toString()}>
                  {party.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="status_id">Status</Label>
        <Select
          name="status_id"
          defaultValue={selectedContract?.status_id?.toString() || ""}
          onValueChange={(value) =>
            setSelectedContract((prev) =>
              prev ? { ...prev, status_id: parseInt(value) } : prev
            )
          }
          required
        >
          <SelectTrigger id="status_id">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent className="z-[100]">
            {contractStatuses.map((status) => (
              <SelectItem key={status.id} value={status.id.toString()}>
                {status.display_name_en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="signed_by_id">Signed By</Label>
        <Select
          name="signed_by_id"
          defaultValue={selectedContract?.signed_by_id?.toString() || ""}
          required
        >
          <SelectTrigger id="signed_by_id">
            <SelectValue placeholder="Select signatory" />
          </SelectTrigger>
          <SelectContent className="z-[100]">
            {signatories.length > 0 ? (
              signatories.map((user) => {
                const displayName = user.full_name || `${user.first_name} ${user.last_name}`.trim() || user.username
                return (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {displayName}
                  </SelectItem>
                )
              })
            ) : (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                {process.env.NODE_ENV !== 'production' && `Loading... (count: ${signatories.length})`}
                {process.env.NODE_ENV === 'production' && 'Loading signatories...'}
              </div>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="start_date">Start Date</Label>
        <Input
          id="start_date"
          name="start_date"
          type="date"
          defaultValue={selectedContract?.start_date || ""}
          onChange={handleDateChange}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="end_date">End Date</Label>
        <Input
          id="end_date"
          name="end_date"
          type="date"
          defaultValue={selectedContract?.end_date || ""}
          onChange={handleDateChange}
        />
      </div>

      {visibleFields.fixed_amount && (
        <div className="space-y-2">
          <Label htmlFor="fixed_amount">Advanced Amount</Label>
          <Input
            id="fixed_amount"
            name="fixed_amount"
            type="number"
            step="0.01"
            defaultValue={selectedContract?.fixed_amount || ""}
            placeholder="Enter fixed amount"
          />
        </div>
      )}

      {visibleFields.commission_percent && (
        <>
          <div className="space-y-2">
            <Label htmlFor="royalties_type_id">Royalties Type</Label>
            <Select
              name="royalties_type_id"
              defaultValue={selectedContract?.royalties_type_id?.toString() || ""}
              onValueChange={(value) => {
                // Update hidden input for form submission
                const hiddenInput = formRef.current?.querySelector('[name="royalties_type_id"]') as HTMLInputElement
                if (hiddenInput) {
                  hiddenInput.value = value
                }
              }}
            >
              <SelectTrigger id="royalties_type_id">
                <SelectValue placeholder="Select royalties type" />
              </SelectTrigger>
              <SelectContent className="z-[100]">
                {royaltiesTypes.length > 0 ? (
                  royaltiesTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.display_name_en || `Type ${type.id}`}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    {process.env.NODE_ENV !== 'production' && `Loading... (count: ${royaltiesTypes.length})`}
                    {process.env.NODE_ENV === 'production' && 'Loading royalties types...'}
                  </div>
                )}
              </SelectContent>
            </Select>
            <input
              type="hidden"
              name="royalties_type_id"
              defaultValue={selectedContract?.royalties_type_id?.toString() || ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="commission_percent">Royalties Percentage</Label>
            <Input
              id="commission_percent"
              name="commission_percent"
              type="number"
              step="0.01"
              defaultValue={selectedContract?.commission_percent || ""}
              placeholder="Enter commission percentage"
            />
          </div>
        </>
      )}

      {visibleFields.free_copies && (
        <div className="space-y-2">
          <Label htmlFor="free_copies">Free Copies</Label>
          <Input
            id="free_copies"
            name="free_copies"
            type="number"
            defaultValue={selectedContract?.free_copies || ""}
            placeholder="Enter number of free copies"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="contract_duration">Contract Duration (months)</Label>
        <Input
          id="contract_duration"
          name="contract_duration"
          type="number"
          defaultValue={selectedContract?.contract_duration || ""}
          placeholder="Enter start and end dates to auto-calculate"
          readOnly
        />
        <p className="text-xs text-muted-foreground">
          Duration is automatically calculated based on start and end dates
        </p>
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="payment_schedule">Payment Schedule</Label>
        <Textarea
          id="payment_schedule"
          name="payment_schedule"
          defaultValue={selectedContract?.payment_schedule || ""}
          placeholder="Enter payment schedule details"
          rows={3}
          required
        />
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={selectedContract?.notes || ""}
          placeholder="Enter any additional notes"
          rows={3}
        />
      </div>
    </div>

    <div className="flex justify-end space-x-2 pt-4">
      <Button type="button" variant="outline" onClick={handleBackToList}>
        Cancel
      </Button>
      <Button type="submit" disabled={isSubmitting || isCreating || isUpdating}>
        {(isSubmitting || isCreating || isUpdating) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {modalView === "create" ? "Create Contract" : "Update Contract"}
      </Button>
    </div>
  </form>
)}

        </DialogContent>
      </Dialog>

      {/* Add New Party Modal */}
      <Dialog open={isAddPartyModalOpen} onOpenChange={setIsAddPartyModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedContractType ? (() => {
                const partyType = getContractedPartyTypeFromContractType(selectedContractType)
                if (partyType === 'author') return 'Add New Author'
                if (partyType === 'translator') return 'Add New Translator'
                if (partyType === 'rightsowner') return 'Add New Rights Owner'
                if (partyType === 'reviewer') return 'Add New Reviewer'
                return 'Add New Party'
              })() : 'Add New Party'}
            </DialogTitle>
            <DialogDescription>
              {selectedContractType ? (() => {
                const partyType = getContractedPartyTypeFromContractType(selectedContractType)
                if (partyType === 'author') return 'Create a new author to add to the system.'
                if (partyType === 'translator') return 'Create a new translator to add to the system.'
                if (partyType === 'rightsowner') return 'Create a new rights owner to add to the system.'
                if (partyType === 'reviewer') return 'Create a new reviewer to add to the system.'
                return 'Create a new party to add to the system.'
              })() : 'Create a new party to add to the system.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="party_name">Name *</Label>
              <Input
                id="party_name"
                value={newParty.name}
                onChange={(e) => setNewParty({ ...newParty, name: e.target.value })}
                placeholder="Enter name"
                required
              />
            </div>

            {selectedContractType && (() => {
              const partyType = getContractedPartyTypeFromContractType(selectedContractType)
              if (partyType === 'author' || partyType === 'translator' || partyType === 'reviewer') {
                return (
                  <div className="space-y-2">
                    <Label htmlFor="party_bio">Bio</Label>
                    <Textarea
                      id="party_bio"
                      value={newParty.bio || ""}
                      onChange={(e) => setNewParty({ ...newParty, bio: e.target.value })}
                      placeholder="Enter bio (optional)"
                      rows={3}
                    />
                  </div>
                )
              } else if (partyType === 'rightsowner') {
                return (
                  <div className="space-y-2">
                    <Label htmlFor="party_contact_info">Contact Information</Label>
                    <Textarea
                      id="party_contact_info"
                      value={newParty.contact_info || ""}
                      onChange={(e) => setNewParty({ ...newParty, contact_info: e.target.value })}
                      placeholder="Enter contact information (optional)"
                      rows={3}
                    />
                  </div>
                )
              }
              return null
            })()}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAddPartyModalOpen(false)
                setNewParty({ name: "", bio: "", contact_info: "" })
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateParty}
              disabled={isCreatingParty || !newParty.name.trim()}
            >
              {isCreatingParty && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
    </ErrorBoundary>
  )
}