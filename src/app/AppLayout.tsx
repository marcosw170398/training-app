import { NavLink, Outlet } from 'react-router'

const ITEMS = [
  { to: '/home', label: 'Treino', icon: 'M6 6v12M18 6v12M6 12h12' },
  { to: '/planos', label: 'Planos', icon: 'M5 5h14M5 12h14M5 19h9' },
  { to: '/historico', label: 'Histórico', icon: 'M4 19V9M10 19V5M16 19v-7M22 19H2' },
  { to: '/mais', label: 'Mais', icon: 'M5 12h.01M12 12h.01M19 12h.01' },
]

export function AppLayout() {
  return (
    <>
      <Outlet />
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 backdrop-blur">
        <ul className="mx-auto flex max-w-lg">
          {ITEMS.map((item) => (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  [
                    'flex min-h-14 flex-col items-center justify-center gap-1 text-xs',
                    isActive ? 'text-accent' : 'text-muted',
                  ].join(' ')
                }
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d={item.icon} />
                </svg>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
