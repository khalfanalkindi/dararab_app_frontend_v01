import {
  TableCell,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const CELL_WIDTHS = ["w-32", "w-28", "w-24", "w-36", "w-20", "w-40"] as const

type TableSkeletonProps = {
  /** Number of columns to render per row */
  columns: number
  /** Number of skeleton rows (default 5) */
  rows?: number
  /** Treat the last column as action buttons */
  hasActions?: boolean
  className?: string
}

/**
 * Renders skeleton `<TableRow>`s for use inside an existing `<TableBody>`.
 */
export function TableSkeleton({
  columns,
  rows = 5,
  hasActions = false,
  className,
}: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={`table-skeleton-${rowIndex}`} className={className}>
          {Array.from({ length: columns }).map((_, colIndex) => {
            const isAction = hasActions && colIndex === columns - 1
            return (
              <TableCell
                key={colIndex}
                className={cn(isAction && "text-right")}
              >
                {isAction ? (
                  <div className="flex justify-end gap-2">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                ) : (
                  <Skeleton
                    className={cn("h-5", CELL_WIDTHS[colIndex % CELL_WIDTHS.length])}
                  />
                )}
              </TableCell>
            )
          })}
        </TableRow>
      ))}
    </>
  )
}
