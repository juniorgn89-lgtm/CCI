import { useMemo } from 'react'
import useOperacaoData from '@/pages/Operacao/hooks/useOperacaoData'
import { difCaixa, isCartaoForma } from '@/lib/difCaixa'

const EPS = 0.005

export interface DifKpis {
  liquida: number
  faltas: number
  faltasCount: number
  sobras: number
  sobrasCount: number
  comDiferenca: number
  totalConferidos: number
}

export interface RespRow {
  nome: string
  caixas: number
  sobras: number
  faltas: number
  liquido: number
}

export interface FormaRow {
  nome: string
  valor: number
  isCartao: boolean
  /** Balde residual (caixas fechados sem quebra por forma). */
  isNaoConferido?: boolean
}

export interface DiaPoint {
  dia: string // yyyy-MM-dd
  valor: number
}

export interface TopCaixaRow {
  key: string
  caixaCodigo: number
  data: string // yyyy-MM-dd
  turno: string
  caixaLabel: string
  responsavel: string
  pdvLabel: string
  /** Forma dominante da diferença (null quando o caixa não tem conferência). */
  forma: string | null
  isCartao: boolean
  apurado: number
  diferenca: number
}

export interface DiferencasCaixaData {
  kpis: DifKpis
  porResponsavel: RespRow[]
  porForma: FormaRow[]
  /** Quebra de cada forma por POSTO (mesmo escopo da porForma) — pro modal. */
  formaPorPosto: Map<string, { posto: string; valor: number }[]>
  /** Nº de caixas fechados com diferença mas sem quebra por forma. */
  naoConferidoCount: number
  porDia: DiaPoint[]
  topCaixas: TopCaixaRow[]
  /** Todos os caixas fechados (pro escopo "período" do modal de cartão). */
  caixaCodigos: number[]
  pdvByCaixa: Map<number, string>
  isLoading: boolean
  hasEmpresa: boolean
}

/**
 * Consolida as diferenças (sobras/faltas) do período inteiro a partir do
 * `useOperacaoData` (fonte única; já filtra empresa + período). Considera só
 * caixas FECHADOS (= conferidos). Reaproveita `difCaixa` (apresentado − apurado
 * conferido) e a quebra por forma do `conferenciaPdv` (/CAIXA_APRESENTADO).
 *
 * Reconciliação: o balde "Não conferido" (resíduo = líquida − Σ formas) garante
 * que Σ(formas) + não-conferido == diferença líquida do KPI, mesmo quando há
 * caixas fechados sem detalhamento por forma. Tudo GET/read-only.
 */
const useDiferencasCaixa = (): DiferencasCaixaData => {
  const { turnoRows, conferenciaPdv, isLoading, hasEmpresa } = useOperacaoData()

  return useMemo<DiferencasCaixaData>(() => {
    const fechados = turnoRows.filter((c) => c.fechado)
    const confByCaixa = new Map(conferenciaPdv.map((c) => [c.caixaCodigo, c]))

    // ── KPIs ──
    let liquida = 0, faltas = 0, sobras = 0, faltasCount = 0, sobrasCount = 0, comDiferenca = 0
    for (const c of fechados) {
      const d = difCaixa(c)
      liquida += d
      if (d < -EPS) { faltas += d; faltasCount++ }
      else if (d > EPS) { sobras += d; sobrasCount++ }
      if (Math.abs(d) > EPS) comDiferenca++
    }

    // ── Por responsável ──
    const respMap = new Map<string, RespRow>()
    for (const c of fechados) {
      const d = difCaixa(c)
      const r = respMap.get(c.funcionarioNome) ?? { nome: c.funcionarioNome, caixas: 0, sobras: 0, faltas: 0, liquido: 0 }
      r.caixas++
      r.liquido += d
      if (d > EPS) r.sobras += d
      else if (d < -EPS) r.faltas += d
      respMap.set(c.funcionarioNome, r)
    }
    const porResponsavel = Array.from(respMap.values())

    // ── Por forma (+ balde "Não conferido" residual) ──
    // formaPostoMap: quebra de cada forma por POSTO — derivada NO MESMO laço
    // (fechados + confByCaixa deduplicado), pra o modal do Panorama somar
    // EXATAMENTE o valor da linha de forma. (Antes o modal iterava o
    // conferenciaPdv cru → escopo/dedup divergentes → valor não batia.)
    const formaMap = new Map<string, number>()
    const formaPostoMap = new Map<string, Map<string, number>>()
    let semQuebraCount = 0
    for (const c of fechados) {
      const conf = confByCaixa.get(c.caixaCodigo)
      const temQuebra = !!conf && conf.formas.length > 0
      if (!temQuebra) {
        if (Math.abs(difCaixa(c)) > EPS) semQuebraCount++
        continue
      }
      for (const f of conf!.formas) {
        formaMap.set(f.nome, (formaMap.get(f.nome) ?? 0) + f.diferenca)
        const byP = formaPostoMap.get(f.nome) ?? new Map<string, number>()
        byP.set(c.pdvLabel, (byP.get(c.pdvLabel) ?? 0) + f.diferenca)
        formaPostoMap.set(f.nome, byP)
      }
    }
    const formaPorPosto = new Map<string, { posto: string; valor: number }[]>()
    for (const [nome, byP] of formaPostoMap) {
      formaPorPosto.set(nome, Array.from(byP.entries())
        .map(([posto, valor]) => ({ posto, valor }))
        .filter((x) => Math.abs(x.valor) > EPS)
        .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor)))
    }
    const somaFormas = Array.from(formaMap.values()).reduce((s, v) => s + v, 0)
    const porForma: FormaRow[] = Array.from(formaMap.entries())
      .filter(([, v]) => Math.abs(v) > EPS)
      .map(([nome, valor]) => ({ nome, valor, isCartao: isCartaoForma(nome) }))
      .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor))
    // Resíduo garante Σ(formas) + não-conferido == líquida do KPI.
    const naoConferidoValor = liquida - somaFormas
    if (Math.abs(naoConferidoValor) > EPS) {
      porForma.push({ nome: 'Não conferido', valor: naoConferidoValor, isCartao: false, isNaoConferido: true })
    }

    // ── Por dia (só dias com caixa fechado; sem zero forçado) ──
    const diaMap = new Map<string, number>()
    for (const c of fechados) {
      const dia = c.dataMovimento.slice(0, 10)
      diaMap.set(dia, (diaMap.get(dia) ?? 0) + difCaixa(c))
    }
    const porDia: DiaPoint[] = Array.from(diaMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, valor]) => ({ dia, valor }))

    // ── Top caixas (por |dif|) ──
    const topCaixas: TopCaixaRow[] = fechados
      .filter((c) => Math.abs(difCaixa(c)) > EPS)
      .sort((a, b) => Math.abs(difCaixa(b)) - Math.abs(difCaixa(a)))
      .map((c) => {
        const conf = confByCaixa.get(c.caixaCodigo)
        let forma: string | null = null
        if (conf && conf.formas.length > 0) {
          const dom = [...conf.formas]
            .filter((f) => Math.abs(f.diferenca) > EPS)
            .sort((x, y) => Math.abs(y.diferenca) - Math.abs(x.diferenca))[0]
          forma = dom?.nome ?? null
        }
        return {
          key: `${c.caixaCodigo}-${c.dataMovimento.slice(0, 10)}`,
          caixaCodigo: c.caixaCodigo,
          data: c.dataMovimento.slice(0, 10),
          turno: c.turno,
          caixaLabel: `#${c.caixaCodigo}`,
          responsavel: c.funcionarioNome,
          pdvLabel: c.pdvLabel,
          forma,
          isCartao: forma != null && isCartaoForma(forma),
          apurado: c.apuradoConferido ?? c.apurado,
          diferenca: difCaixa(c),
        }
      })

    const caixaCodigos = fechados.map((c) => c.caixaCodigo)
    const pdvByCaixa = new Map(fechados.map((c) => [c.caixaCodigo, c.pdvLabel]))

    return {
      kpis: { liquida, faltas, faltasCount, sobras, sobrasCount, comDiferenca, totalConferidos: fechados.length },
      porResponsavel,
      porForma,
      formaPorPosto,
      naoConferidoCount: semQuebraCount,
      porDia,
      topCaixas,
      caixaCodigos,
      pdvByCaixa,
      isLoading,
      hasEmpresa,
    }
  }, [turnoRows, conferenciaPdv, isLoading, hasEmpresa])
}

export default useDiferencasCaixa
