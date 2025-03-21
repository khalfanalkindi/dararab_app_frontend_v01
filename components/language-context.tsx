"use client"

import * as React from "react"

const LanguageContext = React.createContext({
  t: (key: string) => key,
  dir: "ltr",
})

export const useLanguage = () => {
  const context = React.useContext(LanguageContext)
  return context
}

