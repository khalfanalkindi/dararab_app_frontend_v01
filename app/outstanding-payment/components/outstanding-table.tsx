"use client"

import { Button } from "@/components/ui/button"
import { FileText, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { ListPagination } from "@/components/list-pagination"
import { TableSkeleton } from "@/components/table-skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatInvoiceUsdAmount } from "@/lib/muscatCurrency"

import type { Invoice, Warehouse } from "./types"

type OutstandingTableProps = {
  hasSearched: boolean
  isLoading: boolean
  invoices: Invoice[]
  warehouses: Warehouse[]
  selectedTotal: number
  selectedTotalDisplay: string
  currentPage: number
  pageSize: number
  totalCount: number
  isRowLoading: (id: number, action: "view") => boolean
  onSelectAllInvoices: (checked: boolean) => void
  onInvoiceSelect: (invoiceId: number) => void
  onViewInvoice: (invoice: Invoice) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

function formatInvoiceId(invoice: Invoice) {
  const displayId = invoice.composite_id || invoice.id.toString()
  const isChildInvoice = displayId.includes("_")

  return (
    <div className="flex items-center gap-2">
      <span className="font-medium">{displayId}</span>
      {isChildInvoice && (
        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Child</span>
      )}
    </div>
  )
}

export function OutstandingTable({
  hasSearched,
  isLoading,
  invoices,
  warehouses,
  selectedTotal,
  selectedTotalDisplay,
  currentPage,
  pageSize,
  totalCount,
  isRowLoading,
  onSelectAllInvoices,
  onInvoiceSelect,
  onViewInvoice,
  onPageChange,
  onPageSizeChange,
}: OutstandingTableProps) {
  return (
    <>
      {selectedTotal > 0 && (
        <div className="mb-4 p-4 bg-primary/10 rounded-md">
          <p className="text-lg font-semibold">Selected Outstanding Total: {selectedTotalDisplay}</p>
        </div>
      )}

      {!hasSearched ? (
        <div className="text-center text-muted-foreground py-12">
          <p>
            Click &quot;Search&quot; to view all outstanding invoices (unpaid and partially paid) or use filters to
            narrow down results.
          </p>
          <p className="text-sm mt-2">
            You can filter by invoice ID (e.g., &quot;121&quot; or &quot;121_223&quot;), select a customer from the
            list, or use date/warehouse filters.
          </p>
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <input
                    type="checkbox"
                    onChange={(e) => onSelectAllInvoices(e.target.checked)}
                    checked={invoices.length > 0 && invoices.every((invoice) => invoice.selected)}
                  />
                </TableHead>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead className="text-right">Paid Amount</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton columns={9} rows={5} hasActions />
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center">
                    <div className="text-muted-foreground">
                      <p>No outstanding invoices found</p>
                      <p className="text-sm mt-1">
                        All invoices are fully paid or no invoices match your search criteria
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={invoice.selected || false}
                        onChange={() => onInvoiceSelect(invoice.id)}
                      />
                    </TableCell>
                    <TableCell>{formatInvoiceId(invoice)}</TableCell>
                    <TableCell>{invoice.customer_name || "No Customer"}</TableCell>
                    <TableCell>{invoice.warehouse_name || "No Warehouse"}</TableCell>
                    <TableCell>
                      {invoice.created_at ? format(new Date(invoice.created_at), "PPP") : "No Date"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatInvoiceUsdAmount(invoice.total_amount || 0, invoice, warehouses)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatInvoiceUsdAmount(invoice.total_paid || 0, invoice, warehouses)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-red-600">
                      {formatInvoiceUsdAmount(invoice.remaining_amount || 0, invoice, warehouses)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewInvoice(invoice)}
                        disabled={isRowLoading(invoice.id, "view")}
                      >
                        {isRowLoading(invoice.id, "view") ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4 mr-2" />
                            View
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {!isLoading && totalCount > 0 && (
            <div className="px-2 pb-2">
              <ListPagination
                currentPage={currentPage}
                pageSize={pageSize}
                totalCount={totalCount}
                disabled={isLoading}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
              />
            </div>
          )}
        </div>
      )}
    </>
  )
}
