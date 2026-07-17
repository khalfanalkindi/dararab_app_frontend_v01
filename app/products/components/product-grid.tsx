"use client"

import { useCallback, useRef, type CSSProperties } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Book,
  Edit,
  ImageIcon,
  MoreHorizontal,
  MoveRight,
  PlusCircle,
  Trash2,
} from "lucide-react"

import { useLanguage } from "@/components/language-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import type { ProductSummary } from "../page"

type ProductGridPaginationProps = {
  currentPage: number
  pageSize: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function ProductGridPagination({
  currentPage,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: ProductGridPaginationProps) {
  const { t } = useLanguage()

  return (
    <div className="flex items-center justify-between mt-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          disabled={currentPage === 1}
        >
          {t("common.previous")}
        </Button>
        <span className="text-sm">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          disabled={currentPage === totalPages}
        >
          {t("common.next")}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm">Items per page:</span>
        <Select
          value={pageSize.toString()}
          onValueChange={(value) => {
            onPageSizeChange(Number(value))
          }}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

type ProductGridProps = {
  productSummaries: ProductSummary[]
  isLoading: boolean
  searchQuery: string
  selectedGenre: string | null
  selectedStatus: string | null
  sortField: string
  onSort: (field: string) => void
  onResetFilters: () => void
  onOpenBookDetails: (book: ProductSummary) => void
  onOpenEditBook: (book: ProductSummary) => void
  onOpenTransferModal: (book: ProductSummary) => void
  onOpenDeleteDialog: (bookId: number) => void
  onAddBook: () => void
}

type ProductTableRowProps = {
  book: ProductSummary
  onOpenBookDetails: (book: ProductSummary) => void
  onOpenEditBook: (book: ProductSummary) => void
  onOpenTransferModal: (book: ProductSummary) => void
  onOpenDeleteDialog: (bookId: number) => void
  rowRef?: (element: HTMLTableRowElement | null) => void
  rowStyle?: CSSProperties
  dataIndex?: number
}

function ProductTableRow({
  book,
  onOpenBookDetails,
  onOpenEditBook,
  onOpenTransferModal,
  onOpenDeleteDialog,
  rowRef,
  rowStyle,
  dataIndex,
}: ProductTableRowProps) {
  const { t } = useLanguage()

  return (
    <TableRow
      ref={rowRef}
      data-index={dataIndex}
      style={rowStyle}
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
            {book.cover_design_url ? (
              <img
                src={book.cover_design_url}
                alt={`Book ${book.isbn}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>
          <div>
            <p className="font-medium">{book.title_en}</p>
            <p className="text-xs text-muted-foreground line-clamp-1">{book.title_ar}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <p className="font-mono text-sm">{book.isbn}</p>
      </TableCell>
      <TableCell>
        <span className="text-sm">{book.author_name || "-"}</span>
      </TableCell>
      <TableCell>
        <span className="text-sm">{book.translator_name || "-"}</span>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="font-normal">
          {book.genre_name || "Unknown"}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">${book.latest_price || 0}</span>
          <span className="text-xs text-muted-foreground">
            PriceOMR: OMR{book.latest_price_omr || 0}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <Badge
          className={`${
            book.status_name === "Available"
              ? "bg-green-100 text-green-800 hover:bg-green-100 border-green-200"
              : book.status_name === "unavailable"
                ? "bg-red-100 text-red-800 hover:bg-red-100 border-red-200"
                : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200"
          }`}
        >
          {book.status_name || "Unknown"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <div className="hidden sm:flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpenBookDetails(book)}
            >
              <Book className="h-4 w-4" />
              <span className="sr-only">View Details</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpenEditBook(book)}
            >
              <Edit className="h-4 w-4" />
              <span className="sr-only">{t("common.edit")}</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpenTransferModal(book)}
            >
              <MoveRight className="h-4 w-4" />
              <span className="sr-only">{t("transfer.transfer")}</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onOpenDeleteDialog(book.id)}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">{t("common.delete")}</span>
            </Button>
          </div>

          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">{t("common.actions")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t("common.actions")}</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onOpenBookDetails(book)}>
                  <Book className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onOpenEditBook(book)}>
                  <Edit className="h-4 w-4 mr-2" />
                  {t("common.edit")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onOpenTransferModal(book)}>
                  <MoveRight className="h-4 w-4 mr-2" />
                  {t("transfer.transfer")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onOpenDeleteDialog(book.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("common.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </TableCell>
    </TableRow>
  )
}

export function ProductGrid({
  productSummaries,
  isLoading,
  searchQuery,
  selectedGenre,
  selectedStatus,
  sortField,
  onSort,
  onResetFilters,
  onOpenBookDetails,
  onOpenEditBook,
  onOpenTransferModal,
  onOpenDeleteDialog,
  onAddBook,
}: ProductGridProps) {
  const { t } = useLanguage()
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const shouldVirtualize = productSummaries.length > 20

  const rowVirtualizer = useVirtualizer({
    count: productSummaries.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 80,
    overscan: 5,
  })

  const virtualItems = shouldVirtualize ? rowVirtualizer.getVirtualItems() : []
  const totalSize = shouldVirtualize ? rowVirtualizer.getTotalSize() : 0

  const getSortIndicator = useCallback(
    (field: string) => {
      const isActive = sortField === field || sortField === `-${field}`
      if (!isActive) {
        return <ArrowUpDown className="h-4 w-4 ml-1 opacity-30" />
      }
      if (sortField === `-${field}`) {
        return <ArrowDown className="h-4 w-4 ml-1" />
      }
      return <ArrowUp className="h-4 w-4 ml-1" />
    },
    [sortField],
  )

  const hasActiveFilters = Boolean(searchQuery || selectedGenre || selectedStatus)

  return (
    <div className="border rounded-md">
        <div className="bg-muted p-4 flex justify-between items-center">
          <h3 className="font-medium">{t("products.books")}</h3>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onResetFilters} className="h-8 px-2 text-xs">
              {t("products.clearFilters")}
            </Button>
          )}
        </div>
        <div className="p-0">
          <div
            className="overflow-x-auto"
            ref={tableContainerRef}
            style={{
              height: shouldVirtualize ? "600px" : "auto",
              overflowY: shouldVirtualize ? "auto" : "visible",
              position: "relative",
            }}
          >
            <Table disableWrapper>
              <TableHeader className={shouldVirtualize ? "sticky top-0 bg-background z-10" : ""}>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => onSort("title_en")}
                  >
                    <div className="flex items-center">
                      {t("products.book")}
                      {getSortIndicator("title_en")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => onSort("isbn")}
                  >
                    <div className="flex items-center">
                      {t("products.isbn")}
                      {getSortIndicator("isbn")}
                    </div>
                  </TableHead>
                  <TableHead>{t("products.authors")}</TableHead>
                  <TableHead>{t("products.translators")}</TableHead>
                  <TableHead>{t("products.genre")}</TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => onSort("latest_price")}
                  >
                    <div className="flex items-center">
                      {t("products.price")}
                      {getSortIndicator("latest_price")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => onSort("status_id")}
                  >
                    <div className="flex items-center">
                      {t("products.status")}
                      {getSortIndicator("status")}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody
                style={{
                  position: "relative",
                  height: shouldVirtualize && totalSize > 0 ? `${totalSize}px` : "auto",
                }}
              >
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-10 w-10 rounded-md flex-shrink-0" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-20" />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-24" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Skeleton className="h-8 w-8 rounded" />
                          <Skeleton className="h-8 w-8 rounded" />
                          <Skeleton className="h-8 w-8 rounded" />
                          <Skeleton className="h-8 w-8 rounded" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : productSummaries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center">
                      <div className="flex flex-col items-center">
                        <Book className="h-12 w-12 text-muted-foreground mb-2" />
                        <p className="font-medium mb-1">{t("products.empty")}</p>
                        <p className="text-muted-foreground text-sm mb-4">
                          {hasActiveFilters
                            ? "Try adjusting your filters"
                            : "Add your first book to get started"}
                        </p>
                        {hasActiveFilters ? (
                          <Button variant="outline" size="sm" onClick={onResetFilters}>
                            {t("products.clearFilters")}
                          </Button>
                        ) : (
                          <Button size="sm" onClick={onAddBook}>
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Add Book
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : shouldVirtualize && virtualItems.length > 0 ? (
                  <>
                    <TableRow>
                      <TableCell colSpan={8} style={{ height: virtualItems[0]?.start ?? 0 }} />
                    </TableRow>
                    {virtualItems.map((virtualItem) => {
                      const book = productSummaries[virtualItem.index]
                      if (!book) return null
                      return (
                        <ProductTableRow
                          key={book.id}
                          book={book}
                          onOpenBookDetails={onOpenBookDetails}
                          onOpenEditBook={onOpenEditBook}
                          onOpenTransferModal={onOpenTransferModal}
                          onOpenDeleteDialog={onOpenDeleteDialog}
                          rowRef={rowVirtualizer.measureElement}
                          dataIndex={virtualItem.index}
                          rowStyle={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: `${virtualItem.size}px`,
                            transform: `translateY(${virtualItem.start}px)`,
                            display: "table-row",
                          }}
                        />
                      )
                    })}
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        style={{
                          height: totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0),
                        }}
                      />
                    </TableRow>
                  </>
                ) : (
                  productSummaries.map((book) => (
                    <ProductTableRow
                      key={book.id}
                      book={book}
                      onOpenBookDetails={onOpenBookDetails}
                      onOpenEditBook={onOpenEditBook}
                      onOpenTransferModal={onOpenTransferModal}
                      onOpenDeleteDialog={onOpenDeleteDialog}
                    />
                  ))
                )}
              </TableBody>
            </Table>
        </div>
      </div>
    </div>
  )
}
