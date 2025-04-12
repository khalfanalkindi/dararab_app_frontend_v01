"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { AppSidebar } from "../../components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import {
  Edit,
  Book,
  AlertCircle,
  CheckCircle2,
  PlusCircle,
  Trash2,
  MoreHorizontal,
  Loader2,
  Search,
  ImageIcon,
  MoveRight,
  Calendar,
  X,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { format } from "date-fns"
import { CalendarIcon } from "@radix-ui/react-icons"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import React from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"

// Book interface
interface BookInterface {
  id: number
  project?: number | null
  isbn: string
  title_ar: string
  title_en: string
  cover_design: string | null
  cover_image: string | null
  print_cost: number
  published_at: string
  price: number
  status: { id: number; value: string; display_name_en: string } | number | null
  genre: { id: number; value: string; display_name_en: string } | number | null
  is_direct_product: boolean
  created_at?: string
  updated_at?: string
}

// Genre interface
interface Genre {
  id: number
  display_name_en: string
  description?: string
}

// Warehouse interface
interface Warehouse {
  id: number
  name_en: string
  name_ar: string
  type: number | null
  location: string
}

// Inventory interface
interface Inventory {
  id: number
  product: number
  warehouse: number
  quantity: number
  warehouse_name?: string // For UI display
}

// Transfer interface
interface Transfer {
  id?: number
  product: number
  from_warehouse: number
  to_warehouse: number
  quantity: number
  shipping_cost: number
  transfer_date: string
}

// Status interface for API responses
interface StatusObject {
  id: number
  value: string
  display_name_en: string
}

interface InventoryItem {
  warehouse: number;
  quantity: number;
}

export default function BookManagement() {
  // State for books and filters
  const [books, setBooks] = useState<BookInterface[]>([])
  const [filteredBooks, setFilteredBooks] = useState<BookInterface[]>([])
  const [genres, setGenres] = useState<Genre[]>([])
  const [statusOptions, setStatusOptions] = useState<StatusObject[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [inventory, setInventory] = useState<Inventory[]>([])
  const [selectedBook, setSelectedBook] = useState<BookInterface | null>(null)
  const [selectedBookInventory, setSelectedBookInventory] = useState<Inventory[]>([])
  const [isBookDetailsOpen, setIsBookDetailsOpen] = useState(false)
  const [isAddBookOpen, setIsAddBookOpen] = useState(false)
  const [isEditBookOpen, setIsEditBookOpen] = useState(false)
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
  const [isTransferOpen, setIsTransferOpen] = useState(false)
  const [isAddInventoryOpen, setIsAddInventoryOpen] = useState(false)
  const [deleteBookId, setDeleteBookId] = useState<number | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const [actionAlert, setActionAlert] = useState<{
    type: "success" | "error" | "warning" | null
    message: string
  }>({
    type: null,
    message: "",
  })

  // New book state with default values
  const [newBook, setNewBook] = useState<Partial<BookInterface>>({
    isbn: "",
    title_ar: "",
    title_en: "",
    print_cost: 0,
    published_at: format(new Date(), "yyyy-MM-dd"),
    price: 0,
    status: null,
    genre: null,
    is_direct_product: false,
  })

  // Transfer state
  const [transfer, setTransfer] = useState<Partial<Transfer>>({
    product: 0,
    from_warehouse: 0,
    to_warehouse: 0,
    quantity: 1,
    shipping_cost: 0,
    transfer_date: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
  })

  // New book inventory state
  const [newBookInventory, setNewBookInventory] = useState<InventoryItem[]>([])

  // Show alert message
  const showAlert = (type: "success" | "error" | "warning", message: string) => {
    setActionAlert({ type, message })
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setActionAlert({ type: null, message: "" })
    }, 5000)
  }

  // Headers for API requests
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
  }

  // Filter books based on search query, genre, and status
  useEffect(() => {
    const filtered = books.filter((book) => {
      const matchesSearch = searchQuery === '' || 
        book.title_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.title_ar.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.isbn.toLowerCase().includes(searchQuery.toLowerCase());

      const bookGenre = typeof book.genre === 'object' ? book.genre?.id : book.genre;
      const bookStatus = typeof book.status === 'object' ? book.status?.id : book.status;

      const matchesGenre = !selectedGenre || bookGenre === parseInt(selectedGenre);
      const matchesStatus = !selectedStatus || bookStatus === parseInt(selectedStatus);

      console.log('Filtering book:', {
        title: book.title_en,
        genre: bookGenre,
        selectedGenre: selectedGenre ? parseInt(selectedGenre) : null,
        status: bookStatus,
        selectedStatus: selectedStatus ? parseInt(selectedStatus) : null,
        matchesGenre,
        matchesStatus
      });

      return matchesSearch && matchesGenre && matchesStatus;
    });

    setFilteredBooks(filtered);
  }, [books, searchQuery, selectedGenre, selectedStatus]);

  // Get status name by ID
  const getStatusName = (status: any) => {
    if (!status) return "N/A"
    const statusId = typeof status === 'object' ? status.id : status
    const statusObj = statusOptions.find((s) => s.id === statusId)
    return statusObj ? statusObj.display_name_en : "N/A"
  }

  // Get genre name by ID
  const getGenreName = (genre: any) => {
    if (!genre) return "N/A"
    const genreId = typeof genre === 'object' ? genre.id : genre
    const genreObj = genres.find((g) => g.id === genreId)
    return genreObj ? genreObj.display_name_en : "N/A"
  }

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        // Fetch books
        const booksResponse = await fetch(`${API_URL}/inventory/products/`, {
          headers,
        })
        if (!booksResponse.ok) throw new Error("Failed to fetch books")
        const booksData = await booksResponse.json()
        console.log('Books data structure:', booksData.map((book: BookInterface) => ({
          id: book.id,
          isbn: book.isbn,
          genre: book.genre,
          status: book.status
        })))
        setBooks(booksData)
        setFilteredBooks(booksData)

        // Fetch genres (list items)
        const genresResponse = await fetch(`${API_URL}/common/list-items/genre/`, {
          headers,
        })
        if (!genresResponse.ok) throw new Error("Failed to fetch genres")
        const genresData = await genresResponse.json()
        console.log('Genres data structure:', genresData)
        setGenres(genresData)

        // Fetch status options
        const statusResponse = await fetch(`${API_URL}/common/list-items/product_status/`, {
          headers,
        })
        if (!statusResponse.ok) throw new Error("Failed to fetch status options")
        const statusData = await statusResponse.json()
        console.log('Status data structure:', statusData)
        setStatusOptions(statusData)

        // Fetch warehouses
        const warehousesResponse = await fetch(`${API_URL}/inventory/warehouses/`, {
          headers,
        })
        if (!warehousesResponse.ok) throw new Error("Failed to fetch warehouses")
        const warehousesData = await warehousesResponse.json()
        setWarehouses(warehousesData)

        // Fetch inventory
        const inventoryResponse = await fetch(`${API_URL}/inventory/inventory/`, {
          headers,
        })
        if (!inventoryResponse.ok) throw new Error("Failed to fetch inventory")
        const inventoryData = await inventoryResponse.json()

        // Enhance inventory with warehouse names for easier display
        const enhancedInventory = inventoryData.map((item: Inventory) => {
          const warehouse = warehousesData.find((w: Warehouse) => w.id === item.warehouse)
          return {
            ...item,
            warehouse_name: warehouse ? warehouse.name_en : "Unknown",
          }
        })

        setInventory(enhancedInventory)
      } catch (error) {
        console.error("Error loading data:", error)
        toast({
          title: "Error",
          description: "Failed to load books",
          variant: "destructive",
        })
        showAlert("error", "Failed to load books. Please try again later.")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  // Open book details modal
  const openBookDetails = async (book: BookInterface) => {
  try {
    setSelectedBook(book);
    setIsBookDetailsOpen(true);

    // 🔁 Wait for warehouses if not yet loaded
    if (warehouses.length === 0) {
      const warehousesResponse = await fetch(`${API_URL}/inventory/warehouses/`, { headers });
      if (!warehousesResponse.ok) throw new Error("Failed to fetch warehouses");
      const warehousesData = await warehousesResponse.json();
      setWarehouses(warehousesData);
    }

    // ✅ Ensure we have the latest warehouse list
    const currentWarehouses = warehouses.length > 0 ? warehouses : JSON.parse(localStorage.getItem("cached_warehouses") || "[]");

    const response = await fetch(`${API_URL}/inventory/inventory/?product_id=${book.id}`, {
      headers,
    });
    if (!response.ok) throw new Error("Failed to fetch book inventory");
    const inventoryData = await response.json();

    const enhancedInventory = inventoryData.map((item: Inventory) => {
      const warehouse = currentWarehouses.find((w) => w.id === (typeof item.warehouse === "object" ? item.warehouse.id : item.warehouse));
      return {
        ...item,
        warehouse_name: warehouse ? warehouse.name_en : "Unknown",
        warehouse: typeof item.warehouse === "object" ? item.warehouse.id : item.warehouse,
      };
    });

    setSelectedBookInventory(enhancedInventory);
  } catch (error) {
    console.error("Error fetching book inventory:", error);
    toast({
      title: "Error",
      description: "Failed to load book inventory",
      variant: "destructive",
    });
  }
};


  // Open edit book modal
const openEditBook = async (book: BookInterface) => {
  try {
    const genreObj = genres.find(g => g.id === (typeof book.genre === "object" ? book.genre.id : book.genre))
    const statusObj = statusOptions.find(s => s.id === (typeof book.status === "object" ? book.status.id : book.status))


    setSelectedBook({
      ...book,
      genre: genreObj || null,
      status: statusObj || null,
    })

    setIsEditBookOpen(true)

    const response = await fetch(`${API_URL}/inventory/inventory/?product_id=${book.id}`, {
      headers,
    })

    if (!response.ok) throw new Error("Failed to fetch book inventory")
    const inventoryData = await response.json()

  const getWarehouseName = (id: number) => {
    const warehouse = warehouses.find(w => w.id === id)
    return warehouse ? warehouse.name_en : "Unknown"
  }

    const existingInventory = inventoryData.map((item: any) => ({
      warehouse: typeof item.warehouse === 'object' ? item.warehouse.id : item.warehouse,
      quantity: item.quantity,
      warehouse_name: typeof item.warehouse === 'object' ? item.warehouse.name_en : getWarehouseName(item.warehouse)
    }))


    setNewBookInventory(existingInventory)
  } catch (error) {
    console.error("Error opening edit modal:", error)
    toast({
      title: "Error",
      description: "Failed to load book inventory",
      variant: "destructive",
    })
  }
}


  // Open transfer modal
  const openTransferModal = (book: BookInterface) => {
    try {
      setSelectedBook(book)
      setTransfer({
        product: book.id,
        from_warehouse: 0,
        to_warehouse: 0,
        quantity: 1,
        shipping_cost: 0,
        transfer_date: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
      })
      setIsTransferOpen(true)
    } catch (error) {
      console.error("Error opening transfer modal:", error)
      toast({
        title: "Error",
        description: "Failed to open transfer modal",
        variant: "destructive",
      })
    }
  }

  // Open delete confirmation
  const openDeleteDialog = (bookId: number) => {
    try {
      setDeleteBookId(bookId)
      setDeleteConfirm("")
      setIsDeleteAlertOpen(true)
    } catch (error) {
      console.error("Error opening delete dialog:", error)
      toast({
        title: "Error",
        description: "Failed to open delete dialog",
        variant: "destructive",
      })
    }
  }

  // Close all modals
  const closeAllModals = () => {
    setIsBookDetailsOpen(false)
    setIsEditBookOpen(false)
    setIsTransferOpen(false)
    setIsDeleteAlertOpen(false)
    setIsAddInventoryOpen(false)
    setSelectedBook(null)
    setDeleteBookId(null)
    setDeleteConfirm("")
    setNewBookInventory([])
  }

  // Handle modal close
  const handleModalClose = () => {
    closeAllModals()
  }

  // Handle adding a new book
  const handleAddBook = async () => {
    setIsSubmitting(true);
    try {
      // Create FormData object
      const formData = new FormData();
      
      // Log the newBook state before processing
      console.log('Current newBook state:', newBook);
      
      // Add all book data to FormData with correct field names
      Object.entries(newBook).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          // Map the field names to match server expectations
          const fieldName = key === 'genre' ? 'genre_id' : 
                           key === 'status' ? 'status_id' : 
                           key;
          formData.append(fieldName, value.toString());
          console.log(`Adding to FormData - ${fieldName}:`, value);
        }
      });

      // If there's a cover image, add it to FormData
      if (newBook.cover_image) {
        console.log('Processing cover image...');
        // Convert base64 to blob
        const response = await fetch(newBook.cover_image);
        const blob = await response.blob();
        formData.append('cover_image', blob, 'cover.jpg');
        console.log('Cover image added to FormData');
      }

      // Log the final FormData contents
      console.log('FormData contents:');
      for (let [key, value] of formData.entries()) {
        console.log(`${key}:`, value);
      }

      console.log('Sending request to:', `${API_URL}/inventory/products/`);
      const response = await fetch(`${API_URL}/inventory/products/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error response:', errorData);
        throw new Error(errorData.message || "Failed to add book");
      }

      const addedBook = await response.json();
      console.log('Successfully added book:', addedBook);

      // Create inventory entries for the new book
      if (newBookInventory.length > 0) {
        console.log('Creating inventory entries...');
        for (const inv of newBookInventory) {
          const inventoryResponse = await fetch(`${API_URL}/inventory/inventory/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
            },
            body: JSON.stringify({
              product: addedBook.id,
              warehouse: inv.warehouse,
              quantity: inv.quantity,
            }),
          });

          if (!inventoryResponse.ok) {
            console.error('Failed to create inventory entry:', await inventoryResponse.json());
          }
        }
      }

      // Update the books list with the new book
      setBooks(prevBooks => [...prevBooks, addedBook]);
      setFilteredBooks(prevBooks => [...prevBooks, addedBook]);
      
      // Close the modal
      setIsAddBookOpen(false);

      // Reset form
      setNewBook({
        isbn: "",
        title_ar: "",
        title_en: "",
        print_cost: 0,
        published_at: format(new Date(), "yyyy-MM-dd"),
        price: 0,
        status: null,
        genre: null,
        is_direct_product: false,
        cover_image: null,
      });
      setNewBookInventory([]);

      toast({
        title: "Book Added",
        description: `${addedBook.isbn} has been added to the inventory.`,
        variant: "default",
      });

      showAlert("success", `New book "${addedBook.isbn}" has been successfully added to the inventory.`);
    } catch (error) {
      console.error("Error adding book:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add book",
        variant: "destructive",
      });
      showAlert("error", "Failed to add book. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle updating a book
  const handleUpdateBook = async () => {
    if (!selectedBook) return
    setIsSubmitting(true)
  
    try {
      // Log the selected book data before processing
      console.log('Selected book before update:', selectedBook);
      
      // Create a clean data object for the API
      const updatedData = {
        isbn: selectedBook.isbn,
        title_ar: selectedBook.title_ar,
        title_en: selectedBook.title_en,
        print_cost: selectedBook.print_cost,
        published_at: selectedBook.published_at,
        price: selectedBook.price,
        is_direct_product: selectedBook.is_direct_product,
        genre_id: typeof selectedBook.genre === 'object' ? selectedBook.genre.id : selectedBook.genre,
        status_id: typeof selectedBook.status === 'object' ? selectedBook.status.id : selectedBook.status,
      }
      
      // Log the data being sent to the API
      console.log('Data being sent to API:', updatedData);
      
      // Log the API URL
      console.log('API URL:', `${API_URL}/inventory/products/${selectedBook.id}/`);
      
      const response = await fetch(`${API_URL}/inventory/products/${selectedBook.id}/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify(updatedData),
      })
  
      // Log the response status
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errData = await response.json()
        console.error("Update error details:", errData)
        throw new Error(`Failed to update book: ${errData.message || 'Unknown error'}`)
      }
  
      const updatedBook = await response.json()
      console.log('Successfully updated book:', updatedBook);

      // First, delete existing inventory entries for this book
      console.log('Deleting existing inventory for product ID:', selectedBook.id);
      const deleteResponse = await fetch(`${API_URL}/inventory/product/${selectedBook.id}/delete/`, {
        method: "DELETE",
        headers,
      });
      
      console.log('Delete response status:', deleteResponse.status);
      if (!deleteResponse.ok) {
        console.error('Failed to delete existing inventory');
      }

      // Then create new inventory entries
      console.log('Creating new inventory entries:', newBookInventory);
      for (const inv of newBookInventory) {
        const inventoryData = {
          product: selectedBook.id,
          warehouse: inv.warehouse,
          quantity: inv.quantity,
        };
        console.log('Sending inventory data:', inventoryData);
        
        const inventoryResponse = await fetch(`${API_URL}/inventory/inventory/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
          body: JSON.stringify(inventoryData),
        });

        console.log('Inventory creation response:', inventoryResponse.status);
        if (!inventoryResponse.ok) {
          const errorData = await inventoryResponse.json();
          console.error('Failed to create inventory:', errorData);
        }
      }

      const updatedBooks = books.map((b) => (b.id === updatedBook.id ? updatedBook : b))
      setBooks(updatedBooks)
      setFilteredBooks(updatedBooks)
      setIsEditBookOpen(false)
  
      toast({
        title: "Book Updated",
        description: `${updatedBook.isbn} has been updated.`,
      })
  
      showAlert("success", `Book "${updatedBook.isbn}" has been successfully updated.`)
    } catch (error) {
      console.error("Error updating book:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update book",
        variant: "destructive",
      })
      showAlert("error", "Failed to update book. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }
  

  // Handle deleting a book
  const handleDeleteBook = async () => {
    if (deleteBookId === null) return
    setIsSubmitting(true)

    try {
      const bookToDelete = books.find((b) => b.id === deleteBookId)
      if (!bookToDelete) return

      const response = await fetch(`${API_URL}/inventory/products/${deleteBookId}/delete/`, {
        method: "DELETE",
        headers,
      })

      if (!response.ok) {
        throw new Error("Failed to delete book")
      }

      setBooks(books.filter((b) => b.id !== deleteBookId))
      setDeleteBookId(null)
      setIsDeleteAlertOpen(false)
      setDeleteConfirm("")

      toast({
        title: "Book Deleted",
        description: `${bookToDelete.isbn} has been removed from the inventory.`,
        variant: "destructive",
      })

      showAlert("warning", `Book "${bookToDelete.isbn}" has been permanently deleted from the inventory.`)
    } catch (error) {
      console.error("Error deleting book:", error)
      toast({
        title: "Error",
        description: "Failed to delete book",
        variant: "destructive",
      })
      showAlert("error", "Failed to delete book. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle book transfer
  const handleTransfer = async () => {
    setIsSubmitting(true)
    try {
      // Validate transfer data
      if (!transfer.product || !transfer.from_warehouse || !transfer.to_warehouse || !transfer.quantity) {
        throw new Error("Please fill all required fields")
      }

      if (transfer.from_warehouse === transfer.to_warehouse) {
        throw new Error("Source and destination warehouses cannot be the same")
      }

      // Check if there's enough inventory in the source warehouse
      const sourceInventory = inventory.find(
        (i) => i.product === transfer.product && i.warehouse === transfer.from_warehouse,
      )

      if (!sourceInventory || sourceInventory.quantity < (transfer.quantity || 0)) {
        throw new Error("Not enough inventory in the source warehouse")
      }

      const response = await fetch(`${API_URL}/transfers/`, {
        method: "POST",
        headers,
        body: JSON.stringify(transfer),
      })

      if (!response.ok) {
        throw new Error("Failed to create transfer")
      }

      // Refresh inventory data after transfer
      const inventoryResponse = await fetch(`${API_URL}/inventory/`, {
        headers,
      })

      if (!inventoryResponse.ok) {
        throw new Error("Failed to refresh inventory")
      }

      const inventoryData = await inventoryResponse.json()

      // Enhance inventory with warehouse names
      const enhancedInventory = inventoryData.map((item: Inventory) => {
        const warehouse = warehouses.find((w) => w.id === item.warehouse)
        return {
          ...item,
          warehouse_name: warehouse ? warehouse.name_en : "Unknown",
        }
      })

      setInventory(enhancedInventory)

      // If the selected book is open, update its inventory
      if (selectedBook && selectedBook.id === transfer.product) {
        const bookInventory = enhancedInventory.filter((i: Inventory) => i.product === selectedBook.id)
        setSelectedBookInventory(bookInventory)
      }

      setIsTransferOpen(false)

      // Reset transfer form
      setTransfer({
        product: 0,
        from_warehouse: 0,
        to_warehouse: 0,
        quantity: 1,
        shipping_cost: 0,
        transfer_date: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
      })

      toast({
        title: "Transfer Complete",
        description: "Book transfer has been processed successfully.",
        variant: "default",
      })

      showAlert("success", "Book transfer has been processed successfully.")
    } catch (error: any) {
      console.error("Error processing transfer:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to process transfer",
        variant: "destructive",
      })
      showAlert("error", error.message || "Failed to process transfer. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Reset filters
  const resetFilters = () => {
    setSearchQuery("")
    setSelectedGenre(null)
    setSelectedStatus(null)
  }

  // Helper function to get full image URL
  const getImageUrl = (url: string | null) => {
    if (!url) return "/placeholder.svg"
    if (url.startsWith('http')) return url
    // Remove any leading slash to avoid double slashes
    const cleanUrl = url.startsWith('/') ? url.slice(1) : url
    // Construct the full URL using the API base URL
    return `${API_URL.replace('/api', '')}${cleanUrl}`
  }

  // Handle adding inventory
  const handleAddInventory = async () => {
    if (isAddBookOpen) {
      // For new book, just update the state
      // The inventory will be created when the book is saved
      setIsAddInventoryOpen(false);
      return;
    }
    
    if (!selectedBook) return;
    setIsSubmitting(true);
    
    try {
      // Create inventory entries for the book
      for (const inv of newBookInventory) {
        const response = await fetch(`${API_URL}/inventory/inventory/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
          body: JSON.stringify({
            product: selectedBook.id,
            warehouse: inv.warehouse,
            quantity: inv.quantity,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to add inventory");
        }
      }

      // Refresh the book inventory
      const inventoryResponse = await fetch(`${API_URL}/inventory/inventory/?product_id=${selectedBook.id}`, {
        headers,
      });
      
      if (!inventoryResponse.ok) {
        throw new Error("Failed to fetch updated inventory");
      }
      
      const inventoryData = await inventoryResponse.json();
      
      // Enhance inventory with warehouse names
      const enhancedInventory = inventoryData.map((item: Inventory) => {
        const warehouse = warehouses.find((w) => w.id === item.warehouse);
        return {
          ...item,
          warehouse_name: warehouse ? warehouse.name_en : "Unknown",
        };
      });
      
      setSelectedBookInventory(enhancedInventory);
      setIsAddInventoryOpen(false);
      setNewBookInventory([]);
      
      toast({
        title: "Inventory Added",
        description: "Inventory has been added successfully.",
        variant: "default",
      });
      
      showAlert("success", "Inventory has been added successfully.");
    } catch (error) {
      console.error("Error adding inventory:", error);
      toast({
        title: "Error",
        description: "Failed to add inventory",
        variant: "destructive",
      });
      showAlert("error", "Failed to add inventory. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink asChild>
                    <Link href="/admin">Admin</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Books</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {/* Action Alert */}
          {actionAlert.type && (
            <Alert
              variant={actionAlert.type === "warning" ? "destructive" : "default"}
              className={actionAlert.type === "success" ? "border-green-500 text-green-500" : ""}
            >
              {actionAlert.type === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {actionAlert.type === "success"
                  ? "Success"
                  : actionAlert.type === "warning"
                    ? "Warning"
                    : "Information"}
              </AlertTitle>
              <AlertDescription>{actionAlert.message}</AlertDescription>
            </Alert>
          )}

          <div className="min-h-[50vh] flex-1 rounded-xl bg-muted/50 p-6 md:min-h-min">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h2 className="text-xl font-semibold">Book Management</h2>
                <p className="text-muted-foreground">Manage your book inventory and availability</p>
              </div>
              <Button onClick={() => setIsAddBookOpen(true)} className="bg-primary text-primary-foreground">
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Book
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by ISBN or title..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="flex-1">
                <Select 
                  value={selectedGenre || "all"} 
                  onValueChange={(value) => {
                    console.log('Genre selected:', value)
                    setSelectedGenre(value === "all" ? null : value)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by genre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Genres</SelectItem>
                    {genres.map((genre) => (
                      <SelectItem key={genre.id} value={genre.id.toString()}>
                        {genre.display_name_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Select 
                  value={selectedStatus || "all"} 
                  onValueChange={(value) => {
                    console.log('Status selected:', value)
                    setSelectedStatus(value === "all" ? null : value)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {statusOptions.map((status) => (
                      <SelectItem key={status.id} value={status.id.toString()}>
                        {status.display_name_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={resetFilters}>
                Reset Filters
              </Button>
            </div>

            {/* Books Table */}
            <div className="border rounded-md">
              <div className="bg-muted p-4 flex justify-between items-center">
                <h3 className="font-medium">Books</h3>
                {(searchQuery || selectedGenre || selectedStatus) && (
                  <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 px-2 text-xs">
                    Clear Filters
                  </Button>
                )}
              </div>
              <div className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-sm border-b">
                        <th className="text-left font-medium p-3">Book</th>
                        <th className="text-left font-medium p-3">ISBN</th>
                        <th className="text-left font-medium p-3">Genre</th>
                        <th className="text-left font-medium p-3">Price</th>
                        <th className="text-left font-medium p-3">Status</th>
                        <th className="text-right font-medium p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center">
                            <div className="flex flex-col items-center">
                              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                              <p className="text-muted-foreground">Loading books...</p>
                            </div>
                          </td>
                        </tr>
                      ) : filteredBooks.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center">
                            <div className="flex flex-col items-center">
                              <Book className="h-12 w-12 text-muted-foreground mb-2" />
                              <p className="font-medium mb-1">No books found</p>
                              <p className="text-muted-foreground text-sm mb-4">
                                {searchQuery || selectedGenre || selectedStatus
                                  ? "Try adjusting your filters"
                                  : "Add your first book to get started"}
                              </p>
                              {searchQuery || selectedGenre || selectedStatus ? (
                                <Button variant="outline" size="sm" onClick={resetFilters}>
                                  Clear Filters
                                </Button>
                              ) : (
                                <Button size="sm" onClick={() => setIsAddBookOpen(true)}>
                                  <PlusCircle className="h-4 w-4 mr-2" />
                                  Add Book
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredBooks.map((book) => (
                          <tr key={book.id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                                  <img
                                    src={getImageUrl(book.cover_design)}
                                    alt={`Book ${book.isbn}`}
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                      const img = e.currentTarget;
                                      console.log('Image load failed:', {
                                        src: img.src,
                                        isbn: book.isbn,
                                        cover_design: book.cover_design,
                                        fullUrl: getImageUrl(book.cover_design)
                                      });
                                      img.src = "/placeholder.svg";
                                    }}
                                  />
                                </div>
                                <div>
                                  <p className="font-medium">{book.title_en}</p>
                                  <p className="text-xs text-muted-foreground line-clamp-1">
                                    {book.title_ar}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              <p className="font-mono text-sm">{book.isbn}</p>
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="font-normal">
                                {book.genre !== null ? getGenreName(book.genre) : 'Unknown'}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <div className="flex flex-col">
                                <span className="font-medium">${book.price || 0}</span>
                                <span className="text-xs text-muted-foreground">Cost: ${book.print_cost || 0}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge
                                className={`${
                                  book.status === 1
                                    ? "bg-green-100 text-green-800 hover:bg-green-100 border-green-200"
                                    : book.status === 2
                                      ? "bg-red-100 text-red-800 hover:bg-red-100 border-red-200"
                                      : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200"
                                }`}
                              >
                                {book.status !== null ? getStatusName(book.status) : 'Unknown'}
                              </Badge>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-2">
                                {/* Desktop view - separate buttons */}
                                <div className="hidden sm:flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openBookDetails(book)}
                                  >
                                    <Book className="h-4 w-4" />
                                    <span className="sr-only">View Details</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openEditBook(book)}
                                  >
                                    <Edit className="h-4 w-4" />
                                    <span className="sr-only">Edit</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openTransferModal(book)}
                                  >
                                    <MoveRight className="h-4 w-4" />
                                    <span className="sr-only">Transfer</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => openDeleteDialog(book.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Delete</span>
                                  </Button>
                                </div>

                                {/* Mobile view - dropdown menu */}
                                <div className="sm:hidden">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="outline" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="h-4 w-4" />
                                        <span className="sr-only">Actions</span>
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                      <DropdownMenuItem onClick={() => openBookDetails(book)}>
                                        <Book className="h-4 w-4 mr-2" />
                                        View Details
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => openEditBook(book)}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => openTransferModal(book)}>
                                        <MoveRight className="h-4 w-4 mr-2" />
                                        Transfer
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => openDeleteDialog(book.id)}
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
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
        </div>
      </SidebarInset>

      {/* Book Details Modal */}
      <Dialog open={isBookDetailsOpen} onOpenChange={handleModalClose}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
          {selectedBook && (
            <>
              <DialogHeader>
                <DialogTitle>Book Details: {selectedBook.isbn}</DialogTitle>
                <DialogDescription>Book details and warehouse inventory</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                {/* Book Image */}
                <div className="space-y-4">
                  <div className="aspect-square rounded-lg overflow-hidden border bg-muted">
                    <img
                      src={getImageUrl(selectedBook.cover_design)}
                      alt={`Book ${selectedBook.isbn}`}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        const img = e.currentTarget;
                        console.log('Image load failed:', {
                          src: img.src,
                          isbn: selectedBook.isbn,
                          cover_design: selectedBook.cover_design,
                          fullUrl: getImageUrl(selectedBook.cover_design)
                        });
                        img.src = "/placeholder.svg";
                      }}
                    />
                  </div>
                </div>

                {/* Book Information */}
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
                          {selectedBook.genre !== null ? getGenreName(selectedBook.genre) : 'Unknown'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Price</p>
                        <div className="flex items-baseline gap-2">
                          <p className="font-medium">${selectedBook.price || 0}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Print Cost</p>
                        <p className="font-medium">${selectedBook.print_cost || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <div className="mt-1">
                          <Badge
                            className={`${
                              selectedBook.status === 1
                                ? "bg-green-100 text-green-800 hover:bg-green-100 border-green-200"
                                : selectedBook.status === 2
                                  ? "bg-red-100 text-red-800 hover:bg-red-100 border-red-200"
                                  : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200"
                            }`}
                          >
                            {selectedBook.status !== null ? getStatusName(selectedBook.status) : 'Unknown'}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Published Date</p>
                        <p className="font-medium">{format(new Date(selectedBook.published_at), "MMM dd, yyyy")}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-2">Internal Layout</h3>
                    <p className="text-muted-foreground whitespace-pre-line">{selectedBook.title_ar}</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-2">Cover Design</h3>
                    <p className="text-muted-foreground whitespace-pre-line">{selectedBook.title_en}</p>
                  </div>
                </div>
              </div>

              {/* Warehouse Inventory */}
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

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsBookDetailsOpen(false)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setIsBookDetailsOpen(false)
                    openEditBook(selectedBook)
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Book
                </Button>
                <Button
                  onClick={() => {
                    setIsBookDetailsOpen(false)
                    openTransferModal(selectedBook)
                  }}
                >
                  <MoveRight className="h-4 w-4 mr-2" />
                  Transfer
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Book Dialog */}
      <Dialog open={isAddBookOpen} onOpenChange={(open) => setIsAddBookOpen(open)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Book</DialogTitle>
            <DialogDescription>Create a new book for your inventory.</DialogDescription>
          </DialogHeader>
          <form
                ref={formRef}
                className="space-y-6 py-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  handleAddBook()
                }}
              >
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Information</TabsTrigger>
                <TabsTrigger value="details">Details & Pricing</TabsTrigger>
                <TabsTrigger value="inventory">Inventory & Warehouse</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                  <div>
                    <Label htmlFor="genre">Genre</Label>
                    <Select
                      value={newBook.genre?.toString() || ""}
                      onValueChange={(value) => setNewBook({ ...newBook, genre: Number.parseInt(value) })}
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

                  <div className="md:col-span-2">
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

                  <div className="md:col-span-2">
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

                  <div className="md:col-span-2">
                    <Label>Book Cover Image</Label>
                    <div className="border rounded-md p-4 bg-muted/30 mt-1">
                      <div className="text-center mb-4">
                        {newBook.cover_image ? (
                          <div className="relative w-32 h-32 mx-auto">
                            <img
                              src={newBook.cover_image}
                              alt="Book cover preview"
                              className="w-full h-full object-cover rounded-md"
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute -top-2 -right-2 h-6 w-6"
                              onClick={() => setNewBook({ ...newBook, cover_image: null })}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm font-medium">Book Cover Image</p>
                          </>
                        )}
                      </div>
                      <div className="flex justify-center">
                        <input
                          type="file"
                          id="cover-image"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setNewBook({ ...newBook, cover_image: reader.result as string });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <Button
                        type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.preventDefault();
                            e.stopPropagation();
                            document.getElementById('cover-image')?.click();
                          }}
                        >
                          {newBook.cover_image ? 'Change Image' : 'Upload Image'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="details" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price">Price ($)</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={newBook.price || ""}
                      onChange={(e) => setNewBook({ ...newBook, price: Number.parseFloat(e.target.value) })}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="print_cost">Print Cost ($)</Label>
                    <Input
                      id="print_cost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={newBook.print_cost || ""}
                      onChange={(e) => setNewBook({ ...newBook, print_cost: Number.parseFloat(e.target.value) })}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={newBook.status?.toString() || ""}
                      onValueChange={(value) => setNewBook({ ...newBook, status: value ? parseInt(value) : null })}
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
                    <Label htmlFor="published_at">Published Date</Label>
                    <div className="mt-1">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant={"outline"} className="w-full justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {newBook.published_at ? format(new Date(newBook.published_at), "PPP") : "Select date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent
                            mode="single"
                            selected={newBook.published_at ? new Date(newBook.published_at) : undefined}
                            onSelect={(date) =>
                              setNewBook({
                                ...newBook,
                                published_at: date ? format(date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
                              })
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_direct_product"
                      checked={newBook.is_direct_product || false}
                      onCheckedChange={(checked) => setNewBook({ ...newBook, is_direct_product: checked })}
                    />
                    <Label htmlFor="is_direct_product">Direct Product</Label>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="inventory" className="space-y-4 pt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Warehouse Inventory</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (warehouses.length > 0) {
                          setNewBookInventory([
                            ...newBookInventory,
                            { warehouse: warehouses[0].id, quantity: 0 }
                          ]);
                        }
                      }}
                    >
                      Add Warehouse
                    </Button>
                  </div>
                  
                  <div className="border rounded-md">
                    <div className="bg-muted p-4 flex justify-between items-center">
                      <h3 className="font-medium">Inventory</h3>
                    </div>
                    <div className="p-0">
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
                            {newBookInventory.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="py-8 text-center">
                                  <div className="flex flex-col items-center">
                                    <p className="text-muted-foreground mb-4">No inventory records added yet.</p>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => {
                                        if (warehouses.length > 0) {
                                          setNewBookInventory([
                                            { warehouse: warehouses[0].id, quantity: 0 }
                                          ]);
                                        }
                                      }}
                                    >
                                      Add Warehouse
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              newBookInventory.map((item, index) => {
                                const warehouse = warehouses.find(w => w.id === item.warehouse);
                                return (
                                  <tr key={index} className="border-b last:border-0 hover:bg-muted/50">
                                    <td className="p-3">
                                      <Select
                                        value={item.warehouse.toString()}
                                        onValueChange={(value) => {
                                          const updatedInventory = [...newBookInventory];
                                          updatedInventory[index] = {
                                            ...updatedInventory[index],
                                            warehouse: parseInt(value)
                                          };
                                          setNewBookInventory(updatedInventory);
                                        }}
                                      >
                                        <SelectTrigger className="w-[200px]">
                                          <SelectValue placeholder="Select warehouse" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {warehouses.map((warehouse) => (
                                            <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                                              {warehouse.name_en}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </td>
                                    <td className="p-3">
                                      <Input
                                        type="number"
                                        min="0"
                                        value={item.quantity}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                          const updatedInventory = [...newBookInventory];
                                          updatedInventory[index] = {
                                            ...updatedInventory[index],
                                            quantity: parseInt(e.target.value) || 0
                                          };
                                          setNewBookInventory(updatedInventory);
                                        }}
                                        className="w-[100px]"
                                      />
                                    </td>
                                    <td className="p-3 text-right">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                          const updatedInventory = [...newBookInventory];
                                          updatedInventory.splice(index, 1);
                                          setNewBookInventory(updatedInventory);
                                        }}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddBookOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" onClick={handleAddBook} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Book
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Book Dialog */}
      <Dialog open={isEditBookOpen} onOpenChange={(open) => setIsEditBookOpen(open)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
          {selectedBook && (
            <>
              <DialogHeader>
                <DialogTitle>Edit Book: {selectedBook.isbn}</DialogTitle>
                <DialogDescription>Update book information.</DialogDescription>
              </DialogHeader>
              <form
                ref={formRef}
                className="space-y-6 py-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  handleUpdateBook()
                }}
              >
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="basic">Basic Information</TabsTrigger>
                    <TabsTrigger value="details">Details & Pricing</TabsTrigger>
                    <TabsTrigger value="inventory">Inventory & Warehouse</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit-isbn">ISBN</Label>
                        <Input
                          id="edit-isbn"
                          value={selectedBook.isbn}
                          onChange={(e) => setSelectedBook({ ...selectedBook, isbn: e.target.value })}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="edit-genre">Genre</Label>
                        <Select
                        value={selectedBook?.genre?.id?.toString() || ""}
                        onValueChange={(value) => {
                          const genreObj = genres.find(g => g.id === parseInt(value))
                          setSelectedBook(prev => prev ? { ...prev, genre: genreObj || null } : null)
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

                      <div className="md:col-span-2">
                        <Label htmlFor="edit-title_ar">Title (Arabic)</Label>
                        <Textarea
                          id="edit-title_ar"
                          value={selectedBook.title_ar}
                          onChange={(e) => setSelectedBook({ ...selectedBook, title_ar: e.target.value })}
                          rows={4}
                          className="mt-1"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label htmlFor="edit-title_en">Title (English)</Label>
                        <Textarea
                          id="edit-title_en"
                          value={selectedBook.title_en}
                          onChange={(e) => setSelectedBook({ ...selectedBook, title_en: e.target.value })}
                          rows={4}
                          className="mt-1"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label>Book Cover Image</Label>
                        <div className="border rounded-md p-4 bg-muted/30 mt-1">
                          <div className="aspect-square rounded-md overflow-hidden mb-4 max-h-[200px]">
                            <img
                              src={getImageUrl(selectedBook.cover_design)}
                              alt={`Book ${selectedBook.isbn}`}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                const img = e.currentTarget;
                                console.log('Image load failed:', {
                                  src: img.src,
                                  isbn: selectedBook.isbn,
                                  cover_design: selectedBook.cover_design,
                                  fullUrl: getImageUrl(selectedBook.cover_design)
                                });
                                img.src = "/placeholder.svg";
                              }}
                            />
                          </div>
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
                                      cover_image: reader.result as string
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
                              Change Image
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="details" className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit-price">Price ($)</Label>
                        <Input
                          id="edit-price"
                          type="number"
                          step="0.01"
                          min="0"
                          value={selectedBook.price}
                          onChange={(e) =>
                            setSelectedBook({ ...selectedBook, price: Number.parseFloat(e.target.value) })
                          }
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="edit-print_cost">Print Cost ($)</Label>
                        <Input
                          id="edit-print_cost"
                          type="number"
                          step="0.01"
                          min="0"
                          value={selectedBook.print_cost}
                          onChange={(e) =>
                            setSelectedBook({ ...selectedBook, print_cost: Number.parseFloat(e.target.value) })
                          }
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="edit-status">Status</Label>
                        <Select
                          value={selectedBook?.status?.id?.toString() || ""}
                          onValueChange={(value) => {
                            const statusObj = statusOptions.find(s => s.id === parseInt(value))
                            setSelectedBook(prev => prev ? { ...prev, status: statusObj || null } : null)
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
                        <Label htmlFor="edit-published_at">Published Date</Label>
                        <div className="mt-1">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant={"outline"} className="w-full justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {format(new Date(selectedBook.published_at), "PPP")}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <CalendarComponent
                                mode="single"
                                selected={new Date(selectedBook.published_at)}
                                onSelect={(date) =>
                                  setSelectedBook({
                                    ...selectedBook,
                                    published_at: date
                                      ? format(date, "yyyy-MM-dd")
                                      : selectedBook.published_at,
                                  })
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="edit-is_direct_product"
                          checked={selectedBook.is_direct_product}
                          onCheckedChange={(checked) =>
                            setSelectedBook({ ...selectedBook, is_direct_product: checked })
                          }
                        />
                        <Label htmlFor="edit-is_direct_product">Direct Product</Label>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="inventory" className="space-y-4 pt-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">Warehouse Inventory</h3>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (warehouses.length > 0) {
                              setNewBookInventory([
                                ...newBookInventory,
                                { warehouse: warehouses[0].id, quantity: 0 }
                              ]);
                            }
                          }}
                        >
                          Add Warehouse
                        </Button>
                      </div>
                      
                      <div className="border rounded-md">
                        <div className="bg-muted p-4 flex justify-between items-center">
                          <h3 className="font-medium">Inventory</h3>
                        </div>
                        <div className="p-0">
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
                                {newBookInventory.length === 0 ? (
                                  <tr>
                                    <td colSpan={3} className="py-8 text-center">
                                      <div className="flex flex-col items-center">
                                        <p className="text-muted-foreground mb-4">No inventory records added yet.</p>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          onClick={() => {
                                            if (warehouses.length > 0) {
                                              setNewBookInventory([
                                                { warehouse: warehouses[0].id, quantity: 0 }
                                              ]);
                                            }
                                          }}
                                        >
                                          Add Warehouse
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                ) : (
                                  newBookInventory.map((item, index) => {
                                    const warehouse = warehouses.find(w => w.id === item.warehouse);
                                    return (
                                      <tr key={index} className="border-b last:border-0 hover:bg-muted/50">
                                        <td className="p-3">
                                          <Select
                                            value={item.warehouse.toString()}
                                            onValueChange={(value) => {
                                              const updatedInventory = [...newBookInventory];
                                              updatedInventory[index] = {
                                                ...updatedInventory[index],
                                                warehouse: parseInt(value)
                                              };
                                              setNewBookInventory(updatedInventory);
                                            }}
                                          >
                                            <SelectTrigger className="w-[200px]">
                                              <SelectValue placeholder="Select warehouse" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {warehouses.map((warehouse) => (
                                                <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                                                  {warehouse.name_en}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </td>
                                        <td className="p-3">
                                          <Input
                                            type="number"
                                            min="0"
                                            value={item.quantity}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                              const updatedInventory = [...newBookInventory];
                                              updatedInventory[index] = {
                                                ...updatedInventory[index],
                                                quantity: parseInt(e.target.value) || 0
                                              };
                                              setNewBookInventory(updatedInventory);
                                            }}
                                            className="w-[100px]"
                                          />
                                        </td>
                                        <td className="p-3 text-right">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                              const updatedInventory = [...newBookInventory];
                                              updatedInventory.splice(index, 1);
                                              setNewBookInventory(updatedInventory);
                                            }}
                                          >
                                            <X className="h-4 w-4" />
                                          </Button>
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsEditBookOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={isTransferOpen} onOpenChange={handleModalClose}>
        <DialogContent className="max-w-[500px]">
          {selectedBook && (
            <>
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
                            <Calendar className="mr-2 h-4 w-4" />
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
                <Button variant="outline" onClick={() => setIsTransferOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleTransfer} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Transfer
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={handleModalClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteBookId !== null && (
                <>
                  You are about to delete <strong>{books.find((b) => b.id === deleteBookId)?.isbn}</strong>. This action
                  cannot be undone. This will permanently remove the book from your inventory.
                  <div className="mt-4">
                    <Label htmlFor="confirm-delete">Type "DELETE" to confirm</Label>
                    <Input
                      id="confirm-delete"
                      value={deleteConfirm}
                      onChange={(e) => setDeleteConfirm(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleModalClose}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBook}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteConfirm !== "DELETE"}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Inventory Dialog */}
      <Dialog open={isAddInventoryOpen} onOpenChange={handleModalClose}>
        <DialogContent className="max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Inventory</DialogTitle>
            <DialogDescription>
              {isAddBookOpen 
                ? "Add inventory for the new book" 
                : `Add inventory for ${selectedBook?.isbn || ""}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-4">
              {newBookInventory.length === 0 ? (
                <div className="text-center py-8 border rounded-lg bg-muted/30">
                  <p className="text-muted-foreground mb-4">No inventory items added yet.</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (warehouses.length > 0) {
                        setNewBookInventory([
                          { warehouse: warehouses[0].id, quantity: 0 }
                        ]);
                      }
                    }}
                  >
                    Add Warehouse
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {newBookInventory.map((item, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <Select
                        value={item.warehouse.toString()}
                        onValueChange={(value) => {
                          const updatedInventory = [...newBookInventory];
                          updatedInventory[index] = {
                            ...updatedInventory[index],
                            warehouse: parseInt(value)
                          };
                          setNewBookInventory(updatedInventory);
                        }}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Select warehouse" />
                        </SelectTrigger>
                        <SelectContent>
                          {warehouses.map((warehouse) => (
                            <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                              {warehouse.name_en}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="0"
                        value={item.quantity}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const updatedInventory = [...newBookInventory];
                          updatedInventory[index] = {
                            ...updatedInventory[index],
                            quantity: parseInt(e.target.value) || 0
                          };
                          setNewBookInventory(updatedInventory);
                        }}
                        className="w-[100px]"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const updatedInventory = [...newBookInventory];
                          updatedInventory.splice(index, 1);
                          setNewBookInventory(updatedInventory);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (warehouses.length > 0) {
                    setNewBookInventory([
                      ...newBookInventory,
                      { warehouse: warehouses[0].id, quantity: 0 }
                    ]);
                  }
                }}
              >
                Add Warehouse
              </Button>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsAddInventoryOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAddInventory} disabled={isSubmitting || newBookInventory.length === 0}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Inventory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}
