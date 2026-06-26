import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import useRedeSetores from '@/pages/Dashboard/hooks/useRedeSetores'
import { useTenantStore } from '@/store/tenant'
import { useFilterStore } from '@/store/filters'
import {
  fetchConcorrenciaPrecosRede, classifyFuelSlug, FUEL_LABEL,
  type FuelSlug, type ConcorrenciaPrecoRow,
} from '@/api/supabase/concorrencia'

/**
 * Fila priorizada de oportunidades de lucro. Duas alavancas:
 *  - PRAÇA (por posto): combustível em que o posto está abaixo da praça LOCAL
 *    dele → alinhar ao preço de praça vale gap × volume. Mesma fórmula do
 *    "Ganho de pricing" da aba Concorrência (consistência entre módulos). Posto
 *    SEM praça cadastrada NÃO gera oportunidade (não há régua confiável).
 *  - CONVENIÊNCIA: margem da loja abaixo da média da rede.
 *
 * FATO: meu preço, volume, gap vs praça. ESTIMATIVA (rotulada): potencial (teto)
 * = gap × volume a custo/volume constante. Read-only: nada é escrito.
 */
export type Alavanca = 'praca' | 'margem' | 'conveniencia'

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
  /** de → para: meu preço → praça (R$/L) — só na alavanca de praça. */
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
const isoMinusDays = (iso: string, n: number): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d - n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
const diffDays = (fromIso: string, toIso: string): number =>
  Math.round((new Date(`${toIso}T00:00:00`).getTime() - new Date(`${fromIso}T00:00:00`).getTime()) / 86_400_000)

const useOportunidades = (): OportunidadesData => {
  const rede = useRedeSetores()
  const redeId = useTenantStore((s) => s.rede?.id ?? null)
  const dataFinal = useFilterStore((s) => s.dataFinal)
  const desde = useMemo(() => isoMinusDays(dataFinal, 30), [dataFinal])

  // Preço de praça de TODA a rede (últimos 30d) — rede-wide numa leitura só.
  const { data: pracaRows = [] } = useQuery({
    queryKey: ['oportunidades-praca-rede', redeId, desde],
    queryFn: () => fetchConcorrenciaPrecosRede({ desde }),
    enabled: !!redeId,
    staleTime: 60 * 1000,
  })

  return useMemo(() => {
    const comb = rede.combustivel
    const conv = rede.conveniencia

    // ── Alavanca PRAÇA: posto × combustível abaixo da praça LOCAL dele ──
    // Preço de praça por (posto, slug): última observação por concorrente, média
    // ponderada pelo nº de postos dele. MESMA fórmula do "Ganho de pricing" da
    // aba Concorrência → os números batem entre os módulos. Posto sem praça
    // cadastrada não entra (sem régua confiável, sem oportunidade).
    const precosByEmpresa = new Map<number, ConcorrenciaPrecoRow[]>()
    for (const r of pracaRows) {
      const arr = precosByEmpresa.get(r.empresa_codigo) ?? []
      arr.push(r)
      precosByEmpresa.set(r.empresa_codigo, arr)
    }

    const pracaOps: Oportunidade[] = []
    const pracaCovered = new Set<string>() // `${empresa}|${slug}` com praça → fora do fallback de rede
    for (const p of comb.postos) {
      const rows = precosByEmpresa.get(p.empresaCodigo)
      if (!rows || rows.length === 0) continue

      // praça ATUAL + frescor por slug: max(observado_em → created_at) por concorrente.
      const atualByKey = new Map<string, ConcorrenciaPrecoRow>()
      for (const r of rows) {
        const key = `${r.concorrente_nome}|${r.combustivel}`
        const prev = atualByKey.get(key)
        if (!prev || r.observado_em > prev.observado_em || (r.observado_em === prev.observado_em && r.created_at > prev.created_at)) {
          atualByKey.set(key, r)
        }
      }
      const agg = new Map<FuelSlug, { num: number; den: number; stale: number }>()
      for (const r of atualByKey.values()) {
        const a = agg.get(r.combustivel) ?? { num: 0, den: 0, stale: 0 }
        a.num += r.preco * r.concorrente_postos
        a.den += r.concorrente_postos
        a.stale = Math.max(a.stale, diffDays(r.observado_em, dataFinal))
        agg.set(r.combustivel, a)
      }

      // meu preço/volume por slug (precoVenda ponderado por volume).
      const myBySlug = new Map<FuelSlug, { preco: number; volume: number }>()
      for (const pr of p.produtos) {
        const slug = classifyFuelSlug(pr.produto)
        if (!slug || pr.precoVenda <= 0) continue
        const cur = myBySlug.get(slug) ?? { preco: 0, volume: 0 }
        cur.preco = cur.volume + pr.qtd > 0 ? (cur.preco * cur.volume + pr.precoVenda * pr.qtd) / (cur.volume + pr.qtd) : pr.precoVenda
        cur.volume += pr.qtd
        myBySlug.set(slug, cur)
      }

      for (const [slug, my] of myBySlug) {
        const a = agg.get(slug)
        if (!a || a.den <= 0 || my.volume <= 0) continue
        pracaCovered.add(`${p.empresaCodigo}|${slug}`) // tem praça → não cai no fallback de rede
        const praca = a.num / a.den
        const gap = praca - my.preco // >0 = posso subir até a praça
        if (gap <= 0.005) continue // já na praça ou acima
        const potencial = gap * my.volume // alinhar à praça, custo constante (= Concorrência)
        if (potencial < 300) continue
        const label = FUEL_LABEL[slug]
        const conf = Math.round(Math.max(40, Math.min(90, 90 - a.stale * 4))) // cai ~4pp/dia de defasagem da praça
        pracaOps.push({
          id: `p-${p.empresaCodigo}-${slug}`,
          alavanca: 'praca',
          titulo: 'Preço abaixo da praça',
          posto: p.posto,
          empresaCodigo: p.empresaCodigo,
          subtitulo: `${p.posto} · ${label} · meu ${lbL(my.preco)} vs praça ${lbL(praca)}`,
          potencial,
          confianca: conf,
          margemAtual: my.preco,
          margemAlvo: praca,
          fracBase: 1, // base = alinhar 100% à praça (igual ao "Ganho de pricing" da Concorrência)
          comoEstimou: [
            `${p.posto} pratica ${lbL(my.preco)} no ${label} — ${lbL(gap)}/L ABAIXO da praça local (${lbL(praca)}).`,
            `Volume de ${Math.round(my.volume).toLocaleString('pt-BR')} L no período: alinhar à praça = ${lbL(gap)}/L × volume = ${milShort(potencial)}.`,
            `Praça observada há ${a.stale}d (confiança ${conf}%). Mesma base do "Ganho de pricing" da aba Concorrência.`,
          ],
          risco: 'Alinhar à praça assume volume pouco sensível (sem elasticidade — roadmap). Subir gradual e monitorar volume/frota.',
        })
      }
    }

    // ── Alavanca MARGEM vs REDE (coexistência): posto × combustível abaixo da
    // média da rede. Pula combustível que já tem oportunidade de PRAÇA (régua
    // melhor) → sem dupla contagem. Sem praça cadastrada, TODOS entram aqui — é o
    // comportamento "por rede" de antes.
    const fuelTot = new Map<number, { lb: number; litros: number }>()
    for (const p of comb.postos) {
      for (const pr of p.produtos) {
        const t = fuelTot.get(pr.produtoCodigo) ?? { lb: 0, litros: 0 }
        t.lb += pr.lucroBruto
        t.litros += pr.qtd
        fuelTot.set(pr.produtoCodigo, t)
      }
    }
    const fuelAvg = (cod: number) => {
      const t = fuelTot.get(cod)
      return t && t.litros > 0 ? t.lb / t.litros : 0
    }
    const redeOps: Oportunidade[] = []
    const minVol = comb.qtd * 0.005 // ignora combustível irrelevante (<0,5% do volume)
    for (const p of comb.postos) {
      for (const pr of p.produtos) {
        if (pr.precoCusto <= 0 || pr.qtd < minVol) continue
        const slug = classifyFuelSlug(pr.produto)
        if (slug && pracaCovered.has(`${p.empresaCodigo}|${slug}`)) continue // já coberto pela praça
        const avg = fuelAvg(pr.produtoCodigo)
        const atual = pr.lbPorUnidade
        const gap = avg - atual
        if (gap <= 0.005) continue // já na média ou acima
        const alvo = atual + 0.7 * gap // alvo conservador (70% do caminho)
        const potencial = (alvo - atual) * pr.qtd
        if (potencial < 300) continue
        const belowPct = avg > 0 ? (gap / avg) * 100 : 0
        const conf = Math.round(Math.min(90, 70 + Math.min(18, (pr.qtd / Math.max(1, comb.qtd)) * 100)))
        redeOps.push({
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
          risco: 'Comparação interna (vs média da rede), não com a concorrência local. Pode haver motivo legítimo (mais concorrência/frota). Cadastre a praça pra a régua local.',
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

    const oportunidades = [...pracaOps, ...redeOps, ...convOps].sort((a, b) => b.potencial - a.potencial)
    const potencialTotal = oportunidades.reduce((s, o) => s + o.potencial, 0)

    const totalByAlavanca = new Map<Alavanca, number>()
    for (const o of oportunidades) totalByAlavanca.set(o.alavanca, (totalByAlavanca.get(o.alavanca) ?? 0) + o.potencial)
    let maiorAlavanca: { alavanca: Alavanca; total: number } | null = null
    for (const [alavanca, total] of totalByAlavanca) {
      if (!maiorAlavanca || total > maiorAlavanca.total) maiorAlavanca = { alavanca, total }
    }

    // ação rápida = maior potencial entre as de "1 ajuste" (preço: praça ou rede).
    const acaoRapida = oportunidades.find((o) => o.alavanca === 'praca' || o.alavanca === 'margem') ?? null

    return {
      isLoading: rede.isLoading,
      hasRede: rede.hasRede,
      oportunidades,
      potencialTotal,
      redeMargemL: comb.lucroPorUnidade,
      maiorAlavanca,
      acaoRapida,
      // Sem nenhuma praça cadastrada → a alavanca de preço não tem régua.
      pracaIndisponivel: pracaRows.length === 0,
    }
  }, [rede, pracaRows, dataFinal])
}

// reexport util de formatação curta pro componente
export { milShort }
export default useOportunidades
