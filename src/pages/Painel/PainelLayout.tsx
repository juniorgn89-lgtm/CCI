import { Outlet, NavLink, Navigate } from 'react-router-dom'
import { Network, Users, User, BarChart3, Settings, CalendarDays, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'
import { cn } from '@/lib/utils'

/**
 * Painel de gestão (master): barra horizontal de navegação entre módulos (pills)
 * + conteúdo do módulo ativo. Renderiza DENTRO do AppLayout (sidebar/header do
 * produto preservados). Cada módulo é uma rota `/painel/*`.
 *
 * Só "Selecionar rede" está implementado de verdade; os demais módulos são
 * esqueleto (conteúdo não aprovado no handoff).
 */

const MODULOS = [
  { to: '/painel/selecionar-rede', label: 'Selecionar rede', Icon: Network },
  { to: '/painel/usuarios', label: 'Usuários', Icon: Users },
  { to: '/painel/frentistas', label: 'Frentistas', Icon: User },
  { to: '/painel/redes', label: 'Gerenciar redes', Icon: BarChart3 },
  { to: '/painel/config', label: 'Configurações', Icon: Settings },
  { to: '/painel/apuracao', label: 'Apuração', Icon: CalendarDays },
  { to: '/painel/ia', label: 'Assistente IA', Icon: Sparkles },
]

const pillBase =
  'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[11px] border px-3.5 text-[13px] font-semibold whitespace-nowrap transition-transform hover:-translate-y-px'
const pillActive = 'border-[#1e3a5f] bg-[#1e3a5f] text-white shadow-[0_4px_12px_rgba(30,58,95,0.24)]'
const pillInactive = 'border-[#e2e8f0] bg-white text-[#334155] shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'

const PainelLayout = () => {
  const isMaster = useAuthStore((s) => s.isMaster)
  const acessoTodas = useAuthStore((s) => s.acessoTodasRedes)
  const redesPermitidas = useAuthStore((s) => s.redesPermitidas)
  const rede = useTenantStore((s) => s.rede)

  // Não-master com acesso a várias redes (ou todas) pode TROCAR de rede — entra
  // no painel só pra "Selecionar rede". Os módulos admin seguem master-only.
  const podeTrocar = acessoTodas || redesPermitidas.length > 1
  if (!isMaster && !podeTrocar) return <Navigate to="/dashboard" replace />
  const modulos = isMaster ? MODULOS : MODULOS.filter((m) => m.to === '/painel/selecionar-rede')

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Marca + rede conectada (conforme handoff) */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <img src="/brand/visor360-icon-512.png" alt="Visor360" className="h-[34px] w-[34px] shrink-0 object-contain" />
          <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#1e3a5f] dark:text-white">
            Visor<span className="text-[#0F766E] dark:text-[#14b8a6]">360</span>
          </span>
        </div>
        {rede ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[12px] text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {rede.nome} · <span className="font-semibold text-emerald-600 dark:text-emerald-400">conectada</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[12px] text-gray-400 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <span className="h-2 w-2 rounded-full bg-gray-300" />
            Nenhuma rede conectada
          </span>
        )}
      </header>

      {/* Navegação entre módulos (pills, rola na horizontal) */}
      <nav
        aria-label="Módulos"
        className="flex gap-[7px] overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {modulos.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => cn(pillBase, isActive ? pillActive : pillInactive)}>
            {({ isActive }) => (
              <>
                <Icon className={cn('h-[15px] w-[15px]', isActive ? 'text-white' : 'text-[#64748b]')} strokeWidth={2} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Conteúdo do módulo ativo */}
      <Outlet />
    </div>
  )
}

export default PainelLayout
