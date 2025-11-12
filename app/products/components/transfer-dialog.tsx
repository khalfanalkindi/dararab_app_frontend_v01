"use client"

import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar as CalendarIcon, MoveRight } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"

import type { BookInterface, Transfer, Warehouse } from "../page"

type TransferDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClose: () => void
  selectedBook: BookInterface | null
  warehouses: Warehouse[]
  transfer: Partial<Transfer>
  setTransfer: (t: Partial<Transfer>) => void
  onSubmit: () => void
  isLoading: boolean
}

export function TransferDialog({
  open,
  onOpenChange,
  onClose,
  selectedBook,
  warehouses,
  transfer,
  setTransfer,
  onSubmit,
  isLoading,
}: TransferDialogProps) {
  if (!selectedBook) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Transfer Book: {selectedBook.isbn}</DialogTitle>
          <DialogDescription>Move books between warehouses</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="from_warehouse">From Warehouse</Label>
              <Select
                value={transfer.from_warehouse?.toString() || ""}
                onValueChange={(value) => setTransfer({ ...transfer, from_warehouse: Number.parseInt(value) })}
              >
                <SelectTrigger id="from_warehouse" className="mt-1">
                  <SelectValue placeholder="Select source warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                      {warehouse.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-center">
              <MoveRight className="h-6 w-6 text-muted-foreground" />
            </div>

            <div>
              <Label htmlFor="to_warehouse">To Warehouse</Label>
              <Select
                value={transfer.to_warehouse?.toString() || ""}
                onValueChange={(value) => setTransfer({ ...transfer, to_warehouse: Number.parseInt(value) })}
              >
                <SelectTrigger id="to_warehouse" className="mt-1">
                  <SelectValue placeholder="Select destination warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                      {warehouse.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={transfer.quantity || ""}
                onChange={(e) => setTransfer({ ...transfer, quantity: Number.parseInt(e.target.value) })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="shipping_cost">Shipping Cost ($)</Label>
              <Input
                id="shipping_cost"
                type="number"
                step="0.01"
                min="0"
                value={transfer.shipping_cost || ""}
                onChange={(e) => setTransfer({ ...transfer, shipping_cost: Number.parseFloat(e.target.value) })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="transfer_date">Transfer Date</Label>
              <div className="mt-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={"outline"} className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {transfer.transfer_date ? format(new Date(transfer.transfer_date), "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={transfer.transfer_date ? new Date(transfer.transfer_date) : undefined}
                      onSelect={(date) =>
                        setTransfer({
                          ...transfer,
                          transfer_date: date
                            ? format(date, "yyyy-MM-dd'T'HH:mm:ss")
                            : format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
                        })
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isLoading}>
            {isLoading && <span className="mr-2 inline-block h-4 w-4 animate-spin border-2 border-current border-t-transparent rounded-full" />}
            Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


