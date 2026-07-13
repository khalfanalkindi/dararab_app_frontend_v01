import { ErrorBoundary } from "@/components/ErrorBoundary"
import { DocumentTitle } from "@/components/document-title"
import Link from "next/link"
import { PageBreadcrumb, DASHBOARD_CRUMB } from "@/components/page-breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"

const links = [
  {
    href: "/admin/users",
    title: "Users",
    description: "Manage user accounts and credentials.",
  },
  {
    href: "/admin/roles",
    title: "Roles",
    description: "Configure user roles and access levels.",
  },
  {
    href: "/admin/pages",
    title: "Pages",
    description: "Register site pages used for permissions.",
  },
  {
    href: "/admin/role-permissions",
    title: "Role Permissions",
    description: "Assign view/add/edit/delete access by role.",
  },
  {
    href: "/admin/user-permissions",
    title: "User Permissions",
    description: "Override page access for individual users.",
  },
  {
    href: "/admin/common",
    title: "Common Definitions",
    description: "Manage shared lists like genres and payment methods.",
  },
]

export default function Page() {
  return (
    <ErrorBoundary>
      <DocumentTitle title="Admin" />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <PageBreadcrumb items={[DASHBOARD_CRUMB, { label: "Admin" }]} />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="min-h-[50vh] flex-1 rounded-xl bg-muted/50 p-6 md:min-h-min">
            <h2 className="mb-2 text-xl font-semibold">Admin</h2>
            <p className="text-muted-foreground">
              Manage users, roles, pages, and permissions for the DarArab app.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <h3 className="mb-2 text-lg font-medium">{link.title}</h3>
                  <p className="text-sm text-muted-foreground">{link.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </SidebarInset>
    </ErrorBoundary>
  )
}
