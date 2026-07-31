import { useEffect, type ReactNode } from 'react'

/** Bottom sheet — o padrão de diálogo mais alcançável com uma mão só. */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="safe-bottom relative max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-surface px-4 pt-3"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        <h2 className="mb-4 font-display text-lg font-semibold text-text">{title}</h2>
        {children}
      </div>
    </div>
  )
}
