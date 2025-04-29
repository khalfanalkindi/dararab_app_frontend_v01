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
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"

// Book interface
interface PrintRun {
  id?: number;
  product: number;
  edition_number: number;
  price: number;
  print_cost: number;
  status: Status | null;
  notes: string;
  published_at?: string;
}

interface BookInterface {
  id?: number;
  isbn: string;
  title_en: string;
  title_ar: string;
  genre: Genre | null;
  status: Status | null;
  cover_design: string | null;
  cover_image?: string | null;
  author: Author | null;
  translator: Translator | null;
  rights_owner: RightsOwner | null;
  reviewer: Reviewer | null;
  is_direct_product: boolean;
  print_runs: PrintRun[];
  price?: number;
  print_cost?: number;
  editions?: {
    published_at: string;
  }[];
}

// Genre interface
interface Genre {
  id: number;
  value: string;
  display_name_en: string;
}

// Status interface
interface Status {
  id: number;
  value: string;
  display_name_en: string;
}

// Warehouse interface
interface Warehouse {
  id: number;
  name_en: string;
  name_ar: string;
  type: number | null;
  location: string;
}

// Inventory interface
interface Inventory {
  id?: number;  // Make id optional since new inventory items won't have an id
  product: number;
  warehouse: number;
  quantity: number;
  notes: string;
  warehouse_name?: string; // For UI display
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

// Add these interfaces at the top with other interfaces
interface Author {
  id: number;
  name: string;
}

interface Translator {
  id: number;
  name: string;
}

interface RightsOwner {
  id: number;
  name: string;
}

interface Reviewer {
  id: number;
  name: string;
}

interface ProductSummary {
  id: number;
  title_ar: string;
  title_en: string;
  isbn: string;
  genre_id: number;
  status_id: number;
  genre_name: string;
  status_name: string;
  author_name: string;
  translator_name: string;
  editions_count: number;
  stock: number;
  latest_price: string;
  latest_cost: string;
  cover_design_url: string;
}

// Add this interface near the other interfaces
interface NewInventory {
  warehouse: string;
  quantity: number;
}

export default function BookManagement() {
  // State for books and filters
  const [books, setBooks] = useState<BookInterface[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<BookInterface[]>([]);
  const [productSummaries, setProductSummaries] = useState<ProductSummary[]>([]);
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
  const [printRunStatusOptions, setPrintRunStatusOptions] = useState<StatusObject[]>([]);
  const [activeTab, setActiveTab] = useState("basic");
  const [actionAlert, setActionAlert] = useState<{
    type: "success" | "error" | "warning" | null
    message: string
  }>({
    type: null,
    message: "",
  })

  // New book state with default values
  const [newBook, setNewBook] = useState<BookInterface>({
    isbn: "",
    title_en: "",
    title_ar: "",
    genre: null,
    status: null,
    cover_design: null,
    is_direct_product: false,
    author: null,
    translator: null,
    rights_owner: null,
    reviewer: null,
    print_runs: []
  });

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

  const [addBookInventory, setAddBookInventory] = useState<InventoryItem[]>([])
  const [editBookInventory, setEditBookInventory] = useState<InventoryItem[]>([])

  // Add these state variables in the BookManagement component
  const [authors, setAuthors] = useState<Author[]>([]);
  const [translators, setTranslators] = useState<Translator[]>([]);
  const [rightsOwners, setRightsOwners] = useState<RightsOwner[]>([]);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);

  // Add this state declaration with the other useState calls
  const [newInventory, setNewInventory] = useState<NewInventory>({
    warehouse: "",
    quantity: 0,
  });

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
  const filteredProductSummaries = productSummaries.filter((book) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      q === "" ||
      book.isbn.toLowerCase().includes(q) ||
      book.title_en.toLowerCase().includes(q) ||
      book.title_ar.toLowerCase().includes(q) ||
      book.author_name?.toLowerCase().includes(q) ||
      book.translator_name?.toLowerCase().includes(q);

    const matchesGenre = !selectedGenre || book.genre_id === parseInt(selectedGenre);
    const matchesStatus = !selectedStatus || book.status_id === parseInt(selectedStatus);

    return matchesSearch && matchesGenre && matchesStatus;
  });

  // Get status name by ID
  const getStatusName = (status: Status | number | null) => {
    if (!status) return 'Unknown';
    const statusId = typeof status === 'object' ? status.id : status;
    const statusObj = statusOptions.find(s => s.id === statusId);
    return statusObj?.display_name_en || 'Unknown';
  };

  // Get genre name by ID
  const getGenreName = (genre: Genre | number | null) => {
    if (!genre) return 'Unknown';
    const genreId = typeof genre === 'object' ? genre.id : genre;
    const genreObj = genres.find(g => g.id === genreId);
    return genreObj?.display_name_en || 'Unknown';
  };

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [
          booksRes,
          genresRes,
          statusRes,
          warehousesRes,
          authorsRes,
          translatorsRes,
          rightsOwnersRes,
          reviewersRes,
          summaryRes,
          printRunStatusRes
        ] = await Promise.all([
          fetch(`${API_URL}/inventory/products/`, { headers }),
          fetch(`${API_URL}/common/list-items/genre/`, { headers }),
          fetch(`${API_URL}/common/list-items/product_status/`, { headers }),
          fetch(`${API_URL}/inventory/warehouses/`, { headers }),
          fetch(`${API_URL}/inventory/authors/`, { headers }),
          fetch(`${API_URL}/inventory/translators/`, { headers }),
          fetch(`${API_URL}/inventory/rights-owners/`, { headers }),
          fetch(`${API_URL}/inventory/reviewers/`, { headers }),
          fetch(`${API_URL}/inventory/product-summary/`, { headers }),
          fetch(`${API_URL}/common/list-items/printrun_status/`, { headers })
        ]);

        if (!booksRes.ok) throw new Error("Failed to fetch books");
        if (!genresRes.ok) throw new Error("Failed to fetch genres");
        if (!statusRes.ok) throw new Error("Failed to fetch status options");
        if (!warehousesRes.ok) throw new Error("Failed to fetch warehouses");
        if (!authorsRes.ok) throw new Error("Failed to fetch authors");
        if (!translatorsRes.ok) throw new Error("Failed to fetch translators");
        if (!rightsOwnersRes.ok) throw new Error("Failed to fetch rights owners");
        if (!reviewersRes.ok) throw new Error("Failed to fetch reviewers");
        if (!summaryRes.ok) throw new Error("Failed to fetch product summaries");
        if (!printRunStatusRes.ok) throw new Error("Failed to fetch print run status options");

        const booksData = await booksRes.json();
        const genresData = await genresRes.json();
        const statusData = await statusRes.json();
        const warehousesData = await warehousesRes.json();
        const authorsData = await authorsRes.json();
        const translatorsData = await translatorsRes.json();
        const rightsOwnersData = await rightsOwnersRes.json();
        const reviewersData = await reviewersRes.json();
        const summaryData = await summaryRes.json();
        const printRunStatusData = await printRunStatusRes.json();

        // Log product summaries data
        console.log('Product Summaries Data:', summaryData);
        console.log('Product Summaries Array:', Array.isArray(summaryData) ? summaryData : summaryData.results ?? []);

        setBooks(Array.isArray(booksData) ? booksData : booksData.results ?? []);
        setGenres(Array.isArray(genresData) ? genresData : genresData.results ?? []);
        setStatusOptions(Array.isArray(statusData) ? statusData : statusData.results ?? []);
        setWarehouses(Array.isArray(warehousesData) ? warehousesData : warehousesData.results ?? []);
        setAuthors(Array.isArray(authorsData) ? authorsData : authorsData.results ?? []);
        setTranslators(Array.isArray(translatorsData) ? translatorsData : translatorsData.results ?? []);
        setRightsOwners(Array.isArray(rightsOwnersData) ? rightsOwnersData : rightsOwnersData.results ?? []);
        setReviewers(Array.isArray(reviewersData) ? reviewersData : reviewersData.results ?? []);
        setProductSummaries(Array.isArray(summaryData) ? summaryData : summaryData.results ?? []);
        setPrintRunStatusOptions(Array.isArray(printRunStatusData) ? printRunStatusData : printRunStatusData.results ?? []);

        setFilteredBooks(Array.isArray(booksData) ? booksData : booksData.results ?? []);
        setIsLoading(false);
      } catch (error) {
        console.error("Error loading data:", error);
        toast({
          title: "Error",
          description: "Failed to load data",
          variant: "destructive",
        });
        setIsLoading(false);
      }
    };
  
    loadData();
  }, []);
  
  

  // Open book details modal
  const openBookDetails = async (book: BookInterface | ProductSummary) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("accessToken");
      if (!token) {
        showAlert("error", "Authentication token not found");
        return;
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // If it's a ProductSummary, we need to fetch the full book details
      if ('genre_name' in book) {
        // Fetch book details
        const bookRes = await fetch(`${API_URL}/inventory/products/${book.id}/detail/`, { headers });
        if (!bookRes.ok) throw new Error("Failed to fetch book details");
        const bookData = await bookRes.json();
        
        // Fetch inventory data
        const inventoryRes = await fetch(`${API_URL}/inventory/inventory/?product_id=${book.id}`, { headers });
        if (!inventoryRes.ok) throw new Error("Failed to fetch inventory");
        const inventoryData = await inventoryRes.json();
        
        // Fetch print runs data
        const printRunsRes = await fetch(`${API_URL}/inventory/print-runs/?product_id=${book.id}`, { headers });
        if (!printRunsRes.ok) throw new Error("Failed to fetch print runs");
        const printRunsData = await printRunsRes.json();
        
        // Process inventory data
        const processedInventory = Array.isArray(inventoryData) ? inventoryData : inventoryData.results ?? [];
        const enhancedInventory = processedInventory.map((item: any) => {
          const wid = typeof item.warehouse === "object" ? item.warehouse.id : item.warehouse;
          const wh = warehouses.find((w) => w.id === wid);
          return {
            ...item,
            warehouse: wid,
            warehouse_name: wh?.name_en ?? "Unknown",
          };
        });

        // Process print runs data
        const processedPrintRuns = Array.isArray(printRunsData) ? printRunsData : printRunsData.results ?? [];
        
        setSelectedBook({
          ...bookData,
          print_runs: processedPrintRuns
        });
        setSelectedBookInventory(enhancedInventory);
      } else {
        setSelectedBook(book);
        // Fetch inventory data for existing book
        const inventoryRes = await fetch(`${API_URL}/inventory/inventory/?product_id=${book.id}`, { headers });
        if (!inventoryRes.ok) throw new Error("Failed to fetch inventory");
        const inventoryData = await inventoryRes.json();
        
        // Fetch print runs data
        const printRunsRes = await fetch(`${API_URL}/inventory/print-runs/?product_id=${book.id}`, { headers });
        if (!printRunsRes.ok) throw new Error("Failed to fetch print runs");
        const printRunsData = await printRunsRes.json();
        
        // Process inventory data
        const processedInventory = Array.isArray(inventoryData) ? inventoryData : inventoryData.results ?? [];
        const enhancedInventory = processedInventory.map((item: any) => {
          const wid = typeof item.warehouse === "object" ? item.warehouse.id : item.warehouse;
          const wh = warehouses.find((w) => w.id === wid);
          return {
            ...item,
            warehouse: wid,
            warehouse_name: wh?.name_en ?? "Unknown",
          };
        });

        // Process print runs data
        const processedPrintRuns = Array.isArray(printRunsData) ? printRunsData : printRunsData.results ?? [];
        
        setSelectedBook({
          ...book,
          print_runs: processedPrintRuns
        });
        setSelectedBookInventory(enhancedInventory);
      }

      setIsBookDetailsOpen(true);
    } catch (error) {
      console.error("Error opening book details:", error);
      showAlert("error", "Failed to load book details");
    } finally {
      setIsLoading(false);
    }
  };

  // Open edit book modal
  const openEditBook = async (book: BookInterface | ProductSummary) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("accessToken");
      if (!token) {
        showAlert("error", "Authentication token not found");
        return;
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      console.log('📚 Opening edit book for:', book);
      console.log('🏢 Available warehouses:', warehouses);

      // If it's a ProductSummary, we need to fetch the full book details
      if ('genre_name' in book) {
        console.log('📖 Fetching full book details for ProductSummary');
        const bookRes = await fetch(`${API_URL}/inventory/products/${book.id}/detail/`, { headers });
        if (!bookRes.ok) throw new Error("Failed to fetch book details");
        const bookData = await bookRes.json();
        console.log('📖 Fetched book details:', bookData);

        // Fetch print runs data
        const printRunsRes = await fetch(`${API_URL}/inventory/print-runs/?product_id=${book.id}`, { headers });
        if (!printRunsRes.ok) throw new Error("Failed to fetch print runs");
        const printRunsData = await printRunsRes.json();
        console.log('📖 Fetched print runs:', printRunsData);
        
        // Fetch inventory data
        const inventoryRes = await fetch(`${API_URL}/inventory/inventory/?product_id=${book.id}`, { headers });
        if (!inventoryRes.ok) throw new Error("Failed to fetch inventory");
        const inventoryData = await inventoryRes.json();
        console.log('📦 Raw inventory data:', inventoryData);
        
        // Process print runs data
        const processedPrintRuns = Array.isArray(printRunsData) ? printRunsData : printRunsData.results ?? [];
        console.log('📖 Processed print runs:', processedPrintRuns);
        
        // Process inventory data
        const processedInventory = Array.isArray(inventoryData) ? inventoryData : inventoryData.results ?? [];
        console.log('📦 Processed inventory:', processedInventory);
        
        // Add warehouse information to inventory items
        const inventoryWithWarehouses = processedInventory.map((item: any) => {
          console.log('🏢 Processing inventory item:', item);
          return {
            id: item.id,
            product: item.product.id,
            warehouse: item.warehouse.id,
            quantity: item.quantity,
            notes: item.notes || '',
            warehouse_name: item.warehouse.name_en || ''
          };
        });
        console.log('📦 Inventory with warehouse names:', inventoryWithWarehouses);
        
        const updatedBookData = {
          ...bookData,
          print_runs: processedPrintRuns,
          inventory: inventoryWithWarehouses
        };
        console.log('📚 Final book data to be set:', updatedBookData);
        setEditBookInventory(inventoryWithWarehouses);
        setSelectedBook(updatedBookData);
      } else {
        console.log('📖 Using existing BookInterface');
        // Fetch print runs data for existing book
        const printRunsRes = await fetch(`${API_URL}/inventory/print-runs/?product_id=${book.id}`, { headers });
        if (!printRunsRes.ok) throw new Error("Failed to fetch print runs");
        const printRunsData = await printRunsRes.json();
        console.log('📖 Fetched print runs:', printRunsData);
        
        // Fetch inventory data
        const inventoryRes = await fetch(`${API_URL}/inventory/inventory/?product_id=${book.id}`, { headers });
        if (!inventoryRes.ok) throw new Error("Failed to fetch inventory");
        const inventoryData = await inventoryRes.json();
        console.log('📦 Raw inventory data:', inventoryData);
        
        // Process print runs data
        const processedPrintRuns = Array.isArray(printRunsData) ? printRunsData : printRunsData.results ?? [];
        console.log('📖 Processed print runs:', processedPrintRuns);
        
        // Process inventory data
        const processedInventory = Array.isArray(inventoryData) ? inventoryData : inventoryData.results ?? [];
        console.log('📦 Processed inventory:', processedInventory);
        
        // Add warehouse information to inventory items
        const inventoryWithWarehouses = processedInventory.map((item: any) => {
          console.log('🏢 Processing inventory item:', item);
          return {
            id: item.id,
            product: item.product.id,
            warehouse: item.warehouse.id,
            quantity: item.quantity,
            notes: item.notes || '',
            warehouse_name: item.warehouse.name_en || ''
          };
        });
        console.log('📦 Inventory with warehouse names:', inventoryWithWarehouses);
        setEditBookInventory(inventoryWithWarehouses)
        const updatedBook = {
          ...book,
          print_runs: processedPrintRuns,
          inventory: inventoryWithWarehouses
        };
        console.log('📚 Final book data to be set:', updatedBook);
        
        setSelectedBook(updatedBook);
      }

      // Set active tab to basic information
      setActiveTab("basic");
      setIsEditBookOpen(true);
    } catch (error) {
      console.error("Error opening edit book:", error);
      showAlert("error", "Failed to load book details");
    } finally {
      setIsLoading(false);
    }
  };

  // Open transfer modal
  const openTransferModal = (book: BookInterface | ProductSummary) => {
    setSelectedBook(book as BookInterface);
    setIsTransferOpen(true);
  };

  // Open delete confirmation
  const openDeleteDialog = (bookId: number | undefined) => {
    if (!bookId) {
      showAlert("error", "Invalid book ID");
      return;
    }
    try {
      setDeleteBookId(bookId);
      setDeleteConfirm("");
      setIsDeleteAlertOpen(true);
    } catch (error) {
      console.error("Error opening delete dialog:", error);
      showAlert("error", "Failed to open delete dialog");
    }
  };

  // Close all modals
  const handleModalClose = () => {
    setIsBookDetailsOpen(false);
    setIsEditBookOpen(false);
    setIsTransferOpen(false);
    setIsAddInventoryOpen(false);
    setIsDeleteAlertOpen(false);
    resetTransfer();
  };

  // Add this function with other state management functions
  const resetTransfer = () => {
    setTransfer({
      product: 0,
      from_warehouse: 0,
      to_warehouse: 0,
      quantity: 1,
      shipping_cost: 0,
      transfer_date: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
    });
  };

  // Handle adding a new book
  const handleAddBook = async () => {
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem("accessToken");
      if (!token) {
        showAlert("error", "Authentication token not found");
        return;
      }

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      // 1. Create basic book information
      const basicInfoResponse = await fetch(`${API_URL}/inventory/products/`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          isbn: newBook.isbn,
          title_en: newBook.title_en,
          title_ar: newBook.title_ar,
          genre_id: newBook.genre?.id,
          status_id: newBook.status?.id,
          author_id: newBook.author?.id,
          translator_id: newBook.translator?.id,
          rights_owner_id: newBook.rights_owner?.id,
          reviewer_id: newBook.reviewer?.id,
          is_direct_product: newBook.is_direct_product,
          cover_design: newBook.cover_design,
        }),
      });

      if (!basicInfoResponse.ok) {
        const errorData = await basicInfoResponse.json();
        throw new Error(errorData.message || "Failed to create basic information");
      }

      const createdBook = await basicInfoResponse.json();

      // 2. Create print runs
      for (const printRun of newBook.print_runs) {
        const printRunData = {
          product_id: createdBook.id,
          edition_number: printRun.edition_number,
          price: printRun.price,
          print_cost: printRun.print_cost,
          status_id: printRun.status?.id,
          notes: printRun.notes,
          published_at: printRun.published_at,
        };

        const printRunResponse = await fetch(
          `${API_URL}/inventory/print-runs/`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(printRunData),
          }
        );

        if (!printRunResponse.ok) {
          const errorData = await printRunResponse.json();
          throw new Error(errorData.message || "Failed to create print run");
        }
      }

      // 3. Create inventory
      for (const item of newBookInventory) {
        const inventoryData = {
          product: createdBook.id,
          warehouse: item.warehouse,
          quantity: item.quantity,
        };

        const inventoryResponse = await fetch(
          `${API_URL}/inventory/inventory/`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(inventoryData),
          }
        );

        if (!inventoryResponse.ok) {
          const errorData = await inventoryResponse.json();
          throw new Error(errorData.message || "Failed to create inventory");
        }
      }

      // Refresh the product summaries
      const summaryRes = await fetch(`${API_URL}/inventory/product-summary/`, { headers });
      if (!summaryRes.ok) throw new Error("Failed to fetch product summaries");
      const summaryData = await summaryRes.json();
      setProductSummaries(Array.isArray(summaryData) ? summaryData : summaryData.results ?? []);

      // Reset form and close modal
      setNewBook({
        isbn: "",
        title_en: "",
        title_ar: "",
        genre: null,
        status: null,
        cover_design: null,
        author: null,
        translator: null,
        rights_owner: null,
        reviewer: null,
        is_direct_product: false,
        print_runs: [],
      });
      setNewBookInventory([]);
      setIsAddBookOpen(false);
      showAlert("success", "Book created successfully");
    } catch (error: any) {
      console.error("Error creating book:", error);
      showAlert("error", error.message || "Failed to create book");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1) Basic info
async function handleUpdateBasic() {
  if (!selectedBook?.id) return;
  const formData = new FormData();
  
  // Required fields
  formData.append("isbn", selectedBook.isbn);
  formData.append("title_ar", selectedBook.title_ar);
  formData.append("title_en", selectedBook.title_en);
  
  // Optional fields with null handling
  if (selectedBook.genre?.id) {
    formData.append("genre_id", selectedBook.genre.id.toString());
  }
  if (selectedBook.status?.id) {
    formData.append("status_id", selectedBook.status.id.toString());
  }
  if (selectedBook.author?.id) {
    formData.append("author_id", selectedBook.author.id.toString());
  }
  if (selectedBook.translator?.id) {
    formData.append("translator_id", selectedBook.translator.id.toString());
  }
  if (selectedBook.rights_owner?.id) {
    formData.append("rights_owner_id", selectedBook.rights_owner.id.toString());
  }
  if (selectedBook.reviewer?.id) {
    formData.append("reviewer_id", selectedBook.reviewer.id.toString());
  }
  
  // Boolean field
  formData.append("is_direct_product", selectedBook.is_direct_product.toString());
  
  // Image field
  if (selectedBook.cover_image) {
    formData.append("cover_design", selectedBook.cover_image);
  }

  // Log the data being sent
  for (let [key, value] of formData.entries()) {
    console.log(`${key}: ${value}`);
  }

  const res = await fetch(
    `${API_URL}/inventory/products/${selectedBook.id}/`,
    { 
      method: "PUT", 
      headers: { 
        Authorization: `Bearer ${localStorage.getItem("accessToken")}` 
      }, 
      body: formData 
    }
  );
  
  if (!res.ok) {
    const errorData = await res.json();
    console.error('Update error:', errorData);
    throw new Error(errorData.message || "Failed to update basic info");
  }

  // After successful update, refresh the books data
  const response = await fetch(`${API_URL}/inventory/product-summary/`, { headers });
  if (!response.ok) throw new Error("Failed to refresh books");
  const data = await response.json();
  const booksArray = Array.isArray(data) ? data : data.results || [];
  setBooks(booksArray);
  setFilteredBooks(booksArray);
}

async function handleUpdateDetails() {
  if (!selectedBook?.id) return;
  const token = localStorage.getItem("accessToken");
  if (!token) {
    showAlert("error", "Authentication token not found");
      return;
    }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }

  try {
    for (const run of selectedBook.print_runs) {
      if (run.id) {
        // Update existing print run
        const updateData = {
          product_id: selectedBook.id,
          edition_number: run.edition_number,
          price: run.price,
          print_cost: run.print_cost,
          status_id: run.status?.id,
          notes: run.notes,
          published_at: run.published_at,
        };
        console.log('Updating print run:', updateData);
        const response = await fetch(
          `${API_URL}/inventory/print-runs/${run.id}/`,
          { method: 'PUT', headers, body: JSON.stringify(updateData) }
        )
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Update failed:', errorData);
          throw new Error(`Failed updating run ${run.edition_number}: ${JSON.stringify(errorData)}`)
        }
      } else {
        // Create new print run
        const createData = {
          product_id: selectedBook.id,
          edition_number: run.edition_number,
          price: run.price,
          print_cost: run.print_cost,
          status_id: run.status?.id,
          notes: run.notes,
          published_at: run.published_at,
        };
        console.log('Creating print run:', createData);
        const response = await fetch(
          `${API_URL}/inventory/print-runs/`,
          { method: 'POST', headers, body: JSON.stringify(createData) }
        )
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Creation failed:', errorData);
          throw new Error(`Failed creating run ${run.edition_number}: ${JSON.stringify(errorData)}`)
        }
      }
    }

    showAlert("success", "Print runs synchronized successfully")
  } catch (error: any) {
    console.error('Error in handleUpdateDetails:', error)
    showAlert("error", error.message)
    throw error
  }
}



// 3) Inventory & warehouses
async function handleUpdateInventory() {
  if (!selectedBook) return;

  const token = localStorage.getItem("accessToken");
  if (!token) {
    showAlert("error", "Authentication required");
      return;
    }
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  try {
    for (const record of selectedBookInventory) {
      const payload = {
        product: selectedBook.id,
        warehouse: record.warehouse,
        quantity: record.quantity,
      };

      const isUpdate = Boolean(record.id);
      const url = isUpdate
        ? `${API_URL}/inventory/inventory/${record.id}/`
        : `${API_URL}/inventory/inventory/`;
      const method = isUpdate ? "PUT" : "POST";

      console.log(`${method} →`, url, payload);
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error(`${method} inventory failed:`, errData);
        throw new Error(errData.detail || `Failed to ${method} inventory`);
      }
    }

    // re‑fetch to sync UI
    const verifyRes = await fetch(
      `${API_URL}/inventory/inventory/?product_id=${selectedBook.id}`,
      { headers }
    );
    const fresh = await verifyRes.json();
    setSelectedBookInventory(
      fresh.map((i: any) => ({
        id: i.id,
        warehouse: typeof i.warehouse === "object" ? i.warehouse.id : i.warehouse,
        quantity: i.quantity,
        warehouse_name:
          typeof i.warehouse === "object"
            ? i.warehouse.name_en
            : warehouses.find((w) => w.id === i.warehouse)?.name_en || "Unknown",
      }))
    );

    showAlert("success", "Inventory saved successfully");
  } catch (err: any) {
    console.error("Inventory error:", err);
    showAlert("error", err.message);
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
    if (!selectedBook) return;

    try {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        showAlert("error", "Authentication token not found");
        return;
      }

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      // Create new inventory item
      const payload = {
        product: selectedBook.id,
        warehouse: newInventory.warehouse,
        quantity: newInventory.quantity,
      };

      const response = await fetch(`${API_URL}/inventory/inventory/`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create inventory");
      }

      // Refresh the inventory data
      const inventoryResponse = await fetch(
        `${API_URL}/inventory/inventory/?product_id=${selectedBook.id}`,
        { headers }
      );

      if (!inventoryResponse.ok) {
        throw new Error("Failed to refresh inventory data");
      }

      const inventoryData = await inventoryResponse.json();
      const invArr = Array.isArray(inventoryData) ? inventoryData : inventoryData.results ?? [];

      const enhancedInventory = invArr.map((item: any) => {
        const wid = typeof item.warehouse === "object"
          ? item.warehouse.id
          : item.warehouse;
        const wh = warehouses.find((w) => w.id === wid);
        return {
          ...item,
          warehouse: wid,
          warehouse_name: wh?.name_en ?? "Unknown",
        };
      });

      setSelectedBookInventory(enhancedInventory);
      setNewInventory({ warehouse: "", quantity: 0 });
      showAlert("success", "Inventory added successfully");
    } catch (error: any) {
      console.error("Error adding inventory:", error);
      showAlert("error", error.message || "Failed to add inventory");
    }
  };

  const handleUpdatePrintRun = async (productId: number, printRun: PrintRun) => {
    try {
      const response = await fetch(`${API_URL}/inventory/products/${productId}/print-runs/update/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(printRun),
      });

      if (!response.ok) {
        throw new Error('Failed to update print run');
      }

      const updatedPrintRun = await response.json();
      return updatedPrintRun;
    } catch (error) {
      console.error('Error updating print run:', error);
      throw error;
    }
  };

  const handleDeletePrintRun = async (productId: number, editionNumber: number) => {
    try {
      const response = await fetch(`${API_URL}/inventory/products/${productId}/print-runs/delete/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ edition_number: editionNumber }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete print run');
      }

      return true;
    } catch (error) {
      console.error('Error deleting print run:', error);
      throw error;
    }
  };

  const handleDeleteBook = async () => {
    if (!deleteBookId) return;
    
    try {
    setIsSubmitting(true);
      const token = localStorage.getItem("accessToken");
      if (!token) {
        showAlert("error", "Authentication token not found");
        return;
      }

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const response = await fetch(`${API_URL}/inventory/products/${deleteBookId}/`, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete book");
      }

      // Remove the deleted book from the state
      setBooks(books.filter(book => book.id !== deleteBookId));
      setFilteredBooks(filteredBooks.filter(book => book.id !== deleteBookId));
      
      // Close the delete dialog
      setIsDeleteAlertOpen(false);
      setDeleteBookId(null);
      setDeleteConfirm("");
      
      showAlert("success", "Book deleted successfully");
    } catch (error: any) {
      console.error("Error deleting book:", error);
      showAlert("error", error.message || "Failed to delete book");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add this function before the return statement
  const handleSaveChanges = async () => {
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem("accessToken");
      if (!token) {
        showAlert("error", "Authentication token not found");
        return;
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Update book details
      const bookRes = await fetch(`${API_URL}/inventory/products/${selectedBook?.id}/`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          title_en: selectedBook?.title_en,
          title_ar: selectedBook?.title_ar,
          isbn: selectedBook?.isbn,
          genre_id: selectedBook?.genre?.id,
          status_id: selectedBook?.status?.id,
          author_id: selectedBook?.author?.id,
          translator_id: selectedBook?.translator?.id,
          rights_owner_id: selectedBook?.rights_owner?.id,
          reviewer_id: selectedBook?.reviewer?.id,
          is_direct_product: selectedBook?.is_direct_product,
        }),
      });

      if (!bookRes.ok) throw new Error("Failed to update book");

      // Update print runs
      for (const printRun of selectedBook?.print_runs || []) {
        if (printRun.id) {
          // Update existing print run
          const updateRes = await fetch(`${API_URL}/inventory/print-runs/${printRun.id}/`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
              product_id: selectedBook?.id,
              edition_number: printRun.edition_number,
              price: printRun.price,
              print_cost: printRun.print_cost,
              status_id: printRun.status?.id,
              notes: printRun.notes,
              published_at: printRun.published_at,
            }),
          });
          if (!updateRes.ok) throw new Error(`Failed to update print run ${printRun.edition_number}`);
        } else {
          // Create new print run
          const createRes = await fetch(`${API_URL}/inventory/print-runs/`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              product_id: selectedBook?.id,
              edition_number: printRun.edition_number,
              price: printRun.price,
              print_cost: printRun.print_cost,
              status_id: printRun.status?.id,
              notes: printRun.notes,
              published_at: printRun.published_at,
            }),
          });
          if (!createRes.ok) throw new Error(`Failed to create print run ${printRun.edition_number}`);
        }
      }
      selectedBook!.inventory = editBookInventory;

      // Update inventory items
      for (const item of editBookInventory) {
        if (item.id) {
          // Update existing inventory item
          const updateRes = await fetch(`${API_URL}/inventory/inventory/${item.id}/`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
              product_id: selectedBook?.id,
              warehouse_id: typeof item.warehouse === 'object' ? item.warehouse.id : item.warehouse,
              quantity: item.quantity,
              notes: item.notes || '',
            }),
          });
          if (!updateRes.ok) {
            const errorData = await updateRes.json();
            console.error('Inventory update error:', errorData);
            throw new Error(`Failed to update inventory for warehouse ${item.warehouse}`);
          }
        } else {
          // Create new inventory item
          const createRes = await fetch(`${API_URL}/inventory/inventory/`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              product: selectedBook?.id,
              warehouse: typeof item.warehouse === 'object' ? item.warehouse.id : item.warehouse,
              quantity: item.quantity,
              notes: item.notes || '',
            }),
          });
          if (!createRes.ok) {
            const errorData = await createRes.json();
            console.error('Inventory create error:', errorData);
            throw new Error(`Failed to create inventory for warehouse ${item.warehouse}`);
          }
        }
      }

      // Refresh product summaries
      const summaryRes = await fetch(`${API_URL}/inventory/product-summary/`, { headers });
      if (!summaryRes.ok) throw new Error("Failed to fetch product summaries");
      const summaryData = await summaryRes.json();
      setProductSummaries(Array.isArray(summaryData) ? summaryData : summaryData.results ?? []);

      showAlert("success", "Book, editions, and inventory updated successfully");
      setIsEditBookOpen(false);
    } catch (error) {
      console.error("Error updating book:", error);
      showAlert("error", error instanceof Error ? error.message : "Failed to update book");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add this function before the return statement
  const handleTransfer = async () => {
    if (!selectedBook?.id) {
      showAlert("error", "No book selected for transfer");
      return;
    }

    try {
      setIsLoading(true);
      const token = localStorage.getItem("accessToken");
      if (!token) {
        showAlert("error", "Authentication token not found");
        return;
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // First, create the transfer record
      const transferPayload = {
        product: selectedBook.id,
        from_warehouse: transfer.from_warehouse,
        to_warehouse: transfer.to_warehouse,
        quantity: transfer.quantity,
        shipping_cost: transfer.shipping_cost,
        transfer_date: transfer.transfer_date
      };

      const transferRes = await fetch(`${API_URL}/inventory/transfers/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(transferPayload),
      });

      if (!transferRes.ok) {
        const errorData = await transferRes.json();
        console.error('Transfer error:', errorData);
        throw new Error(errorData.detail || "Failed to create transfer");
      }

      // Get current inventory for both warehouses
      const fromInventoryRes = await fetch(`${API_URL}/inventory/inventory/?product=${selectedBook.id}&warehouse=${transfer.from_warehouse}`, { headers });
      if (!fromInventoryRes.ok) throw new Error("Failed to fetch source warehouse inventory");
      const fromInventoryData = await fromInventoryRes.json();
      const fromInventory = Array.isArray(fromInventoryData) ? fromInventoryData[0] : fromInventoryData.results?.[0];

      const toInventoryRes = await fetch(`${API_URL}/inventory/inventory/?product=${selectedBook.id}&warehouse=${transfer.to_warehouse}`, { headers });
      if (!toInventoryRes.ok) throw new Error("Failed to fetch destination warehouse inventory");
      const toInventoryData = await toInventoryRes.json();
      const toInventory = Array.isArray(toInventoryData) ? toInventoryData[0] : toInventoryData.results?.[0];

      const transferQuantity = transfer.quantity || 0;

      // Update source warehouse inventory using the product-specific endpoint
      if (fromInventory) {
        const newFromQuantity = fromInventory.quantity - transferQuantity;
        if (newFromQuantity < 0) {
          throw new Error("Insufficient quantity in source warehouse");
        }
        const updateFromRes = await fetch(`${API_URL}/inventory/inventory/product/${selectedBook.id}/update/`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            product_id: selectedBook.id,
            warehouse_id: transfer.from_warehouse,
            quantity: newFromQuantity,
            notes: fromInventory.notes || ''
          }),
        });
        if (!updateFromRes.ok) {
          const errorData = await updateFromRes.json();
          console.error('Update source inventory error:', errorData);
          throw new Error(errorData.detail || "Failed to update source warehouse inventory");
        }
      }

      // Update destination warehouse inventory using the product-specific endpoint
      if (toInventory) {
        const newToQuantity = toInventory.quantity + transferQuantity;
        const updateToRes = await fetch(`${API_URL}/inventory/inventory/product/${selectedBook.id}/update/`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            product_id: selectedBook.id,
            warehouse_id: transfer.to_warehouse,
            quantity: newToQuantity,
            notes: toInventory.notes || ''
          }),
        });
        if (!updateToRes.ok) {
          const errorData = await updateToRes.json();
          console.error('Update destination inventory error:', errorData);
          throw new Error(errorData.detail || "Failed to update destination warehouse inventory");
        }
      } else {
        // Create new inventory record for destination warehouse
        const createToRes = await fetch(`${API_URL}/inventory/inventory/`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            product_id: selectedBook.id,
            warehouse_id: transfer.to_warehouse,
            quantity: transferQuantity,
            notes: ''
          }),
        });
        if (!createToRes.ok) {
          const errorData = await createToRes.json();
          console.error('Create destination inventory error:', errorData);
          throw new Error(errorData.detail || "Failed to create destination warehouse inventory");
        }
      }

      // Refresh product summaries and inventory data
      const [summaryRes, inventoryRes] = await Promise.all([
        fetch(`${API_URL}/inventory/product-summary/`, { headers }),
        fetch(`${API_URL}/inventory/inventory/?product=${selectedBook.id}`, { headers })
      ]);

      if (!summaryRes.ok) throw new Error("Failed to fetch product summaries");
      if (!inventoryRes.ok) throw new Error("Failed to fetch inventory data");

      const summaryData = await summaryRes.json();
      const inventoryData = await inventoryRes.json();

      setProductSummaries(Array.isArray(summaryData) ? summaryData : summaryData.results ?? []);
      
      // Update the selected book's inventory data
      if (selectedBook) {
        const updatedInventory = Array.isArray(inventoryData) ? inventoryData : inventoryData.results ?? [];
        setSelectedBook({
          ...selectedBook,
          inventory: updatedInventory
        });
      }

      // Reset transfer form and close modal
      resetTransfer();
      setIsTransferOpen(false);
      showAlert("success", "Transfer completed successfully");
    } catch (error) {
      console.error("Error creating transfer:", error);
      showAlert("error", error instanceof Error ? error.message : "Failed to create transfer");
    } finally {
      setIsLoading(false);
    }
  };

  // Update the warehouse find function type
  const findWarehouse = (warehouses: Warehouse[], wid: number): Warehouse | undefined => {
    return warehouses.find((w: Warehouse) => w.id === wid);
  };

  // Update the handleAddPrintRun function with proper type checking
  const handleAddPrintRun = () => {
    if (!selectedBook || !selectedBook.id) return;
    
    const newEdition: PrintRun = {
      product: selectedBook.id,
      edition_number: selectedBook.print_runs.length + 1,
      price: 0,
      print_cost: 0,
      status: null,
      notes: "",
    };

    const updatedBook: BookInterface = {
      ...selectedBook,
      print_runs: [...selectedBook.print_runs, newEdition],
    };

    setSelectedBook(updatedBook);
  };

  
  // Update the inventory item handling functions
  const handleInventoryItemChange = (index: number, field: string, value: any) => {
    if (!selectedBookInventory) return;
    
    const updatedInventory = [...selectedBookInventory];
    updatedInventory[index] = {
      ...updatedInventory[index],
      [field]: value
    };
    setSelectedBookInventory(updatedInventory);
  };

  const handleRemoveInventoryItem = (index: number) => {
    if (!selectedBookInventory) return;
    
    const updatedInventory = selectedBookInventory.filter((_, i) => i !== index);
    setSelectedBookInventory(updatedInventory);
  };

  const handleAddInventoryItem = () => {
    const newItem = {
      product: selectedBook?.id || 0,
      warehouse: warehouses[0]?.id || 0,
      quantity: 0,
      notes: ""
    };
    
    if (isEditBookOpen) {
      setEditBookInventory([...editBookInventory, newItem]);
    } else if (selectedBookInventory) {
      setSelectedBookInventory([...selectedBookInventory, newItem]);
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
                    placeholder="Search by ISBN, title, author or translator..."
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
                        <th className="p-3 text-left font-medium">Book</th>
                        <th className="p-3 text-left font-medium">ISBN</th>
                        <th className="p-3 text-left font-medium">Authors</th>
                        <th className="p-3 text-left font-medium">Translators</th>
                        <th className="p-3 text-left font-medium">Genre</th>
                        <th className="p-3 text-left font-medium">Price</th>
                        <th className="p-3 text-left font-medium">Status</th>
                        <th className="p-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center">
                            <div className="flex flex-col items-center">
                              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                              <p className="text-muted-foreground">Loading books...</p>
                            </div>
                          </td>
                        </tr>
                      ) : filteredProductSummaries.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center">
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
                        filteredProductSummaries.map((book) => (
                          <tr key={book.id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="p-3">
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
                              <span className="text-sm">{book.author_name || "-"}</span>
                            </td>
                            <td className="p-3">
                              <span className="text-sm">{book.translator_name || "-"}</span>
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="font-normal">
                                {book.genre_name || 'Unknown'}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <div className="flex flex-col">
                                <span className="font-medium">${book.latest_price || 0}</span>
                                <span className="text-xs text-muted-foreground">Cost: ${book.latest_cost || 0}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge
                                className={`${
                                  book.status_name === "Available"
                                    ? "bg-green-100 text-green-800 hover:bg-green-100 border-green-200"
                                    : book.status_name === "unavailable"
                                      ? "bg-red-100 text-red-800 hover:bg-red-100 border-red-200"
                                      : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200"
                                }`}
                              >
                                {book.status_name || 'Unknown'}
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
                              selectedBook && selectedBook.status?.id === 1
                                ? "bg-green-100 text-green-800 hover:bg-green-100 border-green-200"
                                : selectedBook && selectedBook.status?.id === 2
                                  ? "bg-red-100 text-red-800 hover:bg-red-100 border-red-200"
                                  : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200"
                            }`}
                          >
                            {selectedBook && selectedBook.status !== null ? getStatusName(selectedBook.status) : 'Unknown'}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Published Date</p>
                        <p className="font-medium">
                          {selectedBook?.print_runs?.[0]?.published_at
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

                  {/* Editions Information */}
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
                            {selectedBook?.print_runs && selectedBook.print_runs.length > 0 ? (
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
                                    <Badge
                                      className={`${
                                        printRun.status?.id === 1
                                          ? "bg-green-100 text-green-800 hover:bg-green-100 border-green-200"
                                          : printRun.status?.id === 2
                                            ? "bg-red-100 text-red-800 hover:bg-red-100 border-red-200"
                                            : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200"
                                      }`}
                                    >
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
                </div>
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
              console.log('Form submitted');
              e.preventDefault();
              handleAddBook()
            }}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                {/* Row 1: ISBN */}
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

                {/* Row 2: Title Arabic and English */}
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

                {/* Row 3: Genre, Status, and Product Type */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="genre">Genre</Label>
                    <Select
                      value={newBook.genre?.id?.toString() || ""}
                      onValueChange={(value) => {
                        const genreObj = genres.find(g => g.id === parseInt(value));
                        setNewBook({ ...newBook, genre: genreObj || null });
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
                        const statusObj = statusOptions.find(s => s.id === parseInt(value));
                        setNewBook({ ...newBook, status: statusObj || null });
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

                {/* Row 4: Author and Translator */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="authors">Authors</Label>
                    <Select
                      value={newBook.author?.id?.toString() || ""}
                      onValueChange={(value) => {
                        const authorObj = authors.find(a => a.id === parseInt(value));
                        setNewBook({ ...newBook, author: authorObj || null });
                      }}
                    >
                      <SelectTrigger id="authors" className="mt-1">
                        <SelectValue placeholder="Select author" />
                      </SelectTrigger>
                      <SelectContent>
                        {authors.map((author) => (
                          <SelectItem key={author.id} value={author.id.toString()}>
                            {author.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="translators">Translators</Label>
                    <Select
                      value={newBook.translator?.id?.toString() || ""}
                      onValueChange={(value) => {
                        const translatorObj = translators.find(t => t.id === parseInt(value));
                        setNewBook({ ...newBook, translator: translatorObj || null });
                      }}
                    >
                      <SelectTrigger id="translators" className="mt-1">
                        <SelectValue placeholder="Select translator" />
                      </SelectTrigger>
                      <SelectContent>
                        {translators.map((translator) => (
                          <SelectItem key={translator.id} value={translator.id.toString()}>
                            {translator.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 5: Cover Page Upload */}
                <div>
                  <Label>Book Cover Image</Label>
                  <div className="border rounded-md p-4 bg-muted/30 mt-1">
                    <div className="aspect-square rounded-md overflow-hidden mb-2 w-24 h-24 mx-auto">
                      <img
                        src={getImageUrl(newBook.cover_design)}
                        alt={`Book ${newBook.isbn}`}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const img = e.currentTarget;
                          console.log('Image load failed:', {
                            src: img.src,
                            isbn: newBook.isbn,
                            cover_design: newBook.cover_design,
                            fullUrl: getImageUrl(newBook.cover_design)
                          });
                          img.src = "/placeholder.svg";
                        }}
                      />
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
                              setNewBook({
                                ...newBook,
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
                          document.getElementById('cover-image')?.click();
                        }}
                      >
                        Change Image
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddBookOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Book</Button>
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
                  console.log('Form submitted');
                  e.preventDefault();
                  handleSaveChanges()
                }}
              >
                <Tabs defaultValue="basic" className="w-full" value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="basic">Basic Information</TabsTrigger>
                    <TabsTrigger value="details">Details & Pricing</TabsTrigger>
                    <TabsTrigger value="inventory">Inventory & Warehouse</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 gap-4">
                      {/* Row 1: ISBN */}
                      <div>
                        <Label htmlFor="edit-isbn">ISBN</Label>
                        <Input
                          id="edit-isbn"
                          value={selectedBook.isbn}
                          onChange={(e) => setSelectedBook({ ...selectedBook, isbn: e.target.value })}
                          className="mt-1"
                        />
                      </div>

                      {/* Row 2: Title Arabic and English */}
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

                      {/* Row 3: Genre, Product Status */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                          <Label htmlFor="edit-is_direct_product">Product Type</Label>
                          <div className="flex items-center space-x-2 mt-1">
                            <Switch
                              id="edit-is_direct_product"
                              checked={selectedBook.is_direct_product}
                              onCheckedChange={(checked) => 
                                setSelectedBook({ ...selectedBook, is_direct_product: checked })
                              }
                            />
                            <Label htmlFor="edit-is_direct_product" className="text-sm">
                              Direct Product
                            </Label>
                          </div>
                        </div>
                      </div>

                      {/* Row 4: Author and Translator */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="edit-authors">Authors</Label>
                          <Select
                            value={selectedBook.author?.id?.toString() || ""}
                            onValueChange={(value) => {
                              const authorObj = authors.find(a => a.id === parseInt(value));
                              setSelectedBook({
                                ...selectedBook,
                                author: authorObj || null
                              });
                            }}
                          >
                            <SelectTrigger id="edit-authors" className="mt-1">
                              <SelectValue placeholder="Select author" />
                            </SelectTrigger>
                            <SelectContent>
                              {authors.map((author) => (
                                <SelectItem key={author.id} value={author.id.toString()}>
                                  {author.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="edit-translators">Translators</Label>
                          <Select
                            value={selectedBook.translator?.id?.toString() || ""}
                            onValueChange={(value) => {
                              const translatorObj = translators.find(t => t.id === parseInt(value));
                              setSelectedBook({
                                ...selectedBook,
                                translator: translatorObj || null
                              });
                            }}
                          >
                            <SelectTrigger id="edit-translators" className="mt-1">
                              <SelectValue placeholder="Select translator" />
                            </SelectTrigger>
                            <SelectContent>
                              {translators.map((translator) => (
                                <SelectItem key={translator.id} value={translator.id.toString()}>
                                  {translator.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Row 5: Cover Page Upload */}
                      <div>
                        <Label>Book Cover Image</Label>
                        <div className="border rounded-md p-4 bg-muted/30 mt-1">
                          <div className="aspect-square rounded-md overflow-hidden mb-2 w-24 h-24 mx-auto">
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
  {/* Header with "Add Row" button */}
  <div className="flex items-center justify-between">
    <h3 className="text-lg font-medium">Warehouse Inventory</h3>
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleAddInventoryItem}
    >
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
              <tr
                key={index}
                className="border-b last:border-0 hover:bg-muted/50"
              >
                {/* Warehouse select */}
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

                {/* Quantity input */}
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

                {/* Remove row */}
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
               <Button
                 type="button"
                variant="outline"
              onClick={() => setIsEditBookOpen(false)}
              >
                 Cancel
               </Button>
               <Button
                  type="button"
                  onClick={handleSaveChanges}
                disabled={isSubmitting}
              >
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
                <Button variant="outline" onClick={handleModalClose}>
                  Cancel
                </Button>
                <Button onClick={handleTransfer} disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
