"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PageBreadcrumb, DASHBOARD_CRUMB } from "@/components/page-breadcrumb"
import { DocumentTitle } from "@/components/document-title"
import { fetchWithRetry } from "@/lib/apiClient"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { History, Loader2, FileDown } from "lucide-react"
import { API_URL } from "@/lib/config"
import { fetchAllPages } from "@/lib/fetch-all-pages"
import { toast } from "sonner"
import { ProjectCombobox } from "../components/project-combobox"

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

interface SettlementHistoryRow {
  id: number
  status: string
  contract_id: number
  project_id: number
  product_id: number
  period_start?: string | null
  period_end?: string | null
  amount_due: number
  amount_paid?: number | null
  currency: string
  settled_at?: string | null
  settled_by_name?: string | null
  contract_title?: string | null
  project_title_ar?: string | null
  project_title_en?: string | null
  product_title_ar?: string | null
  product_title_en?: string | null
  product_isbn?: string | null
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

export default function RoyaltiesSettlementHistoryPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null)
  const [rows, setRows] = useState<SettlementHistoryRow[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isLoadingContracts, setIsLoadingContracts] = useState(false)
  const [isLoadingRows, setIsLoadingRows] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)

  const projectsAbortControllerRef = useRef<AbortController | null>(null)
  const contractsAbortControllerRef = useRef<AbortController | null>(null)
  const listAbortControllerRef = useRef<AbortController | null>(null)

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
    }),
    [],
  )

  const handleError = useCallback((error: unknown, defaultMessage: string) => {
    if (error instanceof DOMException && error.name === "AbortError") return
    if (process.env.NODE_ENV !== "production") {
      console.error(defaultMessage, error)
    }
  }, [])

  const fetchAllPaginated = useCallback(
    async <T,>(initialUrl: string, signal: AbortSignal): Promise<T[]> => {
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
    },
    [headers],
  )

  const fetchProjects = useCallback(async () => {
    if (projectsAbortControllerRef.current) {
      projectsAbortControllerRef.current.abort()
    }
    const abortController = new AbortController()
    projectsAbortControllerRef.current = abortController
    setIsLoadingProjects(true)
    try {
      const data = await fetchAllPaginated<Project>(
        `${API_URL}/inventory/projects/?page_size=100`,
        abortController.signal,
      )
      setProjects(data)
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return
      handleError(error, "Failed to fetch projects")
      toast.error("Error", { description: "Failed to load projects." })
    } finally {
      setIsLoadingProjects(false)
    }
  }, [fetchAllPaginated, handleError])

  const fetchContracts = useCallback(
    async (projectId: number) => {
      if (contractsAbortControllerRef.current) {
        contractsAbortControllerRef.current.abort()
      }
      const abortController = new AbortController()
      contractsAbortControllerRef.current = abortController
      setIsLoadingContracts(true)
      try {
        const data = await fetchAllPaginated<Contract>(
          `${API_URL}/inventory/contracts/?project_id=${projectId}&page_size=100`,
          abortController.signal,
        )
        setContracts(data)
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return
        handleError(error, "Failed to fetch contracts")
        setContracts([])
        toast.error("Error", { description: "Failed to load contracts." })
      } finally {
        setIsLoadingContracts(false)
      }
    },
    [fetchAllPaginated, handleError],
  )

  const fetchHistory = useCallback(
    async (contractId: number) => {
      if (listAbortControllerRef.current) {
        listAbortControllerRef.current.abort()
      }
      const abortController = new AbortController()
      listAbortControllerRef.current = abortController
      setIsLoadingRows(true)
      try {
        const res = await fetchWithRetry(
          `${API_URL}/sales/royalty-settlements/?contract_id=${contractId}&status=settled`,
          { headers, signal: abortController.signal },
        )
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(
            typeof data.error === "string" ? data.error : `Failed (${res.status})`,
          )
        }
        const data = await res.json()
        setRows(Array.isArray(data.results) ? data.results : [])
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return
        handleError(error, "Failed to load settlement history")
        setRows([])
        toast.error("Error", {
          description: error instanceof Error ? error.message : "Failed to load history.",
        })
      } finally {
        setIsLoadingRows(false)
      }
    },
    [headers, handleError],
  )

  const downloadReport = useCallback(
    async (settlementId: number, format: "pdf" | "xlsx") => {
      const key = `${settlementId}-${format}`
      setDownloading(key)
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
      } catch (error) {
        handleError(error, "Failed to download settlement report")
        toast.error("Error", { description: "Failed to download report." })
      } finally {
        setDownloading(null)
      }
    },
    [headers, handleError],
  )

  useEffect(() => {
    void fetchProjects()
    return () => {
      projectsAbortControllerRef.current?.abort()
      contractsAbortControllerRef.current?.abort()
      listAbortControllerRef.current?.abort()
    }
  }, [fetchProjects])

  useEffect(() => {
    if (selectedProjectId) {
      void fetchContracts(parseInt(selectedProjectId, 10))
      setSelectedContractId(null)
    } else {
      setContracts([])
      setSelectedContractId(null)
    }
  }, [selectedProjectId, fetchContracts])

  useEffect(() => {
    if (selectedContractId) {
      void fetchHistory(parseInt(selectedContractId, 10))
    } else {
      setRows([])
    }
  }, [selectedContractId, fetchHistory])

  return (
    <SidebarInset>
      <DocumentTitle title="Royalty Settlement History" />
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <PageBreadcrumb
            items={[
              DASHBOARD_CRUMB,
              { label: "Royalties", href: "/royalties" },
              { label: "Settlement History" },
            ]}
          />
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="min-h-[50vh] flex-1 rounded-xl bg-muted/50 p-6 md:min-h-min">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-2xl font-semibold">
                  <History className="h-6 w-6 text-muted-foreground" />
                  Settlement History
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select a project and a contract. Each settled record keeps a link back to its report.
                </p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Select Contract</CardTitle>
                <CardDescription>
                  Both a project and a contract are required before the history loads.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4 md:flex-row">
                  <div className="flex-1">
                    <label className="mb-2 block text-sm font-medium">Project</label>
                    <ProjectCombobox
                      projects={projects}
                      value={selectedProjectId}
                      onChange={setSelectedProjectId}
                      isLoading={isLoadingProjects}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-2 block text-sm font-medium">Contract</label>
                    <Select
                      value={selectedContractId ?? undefined}
                      onValueChange={(value) => setSelectedContractId(value || null)}
                      disabled={!selectedProjectId || isLoadingContracts}
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
                        {contracts.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            #{c.id}
                            {c.title ? ` — ${c.title}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contract timeline</CardTitle>
                <CardDescription>
                  {selectedContractId
                    ? isLoadingRows
                      ? "Loading..."
                      : `${rows.length} locked settlement${rows.length === 1 ? "" : "s"}`
                    : "Select a contract to see its settlement timeline."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedContractId ? (
                  <p className="text-sm text-muted-foreground">No contract selected.</p>
                ) : isLoadingRows ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading settlement history...
                  </div>
                ) : rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No locked settlements for this contract yet.
                  </p>
                ) : (
                  <ol className="relative ms-3 border-s border-border">
                    {rows.map((row, index) => {
                      const title =
                        row.product_title_en || row.product_title_ar || `Product #${row.product_id}`
                      return (
                        <li key={row.id} className="mb-8 ms-6 last:mb-0">
                          <span className="absolute -start-3 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-xs font-semibold">
                            {rows.length - index}
                          </span>
                          <div className="rounded-lg border bg-background p-4 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-semibold">Settlement #{row.id}</p>
                              <Badge variant={statusBadgeVariant(row.status)}>Locked</Badge>
                            </div>
                            <p className="mt-2 text-base font-medium">{title}</p>
                            {row.product_title_ar && row.product_title_en ? (
                              <p className="text-sm text-muted-foreground" dir="rtl">
                                {row.product_title_ar}
                              </p>
                            ) : null}
                            <p className="mt-3 text-lg font-semibold">
                              ${Number(row.amount_due ?? 0).toFixed(2)}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void downloadReport(row.id, "pdf")}
                                disabled={downloading !== null}
                              >
                                {downloading === `${row.id}-pdf` ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <FileDown className="mr-2 h-4 w-4" />
                                )}
                                PDF
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void downloadReport(row.id, "xlsx")}
                                disabled={downloading !== null}
                              >
                                {downloading === `${row.id}-xlsx` ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <FileDown className="mr-2 h-4 w-4" />
                                )}
                                Excel
                              </Button>
                            </div>
                            <dl className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                              <div>
                                <dt className="text-xs uppercase tracking-wide">Period</dt>
                                <dd>
                                  {formatDateTime(row.period_start)} → {formatDateTime(row.period_end)}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-xs uppercase tracking-wide">Settled</dt>
                                <dd>
                                  {formatDateTime(row.settled_at)}
                                  {row.settled_by_name ? ` · ${row.settled_by_name}` : ""}
                                </dd>
                              </div>
                            </dl>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SidebarInset>
  )
}
