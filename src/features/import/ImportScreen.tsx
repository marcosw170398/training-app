import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useActiveProfile } from '@/state/activeProfile'
import { getProfileState, setActivePlan, setCurrentWeek } from '@/db/repositories/profiles.repo'
import { Screen } from '@/components/ui/Screen'
import { Card, EmptyState } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { Splash } from '@/app/Splash'
import { weekdayLabel } from '@/lib/weekday'
import { readPlanFromPdf, type ImportProgress } from './importPdf'
import { countExercises, countSeries, type ParsedExercise, type ParsedPlan } from './parsedPlan'
import { saveParsedPlan } from './saveParsedPlan'
import { ImportExerciseRow } from './ImportExerciseRow'

const ROTULO_ETAPA: Record<ImportProgress['stage'], string> = {
  abrindo: 'Abrindo o PDF',
  'lendo texto': 'Lendo o texto do PDF',
  'carregando motor': 'Baixando o motor de leitura de imagem',
  'lendo imagem': 'Lendo página digitalizada (OCR)',
  interpretando: 'Interpretando o plano',
}

/** Origem de um movimento pendente: um exercício, ou o treino inteiro. */
interface Movimento {
  workoutIndex: number
  exerciseIndex: number | 'todos'
}

export function ImportScreen() {
  const navigate = useNavigate()
  const profile = useActiveProfile()
  const fileInput = useRef<HTMLInputElement>(null)

  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [plan, setPlan] = useState<ParsedPlan | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [abertos, setAbertos] = useState<Set<number>>(new Set([0]))
  const [movimento, setMovimento] = useState<Movimento | null>(null)

  if (!profile) return <Splash />

  const lerArquivo = async (file: File) => {
    setErro(null)
    setPlan(null)
    try {
      const resultado = await readPlanFromPdf(file, setProgress)
      setPlan(resultado)
      setAbertos(new Set([0]))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler este PDF.')
    } finally {
      setProgress(null)
    }
  }

  /** Treino sem exercício não serve para nada — sai da lista sozinho. */
  const podarVazios = (atual: ParsedPlan): ParsedPlan => ({
    ...atual,
    workouts: atual.workouts.filter((workout) => workout.exercises.length > 0),
  })

  const atualizarExercicio = (
    workoutIndex: number,
    exerciseIndex: number,
    next: ParsedExercise | null,
  ) => {
    setPlan((atual) => {
      if (!atual) return atual
      const workouts = atual.workouts.map((workout, wi) => {
        if (wi !== workoutIndex) return workout
        const exercises =
          next === null
            ? workout.exercises.filter((_, ei) => ei !== exerciseIndex)
            : workout.exercises.map((exercise, ei) => (ei === exerciseIndex ? next : exercise))
        return { ...workout, exercises }
      })
      return next === null ? podarVazios({ ...atual, workouts }) : { ...atual, workouts }
    })
  }

  const renomearTreino = (workoutIndex: number, name: string) => {
    setPlan((atual) =>
      atual
        ? {
            ...atual,
            workouts: atual.workouts.map((workout, wi) =>
              wi === workoutIndex ? { ...workout, name } : workout,
            ),
          }
        : atual,
    )
  }

  const removerTreino = (workoutIndex: number) => {
    setPlan((atual) =>
      atual ? { ...atual, workouts: atual.workouts.filter((_, i) => i !== workoutIndex) } : atual,
    )
  }

  /**
   * Move exercício(s) entre treinos.
   *
   * O parser divide um treino por página quando o PDF não traz "Treino A/B/C"
   * legível, então remontar a divisão correta aqui é parte normal do fluxo.
   */
  const mover = (origem: Movimento, destinoIndex: number) => {
    // Calculado fora de setPlan: o updater do React pode rodar duas vezes em
    // StrictMode, e aqui há efeito colateral (reabrir o treino de destino).
    if (!plan) return
    const treinoOrigem = plan.workouts[origem.workoutIndex]
    if (!treinoOrigem) return

    const movidos =
      origem.exerciseIndex === 'todos'
        ? treinoOrigem.exercises
        : [treinoOrigem.exercises[origem.exerciseIndex]].filter(Boolean)
    if (!movidos.length) return

    const workouts = plan.workouts.map((workout, wi) => {
      if (wi === origem.workoutIndex) {
        return {
          ...workout,
          exercises:
            origem.exerciseIndex === 'todos'
              ? []
              : workout.exercises.filter((_, ei) => ei !== origem.exerciseIndex),
        }
      }
      if (wi === destinoIndex) {
        return { ...workout, exercises: [...workout.exercises, ...movidos] }
      }
      return workout
    })

    const podado = podarVazios({ ...plan, workouts })
    // Mantém aberto o treino que recebeu, já com os índices pós-poda.
    const destino = podado.workouts.indexOf(workouts[destinoIndex])
    setPlan(podado)
    setAbertos(new Set([destino >= 0 ? destino : 0]))
    setMovimento(null)
  }

  const alternar = (index: number) => {
    setAbertos((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(index)) proximo.delete(index)
      else proximo.add(index)
      return proximo
    })
  }

  const origemMovimento = movimento ? plan?.workouts[movimento.workoutIndex] : undefined

  return (
    <Screen title="Importar plano em PDF" back="/planos">
      {!plan ? (
        <>
          <Card className="mb-4">
            <p className="text-sm text-muted">
              Escolha o PDF que você recebeu do treinador. O app lê o arquivo aqui no celular, sem
              enviar nada para lugar nenhum, e mostra o que entendeu para você conferir antes de
              salvar.
            </p>
          </Card>

          {progress ? (
            <Card>
              <p className="font-medium">{ROTULO_ETAPA[progress.stage]}</p>
              {progress.detail ? (
                <p className="mt-0.5 text-sm text-muted">{progress.detail}</p>
              ) : null}
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full bg-accent transition-[width]"
                  style={{
                    width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">
                {progress.current} de {progress.total} página(s)
              </p>
            </Card>
          ) : (
            <>
              <Button full size="lg" variant="primary" onClick={() => fileInput.current?.click()}>
                Escolher PDF
              </Button>
              {erro ? <p className="mt-3 text-sm text-danger">{erro}</p> : null}
            </>
          )}

          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void lerArquivo(file)
              event.target.value = ''
            }}
          />
        </>
      ) : (
        <>
          <Card className="mb-4">
            <Field label="Nome do plano">
              <TextInput
                value={plan.name}
                onChange={(event) => setPlan({ ...plan, name: event.target.value })}
              />
            </Field>
            <p className="mt-3 text-sm text-muted">
              {plan.type === 'periodized'
                ? `Periodizado · ${plan.totalWeeks} semana(s)`
                : 'Fixo · repete todo ciclo'}
              {` · ${plan.workouts.length} treino(s) · ${countExercises(plan)} exercício(s) · ${countSeries(plan)} série(s)`}
            </p>
            <p className="mt-1 text-xs text-muted">
              Lido{' '}
              {plan.source === 'ocr'
                ? 'com OCR (PDF digitalizado)'
                : 'da camada de texto do PDF'}
            </p>
          </Card>

          {plan.warnings.length ? (
            <Card className="mb-4 border-rampup/40 bg-rampup/10">
              <p className="mb-1 font-medium text-rampup">Confira antes de salvar</p>
              <ul className="space-y-1 text-sm text-muted">
                {plan.warnings.map((warning, index) => (
                  <li key={index}>· {warning}</li>
                ))}
              </ul>
            </Card>
          ) : null}

          <ul className="space-y-3">
            {plan.workouts.map((workout, workoutIndex) => {
              const aberto = abertos.has(workoutIndex)
              return (
                <li key={workoutIndex}>
                  <Card>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <input
                          value={workout.name}
                          onChange={(event) => renomearTreino(workoutIndex, event.target.value)}
                          aria-label={`Nome do treino ${workoutIndex + 1}`}
                          className="w-full rounded-lg border border-border bg-surface-2 px-2 py-2 font-semibold text-text outline-none focus:border-accent"
                        />
                        <p className="mt-1 text-sm text-muted">
                          {workout.weekNumber > 0
                            ? `Semana ${String(workout.weekNumber).padStart(2, '0')} · `
                            : ''}
                          {workout.weekday ? `${weekdayLabel(workout.weekday)} · ` : ''}
                          {workout.exercises.length} exercício(s)
                        </p>
                      </div>
                      <button
                        onClick={() => alternar(workoutIndex)}
                        aria-label={aberto ? 'Recolher' : 'Expandir'}
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted active:bg-surface-2"
                      >
                        {aberto ? '−' : '+'}
                      </button>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {plan.workouts.length > 1 ? (
                        <Button
                          size="sm"
                          onClick={() => setMovimento({ workoutIndex, exerciseIndex: 'todos' })}
                        >
                          Mover todos para…
                        </Button>
                      ) : null}
                      <Button size="sm" variant="danger" onClick={() => removerTreino(workoutIndex)}>
                        Remover treino
                      </Button>
                    </div>

                    {aberto ? (
                      <div className="mt-3 space-y-2 border-t border-border pt-3">
                        {workout.exercises.map((exercise, exerciseIndex) => (
                          <ImportExerciseRow
                            key={exerciseIndex}
                            exercise={exercise}
                            onChange={(next) =>
                              atualizarExercicio(workoutIndex, exerciseIndex, next)
                            }
                            onRemove={() => atualizarExercicio(workoutIndex, exerciseIndex, null)}
                            onMove={
                              plan.workouts.length > 1
                                ? () => setMovimento({ workoutIndex, exerciseIndex })
                                : undefined
                            }
                          />
                        ))}
                      </div>
                    ) : null}
                  </Card>
                </li>
              )
            })}
          </ul>

          {plan.workouts.length === 0 ? (
            <EmptyState
              title="Não consegui ler este PDF"
              description={
                plan.source === 'ocr'
                  ? 'O PDF é digitalizado (páginas em imagem) e a leitura saiu imprecisa demais para virar um plano. Peça ao seu treinador a versão em PDF de texto — essa é lida com precisão — ou cadastre o plano à mão.'
                  : 'O texto foi lido, mas não encontrei a estrutura de semanas, dias e tabelas de exercícios que o app reconhece. Cadastre o plano à mão ou me mande este PDF para eu ajustar o leitor.'
              }
            />
          ) : null}

          <div className="mt-6 flex flex-col gap-2">
            <Button
              full
              size="lg"
              variant="primary"
              disabled={salvando || plan.workouts.length === 0}
              onClick={async () => {
                setSalvando(true)
                try {
                  const planId = await saveParsedPlan(profile.id, plan)
                  // Quem importa um plano quer usá-lo. Sem isto, a home pedia
                  // "escolha um plano ativo" logo depois da importação.
                  const state = await getProfileState(profile.id)
                  if (!state.activePlanId) {
                    await setActivePlan(profile.id, planId)
                    await setCurrentWeek(profile.id, plan.type === 'periodized' ? 1 : 0)
                  }
                  navigate(`/planos/${planId}`, { replace: true })
                } catch (e) {
                  setErro(e instanceof Error ? e.message : 'Não consegui salvar o plano.')
                  setSalvando(false)
                }
              }}
            >
              {salvando ? 'Salvando…' : 'Salvar plano'}
            </Button>
            <Button full onClick={() => setPlan(null)}>
              Escolher outro PDF
            </Button>
            {erro ? <p className="text-sm text-danger">{erro}</p> : null}
          </div>
        </>
      )}

      <Sheet
        open={movimento !== null}
        title={
          movimento?.exerciseIndex === 'todos'
            ? `Mover ${origemMovimento?.exercises.length ?? 0} exercício(s) para`
            : 'Mover exercício para'
        }
        onClose={() => setMovimento(null)}
      >
        {movimento && plan ? (
          <>
            <p className="mb-3 text-sm text-muted">
              De <span className="text-text">{origemMovimento?.name}</span>
              {movimento.exerciseIndex !== 'todos' ? (
                <>
                  {' · '}
                  <span className="text-text">
                    {origemMovimento?.exercises[movimento.exerciseIndex]?.name}
                  </span>
                </>
              ) : null}
            </p>
            <div className="space-y-2 pb-2">
              {plan.workouts.map((workout, index) =>
                index === movimento.workoutIndex ? null : (
                  <Button key={index} full onClick={() => mover(movimento, index)}>
                    {workout.name} ({workout.exercises.length})
                  </Button>
                ),
              )}
            </div>
            <p className="pb-2 text-xs text-muted">
              Treino que ficar sem exercícios é removido automaticamente.
            </p>
          </>
        ) : null}
      </Sheet>
    </Screen>
  )
}
