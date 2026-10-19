import { useMemo, useState } from 'react'
import {
  Percent, Trophy, TrendingDown, ArrowUpRight, ChevronDown,
  ShieldCheck, AlertTriangle, Sparkles, Radar,
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

/** Botão de ordenação do ranking (escopo de módulo — não recriar no render). */
const SortBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
      active ? 'bg-[#1e3a5f] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400',
    )}
  >
    {children}
  </button>
)

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

/** Margem % = LB ÷ faturamento — mesma conta e mesmas faixas do Radar de Preços
 *  (vermelho < 5%, âmbar < 9%), pra as duas abas contarem a mesma história. */
const margemPctDe = (f: { lucroBruto: number; faturamento: number }) => (f.faturamento > 0 ? (f.lucroBruto / f.faturamento) * 100 : 0)
const FAIXA = (pct: number) => (pct < 5 ? 'red' : pct < 9 ? 'amber' : 'green') as 'red' | 'amber' | 'green'
const FAIXA_CLS = {
  red: { text: 'text-red-600 dark:text-red-400', border: 'border-red-400', dot: 'bg-red-400', bar: 'bg-red-400' },
  amber: { text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-400', dot: 'bg-amber-400', bar: 'bg-amber-400' },
  green: { text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-400', dot: 'bg-emerald-400', bar: 'bg-emerald-400' },
}
const pctBR = (v: number) => `${v.toFixed(1).replace('.', ',')}%`

/** Média da rede POR COMBUSTÍVEL (R$/L ponderado por volume). Comparar o diesel
 *  com a média de todos os combustíveis misturados enganava (diesel sempre "abaixo"). */
const mediaPorProduto = (postos: ComercialPostoRow[]) => {
  const acc = new Map<number, { lb: number; litros: number; postos: number }>()
  for (const p of postos) for (const f of p.produtos) {
    if (!f.comCusto || f.litros <= 0) continue
    const e = acc.get(f.produtoCodigo) ?? { lb: 0, litros: 0, postos: 0 }
    e.lb += f.lucroBruto; e.litros += f.litros; e.postos += 1
    acc.set(f.produtoCodigo, e)
  }
  const m = new Map<number, { margemL: number; postos: number }>()
  for (const [k, e] of acc) m.set(k, { margemL: e.litros > 0 ? e.lb / e.litros : 0, postos: e.postos })
  return m
}

const FuelDrill = ({ posto, mediaProduto, onAnalisar }: { posto: ComercialPostoRow; mediaProduto: Map<number, { margemL: number; postos: number }>; onAnalisar?: (postoCodigo: number, fuel: string) => void }) => {
  // Escala das barras = maior entre as margens do posto e as médias dos combustíveis.
  const maxM = Math.max(0.001, ...posto.produtos.filter((f) => f.comCusto).flatMap((f) => [f.margemL, mediaProduto.get(f.produtoCodigo)?.margemL ?? 0]))
  return (
    <div className="space-y-2 bg-gray-50 px-4 py-3 dark:bg-[#161616]">
      <div className="flex items-center gap-1.5 rounded-md border border-blue-100 bg-blue-50/70 px-2.5 py-1.5 text-[11px] text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
        <span><b className="font-semibold">Comparação justa:</b> cada combustível é comparado com a média da rede <b className="font-semibold">no mesmo combustível</b> (diesel com diesel, gasolina com gasolina), não com a média de todos misturados.</span>
        <InfoHint align="end" text="A marca cinza na barra e o último % de cada linha usam a média por litro da rede naquele combustível, ponderada pelo volume de cada posto. Misturar tudo faria o diesel parecer sempre ruim, porque a margem por litro do diesel é naturalmente menor que a da gasolina. Quando só este posto vende o combustível, aparece único: não há com quem comparar." />
      </div>
      {posto.produtos.map((f) => {
        const media = mediaProduto.get(f.produtoCodigo)
        const sozinho = !media || media.postos < 2
        const vs = media && media.margemL > 0 ? ((f.margemL - media.margemL) / media.margemL) * 100 : 0
        const pct = margemPctDe(f)
        const tom = FAIXA_CLS[FAIXA(pct)]
        const barPct = f.comCusto ? Math.max(2, Math.min(100, (f.margemL / maxM) * 100)) : 0
        const mediaPct = media ? Math.min(100, (media.margemL / maxM) * 100) : 0
        const part = posto.litros > 0 ? (f.litros / posto.litros) * 100 : 0
        return (
          // Linha clicável: abre o Radar de Preços já neste posto e combustível,
          // pra sair do "está abaixo" direto pro "o que fazer".
          <button
            key={f.produtoCodigo}
            type="button"
            onClick={() => onAnalisar?.(posto.empresaCodigo, f.nome)}
            disabled={!onAnalisar}
            title={onAnalisar ? `Abrir ${f.nome} no Radar de Preços` : undefined}
            className={cn(
              'group block w-full rounded-lg border-l-[3px] bg-white px-3 py-2 text-left transition-colors dark:bg-gray-900',
              onAnalisar && 'cursor-pointer hover:bg-blue-50/60 dark:hover:bg-blue-950/20',
              !f.comCusto ? 'border-gray-200 dark:border-gray-700' : tom.border,
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', !f.comCusto ? 'bg-gray-300' : tom.dot)} />
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-gray-800 dark:text-gray-200">{f.nome}</span>
              {onAnalisar && (
                <span className="hidden shrink-0 items-center gap-1 text-[10px] font-semibold text-[#2563eb] opacity-0 transition-opacity group-hover:opacity-100 sm:inline-flex dark:text-blue-300">
                  <Radar className="h-3 w-3" />Ver no Radar
                </span>
              )}
              <span className="shrink-0 text-[10px] tabular-nums text-gray-400">{formatLitersShort(f.litros)} · {part.toFixed(0)}% do vol.</span>
              <span className={cn('w-12 shrink-0 text-right text-[12.5px] font-bold tabular-nums', !f.comCusto ? 'text-gray-400' : tom.text)}>
                {f.comCusto ? pctBR(pct) : ''}
              </span>
              <span className="w-16 shrink-0 text-right text-[11px] font-semibold tabular-nums text-gray-600 dark:text-gray-300">
                {f.comCusto ? margemL(f.margemL) : 'sem custo'}
              </span>
              <span
                className={cn('w-16 shrink-0 text-right text-[10px] font-semibold tabular-nums', sozinho ? 'text-gray-400' : vs >= 0 ? 'text-emerald-500' : 'text-red-500')}
                title={sozinho ? 'Só este posto vende este combustível: não há média da rede para comparar.' : `Média da rede neste combustível: ${margemL(media!.margemL)} (${media!.postos} postos)`}
              >
                {!f.comCusto ? '' : sozinho ? 'único' : `${vs >= 0 ? '+' : ''}${vs.toFixed(0)}%`}
              </span>
            </div>
            {f.comCusto && (
              <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div className={cn('h-full rounded-full', tom.bar)} style={{ width: `${barPct}%` }} />
                {/* marca da média da rede NESTE combustível */}
                {!sozinho && <div className="absolute top-1/2 h-3 w-[2px] -translate-y-1/2 bg-gray-500 dark:bg-gray-300" style={{ left: `calc(${mediaPct}% - 1px)` }} />}
              </div>
            )}
          </button>
        )
      })}
      <p className="pl-1 text-[10px] text-gray-400 dark:text-gray-500">
        Mesmos números do Radar de Preços: margem em % (vermelho abaixo de 5%, âmbar abaixo de 9%) e em R$ por litro · barra = margem por litro, a marca cinza é a média da rede no mesmo combustível · último % = diferença para essa média (único = só este posto vende).{onAnalisar && ' Clique num combustível pra abrir no Radar de Preços e ver o que fazer.'}
      </p>
    </div>
  )
}

const MargemPosto = ({ onGoToOportunidades, onAnalisar }: { onGoToOportunidades?: () => void; onAnalisar?: (postoCodigo: number, fuel: string) => void }) => {
  const data = useComercialData()
  const [sort, setSort] = useState<SortKey>('margemL')
  const [open, setOpen] = useState<number | null>(null)
  const mediaProduto = useMemo(() => mediaPorProduto(data.postos), [data.postos])

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
    return { acontecendo }
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
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Como agir</p>
              <p className="text-[12.5px] leading-snug text-gray-700 dark:text-gray-300">
                Fechar essa diferença — alinhar os postos abaixo da média — é a maior alavanca de margem, <span className="font-medium">sem vender 1 litro a mais</span>. O <span className="font-medium">quanto vale em R$</span>, posto a posto e já priorizado, está na aba Oportunidades.
              </p>
              {onGoToOportunidades && (
                <button
                  type="button"
                  onClick={onGoToOportunidades}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Ver no Radar de Preços
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}
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
              <InfoHint text="Postos ordenados por margem/L (ou lucro bruto/volume, conforme o botão). Colunas: volume, lucro bruto, margem/L e a distância vs a média da rede (vermelho = abaixo, verde = na média ou acima). É o diagnóstico; a ação priorizada em R$ está na aba Oportunidades. Clique numa unidade pra abrir o detalhe por combustível." />
            </div>
            <p className="text-[11px] text-gray-400">Clique numa unidade pra abrir o drill por combustível</p>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-gray-50 p-0.5 dark:bg-[#0f0f0f]">
            <SortBtn active={sort === 'margemL'} onClick={() => setSort('margemL')}>Margem/L</SortBtn>
            <SortBtn active={sort === 'lucroBruto'} onClick={() => setSort('lucroBruto')}>Lucro bruto</SortBtn>
            <SortBtn active={sort === 'litros'} onClick={() => setSort('litros')}>Volume</SortBtn>
          </div>
        </div>

        {/* Cabeçalho de colunas — cada uma com "?" explicando (mesmas larguras/
            responsividade das linhas, então alinha). */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-1.5 text-[9.5px] font-semibold uppercase tracking-wide text-gray-400 dark:border-gray-800 dark:text-gray-500">
          <span className="w-5" />
          <span className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">Posto</span>
          <span className="hidden w-24 items-center justify-end gap-0.5 md:inline-flex">Volume<InfoHint text="Litros vendidos no período." /></span>
          <span className="hidden w-24 items-center justify-end gap-0.5 lg:inline-flex">Lucro bruto<InfoHint text="Faturamento menos o custo (CMV) no período, em R$." /></span>
          <span className="flex w-20 items-center justify-end gap-0.5">Margem/L<InfoHint text="Lucro bruto ÷ litros = quanto cada litro deixa de lucro. É a base do ranking." /></span>
          <span className="flex w-[120px] items-center justify-end gap-0.5 whitespace-nowrap">vs média<InfoHint text="Distância da margem do posto até a média da rede, em R$/L. Vermelho = abaixo (deixa dinheiro na mesa); verde = na média ou acima. É diagnóstico — pra o quanto vale e o que fazer, veja a aba Oportunidades." /></span>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((p, i) => {
            const fr = frescorTone(p.custoStaleDays)
            const isOpen = open === p.empresaCodigo
            // Distância da margem do posto até a média da rede (diagnóstico, não
            // ordem): `gap` negativo = abaixo (deixa dinheiro na mesa).
            const abaixo = data.redeMargemL > 0 && p.margemL < data.redeMargemL
            const gap = p.margemL - data.redeMargemL
            const naMedia = Math.abs(gap) < 0.005
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
                  {/* DIAGNÓSTICO (não ordem): distância vs a média da rede. A ação
                      priorizada em R$ mora na aba Oportunidades. */}
                  {abaixo ? (
                    <span className="flex w-[120px] shrink-0 items-center justify-end gap-1 whitespace-nowrap text-[11px] font-bold text-red-600 dark:text-red-400">
                      <TrendingDown className="h-3.5 w-3.5 shrink-0" />−{formatCurrency(-gap)} vs média
                    </span>
                  ) : naMedia ? (
                    <span className="flex w-[120px] shrink-0 items-center justify-end gap-1 whitespace-nowrap text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0" />na média
                    </span>
                  ) : (
                    <span className="flex w-[120px] shrink-0 items-center justify-end gap-1 whitespace-nowrap text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0" />+{formatCurrency(gap)} vs média
                    </span>
                  )}
                </button>
                {isOpen && <FuelDrill posto={p} mediaProduto={mediaProduto} onAnalisar={onAnalisar} />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default MargemPosto
