"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { Search } from "lucide-react"
import { DateRange } from "react-day-picker"

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
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="space-y-2">
          <Label>Warehouse</Label>
          <Select
            value={selectedWarehouse?.toString() || "all"}
            onValueChange={(value) => onWarehouseChange(value === "all" ? null : Number(value))}
          >
            <SelectTrigger className="w-full h-10">
              <SelectValue placeholder="All Warehouses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Warehouses</SelectItem>
              {warehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                  {warehouse.name_en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Date Range</Label>
          <div className="h-10">
            <DatePickerWithRange
              date={dateRange ?? { from: undefined, to: undefined }}
              onDateChange={(range) => onDateRangeChange(range ?? null)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Invoice/Composite ID</Label>
          <Input
            className="w-full h-10"
            placeholder="Search by invoice ID (e.g., 121 or 121_223)..."
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
          <Label>Customer</Label>
          <Select
            value={selectedCustomerId?.toString() || "all"}
            onValueChange={(value) => onCustomerChange(value === "all" ? null : Number(value))}
            disabled={isLoadingCustomers}
          >
            <SelectTrigger className="w-full h-10">
              <SelectValue
                placeholder={isLoadingCustomers ? "Loading customers..." : "All Customers"}
              />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="all">All Customers</SelectItem>
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
          {isLoading ? "Loading..." : "Search"}
        </Button>
        <Button variant="outline" onClick={onReset} disabled={isLoading}>
          Reset
        </Button>
        <Button variant="secondary" onClick={onLoadOutstanding} disabled={isLoading}>
          {isLoading ? "Loading..." : "Load Outstanding"}
        </Button>
      </div>
    </>
  )
}
