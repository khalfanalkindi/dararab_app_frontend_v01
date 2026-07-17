"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { Search } from "lucide-react"
import { DateRange } from "react-day-picker"
import { useLanguage } from "@/components/language-context"

import type { Customer, Warehouse } from "./types"

type OutstandingFiltersProps = {
  warehouses: Warehouse[]
  customers: Customer[]
  selectedWarehouse: number | null
  onWarehouseChange: (warehouseId: number | null) => void
  dateRange: DateRange | null
  onDateRangeChange: (range: DateRange | null) => void
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  selectedCustomerId: number | null
  onCustomerChange: (customerId: number | null) => void
  isLoadingCustomers: boolean
  isLoading: boolean
  onSearch: () => void
  onReset: () => void
  onLoadOutstanding: () => void
}

export function OutstandingFilters({
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
  isLoading,
  onSearch,
  onReset,
  onLoadOutstanding,
}: OutstandingFiltersProps) {
  const { t } = useLanguage()

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="space-y-2">
          <Label>{t("outstanding.filters.warehouse")}</Label>
          <Select
            value={selectedWarehouse?.toString() || "all"}
            onValueChange={(value) => onWarehouseChange(value === "all" ? null : Number(value))}
          >
            <SelectTrigger className="w-full h-10">
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

        <div className="space-y-2">
          <Label>{t("outstanding.filters.dateRange")}</Label>
          <div className="h-10">
            <DatePickerWithRange
              date={dateRange ?? { from: undefined, to: undefined }}
              onDateChange={(range) => onDateRangeChange(range ?? null)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("outstanding.filters.invoiceId")}</Label>
          <Input
            className="w-full h-10"
            placeholder={t("outstanding.filters.invoiceIdPlaceholder")}
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                onSearch()
              }
            }}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("outstanding.filters.customer")}</Label>
          <Select
            value={selectedCustomerId?.toString() || "all"}
            onValueChange={(value) => onCustomerChange(value === "all" ? null : Number(value))}
            disabled={isLoadingCustomers}
          >
            <SelectTrigger className="w-full h-10">
              <SelectValue
                placeholder={isLoadingCustomers ? t("common.loading") : t("common.allCustomers")}
              />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="all">{t("common.allCustomers")}</SelectItem>
              {customers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id.toString()}>
                  {customer.institution_name || customer.name_en || `Customer #${customer.id}`}
                  {customer.contact_person ? ` (${customer.contact_person})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Button onClick={onSearch} disabled={isLoading}>
          <Search className="h-4 w-4 mr-2" />
          {isLoading ? t("common.loading") : t("common.search")}
        </Button>
        <Button variant="outline" onClick={onReset} disabled={isLoading}>
          {t("common.reset")}
        </Button>
        <Button variant="secondary" onClick={onLoadOutstanding} disabled={isLoading}>
          {isLoading ? t("common.loading") : t("outstanding.filters.load")}
        </Button>
      </div>
    </>
  )
}
