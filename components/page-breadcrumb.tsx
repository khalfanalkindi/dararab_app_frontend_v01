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
import { useLanguage } from "@/components/language-context"
import type { TranslateFn } from "@/lib/i18n"

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

export function dashboardCrumb(t: TranslateFn): BreadcrumbCrumb {
  return { label: t("nav.dashboard"), href: "/dashboard" }
}

export function adminCrumb(t: TranslateFn): BreadcrumbCrumb {
  return { label: t("nav.admin"), href: "/admin" }
}

export function definitionsCrumb(t: TranslateFn): BreadcrumbCrumb {
  return { label: t("nav.definitions") }
}

export function reportsCrumb(t: TranslateFn): BreadcrumbCrumb {
  return { label: t("nav.reports") }
}

/** Localized crumb helpers for client pages. */
export function useAppCrumbs() {
  const { t } = useLanguage()
  return {
    t,
    dashboard: dashboardCrumb(t),
    admin: adminCrumb(t),
    definitions: definitionsCrumb(t),
    reports: reportsCrumb(t),
  }
}

/** @deprecated Prefer `useAppCrumbs().dashboard` or `dashboardCrumb(t)` for i18n. */
export const DASHBOARD_CRUMB: BreadcrumbCrumb = { label: "Dashboard", href: "/dashboard" }
/** @deprecated Prefer `useAppCrumbs().admin`. */
export const ADMIN_CRUMB: BreadcrumbCrumb = { label: "Admin", href: "/admin" }
/** @deprecated Prefer `useAppCrumbs().definitions`. */
export const DEFINITIONS_CRUMB: BreadcrumbCrumb = { label: "Definitions" }
/** @deprecated Prefer `useAppCrumbs().reports`. */
export const REPORTS_CRUMB: BreadcrumbCrumb = { label: "Reports" }
