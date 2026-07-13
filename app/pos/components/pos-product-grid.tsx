"use client"

import {
  Search,
  ShoppingCart,
  Loader2,
  ChevronDown,
  X,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { Genre, Product, Warehouse } from "./types"

type PosProductGridProps = {
  searchInput: string
  onSearchInputChange: (value: string) => void
  selectedWarehouse: number | null
  warehouses: Warehouse[]
  isWarehouseDropdownOpen: boolean
  onWarehouseDropdownOpenChange: (open: boolean) => void
  onSelectWarehouse: (warehouseId: number) => void
  onClearWarehouse: () => void
  selectedGenre: Genre | null
  genres: Genre[]
  isGenreDropdownOpen: boolean
  onGenreDropdownOpenChange: (open: boolean) => void
  onSelectGenre: (genre: Genre | null) => void
  isLoading: boolean
  products: Product[]
  currentPage: number
  pageSize: number
  totalPages: number
  totalCount: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onRetryLoadProducts: () => void
  onAddToCart: (product: Product) => void
  getDisplayPrice: (product: Product) => string | null
  getCurrencyLabel: () => string
  getAvailableStock: (product: Product) => number
  onImageError: (e: React.SyntheticEvent<HTMLImageElement>) => void
}

function PaginationControls({
  currentPage,
  pageSize,
  totalPages,
  totalCount,
  onPageChange,
  onPageSizeChange,
}: Pick<
  PosProductGridProps,
  "currentPage" | "pageSize" | "totalPages" | "totalCount" | "onPageChange" | "onPageSizeChange"
>) {
  const startItem = totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0
  const endItem = Math.min(currentPage * pageSize, totalCount)

  return (
    <div className="flex items-center justify-between mt-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {totalCount > 0 ? (
            <>Showing {startItem}-{endItem} of {totalCount} products</>
          ) : (
            <>No products found</>
          )}
        </span>
        <Select
          value={pageSize.toString()}
          onValueChange={(value) => {
            onPageSizeChange(Number(value))
            onPageChange(1)
          }}
        >
          <SelectTrigger className="h-8 w-[70px]">
            <SelectValue placeholder={pageSize} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
        >
          First
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          Next
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
        >
          Last
        </Button>
      </div>
    </div>
  )
}

export function PosProductGrid({
  searchInput,
  onSearchInputChange,
  selectedWarehouse,
  warehouses,
  isWarehouseDropdownOpen,
  onWarehouseDropdownOpenChange,
  onSelectWarehouse,
  onClearWarehouse,
  selectedGenre,
  genres,
  isGenreDropdownOpen,
  onGenreDropdownOpenChange,
  onSelectGenre,
  isLoading,
  products,
  currentPage,
  pageSize,
  totalPages,
  totalCount,
  onPageChange,
  onPageSizeChange,
  onRetryLoadProducts,
  onAddToCart,
  getDisplayPrice,
  getCurrencyLabel,
  getAvailableStock,
  onImageError,
}: PosProductGridProps) {
  const selectedWarehouseName = selectedWarehouse
    ? warehouses.find((w) => w.id === selectedWarehouse)?.name_en
    : null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Products</CardTitle>
        <div className="flex items-center gap-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products by title, ISBN..."
                  value={searchInput}
                  onChange={(e) => onSearchInputChange(e.target.value)}
                  className="ps-8"
                />
              </div>
              <Popover open={isWarehouseDropdownOpen} onOpenChange={onWarehouseDropdownOpenChange}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onWarehouseDropdownOpenChange(true)}
                  >
                    {selectedWarehouseName || "Select Warehouse"}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                  <Command>
                    <CommandInput placeholder="Search warehouses..." />
                    <CommandList>
                      <CommandEmpty>No warehouse found.</CommandEmpty>
                      <CommandGroup>
                        {warehouses.map((warehouse) => (
                          <CommandItem
                            key={warehouse.id}
                            onSelect={() => {
                              onSelectWarehouse(warehouse.id)
                              onWarehouseDropdownOpenChange(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedWarehouse === warehouse.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {warehouse.name_en}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Popover open={isGenreDropdownOpen} onOpenChange={onGenreDropdownOpenChange}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onGenreDropdownOpenChange(true)}
                  >
                    {selectedGenre ? selectedGenre.display_name_en : "All Genres"}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                  <Command>
                    <CommandInput placeholder="Search genres..." />
                    <CommandList>
                      <CommandEmpty>No genre found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => {
                            onSelectGenre(null)
                            onGenreDropdownOpenChange(false)
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedGenre === null ? "opacity-100" : "opacity-0",
                            )}
                          />
                          All Genres
                        </CommandItem>
                        {genres.map((genre) => (
                          <CommandItem
                            key={genre.id}
                            onSelect={() => {
                              onSelectGenre(genre)
                              onGenreDropdownOpenChange(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedGenre?.id === genre.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {genre.display_name_en}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-2">
              {selectedGenre && (
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-full text-sm">
                  {selectedGenre.display_name_en}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => onSelectGenre(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {selectedWarehouse && (
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-full text-sm">
                  {selectedWarehouseName}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={onClearWarehouse}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          {!selectedWarehouse ? (
            <div className="text-center py-12">
              <div className="flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Select a Warehouse</h3>
                  <p className="text-muted-foreground">Please select a warehouse to view available products</p>
                </div>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading products for {selectedWarehouseName}...</span>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <div className="flex flex-col items-center gap-4">
                <p className="text-muted-foreground">No products found in this warehouse</p>
                <Button variant="outline" size="sm" onClick={onRetryLoadProducts}>
                  Retry Load Products
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {products.map((product) => (
                  <Card key={product.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-2">
                      <div className="relative aspect-square rounded-md overflow-hidden mb-2">
                        <img
                          src={product.cover_design_url || "/placeholder.svg"}
                          alt={product.title_en}
                          className="w-full h-full object-cover"
                          onError={onImageError}
                        />
                        {product.genre_name && (
                          <div className="absolute top-2 right-2">
                            <span className="text-xs px-2 py-1 bg-primary/90 text-primary-foreground rounded-full">
                              {product.genre_name}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-medium text-sm line-clamp-1">{product.title_en}</h3>
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-bold text-sm">
                              {(() => {
                                const displayPrice = getDisplayPrice(product)
                                return displayPrice
                                  ? `${parseFloat(displayPrice).toFixed(3)} ${getCurrencyLabel()}`
                                  : "N/A"
                              })()}
                            </p>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="text-xs text-muted-foreground cursor-help">
                                    Stock: {getAvailableStock(product)}
                                  </p>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="space-y-1">
                                    <p className="font-medium">Stock Information</p>
                                    <p>Current Stock: {getAvailableStock(product)}</p>
                                    <p>ISBN: {product.isbn || "N/A"}</p>
                                    <p>Author: {product.author_name || "N/A"}</p>
                                    <p>Translator: {product.translator_name || "N/A"}</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={getAvailableStock(product) < 1}
                            onClick={() => onAddToCart(product)}
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <PaginationControls
                currentPage={currentPage}
                pageSize={pageSize}
                totalPages={totalPages}
                totalCount={totalCount}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
              />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
