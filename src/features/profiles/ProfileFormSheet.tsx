import { useEffect, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { Avatar } from '@/components/ui/Avatar'
import { PROFILE_COLORS } from '@/db/repositories/profiles.repo'
import type { Profile } from '@/db/schema'

export function ProfileFormSheet({
  open,
  profile,
  onClose,
  onSubmit,
}: {
  open: boolean
  /** Sem perfil = criação. */
  profile?: Profile
  onClose: () => void
  onSubmit: (values: { name: string; color: string }) => void | Promise<void>
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PROFILE_COLORS[0])

  useEffect(() => {
    if (!open) return
    setName(profile?.name ?? '')
    setColor(profile?.color ?? PROFILE_COLORS[0])
  }, [open, profile])

  const canSave = name.trim().length > 0

  return (
    <Sheet open={open} title={profile ? 'Editar perfil' : 'Novo perfil'} onClose={onClose}>
      <div className="mb-5 flex justify-center">
        <Avatar name={name || '?'} color={color} size="lg" />
      </div>

      <div className="space-y-4">
        <Field label="Nome">
          <TextInput
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex: Marcos"
            autoCapitalize="words"
            maxLength={24}
          />
        </Field>

        <div>
          <span className="mb-2 block text-sm font-medium text-muted">Cor</span>
          <div className="flex flex-wrap gap-3">
            {PROFILE_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={`Cor ${option}`}
                onClick={() => setColor(option)}
                className="size-11 rounded-full transition-transform active:scale-95"
                style={{
                  backgroundColor: option,
                  outline: option === color ? `3px solid var(--color-text)` : 'none',
                  outlineOffset: '2px',
                }}
              />
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
          disabled={!canSave}
          onClick={async () => {
            await onSubmit({ name: name.trim(), color })
            onClose()
          }}
        >
          Salvar
        </Button>
      </div>
    </Sheet>
  )
}
