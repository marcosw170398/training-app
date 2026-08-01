import { useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { computePersonalRecords, historyForExercise } from '@/db/repositories/setLogs.repo'
import { useActiveProfile } from '@/state/activeProfile'
import { formatDate } from '@/lib/date'
import { Screen } from '@/components/ui/Screen'
import { Card, EmptyState } from '@/components/ui/Card'
import { Splash } from '@/app/Splash'
import { bestEstimated1RM } from '@/lib/oneRepMax'
import { ExerciseProgressChart, type ProgressPoint } from './ExerciseProgressChart'

export function ExerciseHistoryScreen() {
  const { exerciseKey = '' } = useParams()
  const profile = useActiveProfile()
  const profileId = profile?.id

  const data = useLiveQuery(async () => {
    if (!profileId) return null
    const [logs, recordes] = await Promise.all([
      historyForExercise(profileId, exerciseKey, 'main'),
      computePersonalRecords(profileId, exerciseKey),
    ])
    return { logs, recordes }
  }, [profileId, exerciseKey])

  if (!profile || data === undefined) return <Splash />

  const { logs, recordes } = data ?? { logs: [], recordes: new Set<string>() }
  const nome = logs[0]?.exerciseName ?? 'Exercício'

  // Maior carga POR DIA — o gráfico mostra a evolução do topo da sessão, não
  // toda série solta (uma pirâmide de 15-20-8-12 não deve parecer instável).
  const porDia = new Map<string, { performedAt: number; topWeight: number; isPR: boolean }>()
  for (const log of logs) {
    if (log.weight === null) continue
    const atual = porDia.get(log.dateKey)
    const pr = recordes.has(log.id)
    if (!atual || log.weight > atual.topWeight) {
      porDia.set(log.dateKey, { performedAt: log.performedAt, topWeight: log.weight, isPR: pr })
    } else if (pr) {
      atual.isPR = true
    }
  }
  const pontos: ProgressPoint[] = [...porDia.entries()]
    .map(([dateKey, v]) => ({ dateKey, topWeight: v.topWeight, isPR: v.isPR }))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))

  const melhorCarga = pontos.length ? Math.max(...pontos.map((p) => p.topWeight)) : null
  const totalPRs = recordes.size
  const rm1 = bestEstimated1RM(logs)

  return (
    <Screen title={nome} subtitle={`${logs.length} série(s) registrada(s)`} back="/historico">
      {pontos.length === 0 ? (
        <EmptyState
          title="Sem histórico de carga"
          description="Esse exercício ainda não tem série registrada como principal."
        />
      ) : (
        <>
          <Card className="mb-4">
            <ExerciseProgressChart points={pontos} />
          </Card>

          <div className="mb-4 grid grid-cols-3 gap-3">
            <Card>
              <p className="text-xs text-muted">Melhor carga</p>
              <p className="font-mono text-2xl font-semibold tabular-nums text-text">
                {melhorCarga} <span className="text-sm text-muted">kg</span>
              </p>
            </Card>
            <Card>
              <p className="text-xs text-muted">1RM estimado</p>
              <p className="font-mono text-2xl font-semibold tabular-nums text-text">
                {rm1 !== null ? Math.round(rm1) : '—'}
                {rm1 !== null ? <span className="text-sm text-muted"> kg</span> : null}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-muted">Recordes batidos</p>
              <p className="font-mono text-2xl font-semibold tabular-nums text-main">{totalPRs}</p>
            </Card>
          </div>

          <h2 className="mb-2 text-sm font-medium text-muted">Histórico de séries</h2>
          <ul className="space-y-2">
            {logs.map((log) => {
              const isPR = recordes.has(log.id)
              return (
                <li key={log.id}>
                  <Card
                    className={isPR ? 'flex items-center gap-3 border-main/40 bg-main/5' : 'flex items-center gap-3'}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-muted">
                        {formatDate(log.performedAt)} · série {log.seriesNumber} · {log.targetText || '—'}
                      </p>
                      <p className="font-mono font-semibold tabular-nums">
                        {log.weight !== null ? `${log.weight} kg` : 'sem carga'}
                        {log.reps !== null ? ` × ${log.reps}` : ''}
                      </p>
                    </div>
                    {isPR ? (
                      <span className="shrink-0 rounded-full bg-main/15 px-2 py-1 text-xs font-medium text-main">
                        🏆 recorde
                      </span>
                    ) : null}
                  </Card>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Screen>
  )
}
