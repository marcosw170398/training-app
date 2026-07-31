import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink font-semibold active:bg-accent/80',
  secondary: 'bg-surface-2 text-text border border-border active:bg-border',
  ghost: 'bg-transparent text-muted active:bg-surface-2',
  danger: 'bg-transparent text-danger border border-danger/40 active:bg-danger/10',
}

// Alvos de toque generosos: o app é usado de pé, com uma mão, suando.
const SIZES: Record<Size, string> = {
  sm: 'min-h-9 px-3 text-sm rounded-md',
  md: 'min-h-11 px-4 text-base rounded-lg',
  lg: 'min-h-14 px-5 text-lg rounded-xl',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  full?: boolean
  children: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  full = false,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-2 transition-colors',
        'disabled:opacity-40 disabled:pointer-events-none',
        VARIANTS[variant],
        SIZES[size],
        full ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}
