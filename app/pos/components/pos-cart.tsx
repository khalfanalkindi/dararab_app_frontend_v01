"use client"

import type { ReactNode } from "react"
import {
  ShoppingCart,
  UserPlus,
  Plus,
  Minus,
  Trash2,
  Loader2,
  ChevronsUpDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type {
  CartItem,
  Customer,
  CustomerType,
  DialogType,
  NewCustomerForm,
  PaymentMethod,
} from "./types"

type PosCartProps = {
  isCartOpen: boolean
  onCartOpenChange: (open: boolean) => void
  cart: CartItem[]
  selectedCustomer: Customer | null
  filteredCustomers: Customer[]
  customerSearchOpen: boolean
  onCustomerSearchOpenChange: (open: boolean) => void
  customerSearchQuery: string
  onCustomerSearchQueryChange: (query: string) => void
  onSelectCustomer: (customer: Customer) => void
  activeDialog: DialogType
  onActiveDialogChange: (dialog: DialogType) => void
  newCustomer: NewCustomerForm
  onNewCustomerChange: (customer: NewCustomerForm) => void
  customerTypes: CustomerType[]
  isAddingCustomer: boolean
  onAddCustomer: () => void
  selectedPaymentMethod: number | null
  paymentMethods: PaymentMethod[]
  isIndividualCustomer: boolean
  onApplyPaymentMethodToExistingItems: () => void
  processingItems: Set<number>
  isStoreCustomer: boolean
  discountPercentage: number
  onUpdateItemPaymentStatus: (productId: number, isPaid: boolean) => void
  onUpdateQuantity: (productId: number, quantity: number) => void
  onQuantityInputChange: (productId: number, rawValue: string) => void
  onQuantityBlur: (productId: number, rawValue: string) => void
  onRemoveFromCart: (productId: number) => void
  onUpdateItemDiscount: (productId: number, discountPercent: number) => void
  onUpdateItemPaidAmount: (productId: number, paidAmount: number) => void
  getAvailableStock: (product: CartItem["product"]) => number
  getDisplayPrice: (product: CartItem["product"]) => string | null
  getCurrencyLabel: () => string
  calculateItemTotal: (item: CartItem) => number
  getLineTotalForDisplay: (item: CartItem) => number
  usdToDisplayForLine: (usdAmount: number, item: CartItem) => number
  displayToUsdForLine: (displayAmount: number, item: CartItem) => number
  formatMoney: (amount: number) => string
  renderPaymentStatusBadge: (item: CartItem) => ReactNode
  paymentsSection: ReactNode
}

export function PosCart({
  isCartOpen,
  onCartOpenChange,
  cart,
  selectedCustomer,
  filteredCustomers,
  customerSearchOpen,
  onCustomerSearchOpenChange,
  customerSearchQuery,
  onCustomerSearchQueryChange,
  onSelectCustomer,
  activeDialog,
  onActiveDialogChange,
  newCustomer,
  onNewCustomerChange,
  customerTypes,
  isAddingCustomer,
  onAddCustomer,
  selectedPaymentMethod,
  paymentMethods,
  isIndividualCustomer,
  onApplyPaymentMethodToExistingItems,
  processingItems,
  isStoreCustomer,
  discountPercentage,
  onUpdateItemPaymentStatus,
  onUpdateQuantity,
  onQuantityInputChange,
  onQuantityBlur,
  onRemoveFromCart,
  onUpdateItemDiscount,
  onUpdateItemPaidAmount,
  getAvailableStock,
  getDisplayPrice,
  getCurrencyLabel,
  calculateItemTotal,
  getLineTotalForDisplay,
  usdToDisplayForLine,
  displayToUsdForLine,
  formatMoney,
  renderPaymentStatusBadge,
  paymentsSection,
}: PosCartProps) {
  return (
    <Sheet open={isCartOpen} onOpenChange={onCartOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" className="relative">
          <ShoppingCart className="h-4 w-4 mr-2" />
          Cart
          {cart.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs">
              {cart.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] h-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Cart ({cart.length})</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label>Customer</Label>
            <div className="flex gap-2">
              <Popover open={customerSearchOpen} onOpenChange={onCustomerSearchOpenChange}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerSearchOpen}
                    className="w-full justify-between"
                  >
                    {selectedCustomer ? selectedCustomer.institution_name : "Search customer..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search customer..."
                      value={customerSearchQuery}
                      onValueChange={onCustomerSearchQueryChange}
                    />
                    <CommandList>
                      <CommandEmpty>No customer found.</CommandEmpty>
                      <CommandGroup>
                        {filteredCustomers.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={customer.institution_name}
                            onSelect={() => {
                              onSelectCustomer(customer)
                              onCustomerSearchOpenChange(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedCustomer?.id === customer.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <div>
                              <p>{customer.institution_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {customer.contact_person || customer.phone}
                              </p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Dialog
                open={activeDialog === "newCustomer"}
                onOpenChange={(open) => onActiveDialogChange(open ? "newCustomer" : null)}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Customer</DialogTitle>
                    <DialogDescription>
                      Enter the customer details below to add them to your system.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="customer_type">Customer Type</Label>
                      <Select
                        value={newCustomer.customer_type?.toString() || ""}
                        onValueChange={(value) =>
                          onNewCustomerChange({
                            ...newCustomer,
                            customer_type: value ? Number(value) : null,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer type" />
                        </SelectTrigger>
                        <SelectContent>
                          {customerTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id.toString()}>
                              {type.display_name_en || type.name_en}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="institution_name">Institution Name</Label>
                      <Input
                        id="institution_name"
                        value={newCustomer.institution_name}
                        onChange={(e) =>
                          onNewCustomerChange({ ...newCustomer, institution_name: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="contact_person">Contact Person</Label>
                      <Input
                        id="contact_person"
                        value={newCustomer.contact_person}
                        onChange={(e) =>
                          onNewCustomerChange({ ...newCustomer, contact_person: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={newCustomer.phone}
                        onChange={(e) => onNewCustomerChange({ ...newCustomer, phone: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newCustomer.email}
                        onChange={(e) => onNewCustomerChange({ ...newCustomer, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => onActiveDialogChange(null)}>
                      Cancel
                    </Button>
                    <Button onClick={onAddCustomer} disabled={isAddingCustomer}>
                      {isAddingCustomer ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        "Add Customer"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Items</Label>
            {(selectedPaymentMethod || isIndividualCustomer) && (
              <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                <div className="flex items-center justify-between">
                  <div>
                    {isIndividualCustomer ? (
                      <>
                        <strong>Payment Method:</strong> Cash - Items will be marked as paid by default
                      </>
                    ) : (
                      <>
                        <strong>Payment Method:</strong>{" "}
                        {paymentMethods.find((m) => m.id === selectedPaymentMethod)?.display_name_en}
                        {paymentMethods
                          .find((m) => m.id === selectedPaymentMethod)
                          ?.display_name_en.toLowerCase()
                          .includes("outstanding")
                          ? " - Items will be marked as unpaid by default"
                          : " - Items will be marked as paid by default"}
                      </>
                    )}
                  </div>
                  {cart.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onApplyPaymentMethodToExistingItems}
                      className="h-6 text-xs"
                    >
                      Apply to All Items
                    </Button>
                  )}
                </div>
              </div>
            )}
            <div className="border rounded-md p-4 space-y-4 max-h-[300px] overflow-y-auto">
              {cart.length === 0 ? (
                <p className="text-center text-muted-foreground">No items in cart</p>
              ) : (
                cart.map((item) => {
                  const lineTotal = calculateItemTotal(item)
                  const lineTotalDisplay = getLineTotalForDisplay(item)
                  const paidAmountDisplay = usdToDisplayForLine(item.paid_amount, item)
                  const remainingAmountDisplay = Math.max(0, lineTotalDisplay - paidAmountDisplay)
                  const difference = Math.abs(item.paid_amount - lineTotal)
                  const isFullyPaid = difference < 0.001 || item.paid_amount >= lineTotal
                  const isPartiallyPaid = item.paid_amount > 0.001 && !isFullyPaid

                  return (
                    <div
                      key={item.product.id}
                      className={`space-y-2 p-3 rounded-lg border relative ${
                        isFullyPaid
                          ? "bg-green-50 border-green-200"
                          : isPartiallyPaid
                            ? "bg-orange-50 border-orange-200"
                            : "bg-white border-gray-200"
                      } ${processingItems.has(item.product.id) ? "opacity-60" : ""}`}
                    >
                      {processingItems.has(item.product.id) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg z-10">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <Checkbox
                            checked={item.is_paid}
                            onChange={(e) => onUpdateItemPaymentStatus(item.product.id, e.target.checked)}
                            disabled={isIndividualCustomer}
                            className="shrink-0"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{item.product.title_en}</h4>
                              {renderPaymentStatusBadge(item)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {(() => {
                                const displayPrice = getDisplayPrice(item.product)
                                return displayPrice
                                  ? `${parseFloat(displayPrice).toFixed(3)} ${getCurrencyLabel()}`
                                  : "N/A"
                              })()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onUpdateQuantity(item.product.id, Number(item.quantity) - 1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(e) => onQuantityInputChange(item.product.id, e.target.value)}
                            onBlur={(e) => onQuantityBlur(item.product.id, e.target.value)}
                            className="h-8 w-16 text-center"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={item.quantity >= getAvailableStock(item.product)}
                            onClick={() => onUpdateQuantity(item.product.id, Number(item.quantity) + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemoveFromCart(item.product.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Label className="text-xs">
                          Item Discount{isStoreCustomer ? "" : " (store only)"}:
                        </Label>
                        <Select
                          value={item.discount_percent.toString()}
                          onValueChange={(value) => onUpdateItemDiscount(item.product.id, Number(value))}
                          disabled={!isStoreCustomer || discountPercentage > 0}
                        >
                          <SelectTrigger
                            className={cn(
                              "h-7 text-xs",
                              (!isStoreCustomer || discountPercentage > 0) && "bg-muted cursor-not-allowed",
                            )}
                          >
                            <SelectValue placeholder="0%" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0%</SelectItem>
                            <SelectItem value="5">5%</SelectItem>
                            <SelectItem value="10">10%</SelectItem>
                            <SelectItem value="15">15%</SelectItem>
                            <SelectItem value="20">20%</SelectItem>
                            <SelectItem value="25">25%</SelectItem>
                            <SelectItem value="30">30%</SelectItem>
                            <SelectItem value="40">40%</SelectItem>
                            <SelectItem value="50">50%</SelectItem>
                            <SelectItem value="60">60%</SelectItem>
                            <SelectItem value="75">75%</SelectItem>
                            <SelectItem value="80">80%</SelectItem>
                            <SelectItem value="90">90%</SelectItem>
                            <SelectItem value="100">100%</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-xs ml-auto">Total: {formatMoney(lineTotalDisplay)}</span>
                      </div>

                      {item.is_paid && (
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <Label className="text-xs">Paid Amount:</Label>
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            max={lineTotalDisplay}
                            value={paidAmountDisplay}
                            onChange={(e) =>
                              onUpdateItemPaidAmount(
                                item.product.id,
                                displayToUsdForLine(parseFloat(e.target.value) || 0, item),
                              )
                            }
                            className="h-7 text-xs w-24"
                            placeholder="0.000"
                          />
                          <span className="text-xs text-muted-foreground">
                            {remainingAmountDisplay > 0
                              ? `Remaining: ${formatMoney(remainingAmountDisplay)}`
                              : "Fully Paid"}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {paymentsSection}
        </div>
      </SheetContent>
    </Sheet>
  )
}
