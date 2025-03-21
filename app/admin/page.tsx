import Link from "next/link"
import { AppSidebar } from "../../components/app-sidebar"
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

export default function Page() {
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
                <BreadcrumbItem>
                  <BreadcrumbPage>Admin</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="min-h-[50vh] flex-1 rounded-xl bg-muted/50 p-6 md:min-h-min">
            <h2 className="text-xl font-semibold mb-4">Admin Dashboard</h2>
            <p>Welcome to the admin area. Use the sidebar to navigate to different admin sections.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <Link
                href="/admin/users"
                className="block p-6 bg-card rounded-lg border shadow-sm hover:shadow-md transition-shadow"
              >
                <h3 className="text-lg font-medium mb-2">Users</h3>
                <p className="text-sm text-muted-foreground">Manage user accounts and permissions</p>
              </Link>

              <Link
                href="/admin/roles"
                className="block p-6 bg-card rounded-lg border shadow-sm hover:shadow-md transition-shadow"
              >
                <h3 className="text-lg font-medium mb-2">Roles</h3>
                <p className="text-sm text-muted-foreground">Configure user roles and access levels</p>
              </Link>

              <Link
                href="/admin/pages"
                className="block p-6 bg-card rounded-lg border shadow-sm hover:shadow-md transition-shadow"
              >
                <h3 className="text-lg font-medium mb-2">Pages</h3>
                <p className="text-sm text-muted-foreground">Manage site pages and content</p>
              </Link>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

