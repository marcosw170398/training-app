import { useEffect, useRef, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { Avatar } from '@/components/ui/Avatar'
import { PROFILE_COLORS } from '@/db/repositories/profiles.repo'
import { reduzirImagem } from '@/lib/image'
import type { Profile } from '@/db/schema'

/** Maior lado da foto de perfil salva — bem menor que a foto de treino, é só um avatar. */
const AVATAR_MAX_SIDE = 480

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
  onSubmit: (values: {
    name: string
    color: string
    photoBlob: Blob | null
  }) => void | Promise<void>
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PROFILE_COLORS[0])
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setName(profile?.name ?? '')
    setColor(profile?.color ?? PROFILE_COLORS[0])
    setPhotoBlob(profile?.photoBlob ?? null)
    setPhotoError(null)
  }, [open, profile])

  const canSave = name.trim().length > 0

  const onPickPhoto = async (file: File) => {
    setPhotoBusy(true)
    setPhotoError(null)
    try {
      const { blob } = await reduzirImagem(file, AVATAR_MAX_SIDE, 0.85)
      setPhotoBlob(blob)
    } catch {
      setPhotoError('Não consegui usar essa imagem — tente outra foto.')
    } finally {
      setPhotoBusy(false)
    }
  }

  return (
    <Sheet open={open} title={profile ? 'Editar perfil' : 'Novo perfil'} onClose={onClose}>
      <div className="mb-5 flex flex-col items-center gap-3">
        <Avatar name={name || '?'} color={color} photo={photoBlob} size="lg" />
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={photoBusy}
            onClick={() => fileInput.current?.click()}
          >
            {photoBusy ? 'Processando…' : photoBlob ? 'Trocar foto' : 'Adicionar foto'}
          </Button>
          {photoBlob ? (
            <Button size="sm" variant="ghost" onClick={() => setPhotoBlob(null)}>
              Remover foto
            </Button>
          ) : null}
        </div>
        {photoError ? <p className="text-sm text-danger">{photoError}</p> : null}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void onPickPhoto(file)
          }}
        />
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
          disabled={!canSave || photoBusy}
          onClick={async () => {
            await onSubmit({ name: name.trim(), color, photoBlob })
            onClose()
          }}
        >
          Salvar
        </Button>
      </div>
    </Sheet>
  )
}
