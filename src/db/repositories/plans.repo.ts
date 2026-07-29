import Dexie from 'dexie'
import { db } from '../db'
import type { Id, PlanType, TrainingPlan } from '../schema'
import { newId } from '@/lib/id'

export function listPlans(profileId: Id): Promise<TrainingPlan[]> {
  return db.plans
    .where('[profileId+updatedAt]')
    .between([profileId, Dexie.minKey], [profileId, Dexie.maxKey])
    .reverse()
    .toArray()
}

export function getPlan(id: Id): Promise<TrainingPlan | undefined> {
  return db.plans.get(id)
}

export async function createPlan(
  profileId: Id,
  input: { name: string; type: PlanType; totalWeeks?: number; notes?: string | null },
): Promise<TrainingPlan> {
  const now = Date.now()
  const plan: TrainingPlan = {
    id: newId(),
    profileId,
    name: input.name.trim(),
    type: input.type,
    totalWeeks: input.type === 'periodized' ? (input.totalWeeks ?? 6) : 0,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  }
  await db.plans.add(plan)
  return plan
}

export async function updatePlan(
  id: Id,
  patch: Partial<Pick<TrainingPlan, 'name' | 'type' | 'totalWeeks' | 'notes'>>,
): Promise<void> {
  await db.plans.update(id, { ...patch, updatedAt: Date.now() })
}

/** Marca o plano como alterado — chamado por edições em treinos/exercícios. */
export async function touchPlan(id: Id): Promise<void> {
  await db.plans.update(id, { updatedAt: Date.now() })
}

/** Remove o plano, seus treinos, exercícios e séries. Preserva o histórico. */
export async function deletePlanCascade(profileId: Id, planId: Id): Promise<void> {
  await db.transaction(
    'rw',
    [db.plans, db.workouts, db.exercises, db.seriesTargets, db.profileState],
    async () => {
      const workouts = await db.workouts.where('planId').equals(planId).toArray()
      const workoutIds = workouts.map((w) => w.id)
      const exercises = await db.exercises.where('workoutId').anyOf(workoutIds).toArray()
      const exerciseIds = exercises.map((e) => e.id)

      await db.seriesTargets.where('exerciseId').anyOf(exerciseIds).delete()
      await db.exercises.where('workoutId').anyOf(workoutIds).delete()
      await db.workouts.where('planId').equals(planId).delete()
      await db.plans.delete(planId)

      const state = await db.profileState.get(profileId)
      if (state?.activePlanId === planId) {
        await db.profileState.update(profileId, { activePlanId: null })
      }
    },
  )
  // Os SetLogs continuam existindo de propósito: o histórico é imutável e vive
  // de `exerciseKey` + snapshots, então apagar o plano não apaga o que você
  // levantou.
}
