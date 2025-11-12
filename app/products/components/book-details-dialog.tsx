"use client"

import { format } from "date-fns"
import { Edit, MoveRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

import type { BookInterface, Genre, Inventory, Language, Status } from "../page"

type BookDetailsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedBook: BookInterface | null
  selectedBookInventory: Inventory[]
  getImageUrl: (url: string | null) => string
  getGenreName: (genre: Genre | number | null) => string
  getLanguageName: (language: Language | number | null) => string
  getStatusName: (status: Status | number | null) => string
  onClose: () => void
  onEdit: (book: BookInterface) => void
  onTransfer: (book: BookInterface) => void
}

export function BookDetailsDialog({
  open,
  onOpenChange,
  selectedBook,
  selectedBookInventory,
  getImageUrl,
  getGenreName,
  getLanguageName,
  getStatusName,
  onClose,
  onEdit,
  onTransfer,
}: BookDetailsDialogProps) {
  if (!selectedBook) {
    return null
  }

  const statusClassName =
    selectedBook.status?.id === 17
      ? "bg-green-100 text-green-800 hover:bg-green-100 border-green-200"
      : selectedBook.status?.id === 2
        ? "bg-red-100 text-red-800 hover:bg-red-100 border-red-200"
        : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200"

  const getPrintRunStatusClass = (statusId?: number) => {
    if (statusId === 41) {
      return "bg-green-100 text-green-800 hover:bg-green-100 border-green-200"
    }
    if (statusId === 2) {
      return "bg-red-100 text-red-800 hover:bg-red-100 border-red-200"
    }
    return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200"
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book Details: {selectedBook.isbn}</DialogTitle>
          <DialogDescription>Book details and warehouse inventory</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          <div className="space-y-4">
            <div className="aspect-square rounded-lg overflow-hidden border bg-muted">
              <img
                src={getImageUrl(selectedBook.cover_design)}
                alt={`Book ${selectedBook.isbn}`}
                className="w-full h-full object-contain"
                onError={(e) => {
                  const img = e.currentTarget
                  img.src = "/placeholder.svg"
                }}
              />
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2">Book Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">ISBN</p>
                  <p className="font-mono">{selectedBook.isbn}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Genre</p>
                  <Badge variant="outline" className="mt-1">
                    {selectedBook.genre !== null ? getGenreName(selectedBook.genre) : "Unknown"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Language</p>
                  <Badge variant="outline" className="mt-1">
                    {selectedBook.language !== null ? getLanguageName(selectedBook.language) : "Unknown"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <Badge className={statusClassName}>
                      {selectedBook.status !== null ? getStatusName(selectedBook.status) : "Unknown"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Published Date</p>
                  <p className="font-medium">
                    {selectedBook.print_runs?.[0]?.published_at
                      ? format(new Date(selectedBook.print_runs[0].published_at), "MMM dd, yyyy")
                      : "Not set"}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2">Authors & Translators</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Authors</p>
                  <p className="whitespace-pre-line">{selectedBook.author?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Translators</p>
                  <p className="whitespace-pre-line">{selectedBook.translator?.name}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2">Warehouse Inventory</h3>
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4">Warehouse Inventory</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedBookInventory.length > 0 ? (
                    selectedBookInventory.map((inv) => (
                      <div
                        key={inv.id}
                        className={`border rounded-lg p-4 ${
                          inv.quantity > 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium">{inv.warehouse_name}</h4>
                          <Badge
                            variant={inv.quantity > 0 ? "default" : "outline"}
                            className={
                              inv.quantity > 0
                                ? "bg-green-100 text-green-800 hover:bg-green-100 border-green-200"
                                : "text-red-600 border-red-200"
                            }
                          >
                            {inv.quantity > 0 ? `${inv.quantity} in stock` : "Out of stock"}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-4 text-muted-foreground">
                      No inventory records found for this book.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-medium mb-4">Print Runs</h3>
              <div className="border rounded-md">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-sm border-b">
                        <th className="text-left font-medium p-3">Print Run Number</th>
                        <th className="text-left font-medium p-3">Price ($)</th>
                        <th className="text-left font-medium p-3">Print Cost ($)</th>
                        <th className="text-left font-medium p-3">Status</th>
                        <th className="text-left font-medium p-3">Published Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBook.print_runs && selectedBook.print_runs.length > 0 ? (
                        selectedBook.print_runs.map((printRun, index) => (
                          <tr key={index} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="p-3">
                              <span className="font-medium">Print Run {printRun.edition_number}</span>
                            </td>
                            <td className="p-3">
                              <span className="font-medium">${printRun.price}</span>
                            </td>
                            <td className="p-3">
                              <span className="font-medium">${printRun.print_cost}</span>
                            </td>
                            <td className="p-3">
                              <Badge className={getPrintRunStatusClass(printRun.status?.id)}>
                                {printRun.status?.display_name_en || "Not set"}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <span className="font-medium">
                                {printRun.published_at
                                  ? format(new Date(printRun.published_at), "MMM dd, yyyy")
                                  : "Not set"}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center">
                            <div className="flex flex-col items-center">
                              <p className="text-muted-foreground">No Print Runs available for this book.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button
                onClick={() => {
                  onClose()
                  onEdit(selectedBook)
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Book
              </Button>
              <Button
                onClick={() => {
                  onClose()
                  onTransfer(selectedBook)
                }}
              >
                <MoveRight className="h-4 w-4 mr-2" />
                Transfer
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

