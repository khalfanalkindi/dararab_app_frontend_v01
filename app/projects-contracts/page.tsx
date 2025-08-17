"use client"

import type React from "react"

import Link from "next/link"
import { useState, useEffect, useRef } from "react"
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
} from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { format, parseISO } from "date-fns"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://dararabappbackendv01-production.up.railway.app/api"

interface Project {
  id: number
  title_ar: string
  title_original: string | null
  approval_status: boolean
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
  const [signatories, setSignatories] = useState<ApiUser[]>([])
  // Add state for contracted parties
  const [newContract, setNewContract] = useState<Partial<Contract>>({})
  const [authors, setAuthors] = useState<Author[]>([])
  const [translators, setTranslators] = useState<Translator[]>([])
  const [rightsOwners, setRightsOwners] = useState<RightsOwner[]>([])
  const [reviewers, setReviewers] = useState<Reviewer[]>([])
  const [selectedContractType, setSelectedContractType] = useState<number | null>(null)
  const [contentTypes, setContentTypes] = useState<{ id: number; model: string }[]>([])
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
  const formRef = useRef<HTMLFormElement>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [contractToDelete, setContractToDelete] = useState<Contract | null>(null)

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
  const updateContractDuration = () => {
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
  }

  // Show alert message
  const showAlert = (type: "success" | "error" | "warning", message: string) => {
    setActionAlert({ type, message })
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setActionAlert({ type: null, message: "" })
    }, 5000)
  }

  // Headers for API requests
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
  }

  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`${API_URL}/inventory/projects/`, { headers })
        if (!res.ok) throw new Error("Failed to fetch projects")

        const data = await res.json()
        // Handle different possible response formats
        let projectsData: Project[] = []
        if (Array.isArray(data)) {
          projectsData = data
        } else if (data && data.results && Array.isArray(data.results)) {
          projectsData = data.results
        } else if (data && data.projects && Array.isArray(data.projects)) {
          projectsData = data.projects
        } else {
          console.error("Unexpected projects data format:", data)
        }

        // Filter to only show approved projects
        const approvedProjects = projectsData.filter((project: Project) => project.approval_status === true)
        setProjects(approvedProjects)
      } catch (error) {
        console.error("Error fetching projects:", error)
        toast({
          title: "Error",
          description: "Failed to fetch projects",
          variant: "destructive",
        })
        showAlert("error", "Failed to fetch projects. Please try again later.")
      } finally {
        setIsLoading(false)
      }
    }

    const fetchContractTypes = async () => {
      try {
        const res = await fetch(`${API_URL}/common/list-items/contract_type/`, { headers })
        if (!res.ok) throw new Error("Failed to fetch contract types")
        const data = await res.json()
        
        // Handle different possible response formats
        let typesData: ContractType[] = []
        if (Array.isArray(data)) {
          typesData = data
        } else if (data && data.results && Array.isArray(data.results)) {
          typesData = data.results
        } else if (data && data.types && Array.isArray(data.types)) {
          typesData = data.types
        } else {
          console.error("Unexpected contract types data format:", data)
        }
        
        setContractTypes(typesData)
      } catch (error) {
        console.error("Error fetching contract types:", error)
        setContractTypes([])
      }
    }

    const fetchContractStatuses = async () => {
      try {
        const res = await fetch(`${API_URL}/common/list-items/contract_status/`, { headers })
        if (!res.ok) throw new Error("Failed to fetch contract statuses")
        const data = await res.json()
        
        // Handle different possible response formats
        let statusesData: ContractStatus[] = []
        if (Array.isArray(data)) {
          statusesData = data
        } else if (data && data.results && Array.isArray(data.results)) {
          statusesData = data.results
        } else if (data && data.statuses && Array.isArray(data.statuses)) {
          statusesData = data.statuses
        } else {
          console.error("Unexpected contract statuses data format:", data)
        }
        
        setContractStatuses(statusesData)
      } catch (error) {
        console.error("Error fetching contract statuses:", error)
        setContractStatuses([])
      }
    }

    const fetchSignatories = async () => {
      try {
        console.log("Fetching signatories from API...")
        const accessToken = localStorage.getItem("accessToken")
        console.log("Access Token:", accessToken)
        
        if (!accessToken) {
          console.error("No access token found")
          return
        }
        
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        }
        
        console.log("Making API request to:", `${API_URL}/users/`)
        const res = await fetch(`${API_URL}/users/`, {
          headers,
        })
        
        console.log("API response status:", res.status)
        
        if (!res.ok) {
          const errorText = await res.text()
          console.error("Error response:", errorText)
          throw new Error(`Failed to fetch signatories: ${res.status} ${res.statusText}`)
        }
        
        const data = await res.json()
        console.log("Signatories data:", data)
        
        // Handle different possible response formats
        if (Array.isArray(data)) {
          setSignatories(data)
        } else if (data && data.results && Array.isArray(data.results)) {
          setSignatories(data.results)
        } else if (data && data.users && Array.isArray(data.users)) {
          setSignatories(data.users)
        } else {
          console.error("Unexpected data format:", data)
          setSignatories([])
        }
      } catch (error) {
        console.error("Error fetching signatories:", error)
        setSignatories([])
      }
    }

    // // Add useEffect to fetch content types
    // const fetchContentTypes = async () => {
    //   try {
    //     const res = await fetch(`${API_URL}/common/content-types/`, { headers })
    //     if (!res.ok) throw new Error("Failed to fetch content types")
    //     const data = await res.json()
    //     setContentTypes(data)
    //   } catch (error) {
    //     console.error("Error fetching content types:", error)
    //   }
    // }

    // Add useEffect to fetch contracted parties
    const fetchAuthors = async () => {
      try {
        const res = await fetch(`${API_URL}/inventory/authors/`, { headers })
        if (!res.ok) throw new Error("Failed to fetch authors")
        const data = await res.json()
        setAuthors(data)
      } catch (error) {
        console.error("Error fetching authors:", error)
      }
    }

    const fetchTranslators = async () => {
      try {
        const res = await fetch(`${API_URL}/inventory/translators/`, { headers })
        if (!res.ok) throw new Error("Failed to fetch translators")
        const data = await res.json()
        setTranslators(data)
      } catch (error) {
        console.error("Error fetching translators:", error)
      }
    }

    const fetchRightsOwners = async () => {
      try {
        const res = await fetch(`${API_URL}/inventory/rights-owners/`, { headers })
        if (!res.ok) throw new Error("Failed to fetch rights owners")
        const data = await res.json()
        setRightsOwners(data)
      } catch (error) {
        console.error("Error fetching rights owners:", error)
      }
    }

    const fetchReviewers = async () => {
      try {
        const res = await fetch(`${API_URL}/inventory/reviewers/`, { headers })
        if (!res.ok) throw new Error("Failed to fetch reviewers")
        const data = await res.json()
        setReviewers(data)
      } catch (error) {
        console.error("Error fetching reviewers:", error)
      }
    }

    fetchProjects()
    fetchContractTypes()
    fetchContractStatuses()
    fetchSignatories()
    // fetchContentTypes()
    fetchAuthors()
    fetchTranslators()
    fetchRightsOwners()
    fetchReviewers()
  }, [])

  const fetchContractsForProject = async (projectId: number) => {
    setIsContractsLoading(true)
    try {
      console.log("Fetching contracts for project:", projectId)
      const res = await fetch(`${API_URL}/inventory/contracts/?project_id=${projectId}`, { headers })
      if (!res.ok) throw new Error("Failed to fetch contracts")
      const data = await res.json()
      console.log("Fetched contracts:", data)
      
      // Handle different possible response formats
      let contractsData: Contract[] = []
      if (Array.isArray(data)) {
        contractsData = data
      } else if (data && data.results && Array.isArray(data.results)) {
        contractsData = data.results
      } else if (data && data.contracts && Array.isArray(data.contracts)) {
        contractsData = data.contracts
      } else {
        console.error("Unexpected contracts data format:", data)
      }

      // Filter contracts to ensure they belong to the selected project
      const projectContracts = contractsData.filter((contract: Contract) => contract.project.id === projectId)
      setContracts(projectContracts)
    } catch (error) {
      console.error("Error fetching contracts:", error)
      toast({
        title: "Error",
        description: "Failed to fetch contracts",
        variant: "destructive",
      })
    } finally {
      setIsContractsLoading(false)
    }
  }

  const openContractsModal = (project: Project) => {
    setSelectedProject(project)
    setIsContractsModalOpen(true)
    setModalView("list")
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

  const getTypeIcon = (typeId: number | undefined) => {
    if (!typeId) return <FileText className="h-4 w-4" />
    if (!contractTypes || !Array.isArray(contractTypes)) return <FileText className="h-4 w-4" />

    const type = contractTypes.find((t) => t.id === typeId)
    if (!type) return <FileText className="h-4 w-4" />

    const typeName = type.display_name_en.toLowerCase()

    if (typeName.includes("author")) return <User className="h-4 w-4" />
    if (typeName.includes("translator")) return <FileSignature className="h-4 w-4" />
    if (typeName.includes("right")) return <FileText className="h-4 w-4" />
    if (typeName.includes("print")) return <Printer className="h-4 w-4" />

    return <FileText className="h-4 w-4" />
  }

  const getTypeColor = (typeId: number | undefined) => {
    if (!typeId) return "bg-gray-100 text-gray-800 border-gray-300"
    if (!contractTypes || !Array.isArray(contractTypes)) return "bg-gray-100 text-gray-800 border-gray-300"

    const type = contractTypes.find((t) => t.id === typeId)
    if (!type) return "bg-gray-100 text-gray-800 border-gray-300"

    const typeName = type.display_name_en.toLowerCase()

    if (typeName.includes("author")) return "bg-purple-100 text-purple-800 border-purple-300"
    if (typeName.includes("translator")) return "bg-indigo-100 text-indigo-800 border-indigo-300"
    if (typeName.includes("right")) return "bg-cyan-100 text-cyan-800 border-cyan-300"
    if (typeName.includes("print")) return "bg-orange-100 text-orange-800 border-orange-300"

    return "bg-gray-100 text-gray-800 border-gray-300"
  }

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

  const getStatusName = (statusId: number | null) => {
    if (!statusId) return "Not set"
    const status = contractStatuses.find((s) => s.id === statusId)
    return status ? status.display_name_en : "Unknown"
  }

  const getStatusCode = (statusId: number | null) => {
    if (!statusId) return ""
    if (!contractStatuses || !Array.isArray(contractStatuses)) return ""
    const status = contractStatuses.find((s) => s && s.id === statusId)
    return status?.value || ""
  }

  const getTypeName = (typeId: number | null) => {
    if (!typeId) return "Not set"
    const type = contractTypes.find((t) => t.id === typeId)
    return type ? type.display_name_en : "Unknown"
  }

  const getSignatoryName = (signatoryId: number | null, signedBy?: ApiUser) => {
    if (signedBy) {
      // Handle the API response structure where full_name is a single field
      if ('full_name' in signedBy) {
        return signedBy.full_name
      }
      // Fallback to the original structure with first_name and last_name
      return `${signedBy.first_name} ${signedBy.last_name}`.trim() || signedBy.username
    }
    if (!signatoryId) return "Not set"
    const signatory = signatories.find((s) => s.id === signatoryId)
    return signatory ? `${signatory.first_name} ${signatory.last_name}`.trim() || signatory.username : "Unknown"
  }

  // Add function to get content type ID based on contract type
  const getContentTypeIdForContractType = (contractTypeId: number | null) => {
    if (!contractTypeId) return null

    const contractType = contractTypes.find((t) => t.id === contractTypeId)
    if (!contractType) return null

    const typeName = contractType.display_name_en.toLowerCase()

    if (typeName.includes("author")) {
      return contentTypes.find((ct) => ct.model === "author")?.id || null
    }
    if (typeName.includes("translator")) {
      return contentTypes.find((ct) => ct.model === "translator")?.id || null
    }
    if (typeName.includes("rights")) {
      return contentTypes.find((ct) => ct.model === "rightsowner")?.id || null
    }
    if (typeName.includes("reviewer")) {
      return contentTypes.find((ct) => ct.model === "reviewer")?.id || null
    }

    return null
  }

  // Add function to get contracted party options based on contract type
  const getContractedPartyOptions = (contractedPartyType?: string | null) => {
    console.log('getContractedPartyOptions called with:', {
      contractedPartyType,
      selectedContractType,
      authors: authors?.length,
      translators: translators?.length,
      rightsOwners: rightsOwners?.length,
      reviewers: reviewers?.length
    })

    // Helper function to extract items from paginated response
    const getItems = (data: any) => {
      if (!data) return []
      if (Array.isArray(data)) return data
      if (data.results && Array.isArray(data.results)) return data.results
      return []
    }

    // If a specific type is provided, use that
    if (contractedPartyType) {
      console.log('Using provided contracted party type:', contractedPartyType)
      switch (contractedPartyType.toLowerCase()) {
        case 'author':
          const authorItems = getItems(authors)
          console.log('Returning authors:', authorItems)
          return authorItems
        case 'translator':
          const translatorItems = getItems(translators)
          console.log('Returning translators:', translatorItems)
          return translatorItems
        case 'rightsowner':
          const rightsOwnerItems = getItems(rightsOwners)
          console.log('Returning rights owners:', rightsOwnerItems)
          return rightsOwnerItems
        case 'reviewer':
          const reviewerItems = getItems(reviewers)
          console.log('Returning reviewers:', reviewerItems)
          return reviewerItems
        default:
          console.log('Unknown contracted party type:', contractedPartyType)
          return []
      }
    }
    
    // Otherwise use the selected contract type
    if (!selectedContractType) {
      console.log('No selected contract type')
      return []
    }

    const contractType = contractTypes.find((t) => t.id === selectedContractType)
    if (!contractType) {
      console.log('No contract type found for ID:', selectedContractType)
      return []
    }

    console.log('Using contract type:', contractType)
    const typeName = contractType.display_name_en.toLowerCase()
    console.log('Contract type name:', typeName)

    if (typeName.includes("author")) {
      const authorItems = getItems(authors)
      console.log('Returning authors based on contract type:', authorItems)
      return authorItems
    }
    if (typeName.includes("translator")) {
      const translatorItems = getItems(translators)
      console.log('Returning translators based on contract type:', translatorItems)
      return translatorItems
    }
    if (typeName.includes("rights")) {
      const rightsOwnerItems = getItems(rightsOwners)
      console.log('Returning rights owners based on contract type:', rightsOwnerItems)
      return rightsOwnerItems
    }
    if (typeName.includes("reviewer")) {
      const reviewerItems = getItems(reviewers)
      console.log('Returning reviewers based on contract type:', reviewerItems)
      return reviewerItems
    }

    console.log('No matching contract type found')
    return []
  }

  // Helper function to determine contracted party type from contract type
  const getContractedPartyTypeFromContractType = (contractTypeId: number | null) => {
    console.log('getContractedPartyTypeFromContractType called with:', contractTypeId)
    
    if (!contractTypeId) {
      console.log('No contract type ID provided')
      return null
    }
    
    const contractType = contractTypes.find(type => type.id === contractTypeId)
    if (!contractType) {
      console.log('No contract type found for ID:', contractTypeId)
      return null
    }
    
    console.log('Found contract type:', contractType)
    const typeName = contractType.display_name_en.toLowerCase()
    console.log('Contract type name:', typeName)
    
    if (typeName.includes('author')) {
      console.log('Returning author type')
      return 'author'
    }
    if (typeName.includes('translator')) {
      console.log('Returning translator type')
      return 'translator'
    }
    if (typeName.includes('rights')) {
      console.log('Returning rightsowner type')
      return 'rightsowner'
    }
    if (typeName.includes('reviewer')) {
      console.log('Returning reviewer type')
      return 'reviewer'
    }
    
    console.log('No matching type found')
    return null
  }

  // Update handleCreateContract to reset selectedContractType
  const handleCreateContract = () => {
    setModalView("create")
    setSelectedContract(null)
    setSelectedContractType(null)
  }

  // Update handleSubmitContract to handle content_type and object_id
  const handleSubmitContract = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formRef.current || !selectedProject) return

    setIsSubmitting(true)

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
      console.log("Sending contract data:", contractData)

      let res

      if (modalView === "create") {
        // Create new contract
        res = await fetch(`${API_URL}/inventory/contracts/`, {
          method: "POST",
          headers,
          body: JSON.stringify(contractData),
        })
      } else {
        // Update existing contract
        if (!selectedContract) return

        res = await fetch(`${API_URL}/inventory/contracts/${selectedContract.id}/`, {
          method: "PUT",
          headers,
          body: JSON.stringify(contractData),
        })
      }

      if (!res.ok) {
        const errorText = await res.text()
        console.error("Error response:", errorText)
        try {
          const errorData = JSON.parse(errorText)
          throw new Error(errorData.detail || JSON.stringify(errorData))
        } catch (e) {
          throw new Error(`Failed to save contract: ${errorText}`)
        }
      }

      const savedContract = await res.json()
      console.log("Saved contract response:", savedContract)

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
      console.error("Error saving contract:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save contract",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Add function to get contracted party name
  const getContractedPartyName = (contract: Contract) => {
    if (!contract.content_type_id || !contract.object_id) return "Not set"

    const contentType = contentTypes.find((ct) => ct.id === contract.content_type_id)
    if (!contentType) return "Unknown"

    const model = contentType.model.toLowerCase()

    if (model === "author") {
      return authors.find((a) => a.id === contract.object_id)?.name || "Unknown Author"
    }
    if (model === "translator") {
      return translators.find((t) => t.id === contract.object_id)?.name || "Unknown Translator"
    }
    if (model === "rightsowner") {
      return rightsOwners.find((r) => r.id === contract.object_id)?.name || "Unknown Rights Owner"
    }
    if (model === "reviewer") {
      return reviewers.find((r) => r.id === contract.object_id)?.name || "Unknown Reviewer"
    }

    return "Unknown"
  }

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

    try {
      const res = await fetch(`${API_URL}/inventory/contracts/${contractToDelete.id}/delete/`, {
        method: "DELETE",
        headers,
      })

      if (!res.ok) {
        throw new Error("Failed to delete contract")
      }

      setContracts(contracts.filter((c) => c.id !== contractToDelete.id))
      toast({
        title: "Contract Deleted",
        description: "Contract has been deleted",
        variant: "default",
      })
      setContractToDelete(null)
      setDeleteConfirmation("")
    } catch (error) {
      console.error("Error deleting contract:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete contract",
        variant: "destructive",
      })
    }
  }

  // Fetch contracts when component mounts or filters change
  useEffect(() => {
    fetchContractsForProject(selectedProject?.id || 0)
  }, [selectedProject])

  // Calculate duration when form is loaded with existing data
  useEffect(() => {
    if (modalView === "edit" && selectedContract) {
      // Use setTimeout to ensure the form is rendered before calculating
      setTimeout(updateContractDuration, 100)
    }
  }, [modalView, selectedContract])

  // Update handleEditContract to set selectedContractType
  const handleEditContract = (contract: Contract) => {
    const enrichedContract = {
      ...contract,
      contract_type: contractTypes.find((t) => t.id === contract.contract_type_id),
      status: contractStatuses.find((s) => s.id === contract.status_id),
      signed_by: signatories.find((u) => u.id === contract.signed_by_id),
      signed_by_id: contract.signed_by_id ?? contract.signed_by?.id ?? null,
      contracted_party_id_value: contract.contracted_party_details?.id ?? contract.object_id,
      contracted_party_type_value: contract.contracted_party_details?.type,
    }

    setSelectedContract(enrichedContract)
    setSelectedContractType(contract.contract_type_id)
    setModalView("edit")
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
            <h2 className="text-xl font-semibold mb-4">Project Contracts</h2>
            <p className="mb-6">Manage contracts for your approved projects.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                <div className="col-span-full flex items-center justify-center py-12">
                  <div className="flex flex-col items-center">
                    <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4"></div>
                    <p className="text-muted-foreground">Loading projects...</p>
                  </div>
                </div>
              ) : projects.length === 0 ? (
                <div className="col-span-full flex items-center justify-center py-12 border rounded-xl bg-muted/30">
                  <div className="flex flex-col items-center p-6">
                    <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-medium mb-2">No approved projects found</h3>
                    <p className="text-muted-foreground text-center">
                      There are no approved projects available for contracts.
                    </p>
                  </div>
                </div>
              ) : (
                projects.map((project) => (
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
                ))
              )}
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* Contracts Modal */}
      <Dialog open={isContractsModalOpen} onOpenChange={setIsContractsModalOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
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
                  disabled={deleteConfirmation !== "DELETE"}
                >
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
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2">Loading contracts...</span>
                </div>
              ) : contracts.length === 0 ? (
                <div className="text-center py-8 border rounded-md bg-muted/30">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No contracts available</h3>
                  <p className="text-muted-foreground">Add your first contract to get started.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {contracts
                    .filter(contract => contract.project.id === selectedProject?.id)
                    .map((contract) => (
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
                            <div>
                              <p className="text-xs text-muted-foreground mb-1 flex items-center">
                                <DollarSign className="h-3 w-3 mr-1" /> Royalties
                              </p>
                              <p className="text-sm">
                                {contract.commission_percent !== null ? `${contract.commission_percent}%` : "Not set"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1 flex items-center">
                                <FileText className="h-3 w-3 mr-1" /> Free Copies
                              </p>
                              <p className="text-sm">
                                {contract.free_copies !== null ? contract.free_copies : "Not set"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1 flex items-center">
                                <Clock className="h-3 w-3 mr-1" /> Duration
                              </p>
                              <p className="text-sm">
                                {contract.contract_duration !== null ? `${contract.contract_duration} months` : "Not set"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1 flex items-center">
                                <Calendar className="h-3 w-3 mr-1" /> Created
                              </p>
                              <p className="text-sm">{formatDate(contract.created_at)}</p>
                            </div>
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
          <SelectContent>
            {contractTypes.map((type) => (
              <SelectItem key={type.id} value={type.id.toString()}>
                {type.display_name_en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedContractType && (
        <div className="space-y-2">
          <Label htmlFor="contracted_party_id">Contracted Party</Label>
          <Select
            name="contracted_party_id"
            defaultValue={selectedContract?.contracted_party_id_value?.toString() || ""}
            required
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
            <SelectContent>
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
          <SelectContent>
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
          <SelectContent>
            {signatories.map((user) => (
              <SelectItem key={user.id} value={user.id.toString()}>
                {user.username}
              </SelectItem>
            ))}
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
          onChange={updateContractDuration}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="end_date">End Date</Label>
        <Input
          id="end_date"
          name="end_date"
          type="date"
          defaultValue={selectedContract?.end_date || ""}
          onChange={updateContractDuration}
        />
      </div>

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
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {modalView === "create" ? "Create Contract" : "Update Contract"}
      </Button>
    </div>
  </form>
)}

        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}