"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ArrowLeft, FileText, Calendar, DollarSign, User, Clock, CheckCircle, AlertCircle, Clock as ClockIcon } from "lucide-react"
import { useState, useEffect } from "react"
import { toast } from "@/hooks/use-toast"

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

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project | null
  token: string
}

export default function ProjectContractsModal({
  open,
  onOpenChange,
  project,
  token,
}: Props) {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [isContractsLoading, setIsContractsLoading] = useState(false)

  const API_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    "https://dararabappbackendv01-production.up.railway.app/api"

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }

  const fetchContractsForProject = async (projectId: number) => {
    setIsContractsLoading(true)
    try {
      const res = await fetch(
        `${API_URL}/inventory/contracts/?project_id=${projectId}`,
        { headers }
      )
      const data = await res.json()
      const contractsData = Array.isArray(data)
        ? data
        : data.results || data.contracts || []

      setContracts(
        contractsData.filter((c: Contract) => c.project.id === projectId)
      )
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch contracts",
        variant: "destructive",
      })
    } finally {
      setIsContractsLoading(false)
    }
  }

  useEffect(() => {
    if (open && project?.id) {
      fetchContractsForProject(project.id)
    }
  }, [open, project?.id])

  const getStatusColor = (status: string | null) => {
    if (!status) return "gray"
    switch (status.toLowerCase()) {
      case "active":
      case "signed":
        return "green"
      case "pending":
      case "draft":
        return "yellow"
      case "expired":
      case "terminated":
        return "red"
      default:
        return "blue"
    }
  }

  const getStatusIcon = (status: string | null) => {
    if (!status) return <ClockIcon className="h-4 w-4" />
    switch (status.toLowerCase()) {
      case "active":
      case "signed":
        return <CheckCircle className="h-4 w-4" />
      case "pending":
      case "draft":
        return <ClockIcon className="h-4 w-4" />
      case "expired":
      case "terminated":
        return <AlertCircle className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not specified"
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "Not specified"
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2 text-primary" />
            {project?.title_ar}
            {project?.title_original && (
              <span className="text-muted-foreground ml-2">
                ({project.title_original})
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            View all contracts associated with this project
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="mb-6">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Project Contracts
            </h3>
          </div>

          {isContractsLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3 text-muted-foreground">Loading contracts...</span>
            </div>
          ) : contracts.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h4 className="text-lg font-medium text-gray-600 mb-2">No Contracts Found</h4>
              <p className="text-gray-500">No contracts have been created for this project yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {contracts.map((contract) => {
                const statusColor = getStatusColor(contract.status?.display_name_en ?? null)
                const statusIcon = getStatusIcon(contract.status?.display_name_en ?? null)
                
                return (
                  <div
                    key={contract.id}
                    className={`group relative overflow-hidden rounded-lg border p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${
                      statusColor === 'green' ? 'border-green-200 bg-gradient-to-br from-green-50 to-emerald-50' :
                      statusColor === 'yellow' ? 'border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50' :
                      statusColor === 'red' ? 'border-red-200 bg-gradient-to-br from-red-50 to-rose-50' :
                      'border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50'
                    }`}
                  >
                    {/* Decorative background element */}
                    <div className={`absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-12 translate-x-12 opacity-20 group-hover:opacity-30 transition-opacity ${
                      statusColor === 'green' ? 'bg-green-100' :
                      statusColor === 'yellow' ? 'bg-yellow-100' :
                      statusColor === 'red' ? 'bg-red-100' :
                      'bg-blue-100'
                    }`}></div>
                    
                    <div className="relative">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h4 className="font-semibold text-lg mb-1">
                            {contract.title || "Untitled Contract"}
                          </h4>
                          <div className="flex items-center gap-2">
                            {statusIcon}
                            <span className={`text-sm font-medium ${
                              statusColor === 'green' ? 'text-green-700' :
                              statusColor === 'yellow' ? 'text-yellow-700' :
                              statusColor === 'red' ? 'text-red-700' :
                              'text-blue-700'
                            }`}>
                              {contract.status?.display_name_en || "Unknown Status"}
                            </span>
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                          statusColor === 'green' ? 'bg-green-100 text-green-800' :
                          statusColor === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                          statusColor === 'red' ? 'bg-red-100 text-red-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {contract.contract_type?.display_name_en || "Contract"}
                        </div>
                      </div>

                      {/* Contract Details */}
                      <div className="space-y-3">
                        {/* Contracted Party */}
                        {contract.contracted_party_details && (
                          <div className="flex items-center gap-3">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{contract.contracted_party_details.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{contract.contracted_party_details.type}</p>
                            </div>
                          </div>
                        )}

                        {/* Financial Details */}
                        {(contract.commission_percent || contract.fixed_amount) && (
                          <div className="flex items-center gap-3">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <div>
                              {contract.fixed_amount && (
                                <p className="text-sm font-medium">{formatCurrency(contract.fixed_amount)}</p>
                              )}
                              {contract.commission_percent && (
                                <p className="text-xs text-muted-foreground">{contract.commission_percent}% commission</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Duration */}
                        {contract.contract_duration && (
                          <div className="flex items-center gap-3">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{contract.contract_duration} months</p>
                              <p className="text-xs text-muted-foreground">Contract Duration</p>
                            </div>
                          </div>
                        )}

                        {/* Dates */}
                        {(contract.start_date || contract.end_date) && (
                          <div className="flex items-center gap-3">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">
                                {contract.start_date && formatDate(contract.start_date ?? null)}
                                {contract.start_date && contract.end_date && " - "}
                                {contract.end_date && formatDate(contract.end_date ?? null)}
                              </p>
                              <p className="text-xs text-muted-foreground">Contract Period</p>
                            </div>
                          </div>
                        )}

                        {/* Free Copies */}
                        {contract.free_copies && (
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{contract.free_copies} free copies</p>
                              <p className="text-xs text-muted-foreground">Included in contract</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Notes */}
                      {contract.notes && (
                        <div className="mt-4 pt-3 border-t border-gray-200">
                          <p className="text-sm text-muted-foreground italic">"{contract.notes}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
