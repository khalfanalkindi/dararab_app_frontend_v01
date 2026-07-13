"use client"

import { TrendingUp, ChevronUp, ChevronDown, Coins, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type PosMetricsProps = {
  showMetrics: boolean
  onToggleMetrics: () => void
  todaySalesFormatted: string
  totalCustomers: number
  popularProduct: string
}

export function PosMetrics({
  showMetrics,
  onToggleMetrics,
  todaySalesFormatted,
  totalCustomers,
  popularProduct,
}: PosMetricsProps) {
  return (
    <>
      <div className="mb-4">
        <Button
          variant="ghost"
          className="w-full justify-between"
          onClick={onToggleMetrics}
        >
          <span className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span>Sales Metrics</span>
          </span>
          {showMetrics ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {showMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today&apos;s Sales</p>
                <h3 className="text-2xl font-bold">{todaySalesFormatted}</h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Coins className="h-6 w-6 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Customers</p>
                <h3 className="text-2xl font-bold">{totalCustomers}</h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Popular Product</p>
                <h3 className="text-2xl font-bold">{popularProduct}</h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
