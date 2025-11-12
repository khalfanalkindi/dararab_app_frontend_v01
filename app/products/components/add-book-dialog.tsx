"use client"

import { useMemo, useState, type ChangeEvent, type FormEvent, type MutableRefObject } from "react"

import { Check, ChevronsUpDown, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

import type {
  Author,
  BookInterface,
  Genre,
  InventoryItem,
  Language,
  Reviewer,
  RightsOwner,
  StatusObject,
  Translator,
  Warehouse,
} from "../page"

type AddBookDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClose: () => void
  formRef: React.RefObject<HTMLFormElement> | MutableRefObject<HTMLFormElement | null>
  onSubmit: () => void
  newBook: BookInterface
  setNewBook: React.Dispatch<React.SetStateAction<BookInterface>>
  coverInputType: "upload" | "url"
  setCoverInputType: React.Dispatch<React.SetStateAction<"upload" | "url">>
  genres: Genre[]
  statusOptions: StatusObject[]
  languages: Language[]
  authors: Author[]
  translators: Translator[]
  rightsOwners: RightsOwner[]
  reviewers: Reviewer[]
  warehouses: Warehouse[]
  newBookInventory: InventoryItem[]
  setNewBookInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>
  getImageUrl: (url: string | null) => string
  isSubmitting: boolean
}

export function AddBookDialog({
  open,
  onOpenChange,
  onClose,
  formRef,
  onSubmit,
  newBook,
  setNewBook,
  coverInputType,
  setCoverInputType,
  genres,
  statusOptions,
  languages,
  authors,
  translators,
  rightsOwners,
  reviewers,
  warehouses,
  newBookInventory,
  setNewBookInventory,
  getImageUrl,
  isSubmitting,
}: AddBookDialogProps) {
  const [coverUrlError, setCoverUrlError] = useState<string>("")

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (coverInputType === "url" && newBook.cover_url) {
      if (!newBook.cover_url.startsWith("https://dararab.co.uk/")) {
        setCoverUrlError("URL must start with https://dararab.co.uk/")
        return
      }
    }
    setCoverUrlError("")
    onSubmit()
  }

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

  const defaultWarehouseId = useMemo(() => warehouses[0]?.id ?? 0, [warehouses])

  const handleInventoryWarehouseChange = (index: number, value: string) => {
    const updatedInventory = [...newBookInventory]
    updatedInventory[index] = {
      ...updatedInventory[index],
      warehouse: parseInt(value, 10),
    }
    setNewBookInventory(updatedInventory)
  }

  const handleInventoryQuantityChange = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const updatedInventory = [...newBookInventory]
    updatedInventory[index] = {
      ...updatedInventory[index],
      quantity: parseInt(event.target.value, 10) || 0,
    }
    setNewBookInventory(updatedInventory)
  }

  const handleRemoveInventoryItem = (index: number) => {
    const updatedInventory = [...newBookInventory]
    updatedInventory.splice(index, 1)
    setNewBookInventory(updatedInventory)
  }

  const handleAddInventoryRow = () => {
    setNewBookInventory((prev) => [
      ...prev,
      {
        warehouse: defaultWarehouseId,
        quantity: 0,
      },
    ])
  }

  const handleOpenChange = (newOpen: boolean) => {
    // Prevent closing dialog while submitting
    if (!newOpen && isSubmitting) {
      return
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Book</DialogTitle>
          <DialogDescription>Create a new book for your inventory.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          {isSubmitting && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin border-4 border-primary border-t-transparent rounded-full" />
                <p className="text-sm text-muted-foreground">Saving book...</p>
              </div>
            </div>
          )}
          <form ref={formRef} className="space-y-6 py-4" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="isbn">ISBN</Label>
                <Input
                  id="isbn"
                  value={newBook.isbn || ""}
                  onChange={(e) => setNewBook({ ...newBook, isbn: e.target.value })}
                  placeholder="Enter ISBN"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title_ar">Title (Arabic)</Label>
                  <Textarea
                    id="title_ar"
                    value={newBook.title_ar || ""}
                    onChange={(e) => setNewBook({ ...newBook, title_ar: e.target.value })}
                    placeholder="Enter title in Arabic"
                    rows={4}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="title_en">Title (English)</Label>
                  <Textarea
                    id="title_en"
                    value={newBook.title_en || ""}
                    onChange={(e) => setNewBook({ ...newBook, title_en: e.target.value })}
                    placeholder="Enter title in English"
                    rows={4}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="genre">Genre</Label>
                  <Select
                    value={newBook.genre?.id?.toString() || ""}
                    onValueChange={(value) => {
                      const genreObj = genres.find((g) => g.id === parseInt(value, 10))
                      setNewBook({ ...newBook, genre: genreObj || null })
                    }}
                  >
                    <SelectTrigger id="genre" className="mt-1">
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
                  <Label htmlFor="status">Product Status</Label>
                  <Select
                    value={newBook.status?.id?.toString() || ""}
                    onValueChange={(value) => {
                      const statusObj = statusOptions.find((s) => s.id === parseInt(value, 10))
                      setNewBook({ ...newBook, status: statusObj || null })
                    }}
                  >
                    <SelectTrigger id="status" className="mt-1">
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
                  <Label htmlFor="language">Language</Label>
                  <Select
                    value={newBook.language?.id?.toString() || ""}
                    onValueChange={(value) => {
                      const languageObj = languages.find((l) => l.id === parseInt(value, 10))
                      setNewBook({ ...newBook, language: languageObj || null })
                    }}
                  >
                    <SelectTrigger id="language" className="mt-1">
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
                  <Label htmlFor="is_direct_product">Product Type</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Switch
                      id="is_direct_product"
                      checked={newBook.is_direct_product}
                      onCheckedChange={(checked) =>
                        setNewBook({ ...newBook, is_direct_product: checked })
                      }
                    />
                    <Label htmlFor="is_direct_product" className="text-sm">
                      Direct Product
                    </Label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="authors">Authors</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between mt-1">
                        {newBook.author ? newBook.author.name : "Select author..."}
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
                                  setNewBook({ ...newBook, author })
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    newBook.author?.id === author.id ? "opacity-100" : "opacity-0",
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
                  <Label htmlFor="translators">Translators</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between mt-1">
                        {newBook.translator ? newBook.translator.name : "Select translator..."}
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
                                  setNewBook({ ...newBook, translator })
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    newBook.translator?.id === translator.id ? "opacity-100" : "opacity-0",
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rights-owner">Rights Owner</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between mt-1">
                        {newBook.rights_owner ? newBook.rights_owner.name : "Select rights owner..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0">
                      <Command>
                        <CommandInput placeholder="Search rights owners..." />
                        <CommandList>
                          <CommandEmpty>No rights owner found.</CommandEmpty>
                          <CommandGroup>
                            {rightsOwners.map((owner) => (
                              <CommandItem
                                key={owner.id}
                                value={owner.name}
                                onSelect={() => {
                                  setNewBook({ ...newBook, rights_owner: owner })
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    newBook.rights_owner?.id === owner.id ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                {owner.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="reviewers">Reviewer</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between mt-1">
                        {newBook.reviewer ? newBook.reviewer.name : "Select reviewer..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0">
                      <Command>
                        <CommandInput placeholder="Search reviewers..." />
                        <CommandList>
                          <CommandEmpty>No reviewer found.</CommandEmpty>
                          <CommandGroup>
                            {reviewers.map((reviewer) => (
                              <CommandItem
                                key={reviewer.id}
                                value={reviewer.name}
                                onSelect={() => {
                                  setNewBook({ ...newBook, reviewer })
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    newBook.reviewer?.id === reviewer.id ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                {reviewer.name}
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
                    variant={coverInputType === "upload" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCoverInputType("upload")}
                  >
                    Upload File
                  </Button>
                  <Button
                    type="button"
                    variant={coverInputType === "url" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCoverInputType("url")}
                  >
                    External URL
                  </Button>
                </div>

                <div className="border rounded-md p-4 bg-muted/30 mt-1">
                  <div className="aspect-square rounded-md overflow-hidden mb-2 w-24 h-24 mx-auto">
                    <img
                      src={coverInputType === "upload"
                        ? getImageUrl(newBook.cover_image || null)
                        : getImageUrl(newBook.cover_url || null)}
                      alt={`Book ${newBook.isbn}`}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        const img = e.currentTarget
                        img.src = "/placeholder.svg"
                      }}
                    />
                  </div>

                  {coverInputType === "upload" ? (
                    <div className="flex justify-center">
                      <input
                        type="file"
                        id="cover-image"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            const reader = new FileReader()
                            reader.onloadend = () => {
                              setNewBook({
                                ...newBook,
                                cover_image: reader.result as string,
                                cover_url: null,
                              })
                            }
                            reader.readAsDataURL(file)
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          document.getElementById("cover-image")?.click()
                        }}
                      >
                        {newBook.cover_image ? "Change Image" : "Upload Image"}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        type="url"
                        placeholder="Enter image URL (must start with https://dararab.co.uk/)"
                        value={newBook.cover_url || ""}
                        onChange={(e) => {
                          const url = e.target.value
                          validateCoverUrl(url)
                          setNewBook({
                            ...newBook,
                            cover_url: url,
                            cover_image: null,
                          })
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
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <span className="mr-2 inline-block h-4 w-4 animate-spin border-2 border-current border-t-transparent rounded-full" />}
              Add Book
            </Button>
          </DialogFooter>
        </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}

