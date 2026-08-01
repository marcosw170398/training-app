import { useObjectUrl } from '@/hooks/useObjectUrl'

/** Avatar mostra a foto do perfil, se houver; senão, a inicial do nome sobre a cor do perfil. */
export function Avatar({
  name,
  color,
  photo,
  size = 'md',
}: {
  name: string
  color: string
  photo?: Blob | null
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizes = {
    sm: 'size-8 text-sm',
    md: 'size-11 text-lg',
    lg: 'size-20 text-3xl',
  }
  const photoUrl = useObjectUrl(photo)

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        aria-hidden
        className={`shrink-0 rounded-full object-cover ${sizes[size]}`}
        style={{ border: `2px solid ${color}` }}
      />
    )
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
