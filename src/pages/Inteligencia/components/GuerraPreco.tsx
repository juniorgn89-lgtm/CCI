import { useMemo, useState, type ReactNode } from 'react'
import {
  Info, TrendingDown, TrendingUp, Minus, Radar, Calculator, Fuel, ShieldCheck,
  ShieldAlert, ShieldX, Gauge, AlertTriangle, Activity, Droplets, Target, Zap,
  Lightbulb, ChevronDown, ChevronUp, CircleDollarSign, Flame,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, ComposedChart, Bar, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, Cell,
} from 'recharts'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatLiters, formatNumber } from '@/lib/formatters'
import { projecaoAvancada } from '@/lib/projection'
import InfoHint from '@/components/ui/InfoHint'
import type { AbastecimentoRow, FuelTypeRow } from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'

interface GuerraPrecoProps {
  /** Abastecimentos brutos (já filtrados pelo período/posto) — fonte da série diária. */
  rows: AbastecimentoRow[]
  /** Combustíveis do período (pra montar o seletor, ordenado por volume). */
  fuelTypes: FuelTypeRow[]
  /** Data inicial do período (ISO) — define o mês a projetar até o fechamento. */
  dataInicial?: string
}

/* ─── Referências de saúde de margem (heurística de varejo de combustível) ───
 * Ajustáveis. Margem bruta % do litro; abaixo do piso a operação não se sustenta. */
const MARGEM_SAUDAVEL = 8 // %
const MARGEM_ATENCAO = 5 // %

const WEEKDAY = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const fmtBR = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '—')
const weekdayOf = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return ''
  return WEEKDAY[new Date(y, m - 1, d).getDay()]
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const pctLabel = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2).replace('.', ',')}%`
const pct1 = (v: number) => `${(v * 100).toFixed(2).replace('.', ',')}%`
const moneyL = (v: number) => `R$ ${v.toFixed(3).replace('.', ',')}` // preço por litro (3 casas)
const moneyLraw = (v: number) => v.toFixed(3).replace('.', ',')

/* ─── Paleta de tons (status / risco) ─── */
type Tone = 'emerald' | 'amber' | 'red' | 'blue' | 'slate'
const TONE: Record<Tone, { pill: string; dot: string; text: string; grad: string; glow: string; bar: string; hex: string }> = {
  emerald: {
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
    dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400',
    grad: 'from-emerald-500/15 to-transparent', glow: 'shadow-emerald-500/20', bar: 'bg-emerald-500', hex: '#10b981',
  },
  amber: {
    pill: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
    dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400',
    grad: 'from-amber-500/15 to-transparent', glow: 'shadow-amber-500/20', bar: 'bg-amber-500', hex: '#f59e0b',
  },
  red: {
    pill: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30',
    dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400',
    grad: 'from-red-500/15 to-transparent', glow: 'shadow-red-500/20', bar: 'bg-red-500', hex: '#ef4444',
  },
  blue: {
    pill: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30',
    dot: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400',
    grad: 'from-blue-500/15 to-transparent', glow: 'shadow-blue-500/20', bar: 'bg-blue-500', hex: '#3b82f6',
  },
  slate: {
    pill: 'bg-gray-100 text-gray-600 ring-gray-200 dark:bg-gray-700/40 dark:text-gray-300 dark:ring-gray-600/40',
    dot: 'bg-gray-400', text: 'text-gray-500 dark:text-gray-400',
    grad: 'from-gray-400/10 to-transparent', glow: 'shadow-black/10', bar: 'bg-gray-400', hex: '#94a3b8',
  },
}

/**
 * Tela "Radar de Preços · Guerra de Preço" — centro de inteligência de preço de
 * combustível. Trabalha com os DADOS DA PRÓPRIA REDE (sem integração com
 * concorrentes): evolução de preço × custo × margem por litro, simulador de
 * elasticidade, cenários estratégicos e um veredito de viabilidade da redução.
 */
const GuerraPreco = ({ rows, fuelTypes, dataInicial }: GuerraPrecoProps) => {
  const fuelsByVolume = useMemo(
    () => [...fuelTypes].filter((f) => f.litros > 0).sort((a, b) => b.litros - a.litros),
    [fuelTypes],
  )
  const [fuelSel, setFuelSel] = useState<string | null>(null)
  const selectedFuel = fuelSel ?? fuelsByVolume[0]?.nome ?? ''
  const [reducao, setReducao] = useState(0.1)
  const [showTabela, setShowTabela] = useState(false)

  // Série diária do combustível selecionado. Custo = faturamento − lucro bruto
  // (robusto, independe da unidade do preço de custo na row).
  const serie = useMemo(() => {
    const byDay = new Map<string, { litros: number; fat: number; lucro: number }>()
    for (const r of rows) {
      if (r.combustivelNome !== selectedFuel) continue
      const day = (r.dataHora || '').substring(0, 10)
      if (day.length !== 10) continue
      const prev = byDay.get(day) ?? { litros: 0, fat: 0, lucro: 0 }
      prev.litros += r.litros
      prev.fat += r.valorTotal
      prev.lucro += r.lucroBruto
      byDay.set(day, prev)
    }
    return Array.from(byDay.entries())
      .map(([data, v]) => {
        const custo = v.fat - v.lucro
        return {
          data,
          litros: v.litros,
          fat: v.fat,
          lucro: v.lucro,
          precoVenda: v.litros > 0 ? v.fat / v.litros : 0,
          precoCusto: v.litros > 0 ? custo / v.litros : 0,
          lbLitro: v.litros > 0 ? v.lucro / v.litros : 0,
          margem: v.fat > 0 ? (v.lucro / v.fat) * 100 : 0,
        }
      })
      .sort((a, b) => a.data.localeCompare(b.data))
  }, [rows, selectedFuel])

  const agg = useMemo(() => {
    const totLitros = serie.reduce((s, d) => s + d.litros, 0)
    const totFat = serie.reduce((s, d) => s + d.fat, 0)
    const totLucro = serie.reduce((s, d) => s + d.lucro, 0)
    const dias = serie.length
    return {
      totLitros, totLucro, dias,
      precoVendaMedio: totLitros > 0 ? totFat / totLitros : 0,
      precoCustoMedio: totLitros > 0 ? (totFat - totLucro) / totLitros : 0,
      lbLitro: totLitros > 0 ? totLucro / totLitros : 0,
      margem: totFat > 0 ? (totLucro / totFat) * 100 : 0,
      litrosDia: dias > 0 ? totLitros / dias : 0,
    }
  }, [serie])

  /* ─── Projeção até o FECHAMENTO DO MÊS ───
   * Mesma metodologia dos cards de Combustível (projecaoAvancada): realizado dos
   * dias fechados + projeção dos dias que faltam até o fim do mês. Separa o que já
   * aconteceu (não muda) do que ainda vai vender (onde o corte de preço age). */
  const proj = useMemo(() => {
    const now = new Date()
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const base = dataInicial || serie[0]?.data || todayISO
    const [yy, mm] = base.split('-').map(Number)
    const lastDay = new Date(yy, mm, 0).getDate()
    const monthEnd = `${yy}-${String(mm).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    const fatP = projecaoAvancada({ dailySeries: serie.map((d) => ({ data: d.data, value: d.fat })), today: todayISO, dataFinal: monthEnd })
    const litrosP = projecaoAvancada({ dailySeries: serie.map((d) => ({ data: d.data, value: d.litros })), today: todayISO, dataFinal: monthEnd })
    const lucroP = projecaoAvancada({ dailySeries: serie.map((d) => ({ data: d.data, value: d.lucro })), today: todayISO, dataFinal: monthEnd })
    const litrosRest = litrosP.esperado - litrosP.realizado
    const fatRest = fatP.esperado - fatP.realizado
    const lucroRest = lucroP.esperado - lucroP.realizado
    return {
      isProjetada: fatP.diasRestantes > 0,
      diasFechados: fatP.diasFechados,
      diasRestantes: fatP.diasRestantes,
      monthEnd,
      mediaLitrosDia: litrosP.mediaDiaria,
      // Baseline projetado (sem alteração de preço)
      fat: fatP.esperado, litros: litrosP.esperado, lucro: lucroP.esperado,
      margem: fatP.esperado > 0 ? (lucroP.esperado / fatP.esperado) * 100 : 0,
      // Já realizado (não muda com o corte)
      fatReal: fatP.realizado, litrosReal: litrosP.realizado, lucroReal: lucroP.realizado,
      // O que falta vender — onde o corte age. Preço/L.B. médios dos dias futuros.
      litrosRest, fatRest, lucroRest,
      precoRest: litrosRest > 0 ? fatRest / litrosRest : agg.precoVendaMedio,
      lbRest: litrosRest > 0 ? lucroRest / litrosRest : agg.lbLitro,
    }
  }, [serie, dataInicial, agg])

  // Horizonte da simulação: futuro (até o fechamento) quando há dias restantes;
  // senão, retrospectivo sobre o período fechado.
  const horizonte = proj.isProjetada
    ? {
        label: 'até o fechamento do mês',
        labelShort: 'até o fechamento',
        volVar: proj.litrosRest, preco: proj.precoRest, lb: proj.lbRest,
        fix: { fat: proj.fatReal, litros: proj.litrosReal, lucro: proj.lucroReal },
      }
    : {
        label: 'no período',
        labelShort: 'no período',
        volVar: agg.totLitros, preco: agg.precoVendaMedio, lb: agg.lbLitro,
        fix: { fat: 0, litros: 0, lucro: 0 },
      }

  // Projeta um cenário de fechamento: corte `r` (R$/L, aplicado só no que falta
  // vender) e crescimento de volume `g` (fração) sobre os dias futuros.
  const cenarioProj = useMemo(() => {
    return (r: number, g: number) => {
      const vol = horizonte.volVar * (1 + g)
      const fatVar = (horizonte.preco - r) * vol
      const lucroVar = (horizonte.lb - r) * vol
      const fat = horizonte.fix.fat + fatVar
      const litros = horizonte.fix.litros + vol
      const lucro = horizonte.fix.lucro + lucroVar
      return { fat, litros, lucro, margem: fat > 0 ? (lucro / fat) * 100 : 0 }
    }
  }, [horizonte])

  // Comparação semana atual × semana anterior (janelas de até 7 dias, ponderadas).
  const wow = useMemo(() => {
    const n = serie.length
    const w = Math.min(7, Math.floor(n / 2)) || 1
    const windowAgg = (arr: typeof serie) => {
      const litros = arr.reduce((s, d) => s + d.litros, 0)
      const fat = arr.reduce((s, d) => s + d.fat, 0)
      const lucro = arr.reduce((s, d) => s + d.lucro, 0)
      return {
        precoVenda: litros > 0 ? fat / litros : 0,
        precoCusto: litros > 0 ? (fat - lucro) / litros : 0,
        lbLitro: litros > 0 ? lucro / litros : 0,
        litrosDia: arr.length > 0 ? litros / arr.length : 0,
      }
    }
    const last = windowAgg(serie.slice(n - w))
    const prevArr = serie.slice(Math.max(0, n - 2 * w), n - w)
    const prev = windowAgg(prevArr)
    const d = (x: number, y: number) => (y > 0 ? x / y - 1 : 0)
    return {
      hasPrev: prevArr.length > 0,
      last,
      precoDelta: d(last.precoVenda, prev.precoVenda),
      custoDelta: d(last.precoCusto, prev.precoCusto),
      lbDelta: prev.lbLitro !== 0 ? last.lbLitro / prev.lbLitro - 1 : 0,
      volDelta: d(last.litrosDia, prev.litrosDia),
    }
  }, [serie])

  // Cortes de preço: dias em que o preço de venda caiu vs o dia anterior.
  const cortes = useMemo(() => {
    const out: { data: string; queda: number; novoPreco: number; varLitros: number; varLb: number }[] = []
    for (let i = 1; i < serie.length; i++) {
      const cur = serie[i]
      const prev = serie[i - 1]
      const queda = cur.precoVenda - prev.precoVenda
      if (queda < -0.005) {
        out.push({
          data: cur.data,
          queda,
          novoPreco: cur.precoVenda,
          varLitros: prev.litros > 0 ? cur.litros / prev.litros - 1 : 0,
          varLb: prev.lbLitro !== 0 ? cur.lbLitro / prev.lbLitro - 1 : 0,
        })
      }
    }
    return out.sort((a, b) => b.data.localeCompare(a.data))
  }, [serie])

  // Elasticidade observada: % de crescimento de volume por R$1 de corte,
  // medido nos cortes históricos (ponderado pela magnitude do corte).
  const elasticidade = useMemo(() => {
    let num = 0
    let den = 0
    for (const c of cortes) {
      const cut = -c.queda
      if (cut <= 0.005) continue
      num += c.varLitros
      den += cut
    }
    return den > 0 ? num / den : null // varLitros por R$1 de corte
  }, [cortes])

  // Saúde da margem atual.
  const margemTone: Tone = agg.margem >= MARGEM_SAUDAVEL ? 'emerald' : agg.margem >= MARGEM_ATENCAO ? 'amber' : 'red'
  // L.B./litro mínimo sustentável = preço médio × piso de margem (%).
  const lbMinSustentavel = agg.precoVendaMedio * (MARGEM_ATENCAO / 100)

  // Competitividade — proxy interno honesto: preço recente vs. média do período.
  const compRatio = agg.precoVendaMedio > 0 ? wow.last.precoVenda / agg.precoVendaMedio - 1 : 0
  const compTone: Tone = compRatio < -0.004 ? 'emerald' : compRatio > 0.004 ? 'red' : 'amber'
  const compLabel = compTone === 'emerald' ? 'Competitivo' : compTone === 'red' ? 'Acima da média' : 'Na média'

  // Simulador (dirigido pelo slider) — agora projeta até o fechamento do mês.
  const sim = useMemo(() => {
    const lbAtual = agg.lbLitro
    const novoLb = lbAtual - reducao
    const belowBreakeven = novoLb <= 0
    const novoPreco = agg.precoVendaMedio - reducao
    const breakEvenGrowth = belowBreakeven ? Infinity : lbAtual / novoLb - 1
    const expGrowth = elasticidade != null ? Math.max(0, elasticidade * reducao) : null
    const margemFinal = novoPreco > 0 ? (novoLb / novoPreco) * 100 : 0
    // 3 projeções de fechamento:
    const baseline = cenarioProj(0, 0) // 1) sem alteração de preço
    const semReacao = cenarioProj(reducao, 0) // 2) com corte, sem reação de volume
    const comElasticidade = expGrowth != null ? cenarioProj(reducao, expGrowth) : null // 3) com elasticidade
    return {
      lbAtual, novoLb, belowBreakeven, novoPreco, breakEvenGrowth, expGrowth, margemFinal,
      baseline, semReacao, comElasticidade,
    }
  }, [agg, reducao, elasticidade, cenarioProj])

  // Cenários automáticos (cortes-padrão). Inviável = abaixo do break-even.
  const cenarios = useMemo(() => {
    const presets: { id: string; nome: string; tone: Tone; cut: number }[] = [
      { id: 'cons', nome: 'Conservador', tone: 'emerald', cut: 0.05 },
      { id: 'esp', nome: 'Esperado', tone: 'amber', cut: 0.1 },
      { id: 'agr', nome: 'Agressivo', tone: 'blue', cut: 0.15 },
    ]
    return presets.map((p) => {
      const novoLb = agg.lbLitro - p.cut
      const novoPreco = agg.precoVendaMedio - p.cut
      const viavel = novoLb > 0
      const breakEvenGrowth = viavel ? agg.lbLitro / novoLb - 1 : Infinity
      const expGrowth = elasticidade != null ? Math.max(0, elasticidade * p.cut) : null
      // Projeção de fechamento com a elasticidade estimada (ou sem reação se não há histórico).
      const fechamento = cenarioProj(p.cut, expGrowth ?? 0)
      const lucroDelta = proj.lucro > 0 ? fechamento.lucro / proj.lucro - 1 : 0
      const risco: Tone = !viavel ? 'red' : breakEvenGrowth > 0.2 ? 'red' : breakEvenGrowth > 0.1 ? 'amber' : 'emerald'
      const riscoLabel = !viavel ? 'Inviável' : risco === 'red' ? 'Alto' : risco === 'amber' ? 'Moderado' : 'Baixo'
      return { ...p, novoLb, novoPreco, viavel, breakEvenGrowth, expGrowth, fechamento, lucroDelta, risco, riscoLabel }
    })
  }, [agg, elasticidade, cenarioProj, proj.lucro])

  // Curva de elasticidade — corte (R$/L) × crescimento de volume necessário (%).
  const elasticData = useMemo(() => {
    const cuts = [0.03, 0.05, 0.08, 0.1, 0.13, 0.15, 0.2]
    return cuts
      .filter((c) => agg.lbLitro - c > 0.001)
      .map((c) => ({
        corte: `-${moneyLraw(c).slice(0, 4)}`,
        cutVal: c,
        necessario: (agg.lbLitro / (agg.lbLitro - c) - 1) * 100,
        esperado: elasticidade != null ? Math.max(0, elasticidade * c) * 100 : null,
      }))
  }, [agg.lbLitro, elasticidade])

  // Veredito de viabilidade — combina margem, elasticidade (break-even de um corte
  // referência de R$0,10), momentum de volume e resposta histórica a cortes.
  const viab = useMemo(() => {
    const refCut = Math.min(0.1, agg.lbLitro * 0.5)
    const breakEvenRef = agg.lbLitro - refCut > 0 ? agg.lbLitro / (agg.lbLitro - refCut) - 1 : Infinity
    const margemScore = clamp01((agg.margem - MARGEM_ATENCAO) / (MARGEM_SAUDAVEL * 1.6 - MARGEM_ATENCAO))
    const elasticScore = isFinite(breakEvenRef) ? clamp01(1 - breakEvenRef / 0.25) : 0
    const momentumScore = clamp01(0.5 + wow.volDelta * 3)
    const histScore = elasticidade != null ? clamp01((elasticidade * refCut) / Math.max(0.0001, breakEvenRef)) : 0.4
    const score = Math.round((0.34 * margemScore + 0.3 * elasticScore + 0.16 * momentumScore + 0.2 * histScore) * 100)
    const tone: Tone = score >= 66 ? 'emerald' : score >= 40 ? 'amber' : 'red'
    const verdict = score >= 66 ? 'Estratégia viável' : score >= 40 ? 'Viável com cautela' : 'Alto risco financeiro'
    const Icon = score >= 66 ? ShieldCheck : score >= 40 ? ShieldAlert : ShieldX
    const resumo =
      score >= 66
        ? `Margem com folga e elasticidade favorável — há espaço pra competir no preço cobrindo a perda com volume.`
        : score >= 40
          ? `Dá pra reduzir, mas a margem é apertada: só compensa se o volume reagir bem (~${pct1(breakEvenRef)} pra um corte de ${moneyL(refCut)}).`
          : `Margem perto do piso e/ou volume sem reação. Reduzir preço agora tende a corroer o lucro sem retorno.`
    return {
      score, tone, verdict, Icon, resumo, refCut, breakEvenRef,
      factors: [
        { label: 'Saúde da margem', value: margemScore, hint: `${agg.margem.toFixed(2).replace('.', ',')}%` },
        { label: 'Folga de elasticidade', value: elasticScore, hint: isFinite(breakEvenRef) ? `+${pct1(breakEvenRef)} p/ -${moneyL(refCut).slice(3)}` : '—' },
        { label: 'Momentum de volume', value: momentumScore, hint: wow.hasPrev ? pctLabel(wow.volDelta) : '—' },
        { label: 'Resposta a cortes', value: histScore, hint: elasticidade != null ? `${cortes.length} corte(s)` : 'sem histórico' },
      ],
    }
  }, [agg, wow, elasticidade, cortes.length])

  // Alertas inteligentes — derivados de dados reais (sem concorrentes).
  const alertas = useMemo(() => {
    const out: { tone: Tone; Icon: typeof Info; text: string }[] = []
    if (margemTone === 'red') {
      out.push({ tone: 'red', Icon: ShieldX, text: `Margem crítica (${agg.margem.toFixed(2).replace('.', ',')}%) — abaixo do piso sustentável de ~${MARGEM_ATENCAO}%.` })
    } else if (margemTone === 'amber') {
      out.push({ tone: 'amber', Icon: ShieldAlert, text: 'A margem atual está próxima do limite mínimo saudável.' })
    }
    if (wow.hasPrev && wow.custoDelta > 0.01) {
      out.push({ tone: wow.custoDelta > 0.03 ? 'red' : 'amber', Icon: Flame, text: `O custo subiu ${pct1(wow.custoDelta)} nos últimos 7 dias — pressão sobre a margem.` })
    } else if (wow.hasPrev && wow.custoDelta < -0.01) {
      out.push({ tone: 'emerald', Icon: TrendingDown, text: `O custo caiu ${pct1(Math.abs(wow.custoDelta))} nos últimos 7 dias — abre espaço para preço.` })
    }
    if (isFinite(sim.breakEvenGrowth) && sim.breakEvenGrowth > 0.15) {
      out.push({ tone: 'amber', Icon: Zap, text: `A redução simulada exige aumento agressivo de volume (+${pct1(sim.breakEvenGrowth)}) só pra empatar o lucro.` })
    }
    if (wow.hasPrev && wow.volDelta < -0.05) {
      out.push({ tone: 'amber', Icon: TrendingDown, text: `Volume em queda (${pctLabel(wow.volDelta)}) na semana — cautela ao cortar preço.` })
    } else if (wow.hasPrev && wow.volDelta > 0.05) {
      out.push({ tone: 'emerald', Icon: TrendingUp, text: `Volume em alta (${pctLabel(wow.volDelta)}) na semana — momento favorável.` })
    }
    if (elasticidade != null && elasticidade <= 0.05 && cortes.length > 0) {
      out.push({ tone: 'amber', Icon: AlertTriangle, text: 'Cortes anteriores geraram pouco volume — elasticidade baixa neste combustível.' })
    }
    if (compTone === 'red') {
      out.push({ tone: 'amber', Icon: Target, text: `Seu preço recente está ${pct1(compRatio)} acima da sua média do período.` })
    }
    return out.slice(0, 5)
  }, [margemTone, agg.margem, wow, sim.breakEvenGrowth, elasticidade, cortes.length, compTone, compRatio])

  if (fuelsByVolume.length === 0) {
    return (
      <div className="p-5 text-center text-sm text-gray-400 dark:text-gray-500">
        Sem vendas de combustível no período pra analisar.
      </div>
    )
  }

  const linhasDesc = [...serie].reverse()
  const maxCut = Math.max(0.2, Math.ceil(agg.lbLitro * 100) / 100)
  const sparkPreco = serie.map((d) => ({ v: d.precoVenda }))
  const sparkCusto = serie.map((d) => ({ v: d.precoCusto }))
  const sparkVol = serie.map((d) => ({ v: d.litros }))

  return (
    <div className="space-y-5 p-5">
      {/* ── Cabeçalho + seletor de combustível ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#1e3a5f] to-[#2563eb] shadow-sm shadow-blue-500/20">
            <Radar className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Radar de Preços</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Inteligência estratégica de precificação — preço, margem, elasticidade e risco da redução.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {fuelsByVolume.map((f) => (
            <button
              key={f.nome}
              type="button"
              onClick={() => setFuelSel(f.nome)}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                selectedFuel === f.nome
                  ? 'bg-[#1e3a5f] text-white shadow-sm dark:bg-blue-700'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800',
              )}
            >
              <Fuel className="h-3 w-3" />
              {f.nome}
            </button>
          ))}
        </div>
      </div>

      {serie.length < 2 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-amber-300 bg-amber-50/40 px-6 py-12 text-center dark:border-amber-500/40 dark:bg-amber-900/10">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
            A análise de preços precisa de mais de 1 dia
          </p>
          <p className="mt-1 max-w-md text-xs text-gray-500 dark:text-gray-400">
            Amplie o período na barra de datas acima pra comparar a evolução do preço e da margem ao longo dos dias.
          </p>
        </div>
      ) : (
        <>
          {/* ── HERO: Viabilidade da guerra de preço ── */}
          <ViabilidadeHero viab={viab} fuel={selectedFuel} />

          {/* ── Projeção até o fechamento do mês (baseline, sem alteração) ── */}
          <ProjecaoFechamento proj={proj} />

          {/* ── 3 cards executivos ── */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <ExecCard
              id="preco"
              Icon={CircleDollarSign}
              tone="blue"
              label="Preço de venda"
              value={moneyL(agg.precoVendaMedio)}
              sub="Preço médio do período"
              delta={wow.hasPrev ? wow.precoDelta : undefined}
              deltaLabel="vs. semana ant."
              deltaGoodWhenUp
              spark={sparkPreco}
              sparkTone="blue"
              pill={{ tone: compTone, label: compLabel }}
              help="Preço médio ponderado pelos litros do período (faturamento ÷ litros). A variação compara a média dos últimos 7 dias com os 7 anteriores. A pílula classifica o preço recente vs. a média do período: abaixo = competitivo, acima = caro."
              footer={<span>Competitividade <span className="text-gray-400">·</span> vs. sua média do período</span>}
            />
            <ExecCard
              id="custo"
              Icon={Flame}
              tone={wow.custoDelta > 0.005 ? 'red' : wow.custoDelta < -0.005 ? 'emerald' : 'slate'}
              label="Preço de custo"
              value={moneyL(agg.precoCustoMedio)}
              sub="Piso da redução de preço"
              delta={wow.hasPrev ? wow.custoDelta : undefined}
              deltaLabel="7 dias"
              deltaGoodWhenUp={false}
              spark={sparkCusto}
              sparkTone={wow.custoDelta > 0.005 ? 'red' : 'emerald'}
              help="Custo médio por litro = (faturamento − lucro) ÷ litros. A variação compara os últimos 7 dias com os 7 anteriores. A projeção 7d extrapola essa tendência linearmente (não é previsão de reajuste do fornecedor)."
              footer={
                wow.hasPrev && Math.abs(wow.custoDelta) > 0.003 ? (
                  <span>Projeção 7d <span className="font-semibold text-gray-600 dark:text-gray-300">{moneyL(agg.precoCustoMedio * (1 + wow.custoDelta))}</span> <span className="text-gray-400">(tendência)</span></span>
                ) : (
                  <span>Custo estável nos últimos dias</span>
                )
              }
            />
            <ExecCard
              id="vol"
              Icon={Droplets}
              tone="blue"
              label="Volume"
              value={`${formatNumber(agg.litrosDia)} L`}
              sub="Litros por dia"
              delta={wow.hasPrev ? wow.volDelta : undefined}
              deltaLabel="vs. semana ant."
              deltaGoodWhenUp
              spark={sparkVol}
              sparkTone="blue"
              help="Litros por dia = total de litros ÷ dias com venda. A variação compara a média/dia dos últimos 7 dias com os 7 anteriores. Projeção 30d = litros/dia × 30. O impacto de -R$0,10 usa a elasticidade observada nos cortes anteriores."
              footer={
                <span>
                  Proj. 30d <span className="font-semibold text-gray-600 dark:text-gray-300">{formatLiters(agg.litrosDia * 30)}</span>
                  {elasticidade != null && (
                    <> <span className="text-gray-400">·</span> -R$0,10 ≈ <span className="font-semibold text-emerald-600 dark:text-emerald-400">+{pct1(Math.max(0, elasticidade * 0.1))}</span></>
                  )}
                </span>
              }
            />
          </div>

          {/* ── Simulador estratégico ── */}
          <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4 shadow-sm dark:border-gray-700 dark:from-gray-800/60 dark:to-gray-900">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-[#1e3a5f] dark:text-blue-400" />
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Simulador de corte de preço
              </h4>
              <InfoHint text="Aplica o corte do slider sobre o que ainda falta vender até o fim do mês (os dias já fechados não mudam). Compara 3 projeções de fechamento: sem alteração, com corte sem reação de volume e com corte + elasticidade estimada." />
              <span className="text-[11px] text-gray-400">— arraste pra projetar o fechamento</span>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
              {/* Slider + presets */}
              <div>
                <div className="flex items-end justify-between">
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Reduzir o preço em</span>
                  <span className="text-2xl font-bold tabular-nums text-[#1e3a5f] dark:text-blue-300">
                    R$ {moneyLraw(reducao).slice(0, 4)}<span className="text-sm font-medium text-gray-400">/L</span>
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={maxCut}
                  step={0.01}
                  value={Math.min(reducao, maxCut)}
                  onChange={(e) => setReducao(Number(e.target.value))}
                  className={cn(
                    'mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500',
                    '[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#1e3a5f] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-110 dark:[&::-webkit-slider-thumb]:border-blue-400',
                    '[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#1e3a5f] [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-md dark:[&::-moz-range-thumb]:border-blue-400',
                  )}
                />
                <div className="mt-1 flex justify-between text-[10px] tabular-nums text-gray-400">
                  <span>R$ 0,00</span>
                  <span>break-even em {moneyL(agg.lbLitro).slice(3)}</span>
                  <span>R$ {moneyLraw(maxCut).slice(0, 4)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[0.03, 0.05, 0.1, 0.15].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setReducao(c)}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-[11px] font-medium tabular-nums transition-colors',
                        Math.abs(reducao - c) < 0.001
                          ? 'bg-[#1e3a5f] text-white dark:bg-blue-700'
                          : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800',
                      )}
                    >
                      -R$ {moneyLraw(c).slice(0, 4)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats por litro (rápidos) */}
              <div className="grid grid-cols-2 gap-2 lg:w-[300px]">
                <SimStat
                  label="Novo preço"
                  value={moneyL(sim.novoPreco)}
                  help="Preço médio de venda menos a redução aplicada no slider."
                />
                <SimStat
                  label="Nova L.B./L"
                  value={moneyL(sim.novoLb)}
                  tone={sim.belowBreakeven ? 'red' : sim.novoLb < lbMinSustentavel ? 'amber' : 'emerald'}
                  help="Lucro bruto por litro atual menos a redução (sai direto da margem). Abaixo de zero = preço no/abaixo do custo."
                />
                <SimStat
                  label="Margem / L"
                  value={sim.novoPreco > 0 ? `${sim.margemFinal.toFixed(2).replace('.', ',')}%` : '—'}
                  tone={sim.margemFinal >= MARGEM_SAUDAVEL ? 'emerald' : sim.margemFinal >= MARGEM_ATENCAO ? 'amber' : 'red'}
                  help={`Nova L.B./litro ÷ novo preço. Cores: saudável ≥ ${MARGEM_SAUDAVEL}%, atenção ≥ ${MARGEM_ATENCAO}%, abaixo = crítica.`}
                />
                <SimStat
                  label="Volume p/ empatar"
                  value={sim.belowBreakeven ? '∞' : `+${pct1(sim.breakEvenGrowth)}`}
                  tone={sim.belowBreakeven ? 'red' : sim.breakEvenGrowth > 0.2 ? 'red' : sim.breakEvenGrowth > 0.1 ? 'amber' : 'emerald'}
                  help="Quanto o volume precisa crescer pra manter o MESMO lucro após o corte: (L.B. atual ÷ nova L.B.) − 1. Abaixo do break-even = impossível empatar (∞)."
                />
              </div>
            </div>

            {/* Comparação das 3 projeções de fechamento */}
            <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">
                      <span className="inline-flex items-center gap-1">
                        Projeção {horizonte.labelShort}
                        <InfoHint text="Cada coluna projeta o fechamento somando o que já foi realizado + os dias que faltam. O corte só age sobre os dias futuros." />
                      </span>
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Sem alteração</th>
                    <th className="px-3 py-2 text-right font-medium text-amber-600 dark:text-amber-400">Corte · sem reação</th>
                    <th className="px-3 py-2 text-right font-medium text-blue-600 dark:text-blue-400">Corte · +elasticidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  <CompareRow label="Faturamento" base={sim.baseline.fat} corte={sim.semReacao.fat} elast={sim.comElasticidade?.fat ?? null} fmt={formatCurrencyInt} />
                  <CompareRow label="Lucro bruto" base={sim.baseline.lucro} corte={sim.semReacao.lucro} elast={sim.comElasticidade?.lucro ?? null} fmt={formatCurrencyInt} />
                  <CompareRow label="Margem" base={sim.baseline.margem} corte={sim.semReacao.margem} elast={sim.comElasticidade?.margem ?? null} fmt={(v) => `${v.toFixed(2).replace('.', ',')}%`} />
                  <CompareRow label="Volume" base={sim.baseline.litros} corte={sim.semReacao.litros} elast={sim.comElasticidade?.litros ?? null} fmt={(v) => formatLiters(v)} />
                </tbody>
              </table>
            </div>

            {/* Mensagens executivas */}
            <div className="mt-3 space-y-1.5">
              {sim.belowBreakeven ? (
                <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30">
                  <ShieldX className="mt-0.5 h-4 w-4 shrink-0" />
                  Com esse corte o preço fica no/abaixo do custo ({moneyL(agg.precoCustoMedio)}) — qualquer volume adicional só amplia o prejuízo.
                </p>
              ) : (
                <>
                  <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
                    <TrendingDown className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Sem reação de volume, o lucro projetado {horizonte.label} cairia para <span className="font-bold">{formatCurrency(sim.semReacao.lucro)}</span> — {formatCurrency(sim.semReacao.lucro - sim.baseline.lucro)} vs. os {formatCurrency(sim.baseline.lucro)} sem alteração.
                    </span>
                  </p>
                  {sim.comElasticidade && sim.expGrowth != null && (
                    <p className={cn(
                      'flex items-start gap-2 rounded-lg px-3 py-2 text-xs ring-1',
                      sim.comElasticidade.lucro >= sim.baseline.lucro ? TONE.emerald.pill : TONE.amber.pill,
                    )}>
                      <Zap className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        Com elasticidade estimada de +{pct1(sim.expGrowth)}, o lucro projetado {sim.comElasticidade.lucro >= sim.baseline.lucro ? 'subiria' : 'ficaria'} em <span className="font-bold">{formatCurrency(sim.comElasticidade.lucro)}</span> e o volume em {formatLiters(sim.comElasticidade.litros)}.
                      </span>
                    </p>
                  )}
                  {sim.comElasticidade == null && reducao > 0 && (
                    <p className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-[11px] text-gray-500 ring-1 ring-gray-200 dark:bg-gray-800/40 dark:text-gray-400 dark:ring-gray-700">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Sem histórico de cortes neste combustível, não há elasticidade estimada — a projeção com reação de volume fica indisponível.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Cenários automáticos ── */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#1e3a5f] dark:text-blue-400" />
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Cenários estratégicos</h4>
              <InfoHint text="Três cortes-padrão (Conservador -R$0,05 · Esperado -R$0,10 · Agressivo -R$0,15) projetados até o fechamento do mês com a elasticidade estimada. Cada card mostra faturamento, lucro, margem e volume projetados, o break-even de volume e o risco. Inviável = corte abaixo do custo." />
              <span className="text-[11px] text-gray-400">— projetados {horizonte.labelShort}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {cenarios.map((c) => (
                <CenarioCard key={c.id} c={c} />
              ))}
            </div>
          </div>

          {/* ── Elasticidade + Alertas ── */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {/* Curva de elasticidade */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Curva de elasticidade</h4>
                <InfoHint text="Para cada corte, a barra mostra o crescimento de volume necessário pra empatar o lucro: (L.B. atual ÷ (L.B. − corte)) − 1. Cor por risco (verde <10% · âmbar <20% · vermelho ≥20%). A linha azul é o crescimento estimado pela elasticidade observada." />
              </div>
              <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                Quanto de volume a mais é preciso vender pra bancar cada corte (break-even).
              </p>
              {elasticData.length > 0 ? (
                <div className="mt-3 h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={elasticData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gpElastic" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.6} />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.4} />
                      <XAxis dataKey="corte" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v)}%`} />
                      <Tooltip
                        formatter={((v: number, name: string) => [`+${v.toFixed(2).replace('.', ',')}%`, name === 'necessario' ? 'Necessário' : 'Estimado']) as never}
                        labelFormatter={((l: string) => `Corte ${l}/L`) as never}
                        contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      />
                      <Bar dataKey="necessario" name="necessario" fill="url(#gpElastic)" radius={[4, 4, 0, 0]} maxBarSize={36}>
                        {elasticData.map((d, i) => (
                          <Cell key={i} fill={d.necessario > 20 ? '#ef4444' : d.necessario > 10 ? '#f59e0b' : '#10b981'} fillOpacity={0.85} />
                        ))}
                      </Bar>
                      {elasticidade != null && (
                        <Line type="monotone" dataKey="esperado" name="esperado" stroke="#2563eb" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 2 }} isAnimationActive={false} connectNulls />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="mt-6 text-center text-xs text-gray-400">Margem insuficiente pra simular cortes.</p>
              )}
              {elasticidade != null && (
                <p className="mt-1 flex items-center gap-1.5 text-[10px] text-gray-400">
                  <span className="inline-block h-0.5 w-4 rounded bg-blue-500" />
                  Linha azul = crescimento estimado pela elasticidade observada ({cortes.length} corte{cortes.length === 1 ? '' : 's'} no histórico).
                  <InfoHint
                    text={`A elasticidade vem dos cortes de preço já ocorridos no período: para cada dia em que o preço caiu, mede-se a variação de litros vs. o dia anterior. Faz-se a média ponderada pela magnitude do corte → ${(elasticidade * 100).toFixed(2).replace('.', ',')}% de volume por R$1 de corte. O % de cada cenário = essa elasticidade × o corte (ex.: ${(elasticidade * 100).toFixed(2)}%/R$ × R$0,10 ≈ +${pct1(Math.max(0, elasticidade * 0.1))}). Sem cortes no histórico, não há estimativa.`}
                  />
                </p>
              )}
            </div>

            {/* Alertas inteligentes */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Alertas inteligentes</h4>
                <InfoHint text="Avisos gerados automaticamente a partir dos dados do período: margem perto do piso, custo subindo, volume exigido agressivo, queda/alta de volume e elasticidade baixa. Não há dados de concorrentes." />
              </div>
              <div className="mt-3 space-y-2">
                {alertas.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    Nenhum alerta crítico — preço, margem e volume em equilíbrio.
                  </div>
                ) : (
                  alertas.map((a, i) => (
                    <div
                      key={i}
                      className={cn('flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs ring-1', TONE[a.tone].pill)}
                    >
                      <a.Icon className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="leading-snug">{a.text}</span>
                    </div>
                  ))
                )}
              </div>
              <p className="mt-3 border-t border-gray-100 pt-2 text-[10px] leading-snug text-gray-400 dark:border-gray-800">
                Análise baseada nos dados da própria rede. Preços de concorrentes não estão integrados ao sistema.
              </p>
            </div>
          </div>

          {/* ── Cortes de preço ── */}
          {cortes.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
                <TrendingDown className="h-4 w-4 text-red-500" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Cortes de preço no período</h4>
                <InfoHint text="Dias em que o preço médio caiu mais de R$0,005 vs. o dia anterior. As colunas de volume e L.B./litro comparam o dia do corte com o dia anterior — a leitura indica se o volume reagiu ao corte." />
                <span className="text-[11px] text-gray-400">— {cortes.length} {cortes.length === 1 ? 'dia' : 'dias'} com queda de preço</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Data</th>
                      <th className="px-4 py-2 text-right font-medium">Queda no preço</th>
                      <th className="px-4 py-2 text-right font-medium">Novo preço</th>
                      <th className="px-4 py-2 text-right font-medium">Volume (vs dia ant.)</th>
                      <th className="px-4 py-2 text-right font-medium">L.B./Litro (vs dia ant.)</th>
                      <th className="px-4 py-2 text-left font-medium">Leitura</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {cortes.map((c) => {
                      const reagiu = c.varLitros > 0.02
                      return (
                        <tr key={c.data} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="px-4 py-2 tabular-nums text-gray-700 dark:text-gray-300">
                            {fmtBR(c.data)} <span className="text-gray-400">{weekdayOf(c.data)}</span>
                          </td>
                          <td className="px-4 py-2 text-right font-semibold tabular-nums text-red-600 dark:text-red-400">{moneyL(c.queda)}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">{moneyL(c.novoPreco)}</td>
                          <td className={cn('px-4 py-2 text-right tabular-nums', c.varLitros >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{pctLabel(c.varLitros)}</td>
                          <td className={cn('px-4 py-2 text-right tabular-nums', c.varLb >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{pctLabel(c.varLb)}</td>
                          <td className="px-4 py-2 text-left text-[11px]">
                            <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 ring-1', reagiu ? TONE.emerald.pill : TONE.slate.pill)}>
                              {reagiu ? <TrendingUp className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                              {reagiu ? 'Volume reagiu' : 'Sem ganho de volume'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Evolução diária (colapsável — detalhe técnico) ── */}
          <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <button
              type="button"
              onClick={() => setShowTabela((v) => !v)}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
            >
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Evolução diária — {selectedFuel}</h4>
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-gray-400">
                {showTabela ? <>Ocultar <ChevronUp className="h-3.5 w-3.5" /></> : <>Ver tabela <ChevronDown className="h-3.5 w-3.5" /></>}
              </span>
            </button>
            {showTabela && (
              <div className="overflow-x-auto border-t border-gray-100 dark:border-gray-800">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Data</th>
                      <th className="px-4 py-2 text-right font-medium">Litros</th>
                      <th className="px-4 py-2 text-right font-medium">Preço venda</th>
                      <th className="px-4 py-2 text-right font-medium">Δ Preço (dia ant.)</th>
                      <th className="px-4 py-2 text-right font-medium">Preço custo</th>
                      <th className="px-4 py-2 text-right font-medium">L.B./Litro</th>
                      <th className="px-4 py-2 text-right font-medium">Margem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {linhasDesc.map((d, idx) => {
                      const ant = linhasDesc[idx + 1]
                      const deltaPreco = ant ? d.precoVenda - ant.precoVenda : 0
                      const cut = deltaPreco < -0.005
                      return (
                        <tr
                          key={d.data}
                          className={cn(
                            'hover:bg-gray-50 dark:hover:bg-gray-800/40',
                            cut && 'border-l-2 border-red-400 bg-red-50/30 dark:border-red-500/60 dark:bg-red-900/10',
                          )}
                        >
                          <td className="px-4 py-2 tabular-nums text-gray-700 dark:text-gray-300">
                            {fmtBR(d.data)} <span className="text-gray-400">{weekdayOf(d.data)}</span>
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(d.litros)}</td>
                          <td className="px-4 py-2 text-right font-medium tabular-nums text-gray-900 dark:text-gray-100">{moneyL(d.precoVenda)}</td>
                          <td className={cn(
                            'px-4 py-2 text-right tabular-nums',
                            !ant ? 'text-gray-300 dark:text-gray-600'
                              : deltaPreco < -0.005 ? 'text-red-600 dark:text-red-400'
                                : deltaPreco > 0.005 ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-gray-400',
                          )}>
                            {ant ? `${deltaPreco >= 0 ? '+' : ''}${moneyL(deltaPreco).slice(3)}` : '—'}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{moneyL(d.precoCusto)}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">{moneyL(d.lbLitro)}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{d.margem.toFixed(2).replace('.', ',')}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/* ═══════════════ Subcomponentes ═══════════════ */

interface ViabFactor { label: string; value: number; hint: string }
interface ViabData {
  score: number
  tone: Tone
  verdict: string
  Icon: typeof ShieldCheck
  resumo: string
  factors: ViabFactor[]
}

const ViabilidadeHero = ({ viab, fuel }: { viab: ViabData; fuel: string }) => {
  const t = TONE[viab.tone]
  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900',
      t.glow,
    )}>
      {/* glow de fundo */}
      <div className={cn('pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br blur-3xl', t.grad)} />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Veredito */}
        <div className="flex items-start gap-3.5">
          <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1', t.pill)}>
            <viab.Icon className="h-6 w-6" />
          </div>
          <div>
            <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Viabilidade da redução de preço · {fuel}
              <InfoHint text="Score 0–100 = média ponderada de 4 fatores: saúde da margem (34%), folga de elasticidade num corte de R$0,10 (30%), momentum de volume na semana (16%) e resposta histórica a cortes (20%). ≥66 viável · 40–65 cautela · <40 alto risco." />
            </p>
            <h3 className={cn('mt-0.5 text-xl font-bold', t.text)}>{viab.verdict}</h3>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-gray-500 dark:text-gray-400">{viab.resumo}</p>
          </div>
        </div>

        {/* Score + fatores */}
        <div className="flex items-center gap-5">
          <div className="text-center">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" strokeWidth="7" className="stroke-gray-100 dark:stroke-gray-800" />
                <circle
                  cx="40" cy="40" r="34" fill="none" strokeWidth="7" strokeLinecap="round"
                  stroke={t.hex}
                  strokeDasharray={`${(viab.score / 100) * 2 * Math.PI * 34} ${2 * Math.PI * 34}`}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className={cn('text-2xl font-bold tabular-nums', t.text)}>{viab.score}</span>
                <span className="text-[9px] text-gray-400">/ 100</span>
              </div>
            </div>
          </div>
          <div className="hidden w-44 space-y-1.5 sm:block">
            {viab.factors.map((f) => (
              <div key={f.label}>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-500 dark:text-gray-400">{f.label}</span>
                  <span className="font-medium tabular-nums text-gray-600 dark:text-gray-300">{f.hint}</span>
                </div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className={cn('h-full rounded-full', f.value >= 0.66 ? 'bg-emerald-500' : f.value >= 0.4 ? 'bg-amber-500' : 'bg-red-500')}
                    style={{ width: `${Math.max(4, f.value * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

interface ExecCardProps {
  id: string
  Icon: typeof Gauge
  tone: Tone
  label: string
  value: string
  sub: string
  delta?: number
  deltaLabel: string
  deltaGoodWhenUp: boolean
  spark: { v: number }[]
  sparkTone: Tone
  pill?: { tone: Tone; label: string }
  footer: ReactNode
  help: string
}

const ExecCard = ({ id, Icon, tone, label, value, sub, delta, deltaLabel, deltaGoodWhenUp, spark, sparkTone, pill, footer, help }: ExecCardProps) => {
  const t = TONE[tone]
  const showDelta = delta !== undefined && Math.abs(delta) > 0.0001
  const up = (delta ?? 0) >= 0
  const good = deltaGoodWhenUp ? up : !up
  const st = TONE[sparkTone]
  return (
    <div className={cn('relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900')}>
      <div className={cn('pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br blur-2xl', t.grad)} />
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg ring-1', t.pill)}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
            {label}
            <InfoHint text={help} />
          </span>
        </div>
        {pill && (
          <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ring-1', TONE[pill.tone].pill)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', TONE[pill.tone].dot)} />
            {pill.label}
          </span>
        )}
      </div>
      <div className="relative mt-2 flex items-end justify-between gap-2">
        <div>
          <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">{sub}</p>
        </div>
        {/* Sparkline */}
        <div className="h-10 w-24 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`gpSpark-${id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={st.hex} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={st.hex} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={st.hex} strokeWidth={1.75} fill={`url(#gpSpark-${id})`} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      {showDelta && (
        <div className="relative mt-1.5 flex items-center gap-1">
          <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums', good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {pctLabel(delta ?? 0)}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">{deltaLabel}</span>
        </div>
      )}
      <div className="relative mt-2 border-t border-gray-100 pt-2 text-[10px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
        {footer}
      </div>
    </div>
  )
}

const SimStat = ({ label, value, tone, help }: { label: string; value: string; tone?: Tone; help: string }) => (
  <div className="rounded-lg bg-white px-3 py-2 shadow-sm dark:bg-gray-900">
    <p className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
      {label}
      <InfoHint text={help} />
    </p>
    <p className={cn('mt-0.5 text-base font-bold tabular-nums', tone ? TONE[tone].text : 'text-gray-900 dark:text-gray-100')}>{value}</p>
  </div>
)

interface CenarioVM {
  id: string
  nome: string
  tone: Tone
  cut: number
  novoLb: number
  novoPreco: number
  viavel: boolean
  breakEvenGrowth: number
  expGrowth: number | null
  fechamento: { fat: number; litros: number; lucro: number; margem: number }
  lucroDelta: number
  risco: Tone
  riscoLabel: string
}

const CenarioCard = ({ c }: { c: CenarioVM }) => {
  const t = TONE[c.tone]
  const r = TONE[c.risco]
  return (
    <div className={cn('relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900')}>
      <div className={cn('absolute inset-x-0 top-0 h-1', t.bar)} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full', t.dot)} />
          <h5 className="text-sm font-bold text-gray-900 dark:text-gray-100">{c.nome}</h5>
        </div>
        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          -{moneyL(c.cut).slice(3)}/L
        </span>
      </div>
      <p className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">
        Novo preço
        <InfoHint text="Preço médio de venda menos o corte-padrão deste cenário (Conservador -R$0,05 · Esperado -R$0,10 · Agressivo -R$0,15)." />
      </p>
      <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{moneyL(c.novoPreco)}</p>

      <div className="mt-3 space-y-1.5 text-[11px]">
        <Row
          label="Faturamento proj."
          value={formatCurrencyInt(c.fechamento.fat)}
          help="Faturamento projetado até o fechamento do mês: realizado + dias futuros vendidos ao novo preço (ajustado pela elasticidade)."
        />
        <Row
          label="Lucro proj."
          value={formatCurrencyInt(c.fechamento.lucro)}
          tone={c.lucroDelta >= 0 ? 'emerald' : 'red'}
          extra={`${c.lucroDelta >= 0 ? '+' : ''}${pct1(c.lucroDelta)}`}
          help="Lucro bruto projetado até o fechamento. O % compara com a projeção sem alteração de preço."
        />
        <Row
          label="Margem proj."
          value={`${c.fechamento.margem.toFixed(2).replace('.', ',')}%`}
          help="Margem projetada no fechamento = lucro projetado ÷ faturamento projetado."
        />
        <Row
          label="Volume proj."
          value={formatLiters(c.fechamento.litros)}
          tone={c.expGrowth != null && c.expGrowth > 0 ? 'emerald' : undefined}
          extra={c.expGrowth != null ? `+${pct1(c.expGrowth)}` : undefined}
          help="Volume projetado até o fechamento, já com o crescimento estimado pela elasticidade observada nos cortes anteriores."
        />
        <Row
          label="Volume p/ empatar"
          value={c.viavel ? `+${pct1(c.breakEvenGrowth)}` : '∞'}
          help="Crescimento de volume necessário pra manter o mesmo lucro após este corte: (L.B. atual ÷ nova L.B.) − 1."
        />
      </div>

      <div className={cn('mt-3 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold ring-1', r.pill)}>
        <span className={cn('h-1.5 w-1.5 rounded-full', r.dot)} />
        Risco {c.riscoLabel}
      </div>
    </div>
  )
}

/* Painel de projeção até o fechamento do mês (baseline, sem alteração de preço). */
interface ProjData {
  isProjetada: boolean
  diasFechados: number
  diasRestantes: number
  fat: number
  litros: number
  lucro: number
  margem: number
}

const ProjecaoFechamento = ({ proj }: { proj: ProjData }) => {
  const items: { label: string; value: string; Icon: typeof Droplets; help: string }[] = [
    { label: 'Faturamento projetado', value: formatCurrency(proj.fat), Icon: CircleDollarSign, help: 'Faturamento estimado no fechamento do mês: realizado dos dias fechados + projeção dos dias restantes (média recente ajustada por tendência e dia da semana).' },
    { label: 'Lucro projetado', value: formatCurrency(proj.lucro), Icon: Gauge, help: 'Lucro bruto estimado no fechamento, projetado pela mesma metodologia do faturamento.' },
    { label: 'Margem projetada', value: `${proj.margem.toFixed(2).replace('.', ',')}%`, Icon: Activity, help: 'Lucro projetado ÷ faturamento projetado no fechamento.' },
    { label: 'Volume projetado', value: formatLiters(proj.litros), Icon: Droplets, help: 'Litros estimados no fechamento do mês.' },
  ]
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center gap-2">
        <Target className="h-4 w-4 text-[#1e3a5f] dark:text-blue-400" />
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Projeção até o fechamento do mês</h4>
        <InfoHint text="Cenário base, sem alteração de preço. Soma o que já foi realizado nos dias fechados com a projeção dos dias que faltam até o fim do mês." />
        {proj.isProjetada ? (
          <span className="ml-auto inline-flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 dark:bg-gray-800"><CircleDollarSign className="h-3 w-3" />{proj.diasFechados} dias fechados</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">{proj.diasRestantes} dias restantes</span>
          </span>
        ) : (
          <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">Período fechado — projeção = realizado</span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-800/40">
            <p className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
              <it.Icon className="h-3 w-3" />
              {it.label}
              <InfoHint text={it.help} />
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{it.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/* Linha de comparação das 3 projeções de fechamento no simulador. */
const CompareRow = ({ label, base, corte, elast, fmt }: { label: string; base: number; corte: number; elast: number | null; fmt: (v: number) => string }) => (
  <tr className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30">
    <td className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{label}</td>
    <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">{fmt(base)}</td>
    <td className={cn('px-3 py-2 text-right font-semibold tabular-nums', corte >= base ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{fmt(corte)}</td>
    <td className={cn('px-3 py-2 text-right font-semibold tabular-nums', elast == null ? 'text-gray-300 dark:text-gray-600' : elast >= base ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
      {elast == null ? '—' : fmt(elast)}
    </td>
  </tr>
)

const Row = ({ label, value, tone, extra, help }: { label: string; value: string; tone?: Tone; extra?: string; help?: string }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
      {label}
      {help && <InfoHint text={help} />}
    </span>
    <span className="flex items-baseline gap-1">
      <span className={cn('font-semibold tabular-nums', tone ? TONE[tone].text : 'text-gray-900 dark:text-gray-100')}>{value}</span>
      {extra && <span className={cn('text-[9px] tabular-nums', tone ? TONE[tone].text : 'text-gray-400')}>{extra}</span>}
    </span>
  </div>
)

export default GuerraPreco
