import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownUp, HandCoins, CreditCard, ArrowUpCircle, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrencyInt } from '@/lib/formatters'
import { fetchAdministradoras } from '@/api/endpoints/financeiro'
import type { ReceivableRow, PayableRow } from '@/pages/Financeiro/hooks/useFinanceData'
import type { Cartao } from '@/api/types/financeiro'
import {
  buildReceberRows, buildPagarRows, type InstReceber, type InstPagar,
} from '@/pages/Financeiro/lib/instrumentos'

interface Props {
  titulos: ReceivableRow[]
  cartoes: Cartao[]
  payables: PayableRow[]
}

const RECEBER_META: Record<InstReceber, { label: string; dot: string }> = {
  cartoes: { label: 'Cartões', dot: 'bg-blue-500' },
  apps: { label: 'Apps', dot: 'bg-teal-500' },
  notas: { label: 'Notas a prazo', dot: 'bg-emerald-500' },
  faturas: { label: 'Faturas', dot: 'bg-violet-500' },
  outros: { label: 'Outros', dot: 'bg-gray-400' },
}
const PAGAR_META: Record<InstPagar, { label: string; dot: string }> = {
  boleto: { label: 'Boleto', dot: 'bg-violet-500' },
  tributo: { label: 'Tributo', dot: 'bg-red-500' },
  pix: { label: 'PIX', dot: 'bg-emerald-500' },
  transferencia: { label: 'Transferência', dot: 'bg-blue-500' },
  convenio: { label: 'Convênio', dot: 'bg-amber-500' },
  outros: { label: 'Outros', dot: 'bg-gray-400' },
}
// Cobrança = dívida de cliente (o que a aba Receber persegue). Cartões/apps são
// recebíveis a compensar (a adquirente paga em D+1/D+30) — bloco à parte pra não
// diluir a inadimplência.
const CLIENTES_ORDER: InstReceber[] = ['notas', 'faturas', 'outros']
const CARTAO_ORDER: InstReceber[] = ['cartoes', 'apps']
const PAGAR_ORDER: InstPagar[] = ['boleto', 'tributo', 'pix', 'transferencia', 'convenio', 'outros']

interface Item { id: string; label: string; dot: string; total: number; count: number }
interface Agg {
  total: number; count: number
  vencidoTotal: number; vencidoCount: number
  aVencerTotal: number; aVencerCount: number
  items: Item[]
}

const aggregate = (
  rows: { instrumento: string; valor: number; vencido: boolean }[],
  order: string[],
  meta: Record<string, { label: string; dot: string }>,
): Agg => {
  const keep = new Set(order)
  const map = new Map<string, { total: number; count: number }>()
  let total = 0; let count = 0; let vencidoTotal = 0; let vencidoCount = 0
  for (const r of rows) {
    if (!keep.has(r.instrumento)) continue
    total += r.valor; count += 1
    if (r.vencido) { vencidoTotal += r.valor; vencidoCount += 1 }
    const g = map.get(r.instrumento) ?? { total: 0, count: 0 }
    g.total += r.valor; g.count += 1
    map.set(r.instrumento, g)
  }
  const items: Item[] = order
    .map((id) => ({ id, label: meta[id].label, dot: meta[id].dot, ...(map.get(id) ?? { total: 0, count: 0 }) }))
    .filter((i) => i.count > 0)
    .sort((a, b) => b.total - a.total)
  return { total, count, vencidoTotal, vencidoCount, aVencerTotal: total - vencidoTotal, aVencerCount: count - vencidoCount, items }
}

type Tone = 'emerald' | 'blue' | 'red'
const TONE: Record<Tone, { ring: string; iconBg: string; value: string }> = {
  emerald: { ring: 'border-emerald-200 dark:border-emerald-900/50', iconBg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400', value: 'text-emerald-700 dark:text-emerald-300' },
  blue: { ring: 'border-blue-200 dark:border-blue-900/50', iconBg: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400', value: 'text-blue-700 dark:text-blue-300' },
  red: { ring: 'border-red-200 dark:border-red-900/50', iconBg: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400', value: 'text-red-700 dark:text-red-300' },
}

/** Card de um bucket: total grande + composição por instrumento (que SOMA o
 *  total) + rodapé vencidas/a vencer. `alerta` mostra um aviso âmbar no rodapé
 *  (usado nos cartões: bruto não conciliado). */
const BucketCard = ({
  title, sub, Icon, tone, agg, vencidoLabel = 'Vencidas', aVencerLabel = 'A vencer', alerta,
}: {
  title: string
  sub: string
  Icon: typeof HandCoins
  tone: Tone
  agg: Agg
  vencidoLabel?: string
  aVencerLabel?: string
  alerta?: string
}) => {
  const st = TONE[tone]
  return (
    <section className={cn('flex flex-col rounded-2xl border bg-white p-5 shadow-sm dark:bg-gray-900', st.ring)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{title}</p>
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-gray-400">{sub}</p>
        </div>
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', st.iconBg)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className={cn('mt-3 text-[22px] font-bold tabular-nums', st.value)}>{formatCurrencyInt(agg.total)}</p>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        {agg.count} {agg.count === 1 ? 'título em aberto' : 'títulos em aberto'}
      </p>

      {/* Composição por instrumento — soma = total acima */}
      <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3 dark:border-gray-800">
        {agg.items.length === 0 ? (
          <p className="text-xs text-gray-400">Nada em aberto.</p>
        ) : (
          agg.items.map((it) => (
            <div key={it.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', it.dot)} />
                <span className="truncate">{it.label}</span>
                <span className="text-[10px] text-gray-400">{it.count}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-gray-800 dark:text-gray-100">{formatCurrencyInt(it.total)}</span>
            </div>
          ))
        )}
      </div>

      {/* Rodapé — vencidas / a vencer */}
      <div className={cn('grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 dark:border-gray-800', !alerta && 'mt-auto')}>
        <div>
          <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {vencidoLabel}
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">{formatCurrencyInt(agg.vencidoTotal)}</p>
          <p className="text-[10px] text-gray-400">{agg.vencidoCount} {agg.vencidoCount === 1 ? 'título' : 'títulos'}</p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {aVencerLabel}
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{formatCurrencyInt(agg.aVencerTotal)}</p>
          <p className="text-[10px] text-gray-400">{agg.aVencerCount} {agg.aVencerCount === 1 ? 'título' : 'títulos'}</p>
        </div>
      </div>

      {alerta && (
        <div className="mt-3 flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-[10px] leading-tight text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{alerta}</span>
        </div>
      )}
    </section>
  )
}

/**
 * Posição em aberto RECONCILIADA, na mesma fonte das tabelas (lib/instrumentos).
 * Separa a COBRANÇA (dívida de cliente: notas+faturas+outros → bate com a aba
 * Receber) dos CARTÕES/APPS (bruto pendente do /CARTAO, NÃO conciliado com o
 * adquirente — pode conter baixa não feita; a conciliação real vive na aba
 * Cartões). "A pagar" bate com a aba Pagar. Vencidos do hero = clientes + a
 * pagar (cartão vencido é suspeito, não entra como atraso real).
 */
const PosicaoAberto = ({ titulos, cartoes, payables }: Props) => {
  // Modalidade por administradora (separa Apps de Cartões) — mesma query da
  // tabela (chave ['administradoras'] → cache compartilhado, sem fetch extra).
  const { data: admData } = useQuery({ queryKey: ['administradoras'], queryFn: () => fetchAdministradoras({ limite: 2000 }), staleTime: 30 * 60 * 1000 })
  const adminTipo = useMemo(() => {
    const m = new Map<string, string>()
    for (const a of admData?.resultados ?? []) m.set(`${a.empresaCodigo}-${a.administradoraCodigo}`, a.tipo || '')
    return m
  }, [admData])

  const recebRows = useMemo(
    () => buildReceberRows(titulos, cartoes, adminTipo),
    [titulos, cartoes, adminTipo],
  )
  const clientes = useMemo(() => aggregate(recebRows, CLIENTES_ORDER, RECEBER_META), [recebRows])
  const cartaoApps = useMemo(() => aggregate(recebRows, CARTAO_ORDER, RECEBER_META), [recebRows])
  const pagar = useMemo(() => aggregate(buildPagarRows(payables), PAGAR_ORDER, PAGAR_META), [payables])

  const aReceberTotal = clientes.total + cartaoApps.total
  const posicao = aReceberTotal - pagar.total
  // Vencidos que importam = dívida de cliente + a pagar (cartão a compensar não
  // é "vencido de cobrança").
  const vencidoCobranca = clientes.vencidoTotal + pagar.vencidoTotal

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Hero — posição líquida */}
      <section className="flex flex-col rounded-2xl border border-[#1e3a5f]/30 bg-gradient-to-br from-[#1e3a5f] to-[#27496f] p-5 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white">Posição líquida</p>
            <p className="text-[11px] uppercase tracking-wide text-white/60">A receber − a pagar</p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
            <ArrowDownUp className="h-4 w-4 text-white/90" />
          </div>
        </div>
        <p className={cn('mt-3 text-[28px] font-bold leading-tight tabular-nums', posicao >= 0 ? 'text-[#6ee7b7]' : 'text-red-300')}>
          {posicao >= 0 ? '+' : ''}{formatCurrencyInt(posicao)}
        </p>
        <div className="mt-3 space-y-1.5 border-t border-white/15 pt-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-white/60">A receber de clientes</span>
            <span className="font-semibold tabular-nums text-[#6ee7b7]">{formatCurrencyInt(clientes.total)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-white/60">Cartões e apps</span>
            <span className="font-semibold tabular-nums text-white/90">{formatCurrencyInt(cartaoApps.total)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-white/60">A pagar em aberto</span>
            <span className="font-semibold tabular-nums text-red-300">{formatCurrencyInt(pagar.total)}</span>
          </div>
        </div>
        <div className="mt-auto pt-3">
          <span className="text-[11px] text-white/50">{formatCurrencyInt(vencidoCobranca)} vencidos (clientes + a pagar)</span>
        </div>
      </section>

      <BucketCard title="A receber de clientes" sub="Cobrança · bate com a aba Receber" Icon={HandCoins} tone="emerald" agg={clientes} />
      <BucketCard
        title="Cartões e apps"
        sub="Bruto pendente · não conciliado"
        Icon={CreditCard}
        tone="blue"
        agg={cartaoApps}
        vencidoLabel="Vencidos (rever)"
        aVencerLabel="A compensar"
        alerta={cartaoApps.vencidoTotal > 0
          ? `Bruto do /CARTAO, sem conciliar com o adquirente. Os ${formatCurrencyInt(cartaoApps.vencidoTotal)} vencidos podem ser baixa não feita no ERP — confira na aba Cartões.`
          : 'Bruto do /CARTAO, sem conciliar com o adquirente. Feche na aba Cartões.'}
      />
      <BucketCard title="A pagar em aberto" sub="Bate com a aba Pagar" Icon={ArrowUpCircle} tone="red" agg={pagar} />
    </div>
  )
}

export default PosicaoAberto
