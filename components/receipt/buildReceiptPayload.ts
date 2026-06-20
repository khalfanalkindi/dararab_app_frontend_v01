import { toNum, type ReceiptData, type ReceiptItem } from "./ReceiptContent"
import { API_URL } from "@/lib/config"
import {
  getLineUsdToOmrRatio,
  getProductId,
  getProductUsdToOmrRatio,
  isMuscatWarehouseContext,
  resolveProductForOmr,
  type ProductCatalog,
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

type SourceItemLike = {
  id?: number
  product_name?: string
  product?: unknown
  quantity?: unknown
  unit_price?: unknown
  discount_percent?: unknown
  total_price?: unknown
  paid_amount?: unknown
  is_paid?: boolean
}

function lineItemTotal(item: {
  total_price?: unknown
  unit_price?: unknown
  quantity?: unknown
  discount_percent?: unknown
}): number {
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
    0,
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

function productRecordFromApiPayload(
  productId: number,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const product = (payload.product ?? payload) as Record<string, unknown>
  const printRuns = (
    Array.isArray(payload.print_runs)
      ? payload.print_runs
      : Array.isArray(product.print_runs)
        ? product.print_runs
        : []
  ) as Record<string, unknown>[]
  const printRun = printRuns.length > 0 ? printRuns[printRuns.length - 1] : undefined

  return {
    id: productId,
    price: printRun?.price ?? product.price ?? product.latest_price,
    price_omr: printRun?.price_omr ?? product.price_omr ?? product.latest_price_omr,
    latest_price: printRun?.price ?? product.latest_price ?? product.price,
    latest_price_omr: printRun?.price_omr ?? product.latest_price_omr ?? product.price_omr,
  }
}

export function buildProductCatalogFromItems(
  items: Array<{ product?: unknown; product_name?: string }>,
): ProductCatalog {
  const catalog: ProductCatalog = new Map()
  for (const item of items) {
    const product = item.product
    if (typeof product === "number" && Number.isFinite(product)) {
      if (!catalog.has(product)) catalog.set(product, { id: product })
      continue
    }
    if (typeof product === "object" && product !== null) {
      const id = getItemProductId({ product })
      if (id != null) catalog.set(id, product as Record<string, unknown>)
    }
  }
  return catalog
}

function collectProductIds(
  summaryItems: ReceiptItem[],
  sourceItems: SourceItemLike[],
): number[] {
  const ids = new Set<number>()
  for (const item of [...summaryItems, ...sourceItems]) {
    const id = getItemProductId(item)
    if (id != null) ids.add(id)
  }
  return [...ids]
}

function productIdsNeedingOmrFetch(ids: number[], catalog: ProductCatalog): number[] {
  return ids.filter((id) => !getProductUsdToOmrRatio(catalog.get(id)))
}

function getItemProductId(item: { product?: unknown; product_id?: unknown }): number | null {
  return getProductId(item.product) ?? getProductId(item.product_id)
}

function buildReceiptFromSourceItemsOnly(
  invoice: InvoiceSummaryLike,
  sourceItems: SourceItemLike[],
  warehouse: WarehouseLike | null | undefined,
  warehouses: WarehouseLike[],
  catalog: ProductCatalog,
): { payload: ReceiptData; currencyLabel: string } {
  const itemsFromSource = sourceItems.map((source) => {
    const productId = getItemProductId(source)
    const catalogProduct = productId != null ? catalog.get(productId) : undefined
    return {
      id: source.id,
      product_name: source.product_name,
      product: (catalogProduct ?? source.product) as ReceiptItem["product"],
      quantity: source.quantity,
      unit_price: source.unit_price,
      discount_percent: source.discount_percent,
      total_price: source.total_price,
      paid_amount: source.paid_amount ?? source.total_price,
      is_paid: source.is_paid ?? true,
    }
  })

  return buildReceiptPayloadForDisplay(
    { ...invoice, items: itemsFromSource },
    warehouse,
    warehouses,
    catalog,
  )
}

function findMatchingSourceItem(
  item: { product_name?: string; product?: unknown; id?: number },
  sourceItems: SourceItemLike[],
): SourceItemLike | undefined {
  const itemProductId = getItemProductId(item)
  return sourceItems.find((source) => {
    if (item.id != null && source.id != null && item.id === source.id) return true
    if (
      itemProductId != null &&
      getItemProductId(source) != null &&
      itemProductId === getItemProductId(source)
    ) {
      return true
    }
    return (
      !!item.product_name &&
      !!source.product_name &&
      item.product_name === source.product_name
    )
  })
}

function mergeInvoiceWithSourceItems(
  invoice: InvoiceSummaryLike,
  sourceItems: SourceItemLike[],
  catalog: ProductCatalog,
): InvoiceSummaryLike {
  if (sourceItems.length === 0) return invoice

  const summaryItems = invoice.items || []
  const mergedItems =
    summaryItems.length > 0
      ? summaryItems.map((item) => {
          const source = findMatchingSourceItem(item, sourceItems)
          const productId =
            getItemProductId(item) ?? getItemProductId(source ?? {})
          const catalogProduct =
            productId != null ? catalog.get(productId) : undefined
          const resolvedProduct = (
            catalogProduct ??
            (typeof source?.product === "object" ? source.product : undefined) ??
            item.product ??
            (productId != null ? productId : undefined)
          ) as ReceiptItem["product"]

          return {
            ...item,
            product_name: item.product_name || source?.product_name,
            quantity: item.quantity ?? source?.quantity,
            unit_price: item.unit_price ?? source?.unit_price,
            discount_percent: item.discount_percent ?? source?.discount_percent,
            total_price: item.total_price ?? source?.total_price,
            paid_amount: item.paid_amount ?? source?.paid_amount,
            is_paid: item.is_paid ?? source?.is_paid,
            product: resolvedProduct,
          }
        })
      : sourceItems.map((source) => {
          const productId = getItemProductId(source)
          const catalogProduct = productId != null ? catalog.get(productId) : undefined
          return {
            id: source.id,
            product_name: source.product_name,
            product: (catalogProduct ?? source.product) as ReceiptItem["product"],
            quantity: source.quantity,
            unit_price: source.unit_price,
            discount_percent: source.discount_percent,
            total_price: source.total_price,
            paid_amount: source.paid_amount,
            is_paid: source.is_paid,
          }
        })

  return { ...invoice, items: mergedItems }
}

async function fetchProductRecordFromPosSummary(
  warehouseId: number,
  productId: number,
  productName: string,
  headers: HeadersInit,
  signal?: AbortSignal,
): Promise<Record<string, unknown> | null> {
  const searchTerms = [productName.trim()]
  if (productName.includes(" ")) {
    searchTerms.push(productName.split(" ")[0].trim())
  }

  for (const search of searchTerms) {
    if (!search) continue
    try {
      const params = new URLSearchParams({
        warehouse_id: String(warehouseId),
        page_size: "50",
        search,
      })
      const response = await fetch(
        `${API_URL}/inventory/pos-product-summary/?${params.toString()}`,
        { headers, signal },
      )
      if (!response.ok) continue
      const data = (await response.json()) as Record<string, unknown>
      const results = (Array.isArray(data.results)
        ? data.results
        : Array.isArray(data)
          ? data
          : []) as Record<string, unknown>[]
      const match =
        results.find((entry) => getProductId(entry) === productId) ??
        results.find((entry) => {
          const titleEn = String(entry.title_en ?? "")
          const titleAr = String(entry.title_ar ?? "")
          return titleEn === productName || titleAr === productName
        })
      if (!match) continue
      return productRecordFromApiPayload(productId, match)
    } catch {
      // Try next search term
    }
  }

  return null
}

async function fetchProductRecordForCatalog(
  productId: number,
  headers: HeadersInit,
  signal: AbortSignal | undefined,
  warehouseId: number | undefined,
  productName: string | undefined,
): Promise<Record<string, unknown> | null> {
  const endpoints = [
    `${API_URL}/inventory/products/${productId}/aggregated/`,
    `${API_URL}/inventory/products/${productId}/`,
  ]

  for (const url of endpoints) {
    try {
      const response = await fetch(url, { headers, signal })
      if (!response.ok) continue
      const data = (await response.json()) as Record<string, unknown>
      const record = productRecordFromApiPayload(productId, data)
      if (getProductUsdToOmrRatio(record)) return record
    } catch {
      // Try next endpoint
    }
  }

  if (warehouseId != null && productName) {
    return fetchProductRecordFromPosSummary(
      warehouseId,
      productId,
      productName,
      headers,
      signal,
    )
  }

  return null
}

export async function enrichProductCatalogFromApi(
  catalog: ProductCatalog,
  productIds: number[],
  accessToken: string,
  signal?: AbortSignal,
  warehouseId?: number,
  sourceItems: SourceItemLike[] = [],
): Promise<ProductCatalog> {
  const enriched: ProductCatalog = new Map(catalog)
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  }

  await Promise.all(
    productIds.map(async (productId) => {
      if (getProductUsdToOmrRatio(enriched.get(productId))) return

      const sourceItem = sourceItems.find((item) => getItemProductId(item) === productId)
      const productName = sourceItem?.product_name
      const record = await fetchProductRecordForCatalog(
        productId,
        headers,
        signal,
        warehouseId,
        productName,
      )
      if (record) enriched.set(productId, record)
    }),
  )

  return enriched
}

/** Build receipt payload with Muscat OMR on screen (USD from API), discount-aware per line totals. */
export function buildReceiptPayloadForDisplay(
  invoice: InvoiceSummaryLike,
  warehouse?: WarehouseLike | null,
  warehouses: WarehouseLike[] = [],
  productCatalog?: ProductCatalog,
): { payload: ReceiptData; currencyLabel: string } {
  const payload = buildReceiptPayloadFromSummary(invoice)
  const isMuscat = isMuscatWarehouseContext(
    warehouse?.id,
    warehouse ?? undefined,
    warehouses,
    {
      warehouse_name: invoice.warehouse_name,
      warehouse_location: invoice.warehouse_location,
    },
  )
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
    const ratio = getLineUsdToOmrRatio(item, productCatalog)
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

export async function buildReceiptPayloadForDisplayAsync(
  invoice: InvoiceSummaryLike,
  warehouse?: WarehouseLike | null,
  warehouses: WarehouseLike[] = [],
  sourceItems: SourceItemLike[] = [],
  accessToken = "",
  signal?: AbortSignal,
): Promise<{ payload: ReceiptData; currencyLabel: string }> {
  const basePayload = buildReceiptPayloadFromSummary(invoice)
  const isMuscat = isMuscatWarehouseContext(
    warehouse?.id,
    warehouse ?? undefined,
    warehouses,
    {
      warehouse_name: invoice.warehouse_name,
      warehouse_location: invoice.warehouse_location,
    },
  )

  if (!isMuscat) {
    return buildReceiptPayloadForDisplay(invoice, warehouse, warehouses)
  }

  let catalog = buildProductCatalogFromItems(sourceItems)
  const allProductIds = collectProductIds(basePayload.items, sourceItems)
  const missingIds = productIdsNeedingOmrFetch(allProductIds, catalog)

  if (missingIds.length > 0 && accessToken) {
    catalog = await enrichProductCatalogFromApi(
      catalog,
      missingIds,
      accessToken,
      signal,
      warehouse?.id,
      sourceItems,
    )
  }

  const mergedInvoice = mergeInvoiceWithSourceItems(invoice, sourceItems, catalog)
  let result = buildReceiptPayloadForDisplay(mergedInvoice, warehouse, warehouses, catalog)

  if (result.currencyLabel === "$" && sourceItems.length > 0) {
    result = buildReceiptFromSourceItemsOnly(
      invoice,
      sourceItems,
      warehouse,
      warehouses,
      catalog,
    )
  }

  return result
}
