"use client"

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react"
import { PageBreadcrumb, DASHBOARD_CRUMB } from "@/components/page-breadcrumb"
import { DocumentTitle } from "@/components/document-title"

import { fetchWithRetry } from "@/lib/apiClient"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Calculator, AlertCircle, CheckCircle2, Loader2, FileDown } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { API_URL } from "@/lib/config"
import { fetchAllPages } from "@/lib/fetch-all-pages"
import { toast } from "sonner"
import { ProjectCombobox } from "./components/project-combobox"
import {
  downloadRoyaltySettlementExcel,
  downloadRoyaltySettlementPdf,
  type RoyaltyReportInput,
} from "@/lib/royaltySettlementReport"

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
  /** Legacy list-price field; prefer book_price when present */
  price?: number
  book_price?: number
  print_run_id?: number
  edition_number?: number
  avg_total_price?: number | null
  fixed_amount?: number
  // Shared / cycle metadata
  version?: string
  formula?: string
  period_start?: string | null
  prior_settled?: boolean
  // Retail (id=53)
  paid_net_revenue?: number
  royalty_earned?: number
  unrecovered_advance?: number
  amount_due?: number
  period_start_date?: string | null
  period_end_date?: string | null
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
  settle_gate?: RoyaltySettlementInfo["settle_gate"]
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

function formatDateOnly(value?: string | null): string {
  if (!value) return "—"
  // YYYY-MM-DD from backend — avoid timezone shift for date-only strings
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString()
}

function formatMoneyUsd(value: number): string {
  return `$${Number(value).toFixed(2)}`
}

function DetailField({
  label,
  value,
  hint,
}: {
  label: string
  value: ReactNode
  hint?: string
}) {
  return (
    <div>
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function CalculationDetailsGrid({
  details,
  royaltyTypeLabel,
}: {
  details: RoyaltiesCalculationDetails
  royaltyTypeLabel: string
}) {
  const bookPrice =
    details.book_price !== undefined
      ? details.book_price
      : details.price !== undefined
        ? details.price
        : undefined

  const formulaText =
    details.formula ||
    (details.royalties_type_id === 52
      ? "RA = Y × book_price × (commission_percent / 100)"
      : details.royalties_type_id === 53
        ? "amount_due = max(0, paid_net_revenue × % − unrecovered_advance)"
        : null)

  const periodStartRaw = details.period_start ?? details.period_start_date ?? null

  return (
    <div className="grid grid-cols-2 gap-4 pt-2">
      {details.X !== undefined && (
        <DetailField label="X (Advance Coverage)" value={`${details.X} books`} />
      )}
      {details.Y !== undefined && (
        <DetailField label="Y (Eligible Books)" value={`${details.Y} books`} />
      )}
      {details.actual_paid !== undefined && (
        <DetailField label="Actual Paid" value={`${details.actual_paid} books`} />
      )}
      {details.free_copies !== undefined && (
        <DetailField label="Free Copies" value={`${details.free_copies} books`} />
      )}
      {details.fully_discounted_copies !== undefined && (
        <DetailField
          label="100% Discount Copies"
          value={`${details.fully_discounted_copies} books`}
        />
      )}
      {details.damaged_copies !== undefined && (
        <DetailField label="Damaged (Stock)" value={`${details.damaged_copies} books`} />
      )}
      {details.lost_copies !== undefined && (
        <DetailField label="Lost (Stock)" value={`${details.lost_copies} books`} />
      )}
      {details.complimentary_stock_copies !== undefined && (
        <DetailField
          label="Complimentary (Stock)"
          value={`${details.complimentary_stock_copies} books`}
        />
      )}
      {details.stock_excluded_copies !== undefined && (
        <DetailField
          label="Stock Excluded Total"
          value={`${details.stock_excluded_copies} books`}
        />
      )}

      {details.paid_net_revenue !== undefined && (
        <DetailField
          label="Paid Net Revenue"
          value={formatMoneyUsd(details.paid_net_revenue)}
        />
      )}
      {details.royalty_earned !== undefined && (
        <DetailField label="Royalty Earned" value={formatMoneyUsd(details.royalty_earned)} />
      )}
      {details.unrecovered_advance !== undefined && (
        <DetailField
          label="Unrecovered Advance"
          value={formatMoneyUsd(details.unrecovered_advance)}
        />
      )}
      {details.amount_due !== undefined && (
        <DetailField label="Amount Due (calc)" value={formatMoneyUsd(details.amount_due)} />
      )}
      {details.fixed_amount !== undefined && (
        <DetailField label="Advance Payment" value={formatMoneyUsd(details.fixed_amount)} />
      )}

      {details.commission_percent !== undefined && (
        <DetailField label="Commission" value={`${details.commission_percent}%`} />
      )}
      {details.royalties_type_id ? (
        <DetailField label="Royalty Type" value={royaltyTypeLabel} />
      ) : null}

      {bookPrice !== undefined && (
        <DetailField label="Book Price" value={formatMoneyUsd(bookPrice)} />
      )}
      {details.avg_total_price !== undefined && details.avg_total_price !== null && (
        <DetailField
          label="Average Total Price"
          value={formatMoneyUsd(details.avg_total_price)}
        />
      )}

      {periodStartRaw != null && periodStartRaw !== "" && (
        <DetailField
          label="Period Start"
          value={
            details.period_start_date
              ? formatDateOnly(details.period_start_date)
              : formatDateTime(details.period_start)
          }
          hint="Counting from project created date or last settle — not contract start_date."
        />
      )}
      {details.period_end_date != null && details.period_end_date !== "" && (
        <DetailField
          label="Period End"
          value={formatDateOnly(details.period_end_date)}
        />
      )}
      {details.prior_settled !== undefined && (
        <DetailField label="Prior Settled" value={details.prior_settled ? "Yes" : "No"} />
      )}
      {details.version && <DetailField label="Formula Version" value={details.version} />}

      {details.print_run_id !== undefined && (
        <DetailField label="Print Run ID" value={`#${details.print_run_id}`} />
      )}
      {details.edition_number !== undefined && (
        <DetailField label="Edition Number" value={details.edition_number} />
      )}

      {formulaText && (
        <div className="col-span-2">
          <div className="text-sm font-medium text-muted-foreground">Formula</div>
          <div className="text-sm font-semibold font-mono mt-0.5">{formulaText}</div>
        </div>
      )}
    </div>
  )
}

export default function RoyaltiesReport() {
  const [projects, setProjects] = useState<Project[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null)
  const [result, setResult] = useState<RoyaltiesCalculationResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [busyAction, setBusyAction] = useState<"eligibility" | "calculation" | null>(null)
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isLoadingContracts, setIsLoadingContracts] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChecked, setHasChecked] = useState(false)
  const [showCalculation, setShowCalculation] = useState(false)

  const [isSettling, setIsSettling] = useState(false)
  const [settleConfirmOpen, setSettleConfirmOpen] = useState(false)
  const [lastSettledId, setLastSettledId] = useState<number | null>(null)
  const [settledReport, setSettledReport] = useState<RoyaltyReportInput | null>(null)
  const [isDownloadingReport, setIsDownloadingReport] = useState<"pdf" | "xlsx" | null>(null)

  // AbortController refs for request cancellation
  const projectsAbortControllerRef = useRef<AbortController | null>(null)
  const contractsAbortControllerRef = useRef<AbortController | null>(null)
  const calculationAbortControllerRef = useRef<AbortController | null>(null)

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

  const bothSelected = Boolean(selectedProjectId && selectedContractId)

  // Eligibility check and Calculate are previews. Nothing is written until Settle.
  const runPreview = useCallback(async (mode: "eligibility" | "calculation") => {
    if (!selectedContractId || !selectedProjectId) {
      toast.error("Error", { description: "Select a project and a contract first." })
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
    setBusyAction(mode)
    setError(null)
    setHasChecked(true)
    if (mode === "eligibility") {
      setShowCalculation(false)
      setLastSettledId(null)
      setSettledReport(null)
    }
    
    try {
      const requestBody = {
        contract_id: parseInt(selectedContractId, 10),
        project_id: parseInt(selectedProjectId, 10),
        preview: true,
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
      
      setResult(data)
      setError(null)
      if (mode === "calculation") {
        setShowCalculation(true)
      }
      
      if (data.eligible) {
        toast.success(mode === "calculation" ? "Calculation complete" : "Eligible", {
          description:
            mode === "calculation"
              ? `Royalty amount: $${Number(data.RA ?? 0).toFixed(2)}. Nothing was saved.`
              : "This contract can be calculated and settled.",
        })
      } else {
        toast.message("Not eligible", {
          description: data.reason || "This contract is not eligible for royalties.",
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
      setBusyAction(null)
    }
  }, [selectedContractId, selectedProjectId, headers, fetchWithRetry, handleError])

  const settleRoyalties = useCallback(async () => {
    if (!selectedContractId || !selectedProjectId) {
      toast.error("Error", { description: "Select a project and a contract first." })
      return
    }
    const gate = result?.settle_gate ?? result?.settlement?.settle_gate
    if (!result?.eligible) {
      toast.error("Not eligible", { description: result?.reason || "Settle stays locked." })
      return
    }
    if (gate && gate.can_settle === false) {
      toast.error("Settle not allowed yet", {
        description: gate.reason || "First settlement requires 12 months from project creation.",
      })
      return
    }
    setIsSettling(true)
    setError(null)
    try {
      const res = await fetchWithRetry(`${API_URL}/sales/calculate-royalties/`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          contract_id: parseInt(selectedContractId, 10),
          project_id: parseInt(selectedProjectId, 10),
          settle: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error || data) || `Settle failed (${res.status})`
        setError(msg)
        toast.error("Settle failed", { description: msg })
        return
      }

      toast.success("Settled", {
        description: `Settlement #${data.settled?.id} saved. You can open the report below.`,
      })
      if (data.settled?.id) {
        const project = projects.find((item) => String(item.id) === selectedProjectId)
        const contract = contracts.find((item) => String(item.id) === selectedContractId)
        setLastSettledId(data.settled.id)
        setSettledReport({
          id: data.settled.id,
          amount_due: data.settled.amount_due,
          amount_paid: data.settled.amount_paid,
          currency: data.settled.currency,
          period_start: data.settled.period_start,
          period_end: data.settled.period_end,
          settled_at: data.settled.settled_at,
          settled_by_name: data.settled.settled_by_name,
          contract_id: data.settled.contract_id,
          contract_title: contract?.title ?? null,
          project_id: data.settled.project_id,
          project_title_ar: project?.title_ar ?? null,
          project_title_en: project?.title_original ?? null,
          product_id: data.settled.product_id,
        })
      }
      setResult(data)
      setHasChecked(true)
      setShowCalculation(true)
    } catch (error) {
      handleError(error, "Failed to settle royalties")
      const msg = error instanceof Error ? error.message : "Failed to settle royalties. Please try again."
      setError(msg)
      toast.error("Error", { description: msg })
    } finally {
      setIsSettling(false)
      setSettleConfirmOpen(false)
    }
  }, [selectedContractId, selectedProjectId, projects, contracts, result, headers, fetchWithRetry, handleError])

  const downloadSettlementReport = useCallback(
    async (format: "pdf" | "xlsx") => {
      if (!settledReport) return
      setIsDownloadingReport(format)
      try {
        if (format === "pdf") await downloadRoyaltySettlementPdf(settledReport)
        else downloadRoyaltySettlementExcel(settledReport)
        toast.success(format === "pdf" ? "PDF downloaded" : "Excel downloaded")
      } catch (error) {
        handleError(error, "Failed to download settlement report")
        toast.error("Error", { description: "Failed to download report." })
      } finally {
        setIsDownloadingReport(null)
      }
    },
    [settledReport, handleError],
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
    }
  }, [])

  // Reset result when selection changes
  useEffect(() => {
    setResult(null)
    setError(null)
    setHasChecked(false)
    setShowCalculation(false)
    setLastSettledId(null)
    setSettledReport(null)
  }, [selectedContractId, selectedProjectId])

  const getRoyaltyTypeDisplay = (typeId?: number) => {
    if (typeId === 52) return "List Price"
    if (typeId === 53) return "Retail Price"
    return "Unknown"
  }

  const settleGate = result?.settle_gate ?? result?.settlement?.settle_gate ?? null
  const settleFrozen = !result?.eligible || settleGate?.can_settle === false
  const settleFrozenReason = !result?.eligible
    ? result?.reason || "This contract is not eligible, so settle stays locked."
    : settleGate?.can_settle === false
      ? settleGate.reason || "First settlement is allowed only after 12 months from project creation."
      : null

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
              <div>
                <h2 className="text-2xl font-semibold">Royalties</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select a project and a contract. Check eligibility, then calculate a preview. Nothing is saved until you settle.
                </p>
              </div>

              {/* Selection Form */}
              <Card>
                <CardHeader>
                  <CardTitle>Project and contract</CardTitle>
                  <CardDescription>
                    Both are required before you can check eligibility, calculate, or settle.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <label className="text-sm font-medium mb-2 block">Project</label>
                      <ProjectCombobox
                        projects={projects}
                        value={selectedProjectId}
                        onChange={setSelectedProjectId}
                        isLoading={isLoadingProjects}
                      />
                    </div>

                    <div className="flex-1">
                      <label className="text-sm font-medium mb-2 block">Contract</label>
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

                    {bothSelected && (
                      <div className="flex items-end">
                        <Button
                          onClick={() => void runPreview("eligibility")}
                          disabled={isLoading || isSettling}
                          className="min-w-[180px]"
                        >
                          {busyAction === "eligibility" ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Checking...
                            </>
                          ) : (
                            <>
                              <AlertCircle className="mr-2 h-4 w-4" />
                              Check eligibility
                            </>
                          )}
                        </Button>
                      </div>
                    )}
            </div>
                    </CardContent>
                  </Card>

              {!bothSelected && (
                <Card>
                  <CardContent className="py-10">
                    <div className="text-center text-muted-foreground">
                      <DollarSign className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p>Select a project and a contract. Both are required.</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {bothSelected && !hasChecked && !error && (
                <Card>
                  <CardContent className="py-10">
                    <div className="text-center text-muted-foreground">
                      <Calculator className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p>Check eligibility to continue. The next actions appear only after that.</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {error && (
                <Alert variant="destructive" className="border-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Could not complete this step</AlertTitle>
                  <AlertDescription className="text-base leading-relaxed">{error}</AlertDescription>
                </Alert>
              )}

              {hasChecked && result && !error && !result.eligible && (
                <Card className="border-2 border-yellow-500">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                      <CardTitle className="text-yellow-800">Not eligible</CardTitle>
                    </div>
                    <CardDescription>This contract cannot be settled. The reason is below.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-md border border-yellow-300 bg-yellow-50 p-4">
                      <p className="text-sm font-semibold text-yellow-950">Reason</p>
                      <p className="mt-2 text-sm leading-relaxed text-yellow-950">
                        {result.reason || "This contract is not eligible for royalties."}
                      </p>
                    </div>
                    <Button disabled className="min-w-[180px]">
                      <DollarSign className="mr-2 h-4 w-4" />
                      Settle
                    </Button>
                    <p className="max-w-xl text-sm text-muted-foreground">{settleFrozenReason}</p>
                  </CardContent>
                </Card>
              )}

              {hasChecked && result && !error && result.eligible && (
                <Card className="border-2 border-green-600">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <CardTitle className="text-green-800">Eligible</CardTitle>
                    </div>
                    <CardDescription>
                      Calculate shows the amount and does not save. Settle saves the record and unlocks the report.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => void runPreview("calculation")}
                        disabled={isLoading || isSettling}
                        className="min-w-[180px]"
                      >
                        {busyAction === "calculation" ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Calculating...
                          </>
                        ) : (
                          <>
                            <Calculator className="mr-2 h-4 w-4" />
                            Calculate
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => setSettleConfirmOpen(true)}
                        disabled={isSettling || isLoading || settleFrozen}
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
                            Settle
                          </>
                        )}
                      </Button>
                    </div>
                    {settleFrozen && settleFrozenReason ? (
                      <p className="max-w-xl text-sm text-muted-foreground">{settleFrozenReason}</p>
                    ) : null}

                    {showCalculation && result.RA !== null && (
                      <div className="space-y-4 border-t pt-4">
                        <div className="rounded-lg border border-green-200 bg-green-50 py-4 text-center">
                          <div className="mb-1 text-sm text-muted-foreground">Royalty amount</div>
                          <div className="text-4xl font-bold text-green-700">
                            ${result.RA.toFixed(2)}
                          </div>
                          {lastSettledId == null ? (
                            <p className="mt-2 text-xs text-muted-foreground">Preview only. Not saved.</p>
                          ) : null}
                        </div>
                        {result.details && (
                          <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="details">
                              <AccordionTrigger>Calculation details</AccordionTrigger>
                              <AccordionContent>
                                <CalculationDetailsGrid
                                  details={result.details}
                                  royaltyTypeLabel={getRoyaltyTypeDisplay(result.details.royalties_type_id)}
                                />
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        )}
                      </div>
                    )}

                    {lastSettledId != null && (
                      <div className="space-y-3 border-t pt-4">
                        <p className="text-sm font-medium">
                          Settlement #{lastSettledId} is saved. Open the report:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            onClick={() => void downloadSettlementReport("pdf")}
                            disabled={isDownloadingReport !== null}
                          >
                            {isDownloadingReport === "pdf" ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <FileDown className="mr-2 h-4 w-4" />
                            )}
                            PDF
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => void downloadSettlementReport("xlsx")}
                            disabled={isDownloadingReport !== null}
                          >
                            {isDownloadingReport === "xlsx" ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <FileDown className="mr-2 h-4 w-4" />
                            )}
                            Excel
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

                </div>
          </div>
        </div>
      <AlertDialog
        open={settleConfirmOpen}
        onOpenChange={(open) => {
          if (isSettling) return
          setSettleConfirmOpen(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Settle this royalty?</AlertDialogTitle>
            <AlertDialogDescription>
              This saves settlement
              {result?.RA != null ? ` for $${Number(result.RA).toFixed(2)}` : ""} and locks the current cycle.
              You can open the PDF and Excel report after it is saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSettling}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void settleRoyalties()
              }}
              disabled={isSettling}
            >
              {isSettling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Settling...
                </>
              ) : (
                "Confirm settle"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </SidebarInset>
)
}
