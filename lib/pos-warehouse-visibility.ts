import { fetchWithRetry } from "@/lib/apiClient"
import { API_URL } from "@/lib/config"

/**
 * Warehouses hidden from the POS dropdown are stored as common list items
 * (one active item per hidden warehouse, value = warehouse id). Presentation
 * only: sales, stock and reports never read this list.
 */
export const POS_HIDDEN_WAREHOUSES_CODE = "pos_hidden_warehouses"

type Headers = Record<string, string>

type ListItemRow = { id: number; value: string }
type ListTypeRow = { id: number; code: string }

const toArray = <T,>(data: unknown): T[] =>
  Array.isArray(data) ? (data as T[]) : ((data as { results?: T[] })?.results ?? [])

/** warehouse id → list item id */
export async function fetchPosHiddenWarehouses(
  headers: Headers,
  signal?: AbortSignal,
): Promise<Map<number, number>> {
  const res = await fetchWithRetry(
    `${API_URL}/common/list-items/${POS_HIDDEN_WAREHOUSES_CODE}/?page_size=100`,
    { headers, signal },
  )
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
  const rows = toArray<ListItemRow>(await res.json())
  const map = new Map<number, number>()
  for (const row of rows) {
    const warehouseId = Number(row.value)
    if (Number.isFinite(warehouseId)) map.set(warehouseId, row.id)
  }
  return map
}

async function ensureListTypeId(headers: Headers): Promise<number> {
  const res = await fetchWithRetry(`${API_URL}/common/list-types/?page_size=100`, { headers })
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
  const existing = toArray<ListTypeRow>(await res.json()).find(
    (row) => row.code === POS_HIDDEN_WAREHOUSES_CODE,
  )
  if (existing) return existing.id

  const createRes = await fetchWithRetry(`${API_URL}/common/list-types/`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      code: POS_HIDDEN_WAREHOUSES_CODE,
      name_en: "POS hidden warehouses",
      name_ar: "مستودعات مخفية في نقطة البيع",
    }),
  })
  if (!createRes.ok) throw new Error(`HTTP error! status: ${createRes.status}`)
  return (await createRes.json()).id
}

/** Returns the created list item id. */
export async function hideWarehouseInPos(
  headers: Headers,
  warehouse: { id: number; name_en: string; name_ar: string },
): Promise<number> {
  const listTypeId = await ensureListTypeId(headers)
  const res = await fetchWithRetry(`${API_URL}/common/list-items/`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      list_type: listTypeId,
      value: String(warehouse.id),
      display_name_en: warehouse.name_en,
      display_name_ar: warehouse.name_ar,
      is_active: true,
    }),
  })
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
  return (await res.json()).id
}

export async function showWarehouseInPos(headers: Headers, listItemId: number): Promise<void> {
  const res = await fetchWithRetry(`${API_URL}/common/list-items/${listItemId}/delete/`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok && res.status !== 404) throw new Error(`HTTP error! status: ${res.status}`)
}
