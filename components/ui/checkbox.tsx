"use client"

import * as React from "react"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    indeterminate?: boolean
  }
>(({ className, indeterminate, ...props }, ref) => {
  const innerRef = React.useRef<HTMLInputElement>(null)

  React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement)

  React.useEffect(() => {
    if (innerRef.current) {
      innerRef.current.indeterminate = !!indeterminate
    }
  }, [indeterminate])

  return (
    <div className="relative flex items-center">
      <input
        type="checkbox"
        ref={innerRef}
        className={cn(
          "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none",
          className,
        )}
        {...props}
      />
      <CheckIcon
        className="absolute left-0 top-0 h-4 w-4 opacity-0 text-primary-foreground peer-checked:opacity-100 pointer-events-none"
        style={{
          opacity: props.checked ? 1 : 0,
          color: "white",
          backgroundColor: props.checked ? "hsl(var(--primary))" : "transparent",
          borderRadius: "0.125rem",
        }}
      />
    </div>
  )
})
Checkbox.displayName = "Checkbox"

export { Checkbox }

