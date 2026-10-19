import { CalendarRange, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GROUP_TINT } from '@/lib/groupTint'
import { formatCurrency, formatCurrencyInt, formatDate, formatNumber } from '@/lib/formatters'
import BarCell from '@/components/tables/BarCell'
import HeaderHint from '@/components/tables/HeaderHint'
import InfoHint from '@/components/ui/InfoHint'

/**
 * Aba "Projeção por <item>" do Detalhamento (Combustível, Automotivo e
 * Conveniência). Realizado × projeção de fechamento do mês, item a item
 * (combustível, categoria ou grupo), com a MESMA engine sazonal rede-wide dos
 * KPIs e do card executivo: o total bate com o headline.
 *
 * Além do realizado/projetado, traz o que falta vender, o ritmo por dia
 * restante, a fatia de cada item no lucro projetado e quanto do mês já entrou.
 *
 * Honestidade: período fechado → projeção = realizado, dito na tela. E como a
 * projeção por item usa o MESMO fator rede-wide por métrica (decisão do
 * projeto, pra somar exato com o headline), margem e L.B./unidade projetados
 * são iguais aos realizados e "quanto do mês já entrou" é igual pra todos —
 * por isso aparecem UMA vez, na linha de contexto, e não coluna a coluna.
 */

export interface ItemProjecao {
  codigo: string | number
  nome: string
  qtd: number
  faturamento: number
  lucroBruto: number
  /** Classe da bolinha colorida (ex.: combustível). */
  corDot?: string
  /** Classe de selo (ex.: categoria automotiva). Tem prioridade sobre corDot. */
  badgeCls?: string
}

export interface ProjItem {
  qtd: number
  fat: number
  lucro: number
}

export interface ProjecaoMeta {
  diasFechados: number
  diasRestantes: number
  /** true = ramo linear (<90d de histórico); false = índice de dia-da-semana. */
  linear: boolean
  /** yyyy-MM-dd do fim do mês projetado. */
  dataFinal: string
  confiabilidade: string
  confiabilidadePct: number
}

interface Props {
  linhas: ItemProjecao[]
  /** Projeção de cada item (mesma engine dos cards). */
  projetar: (linha: ItemProjecao) => ProjItem | undefined
  meta: ProjecaoMeta
  /** Rótulos: 'Combustível' / 'Categoria' / 'Grupo'; 'Litros' / 'Unidades'. */
  rotuloItem: string
  rotuloQtd: string
  /** Sufixo do ritmo por dia: 'L/dia' / 'un/dia'. */
  sufixoDia: string
  /** 'L.B. / litro' / 'L.B. / unidade'. */
  rotuloLb: string
  /** Mensagem do vazio. */
  vazio?: string
}

const GroupTh = ({ label, colSpan, first }: { label: string; colSpan: number; first?: boolean }) => (
  <th colSpan={colSpan} className={cn('bg-gray-100/60 px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:bg-transparent dark:text-gray-500', !first && 'border-l border-gray-200 dark:border-gray-700')}>
    {label}
  </th>
)

const pctFmt = (v: number) => `${v.toFixed(2).replace('.', ',')}%`

const ProjecaoPorItemTable = ({ linhas: itens, projetar, meta, rotuloItem, rotuloQtd, sufixoDia, rotuloLb, vazio = 'Sem vendas no período.' }: Props) => {
  if (itens.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-gray-400">{vazio}</div>
  }

  const fechado = meta.diasRestantes <= 0
  const linhas = itens.map((f) => {
    const p = projetar(f)
    const projQtd = fechado || !p ? f.qtd : p.qtd
    const projLucro = fechado || !p ? f.lucroBruto : p.lucro
    const projFat = fechado || !p ? f.faturamento : p.fat
    return {
      f,
      projQtd,
      projLucro,
      projFat,
      faltaQtd: Math.max(0, projQtd - f.qtd),
      faltaLucro: Math.max(0, projLucro - f.lucroBruto),
      margem: f.faturamento > 0 ? (f.lucroBruto / f.faturamento) * 100 : 0,
      lb: f.qtd > 0 ? f.lucroBruto / f.qtd : 0,
    }
  }).sort((a, b) => b.projLucro - a.projLucro)

  const tot = linhas.reduce((s, l) => ({
    qtd: s.qtd + l.f.qtd,
    projQtd: s.projQtd + l.projQtd,
    lucro: s.lucro + l.f.lucroBruto,
    projLucro: s.projLucro + l.projLucro,
    fat: s.fat + l.f.faturamento,
    projFat: s.projFat + l.projFat,
  }), { qtd: 0, projQtd: 0, lucro: 0, projLucro: 0, fat: 0, projFat: 0 })
  const totMargem = tot.fat > 0 ? (tot.lucro / tot.fat) * 100 : 0
  const totLb = tot.qtd > 0 ? tot.lucro / tot.qtd : 0
  const totEntregue = tot.projLucro > 0 ? Math.min(100, (tot.lucro / tot.projLucro) * 100) : 0
  const maxProjQtd = Math.max(...linhas.map((l) => l.projQtd), 0)
  const maxProjLucro = Math.max(...linhas.map((l) => l.projLucro), 0)
  const porDia = (v: number) => (meta.diasRestantes > 0 ? v / meta.diasRestantes : 0)

  const confTom = meta.confiabilidade === 'alta'
    ? 'text-emerald-600 dark:text-emerald-400'
    : meta.confiabilidade === 'media' || meta.confiabilidade === 'média'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400'

  return (
    <div className="overflow-x-auto">
      {/* Linha de contexto: até quando projeta, com que base e que método. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 pt-3 text-[11px] text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1.5">
          <CalendarRange className="h-3.5 w-3.5" />
          {fechado
            ? <>Período fechado: a projeção é o próprio realizado.</>
            : <>Projeção para <b className="text-gray-700 dark:text-gray-200">{formatDate(meta.dataFinal)}</b> · {meta.diasFechados} dia{meta.diasFechados === 1 ? '' : 's'} fechado{meta.diasFechados === 1 ? '' : 's'}, {meta.diasRestantes} restante{meta.diasRestantes === 1 ? '' : 's'}</>}
        </span>
        {!fechado && (
          <>
            <span className="inline-flex items-center gap-1">
              Método: {meta.linear ? 'ritmo linear' : 'sazonal por dia da semana'}
              <InfoHint text={meta.linear
                ? 'Menos de 90 dias de histórico: projeta pelo ritmo médio dos dias já fechados, igual para todos os dias.'
                : 'Cada dia restante pesa conforme o dia da semana (sábado vende diferente de terça), com o índice da rede por métrica. É o mesmo cálculo dos cards acima e do painel da Central: os totais batem.'} />
            </span>
            <span className={cn('font-semibold capitalize', confTom)}>confiança {meta.confiabilidade} ({Math.round(meta.confiabilidadePct)}%)</span>
            <span className="inline-flex items-center gap-1">
              <b className="text-gray-700 dark:text-gray-200">{Math.round(totEntregue)}%</b> do lucro do mês já entrou
              <InfoHint text={`Realizado ÷ projetado. Vale para todos os itens, porque a projeção aplica o mesmo fator da rede a cada um: margem e ${rotuloLb} projetados ficam iguais aos realizados.`} />
            </span>
          </>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-gray-400">
          <Info className="h-3 w-3" /> Ordenado pelo lucro bruto projetado
        </span>
      </div>

      <table className="mt-2 w-full text-sm">
        <colgroup>
          <col />
          <col span={3} className={GROUP_TINT.operacao} />
          <col span={3} className={GROUP_TINT.financeiro} />
          <col className={GROUP_TINT.comparativo} />
          <col span={2} className={GROUP_TINT.eficiencia} />
        </colgroup>
        <thead className="border-b border-gray-100 bg-gray-50/50 text-[11px] uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-transparent dark:text-gray-400">
          <tr>
            <th className="px-3 py-1.5" />
            <GroupTh first label={rotuloQtd} colSpan={3} />
            <GroupTh label="Lucro bruto" colSpan={3} />
            <GroupTh label="Faturamento" colSpan={1} />
            <GroupTh label="Eficiência" colSpan={2} />
          </tr>
          <tr>
            <HeaderHint align="left" label={rotuloItem} help="Ordenado pelo lucro bruto projetado. A fatia ao lado do nome é a participação no lucro projetado do mês." />
            <HeaderHint groupStart label="Realizado" help={`${rotuloQtd} vendidos nos dias já fechados do período.`} />
            <HeaderHint label="Proj. mês" help={`${rotuloQtd} esperados até o fim do mês: realizado × fator sazonal da rede. Barra = tamanho relativo entre os itens.`} />
            <HeaderHint label="Falta" help="Proj. mês − realizado: o que ainda deve ser vendido. Abaixo, o ritmo por dia restante." />
            <HeaderHint groupStart label="Realizado" help="Lucro bruto (faturamento − custo) dos dias já fechados." />
            <HeaderHint label="Proj. mês" help="Lucro bruto esperado até o fim do mês, pela sazonalidade de lucro da rede." />
            <HeaderHint label="Falta" help="Lucro que ainda deve entrar até fechar o mês. Abaixo, por dia restante." />
            <HeaderHint groupStart label="Proj. mês" help="Faturamento esperado até o fim do mês (realizado × fator sazonal da rede)." />
            <HeaderHint groupStart label="Margem" help="Lucro bruto ÷ faturamento. A projeção mantém a margem do realizado, por isso é uma coluna só." />
            <HeaderHint label={rotuloLb} help="Lucro bruto por unidade vendida. Também se mantém na projeção." />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {linhas.map(({ f, projQtd, projLucro, projFat, faltaQtd, faltaLucro, margem, lb }) => {
            const fatia = tot.projLucro > 0 ? (projLucro / tot.projLucro) * 100 : 0
            return (
              <tr key={f.codigo} className="text-gray-800 dark:text-gray-200">
                <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                  <span className="flex items-center gap-2">
                    {f.badgeCls ? (
                      <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium', f.badgeCls)}>{f.nome}</span>
                    ) : (
                      <>
                        {f.corDot && <span className={cn('h-2 w-2 shrink-0 rounded-full', f.corDot)} aria-hidden="true" />}
                        <span className="truncate" title={f.nome}>{f.nome}</span>
                      </>
                    )}
                    <span className="ml-auto shrink-0 rounded bg-gray-100 px-1.5 text-[10px] font-semibold tabular-nums text-gray-500 dark:bg-gray-800 dark:text-gray-400">{fatia.toFixed(1).replace('.', ',')}%</span>
                  </span>
                </td>
                <td className="border-l border-gray-200 px-4 py-2.5 text-right tabular-nums dark:border-gray-700">{formatNumber(Math.round(f.qtd))}</td>
                <td className="px-2 py-1">
                  <BarCell value={projQtd} max={maxProjQtd} formatted={formatNumber(Math.round(projQtd))} color="blue" align="near" />
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {fechado ? <span className="text-gray-400">—</span> : (
                    <>
                      <span className="block text-gray-700 dark:text-gray-300">{formatNumber(Math.round(faltaQtd))}</span>
                      <span className="block text-[10px] text-gray-400">{formatNumber(Math.round(porDia(faltaQtd)))} {sufixoDia}</span>
                    </>
                  )}
                </td>
                <td className="border-l border-gray-200 px-4 py-2.5 text-right tabular-nums dark:border-gray-700">{formatCurrencyInt(f.lucroBruto)}</td>
                <td className="px-2 py-1">
                  <BarCell value={projLucro} max={maxProjLucro} formatted={formatCurrencyInt(projLucro)} color="green" align="near" />
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {fechado ? <span className="text-gray-400">—</span> : (
                    <>
                      <span className="block text-gray-700 dark:text-gray-300">{formatCurrencyInt(faltaLucro)}</span>
                      <span className="block text-[10px] text-gray-400">{formatCurrencyInt(porDia(faltaLucro))}/dia</span>
                    </>
                  )}
                </td>
                <td className="border-l border-gray-200 px-4 py-2.5 text-right tabular-nums text-gray-700 dark:border-gray-700 dark:text-gray-300">{formatCurrencyInt(projFat)}</td>
                <td className="border-l border-gray-200 px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900 dark:border-gray-700 dark:text-gray-100">{pctFmt(margem)}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-amber-700 dark:text-amber-400">{formatCurrency(lb)}</td>
              </tr>
            )
          })}
          {/* Total */}
          <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
            <td className="px-4 py-2.5">Total</td>
            <td className="border-l border-gray-200 px-4 py-2.5 text-right tabular-nums dark:border-gray-700">{formatNumber(Math.round(tot.qtd))}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(Math.round(tot.projQtd))}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{fechado ? '—' : formatNumber(Math.round(Math.max(0, tot.projQtd - tot.qtd)))}</td>
            <td className="border-l border-gray-200 px-4 py-2.5 text-right tabular-nums dark:border-gray-700">{formatCurrencyInt(tot.lucro)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrencyInt(tot.projLucro)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{fechado ? '—' : formatCurrencyInt(Math.max(0, tot.projLucro - tot.lucro))}</td>
            <td className="border-l border-gray-200 px-4 py-2.5 text-right tabular-nums dark:border-gray-700">{formatCurrencyInt(tot.projFat)}</td>
            <td className="border-l border-gray-200 px-4 py-2.5 text-right tabular-nums dark:border-gray-700">{pctFmt(totMargem)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(totLb)}</td>
          </tr>
        </tbody>
      </table>
      <p className="px-5 py-2.5 text-[11px] text-gray-400 dark:text-gray-500">
        Faturamento realizado {formatCurrencyInt(tot.fat)}. Os totais são a soma dos itens e batem com os cards e com o painel da Central.
      </p>
    </div>
  )
}

export default ProjecaoPorItemTable
