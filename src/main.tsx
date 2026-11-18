import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initUiScale } from '@/lib/uiScale'
import { instalarErrosRecentes } from '@/lib/errosRecentes'
// Inicializa o tema no BOOT (side-effect): o store aplica o modo salvo em
// TODA tela — inclusive Login/Landing, que não montam o ThemeToggle. Sem isso,
// o tema escolhido só valia dentro do app e parecia "não ter sido salvo".
import '@/store/theme'
// Captura o evento de instalação do PWA cedo (pode disparar antes do banner montar).
import '@/lib/pwaInstall'

// Auto-escala pra desktops antigos (1024–1440px) caberem sem apertar.
initUiScale()
// Guarda os últimos erros do navegador para anexar aos chamados (botão Reportar).
instalarErrosRecentes()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
