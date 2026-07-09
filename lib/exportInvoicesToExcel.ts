import * as XLSX from "xlsx"
import type { ReceiptData, ReceiptItem } from "@/components/receipt/ReceiptContent"
import { toNum } from "@/components/receipt/ReceiptContent"

type InvoiceFinancials = {
  subtotal: number
  globalDiscountAmount: number
  tax: number
  total: number
  totalPaid: number
  totalUnpaid: number
  globalDiscountPercent: number
  taxPercent: number
}

function getItemLineGross(item: ReceiptItem) {
  return toNum(item.unit_price) * toNum(item.quantity)
}

function getItemLineTotal(item: ReceiptItem) {
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

function getItemEffectiveDiscountPercent(item: ReceiptItem) {
  const gross = getItemLineGross(item)
  if (gross <= 1e-9) return 0
  const net = getItemLineTotal(item)
  return Math.max(0, Math.min(100, Number((100 * (1 - net / gross)).toFixed(1))))
}

function calculateFinancials(receiptData: ReceiptData): InvoiceFinancials {
  if (receiptData.subtotal !== undefined) {
    const subtotal = toNum(receiptData.subtotal)
    const globalDiscountAmount = toNum(receiptData.globalDiscountAmount)
    const tax = toNum(receiptData.tax)
    const total = toNum(receiptData.total ?? receiptData.total_amount)
    const totalPaid = toNum(receiptData.total_paid)
    const totalUnpaid = toNum(receiptData.totalUnpaidAmount ?? receiptData.remaining_amount)
    return {
      subtotal,
      globalDiscountAmount,
      tax,
      total,
      totalPaid,
      totalUnpaid,
      globalDiscountPercent:
        subtotal > 0 ? (globalDiscountAmount / subtotal) * 100 : toNum(receiptData.global_discount_percent),
      taxPercent: toNum(receiptData.tax_percent),
    }
  }

  const items = receiptData.items || []
  const lineGrossSum = items.reduce((sum, item) => sum + getItemLineGross(item), 0)
  const lineNetSum = items.reduce((sum, item) => sum + getItemLineTotal(item), 0)
  const apiGlobalPct = toNum(receiptData.global_discount_percent)
  const discountFromLines = Math.max(0, lineGrossSum - lineNetSum)

  if (apiGlobalPct < 0.001 || discountFromLines > 0.001) {
    const discountedSubtotal = lineNetSum
    const taxPercent = toNum(receiptData.tax_percent)
    const tax = discountedSubtotal * (taxPercent / 100)
    const total = discountedSubtotal + tax
    const totalPaid = toNum(receiptData.total_paid)
    return {
      subtotal: lineGrossSum,
      globalDiscountAmount: discountFromLines,
      tax,
      total: total > 0.001 ? total : toNum(receiptData.total_amount),
      totalPaid,
      totalUnpaid: Math.max(0, toNum(receiptData.remaining_amount) || total - totalPaid),
      globalDiscountPercent: lineGrossSum > 0 ? (discountFromLines / lineGrossSum) * 100 : 0,
      taxPercent,
    }
  }

  const subtotal = items.reduce((sum, item) => sum + getItemLineTotal(item), 0)
  const globalDiscountAmount = (subtotal * apiGlobalPct) / 100
  const discountedSubtotal = subtotal - globalDiscountAmount
  const taxPercent = toNum(receiptData.tax_percent)
  const tax = discountedSubtotal * (taxPercent / 100)
  const total = discountedSubtotal + tax
  const totalPaid = toNum(receiptData.total_paid)

  return {
    subtotal,
    globalDiscountAmount,
    tax,
    total,
    totalPaid,
    totalUnpaid: Math.max(0, toNum(receiptData.remaining_amount) || total - totalPaid),
    globalDiscountPercent: apiGlobalPct,
    taxPercent,
  }
}

function resolveItemPaymentStatus(
  item: ReceiptItem,
  financials: InvoiceFinancials,
): string {
  const itemTotal = getItemLineTotal(item)
  const isFullyPaid = Math.abs(financials.totalPaid - financials.total) < 0.001
  if (isFullyPaid) return "Paid"
  if (item.is_paid || toNum(item.paid_amount) > 0) {
    return toNum(item.paid_amount) >= itemTotal ? "Paid" : "Partial"
  }
  if (financials.totalPaid > 0) return "Partial"
  return "Due"
}

function money(value: number, currencyLabel: string) {
  return `${value.toFixed(3)} ${currencyLabel}`
}

function buildInvoiceDetailRows(receiptData: ReceiptData, currencyLabel: string): (string | number)[][] {
  const financials = calculateFinancials(receiptData)
  const invoicePaymentStatus =
    Math.abs(financials.totalPaid - financials.total) < 0.001
      ? "Paid"
      : financials.totalPaid > 0.001
        ? "Partial"
        : "Due"

  const rows: (string | number)[][] = [
    ["DarArab for Publishing & Translation"],
    [],
    ["Invoice #", receiptData.composite_id || String(receiptData.id)],
    ["Date", receiptData.created_at_formatted || ""],
    ["Customer", receiptData.customer_name || ""],
    ["Contact", receiptData.customer_contact || ""],
    ["Payment Method", receiptData.payment_method_name || ""],
    ["Invoice Type", receiptData.invoice_type_name || ""],
    ["Warehouse", receiptData.warehouse_name || ""],
  ]

  if (receiptData.warehouse_location) {
    rows.push(["Warehouse Location", receiptData.warehouse_location])
  }

  rows.push(
    [],
    ["Product", "Quantity", "Unit Price", "Line Amount", "Discount %", "Line Total", "Payment Status"],
  )

  for (const item of receiptData.items || []) {
    const lineGross = getItemLineGross(item)
    const lineTotal = getItemLineTotal(item)
    rows.push([
      item.product_name || item.product?.title_en || "Unknown Product",
      toNum(item.quantity),
      money(toNum(item.unit_price), currencyLabel),
      money(lineGross, currencyLabel),
      getItemEffectiveDiscountPercent(item),
      money(lineTotal, currencyLabel),
      resolveItemPaymentStatus(item, financials),
    ])
  }

  rows.push(
    [],
    ["Subtotal", "", "", "", "", money(financials.subtotal, currencyLabel), ""],
  )

  if (financials.globalDiscountAmount > 0.001) {
    rows.push([
      `Discount (${financials.globalDiscountPercent.toFixed(1)}%)`,
      "",
      "",
      "",
      "",
      `-${money(financials.globalDiscountAmount, currencyLabel)}`,
      "",
    ])
  }

  if (financials.taxPercent > 0) {
    rows.push([
      `Tax (${financials.taxPercent.toFixed(1)}%)`,
      "",
      "",
      "",
      "",
      money(financials.tax, currencyLabel),
      "",
    ])
  }

  rows.push(
    ["Invoice Total", "", "", "", "", money(financials.total, currencyLabel), ""],
    ["Payment Status", invoicePaymentStatus, "", "", "", "", ""],
    ["Total Paid", "", "", "", "", money(financials.totalPaid, currencyLabel), ""],
    [
      "Amount Due",
      "",
      "",
      "",
      "",
      money(financials.totalUnpaid, currencyLabel),
      financials.totalUnpaid > 0.001 ? "balance" : "clear",
    ],
  )

  if (receiptData.notes?.trim()) {
    rows.push([], ["Notes", receiptData.notes])
  }

  return rows
}

export function downloadInvoiceDetailAsExcel(
  receiptData: ReceiptData,
  currencyLabel: string,
  filename: string,
) {
  const rows = buildInvoiceDetailRows(receiptData, currencyLabel)
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  worksheet["!cols"] = [
    { wch: 34 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 16 },
    { wch: 14 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Invoice")
  XLSX.writeFile(workbook, filename)
}
