type PaginatedPayload<T> = {
  count?: number
  next?: string | null
  results?: T[]
  data?: T[]
  items?: T[]
}

/**
 * Collect a DRF-style paginated endpoint without following `next` URLs.
 * Incrementing the page keeps requests on the normalized API origin.
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<unknown>,
): Promise<T[]> {
  const allItems: T[] = []

  for (let page = 1; page <= 1000; page += 1) {
    const payload = await fetchPage(page)

    if (Array.isArray(payload)) {
      return payload as T[]
    }

    const paginated = (payload || {}) as PaginatedPayload<T>
    const pageItems =
      paginated.results || paginated.data || paginated.items || []

    allItems.push(...pageItems)

    if (pageItems.length === 0) break
    if (typeof paginated.count === "number" && allItems.length >= paginated.count) break
    if (paginated.next == null && typeof paginated.count !== "number") break
  }

  return allItems
}
