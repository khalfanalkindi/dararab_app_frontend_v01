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
import { useLanguage } from "@/components/language-context"

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
  const { t } = useLanguage()

  return (
    <>
      <Dialog
        open={activeDialog === "view"}
        onOpenChange={(open) => onActiveDialogChange(open ? "view" : null)}
      >
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("outstanding.dialog.details")}</DialogTitle>
            <DialogDescription>
              Invoice #{selectedInvoice?.composite_id || selectedInvoice?.id} -{" "}
              {selectedInvoice?.customer_name || t("outstanding.table.noCustomer")}
              {selectedInvoice?.composite_id?.includes("_") && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {t("outstanding.dialog.childBill")}
                </span>
              )}
              {showOnlyUnpaid && (
                <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                  {t("outstanding.dialog.unpaidOnly")}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-2">{t("outstanding.dialog.customerInfo")}</h3>
                  <p>{selectedInvoice.customer_name || t("outstanding.table.noCustomer")}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedInvoice.customer_contact || t("common.na")}
                  </p>
                </div>
                <div>
                  <h3 className="font-medium mb-2">{t("outstanding.dialog.invoiceInfo")}</h3>
                  <p>
                    {t("common.date")}:{" "}
                    {selectedInvoice.created_at
                      ? format(new Date(selectedInvoice.created_at), "PPP")
                      : t("outstanding.table.noDate")}
                  </p>
                  <p>{t("common.warehouse")}: {selectedInvoice.warehouse_name || t("outstanding.table.noWarehouse")}</p>
                  <p>{t("common.type")}: {selectedInvoice.invoice_type_name || t("common.na")}</p>
                  <p>{selectedInvoice.payment_method_name || t("common.na")}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-md">
                <div>
                  <p className="text-sm text-muted-foreground">{t("outstanding.dialog.total")}</p>
                  <p className="text-lg font-semibold">
                    {formatInvoiceUsdAmount(
                      selectedInvoice.total_amount || 0,
                      selectedInvoice,
                      warehouses,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("outstanding.dialog.paid")}</p>
                  <p className="text-lg font-semibold text-green-600">
                    {formatInvoiceUsdAmount(
                      selectedInvoice.total_paid || 0,
                      selectedInvoice,
                      warehouses,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("outstanding.dialog.outstanding")}</p>
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
                    <h3 className="font-medium">{t("outstanding.dialog.items")}</h3>
                    {selectedInvoice.items && selectedInvoice.items.length > 0 && (
                      <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                        <span>{t("outstanding.dialog.total")}: {selectedInvoice.items.length}</span>
                        <span className="text-green-600">
                          {t("outstanding.dialog.paid")}:{" "}
                          {
                            selectedInvoice.items.filter(
                              (item) =>
                                item.is_paid || Number(item.paid_amount) >= Number(item.total_price),
                            ).length
                          }
                        </span>
                        <span className="text-orange-600">
                          {t("pos.status.unpaid")}:{" "}
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
                      {showOnlyUnpaid ? t("outstanding.dialog.showAll") : t("outstanding.dialog.showUnpaidOnly")}
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
                          {t("common.processing")}
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          {t("outstanding.dialog.generateChild")}
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
                        <TableHead>{t("common.product")}</TableHead>
                        <TableHead className="text-right">{t("common.quantity")}</TableHead>
                        <TableHead className="text-right">{t("invoices.view.unitPrice")}</TableHead>
                        <TableHead className="text-right">{t("invoices.view.discount")}</TableHead>
                        <TableHead className="text-right">{t("pos.payments.tax")}</TableHead>
                        <TableHead className="text-right">{t("common.total")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingItems ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                            <div className="py-4">
                              <p className="text-sm">{t("outstanding.dialog.loadingItems")}</p>
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
                                      {item.product_name || t("common.na")}
                                      {isPaid && (
                                        <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                          {t("outstanding.dialog.paid")}
                                        </span>
                                      )}
                                    </p>
                                    <p
                                      className={`text-sm ${isPaid ? "text-green-600" : "text-muted-foreground"}`}
                                    >
                                      {(typeof item.product === "object" && item.product !== null
                                        ? item.product.name_ar || item.product.title_ar
                                        : null) || t("common.na")}
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
                              <p className="text-sm">{t("outstanding.dialog.noItems")}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {t("outstanding.dialog.noItemsHint")}
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
            <DialogTitle>{t("outstanding.dialog.generateChild")}</DialogTitle>
            <DialogDescription>
              {t("outstanding.dialog.generateDesc")} #
              {selectedInvoice?.composite_id || selectedInvoice?.id}
              {selectedInvoice?.composite_id?.includes("_") && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {t("outstanding.dialog.childBill")}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedItems.length > 0 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-2">{t("outstanding.dialog.mainInvoice")}</h3>
                  <p className="text-sm text-muted-foreground">
                    #{selectedInvoice?.composite_id || selectedInvoice?.id}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedInvoice?.customer_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("common.type")}: {selectedInvoice?.invoice_type_name || t("common.na")}
                  </p>
                </div>
                <div>
                  <h3 className="font-medium mb-2">{t("outstanding.dialog.childBill")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("outstanding.dialog.childBillId")}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedInvoice?.customer_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("common.type")}: <span className="text-green-600 font-medium">{t("pos.status.paid")}</span>
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-md">
                <div>
                  <p className="text-sm text-muted-foreground">{t("outstanding.dialog.childBillId")}</p>
                  <p className="text-lg font-semibold">{t("common.na")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("outstanding.dialog.mainInvoice")}</p>
                  <p className="text-lg font-semibold">
                    #{selectedInvoice?.composite_id || selectedInvoice?.id}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("outstanding.dialog.total")}</p>
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
                <h3 className="font-medium mb-4">
                  {t("outstanding.dialog.selectedItems")} ({selectedItems.length})
                </h3>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("common.product")}</TableHead>
                        <TableHead className="text-right">{t("common.quantity")}</TableHead>
                        <TableHead className="text-right">{t("invoices.view.unitPrice")}</TableHead>
                        <TableHead className="text-right">{t("invoices.view.discount")}</TableHead>
                        <TableHead className="text-right">{t("pos.payments.tax")}</TableHead>
                        <TableHead className="text-right">{t("common.total")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.product_name || t("common.na")}</p>
                              <p className="text-sm text-muted-foreground">
                                {(typeof item.product === "object" && item.product !== null
                                  ? item.product.name_ar || item.product.title_ar
                                  : null) || t("common.na")}
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
                          {t("outstanding.dialog.totalAmount")}:
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
                  {t("common.cancel")}
                </Button>
                <Button onClick={onConfirmGenerateBill} disabled={isCreatingBill}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("outstanding.dialog.reviewCreate")}
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
            <DialogTitle>{t("outstanding.dialog.confirmChild")}</DialogTitle>
            <DialogDescription>
              {t("outstanding.dialog.generateDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-md">
              <p className="text-sm font-medium">{t("outstanding.dialog.selectedItems")}:</p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• {t("outstanding.dialog.childBill")} ({selectedItems.length})</li>
                <li>• {t("outstanding.dialog.mainInvoice")}</li>
                <li>• {t("outstanding.dialog.childBillId")}</li>
              </ul>
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => onActiveDialogChange(null)}
                disabled={isCreatingBill}
              >
                {t("common.cancel")}
              </Button>
              <Button onClick={onCreateNewBill} disabled={isCreatingBill}>
                {isCreatingBill ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("common.creating")}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    {t("outstanding.dialog.confirmChild")}
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
