import { toNum, type ReceiptData, type ReceiptItem } from "./ReceiptContent"
import {
  getProductUsdToOmrRatio,
  isMuscatWarehouse,
  type WarehouseLike,
} from "@/lib/muscatCurrency"

export interface InvoiceSummaryLike {
  id: number
  composite_id?: string
  customer_name?: string
  customer_contact?: string
  warehouse_name?: string
  warehouse_location?: string
  invoice_type_name?: string
  payment_method_name?: string
  items?: Array<{
    id?: number
    product_name?: string
    product?: ReceiptItem["product"]
    quantity?: unknown
    unit_price?: unknown
    discount_percent?: unknown
    total_price?: unknown
    paid_amount?: unknown
    is_paid?: boolean
  }>
  total_amount?: unknown
  total_paid?: unknown
  remaining_amount?: unknown
  notes?: string
  created_at_formatted?: string
  global_discount_percent?: unknown
  tax_percent?: unknown
  subtotal?: unknown
}

function lineItemTotal(item: NonNullable<InvoiceSummaryLike["items"]>[number]): number {
  if (item.total_price !== undefined && item.total_price !== null) {
    const fromApi = toNum(item.total_price)
    if (Number.isFinite(fromApi)) return Math.max(0, fromApi)
  }
  const price = toNum(item.unit_price)
  const quantity = toNum(item.quantity)
  const discount = toNum(item.discount_percent) / 100
  const raw = price * quantity * (1 - discount)
  return Number.isFinite(raw) ? Math.max(0, raw) : 0
}

export function buildReceiptPayloadFromSummary(invoice: InvoiceSummaryLike): ReceiptData {
  const items = invoice.items || []
  const mappedItems: ReceiptItem[] = items.map((it) => {
    const itemTotal = lineItemTotal(it)
    const paidAmount = toNum(it.paid_amount)
    const isPaid =
      it.is_paid === true ||
      (it.is_paid !== false && paidAmount >= itemTotal - 0.001 && paidAmount > 0.001)

    return {
      id: it.id,
      product_name: it.product_name,
      product: it.product,
      quantity: toNum(it.quantity),
      unit_price: toNum(it.unit_price),
      discount_percent: toNum(it.discount_percent),
      total_price: itemTotal,
      paid_amount: paidAmount,
      is_paid: isPaid,
    }
  })

  const hasPartialPayment = mappedItems.some((item) => {
    const t = lineItemTotal(item)
    const p = toNum(item.paid_amount)
    return p > 0.001 && p < t - 0.001
  })

  const totalAmount = toNum(invoice.total_amount)
  const totalPaid = toNum(invoice.total_paid)
  const remainingAmount =
    invoice.remaining_amount !== undefined && invoice.remaining_amount !== null
      ? toNum(invoice.remaining_amount)
      : Math.max(0, totalAmount - totalPaid)

  const itemsSubtotal = mappedItems.reduce(
    (sum, item) => sum + toNum(item.unit_price) * toNum(item.quantity),
    0
  )
  const globalDiscountPercent = toNum(invoice.global_discount_percent)
  const taxPercent = toNum(invoice.tax_percent)
  const globalDiscountAmount = itemsSubtotal * (globalDiscountPercent / 100)
  const discountedSubtotal = itemsSubtotal - globalDiscountAmount
  const tax = discountedSubtotal * (taxPercent / 100)
  const computedTotal = discountedSubtotal + tax
  const total = totalAmount > 0.001 ? totalAmount : computedTotal

  return {
    id: invoice.id,
    composite_id: invoice.composite_id,
    customer_name: invoice.customer_name || "Walk-in Customer",
    customer_contact: invoice.customer_contact,
    warehouse_name: invoice.warehouse_name || "N/A",
    invoice_type_name: invoice.invoice_type_name,
    payment_method_name: invoice.payment_method_name,
    items: mappedItems,
    total_amount: total,
    total_paid: totalPaid,
    remaining_amount: remainingAmount,
    notes: invoice.notes,
    created_at_formatted: invoice.created_at_formatted,
    global_discount_percent: globalDiscountPercent,
    tax_percent: taxPercent,
    subtotal: invoice.subtotal !== undefined ? toNum(invoice.subtotal) : itemsSubtotal,
    globalDiscountAmount,
    tax,
    total,
    totalUnpaidAmount: remainingAmount,
    hasPartialPayment,
  }
}

function scaleUsdToOmr(usdAmount: number, ratio: number): number {
  return Number((usdAmount * ratio).toFixed(3))
}

/** Build receipt payload with Muscat OMR on screen (USD from API), discount-aware per line totals. */
export function buildReceiptPayloadForDisplay(
  invoice: InvoiceSummaryLike,
  warehouse?: WarehouseLike | null,
  warehouses: WarehouseLike[] = [],
): { payload: ReceiptData; currencyLabel: string } {
  const payload = buildReceiptPayloadFromSummary(invoice)
  const isMuscat = isMuscatWarehouse(warehouse?.id, warehouse ?? undefined, warehouses)
  const warehouseLocation =
    invoice.warehouse_location ||
    warehouse?.location ||
    warehouses.find((w) => w.id === warehouse?.id)?.location ||
    ""

  if (!isMuscat) {
    return {
      payload: { ...payload, warehouse_location: warehouseLocation },
      currencyLabel: "$",
    }
  }

  let convertedLines = 0
  const items = payload.items.map((item) => {
    const ratio = getProductUsdToOmrRatio(item.product)
    if (!ratio) return item
    convertedLines += 1
    return {
      ...item,
      unit_price: scaleUsdToOmr(item.unit_price, ratio),
      total_price: scaleUsdToOmr(item.total_price, ratio),
      paid_amount:
        item.paid_amount != null ? scaleUsdToOmr(item.paid_amount, ratio) : undefined,
    }
  })

  if (convertedLines === 0) {
    return {
      payload: { ...payload, warehouse_location: warehouseLocation },
      currencyLabel: "$",
    }
  }

  const usdLinesSum = payload.items.reduce((sum, item) => sum + item.total_price, 0)
  const omrLinesSum = items.reduce((sum, item) => sum + item.total_price, 0)
  const scale = usdLinesSum > 1e-9 ? omrLinesSum / usdLinesSum : 1

  const scaleAmount = (value: number | undefined) =>
    value != null ? Number((value * scale).toFixed(3)) : value

  return {
    payload: {
      ...payload,
      items,
      warehouse_location: warehouseLocation,
      total_amount: scaleAmount(payload.total_amount) ?? payload.total_amount,
      total_paid: scaleAmount(payload.total_paid),
      remaining_amount: scaleAmount(payload.remaining_amount),
      totalUnpaidAmount: scaleAmount(payload.totalUnpaidAmount),
      subtotal: scaleAmount(payload.subtotal),
      globalDiscountAmount: scaleAmount(payload.globalDiscountAmount),
      tax: scaleAmount(payload.tax),
      total: scaleAmount(payload.total ?? payload.total_amount),
    },
    currencyLabel: "OMR",
  }
}
