import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import eng from './eng'
import vie from './vie'

export type LanguageCode = 'en' | 'vi'

interface DictionaryTree {
  [key: string]: string | DictionaryTree
}
type DictionaryNode = string | DictionaryTree

type I18nContextValue = {
  language: LanguageCode
  setLanguage: (language: LanguageCode) => void
  t: (key: string, fallback?: string, params?: Record<string, string | number>) => string
}

const STORAGE_KEY = 'role-layout-language'
const dictionaries: Record<LanguageCode, DictionaryTree> = {
  en: eng,
  vi: vie,
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

function resolveInitialLanguage(): LanguageCode {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'vi') {
    return stored
  }

  const browserLanguage = window.navigator.language.toLowerCase()
  if (browserLanguage.startsWith('vi')) {
    return 'vi'
  }

  return 'en'
}

function readKey(dictionary: DictionaryTree, key: string): string | undefined {
  const segments = key.split('.')
  let current: DictionaryNode = dictionary

  for (const segment of segments) {
    if (!current || typeof current === 'string' || !(segment in current)) {
      return undefined
    }
    current = current[segment]
  }

  return typeof current === 'string' ? current : undefined
}

function injectParams(template: string, params?: Record<string, string | number>): string {
  if (!params) {
    return template
  }

  return template.replace(/\{(\w+)\}/g, (match, token) => {
    if (!(token in params)) {
      return match
    }
    return String(params[token])
  })
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(() => resolveInitialLanguage())

  const setLanguage = useCallback((nextLanguage: LanguageCode) => {
    setLanguageState(nextLanguage)
    window.localStorage.setItem(STORAGE_KEY, nextLanguage)
  }, [])

  const t = useCallback(
    (key: string, fallback?: string, params?: Record<string, string | number>) => {
      const localizedValue = readKey(dictionaries[language], key)
      const englishFallback = language === 'en' ? undefined : readKey(dictionaries.en, key)
      return injectParams(localizedValue || englishFallback || fallback || key, params)
    },
    [language],
  )

  const contextValue = useMemo(
    () => ({
      language,
      setLanguage,
      t,
    }),
    [language, setLanguage, t],
  )

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider')
  }

  return context
}
