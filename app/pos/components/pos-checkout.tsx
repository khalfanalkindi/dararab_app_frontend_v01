"use client"

import { CheckCircle2, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ReceiptContent, type ReceiptItem } from "@/components/receipt/ReceiptContent"
import { useLanguage } from "@/components/language-context"
import type {
  CartItem,
  Customer,
  DialogType,
  InvoiceType,
  PaymentMethod,
  Warehouse,
} from "./types"

type PosCheckoutProps = {
  cartLength: number
  confirmSaleOpen: boolean
  onConfirmSaleOpenChange: (open: boolean) => void
  selectedCustomer: Customer | null
  discountPercentage: number
  totalPaidAmount: number
  hasPartialPayment: boolean
  formatMoney: (amount: number) => string
  getCurrencyLabel: () => string
  uiSubtotal: number
  uiGlobalDiscountAmount: number
  uiTax: number
  uiTotal: number
  uiTotalPaidAmount: number
  uiTotalUnpaidAmount: number
  totalUnpaidAmount: number
  isSubmitting: boolean
  selectedWarehouse: number | null
  onCompleteSale: () => void
  activeDialog: DialogType
  onActiveDialogChange: (dialog: DialogType) => void
  onNewSale: () => void
  onResetPaymentDefaults: () => void
  receiptData: Record<string, unknown> | null
  cart: CartItem[]
  warehouses: Warehouse[]
  invoiceTypes: InvoiceType[]
  selectedInvoiceType: number | null
  paymentMethods: PaymentMethod[]
  selectedPaymentMethod: number | null
  invoiceNotes: string
  isMuscatWarehouse: boolean
  getDisplayPrice: (product: CartItem["product"]) => string | null
  getEffectiveLineDiscountPercent: (item: CartItem) => number
  calculateItemDisplayTotal: (item: CartItem) => number
  calculateItemTotal: (item: CartItem) => number
  usdToDisplayForLine: (usdAmount: number, item: CartItem) => number
  appliesGlobalDiscountPerLine: boolean
  taxPercentage: number
}

export function PosCheckout({
  cartLength,
  confirmSaleOpen,
  onConfirmSaleOpenChange,
  selectedCustomer,
  discountPercentage,
  totalPaidAmount,
  hasPartialPayment,
  formatMoney,
  getCurrencyLabel,
  uiSubtotal,
  uiGlobalDiscountAmount,
  uiTax,
  uiTotal,
  uiTotalPaidAmount,
  uiTotalUnpaidAmount,
  totalUnpaidAmount,
  isSubmitting,
  selectedWarehouse,
  onCompleteSale,
  activeDialog,
  onActiveDialogChange,
  onNewSale,
  onResetPaymentDefaults,
  receiptData,
  cart,
  warehouses,
  invoiceTypes,
  selectedInvoiceType,
  paymentMethods,
  selectedPaymentMethod,
  invoiceNotes,
  isMuscatWarehouse,
  getDisplayPrice,
  getEffectiveLineDiscountPercent,
  calculateItemDisplayTotal,
  calculateItemTotal,
  usdToDisplayForLine,
  appliesGlobalDiscountPerLine,
  taxPercentage,
}: PosCheckoutProps) {
  const { t } = useLanguage()

  return (
    <>
      {cartLength > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            size="lg"
            className="rounded-full h-14 w-14 shadow-lg"
            onClick={() => onConfirmSaleOpenChange(true)}
          >
            <CheckCircle2 className="h-6 w-6" />
          </Button>
        </div>
      )}

      <Dialog open={confirmSaleOpen} onOpenChange={onConfirmSaleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("pos.checkout.confirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("pos.checkout.confirmDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t("pos.cart.customer")}</span>
                <span className="font-medium">
                  {selectedCustomer?.institution_name || t("pos.cart.walkIn")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t("pos.cart.items")}</span>
                <span className="font-medium">{cartLength}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t("pos.payments.subtotal")}</span>
                <span className="font-medium">{formatMoney(uiSubtotal)}</span>
              </div>
              {discountPercentage > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t("pos.payments.discount")}</span>
                  <span className="font-medium text-green-600">
                    -{uiGlobalDiscountAmount.toFixed(3)} {getCurrencyLabel()}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t("pos.payments.tax")}</span>
                <span className="font-medium">{formatMoney(uiTax)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="font-semibold">{t("pos.payments.total")}</span>
                <span className="font-bold text-lg">{formatMoney(uiTotal)}</span>
              </div>

              {(totalPaidAmount > 0 || hasPartialPayment) && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t("pos.checkout.amountPaid")}</span>
                      <span className="font-medium text-green-600">{formatMoney(uiTotalPaidAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t("pos.checkout.amountDue")}</span>
                      <span className="font-medium text-red-600">{formatMoney(uiTotalUnpaidAmount)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onConfirmSaleOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              onPointerDown={(e) => {
                if (e.pointerType === "mouse" && e.button !== 0) return
                e.preventDefault()
              }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void onCompleteSale()}
              disabled={
                isSubmitting ||
                !selectedCustomer ||
                !selectedWarehouse ||
                isNaN(totalUnpaidAmount) ||
                totalUnpaidAmount < 0
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("pos.payments.processing")}
                </>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <span>{t("pos.checkout.confirmTitle")}</span>
                  <span className="text-sm">
                    {uiTotalUnpaidAmount > 0
                      ? t("pos.payments.payAmount", { amount: formatMoney(uiTotalUnpaidAmount) })
                      : t("pos.payments.fullyPaid")}
                  </span>
                </div>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeDialog === "print"}
        onOpenChange={(open) => {
          onActiveDialogChange(open ? "print" : null)
          if (!open) {
            onNewSale()
            onResetPaymentDefaults()
          }
        }}
      >
        <DialogContent className="w-full max-w-md h-[90vh] flex flex-col">
          <div className="shrink-0">
            <DialogHeader>
              <DialogTitle>{t("pos.checkout.receiptTitle")}</DialogTitle>
              <DialogDescription>{t("pos.checkout.receiptDescription")}</DialogDescription>
            </DialogHeader>
          </div>
          {receiptData && (
            <ReceiptContent
              receiptData={{
                id: receiptData.id as number,
                composite_id: receiptData.composite_id as string | undefined,
                customer_name:
                  (receiptData.customer_name as string) ||
                  selectedCustomer?.institution_name ||
                  t("pos.cart.walkIn"),
                customer_contact:
                  (receiptData.customer_contact as string) || selectedCustomer?.contact_person || "",
                warehouse_name:
                  (receiptData.warehouse_name as string) ||
                  warehouses.find((w) => w.id === selectedWarehouse)?.name_en ||
                  t("common.na"),
                warehouse_location: warehouses.find((w) => w.id === selectedWarehouse)?.location || "",
                invoice_type_name:
                  (receiptData.invoice_type_name as string) ||
                  invoiceTypes.find((type) => type.id === selectedInvoiceType)?.display_name_en ||
                  t("common.na"),
                payment_method_name:
                  (receiptData.payment_method_name as string) ||
                  paymentMethods.find((m) => m.id === selectedPaymentMethod)?.display_name_en ||
                  t("common.na"),
                items: cart.map((item, idx) => ({
                  id: idx,
                  product_name: item.product.title_en,
                  product: {
                    id: item.product.id,
                    title_en: item.product.title_en,
                    price: item.product.price,
                    price_omr: item.product.price_omr,
                    latest_price: item.product.latest_price,
                    latest_price_omr: item.product.latest_price_omr,
                  },
                  quantity: item.quantity,
                  unit_price: (() => {
                    if (isMuscatWarehouse) {
                      const displayPrice = getDisplayPrice(item.product)
                      return displayPrice ? parseFloat(displayPrice) : 0
                    }
                    const price = item.product.price || item.product.latest_price
                    return price ? parseFloat(price) : 0
                  })(),
                  discount_percent: getEffectiveLineDiscountPercent(item),
                  total_price: isMuscatWarehouse
                    ? calculateItemDisplayTotal(item)
                    : calculateItemTotal(item),
                  paid_amount: isMuscatWarehouse
                    ? usdToDisplayForLine(item.paid_amount, item)
                    : item.paid_amount,
                  is_paid: item.is_paid,
                })),
                total_amount: uiTotal,
                total_paid: uiTotalPaidAmount,
                remaining_amount: uiTotalUnpaidAmount,
                notes: (receiptData.notes as string) || invoiceNotes,
                created_at_formatted:
                  (receiptData.created_at_formatted as string) || format(new Date(), "PPP"),
                global_discount_percent: appliesGlobalDiscountPerLine ? 0 : discountPercentage,
                tax_percent: taxPercentage,
                subtotal: uiSubtotal,
                globalDiscountAmount: uiGlobalDiscountAmount,
                tax: uiTax,
                total: uiTotal,
                totalUnpaidAmount: uiTotalUnpaidAmount,
                hasPartialPayment,
              }}
              currencyLabel={getCurrencyLabel()}
              getDisplayPrice={(item: ReceiptItem) => {
                if (item.product) {
                  return getDisplayPrice(
                    item.product as Parameters<typeof getDisplayPrice>[0],
                  )
                }
                return item.unit_price ? item.unit_price.toString() : null
              }}
              onClose={() => {
                onNewSale()
                onResetPaymentDefaults()
                onActiveDialogChange(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
