import { Navigate, Outlet } from 'react-router'
import { useActiveProfile } from '@/state/activeProfile'
import { Splash } from './Splash'

/**
 * Nenhuma tela de dados renderiza sem perfil ativo. Junto com a regra de que
 * todo repositório recebe `profileId` explícito, é isso que impede dado de um
 * perfil vazar para a tela do outro.
 */
export function RequireProfile() {
  const profile = useActiveProfile()

  if (profile === undefined) return <Splash />
  if (profile === null) return <Navigate to="/" replace />

  return <Outlet />
}
