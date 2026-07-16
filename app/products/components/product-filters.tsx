"use client"

import { Search } from "lucide-react"

import { useLanguage } from "@/components/language-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import type { Genre, StatusObject } from "../page"

type ProductFiltersProps = {
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  selectedGenre: string | null
  onSelectedGenreChange: (value: string | null) => void
  selectedStatus: string | null
  onSelectedStatusChange: (value: string | null) => void
  genres: Genre[]
  statusOptions: StatusObject[]
  onResetFilters: () => void
}

export function ProductFilters({
  searchQuery,
  onSearchQueryChange,
  selectedGenre,
  onSelectedGenreChange,
  selectedStatus,
  onSelectedStatusChange,
  genres,
  statusOptions,
  onResetFilters,
}: ProductFiltersProps) {
  const { t } = useLanguage()

  return (
    <div className="flex flex-col md:flex-row gap-4 mb-6">
      <div className="flex-1">
        <div className="relative">
          <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("products.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="ps-8"
          />
        </div>
      </div>
      <div className="flex-1">
        <Select
          value={selectedGenre || "all"}
          onValueChange={(value) => {
            onSelectedGenreChange(value === "all" ? null : value)
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("products.genre")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("products.allGenres")}</SelectItem>
            {genres.map((genre) => (
              <SelectItem key={genre.id} value={genre.id.toString()}>
                {genre.display_name_en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex-1">
        <Select
          value={selectedStatus || "all"}
          onValueChange={(value) => {
            onSelectedStatusChange(value === "all" ? null : value)
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("products.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("products.allStatuses")}</SelectItem>
            {statusOptions.map((status) => (
              <SelectItem key={status.id} value={status.id.toString()}>
                {status.display_name_en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button variant="outline" onClick={onResetFilters}>
        {t("products.clearFilters")}
      </Button>
    </div>
  )
}
