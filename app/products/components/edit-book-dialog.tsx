"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { ChevronsUpDown, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { CalendarIcon } from "@radix-ui/react-icons"
import { format } from "date-fns"

import type {
  Author,
  BookInterface,
  Genre,
  StatusObject,
  Language,
  Warehouse,
  PrintRun,
} from "../page"

type EditBookDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClose: () => void
  formRef: React.RefObject<HTMLFormElement> | React.MutableRefObject<HTMLFormElement | null>
  selectedBook: BookInterface | null
  setSelectedBook: (b: BookInterface) => void
  activeTab: string
  setActiveTab: (v: string) => void
  genres: Genre[]
  statusOptions: StatusObject[]
  languages: Language[]
  authors: Author[]
  translators: Author[]
  editCoverInputType: 'upload' | 'url'
  setEditCoverInputType: (v: 'upload' | 'url') => void
  printRunStatusOptions: StatusObject[]
  editBookInventory: Array<{ id?: number; product: number; warehouse: number; quantity: number; notes: string }>
  setEditBookInventory: (v: Array<{ id?: number; product: number; warehouse: number; quantity: number; notes: string }>) => void
  warehouses: Warehouse[]
  handleAddInventoryItem: () => void
  handleSaveChanges: () => void
  isSubmitting: boolean
}

export function EditBookDialog({
  open,
  onOpenChange,
  onClose,
  formRef,
  selectedBook,
  setSelectedBook,
  activeTab,
  setActiveTab,
  genres,
  statusOptions,
  languages,
  authors,
  translators,
  editCoverInputType,
  setEditCoverInputType,
  printRunStatusOptions,
  editBookInventory,
  setEditBookInventory,
  warehouses,
  handleAddInventoryItem,
  handleSaveChanges,
  isSubmitting,
}: EditBookDialogProps) {
  const [coverUrlError, setCoverUrlError] = useState<string>("")

  const validateCoverUrl = (url: string) => {
    if (!url) {
      setCoverUrlError("")
      return true
    }
    if (!url.startsWith("https://dararab.co.uk/")) {
      setCoverUrlError("URL must start with https://dararab.co.uk/")
      return false
    }
    setCoverUrlError("")
    return true
  }

  const handleOpenChange = (newOpen: boolean) => {
    // Prevent closing dialog while submitting
    if (!newOpen && isSubmitting) {
      return
    }
    onOpenChange(newOpen)
  }

  if (!selectedBook) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Book: {selectedBook.isbn}</DialogTitle>
          <DialogDescription>Update book information.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          {isSubmitting && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin border-4 border-primary border-t-transparent rounded-full" />
                <p className="text-sm text-muted-foreground">Saving changes...</p>
              </div>
            </div>
          )}
          <form
            ref={formRef}
            className="space-y-6 py-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveChanges();
            }}
          >
          <Tabs defaultValue="basic" className="w-full" value={activeTab} onValueChange={(v) => setActiveTab(v)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Information</TabsTrigger>
              <TabsTrigger value="details">Details & Pricing</TabsTrigger>
              <TabsTrigger value="inventory">Inventory & Warehouse</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="edit-isbn">ISBN</Label>
                  <Input
                    id="edit-isbn"
                    value={selectedBook.isbn}
                    onChange={(e) => setSelectedBook({ ...selectedBook, isbn: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-title_ar">Title (Arabic)</Label>
                    <Textarea
                      id="edit-title_ar"
                      value={selectedBook.title_ar}
                      onChange={(e) => setSelectedBook({ ...selectedBook, title_ar: e.target.value })}
                      rows={4}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-title_en">Title (English)</Label>
                    <Textarea
                      id="edit-title_en"
                      value={selectedBook.title_en}
                      onChange={(e) => setSelectedBook({ ...selectedBook, title_en: e.target.value })}
                      rows={4}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="edit-genre">Genre</Label>
                    <Select
                      value={selectedBook.genre?.id?.toString() || ""}
                      onValueChange={(value) => {
                        const genreObj = genres.find(g => g.id === parseInt(value));
                        setSelectedBook({
                          ...selectedBook,
                          genre: genreObj || null
                        });
                      }}
                    >
                      <SelectTrigger id="edit-genre" className="mt-1">
                        <SelectValue placeholder="Select genre" />
                      </SelectTrigger>
                      <SelectContent>
                        {genres.map((genre) => (
                          <SelectItem key={genre.id} value={genre.id.toString()}>
                            {genre.display_name_en}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="edit-status">Product Status</Label>
                    <Select
                      value={selectedBook.status?.id?.toString() || ""}
                      onValueChange={(value) => {
                        const statusObj = statusOptions.find(s => s.id === parseInt(value));
                        setSelectedBook({
                          ...selectedBook,
                          status: statusObj || null
                        });
                      }}
                    >
                      <SelectTrigger id="edit-status" className="mt-1">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((status) => (
                          <SelectItem key={status.id} value={status.id.toString()}>
                            {status.display_name_en}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="edit-language">Language</Label>
                    <Select
                      value={selectedBook.language?.id?.toString() || ""}
                      onValueChange={(value) => {
                        const languageObj = languages.find(l => l.id === parseInt(value));
                        setSelectedBook({
                          ...selectedBook,
                          language: languageObj || null
                        });
                      }}
                    >
                      <SelectTrigger id="edit-language" className="mt-1">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        {languages.map((language) => (
                          <SelectItem key={language.id} value={language.id.toString()}>
                            {language.display_name_en}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="edit-is_direct_product">Product Type</Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Input type="checkbox" id="edit-is_direct_product" checked={selectedBook.is_direct_product} onChange={(e) => setSelectedBook({ ...selectedBook, is_direct_product: e.target.checked })} />
                      <Label htmlFor="edit-is_direct_product" className="text-sm">
                        Direct Product
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-authors">Authors</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between mt-1">
                          {selectedBook.author ? selectedBook.author.name : "Select author..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0">
                        <Command>
                          <CommandInput placeholder="Search authors..." />
                          <CommandList>
                            <CommandEmpty>No author found.</CommandEmpty>
                            <CommandGroup>
                              {authors.map((author) => (
                                <CommandItem
                                  key={author.id}
                                  value={author.name}
                                  onSelect={() => {
                                    setSelectedBook({
                                      ...selectedBook,
                                      author: author
                                    });
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedBook.author?.id === author.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {author.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label htmlFor="edit-translators">Translators</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between mt-1">
                          {selectedBook.translator ? selectedBook.translator.name : "Select translator..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0">
                        <Command>
                          <CommandInput placeholder="Search translators..." />
                          <CommandList>
                            <CommandEmpty>No translator found.</CommandEmpty>
                            <CommandGroup>
                              {translators.map((translator) => (
                                <CommandItem
                                  key={translator.id}
                                  value={translator.name}
                                  onSelect={() => {
                                    setSelectedBook({
                                      ...selectedBook,
                                      translator: translator
                                    });
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedBook.translator?.id === translator.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {translator.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div>
                  <Label>Book Cover Image</Label>
                  <div className="flex gap-2 mb-3">
                    <Button
                      type="button"
                      variant={editCoverInputType === 'upload' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setEditCoverInputType('upload')}
                    >
                      Upload File
                    </Button>
                    <Button
                      type="button"
                      variant={editCoverInputType === 'url' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setEditCoverInputType('url')}
                    >
                      External URL
                    </Button>
                  </div>

                  <div className="border rounded-md p-4 bg-muted/30 mt-1">
                    <div className="aspect-square rounded-md overflow-hidden mb-2 w-24 h-24 mx-auto">
                      <img
                        src={editCoverInputType === 'upload' 
                          ? (selectedBook.cover_image as string) || ''
                          : (selectedBook.cover_url as string) || ''
                        }
                        alt={`Book ${selectedBook.isbn}`}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const img = e.currentTarget as HTMLImageElement;
                          img.src = "/placeholder.svg";
                        }}
                      />
                    </div>
                    
                    {editCoverInputType === 'upload' ? (
                      <div className="flex justify-center">
                        <input
                          type="file"
                          id="edit-cover-image"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setSelectedBook({
                                  ...selectedBook,
                                  cover_image: reader.result as string,
                                  cover_url: null
                                });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            document.getElementById('edit-cover-image')?.click();
                          }}
                        >
                          {selectedBook.cover_image ? 'Change Image' : 'Upload Image'}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Input
                          type="url"
                          placeholder="Enter image URL (must start with https://dararab.co.uk/)"
                          value={selectedBook.cover_url || ''}
                          onChange={(e) => {
                            const url = e.target.value
                            validateCoverUrl(url)
                            setSelectedBook({
                              ...selectedBook,
                              cover_url: url,
                              cover_image: null
                            });
                          }}
                          onPaste={(e) => {
                            const pastedUrl = e.clipboardData.getData("text")
                            setTimeout(() => {
                              validateCoverUrl(pastedUrl)
                            }, 0)
                          }}
                          className={coverUrlError ? "border-red-500" : ""}
                        />
                        {coverUrlError && (
                          <p className="text-sm text-red-500">{coverUrlError}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="details" className="space-y-4 pt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Print Runs</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newEdition: PrintRun = {
                        product: selectedBook.id || 0,
                        edition_number: selectedBook.print_runs.length + 1,
                        price: 0,
                        print_cost: 0,
                        status: null,
                        notes: ""
                      };
                      setSelectedBook({
                        ...selectedBook,
                        print_runs: [...selectedBook.print_runs, newEdition]
                      });
                    }}
                  >
                    Add New Print Run
                  </Button>
                </div>

                <div className="border rounded-md">
                  <div className="bg-muted p-4 flex justify-between items-center">
                    <h3 className="font-medium">Print Run Details</h3>
                  </div>
                  <div className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="text-sm border-b">
                            <th className="text-left font-medium p-3">Print Run Number</th>
                            <th className="text-left font-medium p-3">Price ($)</th>
                            <th className="text-left font-medium p-3">Print Cost ($)</th>
                            <th className="text-left font-medium p-3">Status</th>
                            <th className="text-left font-medium p-3">Published Date</th>
                            <th className="text-right font-medium p-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {!selectedBook ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center">
                                <div className="flex flex-col items-center">
                                  <p className="text-muted-foreground">No book selected</p>
                                </div>
                              </td>
                            </tr>
                          ) : !selectedBook.print_runs || selectedBook.print_runs.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center">
                                <div className="flex flex-col items-center">
                                  <p className="text-muted-foreground mb-4">No Print Runs available.</p>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                      const newEdition: PrintRun = {
                                        product: selectedBook.id || 0,
                                        edition_number: 1,
                                        price: 0,
                                        print_cost: 0,
                                        status: null,
                                        notes: ""
                                      };
                                      setSelectedBook({
                                        ...selectedBook,
                                        print_runs: [newEdition]
                                      });
                                    }}
                                  >
                                    Create New Print Run
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            selectedBook.print_runs.map((printRun, index) => (
                              <tr key={index} className="border-b last:border-0 hover:bg-muted/50">
                                <td className="p-3">
                                  <span className="font-medium">Print Run {printRun.edition_number}</span>
                                </td>
                                <td className="p-3">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={printRun.price}
                                    onChange={(e) => {
                                      const updatedPrintRuns = [...selectedBook.print_runs];
                                      updatedPrintRuns[index] = {
                                        ...printRun,
                                        price: parseFloat(e.target.value) || 0
                                      };
                                      setSelectedBook({
                                        ...selectedBook,
                                        print_runs: updatedPrintRuns
                                      });
                                    }}
                                    className="w-[100px]"
                                  />
                                </td>
                                <td className="p-3">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={printRun.print_cost}
                                    onChange={(e) => {
                                      const updatedPrintRuns = [...selectedBook.print_runs];
                                      updatedPrintRuns[index] = {
                                        ...printRun,
                                        print_cost: parseFloat(e.target.value) || 0
                                      };
                                      setSelectedBook({
                                        ...selectedBook,
                                        print_runs: updatedPrintRuns
                                      });
                                    }}
                                    className="w-[100px]"
                                  />
                                </td>
                                <td className="p-3">
                                  <Select
                                    value={printRun.status?.id?.toString() || ""}
                                    onValueChange={(value) => {
                                      const statusObj = printRunStatusOptions.find(s => s.id === parseInt(value));
                                      const updatedPrintRuns = [...selectedBook.print_runs];
                                      updatedPrintRuns[index] = {
                                        ...printRun,
                                        status: statusObj || null
                                      };
                                      setSelectedBook({
                                        ...selectedBook,
                                        print_runs: updatedPrintRuns
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="w-[150px]">
                                      <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {printRunStatusOptions.map((status) => (
                                        <SelectItem key={status.id} value={status.id.toString()}>
                                          {status.display_name_en}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="p-3">
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="outline" className="w-[150px] justify-start text-left font-normal">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {printRun.published_at ? format(new Date(printRun.published_at), "PPP") : "Select date"}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                      <CalendarComponent
                                        mode="single"
                                        selected={printRun.published_at ? new Date(printRun.published_at) : undefined}
                                        onSelect={(date) => {
                                          const updatedPrintRuns = [...selectedBook.print_runs];
                                          updatedPrintRuns[index] = {
                                            ...printRun,
                                            published_at: date ? format(date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")
                                          };
                                          setSelectedBook({
                                            ...selectedBook,
                                            print_runs: updatedPrintRuns
                                          });
                                        }}
                                        initialFocus
                                      />
                                    </PopoverContent>
                                  </Popover>
                                </td>
                                <td className="p-3 text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      const updatedPrintRuns = [...selectedBook.print_runs];
                                      updatedPrintRuns.splice(index, 1);
                                      setSelectedBook({
                                        ...selectedBook,
                                        print_runs: updatedPrintRuns
                                      });
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="inventory" className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Warehouse Inventory</h3>
                <Button type="button" variant="outline" size="sm" onClick={handleAddInventoryItem}>
                  Add Row
                </Button>
              </div>

              <div className="border rounded-md">
                <div className="bg-muted p-4 flex justify-between items-center">
                  <h3 className="font-medium">Inventory</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-sm border-b">
                        <th className="text-left font-medium p-3">Warehouse</th>
                        <th className="text-left font-medium p-3">Quantity</th>
                        <th className="text-right font-medium p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editBookInventory.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-8 text-center">
                            <p className="text-muted-foreground">No inventory rows yet.</p>
                          </td>
                        </tr>
                      ) : (
                        editBookInventory.map((item, index) => (
                          <tr key={index} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="p-3">
                              <Select
                                value={item.warehouse.toString()}
                                onValueChange={(value) => {
                                  const arr = [...editBookInventory]
                                  arr[index].warehouse = parseInt(value)
                                  setEditBookInventory(arr)
                                }}
                              >
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
                            </td>
                            <td className="p-3">
                              <Input
                                type="number"
                                min={0}
                                value={item.quantity}
                                onChange={(e) => {
                                  const arr = [...editBookInventory]
                                  arr[index].quantity = parseInt(e.target.value) || 0
                                  setEditBookInventory(arr)
                                }}
                                className="w-[100px]"
                              />
                            </td>
                            <td className="p-3 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const arr = editBookInventory.filter((_, i) => i !== index)
                                  setEditBookInventory(arr)
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveChanges} disabled={isSubmitting}>
              {isSubmitting && <span className="mr-2 inline-block h-4 w-4 animate-spin border-2 border-current border-t-transparent rounded-full" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}


