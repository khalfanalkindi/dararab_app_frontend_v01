export interface Product {
  id: number
  title_ar: string
  title_en: string
  isbn: string
  genre_id: number
  status_id: number
  genre_name: string
  status_name: string
  author_name: string | null
  translator_name: string | null
  editions_count: number
  stock: number | null
  latest_price: string | null
  latest_price_omr: string | null
  price: string | null
  price_omr: string | null
  latest_cost: string | null
  cover_design_url: string | null
  warehouse_stock?: number
}

export interface Customer {
  id: number
  institution_name: string
  contact_person: string
  phone: string
  email: string
  customer_type?: number | null
}

export interface CartItem {
  product: Product
  quantity: number
  discount_percent: number
  is_paid: boolean
  paid_amount: number
}

export interface Genre {
  id: number
  value: string
  display_name_en: string
}

export interface Warehouse {
  id: number
  name_en: string
  name_ar: string
  location: string
}

export interface PaymentMethod {
  id: number
  value: string
  display_name_en: string
}

export interface InvoiceType {
  id: number
  value: string
  display_name_en: string
}

export interface CustomerType {
  id: number
  value?: string
  display_name_en?: string
  name_en?: string
}

export type DialogType = "newCustomer" | "print" | null

export type NewCustomerForm = Omit<Customer, "id">
