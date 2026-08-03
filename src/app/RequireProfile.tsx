import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router'
import { reapStaleSession } from '@/db/repositories/sessions.repo'
import { useActiveProfile } from '@/state/activeProfile'
import { Splash } from './Splash'

/** De quanto em quanto tempo verificar se a sessão aberta ficou esquecida. */
const REAP_CHECK_MS = 5 * 60 * 1000

/**
 * Nenhuma tela de dados renderiza sem perfil ativo. Junto com a regra de que
 * todo repositório recebe `profileId` explícito, é isso que impede dado de um
 * perfil vazar para a tela do outro.
 */
export function RequireProfile() {
  const profile = useActiveProfile()
  const profileId = profile?.id

  // Encerra sozinha uma sessão esquecida (2h ociosa ou 4h de duração). Roda
  // aqui, fora de qualquer `useLiveQuery` — Dexie proíbe escrita dentro de
  // uma query reativa. Sem execução em segundo plano num PWA fechado, isso só
  // pega o esquecimento quando o app reabre ou fica aberto tempo suficiente
  // para o intervalo disparar.
  useEffect(() => {
    if (!profileId) return
    void reapStaleSession(profileId)
    const id = window.setInterval(() => void reapStaleSession(profileId), REAP_CHECK_MS)
    return () => window.clearInterval(id)
  }, [profileId])

  if (profile === undefined) return <Splash />
  if (profile === null) return <Navigate to="/" replace />

  return <Outlet />
}
