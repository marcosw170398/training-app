import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Auto-hospedadas (Fontsource): nada de CDN externo, senão a fonte
// desaparece no primeiro carregamento offline do PWA. Só os pesos usados.
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'

import './index.css'
import { App } from './app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
