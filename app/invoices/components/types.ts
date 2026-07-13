export interface Invoice {
  id: number
  composite_id?: string
  invoice_number: string
  customer: {
    id: number
    institution_name: string
    contact_person: string
  }
  warehouse: {
    id: number
    name_en: string
  }
  invoice_type: {
    id: number
    display_name_en: string
  }
  payment_method: {
    id: number
    display_name_en: string
  }
  created_at: string
  total_amount: number
  global_discount_percent?: string
  tax_percent?: string
  total_paid?: number
  remaining_amount?: number
  status: string
  items: InvoiceItem[]
  notes?: string
  selected?: boolean
}

export interface InvoiceItem {
  id: number
  product: {
    id: number
    title_en: string
    title_ar: string
  }
  quantity: number
  unit_price: number
  discount_percent: number
  total_price: number
}

export interface Warehouse {
  id: number
  name_en: string
  name_ar: string
  location?: string
}

export interface CustomerOption {
  id: number
  institution_name: string
  contact_person?: string
}

export interface InvoiceTotals {
  subtotal: number
  discountAmount: number
  discountedSubtotal: number
  taxAmount: number
  total: number
  totalPaid: number
  amountDue: number
}

export interface DeleteErrorPayload {
  code: string
  message: string
  detail: string
  product_ids: number[]
  errors: unknown[]
}

export type RowAction = "view" | "receipt" | "delete" | "export"
