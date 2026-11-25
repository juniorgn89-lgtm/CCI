import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fontes do padrão CCI no celular (Geist/Sora/Geist Mono). Só baixam quando usadas (<768px, ver index.css).
import '@fontsource-variable/geist'
import '@fontsource-variable/sora'
import '@fontsource-variable/geist-mono'
import './index.css'
import App from './App.tsx'
import { initUiScale } from '@/lib/uiScale'
import { instalarErrosRecentes } from '@/lib/errosRecentes'
import { instalarRecargaPorVersao } from '@/lib/chunkReload'
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
// Aba aberta com a versão anterior depois de um deploy: recarrega sozinho em vez de quebrar a tela.
instalarRecargaPorVersao()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
