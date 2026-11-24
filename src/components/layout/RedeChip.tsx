import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Network, ArrowLeftRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTenantStore } from '@/store/tenant'
import { useAuthStore } from '@/store/auth'
import { useRedeNomeExibicao } from '@/hooks/useDemo'
import { APP_STRUCTURE } from '@/lib/appStructure'
import { nomeLegivel } from '@/lib/nomeLegivel'

/** Nome do módulo da rota atual (pro título da aba do navegador). */
const moduloDaRota = (pathname: string): string | null => {
  if (pathname.startsWith('/painel')) return 'Painel'
  const m = [...APP_STRUCTURE]
    .sort((a, b) => b.path.length - a.path.length)
    .find((x) => pathname === x.path || pathname.startsWith(`${x.path}/`))
  return m?.label ?? null
}

/**
 * Chip da REDE no topo (entre a logo e o nome do módulo): presente em todas as
 * telas, inclusive nas que não têm barra de filtros, para o cliente nunca
 * perder de vista em qual rede está. Quem acessa mais de uma rede clica para
 * trocar. Também põe a rede no título da aba do navegador.
 */
const RedeChip = () => {
  const { pathname } = useLocation()
  const rede = useTenantStore((s) => s.rede)
  const nome = useRedeNomeExibicao(rede?.nome)
  const isMaster = useAuthStore((s) => s.isMaster)
  const acessoTodas = useAuthStore((s) => s.acessoTodasRedes)
  const redesPermitidas = useAuthStore((s) => s.redesPermitidas)
  const podeTrocar = isMaster || acessoTodas || redesPermitidas.length > 1
  const exibido = nome ? nomeLegivel(nome) : null
  const modulo = moduloDaRota(pathname)

  // Título da aba: "Rede Trivela · Central da Rede — Visor360".
  useEffect(() => {
    const anterior = document.title
    const partes = [exibido, modulo].filter(Boolean).join(' · ')
    document.title = partes ? `${partes} — Visor360` : 'Visor360'
    return () => { document.title = anterior }
  }, [exibido, modulo])

  if (!exibido) return null

  const conteudo = (
    <>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#1e3a5f] text-white dark:bg-white/10 dark:text-gray-100">
        <Network className="h-3 w-3" />
      </span>
      <span className="flex min-w-0 flex-col leading-none">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Rede</span>
        <span className="mt-0.5 max-w-[200px] truncate text-[13px] font-semibold text-gray-900 dark:text-gray-100">{exibido}</span>
      </span>
      {podeTrocar && <ArrowLeftRight className="ml-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />}
    </>
  )
  const cls = 'hidden h-9 shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 pl-1.5 pr-2.5 sm:flex dark:border-gray-700 dark:bg-[#0f0f0f]'

  return podeTrocar ? (
    <Link to="/painel/selecionar-rede" aria-label={`Rede ${exibido}. Trocar de rede`} className={cn(cls, 'transition-colors hover:border-gray-300 hover:bg-gray-100 dark:hover:border-gray-600 dark:hover:bg-gray-800')}>
      {conteudo}
    </Link>
  ) : (
    <div aria-label={`Rede ${exibido}`} className={cls}>{conteudo}</div>
  )
}

export default RedeChip
