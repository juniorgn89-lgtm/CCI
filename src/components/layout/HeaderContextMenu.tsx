import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Network, Fuel, Layers, MapPinOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { nomeLegivel } from '@/lib/nomeLegivel'
import { useFilterStore } from '@/store/filters'
import { useTenantStore } from '@/store/tenant'
import { useTopbarUi } from '@/store/topbarUi'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { useRedeNomeExibicao } from '@/hooks/useDemo'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { moduloPermiteTodos, moduloRedeWide } from '@/lib/moduleScope'
import PainelRedePosto from '@/components/layout/PainelRedePosto'

/**
 * Pílula de contexto (posto/rede) — mostra o posto atual e, ao clicar, abre um
 * painel com Rede, Posto e "Como funciona?". AUTO-SUFICIENTE: computa o rótulo e as
 * flags internamente (via hooks), então pode viver em qualquer barra — hoje na
 * barra de ações do módulo (antes ficava no topo). Reaproveita os componentes
 * existentes (cada um com seu dropdown/modal); o painel só os empilha.
 */
const HeaderContextMenu = () => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Contexto do posto/rede — computado aqui (não vem mais por props do Header).
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas(), staleTime: 10 * 60 * 1000 })
  const empresasPermitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const liveLock = useTopbarUi((s) => s.liveLock)
  const pathname = useLocation().pathname
  const redeWide = moduloRedeWide(pathname)
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const tenantNome = useRedeNomeExibicao(useTenantStore((s) => s.rede?.nome)) ?? undefined
  const fantasiasSel = empresaCodigos
    .map((c) => empresasPermitidas.find((e) => e.codigo === c)?.fantasia)
    .filter((n): n is string => !!n)
  const postoNome =
    empresaCodigos.length === 0 || fantasiasSel.length === 0
      ? null
      : fantasiasSel.length <= 2
        ? fantasiasSel.join(' · ')
        : `${fantasiasSel.length} postos`
  const contextoLabel = postoNome ?? (tenantNome ?? 'Todos')
  const allowTodos = moduloPermiteTodos(pathname)
  const label = redeWide
    ? (tenantNome ?? 'Todos')
    : (!allowTodos && empresaCodigos.length !== 1 ? 'Selecione um posto' : contextoLabel)

  // Visual da pílula: o que está aberto, em duas linhas (o que é · qual).
  const tipo: 'posto' | 'varios' | 'rede' | 'escolher' = redeWide
    ? 'rede'
    : !allowTodos && empresaCodigos.length !== 1
      ? 'escolher'
      : empresaCodigos.length === 1 && postoNome
        ? 'posto'
        : empresaCodigos.length > 1 && postoNome
          ? 'varios'
          : 'rede'
  const sobretitulo = {
    posto: 'Posto',
    varios: `${empresaCodigos.length} postos`,
    rede: redeWide ? 'Rede · todos os postos' : 'Todos os postos',
    escolher: 'Escolha o posto',
  }[tipo]
  const titulo = tipo === 'escolher' ? 'Nenhum posto aberto' : nomeLegivel(label)
  const Icone = { posto: Fuel, varios: Layers, rede: Network, escolher: MapPinOff }[tipo]

  // Fecha ao clicar fora — mas ignora cliques nos dropdowns portalizados
  // (rede/posto) e no modal do "Como funciona?", que vivem fora do painel.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (ref.current?.contains(t)) return
      if (t.closest('[data-radix-popper-content-wrapper]') || t.closest('[role="menu"]') || t.closest('[role="dialog"]')) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${sobretitulo}: ${titulo}. Trocar rede ou posto`}
        className={cn(
          'flex h-10 w-[150px] items-center gap-2.5 rounded-xl border pl-1.5 pr-3 text-left transition-colors sm:w-[260px] lg:w-[300px]',
          tipo === 'escolher'
            ? 'border-amber-300 bg-amber-50 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:hover:bg-amber-500/15'
            : open
              ? 'border-[#2563eb] bg-blue-50 dark:border-blue-500/60 dark:bg-blue-950/30'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-[#0f0f0f] dark:hover:border-gray-600 dark:hover:bg-gray-800',
        )}
      >
        <span className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          tipo === 'escolher'
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
            : tipo === 'posto'
              ? 'bg-[#1e3a5f] text-white dark:bg-blue-600'
              : 'bg-[#1e3a5f]/10 text-[#1e3a5f] dark:bg-white/10 dark:text-gray-100',
        )}>
          <Icone className="h-4 w-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className={cn(
            'truncate text-[10px] font-semibold uppercase tracking-wider',
            tipo === 'escolher' ? 'text-amber-700 dark:text-amber-300' : 'text-gray-400 dark:text-gray-500',
          )}>{sobretitulo}</span>
          <span className={cn(
            'truncate text-[14px] font-semibold',
            tipo === 'escolher' ? 'text-amber-900 dark:text-amber-100' : 'text-gray-900 dark:text-white',
          )}>{titulo}</span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <PainelRedePosto postos={empresasPermitidas} allowTodos={allowTodos} redeWide={redeWide} liveLock={liveLock} onClose={() => setOpen(false)} />
      )}
    </div>
  )
}

export default HeaderContextMenu
