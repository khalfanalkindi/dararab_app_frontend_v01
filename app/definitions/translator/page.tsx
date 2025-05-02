"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { AppSidebar } from "../../../components/app-sidebar"
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
import { Edit, Trash2, MoreHorizontal, PlusCircle, AlertCircle, CheckCircle2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://dararabappbackendv01-production.up.railway.app/api"

interface Translator {
  id: number
  name: string
  bio: string
}

export default function TranslatorManagement() {
  const [translators, setTranslators] = useState<Translator[]>([])
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
  const [deleteTranslatorId, setDeleteTranslatorId] = useState<number | null>(null)
  const [editTranslator, setEditTranslator] = useState<Translator | null>(null)
  const [isAddTranslatorOpen, setIsAddTranslatorOpen] = useState(false)
  const [isEditTranslatorOpen, setIsEditTranslatorOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [actionAlert, setActionAlert] = useState<{
    type: "success" | "error" | "warning" | null
    message: string
  }>({
    type: null,
    message: "",
  })
  const [isLoading, setIsLoading] = useState(true)

  // Form state for new translator
  const [newTranslator, setNewTranslator] = useState<Partial<Translator>>({
    name: "",
    bio: "",
  })

  // Show alert message
  const showAlert = (type: "success" | "error" | "warning", message: string) => {
    setActionAlert({ type, message })
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setActionAlert({ type: null, message: "" })
    }, 5000)
  }

  useEffect(() => {
    fetchTranslators()
  }, [])

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
  }

  const fetchTranslators = async () => {
    try {
      const res = await fetch(`${API_URL}/inventory/translators/`, { headers })
      const data = await res.json()
      // Ensure data is an array
      const translatorsData = Array.isArray(data) ? data : data.results || []
      setTranslators(translatorsData)
    } catch (error) {
      console.error("Error fetching translators:", error)
      // Set empty array on error
      setTranslators([])
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  // Handle adding a new translator
  const handleAddTranslator = async () => {
    try {
      const res = await fetch(`${API_URL}/inventory/translators/`, {
        method: "POST",
        headers,
        body: JSON.stringify(newTranslator),
      })

      if (!res.ok) throw new Error("Failed to add translator")

      const data = await res.json()
      setTranslators([...translators, data])

      // Reset form
      setNewTranslator({
        name: "",
        bio: "",
      })

      setIsAddTranslatorOpen(false)

      // Show toast notification
      toast({
        title: "Translator Added Successfully",
        description: `${data.name} has been added to the system.`,
        variant: "default",
      })

      // Show alert message
      showAlert("success", `New translator "${data.name}" has been successfully added to the system.`)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add translator",
        variant: "destructive",
      })
      showAlert("error", "Failed to add translator. Please try again.")
    }
  }

  // Handle updating a translator
  const handleUpdateTranslator = async () => {
    if (!editTranslator) return

    try {
      const res = await fetch(`${API_URL}/inventory/translators/${editTranslator.id}/`, {
        method: "PUT",
        headers,
        body: JSON.stringify(editTranslator),
      })

      const responseData = await res.json()

      if (!res.ok) {
        throw new Error(JSON.stringify(responseData))
      }

      setTranslators(translators.map((t) => (t.id === responseData.id ? responseData : t)))
      setEditTranslator(null)
      setIsEditTranslatorOpen(false)

      // Show toast notification
      toast({
        title: "Translator Updated Successfully",
        description: `${responseData.name} has been updated.`,
        variant: "default",
      })

      // Show alert message
      showAlert("success", `Translator "${responseData.name}" has been successfully updated.`)
    } catch (error) {
      console.error("Update error:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to update translator"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      showAlert("error", `Failed to update translator: ${errorMessage}`)
    }
  }

  // Handle deleting a translator
  const handleDeleteTranslator = async () => {
    if (deleteTranslatorId === null) return

    try {
      const translatorToDelete = translators.find((t) => t.id === deleteTranslatorId)
      if (!translatorToDelete) return

      const res = await fetch(`${API_URL}/inventory/translators/${deleteTranslatorId}/delete/`, {
        method: "DELETE",
        headers,
      })

      if (!res.ok) throw new Error("Failed to delete translator")

      setTranslators(translators.filter((t) => t.id !== deleteTranslatorId))
      setDeleteTranslatorId(null)
      setIsDeleteAlertOpen(false)
      setDeleteConfirm("")

      // Show toast notification
      toast({
        title: "Translator Deleted",
        description: `${translatorToDelete.name} has been permanently removed from the system.`,
        variant: "destructive",
      })

      // Show alert message
      showAlert("warning", `Translator "${translatorToDelete.name}" has been permanently deleted from the system.`)
    } catch (error) {
      console.error("Delete error:", error)
      toast({
        title: "Error",
        description: "Failed to delete translator",
        variant: "destructive",
      })
      showAlert("error", "Failed to delete translator. Please try again.")
    }
  }

  // Open edit dialog with translator data
  const openEditDialog = (translator: Translator) => {
    setEditTranslator(translator)
    setIsEditTranslatorOpen(true)
  }

  // Open delete confirmation
  const openDeleteDialog = (translatorId: number) => {
    setDeleteTranslatorId(translatorId)
    setIsDeleteAlertOpen(true)
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
                  <BreadcrumbPage>Translators</BreadcrumbPage>
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
            <h2 className="text-xl font-semibold mb-4">Translator Management</h2>
            <p className="mb-6">Manage translators and their information.</p>

            <div className="border rounded-md">
              <div className="bg-muted p-4 flex justify-between items-center">
                <h3 className="font-medium">Translators</h3>
                <Dialog open={isAddTranslatorOpen} onOpenChange={setIsAddTranslatorOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-primary text-primary-foreground">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Translator
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Translator</DialogTitle>
                      <DialogDescription>Create a new translator entry.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          value={newTranslator.name}
                          onChange={(e) => setNewTranslator({ ...newTranslator, name: e.target.value })}
                          placeholder="Enter translator name"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="bio">Bio</Label>
                        <Textarea
                          id="bio"
                          value={newTranslator.bio || ""}
                          onChange={(e) => setNewTranslator({ ...newTranslator, bio: e.target.value })}
                          placeholder="Enter translator biography"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddTranslatorOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddTranslator}>Add Translator</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="p-4">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-sm border-b">
                        <th className="text-left font-medium p-2">Name</th>
                        <th className="text-left font-medium p-2">Bio</th>
                        <th className="text-right font-medium p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={3} className="py-8 text-center">
                            Loading translators...
                          </td>
                        </tr>
                      ) : translators.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-8 text-center">
                            No translators found
                          </td>
                        </tr>
                      ) : (
                        translators.map((translator) => (
                          <tr key={translator.id} className="border-b last:border-0">
                            <td className="p-2 font-medium">{translator.name}</td>
                            <td className="p-2">{translator.bio || "No bio available"}</td>
                            <td className="p-2 text-right">
                              <div className="flex justify-end gap-2">
                                {/* Desktop view - separate buttons */}
                                <div className="hidden sm:flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openEditDialog(translator)}
                                  >
                                    <Edit className="h-4 w-4" />
                                    <span className="sr-only">Edit</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => openDeleteDialog(translator.id)}
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
                                      <DropdownMenuItem onClick={() => openEditDialog(translator)}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => openDeleteDialog(translator.id)}
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

      {/* Edit Translator Dialog */}
      <Dialog open={isEditTranslatorOpen} onOpenChange={setIsEditTranslatorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Translator</DialogTitle>
            <DialogDescription>Update translator information.</DialogDescription>
          </DialogHeader>
          {editTranslator && (
            <div className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editTranslator.name}
                  onChange={(e) => setEditTranslator({ ...editTranslator, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-bio">Bio</Label>
                <Textarea
                  id="edit-bio"
                  value={editTranslator.bio || ""}
                  onChange={(e) => setEditTranslator({ ...editTranslator, bio: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditTranslatorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateTranslator}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTranslatorId !== null && (
                <>
                  You are about to delete{" "}
                  <strong>{translators.find((t) => t.id === deleteTranslatorId)?.name}</strong>. This action cannot be undone.
                  This will permanently remove the translator from your system.
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
              onClick={handleDeleteTranslator}
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


