import { useMemo, useState, type ReactNode } from 'react'
import { Search, Trophy, Wrench, Droplet, Fuel, Gauge, Receipt, TrendingUp, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatLiters, formatNumber } from '@/lib/formatters'
import type { FrentistaProdData, FuncProdRow, Podio } from '@/pages/Produtividade/hooks/useFrentistaProdutividade'

interface Props {
  data: FrentistaProdData
  /** Nome do posto selecionado — só rótulo do cabeçalho da tabela. */
  postoNome?: string
  /** Clique numa linha → abre esse funcionário na aba Funcionários. */
  onOpenFuncionario?: (codigo: number) => void
}

const fmtR = (v: number) => formatCurrency(v)
const fmtRi = (v: number) => formatCurrencyInt(v)
const fmtL = (v: number) => formatLiters(v)
const fmtN = (v: number) => formatNumber(v)
const fmtMix = (v: number) => `${v.toFixed(1).replace('.', ',')}%`

const iniciais = (nome: string) =>
  nome.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase() || '?'

/** Linha sem funcionário cadastrado (nome ausente ou fallback "Funcionário 123"). */
const semCadastro = (nome: string) => !nome || nome === '—' || /^Funcion[aá]rio\s+\d+$/i.test(nome)

/* ─── KPI (cards tintados; verde = R$, roxo = aditivada) ─── */
type KpiTone = 'green' | 'purple'
const KPI_TONE: Record<KpiTone, { card: string; chip: string; icon: string }> = {
  green: { card: 'from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900', chip: 'bg-emerald-100 dark:bg-emerald-900/30', icon: 'text-emerald-600 dark:text-emerald-400' },
  purple: { card: 'from-violet-50/60 to-white dark:from-violet-950/20 dark:to-gray-900', chip: 'bg-violet-100 dark:bg-violet-900/30', icon: 'text-violet-600 dark:text-violet-400' },
}
const KpiCard = ({ label, value, Icon, tone, sub }: { label: string; value: string; Icon: typeof Wrench; tone: KpiTone; sub?: ReactNode }) => {
  const t = KPI_TONE[tone]
  return (
    <div className={cn('flex flex-col rounded-2xl border border-gray-200 bg-gradient-to-br px-5 py-[18px] shadow-sm dark:border-gray-800', t.card)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</p>
        <div className={cn('flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg', t.chip)}>
          <Icon className={cn('h-4 w-4', t.icon)} />
        </div>
      </div>
      <p className="mt-3 text-[28px] font-bold leading-none tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
      {sub && <div className="mt-2 text-[11px] tabular-nums text-gray-400 dark:text-gray-500">{sub}</div>}
    </div>
  )
}

/* ─── Pódio (Top 3: 1º destacado + 2º/3º em linha) ─── */
const PodiumCard = ({ title, Icon, items, fmt, contexto }: {
  title: string; Icon: typeof Wrench; items: Podio[]; fmt: (v: number) => string; contexto: (cod: number) => string
}) => {
  const [first, second, third] = items
  const rest = [second, third].filter(Boolean) as Podio[]
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.02]">
      <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
        <Icon className="h-4 w-4 text-gray-400" />
        <h3 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
        <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-gray-400 dark:bg-gray-800 dark:text-gray-500">Top 3</span>
      </div>
      {!first ? (
        <p className="px-4 py-6 text-center text-[12px] text-gray-400">Sem dados no período.</p>
      ) : (
        <div className="p-3">
          {/* 1º destacado */}
          <div className="flex items-center gap-3 rounded-xl border border-amber-200/70 bg-amber-50/60 p-3 dark:border-amber-500/20 dark:bg-amber-500/[0.07]">
            <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-[#7a4f00]" style={{ backgroundColor: '#FCB619' }}>
              {iniciais(first.nome)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-gray-900 dark:text-gray-100">{first.nome}</p>
              <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{contexto(first.funcionarioCodigo)}</p>
            </div>
            <span className="shrink-0 text-[17px] font-bold tabular-nums text-amber-600 dark:text-amber-400">{fmt(first.valor)}</span>
          </div>
          {/* 2º / 3º */}
          {rest.length > 0 && (
            <div className="mt-1.5 divide-y divide-gray-50 dark:divide-gray-800/60">
              {rest.map((p, i) => (
                <div key={p.funcionarioCodigo} className="flex items-center gap-2 px-1.5 py-2">
                  <span className="w-5 shrink-0 text-[11px] font-semibold tabular-nums text-gray-400">{i + 2}º</span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-gray-600 dark:text-gray-300">{p.nome}</span>
                  <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-gray-700 dark:text-gray-300">{fmt(p.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Status pill ─── */
type StatusTone = 'green' | 'amber' | 'gray'
interface StatusInfo { label: string; tone: StatusTone; causa?: 'mix' | 'ticket' }
const STATUS_CLS: Record<StatusTone, string> = {
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  gray: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
}
const StatusPill = ({ s }: { s: StatusInfo }) => (
  <span className={cn('inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold', STATUS_CLS[s.tone])}>{s.label}</span>
)

/* Tendência (projeção do fim do mês) como seta + %; absoluto no tooltip. */
const Tend = ({ pct, titulo }: { pct: number; titulo: string }) => (
  <span title={titulo} className="inline-flex items-center gap-0.5 text-[10px] font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
    <TrendingUp className="h-2.5 w-2.5" />{fmtMix(pct)}
  </span>
)

const Th = ({ children, right }: { children: ReactNode; right?: boolean }) => (
  <th className={cn('whitespace-nowrap px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500', right ? 'text-right' : 'text-left')}>{children}</th>
)

const ProdutividadeDash = ({ data, postoNome, onOpenFuncionario }: Props) => {
  const [busca, setBusca] = useState('')
  const { kpis, podios, rows, projFactor } = data

  const rowByCod = useMemo(() => new Map(rows.map((r) => [r.funcionarioCodigo, r])), [rows])
  // Tendência = ritmo do mês (dias no mês ÷ decorridos). Uniforme por métrica/pessoa
  // (é o mesmo fator); > 0 só no mês corrente. No mês fechado não há projeção.
  const tendPct = (projFactor - 1) * 100

  // Média do posto pra o status = mesma base dos KPIs (agregado do posto).
  const avgMix = kpis.mixPct
  const avgTicket = kpis.ticketMedio
  const leaderCod = rows.find((r) => r.automotivo > 0)?.funcionarioCodigo ?? -1

  const statusOf = (r: FuncProdRow): StatusInfo => {
    if (semCadastro(r.nome)) return { label: 'Sem cadastro', tone: 'gray' }
    if (r.funcionarioCodigo === leaderCod) return { label: 'Destaque', tone: 'green' }
    const mixBaixo = avgMix > 0 && r.mixPct < avgMix
    const ticketBaixo = avgTicket > 0 && r.ticket < avgTicket
    if (mixBaixo || ticketBaixo) {
      // Sinaliza a métrica MAIS abaixo da média (maior déficit relativo).
      const mixGap = avgMix > 0 ? (r.mixPct - avgMix) / avgMix : 0
      const ticketGap = avgTicket > 0 ? (r.ticket - avgTicket) / avgTicket : 0
      const causa: 'mix' | 'ticket' = mixBaixo && ticketBaixo ? (ticketGap < mixGap ? 'ticket' : 'mix') : ticketBaixo ? 'ticket' : 'mix'
      return { label: causa === 'ticket' ? 'Ticket baixo' : 'Mix baixo', tone: 'amber', causa }
    }
    return { label: 'Na média', tone: 'gray' }
  }

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return q ? rows.filter((r) => r.nome.toLowerCase().includes(q)) : rows
  }, [rows, busca])

  const nAbaixo = rows.filter((r) => statusOf(r).tone === 'amber').length

  // Contexto do líder de cada pódio (2 métricas secundárias).
  const ctxAutomotivo = (cod: number) => { const r = rowByCod.get(cod); return r ? `ticket ${fmtR(r.ticket)} · ${fmtN(r.abastecimentos)} abast.` : '' }
  const ctxAditivada = (cod: number) => { const r = rowByCod.get(cod); return r ? `mix ${fmtMix(r.mixPct)} · ${fmtN(r.abastecimentos)} abast.` : '' }
  const ctxAtendimentos = (cod: number) => { const r = rowByCod.get(cod); return r ? `ticket ${fmtR(r.ticket)} · mix ${fmtMix(r.mixPct)}` : '' }

  return (
    <div className="space-y-4">
      {/* KPIs — comparação "vs mês anterior" não existe no hook, então só o card de
          ticket traz a linha de apoio (nº de abastecimentos). */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Faturamento automotivos" value={fmtR(kpis.automotivo)} Icon={Wrench} tone="green" />
        <KpiCard label="Litros de aditivada" value={fmtL(kpis.aditivadaLitros)} Icon={Droplet} tone="purple" />
        <KpiCard label="Mix de aditivada" value={fmtMix(kpis.mixPct)} Icon={Gauge} tone="purple" />
        <KpiCard label="Ticket médio automotivos" value={fmtR(kpis.ticketMedio)} Icon={Receipt} tone="green" sub={`${fmtN(kpis.abastecimentos)} abastecimentos`} />
      </div>

      {/* Pódios (Top 3) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <PodiumCard title="Vendas de automotivos" Icon={Wrench} items={podios.automotivo} fmt={fmtRi} contexto={ctxAutomotivo} />
        <PodiumCard title="Venda de aditivada" Icon={Droplet} items={podios.aditivada} fmt={fmtL} contexto={ctxAditivada} />
        <PodiumCard title="Atendimentos" Icon={Fuel} items={podios.atendimentos} fmt={fmtN} contexto={ctxAtendimentos} />
      </div>

      {/* Tabela da equipe */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.02]">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">Equipe · {postoNome ?? 'posto'}</h3>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">{rows.length} funcionários</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar funcionário…"
                className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-[12px] text-gray-700 placeholder:text-gray-400 focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb] dark:border-gray-800 dark:bg-[#0f0f0f] dark:text-gray-200 sm:w-56"
              />
            </div>
            {nAbaixo > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10.5px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                <AlertTriangle className="h-3 w-3" />{nAbaixo} abaixo da média
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="border-b border-gray-100 dark:border-gray-800">
              <tr>
                <Th>Funcionário</Th>
                <Th right>Automotivos</Th>
                <Th right>L. Aditivada</Th>
                <Th right>Mix</Th>
                <Th right>Abast.</Th>
                <Th right>Ticket</Th>
                <Th right>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-[13px] text-gray-400">Nenhum funcionário encontrado.</td></tr>
              ) : filtered.map((r) => {
                const s = statusOf(r)
                const isLeader = r.funcionarioCodigo === leaderCod
                return (
                  <tr
                    key={r.funcionarioCodigo}
                    onClick={() => onOpenFuncionario?.(r.funcionarioCodigo)}
                    title="Ver detalhe do funcionário"
                    className={cn('hover:bg-gray-50/60 dark:hover:bg-gray-800/30', onOpenFuncionario && 'cursor-pointer')}
                  >
                    <td className="whitespace-nowrap px-3 py-[11px]">
                      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-gray-800 dark:text-gray-200">
                        {r.nome}{isLeader && <Trophy className="h-3.5 w-3.5 text-amber-500" />}
                      </span>
                    </td>
                    <td className="px-3 py-[11px]">
                      <div className="flex flex-col items-end">
                        <span className="text-[12.5px] font-semibold tabular-nums text-gray-800 dark:text-gray-200">{fmtR(r.automotivo)}</span>
                        {tendPct > 0 && <Tend pct={tendPct} titulo={`Projeção fim do mês: ${fmtR(r.automotivoTend)}`} />}
                      </div>
                    </td>
                    <td className="px-3 py-[11px]">
                      <div className="flex flex-col items-end">
                        <span className="text-[12.5px] tabular-nums text-gray-700 dark:text-gray-300">{fmtL(r.aditivadaLitros)}</span>
                        {tendPct > 0 && <Tend pct={tendPct} titulo={`Projeção fim do mês: ${fmtL(r.aditivadaTend)}`} />}
                      </div>
                    </td>
                    <td className={cn('px-3 py-[11px] text-right text-[12.5px] tabular-nums', s.causa === 'mix' ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300')}>{fmtMix(r.mixPct)}</td>
                    <td className="px-3 py-[11px]">
                      <div className="flex flex-col items-end">
                        <span className="text-[12.5px] tabular-nums text-gray-700 dark:text-gray-300">{fmtN(r.abastecimentos)}</span>
                        {tendPct > 0 && <Tend pct={tendPct} titulo={`Projeção fim do mês: ${fmtN(r.abastTend)}`} />}
                      </div>
                    </td>
                    <td className={cn('px-3 py-[11px] text-right text-[12.5px] tabular-nums', s.causa === 'ticket' ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300')}>{fmtR(r.ticket)}</td>
                    <td className="px-3 py-[11px] text-right"><StatusPill s={s} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-gray-100 px-4 py-2.5 text-[10.5px] leading-relaxed text-gray-400 dark:border-gray-800 dark:text-gray-500">
          Tendência = projeção do fim do mês vs o realizado. "Abaixo da média" compara com a média do próprio posto no período.
        </div>
      </div>
    </div>
  )
}

export default ProdutividadeDash
