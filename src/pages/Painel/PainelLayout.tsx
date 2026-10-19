import { Outlet, Link, NavLink, Navigate, useLocation } from 'react-router-dom'
import {
  Network, Users, User, Settings, CalendarDays, Sparkles, ShieldCheck, CreditCard, Inbox,
  FileSignature, UserCog, Building2, Handshake,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'
import { cn } from '@/lib/utils'
import { useRedeNomeExibicao } from '@/hooks/useDemo'

/**
 * Painel de gestão (master): barra horizontal de GRUPOS (pills) + sub-abas do
 * grupo ativo + conteúdo. Renderiza DENTRO do AppLayout (sidebar/header do
 * produto preservados). Cada tela é uma rota `/painel/*`; as URLs antigas
 * continuam valendo, só a navegação foi agrupada:
 *
 *  Selecionar rede · Cadastros (Usuários, Frentistas) · Redes (Gerenciar,
 *  Apuração, Assistente IA) · Comercial (Leads, Assinatura, Contrato WebPosto)
 *  · Controle de acesso · Parâmetros (antiga Configurações, rota /painel/config)
 */

interface Item { to: string; label: string; Icon: typeof Network }
interface Grupo { id: string; label: string; Icon: typeof Network; itens: Item[] }

const GRUPOS: Grupo[] = [
  { id: 'selecionar', label: 'Selecionar rede', Icon: Network, itens: [
    { to: '/painel/selecionar-rede', label: 'Selecionar rede', Icon: Network },
  ] },
  { id: 'cadastros', label: 'Cadastros', Icon: UserCog, itens: [
    { to: '/painel/usuarios', label: 'Usuários', Icon: Users },
    { to: '/painel/frentistas', label: 'Frentistas', Icon: User },
  ] },
  { id: 'redes', label: 'Redes', Icon: Building2, itens: [
    { to: '/painel/redes', label: 'Gerenciar redes', Icon: Building2 },
    { to: '/painel/apuracao', label: 'Apuração', Icon: CalendarDays },
    { to: '/painel/ia', label: 'Assistente IA', Icon: Sparkles },
  ] },
  { id: 'comercial', label: 'Comercial', Icon: Handshake, itens: [
    { to: '/painel/leads', label: 'Leads', Icon: Inbox },
    { to: '/painel/assinatura', label: 'Assinatura', Icon: CreditCard },
    { to: '/painel/contrato', label: 'Contrato WebPosto', Icon: FileSignature },
  ] },
  { id: 'acesso', label: 'Controle de acesso', Icon: ShieldCheck, itens: [
    { to: '/painel/controle-acesso', label: 'Controle de acesso', Icon: ShieldCheck },
  ] },
  { id: 'config', label: 'Parâmetros', Icon: Settings, itens: [
    { to: '/painel/config', label: 'Parâmetros', Icon: Settings },
  ] },
]

const pillBase =
  'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[11px] border px-3.5 text-[13px] font-semibold whitespace-nowrap transition-transform hover:-translate-y-px'
const pillActive = 'border-[#1e3a5f] bg-[#1e3a5f] text-white shadow-[0_4px_12px_rgba(30,58,95,0.24)] dark:border-blue-700 dark:bg-blue-700'
const pillInactive = 'border-[#e2e8f0] bg-white text-[#334155] shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-300'

const PainelLayout = () => {
  const { pathname } = useLocation()
  const isMaster = useAuthStore((s) => s.isMaster)
  const acessoTodas = useAuthStore((s) => s.acessoTodasRedes)
  const redesPermitidas = useAuthStore((s) => s.redesPermitidas)
  const profileLoaded = useAuthStore((s) => s.profileLoaded)
  const rede = useTenantStore((s) => s.rede)
  const redeNome = useRedeNomeExibicao(rede?.nome)

  // ESPERA o perfil carregar antes de avaliar a trava. Sem isso, em F5/link-direto
  // o guard rodava com os defaults (isMaster=false, acessoTodas=false) porque o
  // perfil chega num 2º passo async → chutava todo mundo pro /dashboard, inclusive
  // Configurações (que é universal). Ver [[auth.profileLoaded]].
  if (!profileLoaded) return null

  // Configurações (/painel/config) é UNIVERSAL — preferências, plano e
  // personalização não fazem sentido gatear por rede/master. O resto do Painel
  // (admin) segue pra master ou quem pode TROCAR de rede (multi-rede / todas).
  const podeTrocar = acessoTodas || redesPermitidas.length > 1
  const acessoAmplo = isMaster || podeTrocar
  const isConfig = pathname.startsWith('/painel/config')
  if (!acessoAmplo && !isConfig) return <Navigate to="/dashboard" replace />

  // Grupos visíveis: master vê tudo; os demais veem Configurações (universal) +
  // Selecionar rede quando podem trocar.
  const grupos = isMaster
    ? GRUPOS
    : GRUPOS.filter((g) => g.id === 'config' || (g.id === 'selecionar' && podeTrocar))

  const ativo = (to: string) => pathname === to || pathname.startsWith(`${to}/`)
  const grupoAtivo = grupos.find((g) => g.itens.some((i) => ativo(i.to))) ?? null

  return (
    <div className="mx-auto max-w-none space-y-5">
      {/* Marca + rede conectada (conforme handoff). No CELULAR fica oculto: o
          MobileShell já mostra a marca Visor360 no topo — senão duplica feio. */}
      <header className="hidden items-center justify-between gap-3 sm:flex">
        <div className="flex items-center gap-2">
          <img src="/brand/visor360-icon-512.png" alt="Visor360" className="h-[34px] w-[34px] shrink-0 object-contain" />
          <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#1e3a5f] dark:text-white">
            Visor<span className="text-[#0F766E] dark:text-[#14b8a6]">360</span>
          </span>
        </div>
        {rede ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[12px] text-gray-600 shadow-sm dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {redeNome} · <span className="font-semibold text-emerald-600 dark:text-emerald-400">conectada</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[12px] text-gray-400 shadow-sm dark:border-gray-700 dark:bg-[#0f0f0f]">
            <span className="h-2 w-2 rounded-full bg-gray-300" />
            Nenhuma rede conectada
          </span>
        )}
      </header>

      {/* Grupos (pills, rolam na horizontal). Cada pill leva à 1ª tela do grupo. */}
      <nav
        aria-label="Módulos"
        className="flex gap-[7px] overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {grupos.map((g) => {
          const isActive = grupoAtivo?.id === g.id
          return (
            <Link key={g.id} to={g.itens[0].to} className={cn(pillBase, isActive ? pillActive : pillInactive)} aria-current={isActive ? 'page' : undefined}>
              <g.Icon className={cn('h-[15px] w-[15px]', isActive ? 'text-white' : 'text-[#64748b] dark:text-gray-400')} strokeWidth={2} />
              {g.label}
              {g.itens.length > 1 && (
                <span className={cn('ml-0.5 rounded-full px-1.5 text-[10px] font-semibold tabular-nums', isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400')}>
                  {g.itens.length}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Sub-abas do grupo ativo (só quando o grupo tem mais de uma tela). */}
      {grupoAtivo && grupoAtivo.itens.length > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-[#0f0f0f]">
            {grupoAtivo.itens.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                className={({ isActive }) => cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                )}
              >
                <i.Icon className="h-3.5 w-3.5" />
                {i.label}
              </NavLink>
            ))}
          </div>
          <span className="text-[11px] text-gray-400 dark:text-gray-500">{grupoAtivo.label}</span>
        </div>
      )}

      {/* Conteúdo da tela ativa */}
      <Outlet />
    </div>
  )
}

export default PainelLayout
