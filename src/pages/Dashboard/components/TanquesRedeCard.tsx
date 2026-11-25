import { useMemo, useState } from 'react'
import { Fuel, Search, AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import useReabastecimento, { type ReabastTanque } from '@/pages/Dashboard/hooks/useReabastecimento'
import { TanqueSvg } from '@/pages/Dashboard/components/TanqueIcone'
import { COR_NIVEL, nivelDe, produtoBonito } from '@/pages/Dashboard/components/tanqueNivel'
import TanquesPostoModal from '@/pages/Dashboard/components/modais/TanquesPostoModal'

const COR = COR_NIVEL

/**
 * Central → Visão Geral → "Tanques de combustível": todos os postos da rede,
 * um tanque por ícone (nível, cor por faixa, produto), alertas, volume atual,
 * capacidade, quanto cabe e a barra de nível do posto. Pior posto primeiro.
 *
 * Fonte: /TANQUE (estoque escritural do ERP) — leve o bastante pra rede inteira
 * na Central. O físico estimado pelo LMC fica na aba Reabastecimento, posto a
 * posto. Faixas iguais às do resto do sistema: crítico < 20%, baixo 20–30%.
 */

interface PostoLinha {
  codigo: number
  nome: string
  tanques: ReabastTanque[]
  atual: number
  capacidade: number
  criticos: number
  baixos: number
  pct: number
}

/** Um tanque legível: produto por extenso, nível grande, litros e quanto cabe. */
const TanqueCartao = ({ t, onClick }: { t: ReabastTanque; onClick: () => void }) => {
  const pct = Math.max(0, Math.min(100, t.nivelPct))
  const cor = COR[t.nivel]
  return (
    <button type="button" onClick={onClick} aria-label={`${t.produtoNome}: ${Math.round(pct)}%. Ver ao vivo`}
      className={cn('flex items-center gap-2.5 rounded-xl border bg-white p-2.5 text-left transition-colors hover:bg-gray-50 dark:bg-[#1e293b] dark:hover:bg-[#223049]',
        t.nivel === 'critico' ? 'border-red-200 dark:border-[#c07a7a]/50' : t.nivel === 'alerta' ? 'border-amber-200 dark:border-[#c79a4a]/50' : 'border-gray-200 dark:border-[#2f3b4f]')}>
      <TanqueSvg pct={pct} nivel={t.nivel} id={`tqc-${t.empresaCodigo}-${t.tanqueCodigo}`} className="h-12 w-11 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[12px] font-semibold leading-tight text-gray-800 dark:text-[#e2e8f0]">{produtoBonito(t.produtoNome).replace(/\.+$/, '')}</span>
        <span className={cn('mt-0.5 block text-[17px] font-bold tabular-nums leading-tight', cor.text)}>{Math.round(pct)}%</span>
        <span className="block text-[10.5px] tabular-nums text-gray-500 dark:text-[#94a3b8]">{formatNumber(Math.round(t.estoqueAtual))} de {formatNumber(Math.round(t.capacidade))} L</span>
      </span>
    </button>
  )
}

const TanquesRedeCard = () => {
  const { tanques, isLoading } = useReabastecimento({ respeitarFiltro: true })
  const [busca, setBusca] = useState('')
  // Posto/tanque clicado → modal ao vivo daquele posto.
  const [sel, setSel] = useState<{ p: PostoLinha; foco: number | null } | null>(null)

  const postos = useMemo<PostoLinha[]>(() => {
    const m = new Map<number, PostoLinha>()
    for (const t of tanques) {
      const p = m.get(t.empresaCodigo) ?? { codigo: t.empresaCodigo, nome: t.empresaNome, tanques: [], atual: 0, capacidade: 0, criticos: 0, baixos: 0, pct: 0 }
      p.tanques.push(t)
      p.atual += t.estoqueAtual
      p.capacidade += t.capacidade
      if (t.nivel === 'critico') p.criticos++
      else if (t.nivel === 'alerta') p.baixos++
      m.set(t.empresaCodigo, p)
    }
    const out = Array.from(m.values()).map((p) => ({ ...p, pct: p.capacidade > 0 ? (p.atual / p.capacidade) * 100 : 0 }))
    // Dentro do posto: do tanque mais vazio para o mais cheio (empate: pelo nome).
    for (const p of out) p.tanques.sort((a, b) => a.nivelPct - b.nivelPct || a.tanqueNome.localeCompare(b.tanqueNome, 'pt-BR', { numeric: true }))
    // Pior posto primeiro: quem tem crítico, depois menor nível.
    return out.sort((a, b) => b.criticos - a.criticos || a.pct - b.pct)
  }, [tanques])

  const total = useMemo(() => {
    const atual = tanques.reduce((s, t) => s + t.estoqueAtual, 0)
    const capacidade = tanques.reduce((s, t) => s + t.capacidade, 0)
    return {
      atual, capacidade,
      pct: capacidade > 0 ? (atual / capacidade) * 100 : 0,
      criticos: tanques.filter((t) => t.nivel === 'critico').length,
      baixos: tanques.filter((t) => t.nivel === 'alerta').length,
    }
  }, [tanques])

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return q ? postos.filter((p) => p.nome.toLowerCase().includes(q)) : postos
  }, [postos, busca])

  if (isLoading) {
    return (
      <section className="flex h-28 items-center justify-center rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </section>
    )
  }
  if (tanques.length === 0) return null

  const nivelTotal = nivelDe(total.pct)
  const raio = 16
  const circ = 2 * Math.PI * raio

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
      {/* Cabeçalho */}
      <header className="flex flex-wrap items-center gap-3 px-5 pt-4 pb-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1e3a5f]/[0.07] text-[#1e3a5f] dark:bg-white/10 dark:text-blue-300">
          <Fuel className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Tanques de combustível
            <InfoHint text="Volume atual de cada tanque da rede contra a capacidade, pelo estoque escritural do ERP. Crítico abaixo de 20%, baixo entre 20% e 30%. 'Cabe' é quanto dá para receber de carga. O físico estimado pelo LMC, com última compra e necessidade, fica na aba Reabastecimento, posto a posto." />
          </h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Volume atual × capacidade · estoque escritural · pior posto primeiro</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {total.criticos > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" /> {total.criticos} crítico{total.criticos > 1 ? 's' : ''}
            </span>
          )}
          {total.baixos > 0 && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              {total.baixos} baixo{total.baixos > 1 ? 's' : ''}
            </span>
          )}
          {total.criticos === 0 && total.baixos === 0 && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">todos acima de 30%</span>
          )}
          <span className="flex items-center gap-2.5 border-l border-gray-200 pl-3 dark:border-gray-700">
            <span className="relative block h-10 w-10 shrink-0">
              <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90" aria-hidden="true">
                <circle cx="20" cy="20" r={raio} fill="none" strokeWidth="4" className="stroke-gray-200 dark:stroke-gray-700" />
                <circle cx="20" cy="20" r={raio} fill="none" strokeWidth="4" stroke={COR[nivelTotal].fill} strokeDasharray={`${(circ * total.pct) / 100} ${circ}`} strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums text-gray-700 dark:text-gray-200">{Math.round(total.pct)}%</span>
            </span>
            <span className="leading-tight">
              <span className="block text-[9px] font-semibold uppercase tracking-wider text-gray-400">Total em tanque</span>
              <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(Math.round(total.atual))} L</span>
              <span className="text-[11px] text-gray-400"> / {formatNumber(Math.round(total.capacidade))} L</span>
            </span>
          </span>
        </div>
      </header>

      {/* Busca */}
      {postos.length > 3 && (
        <div className="px-5 pb-3">
          <label className="relative block w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar posto…"
              className="h-8 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-xs text-gray-800 placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f] dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-100"
            />
          </label>
        </div>
      )}

      {/* Postos: um bloco por posto, com os tanques em cartões legíveis */}
      <div className="space-y-3 border-t border-gray-100 p-4 dark:border-[#2f3b4f]">
        {visiveis.length === 0 && <p className="px-5 py-6 text-center text-xs text-gray-400">Nenhum posto com esse nome.</p>}
        {visiveis.map((p) => {
          const nivel = nivelDe(p.pct)
          return (
            <div key={p.codigo} className={cn('grid items-start overflow-hidden rounded-xl border border-l-4 bg-gray-50/50 lg:grid-cols-[260px_minmax(0,1fr)] dark:bg-[#0b1220]',
              nivel === 'critico' || p.criticos > 0 ? 'border-gray-200 border-l-red-400 dark:border-[#2f3b4f] dark:border-l-[#c07a7a]' : nivel === 'alerta' || p.baixos > 0 ? 'border-gray-200 border-l-amber-400 dark:border-[#2f3b4f] dark:border-l-[#c79a4a]' : 'border-gray-200 border-l-emerald-400 dark:border-[#2f3b4f] dark:border-l-[#4f9d84]')}>
              {/* Resumo do posto */}
              <button type="button" onClick={() => setSel({ p, foco: null })}
                className="flex h-full flex-col gap-2 border-b border-gray-200 p-4 text-left transition-colors hover:bg-white lg:border-b-0 lg:border-r dark:border-[#2f3b4f] dark:hover:bg-white/[0.03]">
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold text-gray-900 dark:text-[#f1f5f9]">{p.nome}</span>
                    <span className="block text-[11.5px] text-gray-500 dark:text-[#94a3b8]">{p.tanques.length} tanque{p.tanques.length > 1 ? 's' : ''} · clique para ver ao vivo</span>
                  </span>
                  <span className={cn('text-[20px] font-bold tabular-nums leading-none', COR[nivel].text)}>{Math.round(p.pct)}%</span>
                </span>
                <span className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-[#172234]">
                  <span className={cn('block h-full rounded-full', COR[nivel].bar)} style={{ width: `${Math.max(2, Math.min(100, p.pct))}%` }} />
                </span>
                <span className="grid grid-cols-3 gap-2 text-[11px] text-gray-500 dark:text-[#94a3b8]">
                  <span>Atual<b className="block text-[13px] font-semibold tabular-nums text-gray-900 dark:text-[#f1f5f9]">{formatNumber(Math.round(p.atual))} L</b></span>
                  <span>Capacidade<b className="block text-[13px] font-semibold tabular-nums text-gray-700 dark:text-[#cbd5e1]">{formatNumber(Math.round(p.capacidade))} L</b></span>
                  <span>Cabe<b className="block text-[13px] font-semibold tabular-nums text-sky-700 dark:text-[#9db5d6]">{formatNumber(Math.round(Math.max(0, p.capacidade - p.atual)))} L</b></span>
                </span>
                {(p.criticos > 0 || p.baixos > 0) && (
                  <span className="flex flex-wrap gap-1">
                    {p.criticos > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">{p.criticos} crítico{p.criticos > 1 ? 's' : ''}</span>}
                    {p.baixos > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{p.baixos} baixo{p.baixos > 1 ? 's' : ''}</span>}
                  </span>
                )}
              </button>

              {/* Tanques */}
              <div className="grid content-start items-start gap-2 p-3 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
                {p.tanques.map((t) => <TanqueCartao key={`${t.empresaCodigo}-${t.tanqueCodigo}`} t={t} onClick={() => setSel({ p, foco: t.tanqueCodigo })} />)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 px-5 py-2 text-[10px] text-gray-400 dark:border-gray-800 dark:text-gray-500">
        <span className="inline-flex items-center gap-1"><span className={cn('h-2 w-2 rounded-full', COR.ok.dot)} /> acima de 30%</span>
        <span className="inline-flex items-center gap-1"><span className={cn('h-2 w-2 rounded-full', COR.alerta.dot)} /> 20–30% · baixo</span>
        <span className="inline-flex items-center gap-1"><span className={cn('h-2 w-2 rounded-full', COR.critico.dot)} /> até 20% · crítico</span>
        <span>· Cabe = capacidade − volume atual.</span>
        <span>· Clique num posto ou num tanque para ver ao vivo: físico estimado, consumo, última compra.</span>
      </div>

      <TanquesPostoModal
        open={!!sel}
        onClose={() => setSel(null)}
        empresaCodigo={sel?.p.codigo ?? null}
        empresaNome={sel?.p.nome ?? ''}
        tanquesIniciais={sel?.p.tanques ?? []}
        tanqueFoco={sel?.foco ?? null}
      />
    </section>
  )
}

export default TanquesRedeCard
