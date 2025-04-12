"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AppSidebar } from "../../../components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/hooks/use-toast"
import { Trash2, Edit, AlertCircle, CheckCircle2 } from "lucide-react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"

export default function ListManagementPage() {
  const [listTypes, setListTypes] = useState<any[]>([])
  const [listItems, setListItems] = useState<any[]>([])
  const [selectedType, setSelectedType] = useState<any>(null)
  const [newType, setNewType] = useState({ name_en: "", name_ar: "", code: "" })
  const [newItem, setNewItem] = useState({ value: "", display_name_en: "", display_name_ar: "" })
  const [editType, setEditType] = useState<any>(null)
  const [editItem, setEditItem] = useState<any>(null)
  const [deleteTypeId, setDeleteTypeId] = useState<number | null>(null)
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null)
  const [actionAlert, setActionAlert] = useState({
    type: null,
    message: "",
  })
  const [isLoading, setIsLoading] = useState(true)
  const [genreOptions, setGenreOptions] = useState<any[]>([])
  const [statusOptions, setStatusOptions] = useState<any[]>([])
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  // Show alert message
  const showAlert = (type, message) => {
    setActionAlert({ type, message })
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setActionAlert({ type: null, message: "" })
    }, 5000)
  }

  useEffect(() => {
    fetchListTypes()
    fetchGenreOptions()
    fetchStatusOptions()
  }, [])

  useEffect(() => {
    if (selectedType?.code) fetchListItems(selectedType.code)
  }, [selectedType])

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
  }

  const fetchListTypes = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`${API_URL}/common/list-types/`, { headers })
      const data = await res.json()
      setListTypes(data)
    } catch {
      toast({ title: "Error", description: "Failed to load list types", variant: "destructive" })
      showAlert("error", "Failed to load list types. Please try again later.")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchListItems = async (code: string) => {
    try {
      const res = await fetch(`${API_URL}/common/list-items/${code}/`, { headers })
      const data = await res.json()
      setListItems(data)
    } catch {
      toast({ title: "Error", description: "Failed to load list items", variant: "destructive" })
      showAlert("error", "Failed to load list items. Please try again later.")
    }
  }

  const fetchGenreOptions = async () => {
    try {
      const res = await fetch(`${API_URL}/common/list-items/genre/`, { headers })
      if (!res.ok) throw new Error("Failed to fetch genre options")
      const data = await res.json()
      setGenreOptions(data)
    } catch (error) {
      console.error("Error fetching genre options:", error)
      showAlert("error", "Failed to load genre options")
    }
  }

  const fetchStatusOptions = async () => {
    try {
      const res = await fetch(`${API_URL}/common/list-items/product_status/`, { headers })
      if (!res.ok) throw new Error("Failed to fetch status options")
      const data = await res.json()
      setStatusOptions(data)
    } catch (error) {
      console.error("Error fetching status options:", error)
      showAlert("error", "Failed to load status options")
    }
  }

  const addListType = async () => {
    try {
      const res = await fetch(`${API_URL}/common/list-types/`, {
        method: "POST",
        headers,
        body: JSON.stringify(newType),
      })
      const data = await res.json()
      setListTypes([...listTypes, data])
      setNewType({ name_en: "", name_ar: "", code: "" })
      toast({ title: "Type Added" })
      showAlert("success", `New list type "${data.name_en}" has been successfully added.`)
    } catch {
      toast({ title: "Error", description: "Failed to add type", variant: "destructive" })
      showAlert("error", "Failed to add list type. Please try again.")
    }
  }

  const updateListType = async () => {
    if (!editType) return
    try {
      const res = await fetch(`${API_URL}/common/list-types/${editType.id}/`, {
        method: "PUT",
        headers,
        body: JSON.stringify(editType),
      })
      const data = await res.json()
      setListTypes(listTypes.map((t) => (t.id === data.id ? data : t)))
      setEditType(null)
      toast({ title: "Type Updated" })
      showAlert("success", `List type "${data.name_en}" has been successfully updated.`)
    } catch {
      toast({ title: "Error", description: "Failed to update type", variant: "destructive" })
      showAlert("error", "Failed to update list type. Please try again.")
    }
  }

  const deleteListType = async () => {
    if (!deleteTypeId) return
    try {
      const typeToDelete = listTypes.find((t) => t.id === deleteTypeId)
      await fetch(`${API_URL}/common/list-types/${deleteTypeId}/delete/`, { method: "DELETE", headers })
      setListTypes(listTypes.filter((t) => t.id !== deleteTypeId))
      if (selectedType?.id === deleteTypeId) {
        setSelectedType(null)
        setListItems([])
      }
      setDeleteTypeId(null)
      toast({ title: "Type Deleted" })
      showAlert("warning", `List type "${typeToDelete?.name_en}" has been permanently deleted.`)
    } catch {
      toast({ title: "Error", description: "Failed to delete type", variant: "destructive" })
      showAlert("error", "Failed to delete list type. Please try again.")
    }
  }

  const addListItem = async () => {
    if (!selectedType) return
    try {
      const res = await fetch(`${API_URL}/common/list-items/`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...newItem, list_type: selectedType.id }),
      })
      const data = await res.json()
      setListItems([...listItems, data])
      setNewItem({ value: "", display_name_en: "", display_name_ar: "" })
      toast({ title: "Item Added" })
      showAlert("success", `New list item "${data.display_name_en}" has been successfully added.`)
    } catch {
      toast({ title: "Error", description: "Failed to add item", variant: "destructive" })
      showAlert("error", "Failed to add list item. Please try again.")
    }
  }

  const updateListItem = async () => {
    if (!editItem) return
    try {
      const res = await fetch(`${API_URL}/common/list-items/${editItem.id}/`, {
        method: "PUT",
        headers,
        body: JSON.stringify(editItem),
      })
      const data = await res.json()
      setListItems(listItems.map((i) => (i.id === data.id ? data : i)))
      setEditItem(null)
      toast({ title: "Item Updated" })
      showAlert("success", `List item "${data.display_name_en}" has been successfully updated.`)
    } catch {
      toast({ title: "Error", description: "Failed to update item", variant: "destructive" })
      showAlert("error", "Failed to update list item. Please try again.")
    }
  }

  const deleteListItem = async () => {
    if (!deleteItemId) return
    try {
      const itemToDelete = listItems.find((i) => i.id === deleteItemId)
      await fetch(`${API_URL}/common/list-items/${deleteItemId}/delete/`, { method: "DELETE", headers })
      setListItems(listItems.filter((i) => i.id !== deleteItemId))
      setDeleteItemId(null)
      toast({ title: "Item Deleted" })
      showAlert("warning", `List item "${itemToDelete?.display_name_en}" has been permanently deleted.`)
    } catch {
      toast({ title: "Error", description: "Failed to delete item", variant: "destructive" })
      showAlert("error", "Failed to delete list item. Please try again.")
    }
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
                  <BreadcrumbPage>List Management</BreadcrumbPage>
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
            <h2 className="text-xl font-semibold mb-4">List Management</h2>
            <p className="mb-6">Manage list types and their items for your application.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>List Types</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {isLoading ? (
                    <div className="py-8 text-center">Loading list types...</div>
                  ) : listTypes.length === 0 ? (
                    <div className="py-8 text-center">No list types found</div>
                  ) : (
                    listTypes.map((type) => (
                      <div
                        key={type.id}
                        className={`p-3 border rounded-md flex justify-between items-center ${selectedType?.id === type.id ? "bg-muted" : ""} cursor-pointer hover:bg-muted/50`}
                        onClick={() => setSelectedType(type)}
                      >
                        <div>
                          <div className="font-semibold">{type.name_en}</div>
                          <div className="text-sm text-muted-foreground">{type.code}</div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditType(type)
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteTypeId(type.id)
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    <Label htmlFor="name_en">English Name</Label>
                    <Input
                      id="name_en"
                      placeholder="English Name"
                      value={newType.name_en}
                      onChange={(e) => setNewType({ ...newType, name_en: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name_ar">Arabic Name</Label>
                    <Input
                      id="name_ar"
                      placeholder="Arabic Name"
                      value={newType.name_ar}
                      onChange={(e) => setNewType({ ...newType, name_ar: e.target.value })}
                      dir="rtl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code">Code</Label>
                    <Input
                      id="code"
                      placeholder="Code"
                      value={newType.code}
                      onChange={(e) => setNewType({ ...newType, code: e.target.value })}
                    />
                  </div>
                  <Button onClick={addListType} className="w-full mt-4">
                    Add List Type
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>List Items {selectedType && `for ${selectedType.name_en}`}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {selectedType ? (
                    <>
                      {listItems.length === 0 ? (
                        <div className="py-8 text-center">No items found for this list type</div>
                      ) : (
                        listItems.map((item) => (
                          <div key={item.id} className="p-3 border rounded-md flex justify-between items-center">
                            <div>
                              <div className="font-semibold">{item.display_name_en || ''}</div>
                              <div className="text-sm text-muted-foreground">{item.value || ''}</div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="icon" variant="ghost" onClick={() => setEditItem({...item})}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => setDeleteItemId(item.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                      <Separator className="my-4" />
                      <div className="space-y-2">
                        <Label htmlFor="value">Value</Label>
                        <Input
                          id="value"
                          placeholder="Value"
                          value={newItem.value}
                          onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="display_name_en">Display Name (English)</Label>
                        <Input
                          id="display_name_en"
                          placeholder="Display Name EN"
                          value={newItem.display_name_en}
                          onChange={(e) => setNewItem({ ...newItem, display_name_en: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="display_name_ar">Display Name (Arabic)</Label>
                        <Input
                          id="display_name_ar"
                          placeholder="Display Name AR"
                          value={newItem.display_name_ar}
                          onChange={(e) => setNewItem({ ...newItem, display_name_ar: e.target.value })}
                          dir="rtl"
                        />
                      </div>
                      <Button onClick={addListItem} className="w-full mt-4">
                        Add List Item
                      </Button>
                    </>
                  ) : (
                    <div className="py-8 text-center">Select a List Type to manage its items.</div>
                  )}
                </CardContent>
              </Card>

              {/* Genre and Status Options */}
              <Card>
                <CardHeader>
                  <CardTitle>Genre and Status Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Genre Options</h3>
                    {genreOptions.length === 0 ? (
                      <div className="py-4 text-center text-muted-foreground">No genre options available</div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {genreOptions.map((genre) => (
                          <div key={genre.id} className="p-2 border rounded-md">
                            <div className="font-medium">{genre.display_name_en}</div>
                            <div className="text-sm text-muted-foreground">{genre.value}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-2">Status Options</h3>
                    {statusOptions.length === 0 ? (
                      <div className="py-4 text-center text-muted-foreground">No status options available</div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {statusOptions.map((status) => (
                          <div key={status.id} className="p-2 border rounded-md">
                            <div className="font-medium">{status.display_name_en}</div>
                            <div className="text-sm text-muted-foreground">{status.value}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Filter</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select value={selectedGenre || ""} onValueChange={(value) => setSelectedGenre(value || null)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by genre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Genres</SelectItem>
                      {genreOptions.map((genre) => (
                        <SelectItem key={genre.id} value={genre.id.toString()}>
                          {genre.display_name_en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter || "all"} onValueChange={(value) => setStatusFilter(value || null)}>
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
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Edit Dialogs */}
        <Dialog open={!!editType} onOpenChange={(open) => !open && setEditType(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit List Type</DialogTitle>
            </DialogHeader>
            {editType && (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name-en">Name (English)</Label>
                  <Input
                    id="edit-name-en"
                    value={editType.name_en}
                    onChange={(e) => setEditType({ ...editType, name_en: e.target.value })}
                    placeholder="Name EN"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-name-ar">Name (Arabic)</Label>
                  <Input
                    id="edit-name-ar"
                    value={editType.name_ar}
                    onChange={(e) => setEditType({ ...editType, name_ar: e.target.value })}
                    placeholder="Name AR"
                    dir="rtl"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-code">Code</Label>
                  <Input
                    id="edit-code"
                    value={editType.code}
                    onChange={(e) => setEditType({ ...editType, code: e.target.value })}
                    placeholder="Code"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditType(null)}>
                Cancel
              </Button>
              <Button onClick={updateListType}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit List Item</DialogTitle>
            </DialogHeader>
            {editItem && (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-value">Value</Label>
                  <Input
                    id="edit-value"
                    value={editItem.value}
                    onChange={(e) => setEditItem({ ...editItem, value: e.target.value })}
                    placeholder="Value"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-display-en">Display Name (English)</Label>
                  <Input
                    id="edit-display-en"
                    value={editItem.display_name_en}
                    onChange={(e) => setEditItem({ ...editItem, display_name_en: e.target.value })}
                    placeholder="Display Name EN"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-display-ar">Display Name (Arabic)</Label>
                  <Input
                    id="edit-display-ar"
                    value={editItem.display_name_ar}
                    onChange={(e) => setEditItem({ ...editItem, display_name_ar: e.target.value })}
                    placeholder="Display Name AR"
                    dir="rtl"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditItem(null)}>
                Cancel
              </Button>
              <Button onClick={updateListItem}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmations */}
        <AlertDialog open={!!deleteTypeId} onOpenChange={(open) => !open && setDeleteTypeId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription>
              {deleteTypeId && (
                <>
                  You are about to delete <strong>{listTypes.find((t) => t.id === deleteTypeId)?.name_en}</strong>. This
                  will permanently delete this type and all its items. This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteListType}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteItemId} onOpenChange={(open) => !open && setDeleteItemId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription>
              {deleteItemId && (
                <>
                  You are about to delete{" "}
                  <strong>
                    {listItems.find((i) => i.id === deleteItemId)?.display_name_en || 'this item'}
                  </strong>. This will
                  permanently delete this list item. This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteListItem}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidebarInset>
    </SidebarProvider>
  )
}

