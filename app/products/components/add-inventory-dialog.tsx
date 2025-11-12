"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X } from "lucide-react"

import type { BookInterface, InventoryItem, Warehouse } from "../page"

type AddInventoryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClose: () => void
  isAddBookOpen: boolean
  selectedBook: BookInterface | null
  warehouses: Warehouse[]
  items: InventoryItem[]
  setItems: (items: InventoryItem[]) => void
  onSubmit: () => void
  isSubmitting: boolean
}

export function AddInventoryDialog({
  open,
  onOpenChange,
  onClose,
  isAddBookOpen,
  selectedBook,
  warehouses,
  items,
  setItems,
  onSubmit,
  isSubmitting,
}: AddInventoryDialogProps) {
  const addRow = () => {
    if (warehouses.length > 0) {
      setItems([...items, { warehouse: warehouses[0].id, quantity: 0 }])
    }
  }

  const setWarehouseAt = (index: number, value: string) => {
    const updated = [...items]
    updated[index] = { ...updated[index], warehouse: parseInt(value, 10) }
    setItems(updated)
  }

  const setQuantityAt = (index: number, value: string) => {
    const updated = [...items]
    updated[index] = { ...updated[index], quantity: parseInt(value, 10) || 0 }
    setItems(updated)
  }

  const removeAt = (index: number) => {
    const updated = [...items]
    updated.splice(index, 1)
    setItems(updated)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Inventory</DialogTitle>
          <DialogDescription>
            {isAddBookOpen ? "Add inventory for the new book" : `Add inventory for ${selectedBook?.isbn || ""}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-4">
            {items.length === 0 ? (
              <div className="text-center py-8 border rounded-lg bg-muted/30">
                <p className="text-muted-foreground mb-4">No inventory items added yet.</p>
                <Button type="button" variant="outline" onClick={addRow}>
                  Add Warehouse
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <Select value={item.warehouse.toString()} onValueChange={(v) => setWarehouseAt(index, v)}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select warehouse" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((w) => (
                          <SelectItem key={w.id} value={w.id.toString()}>
                            {w.name_en}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0"
                      value={item.quantity}
                      onChange={(e) => setQuantityAt(index, e.target.value)}
                      className="w-[100px]"
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeAt(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Button type="button" variant="outline" className="w-full" onClick={addRow}>
              Add Warehouse
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={onSubmit} disabled={isSubmitting || items.length === 0}>
            {isSubmitting && <span className="mr-2 inline-block h-4 w-4 animate-spin border-2 border-current border-t-transparent rounded-full" />}
            Add Inventory
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


