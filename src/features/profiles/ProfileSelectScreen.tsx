import { useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { listProfiles } from '@/db/repositories/profiles.repo'
import { setActiveProfileId } from '@/state/activeProfile'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Splash } from '@/app/Splash'

/** "Quem está treinando?" — sem senha, um toque para entrar. */
export function ProfileSelectScreen() {
  const navigate = useNavigate()
  const profiles = useLiveQuery(listProfiles, [])

  if (!profiles) return <Splash />

  return (
    <div className="safe-top safe-bottom flex min-h-dvh flex-col justify-center px-6">
      <h1 className="mb-8 text-center font-display text-2xl font-semibold">Quem está treinando?</h1>

      <ul className="mx-auto w-full max-w-sm space-y-3">
        {profiles.map((profile) => (
          <li key={profile.id}>
            <button
              onClick={() => {
                setActiveProfileId(profile.id)
                navigate('/home', { replace: true })
              }}
              className="flex w-full items-center gap-4 rounded-2xl border border-border bg-surface px-4 py-4 text-left active:bg-surface-2"
            >
              <Avatar name={profile.name} color={profile.color} />
              <span className="text-lg font-medium">{profile.name}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mx-auto mt-8 w-full max-w-sm">
        <Button full variant="ghost" onClick={() => navigate('/perfis/gerenciar')}>
          Gerenciar perfis
        </Button>
      </div>
    </div>
  )
}
