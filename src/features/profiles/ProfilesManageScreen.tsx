import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  createProfile,
  deleteProfileCascade,
  listProfiles,
  updateProfile,
} from '@/db/repositories/profiles.repo'
import { db } from '@/db/db'
import type { Profile } from '@/db/schema'
import { getActiveProfileId, setActiveProfileId } from '@/state/activeProfile'
import { Screen } from '@/components/ui/Screen'
import { Card, EmptyState } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ProfileFormSheet } from './ProfileFormSheet'

export function ProfilesManageScreen() {
  const navigate = useNavigate()
  const profiles = useLiveQuery(listProfiles, [])
  const [editing, setEditing] = useState<Profile | undefined>()
  const [formOpen, setFormOpen] = useState(false)
  const [toDelete, setToDelete] = useState<Profile | undefined>()

  // Contagem de registros do perfil marcado para remoção — a confirmação
  // precisa dizer exatamente o que vai ser perdido.
  const deleteStats = useLiveQuery(async () => {
    if (!toDelete) return null
    const [plans, sets] = await Promise.all([
      db.plans.where('profileId').equals(toDelete.id).count(),
      db.setLogs.where('profileId').equals(toDelete.id).count(),
    ])
    return { plans, sets }
  }, [toDelete?.id])

  const isEmpty = profiles?.length === 0

  return (
    <Screen
      title="Perfis"
      subtitle={isEmpty ? 'Crie o primeiro perfil para começar' : undefined}
      back={isEmpty ? undefined : true}
      bottomSpace={false}
    >
      {profiles === undefined ? null : isEmpty ? (
        <EmptyState
          title="Nenhum perfil ainda"
          description="Cada pessoa tem seu próprio plano e histórico, no mesmo celular."
          action={
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                setEditing(undefined)
                setFormOpen(true)
              }}
            >
              Criar perfil
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {profiles.map((profile) => (
            <li key={profile.id}>
              <Card className="flex items-center gap-3">
                <Avatar name={profile.name} color={profile.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{profile.name}</p>
                  {profile.id === getActiveProfileId() ? (
                    <p className="text-xs text-accent">Perfil ativo</p>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(profile)
                    setFormOpen(true)
                  }}
                >
                  Editar
                </Button>
                <Button size="sm" variant="danger" onClick={() => setToDelete(profile)}>
                  Remover
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {!isEmpty ? (
        <div className="mt-6">
          <Button
            full
            size="lg"
            onClick={() => {
              setEditing(undefined)
              setFormOpen(true)
            }}
          >
            Adicionar perfil
          </Button>
        </div>
      ) : null}

      <ProfileFormSheet
        open={formOpen}
        profile={editing}
        onClose={() => setFormOpen(false)}
        onSubmit={async (values) => {
          if (editing) {
            await updateProfile(editing.id, values)
            return
          }
          const created = await createProfile(values)
          // Primeiro perfil do app: já entra ativo e segue direto pro treino.
          if ((profiles?.length ?? 0) === 0) {
            setActiveProfileId(created.id)
            navigate('/home', { replace: true })
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        danger
        title={`Remover ${toDelete?.name ?? ''}?`}
        confirmLabel="Remover tudo"
        confirmText={toDelete?.name}
        description={
          <>
            <p>
              Isso apaga <strong>{deleteStats?.plans ?? 0}</strong> plano(s) e{' '}
              <strong>{deleteStats?.sets ?? 0}</strong> série(s) registrada(s) deste perfil.
            </p>
            <p className="mt-2">
              Os dados existem só neste navegador — não há backup automático. Exporte antes se
              quiser guardar.
            </p>
          </>
        }
        onClose={() => setToDelete(undefined)}
        onConfirm={async () => {
          if (!toDelete) return
          const removedId = toDelete.id
          await deleteProfileCascade(removedId)
          if (getActiveProfileId() === removedId) {
            setActiveProfileId(null)
            navigate('/', { replace: true })
          }
        }}
      />
    </Screen>
  )
}
