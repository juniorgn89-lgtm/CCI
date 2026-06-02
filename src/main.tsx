import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initUiScale } from '@/lib/uiScale'
import { debugVenda } from '@/lib/debugVenda'

// Auto-escala pra desktops antigos (1024–1440px) caberem sem apertar.
initUiScale()

// DEBUG TEMPORÁRIO — estado real de uma venda. Console: await debugVenda(290082843)
// Remover (este bloco + src/lib/debugVenda.ts) depois do diagnóstico.
;(window as unknown as { debugVenda: typeof debugVenda }).debugVenda = debugVenda

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
