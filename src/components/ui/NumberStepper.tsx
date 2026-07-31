/**
 * Campo numérico com botões grandes de ± ao lado.
 *
 * O teclado numérico do celular é difícil de acertar com a mão que acabou de
 * largar o halter — na prática o ajuste é sempre "um pouco mais que da última
 * vez", que é exatamente o que os botões resolvem em um toque.
 *
 * A unidade vai em `label`, ACIMA do campo: dentro do input ela ficava atrás do
 * número assim que o valor era preenchido.
 */
export function NumberStepper({
  value,
  onChange,
  step,
  label,
  placeholder,
  min = 0,
  'aria-label': ariaLabel,
}: {
  value: string
  onChange: (next: string) => void
  step: number
  /** Rótulo acima do campo, ex.: "Carga (kg)". */
  label?: string
  placeholder?: string
  min?: number
  'aria-label'?: string
}) {
  const bump = (delta: number) => {
    const current = Number(value.replace(',', '.'))
    const base = Number.isFinite(current) && value.trim() !== '' ? current : 0
    const next = Math.max(min, Math.round((base + delta) * 100) / 100)
    onChange(String(next))
  }

  return (
    // `min-w-0`: sem isso, um item de grid não encolhe abaixo da largura
    // natural do próprio conteúdo — este componente estourava o container
    // de `grid-cols-[1fr_1fr_auto]` e empurrava "Repetições" e o botão ✓
    // para fora da tela em telas de 375px.
    <div className="min-w-0">
      {label ? (
        <span className="mb-1 block truncate text-xs text-muted">{label}</span>
      ) : null}
      {/* O anel de foco vai no WRAPPER, não no input: o wrapper tem
          `overflow-hidden`, então um outline no filho seria cortado e um
          usuário navegando por teclado não veria onde está. */}
      <div className="flex items-stretch overflow-hidden rounded-xl border border-border bg-surface-2 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
        <button
          type="button"
          aria-label="Diminuir"
          onClick={() => bump(-step)}
          className="w-10 shrink-0 text-lg text-muted active:bg-border"
        >
          −
        </button>
        <input
          aria-label={ariaLabel ?? label}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/[^0-9.,]/g, ''))}
          inputMode="decimal"
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent py-3 text-center font-mono text-base tabular-nums text-text outline-none placeholder:text-muted/50"
        />
        <button
          type="button"
          aria-label="Aumentar"
          onClick={() => bump(step)}
          className="w-10 shrink-0 text-lg text-muted active:bg-border"
        >
          +
        </button>
      </div>
    </div>
  )
}
