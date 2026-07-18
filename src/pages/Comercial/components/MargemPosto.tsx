import { useMemo, useState } from 'react'
import {
  Percent, Trophy, TrendingDown, ArrowUpRight, ChevronDown,
  ShieldCheck, AlertTriangle, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatLitersShort } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import RealizadoChave from '@/components/kpi/RealizadoChave'
import { Skeleton } from '@/components/ui/skeleton'
import useComercialData, { type ComercialPostoRow } from '@/pages/Comercial/hooks/useComercialData'

type SortKey = 'margemL' | 'lucroBruto' | 'litros'

const fmtDM = (iso: string | null): string => {
  if (!iso) return '—'
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

/** R$/L com 2 casas + sufixo. */
const margemL = (v: number) => `${formatCurrency(v)}/L`

/** Selo de frescor do custo de reposição. Verde discreto quando fresco; escala
 *  pra âmbar/vermelho conforme envelhece (mecanismo armado, dormente com dado
 *  fresco). A margem sai do CMV apurado (não é recalculada do LMC) — o selo só
 *  sinaliza RISCO de a margem apurada estar desatualizada quando a última carga
 *  (LMC) envelhece além de um reajuste recente. */
const frescorTone = (staleDays: number | null) => {
  if (staleDays == null) return { cls: 'text-gray-400', Icon: AlertTriangle }
  if (staleDays <= 2) return { cls: 'text-emerald-600 dark:text-emerald-400', Icon: ShieldCheck }
  if (staleDays <= 7) return { cls: 'text-amber-600 dark:text-amber-400', Icon: AlertTriangle }
  return { cls: 'text-red-600 dark:text-red-400', Icon: AlertTriangle }
}

const KpiCard = ({
  label, sub, value, foot, tone = 'plain', Icon, help,
}: {
  label: string; sub?: string; value: React.ReactNode; foot?: React.ReactNode
  tone?: 'plain' | 'navy' | 'green' | 'red' | 'amber'; Icon: typeof Percent; help?: string
}) => {
  const navy = tone === 'navy'
  return (
    <div
      className={cn(
        'rounded-2xl border p-4 shadow-sm',
        navy
          ? 'border-transparent bg-gradient-to-br from-[#1e3a5f] to-[#27496f] text-white'
          : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black',
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className={cn('text-[11px] font-semibold uppercase tracking-wide', navy ? 'text-white/70' : 'text-gray-400')}>{label}</p>
            {help && <InfoHint className={navy ? 'text-white/60 hover:text-white' : undefined} text={help} />}
          </div>
          {sub && <p className={cn('text-[10px]', navy ? 'text-white/50' : 'text-gray-400')}>{sub}</p>}
        </div>
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', navy ? 'bg-white/10' : 'bg-gray-100 dark:bg-gray-800')}>
          <Icon className={cn('h-4 w-4', navy ? 'text-white' : 'text-gray-500 dark:text-gray-400')} />
        </span>
      </div>
      <p className={cn(
        'mt-2 text-2xl font-bold tabular-nums',
        navy ? 'text-white' : tone === 'green' ? 'text-emerald-600 dark:text-emerald-400'
          : tone === 'red' ? 'text-red-600 dark:text-red-400'
          : tone === 'amber' ? 'text-amber-600 dark:text-amber-400'
          : 'text-gray-900 dark:text-gray-100',
      )}>
        {value}
      </p>
      {foot && <div className={cn('mt-1 text-[11px]', navy ? 'text-white/60' : 'text-gray-500 dark:text-gray-400')}>{foot}</div>}
    </div>
  )
}

const FuelDrill = ({ posto, redeMargemL }: { posto: ComercialPostoRow; redeMargemL: number }) => {
  // Escala das barras = da MAIOR margem entre os combustíveis (ou a média da rede,
  // pra a marca caber). Barra verde = acima da média; vermelha = abaixo.
  const maxM = Math.max(redeMargemL, ...posto.produtos.filter((f) => f.comCusto).map((f) => f.margemL), 0.001)
  const redePct = Math.min(100, (redeMargemL / maxM) * 100)
  return (
    <div className="space-y-2 bg-gray-50 px-4 py-3 dark:bg-[#161616]">
      {posto.produtos.map((f) => {
        const vs = redeMargemL > 0 ? ((f.margemL - redeMargemL) / redeMargemL) * 100 : 0
        const acima = f.margemL >= redeMargemL
        const barPct = f.comCusto ? Math.max(2, Math.min(100, (f.margemL / maxM) * 100)) : 0
        const part = posto.litros > 0 ? (f.litros / posto.litros) * 100 : 0
        return (
          <div key={f.produtoCodigo} className={cn(
            'rounded-lg border-l-[3px] bg-white px-3 py-2 dark:bg-gray-900',
            !f.comCusto ? 'border-gray-200 dark:border-gray-700' : acima ? 'border-emerald-400' : 'border-red-400',
          )}>
            <div className="flex items-center gap-2">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', !f.comCusto ? 'bg-gray-300' : acima ? 'bg-emerald-400' : 'bg-red-400')} />
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-gray-800 dark:text-gray-200">{f.nome}</span>
              <span className="shrink-0 text-[10px] tabular-nums text-gray-400">{formatLitersShort(f.litros)} · {part.toFixed(0)}% do vol.</span>
              <span className={cn('w-16 shrink-0 text-right text-[12.5px] font-bold tabular-nums',
                !f.comCusto ? 'text-gray-400' : acima ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                {f.comCusto ? margemL(f.margemL) : 'sem custo'}
              </span>
              <span className={cn('w-12 shrink-0 text-right text-[10px] font-semibold tabular-nums', vs >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                {f.comCusto ? `${vs >= 0 ? '+' : ''}${vs.toFixed(0)}%` : ''}
              </span>
            </div>
            {f.comCusto && (
              <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div className={cn('h-full rounded-full', acima ? 'bg-emerald-400' : 'bg-red-400')} style={{ width: `${barPct}%` }} />
                {/* marca da média da rede */}
                <div className="absolute top-1/2 h-3 w-[2px] -translate-y-1/2 bg-gray-500 dark:bg-gray-300" style={{ left: `calc(${redePct}% - 1px)` }} />
              </div>
            )}
          </div>
        )
      })}
      <p className="pl-1 text-[10px] text-gray-400 dark:text-gray-500">
        Barra = margem por litro · a marca cinza é a média da rede ({margemL(redeMargemL)}) · % = participação no volume do posto.
      </p>
    </div>
  )
}

const MargemPosto = () => {
  const data = useComercialData()
  const [sort, setSort] = useState<SortKey>('margemL')
  const [open, setOpen] = useState<number | null>(null)

  const rows = useMemo(() => {
    const arr = [...data.postos]
    arr.sort((a, b) => b[sort] - a[sort])
    return arr
  }, [data.postos, sort])

  // Leitura do especialista — determinística, ancorada no dado (sem inventar).
  const leitura = useMemo(() => {
    const { best, worst, redeMargemL } = data
    if (!best || !worst || redeMargemL <= 0) return null
    const piorFuel = [...worst.produtos].filter((f) => f.comCusto).sort((a, b) => a.margemL - b.margemL)[0]
    const acontecendo: string[] = [
      `Seus postos cobram margens bem diferentes: do pior (${worst.posto}, ${margemL(worst.margemL)}) ao melhor (${best.posto}, ${margemL(best.margemL)}) — ${margemL(best.margemL - worst.margemL)}/L de diferença. Cada um está no preço por conta própria, sem uma régua comum.`,
    ]
    if (worst.vsRedePct < -10) {
      acontecendo.push(
        `O ${worst.posto} está ${margemL(redeMargemL - worst.margemL)}/L abaixo da média — é quem mais deixa dinheiro na mesa${piorFuel ? `, puxado pelo ${piorFuel.nome} (só ${margemL(piorFuel.margemL)} de margem)` : ''}.`,
      )
    }
    const fazer: string[] = [
      'Priorizar os 3 piores postos: alinhá-los à média da rede é a maior alavanca de margem — sem vender 1 litro a mais. O ganho em R$ está quantificado e priorizado na aba Oportunidades.',
      'Atacar o custo onde a margem é baixa (renegociar bonificação) antes do preço — evita perder volume.',
      'Definir uma régua de preço por praça (aba Concorrência) pra fechar a diferença entre postos.',
    ]
    return { acontecendo, fazer }
  }, [data])

  if (data.isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }
  if (!data.hasRede || data.postos.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
        Sem dados de combustível no período selecionado.
      </div>
    )
  }

  const stale = data.custoStaleDaysMax
  // Sem NENHUMA data de custo (LMC vazio/500 da Quality) → não dá pra checar
  // frescor. Evita o "(nulld)" e deixa claro que a margem (CMV das vendas) não é
  // afetada. É um 3º estado, neutro (nem verde nem âmbar).
  const semCusto = stale == null
  const frescorOk = stale != null && stale <= 2
  // Máx de dias operados na rede — pra sinalizar postos que abrem MENOS dias
  // (volume menor explicado por dias fechados, não por "posto fraco").
  const maxDias = Math.max(0, ...data.postos.map((p) => p.diasOperados))
  // Dispersão = diferença de margem entre o melhor e o pior posto. Diagnóstico do
  // "tamanho do problema" (precificação sem régua) — NÃO é um "ganho" somável (o
  // ganho quantificado fica só na aba Oportunidades, pra não confundir os números).
  const dispersao = data.best && data.worst ? data.best.margemL - data.worst.margemL : 0
  const SortBtn = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={() => setSort(k)}
      className={cn(
        'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
        sort === k ? 'bg-[#1e3a5f] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400',
      )}
    >
      {children}
    </button>
  )

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div>
        <RealizadoChave />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          tone="navy" Icon={Percent}
          label="Margem média da rede" sub={`ponderada por volume · ${data.postos.length} unidades`}
          value={margemL(data.redeMargemL)}
          foot={<>LB total {formatCurrencyInt(data.redeLucroBruto)} · {formatLitersShort(data.redeLitros)}</>}
          help="Margem média da rede em R$/L, ponderada pelo volume de cada posto (lucro bruto total ÷ litros totais). O custo é o CMV apurado das vendas."
        />
        <KpiCard
          Icon={Trophy} label="Maior margem" sub="melhor posto" tone="green"
          value={data.best ? margemL(data.best.margemL) : '—'}
          foot={data.best?.posto}
          help="Posto com a maior margem por litro no período."
        />
        <KpiCard
          Icon={TrendingDown} label="Menor margem" sub="requer atenção" tone="red"
          value={data.worst ? margemL(data.worst.margemL) : '—'}
          foot={data.worst ? `${data.worst.posto} · ${data.worst.vsRedePct.toFixed(0)}% vs rede` : ''}
          help="Posto com a menor margem por litro — o que mais puxa a média da rede pra baixo."
        />
        <KpiCard
          Icon={ArrowUpRight} label="Diferença entre postos" sub="melhor × pior margem" tone="amber"
          value={`${margemL(dispersao)}`}
          foot={data.best && data.worst
            ? <>pior <span className="font-semibold">{data.worst.posto}</span> ({margemL(data.worst.margemL)}) · melhor <span className="font-semibold">{data.best.posto}</span> ({margemL(data.best.margemL)})</>
            : ''}
          help="Diferença de margem por litro entre o melhor e o pior posto. Dispersão alta = cada posto precifica no feeling (uns cobram bem, outros deixam dinheiro na mesa) — arrumar isso é a oportunidade. O quanto vale (em R$) está quantificado e priorizado na aba Oportunidades — aqui é o diagnóstico."
        />
        </div>
      </div>

      {/* Selo de frescor do custo — 3 estados: sem dado / recente / defasado. */}
      <div className={cn(
        'flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[12px]',
        semCusto
          ? 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400'
          : frescorOk
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'
            : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300',
      )}>
        {frescorOk && !semCusto ? <ShieldCheck className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
        <span className="font-medium">
          {semCusto
            ? 'Sem dado de custo de reposição (LMC) no período — não dá pra checar o frescor. A margem usa o CMV apurado das vendas (não afetada).'
            : frescorOk
              ? `Custo de reposição recente — carga mais antiga ${fmtDM(data.custoDateMaisAntiga)} (${stale}d). Boa base pra ler a margem.`
              : `Custo de reposição defasado em algum posto — carga mais antiga ${fmtDM(data.custoDateMaisAntiga)} (${stale}d). Se houve reajuste recente, a margem apurada pode estar desatualizada.`}
        </span>
        <InfoHint
          className="ml-auto"
          text="A margem sai do CMV apurado das vendas — não é recalculada do LMC. O selo usa a DATA da última carga (LMC) como sinal de frescor: se o custo de compra envelheceu além do último reajuste, a margem apurada pode estar desatualizada. Verde → âmbar → vermelho conforme a defasagem."
        />
      </div>

      {/* Leitura do especialista (determinística) */}
      {leitura && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 dark:border-indigo-900/30 dark:bg-indigo-950/10">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#4f46e5] text-white">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Leitura do especialista</h3>
            <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:bg-gray-900 dark:text-indigo-300">IA · read-only</span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400">O que está acontecendo</p>
              <ul className="space-y-1.5">
                {leitura.acontecendo.map((t, i) => (
                  <li key={i} className="text-[12.5px] leading-snug text-gray-700 dark:text-gray-300">• {t}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">O que fazer</p>
              <ol className="space-y-1.5">
                {leitura.fazer.map((t, i) => (
                  <li key={i} className="text-[12.5px] leading-snug text-gray-700 dark:text-gray-300">{i + 1}. {t}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Ranking */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-1">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Ranking de margem por posto</h3>
              <InfoHint text="Postos ordenados por margem/L (ou lucro bruto/volume, conforme o botão). Colunas: volume, lucro bruto, margem/L e o QUE FAZER — verde 'no ponto' = na média ou acima; vermelho 'subir R$X/L' = quanto acrescentar no preço pra chegar na média da rede. Clique numa unidade pra abrir o detalhe por combustível." />
            </div>
            <p className="text-[11px] text-gray-400">Clique numa unidade pra abrir o drill por combustível</p>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-gray-50 p-0.5 dark:bg-[#0f0f0f]">
            <SortBtn k="margemL">Margem/L</SortBtn>
            <SortBtn k="lucroBruto">Lucro bruto</SortBtn>
            <SortBtn k="litros">Volume</SortBtn>
          </div>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((p, i) => {
            const fr = frescorTone(p.custoStaleDays)
            const isOpen = open === p.empresaCodigo
            // Abaixo da média da rede = precisa mexer. `subir` = R$/L a acrescentar
            // no preço pra chegar na média (ação concreta, sem % abstrato).
            const abaixo = data.redeMargemL > 0 && p.margemL < data.redeMargemL
            const subir = data.redeMargemL - p.margemL
            return (
              <div key={p.empresaCodigo}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : p.empresaCodigo)}
                  className={cn(
                    'flex w-full items-center gap-3 border-l-[3px] px-4 py-3 text-left transition-colors',
                    abaixo
                      ? 'border-red-400 bg-red-50/50 hover:bg-red-50/80 dark:border-red-500/60 dark:bg-red-950/15 dark:hover:bg-red-950/25'
                      : 'border-transparent hover:bg-gray-50 dark:hover:bg-white/5',
                  )}
                >
                  <span className="w-5 text-center text-[12px] font-bold text-gray-400">{i + 1}</span>
                  <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-300 transition-transform', isOpen && 'rotate-180')} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-gray-800 dark:text-gray-200">{p.posto}</span>

                  {/* Selo de frescor por posto — SÓ quando há data de custo (LMC).
                      Sem data (ex.: /LMC 500), esconde: o banner âmbar acima já
                      explica a situação da rede, e "sem custo" em todo mundo só
                      confunde (a margem vem do CMV das vendas, não é afetada). */}
                  {p.custoStaleDays != null && (
                    <span className={cn('hidden items-center gap-1 text-[10px] font-medium sm:inline-flex', fr.cls)}>
                      <fr.Icon className="h-3 w-3" />
                      {fmtDM(p.custoDate)}
                    </span>
                  )}
                  {p.coberturaCustoPct < 99.5 && (
                    <span className="hidden rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 md:inline">
                      {p.coberturaCustoPct.toFixed(0)}% com custo
                    </span>
                  )}
                  {/* Abre bem menos dias que o resto da rede (3+) → contexto pro
                      volume menor (não é "posto fraco", é dias fechados). */}
                  {p.diasOperados > 0 && maxDias - p.diasOperados >= 3 && (
                    <span className="hidden rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 md:inline">
                      abriu {p.diasOperados} de {maxDias} dias
                    </span>
                  )}

                  <span className="hidden w-24 text-right text-[12px] tabular-nums text-gray-500 dark:text-gray-400 md:inline">{formatLitersShort(p.litros)}</span>
                  <span className="hidden w-24 text-right text-[12px] tabular-nums text-gray-500 dark:text-gray-400 lg:inline">{formatCurrencyInt(p.lucroBruto)}</span>

                  <span className={cn('w-20 text-right text-[13px] font-bold tabular-nums',
                    abaixo ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                    {margemL(p.margemL)}
                  </span>
                  {/* O QUE FAZER, sem % abstrato: verde "no ponto" ou vermelho "subir R$X". */}
                  {abaixo ? (
                    <span className="flex w-[104px] shrink-0 items-center justify-end gap-1 text-[11px] font-bold text-red-600 dark:text-red-400">
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />subir {margemL(subir)}/L
                    </span>
                  ) : (
                    <span className="flex w-[104px] shrink-0 items-center justify-end gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0" />no ponto
                    </span>
                  )}
                </button>
                {isOpen && <FuelDrill posto={p} redeMargemL={data.redeMargemL} />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default MargemPosto
