import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initUiScale } from '@/lib/uiScale'
import { debugAutomotivos } from '@/lib/debugAutomotivos'

// Auto-escala pra desktops antigos (1024–1440px) caberem sem apertar.
initUiScale()

// DEBUG TEMPORÁRIO — diagnóstico app×BI Automotivos. Rodar no console:
//   await debugAutomotivos('ITAPOA')   (após selecionar o período no app)
// Remover (este bloco + src/lib/debugAutomotivos.ts) depois do diagnóstico.
;(window as unknown as { debugAutomotivos: typeof debugAutomotivos }).debugAutomotivos = debugAutomotivos

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
