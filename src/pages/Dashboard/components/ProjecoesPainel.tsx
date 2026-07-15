import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Droplets, Wrench, Store, Globe, BarChart3, Table2, TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency, formatCurrencyInt, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/store/filters'
import InfoHint from '@/components/ui/InfoHint'
import RealizadoChave from '@/components/kpi/RealizadoChave'
import useRedeSetores from '@/pages/Dashboard/hooks/useRedeSetores'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchVendasCache } from '@/api/supabase/apuracao'
import { weekdayMonthEndFactor, projecaoSazonal, projecaoAvancada, fimDoMesIso } from '@/lib/projection'
import { todayLocal } from '@/lib/period'
import useCentralSazonal from '@/pages/Dashboard/hooks/useCentralSazonal'

const PROJECAO_TOOLTIP_SAZONAL =
  'Projeção de fechamento do mês SAZONAL por posto: realizado × fator fim-de-mês ponderado pelo dia-da-semana (índice de 6 meses de histórico de cada posto; ramo linear quando <90d de operação). A rede é a SOMA dos postos — o painel e a tabela por posto batem número a número. Base fiscal carimbada; é estimativa, não o valor fechado.'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const fmtPct = (v: number): string => `${v.toFixed(2).replace('.', ',')}%`
const pad = (n: number) => String(n).padStart(2, '0')

/** Teto "redondo" acima de `v` pra escala do eixo Y (5 ticks limpos). */
const niceCeil = (v: number): number => {
  if (v <= 0) return 1
  const mag = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / mag
  const step = n <= 1 ? 1 : n <= 1.2 ? 1.2 : n <= 1.4 ? 1.4 : n <= 1.6 ? 1.6 : n <= 1.8 ? 1.8 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 3 ? 3 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 7.5 ? 7.5 : 10
  return step * mag
}

/** Pill de variação do Lucro bruto vs o período comparativo (mês/ano anterior). */
const CompBadge = ({ current, previous, label, title }: { current: number; previous: number; label: string; title: string }) => {
  if (!previous || previous === 0) return null
  const pct = ((current - previous) / previous) * 100
  const up = pct >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span
      title={title}
      className={cn(
        'mt-2 inline-flex items-center gap-1 self-start rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
        up
          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/25 dark:text-emerald-400'
          : 'bg-red-50 text-red-600 dark:bg-red-900/25 dark:text-red-400',
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {up ? '+' : ''}{pct.toFixed(1).replace('.', ',')}%
      <span className="font-medium opacity-70">vs {label}</span>
    </span>
  )
}

interface SegmentCardProps {
  label: string
  Icon: typeof Droplets
  cardBg: string
  iconBg: string
  iconColor: string
  loading: boolean
  lucroBruto: number
  /** Lucro bruto do período comparativo (mês/ano anterior) — alimenta o CompBadge. */
  lucroBrutoAnterior: number
  /** Rótulo curto do comparativo ("AA"/"MA") + tooltip completo. */
  cmpLabel: string
  cmpTitle: string
  primary: { label: string; value: string }
  secondary: { label: string; value: string }
}

const SegmentCard = ({ label, Icon, cardBg, iconBg, iconColor, loading, lucroBruto, lucroBrutoAnterior, cmpLabel, cmpTitle, primary, secondary }: SegmentCardProps) => (
  <div className={cn('flex h-full w-full min-w-0 flex-col rounded-2xl border border-gray-200 p-5 text-left shadow-sm dark:border-gray-700', cardBg)}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">{label}</p>
        <p className="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
          Lucro bruto
          <InfoHint text="Faturamento − Custo dos produtos vendidos, somando todos os postos da rede. Não inclui despesas operacionais." />
        </p>
      </div>
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconBg)}>
        <Icon className={cn('h-[18px] w-[18px]', iconColor)} />
      </div>
    </div>
    {loading ? (
      <div className="mt-4 h-8 w-32 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
    ) : (
      <p className="mt-4 text-[26px] font-extrabold tabular-nums tracking-tight text-gray-900 dark:text-gray-100">{formatCurrencyInt(lucroBruto)}</p>
    )}
    {!loading && <CompBadge current={lucroBruto} previous={lucroBrutoAnterior} label={cmpLabel} title={cmpTitle} />}
    <div className="mt-auto flex items-end justify-between gap-2 pt-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold tabular-nums text-gray-700 dark:text-gray-200">{primary.value}</p>
        <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">{primary.label}</p>
      </div>
      <div className="min-w-0 text-right">
        <p className="truncate text-sm font-bold tabular-nums text-gray-700 dark:text-gray-200">{secondary.value}</p>
        <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">{secondary.label}</p>
      </div>
    </div>
  </div>
)

const ProjecoesPainel = ({ onExpandedChange }: { onExpandedChange?: (v: boolean) => void } = {}) => {
  const dataInicial = useFilterStore((s) => s.dataInicial)
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const { combustivel, automotivos, conveniencia, global, isLoading, comparisonMode } = useRedeSetores()
  // Índice sazonal per-posto (mesma fonte da tabela BenchmarkSetor → batem).
  const sazonal = useCentralSazonal()
  // Rótulo do comparativo conforme o modo global (AA = ano ant., MA = mês ant.).
  const cmpLabel = comparisonMode === 'prevYear' ? 'AA' : 'MA'
  const cmpTitle = comparisonMode === 'prevYear'
    ? 'Variação do lucro bruto vs o mesmo período do ano anterior'
    : 'Variação do lucro bruto vs o mês anterior'

  // "Ver projeção" (modo expandido) desligado por enquanto — a pedido. O card
  // fica só na tabela de fechamento por setor. Pra reativar: restaurar o estado
  // `useState(false)` + o botão no header.
  const expanded = false
  const [hoverDay, setHoverDay] = useState<number | null>(null)
  const [projView, setProjView] = useState<'grafico' | 'tabela'>('grafico')
  const [selDia, setSelDia] = useState<number | null>(null)
  const [setorProj, setSetorProj] = useState<'combustivel' | 'automotivos' | 'conveniencia'>('combustivel')
  // Avisa o pai (Dashboard) quando abre/fecha — pra ocultar o Detalhamento por setor.
  useEffect(() => { onExpandedChange?.(expanded) }, [expanded, onExpandedChange])
  const setorLabel = setorProj === 'combustivel' ? 'combustível' : setorProj === 'automotivos' ? 'automotivos' : 'conveniência'
  const unidadeLabel = setorProj === 'combustivel' ? 'Litros' : 'Qtde'

  // ── LB diário do MÊS do filtro (dia 1 → hoje), INDEPENDENTE do recorte de
  // dias. Base da "oscilação das projeções": cada dia projeta o fechamento
  // como se o filtro fosse aquele dia. Respeita o filtro de EMPRESA, não o de data.
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas({ limite: 200 }), staleTime: 30 * 60 * 1000 })
  const empresas = useMemo(
    () => (empresasData?.resultados ?? []).map((e) => ({ codigo: e.empresaCodigo, nome: e.fantasia || e.razao || `Posto ${e.empresaCodigo}` })),
    [empresasData],
  )
  const permitidas = useEmpresasPermitidas(empresas)
  const codes = useMemo(() => {
    const base = permitidas.map((e) => e.codigo)
    return empresaCodigos.length > 0 ? base.filter((c) => empresaCodigos.includes(c)) : base
  }, [permitidas, empresaCodigos])

  const mesRange = useMemo(() => {
    const [y, m] = (dataInicial || '').split('-').map(Number)
    if (!y || !m) return null
    const p = (n: number) => String(n).padStart(2, '0')
    const diasNoMes = new Date(y, m, 0).getDate()
    const now = new Date()
    const todayISO = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
    const ultimoDiaISO = `${y}-${p(m)}-${p(diasNoMes)}`
    const ehMesCorrente = now.getFullYear() === y && now.getMonth() + 1 === m
    const fim = ehMesCorrente ? (todayISO <= ultimoDiaISO ? todayISO : ultimoDiaISO) : ultimoDiaISO
    return { ini: `${y}-${p(m)}-01`, fim }
  }, [dataInicial])

  const { data: mesRows = [] } = useQuery({
    queryKey: ['proj-mes-lb', codes.join(','), mesRange?.ini, mesRange?.fim],
    queryFn: () => fetchVendasCache({ empresaCodigos: codes, dataInicial: mesRange!.ini, dataFinal: mesRange!.fim }),
    enabled: codes.length > 0 && !!mesRange,
    staleTime: 5 * 60 * 1000,
  })
  // Projeção por dia = LB + quantidade do SETOR selecionado (litros p/ combustível,
  // unidades p/ loja). O card de cima segue com os 3 setores somados.
  const dadosPorDia = useMemo(() => {
    const map = new Map<string, { lb: number; litros: number }>()
    for (const r of mesRows) {
      if (r.setor !== setorProj) continue
      const e = map.get(r.data) ?? { lb: 0, litros: 0 }
      e.lb += r.total_venda - r.total_custo
      e.litros += r.quantidade
      map.set(r.data, e)
    }
    return map
  }, [mesRows, setorProj])

  // Projeção fim do mês — SAZONAL rede-wide por MÉTRICA, MESMO método das abas
  // (Combustível/Pista/Conveniência): `projecaoSazonal` sobre a série diária do
  // setor com o índice de dia-da-semana da rede (ramo linear quando o setor tem
  // <90d de histórico). Assim o painel bate com os cards das abas.
  const projMonthEnd = fimDoMesIso(dataInicial || todayLocal())
  const projToday = todayLocal()
  const projSetor = (setorObj: typeof combustivel, setorId: 'combustivel' | 'automotivos' | 'conveniencia') => {
    const proj = (value: (d: { faturamento: number; lucroBruto: number; qtd: number }) => number, metrica: 'faturamento' | 'qtd' | 'lucro') =>
      projecaoSazonal({
        dailySeries: setorObj.daily.map((d) => ({ data: d.data, value: value(d) })),
        today: projToday,
        dataFinal: projMonthEnd,
        indices: sazonal.indice(setorId, metrica),
      }).esperado
    const faturamento = proj((d) => d.faturamento, 'faturamento')
    const lucroBruto = proj((d) => d.lucroBruto, 'lucro')
    const volume = proj((d) => d.qtd, 'qtd')
    return { volume, faturamento, lucroBruto, margem: faturamento > 0 ? (lucroBruto / faturamento) * 100 : 0 }
  }
  const projLinhas = [
    { setor: 'Combustível', ...projSetor(combustivel, 'combustivel') },
    { setor: 'Automotivos', ...projSetor(automotivos, 'automotivos') },
    { setor: 'Conveniência', ...projSetor(conveniencia, 'conveniencia') },
  ]
  const projFatTotal = projLinhas.reduce((s, r) => s + r.faturamento, 0)
  const projLucroTotal = projLinhas.reduce((s, r) => s + r.lucroBruto, 0)
  const projTotal = {
    faturamento: projFatTotal,
    lucroBruto: projLucroTotal,
    margem: projFatTotal > 0 ? (projLucroTotal / projFatTotal) * 100 : 0,
  }

  // Resumo GLOBAL da projeção (mesma linguagem dos cards das abas): confiança
  // da série consolidada + comparativo do projetado vs período anterior. Alinha
  // o painel da Central ao ProjecaoExecutiva sem redesenhar a tabela/oscilação.
  const projResumo = useMemo(() => {
    const now = new Date()
    const todayISO = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const [yy, mm] = (dataInicial || todayISO).split('-').map(Number)
    const monthEnd = `${yy}-${pad(mm)}-${pad(new Date(yy, mm, 0).getDate())}`
    // Série diária global = soma do faturamento dos 3 setores por dia.
    const byDay = new Map<string, number>()
    for (const s of [combustivel, automotivos, conveniencia])
      for (const d of s.daily) byDay.set(d.data, (byDay.get(d.data) ?? 0) + d.faturamento)
    const dailySeries = Array.from(byDay.entries()).map(([data, value]) => ({ data, value }))
    const fat = projecaoAvancada({ dailySeries, today: todayISO, dataFinal: monthEnd })
    const anterior = global.faturamentoAnoAnterior
    const cmpPct = anterior > 0 ? ((projFatTotal - anterior) / anterior) * 100 : null
    return { confiabilidade: fat.confiabilidade, confiabilidadePct: fat.confiabilidadePct, cmpPct }
  }, [combustivel, automotivos, conveniencia, global, projFatTotal, dataInicial])
  const cmpLabelLong = comparisonMode === 'prevYear' ? 'ano ant.' : 'mês ant.'
  const DOT_CONFIA = { alta: 'bg-emerald-400', media: 'bg-amber-400', baixa: 'bg-red-400' } as const
  const LABEL_CONFIA = { alta: 'Confiança alta', media: 'Confiança média', baixa: 'Confiança baixa' } as const

  /* ─── Oscilação das projeções (colunas por dia) ───
   * Cada coluna = a projeção de fechamento do mês recalculada naquele dia, com a
   * venda ACUMULADA até ali: barra(D) = acumulado(1→D) × (dias do mês ÷ D) —
   * exatamente o que a tabela daria filtrando do dia 1 até D. Só os dias com
   * realizado (1 → hoje). O topo é a projeção mais recente (último dia com dado). */
  const chart = useMemo(() => {
    const [y, m] = dataInicial.split('-').map(Number)
    const diasNoMes = new Date(y, m, 0).getDate()
    const mesLabel = MESES[m - 1] ?? ''
    const now = new Date()
    const todayISO = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const [ty, tm, td] = todayISO.split('-').map(Number)
    const ehMesCorrente = ty === y && tm === m

    // barra(D) = venda ACUMULADA até o dia D × fator(1→D). O fator vem do
    // monthEndFactor(dia1, D) = dias do mês ÷ dias decorridos (D).
    const allDays: number[] = []
    for (let d = 1; d <= diasNoMes; d++) allDays.push(d)
    const dia01 = `${y}-${pad(m)}-01`
    // Oscilação = projeção recalculada a cada dia; sazonal por SETOR (índice
    // rede-wide de LUCRO por dia-da-semana). Com índice vazio recai no monthEndFactor.
    const idxSetor = sazonal.indice(setorProj, 'lucro')
    const projByDay = new Map<number, number>()
    let acumulado = 0
    for (const d of allDays) {
      const iso = `${y}-${pad(m)}-${pad(d)}`
      const dados = dadosPorDia.get(iso)
      if (!dados) continue // dia sem realizado (futuro / sem venda) → sem coluna
      acumulado += dados.lb
      projByDay.set(d, acumulado * weekdayMonthEndFactor(dia01, iso, idxSetor))
    }
    const diasComDado = allDays.filter((d) => projByDay.has(d))
    const ultimoDado = diasComDado.length ? diasComDado[diasComDado.length - 1] : -1
    // Destaque no último dia COM dado (a projeção mais recente) — evita rótulo
    // "hoje" solto quando o cache ainda não tem o dia corrente (parcial).
    const hojeDia = ultimoDado
    const isToday = ehMesCorrente && td === ultimoDado
    const hasDaily = diasComDado.length > 0
    // Projeção mais recente (último dia com dado) — o "fim do mês" atual.
    const projEnd = ultimoDado > 0 ? (projByDay.get(ultimoDado) ?? 0) : 0

    // Dias apurados = projeção recalculada; dias FUTUROS (após o último apurado)
    // = a projeção atual MANTIDA até o fim do mês (estimativa, sem dado real ainda).
    const projDaily = allDays
      .filter((d) => projByDay.has(d) || (ultimoDado > 0 && d > ultimoDado))
      .map((d) => projByDay.has(d)
        ? { d, v: projByDay.get(d) ?? 0, futuro: false }
        : { d, v: projEnd, futuro: true })
    const maxDaily = projDaily.reduce((mx, p) => Math.max(mx, p.v), 0)

    // Geometria SVG (viewBox 0 0 1000 330).
    const x0 = 60, x1 = 980, yTop = 30, yBase = 280
    const slot = (x1 - x0) / diasNoMes
    const barW = slot * 0.6
    const Xleft = (d: number) => x0 + (d - 1) * slot + (slot - barW) / 2
    const Xcenter = (d: number) => x0 + (d - 1) * slot + slot / 2
    const maxY = niceCeil(maxDaily * 1.12)
    const Y = (v: number) => yBase - (v / maxY) * (yBase - yTop)

    const bars = projDaily.map((p) => ({ d: p.d, v: p.v, futuro: p.futuro, x: Xleft(p.d), w: barW, y: Y(p.v), h: yBase - Y(p.v), isHoje: p.d === hojeDia }))

    const tickLabel = (v: number) => v === 0 ? '0' : v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2).replace('.', ',')} mi` : `${Math.round(v / 1000)}k`
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((fr) => { const v = maxY * fr; return { y: Y(v), label: tickLabel(v) } })
    const xDays = Array.from(new Set([1, 5, 10, 15, 20, 25, hojeDia, diasNoMes].filter((d) => d >= 1 && d <= diasNoMes))).sort((a, b) => a - b)
    const xTicks = xDays.map((d) => ({ x: Xcenter(d), label: d === hojeDia ? (isToday ? 'hoje' : 'atual') : String(d), isHoje: d === hojeDia }))

    // Linhas da tabela (mesmas colunas do Excel): só dias com realizado.
    const DOW = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
    let projAnterior: number | null = null
    let totLitros = 0, totLB = 0
    const linhas = diasComDado.map((d) => {
      const iso = `${y}-${pad(m)}-${pad(d)}`
      const dados = dadosPorDia.get(iso) ?? { lb: 0, litros: 0 }
      const projecao = projByDay.get(d) ?? 0
      const variacao = projAnterior == null ? null : projecao - projAnterior
      projAnterior = projecao
      totLitros += dados.litros; totLB += dados.lb
      return { dia: d, dataBR: `${pad(d)}/${pad(m)}/${y}`, diaSemana: DOW[new Date(y, m - 1, d).getDay()], litros: dados.litros, lb: dados.lb, projecao, variacao }
    })
    const totais = { litros: totLitros, lb: totLB, projecao: projEnd }
    const varByDia = new Map(linhas.map((l) => [l.dia, l.variacao]))
    const dowByDia = new Map(allDays.map((d) => [d, DOW[new Date(y, m - 1, d).getDay()]]))

    return {
      projEnd, diasNoMes, hojeDia, isToday, mesLabel, hasDaily,
      x0, slot, bars, projDaily, Xcenter, Y, yTicks, xTicks,
      linhas, totais, varByDia, dowByDia,
    }
  }, [dataInicial, dadosPorDia, sazonal, setorProj])

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (!rect.width) return
    const svgX = ((e.clientX - rect.left) / rect.width) * 1000
    let d = Math.floor((svgX - chart.x0) / chart.slot) + 1
    d = Math.max(1, Math.min(chart.diasNoMes, d))
    if (d !== hoverDay) setHoverDay(d)
  }
  const onLeave = () => { if (hoverDay !== null) setHoverDay(null) }

  const hover = (() => {
    if (hoverDay == null) return null
    const p = chart.projDaily.find((x) => x.d === hoverDay)
    if (!p) return null
    const sx = chart.Xcenter(hoverDay), sy = chart.Y(p.v)
    const flip = hoverDay >= chart.diasNoMes - 5 ? '-90%' : hoverDay <= 3 ? '-10%' : '-50%'
    return {
      sx, sy,
      leftPct: `${(sx / 1000 * 100).toFixed(2)}%`, topPct: `${(sy / 330 * 100).toFixed(2)}%`,
      transform: `translate(${flip}, calc(-100% - 14px))`,
      date: `${hoverDay} ${chart.mesLabel} · ${chart.dowByDia.get(hoverDay) ?? ''}${hoverDay === chart.hojeDia && chart.isToday ? ' · hoje' : ''}`,
      projValue: formatCurrencyInt(p.v),
      futuro: p.futuro,
      variacao: p.futuro ? null : (chart.varByDia.get(hoverDay) ?? null),
    }
  })()

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
      {!expanded && (
        <div className="flex flex-col md:col-span-2 xl:col-span-4">
          {/* Chave (estilo "legend") abraça SÓ os cartões de realizado — a Projeção
              fica de fora. */}
          <RealizadoChave />
          {/* flex-1 + auto-rows-fr: no desktop os cartões esticam pra o rodapé deles
              alinhar com o rodapé do cartão de Projeção (mais alto). */}
          <div className="grid flex-1 auto-rows-fr grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SegmentCard
            label="Combustível" Icon={Droplets} cardBg="bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900"
            iconBg="bg-blue-100 dark:bg-blue-900/30" iconColor="text-blue-600 dark:text-blue-400"
            loading={isLoading} lucroBruto={combustivel.lucroBruto}
            lucroBrutoAnterior={combustivel.lucroBrutoAnoAnterior} cmpLabel={cmpLabel} cmpTitle={cmpTitle}
            primary={{ label: 'Margem', value: fmtPct(combustivel.margem) }}
            secondary={{ label: 'L. bruto / litro', value: formatCurrency(combustivel.lucroPorUnidade) }}
          />
          <SegmentCard
            label="Automotivos" Icon={Wrench} cardBg="bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900"
            iconBg="bg-amber-100 dark:bg-amber-900/30" iconColor="text-amber-600 dark:text-amber-400"
            loading={isLoading} lucroBruto={automotivos.lucroBruto}
            lucroBrutoAnterior={automotivos.lucroBrutoAnoAnterior} cmpLabel={cmpLabel} cmpTitle={cmpTitle}
            primary={{ label: 'Faturamento', value: formatCurrencyInt(automotivos.faturamento) }}
            secondary={{ label: 'Margem', value: fmtPct(automotivos.margem) }}
          />
          <SegmentCard
            label="Conveniência" Icon={Store} cardBg="bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900"
            iconBg="bg-emerald-100 dark:bg-emerald-900/30" iconColor="text-emerald-600 dark:text-emerald-400"
            loading={isLoading} lucroBruto={conveniencia.lucroBruto}
            lucroBrutoAnterior={conveniencia.lucroBrutoAnoAnterior} cmpLabel={cmpLabel} cmpTitle={cmpTitle}
            primary={{ label: 'Faturamento', value: formatCurrencyInt(conveniencia.faturamento) }}
            secondary={{ label: 'Margem', value: fmtPct(conveniencia.margem) }}
          />
          <SegmentCard
            label="Global" Icon={Globe} cardBg="bg-gradient-to-br from-violet-50/60 to-white dark:from-violet-950/20 dark:to-gray-900"
            iconBg="bg-violet-100 dark:bg-violet-900/30" iconColor="text-violet-600 dark:text-violet-400"
            loading={isLoading} lucroBruto={global.lucroBruto}
            lucroBrutoAnterior={global.lucroBrutoAnoAnterior} cmpLabel={cmpLabel} cmpTitle={cmpTitle}
            primary={{ label: 'Faturamento', value: formatCurrencyInt(global.faturamento) }}
            secondary={{ label: 'Margem', value: fmtPct(global.margem) }}
          />
          </div>
        </div>
      )}

      {/* Painel Projeção (navy) — col-span-2 (fechado) → col-span total (aberto). */}
      <div className={cn(
        'flex min-w-0 flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#27496f] shadow-lg',
        expanded ? 'md:col-span-2 xl:col-span-6' : 'md:col-span-2 xl:col-span-2',
      )}>
        <div className="flex items-start justify-between gap-2.5 px-5 pb-3.5 pt-[18px]">
          <div>
            <p className="inline-flex flex-wrap items-center gap-1.5 text-[15px] font-bold text-white">
              <span
                className={cn('h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_0_3px_rgba(255,255,255,0.14)]', DOT_CONFIA[projResumo.confiabilidade])}
                title={`${LABEL_CONFIA[projResumo.confiabilidade]} · ${projResumo.confiabilidadePct}%`}
              />
              Projeção
              <InfoHint
                text={PROJECAO_TOOLTIP_SAZONAL}
                className="text-white/60 hover:text-white dark:text-white/60 dark:hover:text-white"
              />
              {projResumo.cmpPct !== null && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                    projResumo.cmpPct >= 0 ? 'bg-emerald-400/20 text-emerald-100' : 'bg-red-400/20 text-red-100',
                  )}
                  title={`Projeção da rede vs fechamento do ${cmpLabelLong} (${formatCurrencyInt(global.faturamentoAnoAnterior)})`}
                >
                  {projResumo.cmpPct >= 0 ? '▲' : '▼'} {projResumo.cmpPct >= 0 ? '+' : ''}{projResumo.cmpPct.toFixed(1).replace('.', ',')}% vs {cmpLabelLong}
                </span>
              )}
            </p>
            <p className="mt-0.5 text-[11px] text-white/60">{expanded ? `Projeção do lucro bruto de ${setorLabel} — por dia` : 'Fim do mês'}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {expanded && (
              <div className="inline-flex items-center rounded-lg border border-white/15 bg-white/[0.06] p-0.5">
                {([['combustivel', 'Combustível', Droplets], ['automotivos', 'Automotivos', Wrench], ['conveniencia', 'Conveniência', Store]] as const).map(([id, label, Icon]) => (
                  <button key={id} type="button" onClick={() => setSetorProj(id)}
                    className={cn('inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11px] font-medium transition-colors', setorProj === id ? 'bg-[#34d399]/20 text-[#6ee7b7]' : 'text-white/60 hover:text-white')}>
                    <Icon className="h-3.5 w-3.5" />{label}
                  </button>
                ))}
              </div>
            )}
            {expanded && (
              <div className="inline-flex items-center rounded-lg border border-white/15 bg-white/[0.06] p-0.5">
                <button type="button" onClick={() => setProjView('grafico')}
                  className={cn('inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11px] font-medium transition-colors', projView === 'grafico' ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white')}>
                  <BarChart3 className="h-3.5 w-3.5" />Gráfico
                </button>
                <button type="button" onClick={() => setProjView('tabela')}
                  className={cn('inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11px] font-medium transition-colors', projView === 'tabela' ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white')}>
                  <Table2 className="h-3.5 w-3.5" />Tabela
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabela (fechado) */}
        {!expanded && (
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-white/15 text-left text-white/55">
                <th className="px-5 py-1 font-semibold uppercase tracking-wide">Setor</th>
                <th className="py-1 text-right font-semibold uppercase tracking-wide">Litros/Qtde</th>
                <th className="py-1 text-right font-semibold uppercase tracking-wide">Faturamento</th>
                <th className="py-1 text-right font-semibold uppercase tracking-wide">Lucro bruto</th>
                <th className="px-5 py-1 text-right font-semibold uppercase tracking-wide">Margem</th>
              </tr>
            </thead>
            <tbody className="text-white/90">
              {projLinhas.map((r) => (
                <tr key={r.setor} className="border-b border-white/10">
                  <td className="px-5 py-2.5">{r.setor}</td>
                  <td className="py-2.5 text-right tabular-nums">{formatNumber(Math.round(r.volume))}</td>
                  <td className="py-2.5 text-right tabular-nums">{formatCurrencyInt(r.faturamento)}</td>
                  <td className="py-2.5 text-right tabular-nums">{formatCurrencyInt(r.lucroBruto)}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{fmtPct(r.margem)}</td>
                </tr>
              ))}
              <tr className="font-bold text-white">
                <td className="px-5 pt-2.5">Total</td>
                <td className="pt-2.5 text-right tabular-nums text-white/50">—</td>
                <td className="pt-2.5 text-right tabular-nums">{formatCurrencyInt(projTotal.faturamento)}</td>
                <td className="pt-2.5 text-right tabular-nums">{formatCurrencyInt(projTotal.lucroBruto)}</td>
                <td className="px-5 pt-2.5 text-right tabular-nums">{fmtPct(projTotal.margem)}</td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Régua (aberto) */}
        {expanded && (
          <div className="px-[22px] pb-5 pt-1" style={{ animation: 'chartIn .5s cubic-bezier(.4,0,.2,1) both' }}>
            <div className="mb-1.5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/55">Projeção · {setorLabel} · fim do mês</p>
                <p className="mt-0.5 text-[22px] font-extrabold tabular-nums text-[#6ee7b7]">{formatCurrencyInt(chart.projEnd)}</p>
              </div>
              {projView === 'grafico' && (
                <div className="flex items-center gap-3.5">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-white/75"><span className="h-2.5 w-2.5 rounded-sm bg-[#34d399]" />Projeção no dia</span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-white/75">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#94a3b8] opacity-40" />
                    Estimada (futuro)
                    <InfoHint
                      text="Os dias que ainda não chegaram não têm venda pra recalcular a projeção. Então repetimos a última projeção até o fim do mês — é só uma estimativa (por isso as barras ficam apagadas). Ela muda quando entrar o resultado real de cada dia."
                      className="text-white/60 hover:text-white dark:text-white/60 dark:hover:text-white"
                    />
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-white/75"><span className="h-2.5 w-2.5 rounded-sm bg-[#6ee7b7]" />Mais recente</span>
                </div>
              )}
            </div>

            {projView === 'grafico' ? (
            <>
            <div className="relative" onMouseMove={onMove} onMouseLeave={onLeave}>
              <svg viewBox="0 0 1000 330" preserveAspectRatio="none" className="block h-[300px] w-full">
                {chart.yTicks.map((t, i) => (
                  <line key={`y${i}`} x1="60" y1={t.y} x2="980" y2={t.y} stroke="rgba(255,255,255,.1)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                ))}
                {chart.bars.map((b) => {
                  // Futuro = cor apagada (estimativa); apurado = verde cheio.
                  const op = b.futuro ? 0.16 : (hoverDay == null || hoverDay === b.d ? (b.isHoje ? 1 : 0.85) : 0.35)
                  return (
                    <rect
                      key={b.d}
                      x={b.x} y={b.y} width={b.w} height={Math.max(0, b.h)}
                      fill={b.futuro ? '#94a3b8' : b.isHoje ? '#6ee7b7' : '#34d399'}
                      opacity={op}
                    />
                  )
                })}
              </svg>
              {/* Rótulos de eixo em HTML (fora do SVG preserveAspectRatio=none,
                  que distorceria o texto). */}
              {chart.yTicks.map((t, i) => (
                <span key={`yl${i}`} className="pointer-events-none absolute text-[11px] tabular-nums text-white/45" style={{ top: `${(t.y / 330) * 100}%`, left: 0, width: '5%', textAlign: 'right', paddingRight: 6, transform: 'translateY(-50%)' }}>{t.label}</span>
              ))}
              {chart.xTicks.map((t, i) => (
                <span key={`xl${i}`} className={cn('pointer-events-none absolute text-[11px] tabular-nums', t.isHoje ? 'font-bold text-[#6ee7b7]' : 'text-white/45')} style={{ left: `${(t.x / 1000) * 100}%`, top: `${(322 / 330) * 100}%`, transform: 'translate(-50%, -50%)' }}>{t.label}</span>
              ))}
              {hover && (
                <div
                  className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg bg-white px-3 py-2 shadow-xl"
                  style={{ left: hover.leftPct, top: hover.topPct, transform: hover.transform }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{hover.date}</p>
                  <div className="mt-1.5 flex items-center justify-between gap-4">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600"><span className={cn('h-1.5 w-1.5 rounded-full bg-[#34d399]', hover.futuro && 'opacity-40')} />{hover.futuro ? 'Projeção estimada' : 'Projeção no dia'}</span>
                    <span className="text-[13px] font-extrabold tabular-nums text-gray-900">{hover.projValue}</span>
                  </div>
                  {hover.variacao != null && (
                    <div className="mt-1 flex items-center justify-between gap-4 border-t border-gray-100 pt-1">
                      <span className="text-[10px] font-semibold text-gray-400">vs dia anterior</span>
                      <span className={cn('text-[12px] font-bold tabular-nums', hover.variacao < 0 ? 'text-red-600' : 'text-emerald-600')}>
                        {hover.variacao < 0 ? '−' : '+'}{formatCurrencyInt(Math.abs(hover.variacao))}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <p className="mt-2 text-[10.5px] leading-snug text-white/45">
              <strong className="font-semibold text-white/60">Cada coluna</strong> = a projeção de fechamento do mês recalculada naquele dia (venda acumulada até o dia, extrapolada ao fim do mês pelo índice sazonal de dia-da-semana do setor). Mostra como a projeção oscilou ao longo do mês. Colunas translúcidas = dias futuros, com a projeção mais recente mantida até o fim do mês.
              {!chart.hasDaily && ' · sem série diária do mês no cache.'}
            </p>
            </>
            ) : (
            <div className="mt-2 overflow-hidden rounded-lg border border-white/10" style={{ animation: 'chartIn .35s cubic-bezier(.4,0,.2,1) both' }}>
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 z-10 bg-[#22456b]">
                  <tr className="text-left text-white/55">
                    <th className="px-3 py-2 font-semibold uppercase tracking-wide">
                      <span className="inline-flex items-center gap-1">Data<InfoHint text="Dia do mês, dentro do período filtrado. Só aparecem os dias já realizados." className="text-white/40 hover:text-white/75 dark:text-white/40 dark:hover:text-white/75" /></span>
                    </th>
                    <th className="px-3 py-2 font-semibold uppercase tracking-wide">
                      <span className="inline-flex items-center gap-1">Dia da semana<InfoHint text="Dia da semana correspondente à data — útil pra ver o padrão (dia útil × fim de semana)." className="text-white/40 hover:text-white/75 dark:text-white/40 dark:hover:text-white/75" /></span>
                    </th>
                    <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide">
                      <span className="inline-flex items-center justify-end gap-1">{unidadeLabel}<InfoHint text={setorProj === 'combustivel' ? 'Litros de combustível vendidos no dia.' : 'Quantidade de itens vendidos no dia.'} className="text-white/40 hover:text-white/75 dark:text-white/40 dark:hover:text-white/75" /></span>
                    </th>
                    <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide">
                      <span className="inline-flex items-center justify-end gap-1">Lucro bruto<InfoHint text="Lucro bruto do dia do setor selecionado (faturamento − custo). Base da projeção." className="text-white/40 hover:text-white/75 dark:text-white/40 dark:hover:text-white/75" /></span>
                    </th>
                    <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide">
                      <span className="inline-flex items-center justify-end gap-1">Projeção de fechamento<InfoHint text="Projeção do LB do setor pro fim do mês recalculada neste dia, com a venda acumulada até aqui extrapolada pelo índice sazonal de dia-da-semana (ramo linear quando o setor tem <90d de histórico)." className="text-white/40 hover:text-white/75 dark:text-white/40 dark:hover:text-white/75" /></span>
                    </th>
                    <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide">
                      <span className="inline-flex items-center justify-end gap-1">Variação vs dia anterior<InfoHint text="Diferença entre a projeção deste dia e a do dia anterior. Positivo (verde) = a projeção subiu; negativo (vermelho) = caiu." className="text-white/40 hover:text-white/75 dark:text-white/40 dark:hover:text-white/75" /></span>
                    </th>
                  </tr>
                </thead>
                <tbody className="text-white/90">
                  {chart.linhas.map((l) => (
                    <tr key={l.dia}
                      onClick={() => setSelDia((c) => (c === l.dia ? null : l.dia))}
                      className={cn('cursor-pointer border-t border-white/5 transition-colors',
                        selDia === l.dia ? 'bg-amber-400/25 hover:bg-amber-400/30' : 'hover:bg-white/5')}>
                      <td className="px-3 py-1.5 tabular-nums">{l.dataBR}</td>
                      <td className="px-3 py-1.5 text-white/70">{l.diaSemana}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(Math.round(l.litros))}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(l.lb)}</td>
                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-[#6ee7b7]">{formatCurrency(l.projecao)}</td>
                      <td className={cn('px-3 py-1.5 text-right tabular-nums', l.variacao == null ? 'text-white/40' : l.variacao < 0 ? 'text-red-300' : 'text-emerald-300')}>
                        {l.variacao == null ? '—' : `${l.variacao < 0 ? '−' : '+'}${formatCurrency(Math.abs(l.variacao))}`}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-white/20 bg-white/[0.04] font-bold text-white">
                    <td className="px-3 py-2" colSpan={2}>Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(Math.round(chart.totais.litros))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(chart.totais.lb)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#6ee7b7]">{formatCurrency(chart.totais.projecao)}</td>
                    <td className="px-3 py-2" />
                  </tr>
                </tbody>
              </table>
            </div>
            )}
          </div>
        )}

        {/* Sem botão de rodapé — o toggle fica na pílula do topo. */}
        {!expanded && <div className="pb-4" />}
      </div>
    </div>
    </div>
  )
}

export default ProjecoesPainel
