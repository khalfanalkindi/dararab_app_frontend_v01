import type { AppLanguage } from "@/lib/language"
import { ar } from "./ar"
import { en, type MessageTree } from "./en"

export type { MessageTree }
export { ar, en }

type NestedKeyOf<T, Prefix extends string = ""> = T extends string
  ? Prefix
  : {
      [K in keyof T & string]: NestedKeyOf<
        T[K],
        Prefix extends "" ? K : `${Prefix}.${K}`
      >
    }[keyof T & string]

/** Dot-path keys into the message tree, e.g. `nav.dashboard`. */
export type MessageKey = NestedKeyOf<MessageTree>

export type TranslateParams = Record<string, string | number>

const dictionaries: Record<AppLanguage, MessageTree> = { en, ar }

function getByPath(tree: MessageTree, key: string): string | undefined {
  const parts = key.split(".")
  let current: unknown = tree
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === "string" ? current : undefined
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name]
    return value == null ? `{${name}}` : String(value)
  })
}

/** Look up a message for a language; falls back to English then the key. */
export function translate(
  language: AppLanguage,
  key: MessageKey | string,
  params?: TranslateParams,
): string {
  const fromLang = getByPath(dictionaries[language], key)
  if (fromLang != null) return interpolate(fromLang, params)
  if (language !== "en") {
    const fromEn = getByPath(dictionaries.en, key)
    if (fromEn != null) return interpolate(fromEn, params)
  }
  return key
}

export type TranslateFn = (
  key: MessageKey | string,
  params?: TranslateParams,
) => string
