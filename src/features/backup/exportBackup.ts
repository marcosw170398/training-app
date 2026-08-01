import { db } from '@/db/db'
import type { Id } from '@/db/schema'
import { deaccent } from '@/lib/text'
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
    // Foto de perfil é blob binário — mesma decisão de não incluir foto de treino no backup.
    profiles: profiles.map(({ photoBlob: _ignorada, ...resto }) => resto),
    plans,
    workouts,
    exercises,
    seriesTargets,
    sessions,
    setLogs,
  }
}

/**
 * Empacota UM plano para outra pessoa importar.
 *
 * Sai sem perfil e sem histórico de propósito: o que se compartilha é a
 * prescrição, não as cargas de quem montou. Como não há `profiles` no arquivo,
 * a importação do outro lado sempre mescla no perfil ativo dele.
 */
export async function buildPlanExport(planId: Id) {
  const plan = await db.plans.get(planId)
  if (!plan) throw new Error('Plano não encontrado')

  const workouts = await db.workouts.where('planId').equals(planId).toArray()
  const workoutIds = workouts.map((workout) => workout.id)
  const exercises = await db.exercises.where('workoutId').anyOf(workoutIds).toArray()
  const exerciseIds = exercises.map((exercise) => exercise.id)
  const seriesTargets = await db.seriesTargets.where('exerciseId').anyOf(exerciseIds).toArray()

  const semPerfil = <T extends { profileId?: Id }>(rows: T[]) =>
    rows.map(({ profileId: _ignorado, ...resto }) => resto)

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    plans: semPerfil([plan]),
    workouts: semPerfil(workouts),
    exercises: semPerfil(exercises),
    seriesTargets: semPerfil(seriesTargets),
    sessions: [],
    setLogs: [],
  }
}

function baixarJson(conteudo: unknown, nomeArquivo: string): void {
  const blob = new Blob([JSON.stringify(conteudo, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = nomeArquivo
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  // Revogar cedo demais cancela o download em alguns navegadores móveis.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Nome de arquivo seguro a partir do nome do plano. */
function comoNomeDeArquivo(texto: string): string {
  return (
    deaccent(texto)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'plano'
  )
}

export async function downloadPlanExport(planId: Id, planName: string): Promise<void> {
  const conteudo = await buildPlanExport(planId)
  baixarJson(conteudo, `treino-plano-${comoNomeDeArquivo(planName)}.json`)
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
