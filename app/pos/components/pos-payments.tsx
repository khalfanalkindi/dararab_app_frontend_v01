"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLanguage } from "@/components/language-context"
import { cn } from "@/lib/utils"
import type { CartItem, Customer, InvoiceType, PaymentMethod, Warehouse } from "./types"

type PosPaymentsProps = {
  selectedWarehouse: number | null
  warehouses: Warehouse[]
  selectedInvoiceType: number | null
  invoiceTypes: InvoiceType[]
  selectedPaymentMethod: number | null
  paymentMethods: PaymentMethod[]
  isIndividualCustomer: boolean
  onPaymentMethodChange: (methodId: number) => void
  invoiceNotes: string
  onInvoiceNotesChange: (notes: string) => void
  discountPercentage: number
  onDiscountPercentageChange: (percentage: number) => void
  cartHasStoreItemDiscount: boolean
  isStoreCustomer: boolean
  onClearStoreItemDiscounts: () => void
  onReallocatePayments: () => void
  taxPercentage: number
  onTaxPercentageChange: (percentage: number) => void
  formatMoney: (amount: number) => string
  getCurrencyLabel: () => string
  uiSubtotal: number
  uiGlobalDiscountAmount: number
  uiTax: number
  uiTotal: number
  uiTotalPaidAmount: number
  uiTotalUnpaidAmount: number
  totalPaidAmount: number
  hasPartialPayment: boolean
  paidItems: CartItem[]
  unpaidItems: CartItem[]
  cart: CartItem[]
  calculateItemTotal: (item: CartItem) => number
  cartLength: number
  isSubmitting: boolean
  selectedCustomer: Customer | null
  totalUnpaidAmount: number
  onCompleteSale: () => void
}

export function PosPayments({
  selectedWarehouse,
  warehouses,
  selectedInvoiceType,
  invoiceTypes,
  selectedPaymentMethod,
  paymentMethods,
  isIndividualCustomer,
  onPaymentMethodChange,
  invoiceNotes,
  onInvoiceNotesChange,
  discountPercentage,
  onDiscountPercentageChange,
  cartHasStoreItemDiscount,
  isStoreCustomer,
  onClearStoreItemDiscounts,
  onReallocatePayments,
  taxPercentage,
  onTaxPercentageChange,
  formatMoney,
  getCurrencyLabel,
  uiSubtotal,
  uiGlobalDiscountAmount,
  uiTax,
  uiTotal,
  uiTotalPaidAmount,
  uiTotalUnpaidAmount,
  totalPaidAmount,
  hasPartialPayment,
  paidItems,
  unpaidItems,
  cart,
  calculateItemTotal,
  cartLength,
  isSubmitting,
  selectedCustomer,
  totalUnpaidAmount,
  onCompleteSale,
}: PosPaymentsProps) {
  const { t } = useLanguage()

  return (
    <>
      <div className="space-y-2">
        <Label>{t("pos.payments.invoiceSettings")}</Label>
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                <span className="text-sm">
                  {selectedWarehouse
                    ? warehouses.find((w) => w.id === selectedWarehouse)?.name_en
                    : t("pos.payments.noWarehouse")}
                </span>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                <span className="text-sm">
                  {selectedInvoiceType
                    ? invoiceTypes.find((type) => type.id === selectedInvoiceType)?.display_name_en
                    : t("pos.payments.noInvoiceType")}
                </span>
              </div>
            </div>
          </div>
          <Select
            value={selectedPaymentMethod?.toString() || ""}
            onValueChange={(value) => onPaymentMethodChange(Number(value))}
            disabled={isIndividualCustomer}
          >
            <SelectTrigger className={isIndividualCustomer ? "bg-muted cursor-not-allowed" : ""}>
              <SelectValue placeholder={t("pos.payments.selectMethod")} />
            </SelectTrigger>
            <SelectContent>
              {paymentMethods
                .filter((method) => method.value.toLowerCase() !== "postpaid")
                .map((method) => (
                  <SelectItem key={method.id} value={method.id.toString()}>
                    {method.display_name_en}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("pos.payments.notes")}</Label>
        <Input
          placeholder={t("pos.payments.notesPlaceholder")}
          value={invoiceNotes}
          onChange={(e) => onInvoiceNotesChange(e.target.value)}
        />
      </div>

      <div className="space-y-2 bg-muted p-4 rounded-lg">
        <div className="flex justify-between">
          <span>{t("pos.payments.subtotal")}</span>
          <span>{formatMoney(uiSubtotal)}</span>
        </div>

        <div className="flex justify-between items-center">
          <span>{t("pos.payments.discount")}</span>
          <div className="flex items-center gap-2">
            <Select
              value={discountPercentage.toString()}
              onValueChange={(value) => {
                const pct = Number(value)
                onDiscountPercentageChange(pct)
                if (isStoreCustomer && pct > 0) {
                  onClearStoreItemDiscounts()
                }
                setTimeout(() => {
                  onReallocatePayments()
                }, 0)
              }}
              disabled={cartHasStoreItemDiscount}
            >
              <SelectTrigger
                className={cn("w-[100px] h-8", cartHasStoreItemDiscount && "bg-muted cursor-not-allowed")}
              >
                <SelectValue placeholder="0%" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0%</SelectItem>
                <SelectItem value="5">5%</SelectItem>
                <SelectItem value="10">10%</SelectItem>
                <SelectItem value="15">15%</SelectItem>
                <SelectItem value="20">20%</SelectItem>
                <SelectItem value="25">25%</SelectItem>
                <SelectItem value="30">30%</SelectItem>
                <SelectItem value="40">40%</SelectItem>
                <SelectItem value="50">50%</SelectItem>
                <SelectItem value="60">60%</SelectItem>
                <SelectItem value="75">75%</SelectItem>
                <SelectItem value="80">80%</SelectItem>
                <SelectItem value="90">90%</SelectItem>
                <SelectItem value="100">100%</SelectItem>
              </SelectContent>
            </Select>
            <span className="min-w-[60px] text-right">
              {uiGlobalDiscountAmount > 0 ? `-${uiGlobalDiscountAmount.toFixed(3)}` : "0.000"}{" "}
              {getCurrencyLabel()}
            </span>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <span>{t("pos.payments.tax")}</span>
          <div className="flex items-center gap-2">
            <Select
              value={taxPercentage.toString()}
              onValueChange={(value) => onTaxPercentageChange(Number(value))}
            >
              <SelectTrigger className="w-[100px] h-8">
                <SelectValue placeholder="5%" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0%</SelectItem>
                <SelectItem value="5">5%</SelectItem>
                <SelectItem value="7">7%</SelectItem>
                <SelectItem value="10">10%</SelectItem>
                <SelectItem value="15">15%</SelectItem>
              </SelectContent>
            </Select>
            <span className="min-w-[60px] text-right">{formatMoney(uiTax)}</span>
          </div>
        </div>

        <Separator />
        <div className="flex justify-between font-bold text-lg">
          <span>{t("pos.payments.total")}</span>
          <span>{formatMoney(uiTotal)}</span>
        </div>

        {(totalPaidAmount > 0 || hasPartialPayment) && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{t("pos.payments.summary")}</span>
              </div>

              {paidItems.length > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    {t("pos.payments.paidItems")} ({paidItems.length})
                  </span>
                  <span className="text-green-600 font-medium">{formatMoney(uiTotalPaidAmount)}</span>
                </div>
              )}

              {unpaidItems.length > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                    {t("pos.payments.unpaidItems")} ({unpaidItems.length})
                  </span>
                  <span className="text-red-600 font-medium">{formatMoney(uiTotalUnpaidAmount)}</span>
                </div>
              )}

              {hasPartialPayment && (
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full" />
                    {t("pos.payments.partialPayments")}
                  </span>
                  <span className="text-orange-600 font-medium">
                    {
                      cart.filter((item) => {
                        const target = calculateItemTotal(item)
                        const paidAmount = item.paid_amount
                        const difference = Math.abs(paidAmount - target)
                        return paidAmount > 0.001 && difference >= 0.001 && paidAmount < target
                      }).length
                    }
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        <Separator />
        <div className="flex justify-between font-bold text-lg">
          <span>{t("pos.payments.amountDue")}</span>
          <span className={uiTotalUnpaidAmount > 0 ? "text-red-600" : "text-green-600"}>
            {formatMoney(uiTotalUnpaidAmount)}
          </span>
        </div>
      </div>

      <Button
        type="button"
        className="w-full mt-4"
        size="lg"
        disabled={
          cartLength === 0 ||
          isSubmitting ||
          !selectedCustomer ||
          !selectedWarehouse ||
          isNaN(totalUnpaidAmount) ||
          totalUnpaidAmount < 0
        }
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return
          e.preventDefault()
        }}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => void onCompleteSale()}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {t("pos.payments.processing")}
          </>
        ) : (
          <div className="flex items-center justify-between w-full">
            <span>{t("pos.payments.completeSale")}</span>
            <span className="text-sm">
              {uiTotalUnpaidAmount > 0
                ? t("pos.payments.payAmount", { amount: formatMoney(uiTotalUnpaidAmount) })
                : t("pos.payments.fullyPaid")}
            </span>
          </div>
        )}
      </Button>
    </>
  )
}
