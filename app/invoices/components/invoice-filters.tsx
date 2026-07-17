"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { Search } from "lucide-react"
import { DateRange } from "react-day-picker"
import { useLanguage } from "@/components/language-context"

import type { CustomerOption, Warehouse } from "./types"

type InvoiceFiltersProps = {
  warehouses: Warehouse[]
  customers: CustomerOption[]
  selectedWarehouse: number | null
  onWarehouseChange: (warehouseId: number | null) => void
  dateRange: DateRange | null
  onDateRangeChange: (range: DateRange | null) => void
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  selectedCustomerId: number | null
  onCustomerChange: (customerId: number | null) => void
  isLoadingCustomers: boolean
  onSearchFormSubmit: (e: React.FormEvent) => void
  onSearchClick: () => void
  onReset: () => void
  canSearch: boolean
}

export function InvoiceFilters({
  warehouses,
  customers,
  selectedWarehouse,
  onWarehouseChange,
  dateRange,
  onDateRangeChange,
  searchQuery,
  onSearchQueryChange,
  selectedCustomerId,
  onCustomerChange,
  isLoadingCustomers,
  onSearchFormSubmit,
  onSearchClick,
  onReset,
  canSearch,
}: InvoiceFiltersProps) {
  const { t } = useLanguage()

  return (
    <div className="flex flex-col md:flex-row md:items-end gap-4 mb-6 w-full">
      <div className="space-y-2 flex-1 min-w-0">
        <Label>{t("invoices.filters.warehouse")}</Label>
        <Select
          value={selectedWarehouse?.toString() || "all"}
          onValueChange={(value) => onWarehouseChange(value === "all" ? null : Number(value))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("common.allWarehouses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.allWarehouses")}</SelectItem>
            {warehouses.map((warehouse) => (
              <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                {warehouse.name_en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2 flex-1 min-w-0">
        <Label>{t("invoices.filters.dateRange")}</Label>
        <div className="w-full">
          <DatePickerWithRange
            date={dateRange ?? { from: undefined, to: undefined }}
            onDateChange={(range) => onDateRangeChange(range ?? null)}
          />
        </div>
      </div>

      <form onSubmit={onSearchFormSubmit} className="space-y-2 flex-1 min-w-0">
        <Label>{t("invoices.filters.invoiceId")}</Label>
        <Input
          className="w-full"
          placeholder={t("invoices.filters.invoiceIdPlaceholder")}
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
        />
      </form>

      <div className="space-y-2 flex-1 min-w-0">
        <Label>{t("invoices.filters.customer")}</Label>
        <Select
          value={selectedCustomerId?.toString() || "all"}
          onValueChange={(value) => onCustomerChange(value === "all" ? null : Number(value))}
          disabled={isLoadingCustomers}
        >
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={isLoadingCustomers ? t("common.loading") : t("common.allCustomers")}
            />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectItem value="all">{t("common.allCustomers")}</SelectItem>
            {customers.map((customer) => (
              <SelectItem key={customer.id} value={customer.id.toString()}>
                {customer.institution_name}
                {customer.contact_person ? ` (${customer.contact_person})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 shrink-0 items-end">
        <Button type="button" disabled={!canSearch} onClick={onSearchClick}>
          <Search className="h-4 w-4 mr-2" />
          {t("common.search")}
        </Button>
        <Button type="button" variant="outline" onClick={onReset}>
          {t("common.reset")}
        </Button>
      </div>
    </div>
  )
}
