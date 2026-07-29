import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import type { TrainingPlan } from '@/db/schema'
import { createPlan, deletePlanCascade, listPlans, updatePlan } from '@/db/repositories/plans.repo'
import { getProfileState, setActivePlan, setCurrentWeek } from '@/db/repositories/profiles.repo'
import { useActiveProfile } from '@/state/activeProfile'
import { Screen } from '@/components/ui/Screen'
import { Card, EmptyState } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Splash } from '@/app/Splash'
import { PlanFormSheet } from './PlanFormSheet'

export function PlansScreen() {
  const navigate = useNavigate()
  const profile = useActiveProfile()
  const profileId = profile?.id

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TrainingPlan | undefined>()
  const [toDelete, setToDelete] = useState<TrainingPlan | undefined>()

  const data = useLiveQuery(async () => {
    if (!profileId) return null
    const [plans, state] = await Promise.all([listPlans(profileId), getProfileState(profileId)])
    const counts = await Promise.all(
      plans.map((plan) => db.workouts.where('planId').equals(plan.id).count()),
    )
    return { plans, state, counts }
  }, [profileId])

  if (!profile || !data) return <Splash />
  const { plans, state, counts } = data

  return (
    <Screen title="Planos" subtitle={`${plans.length} plano(s) de ${profile.name}`}>
      {plans.length === 0 ? (
        <EmptyState
          title="Nenhum plano ainda"
          description="Crie um plano fixo (A, B, C…) ou periodizado (semanas numeradas)."
          action={
            <div className="flex flex-col gap-2">
              <Button variant="primary" size="lg" onClick={() => navigate('/importar')}>
                Importar PDF do treinador
              </Button>
              <Button
                size="lg"
                onClick={() => {
                  setEditing(undefined)
                  setFormOpen(true)
                }}
              >
                Criar plano do zero
              </Button>
            </div>
          }
        />
      ) : (
        <ul className="space-y-3">
          {plans.map((plan, index) => {
            const isActive = state.activePlanId === plan.id
            return (
              <li key={plan.id}>
                <Card className={isActive ? 'border-accent/60' : ''}>
                  <button
                    className="w-full text-left"
                    onClick={() => navigate(`/planos/${plan.id}`)}
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{plan.name}</p>
                        <p className="mt-0.5 text-sm text-muted">
                          {plan.type === 'periodized'
                            ? `Periodizado · ${plan.totalWeeks} semanas`
                            : 'Fixo · repete todo ciclo'}
                          {' · '}
                          {counts[index]} treino(s)
                        </p>
                      </div>
                      {isActive ? (
                        <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">
                          ativo
                        </span>
                      ) : null}
                    </div>
                  </button>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {!isActive ? (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={async () => {
                          await setActivePlan(profile.id, plan.id)
                          // Trocar de plano reinicia a contagem de semanas.
                          await setCurrentWeek(profile.id, plan.type === 'periodized' ? 1 : 0)
                          navigate('/home')
                        }}
                      >
                        Tornar ativo
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditing(plan)
                        setFormOpen(true)
                      }}
                    >
                      Renomear
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => setToDelete(plan)}>
                      Excluir
                    </Button>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {plans.length > 0 ? (
        <div className="mt-6 flex flex-col gap-2">
          <Button full size="lg" variant="primary" onClick={() => navigate('/importar')}>
            Importar PDF do treinador
          </Button>
          <Button
            full
            size="lg"
            onClick={() => {
              setEditing(undefined)
              setFormOpen(true)
            }}
          >
            Novo plano do zero
          </Button>
        </div>
      ) : null}

      <PlanFormSheet
        open={formOpen}
        plan={editing}
        onClose={() => setFormOpen(false)}
        onSubmit={async (values) => {
          if (editing) {
            await updatePlan(editing.id, values)
            return
          }
          const created = await createPlan(profile.id, values)
          if (!state.activePlanId) {
            await setActivePlan(profile.id, created.id)
            await setCurrentWeek(profile.id, created.type === 'periodized' ? 1 : 0)
          }
          navigate(`/planos/${created.id}`)
        }}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        danger
        title={`Excluir "${toDelete?.name ?? ''}"?`}
        confirmLabel="Excluir plano"
        description="Os treinos e exercícios do plano são apagados. O histórico de cargas já registrado é preservado."
        onClose={() => setToDelete(undefined)}
        onConfirm={async () => {
          if (toDelete) await deletePlanCascade(profile.id, toDelete.id)
        }}
      />
    </Screen>
  )
}
