import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { TUTORIAL_STEPS } from './tutorialSteps'

export function TutorialOverlay({ onFinish }: { onFinish: () => void }) {
  const [index, setIndex] = useState(0)
  const step = TUTORIAL_STEPS[index]
  const isLast = index === TUTORIAL_STEPS.length - 1

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Como usar o app"
      className="fixed inset-0 z-50 flex flex-col bg-bg/98 backdrop-blur"
    >
      <div className="safe-top flex items-center justify-between px-4 pb-2">
        <span className="text-sm text-muted">
          {index + 1} de {TUTORIAL_STEPS.length}
        </span>
        <button onClick={onFinish} className="min-h-11 px-2 text-sm text-muted active:text-text">
          Pular
        </button>
      </div>

      <div className="flex flex-1 flex-col justify-center px-6 pb-4">
        <div className="mx-auto w-full max-w-sm">
          <div
            aria-hidden
            className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-surface text-3xl"
          >
            {step.icon}
          </div>

          <h2 className="font-display text-2xl font-semibold text-text">{step.title}</h2>
          <p className="mt-3 text-base leading-relaxed text-muted">{step.body}</p>

          {step.tip ? (
            <p className="mt-4 rounded-xl border border-accent/30 bg-accent/10 p-3 text-sm text-text">
              {step.tip}
            </p>
          ) : null}
        </div>
      </div>

      <div className="safe-bottom px-6">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-4 flex justify-center gap-1.5" aria-hidden>
            {TUTORIAL_STEPS.map((item, position) => (
              <span
                key={item.title}
                className={[
                  'h-1.5 rounded-full transition-all',
                  position === index ? 'w-6 bg-accent' : 'w-1.5 bg-border',
                ].join(' ')}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {index > 0 ? (
              <Button size="lg" onClick={() => setIndex((current) => current - 1)}>
                Voltar
              </Button>
            ) : null}
            <Button
              full
              size="lg"
              variant="primary"
              onClick={() => (isLast ? onFinish() : setIndex((current) => current + 1))}
            >
              {isLast ? 'Começar a treinar' : 'Próximo'}
            </Button>
          </div>

          {isLast ? <p className="mt-3 text-center text-xs text-muted">um app Marcosoft</p> : null}
        </div>
      </div>
    </div>
  )
}
