"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { FileText, Trash2, Receipt, Loader2, FileSpreadsheet, MoreHorizontal } from "lucide-react"
import { format } from "date-fns"

import type { Invoice, RowAction } from "./types"

type InvoiceTableProps = {
  invoices: Invoice[]
  isLoading: boolean
  hasSearched: boolean
  selectedTotal: number
  currentPage: number
  pageSize: number
  totalCount: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onSelectAll: (selected: boolean) => void
  onInvoiceSelect: (invoiceId: number) => void
  isRowLoading: (id: number, action: RowAction) => boolean
  onViewInvoice: (invoice: Invoice) => void
  onViewReceipt: (invoice: Invoice) => void
  onExportExcel: (invoice: Invoice) => void
  onDeleteClick: (invoice: Invoice) => void
}

export function InvoiceTable({
  invoices,
  isLoading,
  hasSearched,
  selectedTotal,
  currentPage,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  onSelectAll,
  onInvoiceSelect,
  isRowLoading,
  onViewInvoice,
  onViewReceipt,
  onExportExcel,
  onDeleteClick,
}: InvoiceTableProps) {
  return (
    <>
      {selectedTotal > 0 && (
        <div className="mb-4 p-4 bg-primary/10 rounded-md">
          <p className="text-lg font-semibold">
            Selected Total: {selectedTotal.toFixed(3)} $
          </p>
        </div>
      )}

      {!hasSearched ? (
        <div className="text-center text-muted-foreground py-12">
          Please select at least one filter (Warehouse, Date Range, Invoice/Composite ID, or Customer) to view invoices.
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <input
                    type="checkbox"
                    onChange={(e) => onSelectAll(e.target.checked)}
                    checked={invoices.length > 0 && invoices.every((invoice) => invoice.selected)}
                  />
                </TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Composite ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right w-[1%] whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton columns={9} rows={5} hasActions />
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center">
                    No invoices found
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((invoice) => {
                  const viewLoading = isRowLoading(invoice.id, "view")
                  const receiptLoading = isRowLoading(invoice.id, "receipt")
                  const exportLoading = isRowLoading(invoice.id, "export")
                  const deleteLoading = isRowLoading(invoice.id, "delete")
                  const anyLoading = viewLoading || receiptLoading || exportLoading || deleteLoading

                  return (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={invoice.selected || false}
                        onChange={() => onInvoiceSelect(invoice.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell className="font-mono text-sm">{invoice.composite_id || "N/A"}</TableCell>
                    <TableCell>{invoice.customer?.institution_name || "No Customer"}</TableCell>
                    <TableCell>{invoice.warehouse?.name_en || "No Warehouse"}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                        {invoice.invoice_type?.display_name_en || "No Type"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {invoice.created_at ? format(new Date(invoice.created_at), "PPP") : "No Date"}
                    </TableCell>
                    <TableCell className="text-right">{(invoice.total_amount || 0).toFixed(3)} $</TableCell>
                    <TableCell className="text-right">
                      {/* Mobile / tablet: single Actions menu */}
                      <div className="lg:hidden inline-flex justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2"
                              disabled={anyLoading}
                            >
                              {anyLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <MoreHorizontal className="h-4 w-4 mr-1" />
                                  Actions
                                </>
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              disabled={viewLoading}
                              onClick={() => onViewInvoice(invoice)}
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={receiptLoading}
                              onClick={() => onViewReceipt(invoice)}
                            >
                              <Receipt className="h-4 w-4 mr-2" />
                              Receipt
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={exportLoading}
                              onClick={() => void onExportExcel(invoice)}
                            >
                              <FileSpreadsheet className="h-4 w-4 mr-2" />
                              Export Excel
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              disabled={deleteLoading}
                              onClick={() => onDeleteClick(invoice)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Desktop: full action buttons */}
                      <div className="hidden lg:inline-flex flex-nowrap items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => onViewInvoice(invoice)}
                          disabled={viewLoading}
                        >
                          {viewLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <FileText className="h-4 w-4 mr-1" />
                              View
                            </>
                          )}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => onViewReceipt(invoice)}
                          disabled={receiptLoading}
                        >
                          {receiptLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Receipt className="h-4 w-4 mr-1" />
                              Receipt
                            </>
                          )}
                        </Button>

                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          title="Export Excel"
                          aria-label="Export Excel"
                          onClick={() => void onExportExcel(invoice)}
                          disabled={exportLoading}
                        >
                          {exportLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileSpreadsheet className="h-4 w-4" />
                          )}
                        </Button>

                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          title="Delete invoice"
                          aria-label="Delete invoice"
                          disabled={deleteLoading}
                          onClick={() => onDeleteClick(invoice)}
                        >
                          {deleteLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  )
                })
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
