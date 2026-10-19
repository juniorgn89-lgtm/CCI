import { useMemo, useState } from 'react'
import { Fuel, Wallet, AlertTriangle, ChevronRight, Loader2 } from 'lucide-react'
import { Section, ProgressBar } from '@/components/mobile/primitives'
import { brlShort } from '@/components/mobile/format'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/formatters'
import useReabastecimento, { type ReabastTanque } from '@/pages/Dashboard/hooks/useReabastecimento'
import useContasResumo, { type Bucket, type Categoria, type Horizonte } from '@/pages/Dashboard/hooks/useContasResumo'
import { COR_NIVEL, nivelDe } from '@/pages/Dashboard/components/tanqueNivel'
import TanquesPostoModal from '@/pages/Dashboard/components/modais/TanquesPostoModal'
import ContasListaModal, { type ListaSel, type TomLista } from '@/pages/Dashboard/components/modais/ContasListaModal'

/**
 * Seções da Visão Geral MOBILE da Central que abrem os mesmos modais do
 * desktop: Tanques (toque no posto → ao vivo) e Contas (toque na faixa ou
 * categoria → títulos). Mesmos hooks/caches dos cards de desktop.
 */

interface PostoTq { codigo: number; nome: string; tanques: ReabastTanque[]; atual: number; cap: number; criticos: number; baixos: number; pct: number }

export const TanquesMobileSection = () => {
  const { tanques, isLoading } = useReabastecimento({ respeitarFiltro: true })
  const [sel, setSel] = useState<{ p: PostoTq; foco: number | null } | null>(null)
  const postos = useMemo<PostoTq[]>(() => {
    const m = new Map<number, PostoTq>()
    for (const t of tanques) {
      const p = m.get(t.empresaCodigo) ?? { codigo: t.empresaCodigo, nome: t.empresaNome, tanques: [], atual: 0, cap: 0, criticos: 0, baixos: 0, pct: 0 }
      p.tanques.push(t); p.atual += t.estoqueAtual; p.cap += t.capacidade
      if (t.nivel === 'critico') p.criticos++
      else if (t.nivel === 'alerta') p.baixos++
      m.set(t.empresaCodigo, p)
    }
    return [...m.values()].map((p) => ({ ...p, pct: p.cap > 0 ? (p.atual / p.cap) * 100 : 0 })).sort((a, b) => b.criticos - a.criticos || a.pct - b.pct)
  }, [tanques])
  if (isLoading || postos.length === 0) return null
  const criticos = postos.reduce((s, p) => s + p.criticos, 0)
  return (
    <>
      <Section Icon={Fuel} title="Tanques" accent="blue" flush
        right={criticos > 0 ? <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300"><AlertTriangle className="h-3 w-3" /> {criticos} crítico{criticos > 1 ? 's' : ''}</span> : <span className="text-[10.5px] text-gray-400">toque p/ ver ao vivo</span>}>
        <div className="divide-y divide-gray-100 dark:divide-[#303030]">
          {postos.map((p) => {
            const nivel = nivelDe(p.pct)
            return (
              <button key={p.codigo} type="button" onClick={() => setSel({ p, foco: null })} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left active:bg-gray-50 dark:active:bg-white/5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-gray-800 dark:text-gray-200">{p.nome}</span>
                    <span className={cn('text-[12px] font-bold tabular-nums', COR_NIVEL[nivel].text)}>{Math.round(p.pct)}%</span>
                  </div>
                  <div className="mt-1.5"><ProgressBar pct={p.pct} color={COR_NIVEL[nivel].fill} /></div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-gray-400">
                    <span>{formatNumber(Math.round(p.atual))} L de {formatNumber(Math.round(p.cap))} L · {p.tanques.length} tanque{p.tanques.length > 1 ? 's' : ''}</span>
                    <span className="flex gap-1">
                      {p.criticos > 0 && <span className="rounded-full bg-red-50 px-1.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">{p.criticos} crít.</span>}
                      {p.baixos > 0 && <span className="rounded-full bg-amber-50 px-1.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{p.baixos} baixo{p.baixos > 1 ? 's' : ''}</span>}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
              </button>
            )
          })}
        </div>
      </Section>
      <TanquesPostoModal open={!!sel} onClose={() => setSel(null)} empresaCodigo={sel?.p.codigo ?? null} empresaNome={sel?.p.nome ?? ''} tanquesIniciais={sel?.p.tanques ?? []} tanqueFoco={sel?.foco ?? null} />
    </>
  )
}

const FAIXAS: { id: Bucket; label: string }[] = [
  { id: 'vencidas', label: 'Vencidas' },
  { id: 'hoje', label: 'Hoje' },
  { id: 'd7', label: '7 dias' },
  { id: 'd30', label: '8–30 dias' },
]
const FAIXA_DESC: Record<Horizonte, string> = {
  vencidas: 'Venceram antes de hoje e seguem em aberto',
  hoje: 'Vencem hoje',
  d7: 'Vencem de amanhã a 7 dias',
  d30: 'Vencem de 8 a 30 dias',
  depois: 'Vencem depois de 30 dias',
}

export const ContasMobileSection = () => {
  const r = useContasResumo()
  const [lista, setLista] = useState<ListaSel | null>(null)
  if (r.isLoading || !r.temDados) return null
  const titulo = (lado: 'pagar' | 'receber') => (lado === 'pagar' ? 'Contas a pagar' : 'Contas a receber')
  const abrirFaixa = (lado: 'pagar' | 'receber', h: Bucket) => {
    const tom: TomLista = h === 'vencidas' ? (lado === 'receber' ? 'orange' : 'red') : h === 'hoje' ? 'amber' : h === 'd7' ? 'blue' : 'gray'
    setLista({ titulo: titulo(lado), subtitulo: FAIXA_DESC[h], selo: FAIXAS.find((f) => f.id === h)!.label, tom, lado, itens: r.itens[lado].filter((i) => i.horizonte === h) })
  }
  const abrirCategoria = (lado: 'pagar' | 'receber', c: Categoria) =>
    setLista({ titulo: titulo(lado), subtitulo: 'Janela de 30 dias: vencidas, hoje e até 30 dias', selo: c.label, tom: lado === 'pagar' ? 'rose' : 'emerald', lado, itens: r.itens[lado].filter((i) => i.cat === c.id && i.horizonte !== 'depois') })
  const saldo = r.receber.tudo.total - r.pagar.tudo.total

  const Lado = (lado: 'pagar' | 'receber') => {
    const l = lado === 'pagar' ? r.pagar : r.receber
    const total30 = l.buckets.vencidas.total + l.buckets.hoje.total + l.buckets.d7.total + l.buckets.d30.total
    const carregando = r.carregando[lado]
    return (
      <div key={lado} className="px-3.5 py-3">
        <div className="flex items-center justify-between">
          <span className={cn('text-[12px] font-semibold', lado === 'pagar' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>{titulo(lado)}</span>
          {carregando ? <span className="inline-flex items-center gap-1 text-[11px] text-gray-400"><Loader2 className="h-3 w-3 animate-spin" /> buscando no ERP…</span> : <span className="text-[11px] text-gray-400">30 dias · <b className="text-gray-700 dark:text-gray-200">{brlShort(total30)}</b></span>}
        </div>
        {carregando ? <p className="mt-2 text-[11px] text-gray-400">Os títulos aparecem assim que terminar.</p> : (<>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {FAIXAS.map((f) => {
            const v = l.buckets[f.id]
            const vencTom = lado === 'receber' ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400'
            return (
              <button key={f.id} type="button" onClick={() => abrirFaixa(lado, f.id)} className="rounded-lg border border-gray-200 px-1.5 py-1.5 text-left active:bg-gray-50 dark:border-[#3a3a3a] dark:active:bg-white/5">
                <span className="block text-[9.5px] font-semibold uppercase tracking-wide text-gray-400">{f.label}</span>
                <span className={cn('block text-[12px] font-bold tabular-nums', f.id === 'vencidas' && v.total > 0 ? vencTom : 'text-gray-900 dark:text-gray-100')}>{brlShort(v.total)}</span>
                <span className="block text-[9.5px] text-gray-400">{v.count} doc.</span>
              </button>
            )
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {l.categorias.filter((c) => c.total > 0).map((c) => (
            <button key={c.id} type="button" onClick={() => abrirCategoria(lado, c)} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10.5px] text-gray-600 active:bg-gray-200 dark:bg-[#303030] dark:text-gray-300">
              <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />{c.label} <b className="tabular-nums">{brlShort(c.total)}</b>
            </button>
          ))}
        </div>
        </>)}
      </div>
    )
  }

  return (
    <>
      <Section Icon={Wallet} title="Contas" accent="navy" flush
        right={(r.carregando.pagar || r.carregando.receber) ? <span className="text-[10.5px] text-gray-400">carregando…</span> : <span className={cn('text-[11px] font-bold tabular-nums', saldo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')} title="Tudo a receber menos tudo a pagar">{saldo >= 0 ? '+' : '−'}{brlShort(Math.abs(saldo))}</span>}>
        <div className="divide-y divide-gray-100 dark:divide-[#303030]">
          {Lado('pagar')}
          {Lado('receber')}
        </div>
        <p className="border-t border-gray-100 px-3.5 py-2 text-[10px] text-gray-400 dark:border-[#303030]">Toque numa faixa ou categoria para ver os títulos. Laranja = a receber vencido (é cobrar).</p>
      </Section>
      <ContasListaModal sel={lista} onClose={() => setLista(null)} />
    </>
  )
}
