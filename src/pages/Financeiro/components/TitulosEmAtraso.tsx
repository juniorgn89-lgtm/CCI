import { useMemo } from 'react'
import { Users, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import type { ReceivableRow, PayableRow } from '@/pages/Financeiro/hooks/useFinanceData'

interface Props {
  receivablesData: ReceivableRow[]
  payablesData: PayableRow[]
  /** Quantos itens mostrar (top N por valor). */
  top?: number
}

/** Campos numéricos acumulados por cliente/fornecedor. `valor` é a métrica das
 *  barras/ordenação (= total a receber vencido OU saldo a pagar vencido). */
type Acc = {
  valor: number
  faturado: number
  aFaturar: number
  valorBruto: number
  valorPago: number
}
type NumKey = keyof Acc
type BarItem = Acc & { nome: string }

const ZERO: Acc = { valor: 0, faturado: 0, aFaturar: 0, valorBruto: 0, valorPago: 0 }

interface Ranking {
  /** Top N por valor (pras barras). */
  items: BarItem[]
  /** Quantidade de clientes/fornecedores com algo vencido. */
  countGeral: number
  /** Totais de TODOS os vencidos (não só o top N), por campo. */
  gerais: Acc
}

const buildRanking = (m: Map<string, Acc>, top: number): Ranking => {
  const all = Array.from(m, ([nome, a]) => ({ nome, ...a })).sort((x, y) => y.valor - x.valor)
  const gerais = all.reduce<Acc>((g, i) => ({
    valor: g.valor + i.valor,
    faturado: g.faturado + i.faturado,
    aFaturar: g.aFaturar + i.aFaturar,
    valorBruto: g.valorBruto + i.valorBruto,
    valorPago: g.valorPago + i.valorPago,
  }), { ...ZERO })
  return { items: all.slice(0, top), countGeral: all.length, gerais }
}

/** Coluna extra (além do nome e do total) — referencia um campo do Acc. */
interface ColDef {
  key: NumKey
  label: string
  color?: string
}

const COLORS = {
  amber: 'text-amber-600 dark:text-amber-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  dim: 'text-gray-500 dark:text-gray-400',
}

/**
 * Títulos a receber / pagar EM ATRASO — espelha os dois primeiros blocos do
 * dashboard financeiro do webPosto: ranking (barras) dos clientes/fornecedores
 * com maior valor vencido, com as colunas de detalhe de cada um.
 */
const TitulosEmAtraso = ({ receivablesData, payablesData, top = 8 }: Props) => {
  const receber = useMemo(() => {
    const m = new Map<string, Acc>()
    for (const r of receivablesData) {
      if (r.statusTag !== 'vencido') continue
      const nome = r.nomeCliente?.trim() || `Cliente ${r.clienteCodigo}`
      const cur = m.get(nome) ?? { ...ZERO }
      cur.valor += r.valor
      if (r.convertido === false) cur.aFaturar += r.valor
      else cur.faturado += r.valor
      m.set(nome, cur)
    }
    return buildRanking(m, top)
  }, [receivablesData, top])

  const pagar = useMemo(() => {
    const m = new Map<string, Acc>()
    for (const p of payablesData) {
      if (p.statusTag !== 'vencido') continue
      const nome = p.nomeFornecedor?.trim() || `Fornecedor ${p.fornecedorCodigo}`
      const cur = m.get(nome) ?? { ...ZERO }
      cur.valor += p.saldoRestante
      cur.valorBruto += p.valor ?? 0
      cur.valorPago += p.valorPago ?? 0
      m.set(nome, cur)
    }
    return buildRanking(m, top)
  }, [payablesData, top])

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <AtrasoCard
        title="Títulos a receber em atraso"
        subtitle="Clientes com títulos vencidos (faturados e a faturar)"
        Icon={Users}
        ranking={receber}
        color="blue"
        nameLabel="Cliente"
        totalLabel="Total"
        cols={[
          { key: 'aFaturar', label: 'A faturar', color: COLORS.amber },
          { key: 'faturado', label: 'Faturado', color: COLORS.dim },
        ]}
        emptyText="Nenhum título a receber vencido. 🎉"
      />
      <AtrasoCard
        title="Títulos a pagar em atraso"
        subtitle="Fornecedores com títulos vencidos"
        Icon={Truck}
        ranking={pagar}
        color="red"
        nameLabel="Fornecedor"
        totalLabel="Saldo"
        totalHint="O saldo considera o valor do título mais o acréscimo (juros/multa) e menos o desconto, abatido o valor já pago."
        cols={[
          { key: 'valorBruto', label: 'Valor', color: COLORS.dim },
          { key: 'valorPago', label: 'Valor pago', color: COLORS.emerald },
        ]}
        emptyText="Nenhuma conta a pagar vencida. 🎉"
      />
    </div>
  )
}

const AtrasoCard = ({
  title, subtitle, Icon, ranking, color, emptyText, nameLabel, totalLabel, totalHint, cols,
}: {
  title: string
  subtitle: string
  Icon: typeof Users
  ranking: Ranking
  color: 'blue' | 'red'
  emptyText: string
  nameLabel: string
  totalLabel: string
  totalHint?: string
  cols: ColDef[]
}) => {
  const { items, countGeral, gerais } = ranking
  const max = Math.max(...items.map((i) => i.valor), 0)
  const barColor = color === 'blue' ? 'bg-blue-500/70' : 'bg-red-500/70'
  const iconBg = color === 'blue'
    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
    : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'

  return (
    <section className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconBg)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-gray-400">{emptyText}</p>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:border-gray-800">
            <span className="flex-1">{nameLabel}</span>
            {cols.map((c) => <span key={c.key} className="w-24 shrink-0 text-right">{c.label}</span>)}
            <span className="flex w-24 shrink-0 items-center justify-end gap-0.5 text-right">
              {totalLabel}
              {totalHint && <InfoHint text={totalHint} />}
            </span>
          </div>
          <ul className="flex-1 divide-y divide-gray-100 px-5 dark:divide-gray-800">
            {items.map((it) => {
              const width = max > 0 ? (it.valor / max) * 100 : 0
              return (
                <li key={it.nome} className="py-2.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="flex-1 truncate font-medium text-gray-700 dark:text-gray-300" title={it.nome}>
                      {it.nome}
                    </span>
                    {cols.map((c) => (
                      <span key={c.key} className={cn('w-24 shrink-0 text-right tabular-nums', c.color ?? COLORS.dim)}>
                        {it[c.key] > 0 ? formatCurrency(it[c.key]) : '—'}
                      </span>
                    ))}
                    <span className="w-24 shrink-0 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                      {formatCurrency(it.valor)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div className={cn('h-full rounded-full', barColor)} style={{ width: `${width}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t border-gray-200 px-5 py-2.5 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
            <span className="shrink-0">{countGeral > items.length ? `Top ${items.length} de ${countGeral}` : `${countGeral} ${countGeral === 1 ? 'título' : 'no total'}`}</span>
            <span className="text-right">
              <span className="mr-3 text-gray-400">
                {cols.map((c, i) => (
                  <span key={c.key}>
                    {i > 0 && ' · '}{c.label} <span className={cn('tabular-nums', c.color ?? COLORS.dim)}>{formatCurrency(gerais[c.key])}</span>
                  </span>
                ))}
              </span>
              {totalLabel} vencido: <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(gerais.valor)}</span>
            </span>
          </div>
        </>
      )}
    </section>
  )
}

export default TitulosEmAtraso
