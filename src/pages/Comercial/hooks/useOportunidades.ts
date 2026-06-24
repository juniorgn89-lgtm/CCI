import { useMemo } from 'react'
import useRedeSetores from '@/pages/Dashboard/hooks/useRedeSetores'
import { useComercialFlags } from '@/store/comercialFlags'

/**
 * Fila priorizada de oportunidades de lucro. Orquestra 2 alavancas com dado
 * sólido (Margem de bomba + Conveniência). Frota fora do MVP (sem desconto de
 * contrato na API).
 *
 * FATO: margem/L, volume, gap vs média. ESTIMATIVA (rotulada): o `potencialMes`
 * (teto) — gap × volume assumindo volume constante; alvo CONSERVADOR (70% do
 * caminho até a média), nunca o "preço ótimo". Read-only: nada é escrito.
 */
export type Alavanca = 'margem' | 'conveniencia'

export interface Oportunidade {
  id: string
  alavanca: Alavanca
  titulo: string
  posto: string
  empresaCodigo: number
  subtitulo: string
  /** ESTIMATIVA (teto): R$ no período se fechar o gap conservador, volume constante. */
  potencial: number
  /** 0–100. Maior quando o dado é mais sólido (volume alto, cobertura de custo). */
  confianca: number
  /** de → para (margem/L) — só na alavanca de margem. */
  margemAtual: number | null
  margemAlvo: number | null
  /** Fração do gap fechada no cenário base (0.7 margem, 0.5 conv) — usada pelo
   *  "Simular" what-if: o potencial é linear na fração, então escala direto. */
  fracBase: number
  comoEstimou: string[]
  risco: string
}

export interface OportunidadesData {
  isLoading: boolean
  hasRede: boolean
  oportunidades: Oportunidade[]
  potencialTotal: number
  redeMargemL: number
  /** Alavanca com maior potencial somado. */
  maiorAlavanca: { alavanca: Alavanca; total: number } | null
  /** Item de maior R$ por esforço (1 ajuste) — atalho da hero. */
  acaoRapida: Oportunidade | null
  /** Flag ligada mas sem praça cadastrada (aba 4) → referência segue interna. */
  pracaIndisponivel: boolean
}

const lbL = (v: number) => `R$ ${v.toFixed(3).replace('.', ',')}`
const milShort = (v: number) =>
  v >= 1000 ? `R$ ${(v / 1000).toFixed(1).replace('.', ',')} mil` : `R$ ${Math.round(v)}`

const useOportunidades = (): OportunidadesData => {
  const rede = useRedeSetores()
  const usarPraca = useComercialFlags((s) => s.usarPrecoPraca)

  return useMemo(() => {
    const comb = rede.combustivel
    const conv = rede.conveniencia

    // ── Alavanca Margem de bomba: posto × combustível abaixo da média da rede ──
    // média/L da rede por combustível (ponderada por volume).
    const fuelTot = new Map<number, { lb: number; litros: number; nome: string }>()
    for (const p of comb.postos) {
      for (const pr of p.produtos) {
        const t = fuelTot.get(pr.produtoCodigo) ?? { lb: 0, litros: 0, nome: pr.produto }
        t.lb += pr.lucroBruto
        t.litros += pr.qtd
        fuelTot.set(pr.produtoCodigo, t)
      }
    }
    const fuelAvg = (cod: number) => {
      const t = fuelTot.get(cod)
      return t && t.litros > 0 ? t.lb / t.litros : 0
    }

    const margemOps: Oportunidade[] = []
    const minVol = comb.qtd * 0.005 // ignora combustível irrelevante (<0,5% do volume)
    for (const p of comb.postos) {
      for (const pr of p.produtos) {
        if (pr.precoCusto <= 0 || pr.qtd < minVol) continue
        const avg = fuelAvg(pr.produtoCodigo)
        const atual = pr.lbPorUnidade
        const gap = avg - atual
        if (gap <= 0.005) continue // já na média ou acima
        const alvo = atual + 0.7 * gap // alvo conservador (70% do caminho)
        const potencial = (alvo - atual) * pr.qtd
        if (potencial < 300) continue
        const belowPct = avg > 0 ? (gap / avg) * 100 : 0
        const conf = Math.round(Math.min(90, 70 + Math.min(18, (pr.qtd / Math.max(1, comb.qtd)) * 100)))
        margemOps.push({
          id: `m-${p.empresaCodigo}-${pr.produtoCodigo}`,
          alavanca: 'margem',
          titulo: 'Margem de bomba abaixo da rede',
          posto: p.posto,
          empresaCodigo: p.empresaCodigo,
          subtitulo: `${p.posto} · ${pr.produto} · margem ${lbL(atual)} vs ${lbL(avg)} da rede`,
          potencial,
          confianca: conf,
          margemAtual: atual,
          margemAlvo: alvo,
          fracBase: 0.7,
          comoEstimou: [
            `${p.posto} pratica ${lbL(atual)} de margem no ${pr.produto} — ${belowPct.toFixed(0)}% abaixo da média da rede (${lbL(avg)}).`,
            `Volume de ${Math.round(pr.qtd).toLocaleString('pt-BR')} L no período: cada R$ 0,01/L recuperado = ${milShort(pr.qtd * 0.01)}.`,
            `Alvo conservador ${lbL(alvo)} (70% do caminho até a média) × volume = estimativa de ${milShort(potencial)}.`,
          ],
          risco: 'Combustível sensível a preço/frota — subir gradual e monitorar volume; o alvo já fica abaixo do líder pra preservar competitividade.',
        })
      }
    }

    // ── Alavanca Conveniência: posto com margem da loja abaixo da média da rede ──
    const convAvgPct = conv.margem // % margem da conveniência da rede
    const convOps: Oportunidade[] = []
    for (const p of conv.postos) {
      if (p.faturamento <= 0) continue
      const gapPct = convAvgPct - p.margem
      if (gapPct <= 1) continue
      // conservador: fecha metade do gap de margem sobre o faturamento da loja.
      const potencial = (gapPct / 100) * 0.5 * p.faturamento
      if (potencial < 300) continue
      convOps.push({
        id: `c-${p.empresaCodigo}`,
        alavanca: 'conveniencia',
        titulo: 'Mix de conveniência abaixo do potencial',
        posto: p.posto,
        empresaCodigo: p.empresaCodigo,
        subtitulo: `${p.posto} · margem da loja ${p.margem.toFixed(0)}% vs ${convAvgPct.toFixed(0)}% da rede`,
        potencial,
        confianca: 72,
        margemAtual: null,
        margemAlvo: null,
        fracBase: 0.5,
        comoEstimou: [
          `A loja do ${p.posto} roda ${p.margem.toFixed(0)}% de margem — ${(gapPct).toFixed(0)} p.p. abaixo da média da rede (${convAvgPct.toFixed(0)}%).`,
          `Faturamento de loja de ${milShort(p.faturamento)} no período.`,
          `Fechar metade do gap de margem = estimativa de ${milShort(potencial)} (assume mix migrando pra itens de maior margem, sem vender mais unidades).`,
        ],
        risco: 'Depende de execução de mix/planograma (não é só preço). Estimativa mais incerta que a de combustível — priorizar onde o gap é maior.',
      })
    }

    const oportunidades = [...margemOps, ...convOps].sort((a, b) => b.potencial - a.potencial)
    const potencialTotal = oportunidades.reduce((s, o) => s + o.potencial, 0)

    const totalByAlavanca = new Map<Alavanca, number>()
    for (const o of oportunidades) totalByAlavanca.set(o.alavanca, (totalByAlavanca.get(o.alavanca) ?? 0) + o.potencial)
    let maiorAlavanca: { alavanca: Alavanca; total: number } | null = null
    for (const [alavanca, total] of totalByAlavanca) {
      if (!maiorAlavanca || total > maiorAlavanca.total) maiorAlavanca = { alavanca, total }
    }

    // ação rápida = maior potencial entre as de "1 ajuste" (alavanca de margem).
    const acaoRapida = oportunidades.find((o) => o.alavanca === 'margem') ?? null

    return {
      isLoading: rede.isLoading,
      hasRede: rede.hasRede,
      oportunidades,
      potencialTotal,
      redeMargemL: comb.lucroPorUnidade,
      maiorAlavanca,
      acaoRapida,
      pracaIndisponivel: usarPraca, // praça só ganha base na aba 4
    }
  }, [rede, usarPraca])
}

// reexport util de formatação curta pro componente
export { milShort }
export default useOportunidades
