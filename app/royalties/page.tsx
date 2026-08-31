"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import Link from "next/link"
import { PageBreadcrumb, DASHBOARD_CRUMB } from "@/components/page-breadcrumb"
import { DocumentTitle } from "@/components/document-title"

import { fetchWithRetry } from "@/lib/apiClient"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Calculator, AlertCircle, CheckCircle2, Info, Loader2, FileDown, FileSpreadsheet } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { API_URL } from "@/lib/config"
import { fetchAllPages } from "@/lib/fetch-all-pages"
import { toast } from "sonner"

interface Project {
  id: number
  title_ar: string
  title_original: string | null
}

interface Contract {
  id: number
  title: string | null
  project: {
    id: number
    title_ar: string
    title_original: string | null
  }
}

interface RoyaltiesCalculationDetails {
  X?: number
  Y?: number
  actual_paid?: number
  free_copies?: number
  fully_discounted_copies?: number
  damaged_copies?: number
  lost_copies?: number
  complimentary_stock_copies?: number
  stock_excluded_copies?: number
  royalties_type_id?: number
  royalties_type?: string
  commission_percent?: number
  price?: number
  print_run_id?: number
  edition_number?: number
  avg_total_price?: number | null
  fixed_amount?: number
}

interface RoyaltySettlementInfo {
  id: number
  status: string
  contract_id: number
  project_id: number
  product_id: number
  period_start?: string | null
  period_end?: string | null
  amount_due: number
  currency: string
  eligible: boolean
  reason?: string | null
  calculated_at?: string | null
  settled_at?: string | null
  settle_gate?: {
    can_settle: boolean
    first_settle_only_gate?: boolean
    settle_available_at?: string | null
    reason?: string | null
  } | null
}

interface RoyaltiesCalculationResult {
  eligible: boolean
  RA: number | null
  reason?: string
  details?: RoyaltiesCalculationDetails
  settlement?: RoyaltySettlementInfo
  saved?: boolean
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "open") return "default"
  if (status === "settled") return "secondary"
  if (status === "cancelled") return "destructive"
  return "outline"
}

export default function RoyaltiesReport() {
  const [projects, setProjects] = useState<Project[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null)
  const [result, setResult] = useState<RoyaltiesCalculationResult | null>(null)
  const [openSettlement, setOpenSettlement] = useState<RoyaltySettlementInfo | null>(null)
  const [isLoadingOpenSettlement, setIsLoadingOpenSettlement] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isLoadingContracts, setIsLoadingContracts] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasCalculated, setHasCalculated] = useState(false)

  const [isSettling, setIsSettling] = useState(false)
  const [lastSettledId, setLastSettledId] = useState<number | null>(null)
  const [isDownloadingReport, setIsDownloadingReport] = useState<"pdf" | "xlsx" | null>(null)

  // AbortController refs for request cancellation
  const projectsAbortControllerRef = useRef<AbortController | null>(null)
  const contractsAbortControllerRef = useRef<AbortController | null>(null)
  const calculationAbortControllerRef = useRef<AbortController | null>(null)
  const openSettlementAbortControllerRef = useRef<AbortController | null>(null)

  // Memoized headers to avoid recreating on every render
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

const fetchAllPaginated = useCallback(async <T,>(
    initialUrl: string,
    signal: AbortSignal,
  ): Promise<T[]> => {
    const url = new URL(initialUrl, window.location.origin)
    return fetchAllPages<T>(async (page) => {
      if (signal.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError")
      }

      url.searchParams.set("page", String(page))
      const requestUrl = url.toString()
      const res = await fetchWithRetry(requestUrl, { headers, signal })

      if (!res.ok) {
        throw new Error(`Request failed (${res.status}) for ${requestUrl}`)
      }

      return res.json()
    })
  }, [headers, fetchWithRetry])

  // Fetch projects on mount
  const fetchProjects = useCallback(async () => {
    // Cancel previous request if still pending
    if (projectsAbortControllerRef.current) {
      projectsAbortControllerRef.current.abort()
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController()
    projectsAbortControllerRef.current = abortController
    
    setIsLoadingProjects(true)
    try {
      const projectsData = await fetchAllPaginated<Project>(
        `${API_URL}/inventory/projects/?page_size=100`,
        abortController.signal,
      )
      setProjects(projectsData)
    } catch (error) {
      // Handle AbortError silently
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      
      handleError(error, "Failed to fetch projects")
      setProjects([])
      toast.error("Error", { description: "Failed to load projects. Please try again." })
    } finally {
      setIsLoadingProjects(false)
    }
  }, [fetchAllPaginated, handleError])

  // Fetch contracts for selected project
  const fetchContracts = useCallback(async (projectId: number) => {
    // Cancel previous request if still pending
    if (contractsAbortControllerRef.current) {
      contractsAbortControllerRef.current.abort()
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController()
    contractsAbortControllerRef.current = abortController
    
    setIsLoadingContracts(true)
    try {
      const contractsData = await fetchAllPaginated<Contract>(
        `${API_URL}/inventory/contracts/?project_id=${projectId}&page_size=100`,
        abortController.signal,
      )
      setContracts(contractsData)
    } catch (error) {
      // Handle AbortError silently
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      
      handleError(error, "Failed to fetch contracts")
      setContracts([])
      toast.error("Error", { description: "Failed to load contracts. Please try again." })
    } finally {
      setIsLoadingContracts(false)
    }
  }, [fetchAllPaginated, handleError])

  // Calculate royalties
  const calculateRoyalties = useCallback(async () => {
    if (!selectedContractId && !selectedProjectId) {
      toast.error("Error", { description: "Please select either a contract or a project." })
      return
    }
    
    // Cancel previous request if still pending
    if (calculationAbortControllerRef.current) {
      calculationAbortControllerRef.current.abort()
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController()
    calculationAbortControllerRef.current = abortController
    
    setIsLoading(true)
    setError(null)
    setHasCalculated(true)
    
    try {
      const requestBody: { contract_id?: number; project_id?: number } = {}
      if (selectedContractId) {
        requestBody.contract_id = parseInt(selectedContractId)
      }
      if (selectedProjectId) {
        requestBody.project_id = parseInt(selectedProjectId)
      }
      
      const res = await fetchWithRetry(`${API_URL}/sales/calculate-royalties/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: abortController.signal
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        // Handle error responses (400, 404, etc.)
        setError(data.error || `An error occurred: ${res.status} ${res.statusText}`)
        setResult(null)
        
        // Show actionable error messages
        let errorMessage = data.error || "An error occurred"
        if (errorMessage.includes("sales statistics")) {
          errorMessage = "No sales statistics found. Please run the recalculation endpoint first."
        } else if (errorMessage.includes("PrintRun")) {
          errorMessage = "No PrintRun found. The product needs a PrintRun with a price."
        } else if (errorMessage.includes("fixed_amount") || errorMessage.includes("commission_percent")) {
          errorMessage = "Missing required contract data. Please ensure the contract has fixed_amount and commission_percent."
        }
        
        toast.error("Calculation Error", { description: errorMessage })
        return
      }
      
      // Handle success responses
      setResult(data)
      setError(null)
      if (data.settlement) {
        setOpenSettlement(data.settlement)
      }
      
      if (data.eligible) {
        const savedNote = data.settlement?.id
          ? ` Saved to open settlement #${data.settlement.id}.`
          : ""
        toast.success("Calculation Complete", {
          description: `Royalty Amount: $${Number(data.RA ?? 0).toFixed(2)}.${savedNote}`,
        })
      } else {
        const savedNote = data.settlement?.id
          ? ` Saved to open settlement #${data.settlement.id}.`
          : ""
        toast.success("Not Eligible", {
          description: `${data.reason || "This contract/project is not eligible for royalties."}${savedNote}`,
        })
      }
      
    } catch (error) {
      // Handle AbortError silently
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      
      handleError(error, "Failed to calculate royalties")
      setError('Network error: ' + (error instanceof Error ? error.message : 'Unknown error'))
      setResult(null)
      toast.error("Error", { description: "Failed to calculate royalties. Please try again." })
    } finally {
      setIsLoading(false)
    }
  }, [selectedContractId, selectedProjectId, headers, fetchWithRetry, handleError])

  const fetchOpenSettlement = useCallback(async (contractId: number) => {
    if (openSettlementAbortControllerRef.current) {
      openSettlementAbortControllerRef.current.abort()
    }
    const abortController = new AbortController()
    openSettlementAbortControllerRef.current = abortController
    setIsLoadingOpenSettlement(true)
    try {
      const res = await fetchWithRetry(
        `${API_URL}/sales/royalty-settlements/open/?contract_id=${contractId}`,
        { headers, signal: abortController.signal },
      )
      if (!res.ok) {
        setOpenSettlement(null)
        return
      }
      const data = await res.json()
      setOpenSettlement(data.settlement ?? null)
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return
      handleError(error, "Failed to load open settlement")
      setOpenSettlement(null)
    } finally {
      setIsLoadingOpenSettlement(false)
    }
  }, [headers, fetchWithRetry, handleError])

  const settleRoyalties = useCallback(async () => {
    const settlement = openSettlement ?? result?.settlement ?? null
    const settlementId = settlement?.id
    if (!settlementId) {
      toast.error("Error", { description: "No open settlement to settle. Calculate first." })
      return
    }
    const amountDue = Number(settlement?.amount_due ?? result?.RA ?? 0)
    const eligible = Boolean(settlement?.eligible ?? result?.eligible)
    if (!eligible || !(amountDue > 0)) {
      toast.error("Error", { description: "Settlement must be eligible with amount > 0." })
      return
    }
    if (settlement?.settle_gate && settlement.settle_gate.can_settle === false) {
      toast.error("Settle not allowed yet", {
        description:
          settlement.settle_gate.reason ||
          "First settlement requires 12 months from project creation.",
      })
      return
    }
    if (
      !window.confirm(
        `Settle royalty #${settlementId} for $${amountDue.toFixed(2)}?\n\nThis locks the current cycle and opens a new one.`,
      )
    ) {
      return
    }

    setIsSettling(true)
    try {
      const res = await fetchWithRetry(
        `${API_URL}/sales/royalty-settlements/${settlementId}/settle/`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({}),
        },
      )
      const data = await res.json()
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error || data) || `Settle failed (${res.status})`
        toast.error("Settle failed", { description: msg })
        return
      }

      toast.success("Settled", {
        description: `Settlement #${data.settled?.id} locked. New open cycle #${data.next_open?.id}.`,
      })
      if (data.settled?.id) {
        setLastSettledId(data.settled.id)
      }
      setOpenSettlement(data.next_open ?? null)
      setResult({
        eligible: false,
        RA: null,
        reason: "Settled — new cycle is open. Run Calculate again when ready.",
        settlement: data.next_open,
        saved: true,
      })
      setHasCalculated(true)
    } catch (error) {
      handleError(error, "Failed to settle royalties")
      toast.error("Error", { description: "Failed to settle royalties. Please try again." })
    } finally {
      setIsSettling(false)
    }
  }, [openSettlement, result, headers, fetchWithRetry, handleError])

  const downloadSettlementReport = useCallback(
    async (settlementId: number, format: "pdf" | "xlsx") => {
      setIsDownloadingReport(format)
      try {
        const res = await fetchWithRetry(
          `${API_URL}/sales/royalty-settlements/${settlementId}/report/?format=${format}`,
          { headers },
        )
        if (!res.ok) {
          let msg = `Download failed (${res.status})`
          try {
            const data = await res.json()
            if (typeof data.error === "string") msg = data.error
          } catch {
            /* ignore */
          }
          toast.error("Download failed", { description: msg })
          return
        }
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `royalty-settlement-${settlementId}.${format}`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        toast.success(format === "pdf" ? "PDF downloaded" : "Excel downloaded")
      } catch (error) {
        handleError(error, "Failed to download settlement report")
        toast.error("Error", { description: "Failed to download report." })
      } finally {
        setIsDownloadingReport(null)
      }
    },
    [headers, fetchWithRetry, handleError],
  )

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects()
    
    // Cleanup: abort request when component unmounts
    return () => {
      if (projectsAbortControllerRef.current) {
        projectsAbortControllerRef.current.abort()
      }
    }
  }, [fetchProjects])

  // Fetch contracts when project is selected
  useEffect(() => {
    if (selectedProjectId) {
      fetchContracts(parseInt(selectedProjectId))
      setSelectedContractId(null) // Reset contract selection when project changes
    } else {
      setContracts([])
      setSelectedContractId(null)
    }
  }, [selectedProjectId, fetchContracts])

  // Load current open settlement when contract is selected
  useEffect(() => {
    if (selectedContractId) {
      void fetchOpenSettlement(parseInt(selectedContractId, 10))
    } else {
      setOpenSettlement(null)
    }
  }, [selectedContractId, fetchOpenSettlement])

  // Cleanup: Cancel all pending requests on component unmount
  useEffect(() => {
    return () => {
      if (projectsAbortControllerRef.current) {
        projectsAbortControllerRef.current.abort()
      }
      if (contractsAbortControllerRef.current) {
        contractsAbortControllerRef.current.abort()
      }
      if (calculationAbortControllerRef.current) {
        calculationAbortControllerRef.current.abort()
      }
      if (openSettlementAbortControllerRef.current) {
        openSettlementAbortControllerRef.current.abort()
      }
    }
  }, [])

  // Reset result when selection changes
  useEffect(() => {
    setResult(null)
    setError(null)
    setHasCalculated(false)
    setLastSettledId(null)
  }, [selectedContractId, selectedProjectId])

  const getRoyaltyTypeDisplay = (typeId?: number) => {
    if (typeId === 52) return "List Price"
    if (typeId === 53) return "Retail Price"
    return "Unknown"
  }

  const currentSettlement = openSettlement ?? result?.settlement ?? null
  const canShowSettle =
    currentSettlement?.status === "open" &&
    Boolean(currentSettlement.eligible) &&
    Number(currentSettlement.amount_due ?? 0) > 0

  return (
      <SidebarInset>
        <DocumentTitle title="Royalties" />
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <PageBreadcrumb items={[DASHBOARD_CRUMB, { label: "Royalties", href: "/royalties" }, { label: "Calculate & Settle" }]} />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="min-h-[50vh] flex-1 rounded-xl bg-muted/50 p-6 md:min-h-min">
            <div className="flex flex-col gap-6">
              <div className="flex justify-between items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-semibold">Royalties Calculation</h2>
                <Button variant="outline" asChild>
                  <Link href="/royalties/history">Settlement History</Link>
                </Button>
              </div>

              {/* Selection Form */}
              <Card>
                <CardHeader>
                  <CardTitle>Select Contract or Project</CardTitle>
                  <CardDescription>
                    Select either a contract or a project to calculate royalties. Contract selection takes priority over project.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <label className="text-sm font-medium mb-2 block">Project (Optional)</label>
                      <Select 
                        value={selectedProjectId ?? undefined} 
                        onValueChange={(value) => setSelectedProjectId(value || null)}
                        disabled={isLoadingProjects}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingProjects ? "Loading projects..." : "Select a project"} />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id.toString()}>
                              {project.title_ar || project.title_original || `Project #${project.id}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex-1">
                      <label className="text-sm font-medium mb-2 block">Contract (Optional)</label>
                      <Select 
                        value={selectedContractId ?? undefined} 
                        onValueChange={(value) => setSelectedContractId(value || null)}
                        disabled={isLoadingContracts || !selectedProjectId}
                      >
                        <SelectTrigger>
                          <SelectValue 
                            placeholder={
                              !selectedProjectId 
                                ? "Select a project first" 
                                : isLoadingContracts 
                                ? "Loading contracts..." 
                                : "Select a contract"
                            } 
                          />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                          {contracts.map((contract) => (
                            <SelectItem key={contract.id} value={contract.id.toString()}>
                              {contract.title || `Contract #${contract.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                    </div>

                    <div className="flex items-end">
                <Button
                        onClick={calculateRoyalties}
                        disabled={(!selectedContractId && !selectedProjectId) || isLoading}
                        className="min-w-[180px]"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Calculating...
                          </>
                        ) : (
                          <>
                            <Calculator className="mr-2 h-4 w-4" />
                            Calculate Royalties
                          </>
                        )}
                </Button>
              </div>
            </div>
                    </CardContent>
                  </Card>

              {/* Current open settlement status (loaded by contract / updated by Calculate) */}
              {selectedContractId && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg">Current Accrual Record</CardTitle>
                        <CardDescription>
                          Manual Calculate saves/updates this open settlement. Settle locks it and opens a new cycle.
                        </CardDescription>
                      </div>
                      {isLoadingOpenSettlement && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {!isLoadingOpenSettlement && !currentSettlement ? (
                      <p className="text-sm text-muted-foreground">
                        No open settlement yet. Press <strong>Calculate Royalties</strong> to create and save one.
                      </p>
                    ) : currentSettlement ? (
                      <div className="space-y-4">
                        {result?.saved && hasCalculated && (
                          <Alert>
                            <CheckCircle2 className="h-4 w-4" />
                            <AlertTitle>Amount saved</AlertTitle>
                            <AlertDescription>
                              Calculation was written to open settlement #{currentSettlement.id}.
                            </AlertDescription>
                          </Alert>
                        )}
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                          <div className="rounded-md border p-3">
                            <p className="text-xs text-muted-foreground">Status</p>
                            <div className="mt-1">
                              <Badge variant={statusBadgeVariant(currentSettlement.status)}>
                                {currentSettlement.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="rounded-md border p-3">
                            <p className="text-xs text-muted-foreground">Amount due</p>
                            <p className="text-lg font-semibold">
                              ${Number(currentSettlement.amount_due ?? 0).toFixed(2)}
                            </p>
                          </div>
                          <div className="rounded-md border p-3">
                            <p className="text-xs text-muted-foreground">Eligible</p>
                            <p className="text-lg font-semibold">
                              {currentSettlement.eligible ? "Yes" : "No"}
                            </p>
                          </div>
                          <div className="rounded-md border p-3">
                            <p className="text-xs text-muted-foreground">Last calculated</p>
                            <p className="text-sm font-medium">
                              {formatDateTime(currentSettlement.calculated_at)}
                            </p>
                          </div>
                          <div className="rounded-md border p-3">
                            <p className="text-xs text-muted-foreground">Record ID</p>
                            <p className="text-lg font-semibold">#{currentSettlement.id}</p>
                          </div>
                          <div className="rounded-md border p-3">
                            <p className="text-xs text-muted-foreground">Product</p>
                            <p className="text-lg font-semibold">#{currentSettlement.product_id}</p>
                          </div>
                          <div className="rounded-md border p-3">
                            <p className="text-xs text-muted-foreground">Period start</p>
                            <p className="text-sm font-medium">
                              {formatDateTime(currentSettlement.period_start)}
                            </p>
                          </div>
                          <div className="rounded-md border p-3">
                            <p className="text-xs text-muted-foreground">Period end</p>
                            <p className="text-sm font-medium">
                              {formatDateTime(currentSettlement.period_end)}
                            </p>
                          </div>
                        </div>

                        {canShowSettle && (
                          <div className="flex flex-col items-start gap-2 border-t pt-4">
                            <Button
                              onClick={() => void settleRoyalties()}
                              disabled={
                                isSettling ||
                                isLoading ||
                                currentSettlement.settle_gate?.can_settle === false
                              }
                              className="min-w-[180px]"
                            >
                              {isSettling ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Settling...
                                </>
                              ) : (
                                <>
                                  <DollarSign className="mr-2 h-4 w-4" />
                                  Settle Royalties
                                </>
                              )}
                            </Button>
                            {currentSettlement.settle_gate?.can_settle === false && (
                              <p className="text-xs text-muted-foreground max-w-xl">
                                {currentSettlement.settle_gate.reason ||
                                  "First settle allowed after 12 months from project creation."}
                                {currentSettlement.settle_gate.settle_available_at
                                  ? ` Available: ${formatDateTime(
                                      currentSettlement.settle_gate.settle_available_at,
                                    )}`
                                  : ""}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              )}

              {/* Post-settle report downloads (generated on backend) */}
              {lastSettledId != null && (
                <Card className="border-blue-200 bg-blue-50/40">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Settlement Report</CardTitle>
                    <CardDescription>
                      Settlement #{lastSettledId} locked. Download a simple bilingual PDF (logo +
                      signature) or an accounting Excel summary. Official preamble text can be
                      swapped in later.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      onClick={() => void downloadSettlementReport(lastSettledId, "pdf")}
                      disabled={isDownloadingReport !== null}
                    >
                      {isDownloadingReport === "pdf" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileDown className="mr-2 h-4 w-4" />
                      )}
                      Download PDF
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void downloadSettlementReport(lastSettledId, "xlsx")}
                      disabled={isDownloadingReport !== null}
                    >
                      {isDownloadingReport === "xlsx" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                      )}
                      Download Excel
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Results */}
              {hasCalculated && (
                <>
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {result && !error && (
                    <>
                      {/* Eligible State */}
                      {result.eligible && result.RA !== null && (
                        <Card className="border-green-500">
                          <CardHeader>
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                              <CardTitle className="text-green-700">✅ Eligible for Royalties</CardTitle>
                            </div>
                    </CardHeader>
                    <CardContent>
                            <div className="space-y-4">
                              <div className="text-center py-4 bg-green-50 rounded-lg border border-green-200">
                                <div className="text-sm text-muted-foreground mb-1">Royalty Amount</div>
                                <div className="text-4xl font-bold text-green-700">
                                  ${result.RA.toFixed(2)}
                                </div>
                                {result.saved && (
                                  <p className="mt-2 text-xs text-green-700">
                                    Saved to open settlement #{currentSettlement?.id ?? result.settlement?.id}
                                  </p>
                                )}
                              </div>

                              {result.details && (
                                <Accordion type="single" collapsible className="w-full">
                                  <AccordionItem value="details">
                                    <AccordionTrigger>Calculation Details</AccordionTrigger>
                                    <AccordionContent>
                                      <div className="grid grid-cols-2 gap-4 pt-2">
                                        {result.details.X !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">X (Advance Coverage)</div>
                                            <div className="text-lg font-semibold">{result.details.X} books</div>
                                          </div>
                                        )}
                                        {result.details.Y !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">Y (Eligible Books)</div>
                                            <div className="text-lg font-semibold">{result.details.Y} books</div>
                                          </div>
                                        )}
                                        {result.details.actual_paid !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">Actual Paid</div>
                                            <div className="text-lg font-semibold">{result.details.actual_paid} books</div>
                                          </div>
                                        )}
                                        {result.details.free_copies !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">Free Copies</div>
                                            <div className="text-lg font-semibold">{result.details.free_copies} books</div>
                                          </div>
                                        )}
                                        {result.details.fully_discounted_copies !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">100% Discount Copies</div>
                                            <div className="text-lg font-semibold">{result.details.fully_discounted_copies} books</div>
                                          </div>
                                        )}
                                        {result.details.damaged_copies !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">Damaged (Stock)</div>
                                            <div className="text-lg font-semibold">{result.details.damaged_copies} books</div>
                                          </div>
                                        )}
                                        {result.details.lost_copies !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">Lost (Stock)</div>
                                            <div className="text-lg font-semibold">{result.details.lost_copies} books</div>
                                          </div>
                                        )}
                                        {result.details.complimentary_stock_copies !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">Complimentary (Stock)</div>
                                            <div className="text-lg font-semibold">{result.details.complimentary_stock_copies} books</div>
                                          </div>
                                        )}
                                        {result.details.stock_excluded_copies !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">Stock Excluded Total</div>
                                            <div className="text-lg font-semibold">{result.details.stock_excluded_copies} books</div>
                                          </div>
                                        )}
                                        {result.details.commission_percent !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">Commission</div>
                                            <div className="text-lg font-semibold">{result.details.commission_percent}%</div>
                                          </div>
                                        )}
                                        {result.details.royalties_type_id && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">Royalty Type</div>
                                            <div className="text-lg font-semibold">
                                              {getRoyaltyTypeDisplay(result.details.royalties_type_id)}
                                            </div>
                                          </div>
                                        )}
                                        {result.details.price !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">Price</div>
                                            <div className="text-lg font-semibold">{result.details.price.toFixed(2)}</div>
                                          </div>
                                        )}
                                        {result.details.avg_total_price !== undefined && result.details.avg_total_price !== null && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">Average Total Price</div>
                                            <div className="text-lg font-semibold">{result.details.avg_total_price.toFixed(2)}</div>
                                          </div>
                                        )}
                                        {result.details.print_run_id !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">Print Run ID</div>
                                            <div className="text-lg font-semibold">#{result.details.print_run_id}</div>
                                          </div>
                                        )}
                                        {result.details.edition_number !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">Edition Number</div>
                                            <div className="text-lg font-semibold">{result.details.edition_number}</div>
                                          </div>
                                        )}
                </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                </Accordion>
                              )}
                      </div>
                    </CardContent>
                  </Card>
                      )}

                      {/* Not Eligible State */}
                      {!result.eligible && (
                        <Card className="border-yellow-500">
                    <CardHeader>
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-5 w-5 text-yellow-500" />
                              <CardTitle className="text-yellow-700">❌ Not Eligible for Royalties</CardTitle>
                            </div>
                    </CardHeader>
                    <CardContent>
                            <div className="space-y-4">
                              {result.reason && (
                                <Alert>
                                  <Info className="h-4 w-4" />
                                  <AlertTitle>Reason</AlertTitle>
                                  <AlertDescription>{result.reason}</AlertDescription>
                                </Alert>
                              )}

                              {result.details && (
                                <Accordion type="single" collapsible className="w-full">
                                  <AccordionItem value="details">
                                    <AccordionTrigger>Calculation Details</AccordionTrigger>
                                    <AccordionContent>
                                      <div className="grid grid-cols-2 gap-4 pt-2">
                                        {result.details.X !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">X</div>
                                            <div className="text-lg font-semibold">{result.details.X} books</div>
                                          </div>
                                        )}
                                        {result.details.Y !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">Y</div>
                                            <div className="text-lg font-semibold">{result.details.Y} books</div>
                                          </div>
                                        )}
                                        {result.details.actual_paid !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">Actual Paid</div>
                                            <div className="text-lg font-semibold">{result.details.actual_paid} books</div>
                                          </div>
                                        )}
                                        {result.details.free_copies !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">Free Copies</div>
                                            <div className="text-lg font-semibold">{result.details.free_copies} books</div>
                                          </div>
                                        )}
                                        {result.details.fully_discounted_copies !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">100% Discount Copies</div>
                                            <div className="text-lg font-semibold">{result.details.fully_discounted_copies} books</div>
                                          </div>
                                        )}
                                        {result.details.damaged_copies !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">Damaged (Stock)</div>
                                            <div className="text-lg font-semibold">{result.details.damaged_copies} books</div>
                                          </div>
                                        )}
                                        {result.details.lost_copies !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">Lost (Stock)</div>
                                            <div className="text-lg font-semibold">{result.details.lost_copies} books</div>
                                          </div>
                                        )}
                                        {result.details.complimentary_stock_copies !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">Complimentary (Stock)</div>
                                            <div className="text-lg font-semibold">{result.details.complimentary_stock_copies} books</div>
                                          </div>
                                        )}
                                        {result.details.stock_excluded_copies !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">Stock Excluded Total</div>
                                            <div className="text-lg font-semibold">{result.details.stock_excluded_copies} books</div>
                                          </div>
                                        )}
                                        {result.details.fixed_amount !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">Advance Payment</div>
                                            <div className="text-lg font-semibold">${result.details.fixed_amount.toFixed(2)}</div>
                                          </div>
                                        )}
                                        {result.details.commission_percent !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">Commission</div>
                                            <div className="text-lg font-semibold">{result.details.commission_percent}%</div>
                                          </div>
                                        )}
                                        {result.details.price !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">Price</div>
                                            <div className="text-lg font-semibold">{result.details.price.toFixed(2)}</div>
                                          </div>
                                        )}
                                        {result.details.print_run_id !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">Print Run ID</div>
                                            <div className="text-lg font-semibold">#{result.details.print_run_id}</div>
                                          </div>
                                        )}
                                        {result.details.edition_number !== undefined && (
                                          <div>
                                            <div className="text-sm font-medium text-muted-foreground">Edition Number</div>
                                            <div className="text-lg font-semibold">{result.details.edition_number}</div>
                                          </div>
                                        )}
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                </Accordion>
                              )}
                      </div>
                    </CardContent>
                  </Card>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Initial State */}
              {!hasCalculated && (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center text-muted-foreground">
                      <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Please select a contract or project, then click "Calculate Royalties" to see the results.</p>
                      </div>
                    </CardContent>
                  </Card>
              )}
                </div>
          </div>
        </div>
      </SidebarInset>
)
}
