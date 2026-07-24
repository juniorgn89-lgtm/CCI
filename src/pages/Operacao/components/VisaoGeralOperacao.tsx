import { useMemo, useState } from 'react'
import { Droplets, AlertTriangle, Fuel, ArrowRight, ChevronDown, ChevronUp, CircleDollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatLiters, formatCurrencyInt, formatNumber } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import { Skeleton } from '@/components/ui/skeleton'
import type { PostoOption } from '@/components/filters/PostoLocalSelect'
import useReabastecimento from '@/pages/Dashboard/hooks/useReabastecimento'
import usePostosLitros from '@/pages/Operacao/hooks/usePostosLitros'

type StatusKind = 'critico' | 'atencao' | 'ok' | 'sem-dado'
type SortKey = 'nome' | 'litros' | 'faturamento' | 'reposicao' | 'status'

interface VgRow {
  codigo: number
  nome: string
  litros: number
  faturamento: number
  crit: number
  alerta: number
  ok: number
  tanques: number
  reposicao: number
  status: StatusKind
}

const STATUS_ORDER: Record<StatusKind, number> = { critico: 0, atencao: 1, ok: 2, 'sem-dado': 3 }
const STATUS_META: Record<StatusKind, { label: string; cls: string }> = {
  critico: { label: 'Crítico', cls: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300' },
  atencao: { label: 'Atenção', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' },
  ok: { label: 'OK', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' },
  'sem-dado': { label: 'Sem tanque', cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
}

interface Props {
  postos: PostoOption[]
  onOpenPosto: (codigo: number) => void
}

/**
 * Visão Geral da Operação — rede inteira num quadro só: o resumo do que as abas
 * Bombas (litros/faturamento de combustível) e Reabastecimento (tanques +
 * reposição) mostram, POR POSTO. Fonte rede-wide barata: cache de vendas por
 * setor + tanques ao vivo. Clicar num posto abre o detalhe (aba Bombas). Só
 * leitura — nunca inventa número: combustível sem apuração aparece como "—".
 */
const VisaoGeralOperacao = ({ postos, onOpenPosto }: Props) => {
  const { byPosto, isLoading: fuelLoading, hasCache } = usePostosLitros()
  const { tanques, isLoading: tankLoading } = useReabastecimento({ includeDetalhes: true })

  const postoSet = useMemo(() => new Set(postos.map((p) => p.codigo)), [postos])

  const rows: VgRow[] = useMemo(() => {
    // Tanques agregados por posto (só os postos do escopo do filtro).
    const tankAgg = new Map<number, { crit: number; alerta: number; ok: number; reposicao: number }>()
    for (const t of tanques) {
      if (!postoSet.has(t.empresaCodigo)) continue
      const a = tankAgg.get(t.empresaCodigo) ?? { crit: 0, alerta: 0, ok: 0, reposicao: 0 }
      if (t.nivel === 'critico') a.crit += 1
      else if (t.nivel === 'alerta') a.alerta += 1
      else a.ok += 1
      a.reposicao += t.necessidadeFimDoMes
      tankAgg.set(t.empresaCodigo, a)
    }
    return postos.map((p) => {
      const fuel = byPosto.get(p.codigo)
      const t = tankAgg.get(p.codigo)
      const tanquesTotal = t ? t.crit + t.alerta + t.ok : 0
      const status: StatusKind = !t || tanquesTotal === 0
        ? 'sem-dado'
        : t.crit > 0 ? 'critico' : t.alerta > 0 ? 'atencao' : 'ok'
      return {
        codigo: p.codigo,
        nome: p.fantasia,
        litros: fuel?.litros ?? 0,
        faturamento: fuel?.faturamento ?? 0,
        crit: t?.crit ?? 0,
        alerta: t?.alerta ?? 0,
        ok: t?.ok ?? 0,
        tanques: tanquesTotal,
        reposicao: t?.reposicao ?? 0,
        status,
      }
    })
  }, [postos, postoSet, byPosto, tanques])

  const totais = useMemo(() => ({
    litros: rows.reduce((s, r) => s + r.litros, 0),
    faturamento: rows.reduce((s, r) => s + r.faturamento, 0),
    postosCriticos: rows.filter((r) => r.crit > 0).length,
    reposicao: rows.reduce((s, r) => s + r.reposicao, 0),
  }), [rows])

  const maxLitros = useMemo(() => Math.max(1, ...rows.map((r) => r.litros)), [rows])

  const [sortKey, setSortKey] = useState<SortKey>('litros')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else { setSortKey(k); setSortDir(k === 'nome' ? 'asc' : 'desc') }
  }
  const rowsSorted = useMemo(() => {
    const arr = [...rows]
    const dir = sortDir === 'desc' ? -1 : 1
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'nome': return dir * a.nome.localeCompare(b.nome)
        case 'faturamento': return dir * (a.faturamento - b.faturamento)
        case 'reposicao': return dir * (a.reposicao - b.reposicao)
        case 'status': return dir * (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) * -1
        default: return dir * (a.litros - b.litros)
      }
    })
    return arr
  }, [rows, sortKey, sortDir])

  const loading = (fuelLoading || tankLoading) && rows.every((r) => r.litros === 0 && r.tanques === 0)

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Cards de rede — resposta primeiro */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <RedeCard label="Litros vendidos" hint="Litros de combustível de toda a rede no período (base fiscal apurada)."
          value={hasCache ? formatLiters(totais.litros) : '—'} Icon={Droplets}
          tint="from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900" iconCls="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <RedeCard label="Faturamento combustível" hint="Venda bruta de combustível da rede no período."
          value={hasCache ? formatCurrencyInt(totais.faturamento) : '—'} Icon={CircleDollarSign}
          tint="from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900" iconCls="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" />
        <RedeCard label="Postos c/ tanque crítico" hint="Postos com pelo menos um tanque abaixo de 20% — risco de faltar produto na pista."
          value={`${totais.postosCriticos}`} sub={`de ${postos.length} ${postos.length === 1 ? 'posto' : 'postos'}`} Icon={AlertTriangle}
          tint={totais.postosCriticos > 0 ? 'from-red-50/60 to-white dark:from-red-950/20 dark:to-gray-900' : 'from-gray-50/60 to-white dark:from-gray-900 dark:to-gray-900'}
          iconCls={totais.postosCriticos > 0 ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'} />
        <RedeCard label="Reposição necessária" hint="Litros que a rede precisa comprar até o fim do mês pra não zerar tanque, no ritmo de venda atual."
          value={formatLiters(totais.reposicao)} Icon={Fuel}
          tint="from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900" iconCls="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
      </div>

      {!hasCache && (
        <p className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[12px] text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Combustível sem apuração no período — litros e faturamento aparecem como "—". Tanques e reposição são ao vivo.
        </p>
      )}

      {/* Tabela por posto */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Resumo por posto</h3>
          <InfoHint text="Cada linha = um posto. Litros e faturamento vêm da apuração de combustível; tanques e reposição, ao vivo. Clique no posto pra abrir o detalhe (Bombas)." />
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-gray-200 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:border-gray-700 dark:text-gray-500">
              <SortTh label="Posto" k="nome" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="py-2 pl-4 pr-3" />
              <SortTh label="Litros" k="litros" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" className="py-2 px-3" />
              <SortTh label="Faturamento" k="faturamento" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" className="py-2 px-3" />
              <th className="py-2 px-3">Tanques</th>
              <SortTh label="Reposição" k="reposicao" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" className="py-2 px-3" />
              <SortTh label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="py-2 px-3" />
              <th className="py-2 pl-3 pr-4" />
            </tr>
          </thead>
          <tbody>
            {rowsSorted.map((r) => {
              const sm = STATUS_META[r.status]
              return (
                <tr key={r.codigo} onClick={() => onOpenPosto(r.codigo)}
                  className="group cursor-pointer border-b border-gray-100 transition-colors last:border-0 hover:bg-blue-50/40 dark:border-gray-800 dark:hover:bg-blue-950/20">
                  <td className="py-2.5 pl-4 pr-3 font-medium text-gray-900 dark:text-gray-100">{r.nome}</td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-gray-100 sm:block dark:bg-gray-800">
                        <div className="h-full rounded-full bg-blue-500/80" style={{ width: `${Math.round((r.litros / maxLitros) * 100)}%` }} />
                      </div>
                      <span className="tabular-nums text-gray-700 dark:text-gray-200">{hasCache ? formatLiters(r.litros) : '—'}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{hasCache ? formatCurrencyInt(r.faturamento) : '—'}</td>
                  <td className="py-2.5 px-3">
                    {r.tanques === 0 ? (
                      <span className="text-[11px] text-gray-400">—</span>
                    ) : (
                      <div className="flex items-center gap-2 text-[11px] tabular-nums">
                        {r.crit > 0 && <Dot cls="bg-red-500" n={r.crit} title="críticos" />}
                        {r.alerta > 0 && <Dot cls="bg-amber-500" n={r.alerta} title="em alerta" />}
                        {r.ok > 0 && <Dot cls="bg-emerald-500" n={r.ok} title="ok" />}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-gray-700 dark:text-gray-200">{r.reposicao > 0 ? formatLiters(r.reposicao) : '—'}</td>
                  <td className="py-2.5 px-3">
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', sm.cls)}>{sm.label}</span>
                  </td>
                  <td className="py-2.5 pl-3 pr-4 text-right">
                    <ArrowRight className="ml-auto h-4 w-4 text-gray-300 transition-colors group-hover:text-[#2563eb] dark:text-gray-600" />
                  </td>
                </tr>
              )
            })}
          </tbody>
          {rows.length > 1 && (
            <tfoot>
              <tr className="border-t border-gray-200 text-[13px] font-semibold dark:border-gray-700">
                <td className="py-2.5 pl-4 pr-3 text-gray-500 dark:text-gray-400">Rede · {rows.length} postos</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-gray-900 dark:text-gray-100">{hasCache ? formatLiters(totais.litros) : '—'}</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-gray-900 dark:text-gray-100">{hasCache ? formatCurrencyInt(totais.faturamento) : '—'}</td>
                <td className="py-2.5 px-3 text-[11px] text-gray-400">{formatNumber(rows.reduce((s, r) => s + r.tanques, 0))} tanques</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatLiters(totais.reposicao)}</td>
                <td className="py-2.5 px-3" colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

const RedeCard = ({ label, value, sub, hint, Icon, tint, iconCls }: {
  label: string; value: string; sub?: string; hint: string; Icon: typeof Droplets; tint: string; iconCls: string
}) => (
  <div className={cn('rounded-xl border border-gray-200 bg-gradient-to-br p-4 shadow-sm dark:border-gray-700', tint)}>
    <div className="flex items-center justify-between">
      <p className="flex items-center gap-1 text-[12px] font-medium text-gray-600 dark:text-gray-400">{label}<InfoHint text={hint} /></p>
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', iconCls)}><Icon className="h-4 w-4" /></div>
    </div>
    <p className="mt-2 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
    {sub && <p className="text-[11px] text-gray-400 dark:text-gray-500">{sub}</p>}
  </div>
)

const Dot = ({ cls, n, title }: { cls: string; n: number; title: string }) => (
  <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300" title={`${n} ${title}`}>
    <span className={cn('h-2 w-2 rounded-full', cls)} />{n}
  </span>
)

const SortTh = ({ label, k, sortKey, sortDir, onSort, align, className }: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: 'asc' | 'desc'; onSort: (k: SortKey) => void; align?: 'right'; className?: string
}) => {
  const active = sortKey === k
  return (
    <th className={className}>
      <button type="button" onClick={() => onSort(k)}
        className={cn('inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-gray-600 dark:hover:text-gray-300',
          align === 'right' && 'flex-row-reverse', active ? 'text-[#2563eb] dark:text-blue-300' : '')}>
        {label}
        {active && (sortDir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)}
      </button>
    </th>
  )
}

export default VisaoGeralOperacao
