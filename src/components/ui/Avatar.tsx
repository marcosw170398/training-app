/** Avatar é a inicial do nome sobre a cor do perfil — sem upload de foto. */
export function Avatar({
  name,
  color,
  size = 'md',
}: {
  name: string
  color: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizes = {
    sm: 'size-8 text-sm',
    md: 'size-11 text-lg',
    lg: 'size-20 text-3xl',
  }
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${sizes[size]}`}
      style={{ backgroundColor: `${color}22`, color, border: `2px solid ${color}` }}
    >
      {initial}
    </span>
  )
}
