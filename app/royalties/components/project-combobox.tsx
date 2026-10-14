"use client"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"

export interface ProjectOption {
  id: number
  title_ar: string
  title_original: string | null
}

function projectLabel(project: ProjectOption): string {
  return project.title_ar || project.title_original || `Project #${project.id}`
}

export function ProjectCombobox({
  projects,
  value,
  onChange,
  isLoading,
}: {
  projects: ProjectOption[]
  value: string | null
  onChange: (value: string | null) => void
  isLoading?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = value ? projects.find((p) => String(p.id) === value) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={isLoading}
        >
          <span className="truncate">
            {selected
              ? projectLabel(selected)
              : isLoading
                ? "Loading projects..."
                : "Select a project"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search projects..." />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No project found.</CommandEmpty>
            <CommandGroup>
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={`${project.id} ${project.title_ar ?? ""} ${project.title_original ?? ""}`}
                  onSelect={() => {
                    onChange(String(project.id))
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === String(project.id) ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="min-w-0">
                    <p className="truncate">{projectLabel(project)}</p>
                    {project.title_ar && project.title_original ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {project.title_original}
                      </p>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
