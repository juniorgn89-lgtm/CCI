import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFocusMode } from '@/store/focusMode'
import DemoModeToggle from '@/components/layout/DemoModeToggle'
import ThemeToggle from '@/components/layout/ThemeToggle'
import AppLauncher from '@/components/layout/AppLauncher'
import ReportarChamado from '@/components/chamados/ReportarChamado'
import SinoNotificacoes from '@/components/layout/SinoNotificacoes'
import BalaoAcao from '@/components/ui/BalaoAcao'
import { HEADER_TITLE_SLOT_ID } from '@/components/layout/PageHeaderTitle'

interface HeaderProps {
  onMobileMenuOpen: () => void
  /** Seletor de posto/rede (padrão NotaOK: fica na barra de cima, à direita). */
  posto?: ReactNode
}

/**
 * Barra de cima (padrão NotaOK / apps CCI): logo à esquerda; à direita só o
 * essencial — posto, Demonstração, tema, sino, reportar e o menu de apps.
 * A trilha, o título da tela, o "Atualizado em" e a engrenagem do módulo
 * ficam no cabeçalho do painel de conteúdo (CabecalhoPagina).
 */
const Header = ({ onMobileMenuOpen, posto }: HeaderProps) => {
  // Sidebar escondida (legado do Modo Foco): mostra o botão de menu no desktop.
  const focusActive = useFocusMode((s) => s.active)

  return (
    <header className="shrink-0 bg-white dark:bg-[#1e293b]">
      <div className="relative flex h-14 items-center justify-between pl-3 pr-4 md:pr-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onMobileMenuOpen}
            className={cn(
              'rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
              !focusActive && 'md:hidden',
            )}
            aria-label="Abrir menu de módulos"
          >
            <LayoutGrid className="h-5 w-5" />
          </button>

          {/* Logo + nome. Clicar volta pra Central da Rede (home do app). */}
          <Link to="/dashboard" aria-label="Ir para a Central da Rede" className="group mr-1 flex shrink-0 items-center gap-2.5">
            <img
              src="/brand/visor360-app-192.png"
              alt="Visor360"
              className="h-[30px] w-[30px] shrink-0 rounded-[7px] object-contain transition-transform group-hover:scale-105"
            />
            <span className="hidden flex-col leading-tight sm:flex">
              <span className="text-[15px] font-bold tracking-[-0.01em] text-[#1e3a5f] dark:text-white">
                Visor<span className="text-[#0F766E] dark:text-[#14b8a6]">360</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-white/45">by CCI Consultoria</span>
            </span>
          </Link>

          {/* Slot legado de título no topo (páginas com <PageHeaderTitle placement="header">). */}
          <div id={HEADER_TITLE_SLOT_ID} className="flex min-w-0 items-center" />
        </div>

        <div className="flex items-center gap-2">
          {posto}
          {/* Modo Demonstração — só pra quem tem permissão; âmbar quando ativo. */}
          <BalaoAcao lado="bottom" atraso={500} texto="Modo Demonstração: esconde nomes de rede, postos, CNPJ e endereço para apresentar o Visor"><DemoModeToggle /></BalaoAcao>
          <BalaoAcao lado="bottom" atraso={500} texto="Tema: claro, escuro ou igual ao do computador"><ThemeToggle /></BalaoAcao>
          <BalaoAcao lado="bottom" atraso={500} texto="Notificações"><SinoNotificacoes /></BalaoAcao>
          {/* Reportar bug/melhoria com print (só diretores da CCI). */}
          <BalaoAcao lado="bottom" atraso={500} texto="Reportar um problema ou sugestão, com print da tela"><ReportarChamado /></BalaoAcao>
          {/* Launcher da suíte CCI (grade ⋮⋮⋮ estilo Google) — abre os outros apps. */}
          <BalaoAcao lado="bottom" atraso={500} texto="Apps da CCI"><AppLauncher /></BalaoAcao>
        </div>
      </div>
    </header>
  )
}

export default Header
