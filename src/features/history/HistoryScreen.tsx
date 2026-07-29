import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import type { Id } from '@/db/schema'
import { listSessions } from '@/db/repositories/sessions.repo'
import { listSetLogsOfSession } from '@/db/repositories/setLogs.repo'
import { useActiveProfile } from '@/state/activeProfile'
import { formatDateTime, formatDuration } from '@/lib/date'
import { Screen } from '@/components/ui/Screen'
import { Card, EmptyState } from '@/components/ui/Card'
import { Splash } from '@/app/Splash'

export function HistoryScreen() {
  const profile = useActiveProfile()
  const profileId = profile?.id
  const [expanded, setExpanded] = useState<Id | null>(null)

  const sessions = useLiveQuery(async () => {
    if (!profileId) return null
    const list = await listSessions(profileId)
    const counts = await Promise.all(
      list.map((session) => db.setLogs.where('sessionId').equals(session.id).count()),
    )
    return list.map((session, index) => ({ session, setCount: counts[index] }))
  }, [profileId])

  const detail = useLiveQuery(async () => {
    if (!expanded) return null
    return listSetLogsOfSession(expanded)
  }, [expanded])

  if (!profile || !sessions) return <Splash />

  return (
    <Screen title="Histórico" subtitle={`${sessions.length} treino(s) de ${profile.name}`}>
      {sessions.length === 0 ? (
        <EmptyState
          title="Nada registrado ainda"
          description="Cada série concluída durante o treino aparece aqui."
        />
      ) : (
        <ul className="space-y-3">
          {sessions.map(({ session, setCount }) => {
            const isOpen = expanded === session.id
            const duration = session.finishedAt ? session.finishedAt - session.startedAt : null
            return (
              <li key={session.id}>
                <Card>
                  <button
                    className="w-full text-left"
                    onClick={() => setExpanded(isOpen ? null : session.id)}
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{session.workoutName}</p>
                        <p className="mt-0.5 text-sm text-muted">
                          {formatDateTime(session.startedAt)}
                          {session.weekNumber ? ` · semana ${session.weekNumber}` : ''}
                        </p>
                        <p className="mt-0.5 text-sm text-muted">
                          {setCount} série(s)
                          {duration !== null ? ` · ${formatDuration(duration)}` : ' · em andamento'}
                        </p>
                      </div>
                      <span className="text-muted">{isOpen ? '−' : '+'}</span>
                    </div>
                  </button>

                  {isOpen && detail ? (
                    <div className="mt-3 space-y-1 border-t border-border pt-3">
                      {detail.length === 0 ? (
                        <p className="text-sm text-muted">Nenhuma série registrada.</p>
                      ) : (
                        detail.map((log) => (
                          <div key={log.id} className="flex gap-2 text-sm">
                            <span className="min-w-0 flex-1 truncate text-muted">
                              {log.exerciseName}
                              <span className="text-muted/60"> · s{log.seriesNumber}</span>
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {log.weight !== null ? `${log.weight} kg` : '—'}
                              {log.reps !== null ? ` × ${log.reps}` : ''}
                              {log.durationSeconds !== null ? ` ${log.durationSeconds}s` : ''}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </Screen>
  )
}
