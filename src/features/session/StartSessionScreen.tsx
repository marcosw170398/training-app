import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router'
import { NO_WEEK } from '@/db/schema'
import { getWorkout } from '@/db/repositories/workouts.repo'
import { getProfileState } from '@/db/repositories/profiles.repo'
import { startOrResumeSession } from '@/db/repositories/sessions.repo'
import { useActiveProfile } from '@/state/activeProfile'
import { Splash } from '@/app/Splash'

/**
 * Rota de transição: abre (ou retoma) a sessão do treino e redireciona para a
 * tela de execução, para que a URL final seja sempre `/sessao/:id`.
 */
export function StartSessionScreen() {
  const { workoutId = '' } = useParams()
  const navigate = useNavigate()
  const profile = useActiveProfile()
  const started = useRef(false)

  useEffect(() => {
    if (!profile || started.current) return
    started.current = true

    void (async () => {
      const workout = await getWorkout(workoutId)
      if (!workout) {
        navigate('/home', { replace: true })
        return
      }
      const state = await getProfileState(profile.id)
      const session = await startOrResumeSession({
        profileId: profile.id,
        planId: workout.planId,
        workoutId: workout.id,
        workoutName: workout.name,
        weekNumber: workout.weekNumber === NO_WEEK ? NO_WEEK : state.currentWeekNumber,
      })
      navigate(`/sessao/${session.id}`, { replace: true })
    })()
  }, [profile, workoutId, navigate])

  return <Splash />
}
