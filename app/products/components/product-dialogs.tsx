"use client"

import dynamic from "next/dynamic"
import type { MutableRefObject } from "react"

import type {
  Author,
  BookInterface,
  Genre,
  Inventory,
  InventoryItem,
  Language,
  ProductSummary,
  Reviewer,
  RightsOwner,
  Status,
  StatusObject,
  Transfer,
  Translator,
  Warehouse,
} from "../page"

const BookDetailsDialog = dynamic(
  () => import("./book-details-dialog").then((mod) => mod.BookDetailsDialog),
  {
    loading: () => null,
    ssr: false,
  },
)

const AddBookDialog = dynamic(
  () => import("./add-book-dialog").then((mod) => mod.AddBookDialog),
  {
    loading: () => null,
    ssr: false,
  },
)

const TransferDialog = dynamic(
  () => import("./transfer-dialog").then((m) => m.TransferDialog),
  {
    loading: () => null,
    ssr: false,
  },
)

const DeleteDialog = dynamic(
  () => import("./delete-dialog").then((m) => m.DeleteDialog),
  {
    loading: () => null,
    ssr: false,
  },
)

const AddInventoryDialog = dynamic(
  () => import("./add-inventory-dialog").then((m) => m.AddInventoryDialog),
  {
    loading: () => null,
    ssr: false,
  },
)

const EditBookDialog = dynamic(
  () => import("./edit-book-dialog").then((m) => m.EditBookDialog),
  {
    loading: () => null,
    ssr: false,
  },
)

type ProductDialogsProps = {
  isBookDetailsOpen: boolean
  onBookDetailsOpenChange: (open: boolean) => void
  selectedBook: BookInterface | null
  selectedBookInventory: Inventory[]
  getImageUrl: (url: string | null) => string
  getGenreName: (genre: Genre | number | null) => string
  getLanguageName: (language: Language | number | null) => string
  getStatusName: (status: Status | number | null) => string
  onBookDetailsClose: () => void
  onEditFromDetails: (book: BookInterface) => void
  onTransferFromDetails: (book: BookInterface) => void
  isAddBookOpen: boolean
  onAddBookOpenChange: (open: boolean) => void
  onAddBookClose: () => void
  formRef: MutableRefObject<HTMLFormElement | null>
  onAddBookSubmit: () => void
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
  isCreating: boolean
  isEditBookOpen: boolean
  onEditBookOpenChange: (open: boolean) => void
  onEditBookClose: () => void
  setSelectedBook: (book: BookInterface) => void
  activeTab: string
  setActiveTab: (tab: string) => void
  editCoverInputType: "upload" | "url"
  setEditCoverInputType: (value: "upload" | "url") => void
  printRunStatusOptions: StatusObject[]
  editBookInventory: Array<{
    id?: number
    product: number
    warehouse: number
    quantity: number
    notes: string
  }>
  setEditBookInventory: (
    value: Array<{
      id?: number
      product: number
      warehouse: number
      quantity: number
      notes: string
    }>,
  ) => void
  handleAddInventoryItem: () => void
  handleSaveChanges: () => void
  isUpdating: boolean
  isTransferOpen: boolean
  onTransferOpenChange: (open: boolean) => void
  onModalClose: () => void
  transfer: Partial<Transfer>
  setTransfer: (transfer: Partial<Transfer>) => void
  onTransferSubmit: () => void
  isTransferring: boolean
  isDeleteAlertOpen: boolean
  onDeleteAlertOpenChange: (open: boolean) => void
  deleteBookId: number | null
  productSummaries: ProductSummary[]
  onDeleteBook: () => void
  isDeleting: boolean
  isAddInventoryOpen: boolean
  onAddInventoryOpenChange: (open: boolean) => void
  onAddInventoryClose: () => void
  onAddInventorySubmit: () => void
  isSubmitting: boolean
}

export function ProductDialogs({
  isBookDetailsOpen,
  onBookDetailsOpenChange,
  selectedBook,
  selectedBookInventory,
  getImageUrl,
  getGenreName,
  getLanguageName,
  getStatusName,
  onBookDetailsClose,
  onEditFromDetails,
  onTransferFromDetails,
  isAddBookOpen,
  onAddBookOpenChange,
  onAddBookClose,
  formRef,
  onAddBookSubmit,
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
  isCreating,
  isEditBookOpen,
  onEditBookOpenChange,
  onEditBookClose,
  setSelectedBook,
  activeTab,
  setActiveTab,
  editCoverInputType,
  setEditCoverInputType,
  printRunStatusOptions,
  editBookInventory,
  setEditBookInventory,
  handleAddInventoryItem,
  handleSaveChanges,
  isUpdating,
  isTransferOpen,
  onTransferOpenChange,
  onModalClose,
  transfer,
  setTransfer,
  onTransferSubmit,
  isTransferring,
  isDeleteAlertOpen,
  onDeleteAlertOpenChange,
  deleteBookId,
  productSummaries,
  onDeleteBook,
  isDeleting,
  isAddInventoryOpen,
  onAddInventoryOpenChange,
  onAddInventoryClose,
  onAddInventorySubmit,
  isSubmitting,
}: ProductDialogsProps) {
  return (
    <>
      <BookDetailsDialog
        open={isBookDetailsOpen}
        onOpenChange={onBookDetailsOpenChange}
        selectedBook={selectedBook}
        selectedBookInventory={selectedBookInventory}
        getImageUrl={getImageUrl}
        getGenreName={getGenreName}
        getLanguageName={getLanguageName}
        getStatusName={getStatusName}
        onClose={onBookDetailsClose}
        onEdit={onEditFromDetails}
        onTransfer={onTransferFromDetails}
      />

      <AddBookDialog
        open={isAddBookOpen}
        onOpenChange={onAddBookOpenChange}
        onClose={onAddBookClose}
        formRef={formRef}
        onSubmit={onAddBookSubmit}
        newBook={newBook}
        setNewBook={setNewBook}
        coverInputType={coverInputType}
        setCoverInputType={setCoverInputType}
        genres={genres}
        statusOptions={statusOptions}
        languages={languages}
        authors={authors}
        translators={translators}
        rightsOwners={rightsOwners}
        reviewers={reviewers}
        warehouses={warehouses}
        newBookInventory={newBookInventory}
        setNewBookInventory={setNewBookInventory}
        getImageUrl={getImageUrl}
        isSubmitting={isCreating}
      />

      <EditBookDialog
        open={isEditBookOpen}
        onOpenChange={onEditBookOpenChange}
        onClose={onEditBookClose}
        formRef={formRef}
        selectedBook={selectedBook}
        setSelectedBook={setSelectedBook}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        genres={genres}
        statusOptions={statusOptions}
        languages={languages}
        authors={authors}
        translators={translators}
        editCoverInputType={editCoverInputType}
        setEditCoverInputType={setEditCoverInputType}
        printRunStatusOptions={printRunStatusOptions}
        editBookInventory={editBookInventory}
        setEditBookInventory={setEditBookInventory}
        warehouses={warehouses}
        handleAddInventoryItem={handleAddInventoryItem}
        handleSaveChanges={handleSaveChanges}
        isSubmitting={isUpdating}
      />

      <TransferDialog
        open={isTransferOpen}
        onOpenChange={onTransferOpenChange}
        onClose={onModalClose}
        selectedBook={selectedBook}
        warehouses={warehouses}
        transfer={transfer}
        setTransfer={setTransfer}
        onSubmit={onTransferSubmit}
        isLoading={isTransferring}
      />

      <DeleteDialog
        open={isDeleteAlertOpen}
        onOpenChange={onDeleteAlertOpenChange}
        onClose={onModalClose}
        deleteBookId={deleteBookId}
        productSummaries={productSummaries}
        onDelete={onDeleteBook}
        isSubmitting={isDeleting}
      />

      <AddInventoryDialog
        open={isAddInventoryOpen}
        onOpenChange={onAddInventoryOpenChange}
        onClose={onAddInventoryClose}
        isAddBookOpen={isAddBookOpen}
        selectedBook={selectedBook}
        warehouses={warehouses}
        items={newBookInventory}
        setItems={setNewBookInventory}
        onSubmit={onAddInventorySubmit}
        isSubmitting={isSubmitting}
      />
    </>
  )
}
