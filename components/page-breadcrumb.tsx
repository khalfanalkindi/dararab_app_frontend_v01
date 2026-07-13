"use client"

import Link from "next/link"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export type BreadcrumbCrumb = {
  label: string
  /** Omit for current page or non-navigable section labels */
  href?: string
}

/**
 * Standard app crumbs: Dashboard → optional Section → Page.
 * Intermediate items without `href` render as plain text (e.g. Definitions, Reports).
 */
export function PageBreadcrumb({ items }: { items: BreadcrumbCrumb[] }) {
  if (!items.length) return null

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <span key={`${item.label}-${index}`} className="contents">
              {index > 0 ? <BreadcrumbSeparator className="hidden md:block" /> : null}
              <BreadcrumbItem className={isLast ? undefined : "hidden md:block"}>
                {isLast ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : item.href ? (
                  <BreadcrumbLink asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <span className="text-muted-foreground">{item.label}</span>
                )}
              </BreadcrumbItem>
            </span>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export const DASHBOARD_CRUMB: BreadcrumbCrumb = { label: "Dashboard", href: "/dashboard" }
export const ADMIN_CRUMB: BreadcrumbCrumb = { label: "Admin", href: "/admin" }
export const DEFINITIONS_CRUMB: BreadcrumbCrumb = { label: "Definitions" }
export const REPORTS_CRUMB: BreadcrumbCrumb = { label: "Reports" }
