import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { listProfiles } from '@/db/repositories/profiles.repo'
import { getActiveProfileId, setActiveProfileId } from '@/state/activeProfile'
import { Splash } from './Splash'

/**
 * Porta de entrada do app:
 *   0 perfis   -> onboarding (criar o primeiro)
 *   1 perfil   -> ativa sozinho e vai direto pro treino
 *   2+ perfis  -> "Quem está treinando?"
 */
export function RootRedirect() {
  const navigate = useNavigate()
  const profiles = useLiveQuery(listProfiles, [])

  useEffect(() => {
    if (!profiles) return

    if (profiles.length === 0) {
      navigate('/perfis/gerenciar', { replace: true })
      return
    }

    const activeId = getActiveProfileId()
    if (activeId && profiles.some((profile) => profile.id === activeId)) {
      navigate('/home', { replace: true })
      return
    }

    if (profiles.length === 1) {
      setActiveProfileId(profiles[0].id)
      navigate('/home', { replace: true })
      return
    }

    navigate('/perfis', { replace: true })
  }, [profiles, navigate])

  return <Splash />
}
