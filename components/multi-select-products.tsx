"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Checkbox } from "@/components/ui/checkbox"

export type MultiSelectProductItem = { id: number; name: string }

type MultiSelectProductsProps = {
  selectedIds: number[]
  onSelectionChange: (ids: number[]) => void
  fetchItems: (search: string, signal?: AbortSignal) => Promise<MultiSelectProductItem[]>
  selectedLabels: Record<number, string>
  onProductSelected: (id: number, name: string) => void
  placeholder: string
}

export function MultiSelectProducts({
  selectedIds,
  onSelectionChange,
  fetchItems,
  selectedLabels,
  onProductSelected,
  placeholder,
}: MultiSelectProductsProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [dropdownItems, setDropdownItems] = useState<MultiSelectProductItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const dropdownAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    if (!open) return

    dropdownAbortRef.current?.abort()
    dropdownAbortRef.current = new AbortController()
    const signal = dropdownAbortRef.current.signal

    setIsSearching(true)
    void fetchItems(debouncedSearchQuery, signal)
      .then((items) => {
        if (!signal.aborted) setDropdownItems(items)
      })
      .finally(() => {
        if (!signal.aborted) setIsSearching(false)
      })

    return () => {
      dropdownAbortRef.current?.abort()
    }
  }, [open, debouncedSearchQuery, fetchItems])

  const displayItems = useMemo(() => {
    const byId = new Map(dropdownItems.map((item) => [item.id, item]))
    for (const id of selectedIds) {
      if (!byId.has(id)) {
        byId.set(id, { id, name: selectedLabels[id] || `Product ${id}` })
      }
    }
    return [...byId.values()]
  }, [dropdownItems, selectedIds, selectedLabels])

  const toggleProduct = (productId: number, productName: string) => {
    if (selectedIds.includes(productId)) {
      onSelectionChange(selectedIds.filter((id) => id !== productId))
    } else {
      onProductSelected(productId, productName)
      onSelectionChange([...selectedIds, productId])
    }
  }

  const allFilteredSelected =
    displayItems.length > 0 && displayItems.every((item) => selectedIds.includes(item.id))
  const someFilteredSelected = displayItems.some((item) => selectedIds.includes(item.id))

  const handleSelectAllFiltered = () => {
    const nextIds = new Set(selectedIds)
    for (const item of displayItems) {
      nextIds.add(item.id)
      onProductSelected(item.id, item.name)
    }
    onSelectionChange([...nextIds])
  }

  const handleDeselectAllFiltered = () => {
    const filteredIdSet = new Set(displayItems.map((item) => item.id))
    onSelectionChange(selectedIds.filter((id) => !filteredIdSet.has(id)))
  }

  return (
    <div className="space-y-2">
      <Popover
        modal={false}
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setSearchQuery("")
            setDebouncedSearchQuery("")
            setDropdownItems([])
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="justify-between w-full"
          >
            {selectedIds.length > 0
              ? `${selectedIds.length} product${selectedIds.length === 1 ? "" : "s"} selected`
              : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[400px] z-[60]"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={() => {
            setOpen(false)
          }}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search products..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList
              className="max-h-[300px] overflow-y-auto overscroll-contain"
              onWheel={(e) => e.stopPropagation()}
            >
              <CommandEmpty>{isSearching ? "Searching..." : "No products found."}</CommandEmpty>
              {displayItems.length > 0 && (
                <div className="sticky top-0 z-10 border-b bg-muted/50 px-2 py-1.5">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
                      disabled={allFilteredSelected}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelectAllFiltered()
                      }}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      className="text-sm font-medium text-muted-foreground hover:underline disabled:opacity-50"
                      disabled={!someFilteredSelected}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeselectAllFiltered()
                      }}
                    >
                      Deselect All
                    </button>
                    {someFilteredSelected && !allFilteredSelected && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {displayItems.filter((item) => selectedIds.includes(item.id)).length} of{" "}
                        {displayItems.length}
                      </span>
                    )}
                  </div>
                </div>
              )}
              <CommandGroup className="overflow-visible">
                {displayItems.map((item) => {
                  const isSelected = selectedIds.includes(item.id)
                  return (
                    <CommandItem
                      key={item.id}
                      value={String(item.id)}
                      onSelect={() => {
                        toggleProduct(item.id, item.name)
                      }}
                      className="cursor-pointer"
                    >
                      <div
                        className="flex items-center space-x-2 w-full"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleProduct(item.id, item.name)
                        }}
                      >
                        <Checkbox
                          checked={isSelected}
                          onChange={() => {
                            toggleProduct(item.id, item.name)
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                        />
                        <span className="flex-1">{item.name}</span>
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
