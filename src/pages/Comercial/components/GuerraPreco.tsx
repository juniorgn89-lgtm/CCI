import { useMemo, useState } from 'react'
import {
  Info, TrendingDown, TrendingUp, Minus, Radar, Calculator, Fuel, ShieldCheck,
  ShieldAlert, ShieldX, AlertTriangle, Activity, Target, Zap, ArrowRight,
  Lightbulb, ChevronDown, ChevronUp, Flame,
} from 'lucide-react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, Cell,
} from 'recharts'
import { cn } from '@/lib/utils'
import { useChartTheme } from '@/lib/chartTheme'
import { formatCurrency, formatCurrencyInt, formatLiters, formatNumber } from '@/lib/formatters'
import useProjecaoSazonalPiloto from '@/pages/Comercial/Vendas/useProjecaoSazonalPiloto'
import InfoHint from '@/components/ui/InfoHint'
import type { AbastecimentoRow, FuelTypeRow } from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'
import type { FuelView } from '@/pages/Comercial/hooks/useConcorrencia'
import { classifyFuelSlug } from '@/api/supabase/concorrencia'

/** Frescor da praça: acima disso o preço do concorrente é velho pra guiar corte. */
const PRACA_STALE_WARN = 7 // dias

interface GuerraPrecoProps {
  /** Abastecimentos brutos (já filtrados pelo período/posto) — fonte da série diária. */
  rows: AbastecimentoRow[]
  /** Combustíveis do período (pra montar o seletor, ordenado por volume). */
  fuelTypes: FuelTypeRow[]
  /** Data inicial do período (ISO) — define o mês a projetar até o fechamento. */
  dataInicial?: string
  /** Combustível pré-selecionado ao abrir (drill da Visão Geral). */
  fuelInicial?: string
  /** Preço de praça por combustível (concorrencia_precos) — amarra o concorrente
   *  ao drill. Quando presente, destrava a leitura "vs praça" e os cenários. */
  concorrenciaByFuel?: FuelView[]
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
const GuerraPreco = ({ rows, fuelTypes, dataInicial, fuelInicial, concorrenciaByFuel }: GuerraPrecoProps) => {
  const ct = useChartTheme()
  const fuelsByVolume = useMemo(
    () => [...fuelTypes].filter((f) => f.litros > 0).sort((a, b) => b.litros - a.litros),
    [fuelTypes],
  )
  const [fuelSel, setFuelSel] = useState<string | null>(fuelInicial ?? null)
  const selectedFuel = fuelSel ?? fuelsByVolume[0]?.nome ?? ''

  // Praça do combustível selecionado — casa o nome interno com o slug da
  // concorrência (classifyFuelSlug). null = sem concorrente cadastrado p/ ele.
  const praca = useMemo(() => {
    const slug = classifyFuelSlug(selectedFuel)
    if (!slug || !concorrenciaByFuel) return null
    const v = concorrenciaByFuel.find((f) => f.slug === slug)
    return v && v.mediaPonderada != null && v.mediaPonderada > 0 ? v : null
  }, [concorrenciaByFuel, selectedFuel])
  const [reducao, setReducao] = useState(0.1)
  const [showTabela, setShowTabela] = useState(false)

  // Série diária do combustível selecionado. Custo = faturamento − lucro bruto
  // (robusto, independe da unidade do preço de custo na row).
  const serie = useMemo(() => {
    const byDay = new Map<string, { litros: number; fat: number; lucro: number; cad: number; cadL: number }>()
    for (const r of rows) {
      if (r.combustivelNome !== selectedFuel) continue
      const day = (r.dataHora || '').substring(0, 10)
      if (day.length !== 10) continue
      const prev = byDay.get(day) ?? { litros: 0, fat: 0, lucro: 0, cad: 0, cadL: 0 }
      prev.litros += r.litros
      prev.fat += r.valorTotal
      prev.lucro += r.lucroBruto
      // Preço de tabela (cadastrado) ponderado por litros — só linhas que o têm.
      if (r.precoCadastro > 0) { prev.cad += r.precoCadastro * r.litros; prev.cadL += r.litros }
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
          precoCadastro: v.cadL > 0 ? v.cad / v.cadL : 0, // 0 = sem preço de tabela no dia
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
   * HERDA a projeção SAZONAL da Central (useProjecaoSazonalPiloto, setor
   * combustível) — mesmo índice rede-wide de dia-da-semana que a Central e a aba
   * Combustível usam, pra os números baterem. Trava no mês corrente via
   * `dataInicial` (o Radar passa o 1º dia do mês). Separa o realizado (não muda)
   * do que falta vender (onde o corte de preço age). */
  const dailySeriesForProj = useMemo(
    () => serie.map((d) => ({ data: d.data, litros: d.litros, faturamento: d.fat, lucroBruto: d.lucro })),
    [serie],
  )
  const sazonalProj = useProjecaoSazonalPiloto(dailySeriesForProj, true, 'combustivel', dataInicial)
  const proj = useMemo(() => {
    const fatP = sazonalProj.sazonal.faturamento
    const litrosP = sazonalProj.sazonal.litros
    const lucroP = sazonalProj.sazonal.lucro
    const litrosRest = litrosP.esperado - litrosP.realizado
    const fatRest = fatP.esperado - fatP.realizado
    const lucroRest = lucroP.esperado - lucroP.realizado
    return {
      isProjetada: fatP.diasRestantes > 0,
      diasFechados: fatP.diasFechados,
      diasRestantes: fatP.diasRestantes,
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
  }, [sazonalProj, agg])

  // Horizonte da simulação: futuro (até o fechamento) quando há dias restantes;
  // senão, retrospectivo sobre o período fechado. Memoizado pra não recriar o
  // objeto a cada render (senão os memos que dependem dele recomputam sempre).
  const horizonte = useMemo(
    () => proj.isProjetada
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
        },
    [proj, agg],
  )

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
      volDelta: d(last.litrosDia, prev.litrosDia),
    }
  }, [serie])

  // Cortes de preço: dias em que o preço de TABELA (cadastrado) caiu vs o dia
  // anterior. Usa o cadastrado (o preço "oficial" da bomba); cai pro realizado
  // só nos dias sem preço de tabela — assim "queda" e "novo preço" batem.
  const cortes = useMemo(() => {
    const out: { data: string; queda: number; novoPreco: number; varLitros: number; varLb: number }[] = []
    const precoRef = (d: { precoCadastro: number; precoVenda: number }) => (d.precoCadastro > 0 ? d.precoCadastro : d.precoVenda)
    for (let i = 1; i < serie.length; i++) {
      const cur = serie[i]
      const prev = serie[i - 1]
      const precoCur = precoRef(cur)
      const queda = precoCur - precoRef(prev)
      if (queda < -0.005) {
        out.push({
          data: cur.data,
          queda,
          novoPreco: precoCur,
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
  // Preço de venda ATUAL = preço de TABELA (cadastrado) do dia mais recente com
  // dado — o que está valendo na bomba hoje (igual ao WebPosto/Gestão de Preços).
  // Fallback pro realizado do último dia só se nenhum dia trouxe preço de tabela.
  const precoAtual = (() => {
    for (let i = serie.length - 1; i >= 0; i--) if (serie[i].precoCadastro > 0) return serie[i].precoCadastro
    return serie.length ? serie[serie.length - 1].precoVenda : agg.precoVendaMedio
  })()
  // Margem por litro no preço ATUAL (cadastrado) — base do simulador e do teto.
  const lbAtualNow = Math.max(0, precoAtual - agg.precoCustoMedio)

  // "vs praça": meu preço ATUAL (cadastrado, o da bomba) contra a média ponderada
  // dos concorrentes. gap>0 = estou mais BARATO (posso subir); gap<0 = mais CARO.
  // `velho` = praça defasada (>PRACA_STALE_WARN dias) → não deve guiar corte.
  const vsPraca = useMemo(() => {
    if (!praca || praca.mediaPonderada == null || praca.mediaPonderada <= 0) return null
    const media = praca.mediaPonderada
    return {
      media,
      gap: media - precoAtual,
      indice: (precoAtual / media) * 100,
      concorrentes: praca.competidores.length,
      stale: praca.maxStaleDays,
      velho: praca.maxStaleDays != null && praca.maxStaleDays > PRACA_STALE_WARN,
    }
  }, [praca, precoAtual])

  // Competitividade — proxy interno honesto: preço recente vs. média do período.
  const compRatio = agg.precoVendaMedio > 0 ? wow.last.precoVenda / agg.precoVendaMedio - 1 : 0
  const compTone: Tone = compRatio < -0.004 ? 'emerald' : compRatio > 0.004 ? 'red' : 'amber'

  // Simulador (dirigido pelo slider) — agora projeta até o fechamento do mês.
  const sim = useMemo(() => {
    // Base = preço ATUAL (cadastrado) e custo médio → margem do dia em curso.
    const lbAtual = lbAtualNow
    const novoLb = lbAtual - reducao
    const belowBreakeven = novoLb <= 0
    const novoPreco = precoAtual - reducao
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
  }, [precoAtual, lbAtualNow, reducao, elasticidade, cenarioProj])

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

  // Recomendação answer-first — só sinais CONFIÁVEIS (margem, custo 7d, volume 7d),
  // sem elasticidade/concorrentes. Diz O QUE FAZER + COMO. 3 estados de preço.
  const recomendacao = useMemo(() => {
    const margemCritica = agg.margem < MARGEM_ATENCAO
    const margemSaudavel = agg.margem >= MARGEM_SAUDAVEL
    const custoSubindo = wow.hasPrev && wow.custoDelta > 0.01
    const volCaindo = wow.hasPrev && wow.volDelta < -0.05
    const folgaLb = Math.max(0, agg.lbLitro - lbMinSustentavel) // R$/L até o piso saudável
    const estado: 'folga' | 'segure' | 'piso' =
      margemCritica ? 'piso' : (!margemSaudavel || custoSubindo) ? 'segure' : 'folga'
    const tone: Tone = estado === 'folga' ? 'emerald' : estado === 'segure' ? 'amber' : 'red'
    const Icon = estado === 'folga' ? ShieldCheck : estado === 'segure' ? ShieldAlert : ShieldX
    const titulo = estado === 'folga'
      ? 'Você tem folga no preço'
      : estado === 'segure'
        ? 'Segure o preço'
        : 'Margem no piso — não corte'
    const margemTxt = `${agg.margem.toFixed(1).replace('.', ',')}%`
    const comoFazer = estado === 'folga'
      ? `Não precisa cortar pra vender — cada litro já sobra ${moneyL(agg.lbLitro)}/L de lucro.${folgaLb > 0.005 ? ` Se a concorrência apertar, dá pra ceder até ~R$ ${moneyLraw(folgaLb)}/L antes de encostar no piso saudável.` : ''}`
      : estado === 'segure'
        ? `${custoSubindo ? `O custo subiu ${pct1(wow.custoDelta)} em 7 dias e a margem está apertada (${margemTxt})` : `A margem está apertada (${margemTxt})`}. Cortar o preço agora come o lucro — segure${custoSubindo ? ' e observe o custo' : ''}${volCaindo ? '; o volume também vem caindo' : ''}.`
        : `A margem está em ${margemTxt}, no piso. Qualquer corte vira prejuízo — ataque o custo (renegociar bonificação/frete), não o preço.`
    return { estado, tone, Icon, titulo, comoFazer }
  }, [agg, wow, lbMinSustentavel])

  // Alertas inteligentes — derivados de dados reais (sem concorrentes).
  const alertas = useMemo(() => {
    const out: { tone: Tone; Icon: typeof Info; text: string }[] = []
    // Sinal de PRAÇA (dado de concorrente, o mais forte) primeiro — mas só quando
    // fresco; praça velha vira aviso de "atualize", nunca recomendação de corte.
    if (vsPraca && !vsPraca.velho) {
      if (vsPraca.gap > 0.02) {
        out.push({ tone: 'emerald', Icon: TrendingUp, text: `Você está R$ ${moneyLraw(vsPraca.gap).slice(0, 4)}/L abaixo da praça (índice ${vsPraca.indice.toFixed(0)}%) — há espaço pra subir sem perder competitividade.` })
      } else if (vsPraca.gap < -0.02) {
        out.push({ tone: 'amber', Icon: Target, text: `Você está R$ ${moneyLraw(Math.abs(vsPraca.gap)).slice(0, 4)}/L acima da praça (índice ${vsPraca.indice.toFixed(0)}%) — atenção à competitividade.` })
      }
    } else if (vsPraca && vsPraca.velho) {
      out.push({ tone: 'slate', Icon: AlertTriangle, text: `Preço de praça com ${vsPraca.stale} dias — atualize a concorrência antes de decidir pela praça.` })
    }
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
  }, [margemTone, agg.margem, wow, sim.breakEvenGrowth, elasticidade, cortes.length, compTone, compRatio, vsPraca])

  if (fuelsByVolume.length === 0) {
    return (
      <div className="p-5 text-center text-sm text-gray-400 dark:text-gray-500">
        Sem vendas de combustível no período pra analisar.
      </div>
    )
  }

  const linhasDesc = [...serie].reverse()
  const maxCut = Math.max(0.2, Math.ceil(lbAtualNow * 100) / 100)

  // Cenários estratégicos, curva de elasticidade e alertas ficavam OCULTOS por
  // falta de referência de praça. Agora RELIGAM quando há concorrente cadastrado
  // pra este combustível (vsPraca dá o alvo de mercado que ancora a decisão de
  // corte). Sem praça, o drill segue enxuto (só dados internos). A reação de
  // volume dos cenários ainda é ESTIMATIVA (rotulada) — a praça dá o porquê, não
  // garante o volume.
  const MOSTRAR_ELASTICIDADE = !!praca
  // Tabela "Evolução diária" (detalhe técnico dia a dia) — oculta a pedido; é
  // ruído pro dono. Religar aqui se precisar do detalhe.
  const MOSTRAR_EVOLUCAO_DIARIA = false

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
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-400 dark:hover:bg-gray-800',
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
          {/* ── Recomendação answer-first: o que fazer + como + números de apoio ── */}
          <RecomendacaoPreco
            rec={recomendacao}
            fuel={selectedFuel}
            numeros={[
              { label: 'Preço atual', value: moneyL(precoAtual), hint: 'Preço de TABELA (cadastrado) mais recente — o que está valendo na bomba, igual ao WebPosto/Gestão de Preços. É diferente da média do período (que mistura dias com preços diferentes).' },
              { label: 'Margem', value: `${agg.margem.toFixed(1).replace('.', ',')}%`, valueTone: margemTone },
              { label: 'Custo (piso)', value: moneyL(agg.precoCustoMedio), trend: wow.hasPrev ? wow.custoDelta : undefined, trendGoodWhenUp: false },
              { label: 'Volume/dia', value: `${formatNumber(agg.litrosDia)} L`, trend: wow.hasPrev ? wow.volDelta : undefined, trendGoodWhenUp: true },
            ]}
          />

          {/* ── Preço vs praça (concorrência manual) ── */}
          {vsPraca && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex flex-wrap items-center gap-1.5">
                <Target className="h-4 w-4 text-[#1e3a5f] dark:text-blue-400" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Seu preço vs praça</h4>
                <InfoHint text="Compara o seu preço ATUAL (cadastrado) com a média dos concorrentes, ponderada pelo nº de postos de cada um. Índice = seu preço ÷ média × 100 (abaixo de 100 = você mais barato). Dado MANUAL da aba Concorrência — vale o que a última observação vale." />
                <span className="ml-auto text-[10px] font-medium">
                  {vsPraca.velho ? (
                    <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400"><AlertTriangle className="h-3 w-3" />praça de {vsPraca.stale} dias</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><ShieldCheck className="h-3 w-3" />praça de {vsPraca.stale ?? 0}d · {vsPraca.concorrentes} concorrente{vsPraca.concorrentes === 1 ? '' : 's'}</span>
                  )}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Índice vs praça</p>
                  <p className={cn('text-2xl font-bold tabular-nums', vsPraca.gap >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>{vsPraca.indice.toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Seu preço · média praça</p>
                  <p className="text-[15px] font-semibold tabular-nums text-gray-900 dark:text-gray-100">{moneyL(precoAtual)} · {moneyL(vsPraca.media)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Diferença</p>
                  <p className={cn('text-[15px] font-semibold tabular-nums', vsPraca.gap >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                    {vsPraca.gap >= 0 ? 'você −' : 'você +'}R$ {moneyLraw(Math.abs(vsPraca.gap)).slice(0, 4)}/L
                  </p>
                </div>
              </div>

              <p className="mt-2 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                {vsPraca.velho
                  ? `A última observação da praça é de ${vsPraca.stale} dias — confirme na aba Concorrência antes de decidir pela praça.`
                  : vsPraca.gap > 0.02
                    ? `Você está mais barato que a praça — há espaço pra subir até ~R$ ${moneyLraw(vsPraca.gap).slice(0, 4)}/L antes de encostar na média do mercado.`
                    : vsPraca.gap < -0.02
                      ? 'Você está mais caro que a praça — cortar aproxima do mercado, mas confira a margem no simulador antes.'
                      : 'Você está praticamente na média da praça.'}
              </p>
            </div>
          )}

          {/* ── Simulador estratégico ── */}
          <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4 shadow-sm dark:border-gray-700 dark:from-gray-800/60 dark:to-gray-900">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-[#1e3a5f] dark:text-blue-400" />
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Simulador de corte de preço
              </h4>
              <InfoHint text="Aplica o corte do slider sobre o que ainda falta vender até o fim do mês (os dias já fechados não mudam) e projeta o fechamento ANTES × DEPOIS do corte, mantendo o mesmo volume (cenário honesto)." />
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
                  <span>sem lucro a partir de {moneyL(lbAtualNow).slice(3)}</span>
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
                          : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-400 dark:hover:bg-gray-800',
                      )}
                    >
                      -R$ {moneyLraw(c).slice(0, 4)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats por litro — de tanto → para tanto (hoje → com corte). */}
              <div className="grid grid-cols-2 gap-2 lg:w-[360px]">
                <SimStat
                  label="Preço / L"
                  from={moneyL(precoAtual)}
                  value={moneyL(sim.novoPreco)}
                  help="Preço atual (cadastrado) menos a redução do slider → o novo preço na bomba."
                />
                <SimStat
                  label="L.B. / L"
                  from={moneyL(lbAtualNow)}
                  value={moneyL(sim.novoLb)}
                  tone={sim.belowBreakeven ? 'red' : sim.novoLb < lbMinSustentavel ? 'amber' : 'emerald'}
                  help="Lucro bruto por litro no preço atual (preço − custo) menos a redução. Abaixo de zero = preço no/abaixo do custo."
                />
                <SimStat
                  label="Margem / L"
                  from={`${(precoAtual > 0 ? (lbAtualNow / precoAtual) * 100 : 0).toFixed(2).replace('.', ',')}%`}
                  value={sim.novoPreco > 0 ? `${sim.margemFinal.toFixed(2).replace('.', ',')}%` : '—'}
                  tone={sim.margemFinal >= MARGEM_SAUDAVEL ? 'emerald' : sim.margemFinal >= MARGEM_ATENCAO ? 'amber' : 'red'}
                  help={`L.B./litro ÷ preço. Cores: saudável ≥ ${MARGEM_SAUDAVEL}%, atenção ≥ ${MARGEM_ATENCAO}%, abaixo = crítica.`}
                />
                <SimStat
                  label="Volume p/ empatar"
                  value={sim.belowBreakeven ? '∞' : `+${pct1(sim.breakEvenGrowth)}`}
                  tone={sim.belowBreakeven ? 'red' : sim.breakEvenGrowth > 0.2 ? 'red' : sim.breakEvenGrowth > 0.1 ? 'amber' : 'emerald'}
                  foot={sim.belowBreakeven
                    ? 'preço no custo — não dá pra empatar'
                    : `empatando, o lucro do mês fica em ${formatCurrency(sim.baseline.lucro)}`}
                  help="Quanto o volume precisa crescer pra manter o MESMO lucro após o corte: (L.B. atual ÷ nova L.B.) − 1. Empatando, o lucro do mês fica igual ao de hoje (sem cortar). Abaixo do break-even = impossível empatar (∞)."
                />
              </div>
            </div>

            {/* Reflexo do corte na competitividade (vs praça, ao vivo com o slider). */}
            {vsPraca && reducao > 0 && (
              <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-blue-50/60 px-3 py-2 text-[11px] leading-snug text-blue-800 dark:bg-blue-950/20 dark:text-blue-200">
                <Target className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Com esse corte seu preço fica em <span className="font-semibold">{moneyL(sim.novoPreco)}</span> — índice <span className="font-semibold">{((sim.novoPreco / vsPraca.media) * 100).toFixed(0)}%</span> da praça
                  {sim.novoPreco < vsPraca.media
                    ? ` (R$ ${moneyLraw(vsPraca.media - sim.novoPreco).slice(0, 4)}/L abaixo da média)`
                    : ` (R$ ${moneyLraw(sim.novoPreco - vsPraca.media).slice(0, 4)}/L acima da média)`}.
                  {vsPraca.velho && <span className="text-blue-800/60 dark:text-blue-200/60"> Praça de {vsPraca.stale} dias — confirme.</span>}
                </span>
              </p>
            )}

            {/* ── Projeção do mês: ANTES × DEPOIS do corte (Lucro em destaque) ── */}
            {(() => {
              const deltaLucro = sim.semReacao.lucro - sim.baseline.lucro
              const deltaPct = sim.baseline.lucro !== 0 ? deltaLucro / Math.abs(sim.baseline.lucro) : 0
              const temCorte = reducao > 0
              const pior = deltaLucro < 0
              const apoio = [
                { l: 'Faturamento', a: sim.baseline.fat, d: sim.semReacao.fat, fmt: formatCurrencyInt, muda: true },
                { l: 'Margem', a: sim.baseline.margem, d: sim.semReacao.margem, fmt: (v: number) => `${v.toFixed(1).replace('.', ',')}%`, muda: true },
                // Volume não muda: a projeção mantém o mesmo volume (cenário honesto).
                { l: 'Volume', a: sim.baseline.litros, d: sim.semReacao.litros, fmt: (v: number) => formatLiters(v), muda: false },
              ]
              return (
                <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Target className="h-4 w-4 text-[#1e3a5f] dark:text-blue-400" />
                    <h5 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Projeção do mês {horizonte.labelShort}</h5>
                    <InfoHint text="Soma o que já foi realizado nos dias fechados + os dias que faltam. 'Hoje' = sem mexer no preço; 'Com o corte' = o corte do slider mantendo o MESMO volume (cenário honesto — se o volume reagir, melhora)." />
                    <span className="ml-auto text-[11px] text-gray-400">{temCorte ? 'antes × depois do corte' : 'sem alteração de preço'}</span>
                  </div>

                  {/* Lucro do mês em destaque */}
                  <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Lucro do mês hoje</p>
                      <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(sim.baseline.lucro)}</p>
                    </div>
                    {temCorte && (
                      <>
                        <ArrowRight className="mb-1.5 h-5 w-5 shrink-0 text-gray-300" />
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">com o corte de R$ {moneyLraw(reducao).slice(0, 4)}/L</p>
                          <p className={cn('text-2xl font-bold tabular-nums', pior ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>{formatCurrency(sim.semReacao.lucro)}</p>
                        </div>
                        <span className={cn('mb-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold ring-1', pior ? TONE.red.pill : TONE.emerald.pill)}>
                          {pior ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                          {formatCurrency(deltaLucro)} · {pctLabel(deltaPct)}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Apoio: faturamento, margem, volume — rotulados Hoje / Com corte */}
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {apoio.map((r) => (
                      <div key={r.l} className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2 dark:border-gray-800 dark:bg-gray-800/40">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{r.l} {horizonte.labelShort}</p>
                        {temCorte && r.muda ? (
                          <div className="mt-0.5 space-y-0.5">
                            <p className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="text-gray-400">Hoje</span>
                              <span className="font-semibold tabular-nums text-gray-700 dark:text-gray-300">{r.fmt(r.a)}</span>
                            </p>
                            <p className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="text-gray-400">Com corte</span>
                              <span className={cn('font-semibold tabular-nums', pior ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>{r.fmt(r.d)}</span>
                            </p>
                          </div>
                        ) : (
                          <p className="text-[13px] font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                            {r.fmt(r.a)}
                            {temCorte && !r.muda && <span className="text-[10px] font-normal text-gray-400"> · mantido</span>}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {temCorte ? (
                    <p className="mt-2.5 text-[10.5px] leading-snug text-gray-400">
                      Considera o <span className="font-medium text-gray-500 dark:text-gray-400">mesmo volume</span>; se o corte trouxer mais litros, melhora — mas isso depende da reação do mercado. Pra empatar o lucro de hoje, o volume teria que crescer {sim.belowBreakeven ? 'o impossível (preço no custo)' : `~${pct1(sim.breakEvenGrowth)}`}.
                    </p>
                  ) : (
                    <p className="mt-2.5 text-[10.5px] leading-snug text-gray-400">Arraste o slider pra ver como um corte de preço muda o fechamento do mês.</p>
                  )}

                  {/* Honestidade de base: a projeção do drill é FÍSICA (bomba), não o
                      fiscal da Central. Serve pra decidir a DIREÇÃO do corte, não como
                      valor contábil exato — não deixar o dono crer num R$ que não bate. */}
                  <p className="mt-2 flex items-start gap-1.5 border-t border-gray-100 pt-2 text-[10px] leading-snug text-gray-400 dark:border-gray-800">
                    <Info className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                      Base: <span className="font-medium">venda física da bomba</span> (a mesma do dia a dia desta tela). O fechamento <span className="font-medium">fiscal</span> do mês na Central da Rede pode diferir um pouco — use este número pra decidir a <span className="font-medium">direção e o tamanho do corte</span>, não como valor contábil exato.
                    </span>
                  </p>
                </div>
              )
            })()}

            {/* Aviso: preço no/abaixo do custo */}
            {sim.belowBreakeven && reducao > 0 && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30">
                <ShieldX className="mt-0.5 h-4 w-4 shrink-0" />
                Com esse corte o preço fica no/abaixo do custo ({moneyL(agg.precoCustoMedio)}) — qualquer volume adicional só amplia o prejuízo.
              </p>
            )}
          </div>

          {/* ── Cenários automáticos ── (só quando há praça cadastrada p/ o combustível) */}
          {MOSTRAR_ELASTICIDADE && (
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
          )}

          {/* ── Elasticidade + Alertas ── (só quando há praça cadastrada p/ o combustível) */}
          {MOSTRAR_ELASTICIDADE && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {/* Curva de elasticidade */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Volume extra por corte</h4>
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
                      <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} strokeOpacity={0.4} />
                      <XAxis dataKey="corte" tick={{ fontSize: 10, fill: ct.axis }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: ct.axis }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v)}%`} />
                      <Tooltip
                        formatter={((v: number, name: string) => [`+${v.toFixed(2).replace('.', ',')}%`, name === 'necessario' ? 'Necessário' : 'Estimado']) as never}
                        labelFormatter={((l: string) => `Corte ${l}/L`) as never}
                        contentStyle={{ fontSize: 11, borderRadius: 8, ...ct.tooltip }}
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
                <InfoHint text="Avisos gerados automaticamente a partir dos dados do período: posição vs praça (quando há concorrente cadastrado), margem perto do piso, custo subindo, volume exigido agressivo e queda/alta de volume. Preço de praça velho vira aviso pra atualizar, nunca recomendação de corte." />
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
                Combina os dados da própria rede com o preço de praça cadastrado na aba Concorrência (dado manual — vale o frescor da última observação).
              </p>
            </div>
          </div>
          )}

          {/* ── Cortes de preço ── */}
          {cortes.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
                <TrendingDown className="h-4 w-4 text-red-500" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Cortes de preço no período</h4>
                <InfoHint text="Dias em que o preço de TABELA (cadastrado) caiu mais de R$0,005 vs. o dia anterior — 'Novo preço' é o cadastrado após o corte (o realizado só entra nos dias sem preço de tabela). As colunas de volume e L.B./litro comparam o dia do corte com o dia anterior — a leitura indica se o volume reagiu ao corte." />
                <span className="text-[11px] text-gray-400">— {cortes.length} {cortes.length === 1 ? 'dia' : 'dias'} com queda de preço</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-transparent dark:text-gray-400">
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

          {/* ── Evolução diária (colapsável — detalhe técnico) ── (oculta a pedido) */}
          {MOSTRAR_EVOLUCAO_DIARIA && (
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
                  <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-transparent dark:text-gray-400">
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
          )}
        </>
      )}
    </div>
  )
}

/* ═══════════════ Subcomponentes ═══════════════ */

interface RecVM { estado: string; tone: Tone; Icon: typeof ShieldCheck; titulo: string; comoFazer: string }
interface RecNumero { label: string; value: string; valueTone?: Tone; trend?: number; trendGoodWhenUp?: boolean; hint?: string }

/** Bloco answer-first do Radar: o QUE FAZER (veredito de preço) + COMO + uma
 *  linha enxuta de números de apoio (margem, preço, custo, volume). Substitui o
 *  hero de score, a projeção e os 3 cards executivos. */
const RecomendacaoPreco = ({ rec, fuel, numeros }: { rec: RecVM; fuel: string; numeros: RecNumero[] }) => {
  const t = TONE[rec.tone]
  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900',
      t.glow,
    )}>
      <div className={cn('pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br blur-3xl', t.grad)} />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Veredito + como fazer */}
        <div className="flex items-start gap-3.5">
          <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1', t.pill)}>
            <rec.Icon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">O que fazer · {fuel}</p>
            <h3 className={cn('mt-0.5 text-xl font-bold', t.text)}>{rec.titulo}</h3>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
              <span className="font-semibold text-gray-500 dark:text-gray-400">Como: </span>{rec.comoFazer}
            </p>
          </div>
        </div>

        {/* Números de apoio (viraram apoio, não manchete) */}
        <div className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-4 lg:gap-x-5">
          {numeros.map((nu) => {
            const showTrend = nu.trend != null && Math.abs(nu.trend) > 0.0001
            const good = nu.trend != null && (nu.trendGoodWhenUp ? nu.trend >= 0 : nu.trend <= 0)
            return (
              <div key={nu.label} className="min-w-0">
                <p className="inline-flex items-center gap-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  {nu.label}
                  {nu.hint && <InfoHint text={nu.hint} />}
                </p>
                <p className={cn('text-base font-bold tabular-nums', nu.valueTone ? TONE[nu.valueTone].text : 'text-gray-900 dark:text-gray-100')}>{nu.value}</p>
                {showTrend && (
                  <p className={cn('inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums', good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                    {(nu.trend ?? 0) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{pctLabel(nu.trend ?? 0)}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const SimStat = ({ label, value, from, foot, tone, help }: { label: string; value: string; from?: string; foot?: string; tone?: Tone; help: string }) => (
  <div className="rounded-lg bg-white px-3 py-2.5 shadow-sm dark:bg-gray-900">
    <p className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
      {label}
      <InfoHint text={help} />
    </p>
    {from ? (
      <div className="mt-1 space-y-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] text-gray-400">Hoje</span>
          <span className="text-[13px] font-semibold tabular-nums text-gray-500 dark:text-gray-400">{from}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] text-gray-400">Com corte</span>
          <span className={cn('text-[17px] font-bold tabular-nums', tone ? TONE[tone].text : 'text-gray-900 dark:text-gray-100')}>{value}</span>
        </div>
      </div>
    ) : (
      <p className={cn('mt-0.5 text-[17px] font-bold tabular-nums', tone ? TONE[tone].text : 'text-gray-900 dark:text-gray-100')}>{value}</p>
    )}
    {foot && <p className="mt-1 text-[10px] leading-snug text-gray-400 dark:text-gray-500">{foot}</p>}
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
