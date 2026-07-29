import { useEffect, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Field, TextArea, TextInput } from '@/components/ui/Field'
import { SECTION_HINT, SECTION_LABEL, SECTIONS, type Exercise, type Section } from '@/db/schema'

export function ExerciseFormSheet({
  open,
  exercise,
  defaultSection = 'main',
  onClose,
  onSubmit,
}: {
  open: boolean
  exercise?: Exercise
  defaultSection?: Section
  onClose: () => void
  onSubmit: (values: {
    name: string
    section: Section
    technique: string | null
    supersetGroup: string | null
  }) => void | Promise<void>
}) {
  const [name, setName] = useState('')
  const [section, setSection] = useState<Section>(defaultSection)
  const [technique, setTechnique] = useState('')
  const [supersetGroup, setSupersetGroup] = useState('')

  useEffect(() => {
    if (!open) return
    setName(exercise?.name ?? '')
    setSection(exercise?.section ?? defaultSection)
    setTechnique(exercise?.technique ?? '')
    setSupersetGroup(exercise?.supersetGroup ?? '')
  }, [open, exercise, defaultSection])

  return (
    <Sheet open={open} title={exercise ? 'Editar exercício' : 'Novo exercício'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nome do exercício">
          <TextInput
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex: Supino inclinado smith ou máquina"
          />
        </Field>

        <div>
          <span className="mb-2 block text-sm font-medium text-muted">Seção</span>
          <div className="space-y-2">
            {SECTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSection(option)}
                className={[
                  'w-full rounded-xl border px-4 py-3 text-left',
                  option === section ? 'border-accent bg-accent/10' : 'border-border bg-surface-2',
                ].join(' ')}
              >
                <span className="font-medium">{SECTION_LABEL[option]}</span>
                <span className="mt-0.5 block text-xs text-muted">{SECTION_HINT[option]}</span>
              </button>
            ))}
          </div>
        </div>

        <Field label="Técnica / observação" hint="Texto livre: bi-set, FST-7, drop, pico de contração…">
          <TextArea
            value={technique}
            onChange={(event) => setTechnique(event.target.value)}
            placeholder="Ex: progressão de carga e drop"
          />
        </Field>

        <Field
          label="Grupo de bi-set"
          hint="Dê o mesmo rótulo a dois exercícios para executá-los juntos (ex: A)."
        >
          <TextInput
            value={supersetGroup}
            onChange={(event) => setSupersetGroup(event.target.value)}
            placeholder="Vazio = exercício isolado"
            maxLength={4}
          />
        </Field>
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
              section,
              technique: technique.trim() || null,
              supersetGroup: supersetGroup.trim().toUpperCase() || null,
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
