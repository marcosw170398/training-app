import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

const CONTROL =
  'w-full rounded-xl border border-border bg-surface-2 px-3 py-3 text-base text-text ' +
  'placeholder:text-muted/60 outline-none focus:border-accent'

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  )
}

export function TextInput({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${CONTROL} ${className}`} {...rest} />
}

export function TextArea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${CONTROL} min-h-20 resize-y ${className}`} {...rest} />
}
