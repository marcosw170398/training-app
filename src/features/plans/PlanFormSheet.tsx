import { useEffect, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import type { PlanType, TrainingPlan } from '@/db/schema'

const TYPE_OPTIONS: { value: PlanType; label: string; hint: string }[] = [
  {
    value: 'fixed',
    label: 'Fixo',
    hint: 'Treinos A, B, C… que se repetem todo ciclo, sem variar.',
  },
  {
    value: 'periodized',
    label: 'Periodizado',
    hint: 'Semanas numeradas, com um treino por dia da semana.',
  },
]

export function PlanFormSheet({
  open,
  plan,
  onClose,
  onSubmit,
}: {
  open: boolean
  plan?: TrainingPlan
  onClose: () => void
  onSubmit: (values: { name: string; type: PlanType; totalWeeks: number }) => void | Promise<void>
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<PlanType>('fixed')
  const [totalWeeks, setTotalWeeks] = useState(6)

  useEffect(() => {
    if (!open) return
    setName(plan?.name ?? '')
    setType(plan?.type ?? 'fixed')
    setTotalWeeks(plan?.totalWeeks || 6)
  }, [open, plan])

  return (
    <Sheet open={open} title={plan ? 'Editar plano' : 'Novo plano'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nome do plano">
          <TextInput
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex: Além da Genética - 5x semana"
          />
        </Field>

        <div>
          <span className="mb-2 block text-sm font-medium text-muted">Tipo</span>
          <div className="space-y-2">
            {TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setType(option.value)}
                className={[
                  'w-full rounded-xl border px-4 py-3 text-left',
                  option.value === type
                    ? 'border-accent bg-accent/10'
                    : 'border-border bg-surface-2',
                ].join(' ')}
              >
                <span className="font-medium">{option.label}</span>
                <span className="mt-0.5 block text-xs text-muted">{option.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {type === 'periodized' ? (
          <Field label="Quantas semanas">
            <TextInput
              type="number"
              inputMode="numeric"
              min={1}
              max={52}
              value={totalWeeks}
              onChange={(event) => setTotalWeeks(Number(event.target.value))}
            />
          </Field>
        ) : null}
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
            await onSubmit({
              name: name.trim(),
              type,
              totalWeeks: type === 'periodized' ? Math.max(1, totalWeeks) : 0,
            })
            onClose()
          }}
        >
          Salvar
        </Button>
      </div>
    </Sheet>
  )
}
