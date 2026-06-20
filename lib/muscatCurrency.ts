/** Muscat warehouse: show OMR on screen, amounts in API remain USD. */

export interface WarehouseLike {
  id?: number
  location?: string
  name_en?: string
  name?: string
}

export type ProductCatalog = Map<number, Record<string, unknown>>

export interface InvoiceLineLike {
  total_price?: number | string
  unit_price?: number | string
  quantity?: number | string
  discount_percent?: number | string
  paid_amount?: number | string
  product?: unknown
}

export interface InvoiceLike {
  warehouse?: WarehouseLike | null
  items?: InvoiceLineLike[]
}

export function isMuscatWarehouse(
  warehouseId: number | null | undefined,
  warehouse: WarehouseLike | null | undefined,
  warehouses: WarehouseLike[] = [],
): boolean {
  if (warehouse?.location === "Muscat") return true
  if (warehouseId != null) {
    const fromList = warehouses.find((w) => w.id === warehouseId)
    if (fromList?.location === "Muscat") return true
  }
  return false
}

export function isMuscatWarehouseContext(
  warehouseId: number | null | undefined,
  warehouse: WarehouseLike | null | undefined,
  warehouses: WarehouseLike[] = [],
  hints?: { warehouse_name?: string; warehouse_location?: string },
): boolean {
  if (isMuscatWarehouse(warehouseId, warehouse ?? undefined, warehouses)) return true
  const location = hints?.warehouse_location || warehouse?.location || ""
  if (/muscat/i.test(String(location))) return true
  const name = hints?.warehouse_name || warehouse?.name_en || warehouse?.name || ""
  if (/muscat/i.test(String(name))) return true
  return false
}

export function getProductId(product: unknown): number | null {
  if (typeof product === "number" && Number.isFinite(product)) return product
  if (product && typeof product === "object") {
    const id = (product as Record<string, unknown>).id
    if (typeof id === "number") return id
  }
  return null
}

export function resolveProductForOmr(
  product: unknown,
  catalog?: ProductCatalog,
): unknown {
  if (product && typeof product === "object") {
    const record = product as Record<string, unknown>
    if (getProductUsdToOmrRatio(record)) return record
    const id = getProductId(record)
    if (id != null && catalog?.has(id)) return catalog.get(id)
    return record
  }
  if (typeof product === "number" && catalog?.has(product)) {
    return catalog.get(product)
  }
  return product
}

export function getLineUsdToOmrRatio(
  item: InvoiceLineLike,
  catalog?: ProductCatalog,
): number | null {
  return getProductUsdToOmrRatio(resolveProductForOmr(item.product, catalog))
}

export function isMuscatInvoice(invoice: InvoiceLike, warehouses: WarehouseLike[] = []): boolean {
  return isMuscatWarehouse(invoice.warehouse?.id, invoice.warehouse ?? undefined, warehouses)
}

export function getProductUsdToOmrRatio(product: unknown): number | null {
  if (!product || typeof product !== "object") return null
  const p = product as Record<string, unknown>
  const usd = parseFloat(String(p.price ?? p.latest_price ?? "0"))
  const omr = parseFloat(String(p.price_omr ?? p.latest_price_omr ?? "0"))
  if (usd > 0 && omr > 0) return omr / usd
  return null
}

export function getLineUsdTotal(item: InvoiceLineLike): number {
  const fromApi = parseFloat(String(item.total_price ?? ""))
  if (Number.isFinite(fromApi)) return Math.max(0, fromApi)
  const price = parseFloat(String(item.unit_price ?? "0"))
  const qty = parseFloat(String(item.quantity ?? "0"))
  const disc = parseFloat(String(item.discount_percent ?? "0")) / 100
  const raw = price * qty * (1 - disc)
  return Number.isFinite(raw) ? Math.max(0, raw) : 0
}

export function convertUsdLineAmountToOmr(
  usdAmount: number,
  item: InvoiceLineLike,
  catalog?: ProductCatalog,
): number | null {
  const ratio = getLineUsdToOmrRatio(item, catalog)
  if (!ratio) return null
  return Number((usdAmount * ratio).toFixed(3))
}

export function convertInvoiceUsdToDisplay(
  usdAmount: number,
  invoice: InvoiceLike,
  isMuscat: boolean,
): { amount: number; label: "$" | "OMR" } {
  if (!isMuscat) return { amount: usdAmount, label: "$" }

  const items = invoice.items || []
  if (items.length === 0) return { amount: usdAmount, label: "$" }

  let usdSum = 0
  let omrSum = 0
  let convertedLines = 0

  for (const item of items) {
    const lineUsd = getLineUsdTotal(item)
    const ratio = getLineUsdToOmrRatio(item)
    usdSum += lineUsd
    if (ratio) {
      omrSum += lineUsd * ratio
      convertedLines += 1
    } else {
      omrSum += lineUsd
    }
  }

  if (usdSum <= 1e-9 || convertedLines === 0) {
    return { amount: usdAmount, label: "$" }
  }

  return {
    amount: Number(((usdAmount / usdSum) * omrSum).toFixed(3)),
    label: "OMR",
  }
}

export function formatDisplayMoney(amount: number, label: "$" | "OMR"): string {
  return `${amount.toFixed(3)} ${label}`
}

export function formatInvoiceUsdAmount(
  usdAmount: number,
  invoice: InvoiceLike,
  warehouses: WarehouseLike[] = [],
): string {
  const isMuscat = isMuscatInvoice(invoice, warehouses)
  const { amount, label } = convertInvoiceUsdToDisplay(usdAmount, invoice, isMuscat)
  return formatDisplayMoney(amount, label)
}

export function formatLineUsdAmount(
  usdAmount: number,
  item: InvoiceLineLike,
  invoice: InvoiceLike,
  warehouses: WarehouseLike[] = [],
): string {
  const isMuscat = isMuscatInvoice(invoice, warehouses)
  if (!isMuscat) return formatDisplayMoney(usdAmount, "$")
  const omr = convertUsdLineAmountToOmr(usdAmount, item)
  if (omr === null) return formatDisplayMoney(usdAmount, "$")
  return formatDisplayMoney(omr, "OMR")
}

export function sumSelectedOutstandingDisplay(
  invoices: Array<InvoiceLike & { selected?: boolean; remaining_amount?: number }>,
  warehouses: WarehouseLike[] = [],
): string {
  const selected = invoices.filter((inv) => inv.selected)
  if (selected.length === 0) return formatDisplayMoney(0, "$")

  let omrTotal = 0
  let usdTotal = 0

  for (const invoice of selected) {
    const remaining = Number(invoice.remaining_amount) || 0
    const { amount, label } = convertInvoiceUsdToDisplay(
      remaining,
      invoice,
      isMuscatInvoice(invoice, warehouses),
    )
    if (label === "OMR") omrTotal += amount
    else usdTotal += amount
  }

  if (omrTotal > 0 && usdTotal > 0) {
    return `${omrTotal.toFixed(3)} OMR + ${usdTotal.toFixed(3)} $`
  }
  if (omrTotal > 0) return formatDisplayMoney(omrTotal, "OMR")
  return formatDisplayMoney(usdTotal, "$")
}
