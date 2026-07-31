import { useSyncExternalStore } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

/**
 * Preferência de tema. Fica no localStorage, não no perfil: é o dispositivo
 * que tem uma aparência, não a pessoa logada — e precisa ser lido de forma
 * síncrona antes do primeiro paint (o script inline em `index.html` faz
 * exatamente essa leitura, para não haver flash da cor errada na abertura).
 */
const KEY = 'treino:theme'

function readInitial(): ThemePreference {
  try {
    const saved = localStorage.getItem(KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return 'system'
  }
}

let current: ThemePreference = readInitial()
const listeners = new Set<() => void>()

function apply(pref: ThemePreference): void {
  const root = document.documentElement
  if (pref === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', pref)
}

export function setThemePreference(pref: ThemePreference): void {
  current = pref
  try {
    if (pref === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
  } catch {
    /* modo privado do Safari: segue só em memória nesta aba */
  }
  apply(pref)
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => 'system',
  )
}
