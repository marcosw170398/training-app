/**
 * Indicador de expandir/recolher: um chevron que gira, não um glifo que troca.
 * Alternar entre caracteres de texto (ex.: "^"/"v") lia como letras soltas em
 * vez de um ícone — o traço fino e a rotação suave deixam a intenção óbvia.
 */
export function Chevron({ open, className = '' }: { open: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={`size-5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
