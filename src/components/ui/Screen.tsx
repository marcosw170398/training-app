import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'

interface ScreenProps {
  title: string
  subtitle?: ReactNode
  back?: boolean | string
  action?: ReactNode
  children: ReactNode
  /** Espaço extra no rodapé para não ficar atrás da nav/CTA fixa. */
  bottomSpace?: boolean
}

export function Screen({
  title,
  subtitle,
  back,
  action,
  children,
  bottomSpace = true,
}: ScreenProps) {
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh bg-bg">
      <header className="safe-top sticky top-0 z-20 border-b border-border bg-bg/95 px-4 pb-3 backdrop-blur">
        <div className="flex items-center gap-3">
          {back ? (
            <button
              aria-label="Voltar"
              onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
              className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-full text-muted active:bg-surface-2"
            >
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold text-text">{title}</h1>
            {subtitle ? <div className="truncate text-sm text-muted">{subtitle}</div> : null}
          </div>
          {action}
        </div>
      </header>

      <main className={`px-4 pt-4 ${bottomSpace ? 'pb-28' : 'pb-6'}`}>{children}</main>
    </div>
  )
}
