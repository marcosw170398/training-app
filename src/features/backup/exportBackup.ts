import { db } from '@/db/db'
import type { Id } from '@/db/schema'
import { BACKUP_SCHEMA_VERSION } from './backupFormat'

/** Monta o JSON de backup de um ou mais perfis (todos, se `profileIds` vazio). */
export async function buildBackup(profileIds?: Id[]) {
  const profiles = profileIds?.length
    ? await db.profiles.where('id').anyOf(profileIds).toArray()
    : await db.profiles.toArray()

  const ids = profiles.map((profile) => profile.id)

  const [plans, workouts, exercises, seriesTargets, sessions, setLogs] = await Promise.all([
    db.plans.where('profileId').anyOf(ids).toArray(),
    db.workouts.where('profileId').anyOf(ids).toArray(),
    db.exercises.where('profileId').anyOf(ids).toArray(),
    db.seriesTargets.where('profileId').anyOf(ids).toArray(),
    db.sessions.where('profileId').anyOf(ids).toArray(),
    db.setLogs.where('profileId').anyOf(ids).toArray(),
  ])

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profiles,
    plans,
    workouts,
    exercises,
    seriesTargets,
    sessions,
    setLogs,
  }
}

export async function downloadBackup(profileIds?: Id[], filenameHint?: string): Promise<void> {
  const backup = await buildBackup(profileIds)
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  const stamp = new Date().toISOString().slice(0, 10)
  anchor.download = `treino-${filenameHint ?? 'backup'}-${stamp}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  // Revogar cedo demais cancela o download em alguns navegadores móveis.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
