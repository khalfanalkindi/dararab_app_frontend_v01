"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
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
import { Edit, Trash2, MoreHorizontal, PlusCircle, AlertCircle, CheckCircle2, FileText } from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"

interface Project {
  id: number
  title_ar: string
  title_original: string | null
  manuscript: string
  description: string
  approval_status: boolean
  progress_status: { id: number; display_name_en: string } | null
  status: { id: number; display_name_en: string } | null
  type: { id: number; display_name_en: string } | null
  author: { id: number; name: string } | null
  translator: { id: number; name: string } | null
  rights_owner: { id: number; name: string } | null
  reviewer: { id: number; name: string } | null
}

export default function ProjectManagement() {
  const [projects, setProjects] = useState<Project[]>([])
  const [progressOptions, setProgressOptions] = useState<{ id: number; display_name_en: string }[]>([])
  const [statusOptions, setStatusOptions] = useState<{ id: number; display_name_en: string }[]>([])
  const [typeOptions, setTypeOptions] = useState<{ id: number; display_name_en: string }[]>([])
  const [authors, setAuthors] = useState<{ id: number; name: string }[]>([])
  const [translators, setTranslators] = useState<{ id: number; name: string }[]>([])
  const [rightsOwners, setRightsOwners] = useState<{ id: number; name: string }[]>([])
  const [reviewers, setReviewers] = useState<{ id: number; name: string }[]>([])
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
  const [deleteProjectId, setDeleteProjectId] = useState<number | null>(null)
  const [editProject, setEditProject] = useState<Project | null>(null)
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false)
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [actionAlert, setActionAlert] = useState<{
    type: "success" | "error" | "warning" | null
    message: string
  }>({
    type: null,
    message: "",
  })
  const [isLoading, setIsLoading] = useState(true)

  // Form state for new project with default values
  const [newProject, setNewProject] = useState<Partial<Project>>({
    title_ar: "",
    title_original: "", // English Title
    manuscript: "",
    description: "",
    approval_status: false, // Default: No
    progress_status: null, // Will be set to "Created" after options are loaded
    status: null, // Will be set to "Draft" after options are loaded
    type: null,
    author: null,
    translator: null,
    rights_owner: null,
    reviewer: null,
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
    const fetchData = async () => {
      setIsLoading(true)
      try {
        await Promise.all([
          fetchProjects(),
          fetchProgressOptions(),
          fetchStatusOptions(),
          fetchTypeOptions(),
          fetchAuthors(),
          fetchTranslators(),
          fetchRightsOwners(),
          fetchReviewers(),
        ])
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to fetch data",
          variant: "destructive",
        })
        showAlert("error", "Failed to fetch data. Please try again later.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  // Set default values for new project after options are loaded
  useEffect(() => {
    if (progressOptions.length > 0 && statusOptions.length > 0) {
      const createdStatus = progressOptions.find((opt) => opt.display_name_en === "Created")
      const draftStatus = statusOptions.find((opt) => opt.display_name_en === "Draft")

      setNewProject((prev) => ({
        ...prev,
        progress_status: createdStatus || null,
        status: draftStatus || null,
      }))
    }
  }, [progressOptions, statusOptions])

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
  }

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_URL}/inventory/projects/`, { headers })
      const data = await res.json()
      setProjects(data)
    } catch (error) {
      console.error("Error fetching projects:", error)
      throw error
    }
  }

  const fetchProgressOptions = async () => {
    try {
      const res = await fetch(`${API_URL}/common/list-items/progress_status/`, { headers })
      const data = await res.json()
      setProgressOptions(data)
    } catch (error) {
      console.error("Error fetching progress options:", error)
      throw error
    }
  }

  const fetchStatusOptions = async () => {
    try {
      const res = await fetch(`${API_URL}/common/list-items/projects_status/`, { headers })
      const data = await res.json()
      setStatusOptions(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching status options:", error)
      throw error
    }
  }

  const fetchTypeOptions = async () => {
    try {
      const res = await fetch(`${API_URL}/common/list-items/projects_type/`, { headers })
      const data = await res.json()
      setTypeOptions(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching type options:", error)
      throw error
    }
  }

  const fetchAuthors = async () => {
    try {
      const res = await fetch(`${API_URL}/inventory/authors/`, { headers })
      const data = await res.json()
      setAuthors(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching authors:", error)
    }
  }

  const fetchTranslators = async () => {
    try {
      const res = await fetch(`${API_URL}/inventory/translators/`, { headers })
      const data = await res.json()
      setTranslators(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching translators:", error)
    }
  }

  const fetchRightsOwners = async () => {
    try {
      const res = await fetch(`${API_URL}/inventory/rights-owners/`, { headers })
      const data = await res.json()
      setRightsOwners(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching rights owners:", error)
      throw error
    }
  }

  const fetchReviewers = async () => {
    try {
      const res = await fetch(`${API_URL}/inventory/reviewers/`, { headers })
      const data = await res.json()
      setReviewers(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching reviewers:", error)
      throw error
    }
  }

  // Handle adding a new project
  const handleAddProject = async () => {
    try {
      // Create base data with required fields
      const formattedData: any = {
        title_ar: newProject.title_ar,
        title_original: newProject.title_original,
        manuscript: newProject.manuscript,
        description: newProject.description,
        approval_status: newProject.approval_status,
      }

      // Only add foreign key fields if they have values
      if (newProject.progress_status?.id) {
        formattedData.progress_status_id = newProject.progress_status.id
      }
      if (newProject.status?.id) {
        formattedData.status_id = newProject.status.id
      }
      if (newProject.type?.id) {
        formattedData.type_id = newProject.type.id
      }
      if (newProject.author?.id) {
        formattedData.author_id = newProject.author.id
      }
      if (newProject.translator?.id) {
        formattedData.translator_id = newProject.translator.id
      }
      if (newProject.rights_owner?.id) {
        formattedData.rights_owner_id = newProject.rights_owner.id
      }
      if (newProject.reviewer?.id) {
        formattedData.reviewer_id = newProject.reviewer.id
      }

      const res = await fetch(`${API_URL}/inventory/projects/`, {
        method: "POST",
        headers,
        body: JSON.stringify(formattedData),
      })

      if (!res.ok) throw new Error("Failed to add project")

      const data = await res.json()
      setProjects([...projects, data])

      // Reset form with default values
      const createdStatus = progressOptions.find((opt) => opt.display_name_en === "Created")
      const draftStatus = statusOptions.find((opt) => opt.display_name_en === "Draft")

      setNewProject({
        title_ar: "",
        title_original: "",
        manuscript: "",
        description: "",
        approval_status: false,
        progress_status: createdStatus || null,
        status: draftStatus || null,
        type: null,
        author: null,
        translator: null,
        rights_owner: null,
        reviewer: null,
      })

      setIsAddProjectOpen(false)

      // Show toast notification
      toast({
        title: "Project Added Successfully",
        description: `${data.title_ar} has been added to the system.`,
        variant: "default",
      })

      // Show alert message
      showAlert("success", `New project "${data.title_ar}" has been successfully added to the system.`)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add project",
        variant: "destructive",
      })
      showAlert("error", "Failed to add project. Please try again.")
    }
  }

  // Handle updating a project
  const handleUpdateProject = async () => {
    if (!editProject) return

    try {
      // Create base data with required fields
      const formattedData: any = {
        title_ar: editProject.title_ar,
        title_original: editProject.title_original,
        manuscript: editProject.manuscript,
        description: editProject.description,
        approval_status: editProject.approval_status,
      }

      // Only add foreign key fields if they have values
      if (editProject.progress_status?.id) {
        formattedData.progress_status_id = editProject.progress_status.id
      }
      if (editProject.status?.id) {
        formattedData.status_id = editProject.status.id
      }
      if (editProject.type?.id) {
        formattedData.type_id = editProject.type.id
      }
      if (editProject.author?.id) {
        formattedData.author_id = editProject.author.id
      }
      if (editProject.translator?.id) {
        formattedData.translator_id = editProject.translator.id
      }
      if (editProject.rights_owner?.id) {
        formattedData.rights_owner_id = editProject.rights_owner.id
      }
      if (editProject.reviewer?.id) {
        formattedData.reviewer_id = editProject.reviewer.id
      }

      const res = await fetch(`${API_URL}/inventory/projects/${editProject.id}/`, {
        method: "PUT",
        headers,
        body: JSON.stringify(formattedData),
      })

      const responseData = await res.json()

      if (!res.ok) {
        throw new Error(JSON.stringify(responseData))
      }

      setProjects(projects.map((p) => (p.id === responseData.id ? responseData : p)))
      setEditProject(null)
      setIsEditProjectOpen(false)

      // Show toast notification
      toast({
        title: "Project Updated Successfully",
        description: `${responseData.title_ar} has been updated.`,
        variant: "default",
      })

      // Show alert message
      showAlert("success", `Project "${responseData.title_ar}" has been successfully updated.`)
    } catch (error) {
      console.error("Update error:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to update project"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      showAlert("error", `Failed to update project: ${errorMessage}`)
    }
  }

  // Handle deleting a project
  const handleDeleteProject = async () => {
    if (deleteProjectId === null) return

    try {
      const projectToDelete = projects.find((p) => p.id === deleteProjectId)
      if (!projectToDelete) return

      const res = await fetch(`${API_URL}/inventory/projects/${deleteProjectId}/delete/`, {
        method: "DELETE",
        headers,
      })

      if (!res.ok) throw new Error("Failed to delete project")

      setProjects(projects.filter((p) => p.id !== deleteProjectId))
      setDeleteProjectId(null)
      setIsDeleteAlertOpen(false)
      setDeleteConfirm("")

      // Show toast notification
      toast({
        title: "Project Deleted",
        description: `${projectToDelete.title_ar} has been permanently removed from the system.`,
        variant: "destructive",
      })

      // Show alert message
      showAlert("warning", `Project "${projectToDelete.title_ar}" has been permanently deleted from the system.`)
    } catch (error) {
      console.error("Delete error:", error)
      toast({
        title: "Error",
        description: "Failed to delete project",
        variant: "destructive",
      })
      showAlert("error", "Failed to delete project. Please try again.")
    }
  }

  // Open edit dialog with project data
  const openEditDialog = (project: Project) => {
    const projectForEdit = {
      ...project,
      progress_status: progressOptions.find((opt) => opt.id === project.progress_status?.id) || null,
      status: statusOptions.find((opt) => opt.id === project.status?.id) || null,
      type: typeOptions.find((opt) => opt.id === project.type?.id) || null,
      author: authors.find((opt) => opt.id === project.author?.id) || null,
      translator: translators.find((opt) => opt.id === project.translator?.id) || null,
      rights_owner: rightsOwners.find((opt) => opt.id === project.rights_owner?.id) || null,
      reviewer: reviewers.find((opt) => opt.id === project.reviewer?.id) || null,
    }

    setEditProject(projectForEdit)
    setIsEditProjectOpen(true)
  }

  // Open delete confirmation
  const openDeleteDialog = (projectId: number) => {
    setDeleteProjectId(projectId)
    setIsDeleteAlertOpen(true)
  }

  // Get progress status name by ID
  const getProgressStatusName = (statusId: string | { id: number; display_name_en: string }) => {
    if (typeof statusId === "object" && statusId?.display_name_en) {
      return statusId.display_name_en
    }
    const status = progressOptions.find((s) => s.id.toString() === statusId?.toString())
    return status ? status.display_name_en : "Unknown Status"
  }

  // Get status name by ID
  const getStatusName = (statusId: string | { id: number; display_name_en: string }) => {
    if (typeof statusId === "object" && statusId?.display_name_en) {
      return statusId.display_name_en
    }
    const status = statusOptions.find((s) => s.id.toString() === statusId?.toString())
    return status ? status.display_name_en : "Unknown Status"
  }

  // Get type name by ID
  const getTypeName = (typeId: string | { id: number; display_name_en: string }) => {
    if (typeof typeId === "object" && typeId?.display_name_en) {
      return typeId.display_name_en
    }
    const type = typeOptions.find((t) => t.id.toString() === typeId?.toString())
    return type ? type.display_name_en : "Unknown Type"
  }

  // Get person name by ID
  const getPersonName = (
    personId: string | { id: number; name: string },
    personList: { id: number; name: string }[],
  ) => {
    if (typeof personId === "object" && personId?.name) {
      return personId.name
    }
    const person = personList.find((p) => p.id.toString() === personId?.toString())
    return person ? person.name : "Unknown"
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
                  <BreadcrumbPage>Projects</BreadcrumbPage>
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
            <h2 className="text-xl font-semibold mb-4">Project Management</h2>
            <p className="mb-6">Manage projects and their progress status.</p>

            <div className="border rounded-md">
              <div className="bg-muted p-4 flex justify-between items-center">
                <h3 className="font-medium">Projects</h3>
                <Dialog open={isAddProjectOpen} onOpenChange={setIsAddProjectOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-primary text-primary-foreground">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Project
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add New Project</DialogTitle>
                      <DialogDescription>Create a new project for your inventory.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                      {/* Basic Information Section */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Basic Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="title_ar">Title (Arabic)</Label>
                            <Input
                              id="title_ar"
                              value={newProject.title_ar}
                              onChange={(e) => setNewProject({ ...newProject, title_ar: e.target.value })}
                              placeholder="Enter project title in Arabic"
                              dir="rtl"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="title_original">English Title</Label>
                            <Input
                              id="title_original"
                              value={newProject.title_original || ""}
                              onChange={(e) => setNewProject({ ...newProject, title_original: e.target.value })}
                              placeholder="Enter title in English"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="manuscript">Manuscript</Label>
                            <Textarea
                              id="manuscript"
                              value={newProject.manuscript || ""}
                              onChange={(e) => setNewProject({ ...newProject, manuscript: e.target.value })}
                              placeholder="Enter manuscript content"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                              id="description"
                              value={newProject.description || ""}
                              onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                              placeholder="Enter project description"
                            />
                          </div>
                        </div>
                      </div>

                      <Separator className="my-2" />

                      {/* Status Section */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Status Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="approval_status">Approval Status</Label>
                            <Switch
                              id="approval_status"
                              checked={newProject.approval_status}
                              onCheckedChange={(checked) => setNewProject({ ...newProject, approval_status: checked })}
                            />
                            <p className="text-xs text-muted-foreground">
                              {newProject.approval_status ? "Approved" : "Not Approved"}
                            </p>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="progress_status">Progress Status</Label>
                            <Select
                              value={newProject.progress_status?.id?.toString() || ""}
                              onValueChange={(value) =>
                                setNewProject({
                                  ...newProject,
                                  progress_status: progressOptions.find((opt) => opt.id.toString() === value) || null,
                                })
                              }
                            >
                              <SelectTrigger id="progress_status">
                                <SelectValue placeholder="Select progress status" />
                              </SelectTrigger>
                              <SelectContent>
                                {progressOptions.map((option) => (
                                  <SelectItem key={option.id} value={option.id.toString()}>
                                    {option.display_name_en}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="status">Status</Label>
                            <Select
                              value={newProject.status?.id?.toString() || ""}
                              onValueChange={(value) =>
                                setNewProject({
                                  ...newProject,
                                  status: statusOptions.find((opt) => opt.id.toString() === value) || null,
                                })
                              }
                            >
                              <SelectTrigger id="status">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                              <SelectContent>
                                {statusOptions.map((option) => (
                                  <SelectItem key={option.id} value={option.id.toString()}>
                                    {option.display_name_en}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="type">Type</Label>
                            <Select
                              value={newProject.type?.id?.toString() || ""}
                              onValueChange={(value) =>
                                setNewProject({
                                  ...newProject,
                                  type: typeOptions.find((opt) => opt.id.toString() === value) || null,
                                })
                              }
                            >
                              <SelectTrigger id="type">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                {typeOptions.map((option) => (
                                  <SelectItem key={option.id} value={option.id.toString()}>
                                    {option.display_name_en}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddProjectOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddProject}>Add Project</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="p-4">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-sm border-b">
                        <th className="text-left font-medium p-2">Project Title (Arabic)</th>
                        <th className="text-left font-medium p-2">Project Title (English)</th>
                        <th className="text-left font-medium p-2">Type</th>
                        <th className="text-left font-medium p-2">Approval Status</th>
                        <th className="text-left font-medium p-2">Progress Status</th>
                        <th className="text-right font-medium p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center">
                            Loading projects...
                          </td>
                        </tr>
                      ) : projects.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center">
                            No projects found
                          </td>
                        </tr>
                      ) : (
                        projects.map((project) => (
                          <tr key={project.id} className="border-b last:border-0">
                            <td className="p-2 font-medium">{project.title_ar}</td>
                            <td className="p-2">{project.title_original || "No English Title"}</td>
                            <td className="p-2">
                              {project.type ? (
                                <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10">
                                  {typeof project.type === "object"
                                    ? project.type.display_name_en
                                    : getTypeName(project.type)}
                                </span>
                              ) : (
                                "Not set"
                              )}
                            </td>
                            <td className="p-2">
                              {project.approval_status ? (
                                <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-700/10">
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Approved
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-700/10">
                                  <AlertCircle className="h-4 w-4 mr-1" />
                                  Not Approved
                                </span>
                              )}
                            </td>
                            <td className="p-2">
                              {project.progress_status ? (
                                <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                  {typeof project.progress_status === "object"
                                    ? project.progress_status.display_name_en
                                    : getProgressStatusName(project.progress_status)}
                                </span>
                              ) : (
                                "Not set"
                              )}
                            </td>
                            <td className="p-2 text-right">
                              <div className="flex justify-end gap-2">
                                {/* Desktop view - separate buttons */}
                                <div className="hidden sm:flex gap-2">
                                  {/* Contract button - only shown for approved projects */}
                                  {project.approval_status && (
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8 text-blue-600 hover:text-blue-800"
                                      title="Contracts"
                                    >
                                      <FileText className="h-4 w-4" />
                                      <span className="sr-only">Contracts</span>
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openEditDialog(project)}
                                  >
                                    <Edit className="h-4 w-4" />
                                    <span className="sr-only">Edit</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => openDeleteDialog(project.id)}
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
                                      {project.approval_status && (
                                        <DropdownMenuItem>
                                          <FileText className="h-4 w-4 mr-2" />
                                          Contracts
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem onClick={() => openEditDialog(project)}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => openDeleteDialog(project.id)}
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

      {/* Edit Project Dialog */}
      <Dialog open={isEditProjectOpen} onOpenChange={setIsEditProjectOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update project information.</DialogDescription>
          </DialogHeader>
          {editProject && (
            <div className="space-y-6 py-4">
              {/* Basic Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-title_ar">Title (Arabic)</Label>
                    <Input
                      id="edit-title_ar"
                      value={editProject.title_ar || ""}
                      onChange={(e) => setEditProject({ ...editProject, title_ar: e.target.value })}
                      dir="rtl"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-title_original">English Title</Label>
                    <Input
                      id="edit-title_original"
                      value={editProject.title_original || ""}
                      onChange={(e) => setEditProject({ ...editProject, title_original: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-manuscript">Manuscript</Label>
                    <Textarea
                      id="edit-manuscript"
                      value={editProject.manuscript || ""}
                      onChange={(e) => setEditProject({ ...editProject, manuscript: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-description">Description</Label>
                    <Textarea
                      id="edit-description"
                      value={editProject.description || ""}
                      onChange={(e) => setEditProject({ ...editProject, description: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <Separator className="my-2" />

              {/* Status Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Status Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-approval_status">Approval Status</Label>
                    <Switch
                      id="edit-approval_status"
                      checked={editProject.approval_status}
                      onCheckedChange={(checked) => setEditProject({ ...editProject, approval_status: checked })}
                    />
                    <p className="text-xs text-muted-foreground">
                      {editProject.approval_status ? "Approved" : "Not Approved"}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-progress_status">Progress Status</Label>
                    <Select
                      value={editProject.progress_status?.id?.toString() || ""}
                      onValueChange={(value) =>
                        setEditProject({
                          ...editProject,
                          progress_status: progressOptions.find((opt) => opt.id.toString() === value) || null,
                        })
                      }
                    >
                      <SelectTrigger id="edit-progress_status">
                        <SelectValue placeholder="Select progress status" />
                      </SelectTrigger>
                      <SelectContent>
                        {progressOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id.toString()}>
                            {option.display_name_en}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-status">Status</Label>
                    <Select
                      value={editProject.status?.id?.toString() || ""}
                      onValueChange={(value) =>
                        setEditProject({
                          ...editProject,
                          status: statusOptions.find((opt) => opt.id.toString() === value) || null,
                        })
                      }
                    >
                      <SelectTrigger id="edit-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id.toString()}>
                            {option.display_name_en}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-type">Type</Label>
                    <Select
                      value={editProject.type?.id?.toString() || ""}
                      onValueChange={(value) =>
                        setEditProject({
                          ...editProject,
                          type: typeOptions.find((opt) => opt.id.toString() === value) || null,
                        })
                      }
                    >
                      <SelectTrigger id="edit-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {typeOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id.toString()}>
                            {option.display_name_en}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator className="my-2" />

              {/* People Section - Read Only */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">People Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-author">Author</Label>
                    <div className="p-2 border rounded-md bg-muted/30">
                      {editProject.author ? getPersonName(editProject.author, authors) : "Not assigned"}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-translator">Translator</Label>
                    <div className="p-2 border rounded-md bg-muted/30">
                      {editProject.translator ? getPersonName(editProject.translator, translators) : "Not assigned"}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-rights_owner">Rights Owner</Label>
                    <div className="p-2 border rounded-md bg-muted/30">
                      {editProject.rights_owner
                        ? getPersonName(editProject.rights_owner, rightsOwners)
                        : "Not assigned"}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-reviewer">Reviewer</Label>
                    <div className="p-2 border rounded-md bg-muted/30">
                      {editProject.reviewer ? getPersonName(editProject.reviewer, reviewers) : "Not assigned"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditProjectOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateProject}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteProjectId !== null && (
                <>
                  You are about to delete <strong>{projects.find((p) => p.id === deleteProjectId)?.title_ar}</strong>.
                  This action cannot be undone. This will permanently remove the project from your system.
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
              onClick={handleDeleteProject}
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

