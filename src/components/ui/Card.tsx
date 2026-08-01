import type { ReactNode } from 'react'

export function Card({
  children,
  className = '',
  onClick,
  ariaLabel,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
  /** Nome acessível explícito — o card costuma juntar vários textos soltos
      (nome, contagem, "última vez"), e o leitor de tela concatena tudo sem
      pontuação a menos que isso seja dito de forma explícita. */
  ariaLabel?: string
}) {
  const base = 'rounded-xl border border-border bg-surface p-4'
  if (!onClick) return <div className={`${base} ${className}`}>{children}</div>
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={`${base} w-full text-left active:bg-surface-2 ${className}`}
    >
      {children}
    </button>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
      <p className="font-medium text-text">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}
