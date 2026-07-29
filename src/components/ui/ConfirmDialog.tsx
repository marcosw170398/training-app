import { useState, type ReactNode } from 'react'
import { Sheet } from './Sheet'
import { Button } from './Button'
import { TextInput } from './Field'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: ReactNode
  confirmLabel?: string
  danger?: boolean
  /**
   * Quando definido, exige digitar exatamente este texto para liberar a ação.
   * Usado na remoção de perfil, que apaga histórico de forma irreversível.
   */
  confirmText?: string
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  danger = false,
  confirmText,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('')
  const locked = confirmText !== undefined && typed.trim() !== confirmText

  const close = () => {
    setTyped('')
    onClose()
  }

  return (
    <Sheet open={open} title={title} onClose={close}>
      {description ? <div className="mb-4 text-sm text-muted">{description}</div> : null}

      {confirmText !== undefined ? (
        <div className="mb-4">
          <p className="mb-2 text-sm text-muted">
            Digite <span className="font-semibold text-text">{confirmText}</span> para confirmar.
          </p>
          <TextInput
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoCapitalize="none"
          />
        </div>
      ) : null}

      <div className="flex gap-2 pb-2">
        <Button full onClick={close}>
          Cancelar
        </Button>
        <Button
          full
          variant={danger ? 'danger' : 'primary'}
          disabled={locked}
          onClick={() => {
            onConfirm()
            close()
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  )
}
