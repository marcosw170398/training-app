import { useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { NO_WEEK, type Workout } from '@/db/schema'
import { getProfileState, markTutorialSeen, setCurrentWeek } from '@/db/repositories/profiles.repo'
import { getPlan, listPlans } from '@/db/repositories/plans.repo'
import { listWorkoutsOfWeek } from '@/db/repositories/workouts.repo'
import { getInProgressSession, lastSessionByWorkout } from '@/db/repositories/sessions.repo'
import { useActiveProfile } from '@/state/activeProfile'
import { daysSince, formatDate, relativeDays } from '@/lib/date'
import { todayWeekday, weekdayShort } from '@/lib/weekday'
import { Screen } from '@/components/ui/Screen'
import { Card, EmptyState } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Splash } from '@/app/Splash'
import { TutorialOverlay } from '@/features/onboarding/TutorialOverlay'

interface WorkoutRow {
  workout: Workout
  lastAt: number | null
  isToday: boolean
  isSuggested: boolean
}

export function HomeScreen() {
  const navigate = useNavigate()
  const profile = useActiveProfile()
  const profileId = profile?.id

  const data = useLiveQuery(async () => {
    if (!profileId) return null

    const state = await getProfileState(profileId)
    const [openSession, plans] = await Promise.all([
      getInProgressSession(profileId),
      listPlans(profileId),
    ])

    const plan = state.activePlanId ? await getPlan(state.activePlanId) : undefined
    if (!plan) return { state, plan: null, plans, openSession, rows: [] as WorkoutRow[] }

    const week = plan.type === 'periodized' ? Math.max(1, state.currentWeekNumber) : NO_WEEK
    const workouts = await listWorkoutsOfWeek(plan.id, week)
    const lastByWorkout = await lastSessionByWorkout(
      profileId,
      workouts.map((workout) => workout.id),
    )

    const today = todayWeekday()
    const rows: WorkoutRow[] = workouts.map((workout) => ({
      workout,
      lastAt: lastByWorkout.get(workout.id)?.startedAt ?? null,
      isToday: workout.weekday === today,
      isSuggested: false,
    }))

    // A sugestão é só uma dica visual — todo treino continua clicável.
    if (plan.type === 'periodized') {
      const todayRow = rows.find((row) => row.isToday)
      if (todayRow) todayRow.isSuggested = true
    } else if (rows.length) {
      // Plano fixo: sugere o treino menos recente (nunca feito vence tudo).
      const oldest = [...rows].sort(
        (a, b) => (a.lastAt ?? -Infinity) - (b.lastAt ?? -Infinity),
      )[0]
      oldest.isSuggested = true
    }

    return { state, plan, plans, openSession, rows, week }
  }, [profileId])

  if (!profile || !data) return <Splash />

  const { state, plan, plans, openSession, rows } = data
  const week = plan?.type === 'periodized' ? Math.max(1, state.currentWeekNumber) : NO_WEEK
  const daysInWeek = state.weekStartedAt ? daysSince(state.weekStartedAt) : null

  return (
    <Screen
      title={`Olá, ${profile.name}`}
      subtitle={plan ? plan.name : 'Nenhum plano ativo'}
      action={
        <button
          onClick={() => navigate('/perfis')}
          aria-label="Trocar de perfil"
          className="shrink-0"
        >
          <Avatar name={profile.name} color={profile.color} />
        </button>
      }
    >
      {openSession ? (
        <Card className="mb-4 border-accent/50 bg-accent/10">
          <p className="text-sm text-muted">Treino em andamento</p>
          <p className="mt-0.5 font-display font-semibold">{openSession.workoutName}</p>
          <Button
            full
            variant="primary"
            className="mt-3"
            onClick={() => navigate(`/sessao/${openSession.id}`)}
          >
            Retomar treino
          </Button>
        </Card>
      ) : null}

      {!plan ? (
        <EmptyState
          title={plans.length ? 'Escolha um plano ativo' : 'Nenhum plano cadastrado'}
          description={
            plans.length
              ? 'Você tem planos cadastrados, mas nenhum marcado como ativo.'
              : 'Monte seu plano de treino para começar a registrar as cargas.'
          }
          action={
            <Button variant="primary" size="lg" onClick={() => navigate('/planos')}>
              {plans.length ? 'Escolher plano' : 'Criar plano'}
            </Button>
          }
        />
      ) : (
        <>
          {plan.type === 'periodized' ? (
            <div className="mb-4">
              <div className="flex items-center justify-between rounded-2xl border border-border bg-surface px-2 py-2">
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Semana anterior"
                  disabled={week <= 1}
                  onClick={() => setCurrentWeek(profile.id, week - 1)}
                >
                  ‹
                </Button>
                <div className="text-center">
                  {/* Números — mesma família mono do cronômetro e da carga,
                      em vez do texto de prosa ao redor. */}
                  <p className="font-mono font-semibold tabular-nums">
                    Semana {String(week).padStart(2, '0')}
                    <span className="text-muted"> de {String(plan.totalWeeks).padStart(2, '0')}</span>
                  </p>
                  {daysInWeek !== null ? (
                    <p className="text-xs text-muted">
                      nesta semana {daysInWeek === 0 ? 'desde hoje' : relativeDays(state.weekStartedAt!)}
                    </p>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Próxima semana"
                  disabled={week >= plan.totalWeeks}
                  onClick={() => setCurrentWeek(profile.id, week + 1)}
                >
                  ›
                </Button>
              </div>

              {/* Sugestão por data, nunca automática: viagem e imprevisto não
                  podem empurrar a periodização sozinhos. */}
              {daysInWeek !== null && daysInWeek >= 7 && week < plan.totalWeeks ? (
                <Card className="mt-3 border-accent/40">
                  <p className="text-sm">
                    Faz {daysInWeek} dias que você começou a semana {String(week).padStart(2, '0')}.
                  </p>
                  <Button
                    full
                    variant="primary"
                    className="mt-3"
                    onClick={() => setCurrentWeek(profile.id, week + 1)}
                  >
                    Avançar para a semana {String(week + 1).padStart(2, '0')}
                  </Button>
                </Card>
              ) : null}
            </div>
          ) : null}

          {rows.length === 0 ? (
            <EmptyState
              title="Nenhum treino nesta semana"
              description="Cadastre os treinos deste plano para começar."
              action={
                <Button variant="primary" onClick={() => navigate(`/planos/${plan.id}`)}>
                  Editar plano
                </Button>
              }
            />
          ) : (
            <ul className="space-y-3">
              {rows.map(({ workout, lastAt, isToday, isSuggested }) => (
                <li key={workout.id}>
                  <Card
                    onClick={() => navigate(`/treinar/${workout.id}`)}
                    className={isSuggested ? 'border-accent/60' : ''}
                  >
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-display font-semibold">{workout.name}</p>
                          {isSuggested ? (
                            <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">
                              {isToday ? 'hoje' : 'sugerido'}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-sm text-muted">
                          {lastAt
                            ? `última vez ${formatDate(lastAt)} (${relativeDays(lastAt)})`
                            : 'nunca feito'}
                        </p>
                      </div>
                      {workout.weekday ? (
                        <span className="shrink-0 rounded-lg bg-surface-2 px-2 py-1 text-xs text-muted">
                          {weekdayShort(workout.weekday)}
                        </span>
                      ) : null}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {/* Primeiro acesso DESTE perfil: a home é onde ele chega depois de ser
          criado, então é aqui que o tutorial aparece. */}
      {state.tutorialSeenAt === null ? (
        <TutorialOverlay onFinish={() => markTutorialSeen(profile.id)} />
      ) : null}
    </Screen>
  )
}
