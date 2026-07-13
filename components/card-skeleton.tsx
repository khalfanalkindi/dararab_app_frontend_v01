import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type CardSkeletonProps = {
  /** Number of stat cards in the grid (default 4) */
  count?: number
  className?: string
}

/** Compact metric-card skeletons (dashboard sales stats, hub tiles). */
export function CardSkeleton({ count = 4, className }: CardSkeletonProps) {
  return (
    <div
      className={cn(
        "grid gap-4 md:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <Card key={`card-skeleton-${index}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4 rounded" />
          </CardHeader>
          <CardContent>
            <Skeleton className="mb-2 h-8 w-16" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

type OverviewCardSkeletonProps = {
  /** Number of centered metric cells inside the overview (default 3) */
  metrics?: number
  className?: string
}

/** Larger overview card with a title bar and metric cells (projects / people). */
export function OverviewCardSkeleton({
  metrics = 3,
  className,
}: OverviewCardSkeletonProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "grid gap-4",
            metrics === 4 ? "md:grid-cols-4" : "md:grid-cols-3",
          )}
        >
          {Array.from({ length: metrics }).map((_, index) => (
            <div key={`overview-metric-${index}`} className="space-y-2 text-center">
              <Skeleton className="mx-auto h-8 w-16" />
              <Skeleton className="mx-auto h-4 w-24" />
              <Skeleton className="mx-auto h-3 w-28" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

type ChartCardSkeletonProps = {
  className?: string
}

/** Chart-area placeholder matching dashboard chart cards. */
export function ChartCardSkeleton({ className }: ChartCardSkeletonProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[400px] w-full rounded-md" />
      </CardContent>
    </Card>
  )
}
