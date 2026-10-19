import { useMemo, useState } from 'react'
import { Fuel, Search, AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import useReabastecimento, { type ReabastTanque } from '@/pages/Dashboard/hooks/useReabastecimento'
import { TanqueIcone } from '@/pages/Dashboard/components/TanqueIcone'
import { COR_NIVEL, nivelDe } from '@/pages/Dashboard/components/tanqueNivel'
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
    for (const p of out) p.tanques.sort((a, b) => a.tanqueNome.localeCompare(b.tanqueNome, 'pt-BR', { numeric: true }))
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

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-y border-gray-100 text-[10px] uppercase tracking-wider text-gray-400 dark:border-gray-800">
            <tr>
              <th className="px-5 py-2 text-left font-semibold">Posto</th>
              <th className="px-3 py-2 text-left font-semibold">Níveis dos tanques</th>
              <th className="px-3 py-2 text-left font-semibold">Alertas</th>
              <th className="px-3 py-2 text-right font-semibold">Atual (L)</th>
              <th className="px-3 py-2 text-right font-semibold">Capacidade (L)</th>
              <th className="px-3 py-2 text-right font-semibold">Cabe (L)</th>
              <th className="px-5 py-2 text-right font-semibold">Nível</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {visiveis.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-6 text-center text-xs text-gray-400">Nenhum posto com esse nome.</td></tr>
            )}
            {visiveis.map((p) => {
              const nivel = nivelDe(p.pct)
              return (
                <tr key={p.codigo} className="cursor-pointer align-middle transition-colors hover:bg-gray-50 dark:hover:bg-white/5" onClick={() => setSel({ p, foco: null })} title="Ver os tanques deste posto ao vivo">
                  <td className="px-5 py-3">
                    <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{p.nome}</p>
                    <p className="text-[11px] text-gray-400">{p.tanques.length} tanque{p.tanques.length > 1 ? 's' : ''}</p>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {p.tanques.map((t) => <TanqueIcone key={`${t.empresaCodigo}-${t.tanqueCodigo}`} t={t} onClick={() => setSel({ p, foco: t.tanqueCodigo })} />)}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {p.criticos === 0 && p.baixos === 0 ? <span className="text-gray-300 dark:text-gray-600">—</span> : (
                      <span className="flex flex-wrap gap-1">
                        {p.criticos > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">{p.criticos} crít.</span>}
                        {p.baixos > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{p.baixos} baixo{p.baixos > 1 ? 's' : ''}</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(Math.round(p.atual))}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-500 dark:text-gray-400">{formatNumber(Math.round(p.capacidade))}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-blue-700 dark:text-blue-400">{formatNumber(Math.round(Math.max(0, p.capacidade - p.atual)))}</td>
                  <td className="px-5 py-3">
                    <span className="flex items-center justify-end gap-2">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <span className={cn('block h-full rounded-full', COR[nivel].bar)} style={{ width: `${Math.max(2, Math.min(100, p.pct))}%` }} />
                      </span>
                      <span className={cn('w-9 text-right text-xs font-bold tabular-nums', COR[nivel].text)}>{Math.round(p.pct)}%</span>
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
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
