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
  Package,
  AlertCircle,
  CheckCircle2,
  PlusCircle,
  Trash2,
  MoreHorizontal,
  Loader2,
  Search,
  ImageIcon,
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"

// Product interface
interface Product {
  id: number
  name: string
  description: string
  price: number
  discountPrice: number | null
  sku: string
  barcode: string | null
  category: string
  tags: string[]
  inStock: boolean
  featured: boolean
  rating: number
  reviewCount: number
  images: string[]
  mainImage: string
  createdAt: string
  updatedAt: string
  storeAvailability: StoreAvailability[]
}

// Store availability interface
interface StoreAvailability {
  id: number
  storeName: string
  quantity: number
  location: string
}

// Store interface
interface Store {
  id: number
  name: string
  location: string
  isActive: boolean
}

// Category interface
interface Category {
  id: number
  name: string
  description: string
}

export default function ProductManagement() {
  // State for products and filters
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isProductDetailsOpen, setIsProductDetailsOpen] = useState(false)
  const [isAddProductOpen, setIsAddProductOpen] = useState(false)
  const [isEditProductOpen, setIsEditProductOpen] = useState(false)
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
  const [deleteProductId, setDeleteProductId] = useState<number | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [stockFilter, setStockFilter] = useState<boolean | null>(null)
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

  // New product state with default values
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: "",
    description: "",
    price: 0,
    discountPrice: null,
    sku: "",
    barcode: "",
    category: "",
    tags: [],
    inStock: true,
    featured: false,
    mainImage: "/placeholder.svg?height=400&width=400",
    images: [],
    storeAvailability: [],
  })

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

  // Dummy data for products
  const dummyProducts: Product[] = [
    {
      id: 1,
      name: "Premium Ergonomic Chair",
      description: "High-quality ergonomic office chair with lumbar support and adjustable height",
      price: 299.99,
      discountPrice: 249.99,
      sku: "CHAIR-001",
      barcode: "8901234567890",
      category: "Furniture",
      tags: ["Office", "Ergonomic", "Premium"],
      inStock: true,
      featured: true,
      rating: 4.8,
      reviewCount: 124,
      mainImage: "/placeholder.svg?height=400&width=400",
      images: [
        "/placeholder.svg?height=600&width=600",
        "/placeholder.svg?height=600&width=600&text=Side+View",
        "/placeholder.svg?height=600&width=600&text=Back+View",
      ],
      createdAt: "2023-01-15T10:30:00Z",
      updatedAt: "2023-06-20T14:45:00Z",
      storeAvailability: [
        { id: 1, storeName: "Downtown Store", quantity: 12, location: "Main Floor" },
        { id: 2, storeName: "Westside Mall", quantity: 5, location: "Section B" },
        { id: 3, storeName: "Online Warehouse", quantity: 28, location: "Aisle 7" },
      ],
    },
    {
      id: 2,
      name: "Wireless Noise-Cancelling Headphones",
      description: "Premium wireless headphones with active noise cancellation and 30-hour battery life",
      price: 349.99,
      discountPrice: null,
      sku: "AUDIO-002",
      barcode: "7890123456789",
      category: "Electronics",
      tags: ["Audio", "Wireless", "Premium"],
      inStock: true,
      featured: true,
      rating: 4.9,
      reviewCount: 256,
      mainImage: "/placeholder.svg?height=400&width=400&text=Headphones",
      images: [
        "/placeholder.svg?height=600&width=600&text=Headphones",
        "/placeholder.svg?height=600&width=600&text=Side+View",
        "/placeholder.svg?height=600&width=600&text=Case",
      ],
      createdAt: "2023-02-10T09:15:00Z",
      updatedAt: "2023-07-05T11:30:00Z",
      storeAvailability: [
        { id: 1, storeName: "Downtown Store", quantity: 8, location: "Electronics Section" },
        { id: 2, storeName: "Westside Mall", quantity: 15, location: "Tech Corner" },
        { id: 3, storeName: "Online Warehouse", quantity: 42, location: "Bin E12" },
      ],
    },
    {
      id: 3,
      name: "Smart Fitness Watch",
      description: "Advanced fitness tracker with heart rate monitoring, GPS, and 7-day battery life",
      price: 199.99,
      discountPrice: 179.99,
      sku: "WEAR-003",
      barcode: "6789012345678",
      category: "Wearables",
      tags: ["Fitness", "Smart Watch", "Health"],
      inStock: true,
      featured: false,
      rating: 4.7,
      reviewCount: 189,
      mainImage: "/placeholder.svg?height=400&width=400&text=Fitness+Watch",
      images: [
        "/placeholder.svg?height=600&width=600&text=Fitness+Watch",
        "/placeholder.svg?height=600&width=600&text=Side+View",
        "/placeholder.svg?height=600&width=600&text=On+Wrist",
      ],
      createdAt: "2023-03-05T13:45:00Z",
      updatedAt: "2023-08-12T16:20:00Z",
      storeAvailability: [
        { id: 1, storeName: "Downtown Store", quantity: 6, location: "Wearables Display" },
        { id: 3, storeName: "Online Warehouse", quantity: 23, location: "Bin W7" },
      ],
    },
    {
      id: 4,
      name: "Artisanal Ceramic Mug Set",
      description: "Handcrafted ceramic mug set with unique designs, set of 4",
      price: 49.99,
      discountPrice: null,
      sku: "HOME-004",
      barcode: "5678901234567",
      category: "Home & Kitchen",
      tags: ["Ceramic", "Handcrafted", "Kitchen"],
      inStock: true,
      featured: false,
      rating: 4.5,
      reviewCount: 78,
      mainImage: "/placeholder.svg?height=400&width=400&text=Ceramic+Mugs",
      images: [
        "/placeholder.svg?height=600&width=600&text=Ceramic+Mugs",
        "/placeholder.svg?height=600&width=600&text=Single+Mug",
        "/placeholder.svg?height=600&width=600&text=Set+Display",
      ],
      createdAt: "2023-04-20T11:10:00Z",
      updatedAt: "2023-09-01T09:30:00Z",
      storeAvailability: [
        { id: 1, storeName: "Downtown Store", quantity: 20, location: "Home Goods" },
        { id: 2, storeName: "Westside Mall", quantity: 14, location: "Kitchen Section" },
      ],
    },
    {
      id: 5,
      name: "Professional Chef's Knife",
      description: "High-carbon stainless steel chef's knife with ergonomic handle",
      price: 129.99,
      discountPrice: null,
      sku: "KITCH-005",
      barcode: "4567890123456",
      category: "Kitchen",
      tags: ["Cooking", "Professional", "Cutlery"],
      inStock: true,
      featured: true,
      rating: 4.9,
      reviewCount: 156,
      mainImage: "/placeholder.svg?height=400&width=400&text=Chef+Knife",
      images: [
        "/placeholder.svg?height=600&width=600&text=Chef+Knife",
        "/placeholder.svg?height=600&width=600&text=Handle+Detail",
        "/placeholder.svg?height=600&width=600&text=Blade+Detail",
      ],
      createdAt: "2023-05-15T14:25:00Z",
      updatedAt: "2023-10-10T15:40:00Z",
      storeAvailability: [
        { id: 1, storeName: "Downtown Store", quantity: 7, location: "Cutlery Section" },
        { id: 2, storeName: "Westside Mall", quantity: 0, location: "Kitchen Dept" },
        { id: 3, storeName: "Online Warehouse", quantity: 22, location: "Bin K15" },
      ],
    },
    {
      id: 6,
      name: "Minimalist Desk Lamp",
      description: "Modern LED desk lamp with adjustable brightness and color temperature",
      price: 89.99,
      discountPrice: 69.99,
      sku: "LIGHT-006",
      barcode: "3456789012345",
      category: "Lighting",
      tags: ["Modern", "LED", "Desk"],
      inStock: false,
      featured: false,
      rating: 4.7,
      reviewCount: 112,
      mainImage: "/placeholder.svg?height=400&width=400&text=Desk+Lamp",
      images: [
        "/placeholder.svg?height=600&width=600&text=Desk+Lamp",
        "/placeholder.svg?height=600&width=600&text=Side+View",
        "/placeholder.svg?height=600&width=600&text=Light+On",
      ],
      createdAt: "2023-06-30T10:15:00Z",
      updatedAt: "2023-11-05T12:50:00Z",
      storeAvailability: [
        { id: 1, storeName: "Downtown Store", quantity: 0, location: "Lighting Section" },
        { id: 2, storeName: "Westside Mall", quantity: 0, location: "Home Decor" },
        { id: 3, storeName: "Online Warehouse", quantity: 0, location: "Bin L8" },
      ],
    },
  ]

  // Dummy data for categories
  const dummyCategories: Category[] = [
    { id: 1, name: "Furniture", description: "Home and office furniture" },
    { id: 2, name: "Electronics", description: "Electronic devices and gadgets" },
    { id: 3, name: "Wearables", description: "Wearable technology and accessories" },
    { id: 4, name: "Home & Kitchen", description: "Home and kitchen products" },
    { id: 5, name: "Kitchen", description: "Kitchen tools and appliances" },
    { id: 6, name: "Lighting", description: "Lamps and lighting solutions" },
  ]

  // Dummy data for stores
  const dummyStores: Store[] = [
    { id: 1, name: "Downtown Store", location: "123 Main St, Downtown", isActive: true },
    { id: 2, name: "Westside Mall", location: "456 West Ave, Westside Mall", isActive: true },
    { id: 3, name: "Online Warehouse", location: "789 Distribution Rd, Industrial Park", isActive: true },
  ]

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        // In a real application, these would be API calls
        // For now, we'll use the dummy data
        setProducts(dummyProducts)
        setFilteredProducts(dummyProducts)
        setCategories(dummyCategories)
        setStores(dummyStores)
      } catch (error) {
        console.error("Error loading data:", error)
        toast({
          title: "Error",
          description: "Failed to load products",
          variant: "destructive",
        })
        showAlert("error", "Failed to load products. Please try again later.")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  // Filter products based on search query, category, and stock status
  useEffect(() => {
    let filtered = [...products]

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          product.description.toLowerCase().includes(query) ||
          product.sku.toLowerCase().includes(query) ||
          product.category.toLowerCase().includes(query) ||
          (product.barcode && product.barcode.toLowerCase().includes(query)) ||
          product.tags.some((tag) => tag.toLowerCase().includes(query)),
      )
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter((product) => product.category === selectedCategory)
    }

    // Filter by stock status
    if (stockFilter !== null) {
      filtered = filtered.filter((product) => product.inStock === stockFilter)
    }

    setFilteredProducts(filtered)
  }, [products, searchQuery, selectedCategory, stockFilter])

  // Open product details modal
  const openProductDetails = (product: Product) => {
    setSelectedProduct(product)
    setIsProductDetailsOpen(true)
  }

  // Open edit product modal
  const openEditProduct = (product: Product) => {
    setSelectedProduct(product)
    setIsEditProductOpen(true)
  }

  // Open delete confirmation
  const openDeleteDialog = (productId: number) => {
    setDeleteProductId(productId)
    setIsDeleteAlertOpen(true)
  }

  // Handle adding a new product
  const handleAddProduct = async () => {
    try {
      // In a real application, this would be an API call
      const newId = Math.max(...products.map((p) => p.id)) + 1
      const productToAdd: Product = {
        ...(newProduct as Product),
        id: newId,
        rating: 0,
        reviewCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      setProducts([...products, productToAdd])
      setIsAddProductOpen(false)

      // Reset form
      setNewProduct({
        name: "",
        description: "",
        price: 0,
        discountPrice: null,
        sku: "",
        barcode: "",
        category: "",
        tags: [],
        inStock: true,
        featured: false,
        mainImage: "/placeholder.svg?height=400&width=400",
        images: [],
        storeAvailability: [],
      })

      toast({
        title: "Product Added",
        description: `${productToAdd.name} has been added to the inventory.`,
        variant: "default",
      })

      showAlert("success", `New product "${productToAdd.name}" has been successfully added to the inventory.`)
    } catch (error) {
      console.error("Error adding product:", error)
      toast({
        title: "Error",
        description: "Failed to add product",
        variant: "destructive",
      })
      showAlert("error", "Failed to add product. Please try again.")
    }
  }

  // Handle updating a product
  const handleUpdateProduct = async () => {
    if (!selectedProduct) return

    try {
      // In a real application, this would be an API call
      const updatedProducts = products.map((p) => (p.id === selectedProduct.id ? selectedProduct : p))
      setProducts(updatedProducts)
      setIsEditProductOpen(false)

      toast({
        title: "Product Updated",
        description: `${selectedProduct.name} has been updated.`,
        variant: "default",
      })

      showAlert("success", `Product "${selectedProduct.name}" has been successfully updated.`)
    } catch (error) {
      console.error("Error updating product:", error)
      toast({
        title: "Error",
        description: "Failed to update product",
        variant: "destructive",
      })
      showAlert("error", "Failed to update product. Please try again.")
    }
  }

  // Handle deleting a product
  const handleDeleteProduct = async () => {
    if (deleteProductId === null) return

    try {
      const productToDelete = products.find((p) => p.id === deleteProductId)
      if (!productToDelete) return

      // In a real application, this would be an API call
      setProducts(products.filter((p) => p.id !== deleteProductId))
      setDeleteProductId(null)
      setIsDeleteAlertOpen(false)
      setDeleteConfirm("")

      toast({
        title: "Product Deleted",
        description: `${productToDelete.name} has been removed from the inventory.`,
        variant: "destructive",
      })

      showAlert("warning", `Product "${productToDelete.name}" has been permanently deleted from the inventory.`)
    } catch (error) {
      console.error("Error deleting product:", error)
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive",
      })
      showAlert("error", "Failed to delete product. Please try again.")
    }
  }

  // Reset filters
  const resetFilters = () => {
    setSearchQuery("")
    setSelectedCategory(null)
    setStockFilter(null)
  }

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
                  <BreadcrumbPage>Products</BreadcrumbPage>
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
                <h2 className="text-xl font-semibold">Product Management</h2>
                <p className="text-muted-foreground">Manage your product inventory and availability</p>
              </div>
              <Button onClick={() => setIsAddProductOpen(true)} className="bg-primary text-primary-foreground">
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </div>

            {/* Filters */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedCategory || ""} onValueChange={(value) => setSelectedCategory(value || null)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Products Table */}
            <div className="border rounded-md">
              <div className="bg-muted p-4 flex justify-between items-center">
                <h3 className="font-medium">Products</h3>
                {(searchQuery || selectedCategory || stockFilter !== null) && (
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
                        <th className="text-left font-medium p-3">Product</th>
                        <th className="text-left font-medium p-3">SKU</th>
                        <th className="text-left font-medium p-3">Category</th>
                        <th className="text-left font-medium p-3">Price</th>
                        <th className="text-left font-medium p-3">Stock Status</th>
                        <th className="text-right font-medium p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center">
                            <div className="flex flex-col items-center">
                              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                              <p className="text-muted-foreground">Loading products...</p>
                            </div>
                          </td>
                        </tr>
                      ) : filteredProducts.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center">
                            <div className="flex flex-col items-center">
                              <Package className="h-12 w-12 text-muted-foreground mb-2" />
                              <p className="font-medium mb-1">No products found</p>
                              <p className="text-muted-foreground text-sm mb-4">
                                {searchQuery || selectedCategory || stockFilter !== null
                                  ? "Try adjusting your filters"
                                  : "Add your first product to get started"}
                              </p>
                              {searchQuery || selectedCategory || stockFilter !== null ? (
                                <Button variant="outline" size="sm" onClick={resetFilters}>
                                  Clear Filters
                                </Button>
                              ) : (
                                <Button size="sm" onClick={() => setIsAddProductOpen(true)}>
                                  <PlusCircle className="h-4 w-4 mr-2" />
                                  Add Product
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredProducts.map((product) => (
                          <tr key={product.id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                                  <img
                                    src={product.mainImage || "/placeholder.svg"}
                                    alt={product.name}
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                                <div>
                                  <p className="font-medium">{product.name}</p>
                                  <p className="text-xs text-muted-foreground line-clamp-1">{product.description}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              <p className="font-mono text-sm">{product.sku}</p>
                              {product.barcode && (
                                <p className="text-xs text-muted-foreground font-mono">{product.barcode}</p>
                              )}
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="font-normal">
                                {product.category}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <div className="flex flex-col">
                                <span className="font-medium">${product.discountPrice || product.price}</span>
                                {product.discountPrice && (
                                  <span className="text-xs text-muted-foreground line-through">${product.price}</span>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              {product.inStock ? (
                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                                  In Stock
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-red-600 border-red-200">
                                  Out of Stock
                                </Badge>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-2">
                                {/* Desktop view - separate buttons */}
                                <div className="hidden sm:flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openProductDetails(product)}
                                  >
                                    <Package className="h-4 w-4" />
                                    <span className="sr-only">View Details</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openEditProduct(product)}
                                  >
                                    <Edit className="h-4 w-4" />
                                    <span className="sr-only">Edit</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => openDeleteDialog(product.id)}
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
                                      <DropdownMenuItem onClick={() => openProductDetails(product)}>
                                        <Package className="h-4 w-4 mr-2" />
                                        View Details
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => openEditProduct(product)}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => openDeleteDialog(product.id)}
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

      {/* Product Details Modal */}
      <Dialog open={isProductDetailsOpen} onOpenChange={setIsProductDetailsOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
          {selectedProduct && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedProduct.name}</DialogTitle>
                <DialogDescription>Product details and store availability</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                {/* Product Images */}
                <div className="space-y-4">
                  <div className="aspect-square rounded-lg overflow-hidden border bg-muted">
                    <img
                      src={selectedProduct.mainImage || "/placeholder.svg"}
                      alt={selectedProduct.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {selectedProduct.images.map((image, index) => (
                      <div key={index} className="aspect-square rounded-md overflow-hidden border bg-muted">
                        <img
                          src={image || "/placeholder.svg"}
                          alt={`${selectedProduct.name} ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Product Information */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-2">Product Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">SKU</p>
                        <p className="font-mono">{selectedProduct.sku}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Barcode</p>
                        <p className="font-mono">{selectedProduct.barcode || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Category</p>
                        <Badge variant="outline" className="mt-1">
                          {selectedProduct.category}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Tags</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedProduct.tags.map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Price</p>
                        <div className="flex items-baseline gap-2">
                          <p className="font-medium">${selectedProduct.discountPrice || selectedProduct.price}</p>
                          {selectedProduct.discountPrice && (
                            <p className="text-sm text-muted-foreground line-through">${selectedProduct.price}</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <div className="mt-1">
                          {selectedProduct.inStock ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                              In Stock
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-600 border-red-200">
                              Out of Stock
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-2">Description</h3>
                    <p className="text-muted-foreground">{selectedProduct.description}</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-2">Ratings & Reviews</h3>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <svg
                            key={i}
                            className={`h-5 w-5 ${
                              i < Math.floor(selectedProduct.rating)
                                ? "text-yellow-400 fill-yellow-400"
                                : i < selectedProduct.rating
                                  ? "text-yellow-400 fill-yellow-400"
                                  : "text-gray-300 fill-gray-300"
                            }`}
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                          </svg>
                        ))}
                      </div>
                      <span className="font-medium">{selectedProduct.rating}</span>
                      <span className="text-muted-foreground">({selectedProduct.reviewCount} reviews)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Store Availability */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4">Store Availability</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedProduct.storeAvailability.map((store) => (
                    <div
                      key={store.id}
                      className={`border rounded-lg p-4 ${
                        store.quantity > 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{store.storeName}</h4>
                        <Badge
                          variant={store.quantity > 0 ? "default" : "outline"}
                          className={
                            store.quantity > 0
                              ? "bg-green-100 text-green-800 hover:bg-green-100 border-green-200"
                              : "text-red-600 border-red-200"
                          }
                        >
                          {store.quantity > 0 ? `${store.quantity} in stock` : "Out of stock"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">Location: {store.location}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsProductDetailsOpen(false)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setIsProductDetailsOpen(false)
                    openEditProduct(selectedProduct)
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Product
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Product Dialog */}
      <Dialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>Create a new product for your inventory.</DialogDescription>
          </DialogHeader>
          <form ref={formRef} className="space-y-6 py-4">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Information</TabsTrigger>
                <TabsTrigger value="details">Details & Pricing</TabsTrigger>
                <TabsTrigger value="inventory">Inventory & Stores</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="name">Product Name</Label>
                    <Input
                      id="name"
                      value={newProduct.name || ""}
                      onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      placeholder="Enter product name"
                      className="mt-1"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newProduct.description || ""}
                      onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                      placeholder="Enter product description"
                      rows={4}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={newProduct.category || ""}
                      onValueChange={(value) => setNewProduct({ ...newProduct, category: value })}
                    >
                      <SelectTrigger id="category" className="mt-1">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.name}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="tags">Tags (comma separated)</Label>
                    <Input
                      id="tags"
                      value={newProduct.tags?.join(", ") || ""}
                      onChange={(e) =>
                        setNewProduct({
                          ...newProduct,
                          tags: e.target.value.split(",").map((tag) => tag.trim()),
                        })
                      }
                      placeholder="e.g. premium, office, ergonomic"
                      className="mt-1"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label>Product Images</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
                      <div className="border rounded-md p-4 bg-muted/30">
                        <div className="text-center mb-4">
                          <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm font-medium">Main Product Image</p>
                        </div>
                        <div className="flex justify-center">
                          <Button variant="outline" size="sm">
                            Upload Image
                          </Button>
                        </div>
                      </div>
                      <div className="border rounded-md p-4 bg-muted/30">
                        <div className="text-center mb-4">
                          <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm font-medium">Additional Images</p>
                        </div>
                        <div className="flex justify-center">
                          <Button variant="outline" size="sm">
                            Upload Images
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="details" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sku">SKU (Stock Keeping Unit)</Label>
                    <Input
                      id="sku"
                      value={newProduct.sku || ""}
                      onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                      placeholder="e.g. CHAIR-001"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="barcode">Barcode (Optional)</Label>
                    <Input
                      id="barcode"
                      value={newProduct.barcode || ""}
                      onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })}
                      placeholder="e.g. 123456789012"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="price">Regular Price ($)</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={newProduct.price || ""}
                      onChange={(e) => setNewProduct({ ...newProduct, price: Number.parseFloat(e.target.value) })}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="discountPrice">Discount Price ($) (Optional)</Label>
                    <Input
                      id="discountPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      value={newProduct.discountPrice || ""}
                      onChange={(e) =>
                        setNewProduct({
                          ...newProduct,
                          discountPrice: e.target.value ? Number.parseFloat(e.target.value) : null,
                        })
                      }
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="featured"
                      checked={newProduct.featured || false}
                      onCheckedChange={(checked) => setNewProduct({ ...newProduct, featured: checked })}
                    />
                    <Label htmlFor="featured">Featured Product</Label>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="inventory" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="inStock"
                      checked={newProduct.inStock || false}
                      onCheckedChange={(checked) => setNewProduct({ ...newProduct, inStock: checked })}
                    />
                    <Label htmlFor="inStock">Product In Stock</Label>
                  </div>

                  <div>
                    <Label className="block mb-2">Store Availability</Label>
                    <div className="space-y-4 border rounded-md p-4 bg-muted/30">
                      {stores.map((store) => (
                        <div key={store.id} className="grid grid-cols-2 gap-4 pb-4 border-b last:border-0 last:pb-0">
                          <div>
                            <p className="font-medium">{store.name}</p>
                            <p className="text-sm text-muted-foreground">{store.location}</p>
                          </div>
                          <div>
                            <Label htmlFor={`store-${store.id}`} className="text-sm">
                              Quantity
                            </Label>
                            <Input
                              id={`store-${store.id}`}
                              type="number"
                              min="0"
                              placeholder="0"
                              className="mt-1"
                              onChange={(e) => {
                                const quantity = Number.parseInt(e.target.value) || 0
                                const storeAvailability = newProduct.storeAvailability || []
                                const existingIndex = storeAvailability.findIndex((s) => s.id === store.id)

                                if (existingIndex >= 0) {
                                  storeAvailability[existingIndex].quantity = quantity
                                } else {
                                  storeAvailability.push({
                                    id: store.id,
                                    storeName: store.name,
                                    quantity,
                                    location: store.location,
                                  })
                                }

                                setNewProduct({ ...newProduct, storeAvailability })
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddProductOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddProduct} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Product
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={isEditProductOpen} onOpenChange={setIsEditProductOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
          {selectedProduct && (
            <>
              <DialogHeader>
                <DialogTitle>Edit Product</DialogTitle>
                <DialogDescription>Update product information.</DialogDescription>
              </DialogHeader>
              <form ref={formRef} className="space-y-6 py-4">
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="basic">Basic Information</TabsTrigger>
                    <TabsTrigger value="details">Details & Pricing</TabsTrigger>
                    <TabsTrigger value="inventory">Inventory & Stores</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <Label htmlFor="edit-name">Product Name</Label>
                        <Input
                          id="edit-name"
                          value={selectedProduct.name}
                          onChange={(e) => setSelectedProduct({ ...selectedProduct, name: e.target.value })}
                          className="mt-1"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label htmlFor="edit-description">Description</Label>
                        <Textarea
                          id="edit-description"
                          value={selectedProduct.description}
                          onChange={(e) => setSelectedProduct({ ...selectedProduct, description: e.target.value })}
                          rows={4}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="edit-category">Category</Label>
                        <Select
                          value={selectedProduct.category}
                          onValueChange={(value) => setSelectedProduct({ ...selectedProduct, category: value })}
                        >
                          <SelectTrigger id="edit-category" className="mt-1">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem key={category.id} value={category.name}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="edit-tags">Tags (comma separated)</Label>
                        <Input
                          id="edit-tags"
                          value={selectedProduct.tags.join(", ")}
                          onChange={(e) =>
                            setSelectedProduct({
                              ...selectedProduct,
                              tags: e.target.value.split(",").map((tag) => tag.trim()),
                            })
                          }
                          className="mt-1"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label>Product Images</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
                          <div className="border rounded-md p-4 bg-muted/30">
                            <div className="aspect-square rounded-md overflow-hidden mb-4">
                              <img
                                src={selectedProduct.mainImage || "/placeholder.svg"}
                                alt={selectedProduct.name}
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="flex justify-center">
                              <Button variant="outline" size="sm">
                                Change Image
                              </Button>
                            </div>
                          </div>
                          <div className="border rounded-md p-4 bg-muted/30">
                            <div className="grid grid-cols-3 gap-2 mb-4">
                              {selectedProduct.images.map((image, index) => (
                                <div key={index} className="aspect-square rounded-md overflow-hidden">
                                  <img
                                    src={image || "/placeholder.svg"}
                                    alt={`${selectedProduct.name} ${index + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-center">
                              <Button variant="outline" size="sm">
                                Manage Images
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="details" className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit-sku">SKU (Stock Keeping Unit)</Label>
                        <Input
                          id="edit-sku"
                          value={selectedProduct.sku}
                          onChange={(e) => setSelectedProduct({ ...selectedProduct, sku: e.target.value })}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="edit-barcode">Barcode (Optional)</Label>
                        <Input
                          id="edit-barcode"
                          value={selectedProduct.barcode || ""}
                          onChange={(e) => setSelectedProduct({ ...selectedProduct, barcode: e.target.value })}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="edit-price">Regular Price ($)</Label>
                        <Input
                          id="edit-price"
                          type="number"
                          step="0.01"
                          min="0"
                          value={selectedProduct.price}
                          onChange={(e) =>
                            setSelectedProduct({ ...selectedProduct, price: Number.parseFloat(e.target.value) })
                          }
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="edit-discountPrice">Discount Price ($) (Optional)</Label>
                        <Input
                          id="edit-discountPrice"
                          type="number"
                          step="0.01"
                          min="0"
                          value={selectedProduct.discountPrice || ""}
                          onChange={(e) =>
                            setSelectedProduct({
                              ...selectedProduct,
                              discountPrice: e.target.value ? Number.parseFloat(e.target.value) : null,
                            })
                          }
                          className="mt-1"
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="edit-featured"
                          checked={selectedProduct.featured}
                          onCheckedChange={(checked) => setSelectedProduct({ ...selectedProduct, featured: checked })}
                        />
                        <Label htmlFor="edit-featured">Featured Product</Label>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="inventory" className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="edit-inStock"
                          checked={selectedProduct.inStock}
                          onCheckedChange={(checked) => setSelectedProduct({ ...selectedProduct, inStock: checked })}
                        />
                        <Label htmlFor="edit-inStock">Product In Stock</Label>
                      </div>

                      <div>
                        <Label className="block mb-2">Store Availability</Label>
                        <div className="space-y-4 border rounded-md p-4 bg-muted/30">
                          {stores.map((store) => {
                            const storeAvailability = selectedProduct.storeAvailability.find((s) => s.id === store.id)
                            return (
                              <div
                                key={store.id}
                                className="grid grid-cols-2 gap-4 pb-4 border-b last:border-0 last:pb-0"
                              >
                                <div>
                                  <p className="font-medium">{store.name}</p>
                                  <p className="text-sm text-muted-foreground">{store.location}</p>
                                </div>
                                <div>
                                  <Label htmlFor={`edit-store-${store.id}`} className="text-sm">
                                    Quantity
                                  </Label>
                                  <Input
                                    id={`edit-store-${store.id}`}
                                    type="number"
                                    min="0"
                                    value={storeAvailability?.quantity || 0}
                                    className="mt-1"
                                    onChange={(e) => {
                                      const quantity = Number.parseInt(e.target.value) || 0
                                      const updatedAvailability = [...selectedProduct.storeAvailability]
                                      const existingIndex = updatedAvailability.findIndex((s) => s.id === store.id)

                                      if (existingIndex >= 0) {
                                        updatedAvailability[existingIndex].quantity = quantity
                                      } else {
                                        updatedAvailability.push({
                                          id: store.id,
                                          storeName: store.name,
                                          quantity,
                                          location: store.location,
                                        })
                                      }

                                      setSelectedProduct({
                                        ...selectedProduct,
                                        storeAvailability: updatedAvailability,
                                      })
                                    }}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditProductOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateProduct} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteProductId !== null && (
                <>
                  You are about to delete <strong>{products.find((p) => p.id === deleteProductId)?.name}</strong>. This
                  action cannot be undone. This will permanently remove the product from your inventory.
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
            <AlertDialogCancel onClick={() => setDeleteConfirm("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProduct}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteConfirm !== "DELETE"}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  )
}
