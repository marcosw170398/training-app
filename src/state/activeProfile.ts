import { useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import type { Profile } from '@/db/schema'

/**
 * O perfil ativo é estado do DISPOSITIVO, não do banco — por isso mora no
 * localStorage. Ler de forma síncrona no boot evita o flash de "tela errada"
 * enquanto o IndexedDB abre.
 */
const KEY = 'treino:activeProfileId'

let current: string | null = readInitial()
const listeners = new Set<() => void>()

function readInitial(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getActiveProfileId(): string | null {
  return current
}

export function setActiveProfileId(id: string | null): void {
  current = id
  try {
    if (id) localStorage.setItem(KEY, id)
    else localStorage.removeItem(KEY)
  } catch {
    /* modo privado do Safari: segue só em memória */
  }
  for (const listener of listeners) listener()
}

export function useActiveProfileId(): string | null {
  return useSyncExternalStore(subscribe, getActiveProfileId, getActiveProfileId)
}

/**
 * `undefined` = ainda carregando; `null` = nenhum perfil ativo válido.
 * Se o perfil salvo não existir mais (removido, ou banco limpo), limpa sozinho.
 */
export function useActiveProfile(): Profile | null | undefined {
  const id = useActiveProfileId()
  return useLiveQuery(async () => {
    if (!id) return null
    const profile = await db.profiles.get(id)
    if (!profile) {
      setActiveProfileId(null)
      return null
    }
    return profile
  }, [id])
}
