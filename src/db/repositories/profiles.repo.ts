import { db, PROFILE_SCOPED_TABLES } from '../db'
import { NO_WEEK, type Id, type Profile, type ProfileState } from '../schema'
import { newId } from '@/lib/id'

export const PROFILE_COLORS = [
  '#38bdf8',
  '#f472b6',
  '#34d399',
  '#fbbf24',
  '#a78bfa',
  '#fb7185',
  '#22d3ee',
  '#f97316',
]

export function listProfiles(): Promise<Profile[]> {
  return db.profiles.orderBy('order').toArray()
}

export function getProfile(id: Id): Promise<Profile | undefined> {
  return db.profiles.get(id)
}

export function countProfiles(): Promise<number> {
  return db.profiles.count()
}

function defaultState(profileId: Id): ProfileState {
  return {
    profileId,
    activePlanId: null,
    currentWeekNumber: NO_WEEK,
    weekStartedAt: null,
    restDefaultsToMax: false,
    soundEnabled: true,
    vibrationEnabled: true,
    keepScreenAwake: true,
    tutorialSeenAt: null,
  }
}

export async function createProfile(input: { name: string; color: string }): Promise<Profile> {
  const id = newId()
  const count = await db.profiles.count()
  const profile: Profile = {
    id,
    name: input.name.trim(),
    color: input.color,
    order: count,
    createdAt: Date.now(),
  }
  await db.transaction('rw', db.profiles, db.profileState, async () => {
    await db.profiles.add(profile)
    await db.profileState.add(defaultState(id))
  })
  return profile
}

export async function updateProfile(
  id: Id,
  patch: Partial<Pick<Profile, 'name' | 'color' | 'order'>>,
): Promise<void> {
  await db.profiles.update(id, patch)
}

/**
 * Remove o perfil e TUDO que pertence a ele. É por causa desta operação (e do
 * isolamento entre perfis) que `profileId` é denormalizado em todas as tabelas:
 * cada tabela vira um único `delete()` indexado, sem percurso recursivo.
 */
export async function deleteProfileCascade(profileId: Id): Promise<void> {
  await db.transaction(
    'rw',
    [db.profiles, db.profileState, ...PROFILE_SCOPED_TABLES],
    async () => {
      for (const table of PROFILE_SCOPED_TABLES) {
        await table.where('profileId').equals(profileId).delete()
      }
      await db.profileState.delete(profileId)
      await db.profiles.delete(profileId)
    },
  )
}

export async function getProfileState(profileId: Id): Promise<ProfileState> {
  const found = await db.profileState.get(profileId)
  if (found) return found
  // Perfil vindo de import antigo ou estado perdido: recria com os padrões.
  const fresh = defaultState(profileId)
  await db.profileState.put(fresh)
  return fresh
}

export async function updateProfileState(
  profileId: Id,
  patch: Partial<Omit<ProfileState, 'profileId'>>,
): Promise<void> {
  await getProfileState(profileId)
  await db.profileState.update(profileId, patch)
}

export async function setActivePlan(profileId: Id, planId: Id | null): Promise<void> {
  await updateProfileState(profileId, { activePlanId: planId })
}

export async function markTutorialSeen(profileId: Id): Promise<void> {
  await updateProfileState(profileId, { tutorialSeenAt: Date.now() })
}

/** Faz o tutorial aparecer de novo na próxima vez que este perfil abrir a home. */
export async function resetTutorial(profileId: Id): Promise<void> {
  await updateProfileState(profileId, { tutorialSeenAt: null })
}

/** Avança/retrocede a semana do plano periodizado e reinicia o contador de dias. */
export async function setCurrentWeek(profileId: Id, weekNumber: number): Promise<void> {
  await updateProfileState(profileId, {
    currentWeekNumber: weekNumber,
    weekStartedAt: Date.now(),
  })
}
