"use client"

import { Button } from "@/components/ui/button"
import { Plus, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { format } from "date-fns"
import {
  formatInvoiceUsdAmount,
  formatLineUsdAmount,
} from "@/lib/muscatCurrency"

import type { AllocationDialogType, Invoice, InvoiceItem, Warehouse } from "./types"

type PaymentAllocationDialogsProps = {
  activeDialog: AllocationDialogType
  onActiveDialogChange: (dialog: AllocationDialogType) => void
  selectedInvoice: Invoice | null
  selectedItems: InvoiceItem[]
  warehouses: Warehouse[]
  showOnlyUnpaid: boolean
  onToggleShowOnlyUnpaid: () => void
  isLoadingItems: boolean
  isCreatingBill: boolean
  onSelectAllItems: (checked: boolean) => void
  onItemSelect: (itemIndex: number) => void
  onGenerateNewBill: () => void
  onConfirmGenerateBill: () => void
  onCreateNewBill: () => void
}

export function PaymentAllocationDialogs({
  activeDialog,
  onActiveDialogChange,
  selectedInvoice,
  selectedItems,
  warehouses,
  showOnlyUnpaid,
  onToggleShowOnlyUnpaid,
  isLoadingItems,
  isCreatingBill,
  onSelectAllItems,
  onItemSelect,
  onGenerateNewBill,
  onConfirmGenerateBill,
  onCreateNewBill,
}: PaymentAllocationDialogsProps) {
  return (
    <>
      <Dialog
        open={activeDialog === "view"}
        onOpenChange={(open) => onActiveDialogChange(open ? "view" : null)}
      >
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Outstanding Invoice Details</DialogTitle>
            <DialogDescription>
              Invoice #{selectedInvoice?.composite_id || selectedInvoice?.id} -{" "}
              {selectedInvoice?.customer_name || "No Customer"}
              {selectedInvoice?.composite_id?.includes("_") && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Child Invoice
                </span>
              )}
              {showOnlyUnpaid && (
                <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                  Showing Unpaid Items Only
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-2">Customer Information</h3>
                  <p>{selectedInvoice.customer_name || "No Customer"}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedInvoice.customer_contact || "No Contact Person"}
                  </p>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Invoice Information</h3>
                  <p>
                    Date:{" "}
                    {selectedInvoice.created_at
                      ? format(new Date(selectedInvoice.created_at), "PPP")
                      : "No Date"}
                  </p>
                  <p>Warehouse: {selectedInvoice.warehouse_name || "No Warehouse"}</p>
                  <p>Type: {selectedInvoice.invoice_type_name || "No Type"}</p>
                  <p>Payment Method: {selectedInvoice.payment_method_name || "No Payment Method"}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-md">
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-lg font-semibold">
                    {formatInvoiceUsdAmount(
                      selectedInvoice.total_amount || 0,
                      selectedInvoice,
                      warehouses,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Paid Amount</p>
                  <p className="text-lg font-semibold text-green-600">
                    {formatInvoiceUsdAmount(
                      selectedInvoice.total_paid || 0,
                      selectedInvoice,
                      warehouses,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Outstanding</p>
                  <p className="text-lg font-semibold text-red-600">
                    {formatInvoiceUsdAmount(
                      selectedInvoice.remaining_amount || 0,
                      selectedInvoice,
                      warehouses,
                    )}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-medium">Items</h3>
                    {selectedInvoice.items && selectedInvoice.items.length > 0 && (
                      <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                        <span>Total: {selectedInvoice.items.length}</span>
                        <span className="text-green-600">
                          Paid:{" "}
                          {
                            selectedInvoice.items.filter(
                              (item) =>
                                item.is_paid || Number(item.paid_amount) >= Number(item.total_price),
                            ).length
                          }
                        </span>
                        <span className="text-orange-600">
                          Unpaid:{" "}
                          {
                            selectedInvoice.items.filter(
                              (item) =>
                                !item.is_paid && Number(item.paid_amount) < Number(item.total_price),
                            ).length
                          }
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={onToggleShowOnlyUnpaid}>
                      {showOnlyUnpaid ? "Show All" : "Show Unpaid Only"}
                    </Button>
                    <Button
                      onClick={onGenerateNewBill}
                      disabled={
                        !selectedInvoice.items?.some((item) => item.selected && !item.is_paid) ||
                        isCreatingBill
                      }
                    >
                      {isCreatingBill ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Generate Child Bill
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Checkbox
                            checked={
                              selectedInvoice.items &&
                              selectedInvoice.items.length > 0 &&
                              selectedInvoice.items
                                .filter((item) => !item.is_paid)
                                .filter(
                                  (item) =>
                                    !showOnlyUnpaid ||
                                    !(item.is_paid || Number(item.paid_amount) >= Number(item.total_price)),
                                )
                                .every((item) => item.selected)
                            }
                            onChange={(e) => onSelectAllItems(e.target.checked)}
                          />
                        </TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Discount</TableHead>
                        <TableHead className="text-right">Tax</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingItems ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                            <div className="py-4">
                              <p className="text-sm">Loading invoice items...</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : selectedInvoice.items && selectedInvoice.items.length > 0 ? (
                        selectedInvoice.items
                          .filter(
                            (item) =>
                              !showOnlyUnpaid ||
                              !(item.is_paid || Number(item.paid_amount) >= Number(item.total_price)),
                          )
                          .map((item, index) => {
                            const isPaid =
                              item.is_paid || Number(item.paid_amount) >= Number(item.total_price)
                            return (
                              <TableRow
                                key={index}
                                className={isPaid ? "bg-green-50" : undefined}
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={item.selected || false}
                                    onChange={() =>
                                      onItemSelect(selectedInvoice.items.indexOf(item))
                                    }
                                    disabled={isPaid}
                                  />
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <p className={`font-medium ${isPaid ? "text-green-700" : ""}`}>
                                      {item.product_name || "No Title"}
                                      {isPaid && (
                                        <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                          PAID
                                        </span>
                                      )}
                                    </p>
                                    <p
                                      className={`text-sm ${isPaid ? "text-green-600" : "text-muted-foreground"}`}
                                    >
                                      {(typeof item.product === "object" && item.product !== null
                                        ? item.product.name_ar || item.product.title_ar
                                        : null) || "No Arabic Title"}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell className={`text-right ${isPaid ? "text-green-700" : ""}`}>
                                  {Number(item.quantity) || 0}
                                </TableCell>
                                <TableCell className={`text-right ${isPaid ? "text-green-700" : ""}`}>
                                  {formatLineUsdAmount(
                                    Number(item.unit_price) || 0,
                                    item,
                                    selectedInvoice,
                                    warehouses,
                                  )}
                                </TableCell>
                                <TableCell className={`text-right ${isPaid ? "text-green-700" : ""}`}>
                                  {Number(item.discount_percent) || 0}%
                                </TableCell>
                                <TableCell className={`text-right ${isPaid ? "text-green-700" : ""}`}>
                                  {Number(item.tax_percent) || 0}%
                                </TableCell>
                                <TableCell
                                  className={`text-right ${isPaid ? "text-green-700 font-semibold" : ""}`}
                                >
                                  {formatLineUsdAmount(
                                    Number(item.total_price) || 0,
                                    item,
                                    selectedInvoice,
                                    warehouses,
                                  )}
                                  {isPaid && <span className="ml-1 text-xs text-green-600">✓</span>}
                                </TableCell>
                              </TableRow>
                            )
                          })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                            <div className="py-4">
                              <p className="text-sm">No items found for this invoice</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                This invoice might not have any line items
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeDialog === "generate"}
        onOpenChange={(open) => onActiveDialogChange(open ? "generate" : null)}
      >
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Child Bill</DialogTitle>
            <DialogDescription>
              Review selected items and generate a child bill from Main Invoice #
              {selectedInvoice?.composite_id || selectedInvoice?.id}
              {selectedInvoice?.composite_id?.includes("_") && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Child Invoice
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedItems.length > 0 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-2">Main Invoice</h3>
                  <p className="text-sm text-muted-foreground">
                    #{selectedInvoice?.composite_id || selectedInvoice?.id}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedInvoice?.customer_name}</p>
                  <p className="text-sm text-muted-foreground">
                    Type: {selectedInvoice?.invoice_type_name || "Unknown"}
                  </p>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Child Bill</h3>
                  <p className="text-sm text-muted-foreground">
                    Composite ID: Will be generated after bill creation
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedInvoice?.customer_name}</p>
                  <p className="text-sm text-muted-foreground">
                    Type: <span className="text-green-600 font-medium">paid</span>
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-md">
                <div>
                  <p className="text-sm text-muted-foreground">Child Bill ID</p>
                  <p className="text-lg font-semibold">Will be assigned</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Main Invoice</p>
                  <p className="text-lg font-semibold">
                    #{selectedInvoice?.composite_id || selectedInvoice?.id}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-lg font-semibold text-green-600">
                    {selectedInvoice
                      ? formatInvoiceUsdAmount(
                          selectedItems.reduce(
                            (sum, item) => sum + (Number(item.total_price) || 0),
                            0,
                          ),
                          selectedInvoice,
                          warehouses,
                        )
                      : "0.000 $"}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-4">Selected Items ({selectedItems.length})</h3>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Discount</TableHead>
                        <TableHead className="text-right">Tax</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.product_name || "No Title"}</p>
                              <p className="text-sm text-muted-foreground">
                                {(typeof item.product === "object" && item.product !== null
                                  ? item.product.name_ar || item.product.title_ar
                                  : null) || "No Arabic Title"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{Number(item.quantity) || 0}</TableCell>
                          <TableCell className="text-right">
                            {selectedInvoice
                              ? formatLineUsdAmount(
                                  Number(item.unit_price) || 0,
                                  item,
                                  selectedInvoice,
                                  warehouses,
                                )
                              : `${(Number(item.unit_price) || 0).toFixed(3)} $`}
                          </TableCell>
                          <TableCell className="text-right">{Number(item.discount_percent) || 0}%</TableCell>
                          <TableCell className="text-right">{Number(item.tax_percent) || 0}%</TableCell>
                          <TableCell className="text-right">
                            {selectedInvoice
                              ? formatLineUsdAmount(
                                  Number(item.total_price) || 0,
                                  item,
                                  selectedInvoice,
                                  warehouses,
                                )
                              : `${(Number(item.total_price) || 0).toFixed(3)} $`}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={4} className="text-right font-medium">
                          Total Amount:
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {selectedInvoice
                            ? formatInvoiceUsdAmount(
                                selectedItems.reduce(
                                  (sum, item) => sum + (Number(item.total_price) || 0),
                                  0,
                                ),
                                selectedInvoice,
                                warehouses,
                              )
                            : "0.000 $"}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => onActiveDialogChange(null)}
                  disabled={isCreatingBill}
                >
                  Cancel
                </Button>
                <Button onClick={onConfirmGenerateBill} disabled={isCreatingBill}>
                  <Plus className="h-4 w-4 mr-2" />
                  Review & Create Child Bill
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeDialog === "confirm"}
        onOpenChange={(open) => onActiveDialogChange(open ? "confirm" : null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Child Bill Creation</DialogTitle>
            <DialogDescription>
              Are you sure you want to create a child bill with {selectedItems.length} selected items?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-md">
              <p className="text-sm font-medium">Summary:</p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• Child bill will be created with &quot;postpaid&quot; payment method</li>
                <li>• Child bill ID will be assigned automatically by the system</li>
                <li>• Composite ID will be: main_invoice_id_child_bill_id</li>
                <li>• Main invoice ID will be set to the original invoice ID</li>
                <li>• Selected items will be marked as paid in the main invoice</li>
                <li>• Main invoice amounts will be recalculated</li>
                <li>• If all items are selected, main invoice will be marked as fully paid</li>
              </ul>
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => onActiveDialogChange(null)}
                disabled={isCreatingBill}
              >
                Cancel
              </Button>
              <Button onClick={onCreateNewBill} disabled={isCreatingBill}>
                {isCreatingBill ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Child Bill
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
