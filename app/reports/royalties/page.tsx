"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { AppSidebar } from "../../../components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Calculator, AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { API_URL } from "@/lib/config"
import { toast } from "@/hooks/use-toast"

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
  royalties_type_id?: number
  royalties_type?: string
  commission_percent?: number
  price?: number
  print_run_id?: number
  edition_number?: number
  avg_total_price?: number | null
  fixed_amount?: number
}

interface RoyaltiesCalculationResult {
  eligible: boolean
  RA: number | null
  reason?: string
  details?: RoyaltiesCalculationDetails
}

export default function RoyaltiesReport() {
  const [projects, setProjects] = useState<Project[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null)
  const [result, setResult] = useState<RoyaltiesCalculationResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isLoadingContracts, setIsLoadingContracts] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasCalculated, setHasCalculated] = useState(false)

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
            }, { once: true })
          }
        })
      }
    }
    
    // If we get here, all retries failed
    throw lastError || new Error('Request failed after retries')
  }, [])

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
      const res = await fetchWithRetry(`${API_URL}/inventory/projects/`, { 
        headers,
        signal: abortController.signal
      })
      
      if (!res.ok) {
        throw new Error(`Failed to fetch projects: ${res.status} ${res.statusText}`)
      }
      
      const data = await res.json()
      const projectsData = Array.isArray(data) ? data : data.results || []
      setProjects(projectsData)
    } catch (error) {
      // Handle AbortError silently
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      
      handleError(error, "Failed to fetch projects")
      setProjects([])
      toast({
        title: "Error",
        description: "Failed to load projects. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingProjects(false)
    }
  }, [headers, fetchWithRetry, handleError])

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
      const res = await fetchWithRetry(`${API_URL}/inventory/contracts/?project_id=${projectId}`, { 
        headers,
        signal: abortController.signal
      })
      
      if (!res.ok) {
        throw new Error(`Failed to fetch contracts: ${res.status} ${res.statusText}`)
      }
      
      const data = await res.json()
      const contractsData = Array.isArray(data) ? data : data.results || []
      setContracts(contractsData)
    } catch (error) {
      // Handle AbortError silently
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      
      handleError(error, "Failed to fetch contracts")
      setContracts([])
      toast({
        title: "Error",
        description: "Failed to load contracts. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingContracts(false)
    }
  }, [headers, fetchWithRetry, handleError])

  // Calculate royalties
  const calculateRoyalties = useCallback(async () => {
    if (!selectedContractId && !selectedProjectId) {
      toast({
        title: "Error",
        description: "Please select either a contract or a project.",
        variant: "destructive",
      })
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
        
        toast({
          title: "Calculation Error",
          description: errorMessage,
          variant: "destructive",
        })
        return
      }
      
      // Handle success responses
      setResult(data)
      setError(null)
      
      if (data.eligible) {
        toast({
          title: "Calculation Complete",
          description: `Royalty Amount: $${data.RA?.toFixed(2)}`,
          variant: "default",
        })
      } else {
        toast({
          title: "Not Eligible",
          description: data.reason || "This contract/project is not eligible for royalties.",
          variant: "default",
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
      toast({
        title: "Error",
        description: "Failed to calculate royalties. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [selectedContractId, selectedProjectId, headers, fetchWithRetry, handleError])

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
    setHasCalculated(false)
  }, [selectedContractId, selectedProjectId])

  const getRoyaltyTypeDisplay = (typeId?: number) => {
    if (typeId === 52) return "List Price"
    if (typeId === 53) return "Retail Price"
    return "Unknown"
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
                <BreadcrumbItem>
                  <BreadcrumbPage>Royalties Calculation</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="min-h-[50vh] flex-1 rounded-xl bg-muted/50 p-6 md:min-h-min">
            <div className="flex flex-col gap-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">Royalties Calculation</h2>
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
                        <SelectContent>
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
                  <SelectContent>
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
    </SidebarProvider>
  )
}
