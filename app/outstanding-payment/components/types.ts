export interface Customer {
  id: number
  institution_name?: string
  name_en?: string
  contact_person?: string
  phone?: string
  customer_type?: string
  type?: string
}

export interface Warehouse {
  id: number
  name_en?: string
  name_ar?: string
  name?: string
  location?: string
}

export interface Product {
  id: number
  name_en: string
  name_ar: string
  title?: string
  title_ar?: string
  price?: string | null
  price_omr?: string | null
  latest_price?: string | null
  latest_price_omr?: string | null
}

export interface Invoice {
  id: number
  composite_id?: string
  customer_name: string
  customer_type: string | null
  customer_contact: string
  warehouse_name: string
  invoice_type_name: string
  payment_method_name: string
  is_returnable?: boolean
  items: InvoiceItem[]
  total_amount: number
  total_paid: number
  remaining_amount: number
  notes?: string
  created_at_formatted?: string
  created_by?: number
  updated_by?: number
  created_at: string
  updated_at?: string
  selected?: boolean
  status?: string
  customer?: Customer | null
  warehouse?: Warehouse | null
  invoice_type?: {
    id: number
    display_name_en?: string
    name_en?: string
    value?: string
  } | null
  payment_method?: {
    id: number
    display_name_en?: string
    name_en?: string
    value?: string
  } | null
}

export interface InvoiceItem {
  id?: number
  product_name: string
  quantity?: number | string
  unit_price?: number | string
  discount_percent?: number | string
  tax_percent?: number | string
  total_price?: number | string
  paid_amount?: number | string
  remaining_amount?: number | string
  is_paid?: boolean
  selected?: boolean
  payment_status?: number
  payment_status_display?: string
  payment_summary?: unknown
  product?: Product | number
}

export type AllocationDialogType = "view" | "generate" | "confirm" | null

export type RowAction = "view" | "settle"
