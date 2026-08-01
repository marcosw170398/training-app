import { useEffect, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { NO_WEEKDAY, type Workout } from '@/db/schema'
import { WEEKDAYS } from '@/lib/weekday'

export function WorkoutFormSheet({
  open,
  workout,
  suggestedName,
  onClose,
  onSubmit,
}: {
  open: boolean
  workout?: Workout
  suggestedName?: string
  onClose: () => void
  onSubmit: (values: { name: string; weekday: number }) => void | Promise<void>
}) {
  const [name, setName] = useState('')
  const [weekday, setWeekday] = useState<number>(NO_WEEKDAY)

  useEffect(() => {
    if (!open) return
    setName(workout?.name ?? suggestedName ?? '')
    setWeekday(workout?.weekday ?? NO_WEEKDAY)
  }, [open, workout, suggestedName])

  return (
    <Sheet open={open} title={workout ? 'Editar treino' : 'Novo treino'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nome do treino">
          <TextInput
            value={name}
            onChange={(event) => setName(event.target.value)}
            // Treino novo já chega com nome sugerido ("Treino B", a próxima
            // letra) preenchido no campo — sem selecionar tudo ao focar, digitar
            // o nome de verdade só GRUDA no sugerido em vez de substituí-lo
            // ("Treino ATreino A"). Não afeta editar um treino já existente
            // (`workout` presente), onde apagar de propósito é o esperado.
            onFocus={!workout ? (event) => event.target.select() : undefined}
            placeholder="Ex: Treino A · Segunda-feira"
          />
        </Field>

        <div>
          <span className="mb-2 block text-sm font-medium text-muted">
            Dia da semana <span className="font-normal">(opcional)</span>
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setWeekday(NO_WEEKDAY)}
              className={[
                'min-h-11 rounded-xl border px-3 text-sm',
                weekday === NO_WEEKDAY ? 'border-accent bg-accent/10' : 'border-border bg-surface-2',
              ].join(' ')}
            >
              Nenhum
            </button>
            {WEEKDAYS.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => setWeekday(day.value)}
                className={[
                  'min-h-11 w-12 rounded-xl border text-sm',
                  weekday === day.value ? 'border-accent bg-accent/10' : 'border-border bg-surface-2',
                ].join(' ')}
              >
                {day.short}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-2 pb-2">
        <Button full onClick={onClose}>
          Cancelar
        </Button>
        <Button
          full
          variant="primary"
          disabled={!name.trim()}
          onClick={async () => {
            await onSubmit({ name: name.trim(), weekday })
            onClose()
          }}
        >
          Salvar
        </Button>
      </div>
    </Sheet>
  )
}
