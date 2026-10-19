import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PRECO_VELHO_DIAS } from '@/pages/Comercial/hooks/useConcorrencia'
import useComercialData from '@/pages/Comercial/hooks/useComercialData'
import useRedeSetores from '@/pages/Dashboard/hooks/useRedeSetores'
import { useTenantStore } from '@/store/tenant'
import { useFilterStore } from '@/store/filters'
import useConcorrenciaPostos from '@/pages/Comercial/hooks/useConcorrenciaPostos'
import usePrecoBomba from '@/pages/Comercial/hooks/usePrecoBomba'
import { fetchConcorrenciaPrecosRede, classifyFuelSlug, type FuelSlug, type ConcorrenciaPrecoRow } from '@/api/supabase/concorrencia'
import { FAIXA_PISO, FAIXA_APERTADA, FAIXA_SAUDAVEL } from '@/lib/radarClassificacao'

/**
 * A RÉGUA DE PREÇO — uma regra só por posto × combustível, que substitui as
 * duas leituras antigas (Oportunidades: lucro/L vs média da rede; Radar: margem %
 * vs faixas). Três referências na mesma linha, tudo em R$/L:
 *   piso (custo) · referência (praça do posto, se cadastrada e a flag ligada;
 *   senão a média da rede) · preço atual.
 * E um veredito só:
 *   SUBIR    — preço abaixo da referência, com volume: vale (alvo − preço) × litros.
 *   SEGURAR  — na referência, ou perto do piso (aí nunca "ceder").
 *   CEDER    — acima da referência e com margem saudável: até X/L sem passar
 *              da referência nem descer da margem apertada.
 *   CONFIRMAR — a leitura seria "ceder", mas o custo é velho ou sem data:
 *              confirmar antes de cortar (custo velho infla a margem).
 * Regra fixa sobre venda e custo apurados. Nada de IA, nada gravado.
 */

export type Veredito = 'subir' | 'segurar' | 'ceder' | 'confirmar'
export type Frescor = 'ok' | 'warn' | 'old' | 'unknown'
export type TipoReferencia = 'praca' | 'rede'

export const FRESCOR_OK = 3
export const FRESCOR_WARN = 10
export const frescorDe = (dias: number | null): Frescor => (dias == null ? 'unknown' : dias <= FRESCOR_OK ? 'ok' : dias <= FRESCOR_WARN ? 'warn' : 'old')

/** Gap mínimo (R$/L) pra sair de "segurar". */
const GAP_MINIMO = 0.02
/** Fração do caminho até a média da rede no alvo conservador (praça = 100%). */
const FRAC_REDE = 0.7

export interface CardPreco {
  id: string
  empresaCodigo: number
  posto: string
  fuel: string
  produtoCodigo: number
  slug: FuelSlug | null
  /** Preço de BOMBA hoje (tabela). Cai na média vendida quando não há tabela. */
  preco: number
  /** Média vendida no período (faturamento ÷ litros), base da margem realizada. */
  precoMedio: number
  precoFonte: 'bomba' | 'media'
  custo: number
  /** Lucro bruto por litro hoje (folga sobre o piso). */
  lbL: number
  margemPct: number
  litros: number
  volumeDia: number
  custoStaleDays: number | null
  frescor: Frescor
  /** n = quantos vizinhos do posto entraram na média (só em 'praca'). */
  referencia: { tipo: TipoReferencia; preco: number; lbL: number; staleDias: number | null; n?: number } | null
  /** Referência − preço (R$/L). Positivo = estou abaixo da referência. */
  gapL: number
  veredito: Veredito
  /** Manchete da ação, com o número: "Subir R$ 0,04/L". */
  acao: string
  /** Frase curta do porquê. */
  motivo: string
  /** R$/L envolvido: quanto subir, ou até quanto dá pra ceder. 0 em segurar. */
  quantoL: number
  /** Só em SUBIR: (alvo − preço) × litros do período. */
  valor: number
  alvoPreco: number | null
  porque: string[]
  risco: string | null
}

export interface CardLoja {
  empresaCodigo: number
  posto: string
  margemPct: number
  redeMargemPct: number
  faturamento: number
  /** Metade do gap de margem × faturamento (estimativa conservadora). */
  valor: number
  porque: string[]
}

export interface ReguaPreco {
  isLoading: boolean
  hasRede: boolean
  cards: CardPreco[]
  loja: CardLoja[]
  totais: { postos: number; subir: number; subirValor: number; segurar: number; ceder: number; confirmar: number; custoVelho: number; semData: number }
  /** Quantos cards usam os vizinhos como referência (0 = tudo pela média da rede). */
  comPraca: number
  /** Postos em que o dono ligou "usar os vizinhos" × total de postos na régua. */
  postosComVizinhos: number
  totalPostos: number
}

const moneyL = (v: number) => `R$ ${v.toFixed(3).replace('.', ',')}`
const money2 = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`
const milShort = (v: number) => (v >= 1000 ? `R$ ${(v / 1000).toFixed(1).replace('.', ',')} mil` : `R$ ${Math.round(v)}`)
const isoMinusDays = (iso: string, n: number): string => { const [y, m, d] = iso.split('-').map(Number); const dt = new Date(y, m - 1, d - n); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}` }
const diffDays = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86_400_000)

const REDE_WIDE: number[] = []

export const useReguaPreco = (): ReguaPreco => {
  const data = useComercialData()
  const bomba = usePrecoBomba()
  const setores = useRedeSetores({ empresaCodigos: REDE_WIDE })
  // Uso dos vizinhos é decisão POR POSTO (salva no sistema), não um flag global.
  const cfgVizinhos = useConcorrenciaPostos()
  const porPostoCfg = cfgVizinhos.porPosto
  const redeId = useTenantStore((s) => s.rede?.id ?? null)
  const dataFinal = useFilterStore((s) => s.dataFinal)
  const desde = useMemo(() => isoMinusDays(dataFinal, 30), [dataFinal])
  const { data: pracaRows = [] } = useQuery({
    queryKey: ['oportunidades-praca-rede', redeId, desde],
    queryFn: () => fetchConcorrenciaPrecosRede({ desde }),
    enabled: !!redeId,
    staleTime: 60 * 1000,
  })

  return useMemo<ReguaPreco>(() => {
    // Praça por (posto, slug) = média SIMPLES dos vizinhos DAQUELE posto, com a
    // última observação de cada um, só os de até PRECO_VELHO_DIAS. Mesma conta da
    // aba Concorrência. Vizinhos velhos não entram (contados à parte p/ avisar).
    const pracaPor = new Map<string, { preco: number; stale: number; n: number }>()
    const velhosPor = new Map<string, number>()
    const usaVizinhos = (emp: number) => porPostoCfg.get(emp)?.usar ?? false
    if (pracaRows.length) {
      const porEmpresa = new Map<number, ConcorrenciaPrecoRow[]>()
      for (const r of pracaRows) { const a = porEmpresa.get(r.empresa_codigo) ?? []; a.push(r); porEmpresa.set(r.empresa_codigo, a) }
      for (const [emp, rows] of porEmpresa) {
        if (!usaVizinhos(emp)) continue
        const atual = new Map<string, ConcorrenciaPrecoRow>()
        for (const r of rows) {
          const k = `${r.concorrente_nome}|${r.combustivel}`
          const p = atual.get(k)
          if (!p || r.observado_em > p.observado_em || (r.observado_em === p.observado_em && r.created_at > p.created_at)) atual.set(k, r)
        }
        const agg = new Map<string, { num: number; den: number; stale: number }>()
        for (const r of atual.values()) {
          const st = Math.max(0, diffDays(r.observado_em, dataFinal))
          if (st > PRECO_VELHO_DIAS) { const k = `${emp}|${r.combustivel}`; velhosPor.set(k, (velhosPor.get(k) ?? 0) + 1); continue }
          const a = agg.get(r.combustivel) ?? { num: 0, den: 0, stale: 0 }
          a.num += r.preco; a.den += 1; a.stale = Math.max(a.stale, st)
          agg.set(r.combustivel, a)
        }
        for (const [slug, a] of agg) if (a.den > 0) pracaPor.set(`${emp}|${slug}`, { preco: a.num / a.den, stale: a.stale, n: a.den })
      }
    }

    // Média da rede por produto (lucro por litro), base da referência interna.
    const tot = new Map<number, { lb: number; litros: number }>()
    for (const p of data.postos) for (const f of p.produtos) { if (!f.comCusto || f.litros <= 0) continue; const t = tot.get(f.produtoCodigo) ?? { lb: 0, litros: 0 }; t.lb += f.lucroBruto; t.litros += f.litros; tot.set(f.produtoCodigo, t) }
    const lbRede = (cod: number) => { const t = tot.get(cod); return t && t.litros > 0 ? t.lb / t.litros : 0 }
    const minVol = data.redeLitros * 0.005

    const cards: CardPreco[] = []
    for (const p of data.postos) {
      for (const f of p.produtos) {
        if (!f.comCusto || f.litros <= 0 || f.precoCusto <= 0) continue
        const margemPct = f.faturamento > 0 ? (f.lucroBruto / f.faturamento) * 100 : 0
        const slug = classifyFuelSlug(f.nome)
        const frescor = frescorDe(p.custoStaleDays)
        const praca = slug ? pracaPor.get(`${p.empresaCodigo}|${slug}`) : undefined
        const referencia = praca
          ? { tipo: 'praca' as const, preco: praca.preco, lbL: praca.preco - f.precoCusto, staleDias: praca.stale, n: praca.n }
          : lbRede(f.produtoCodigo) > 0 ? { tipo: 'rede' as const, preco: f.precoCusto + lbRede(f.produtoCodigo), lbL: lbRede(f.produtoCodigo), staleDias: null } : null
        // "Meu preço" = o de BOMBA hoje (mesmo número da Concorrência e da análise
        // do posto). Vizinho é preço de bomba observado: bomba × bomba.
        const pb = bomba.get(p.empresaCodigo, f.produtoCodigo)
        const precoHoje = pb?.preco ?? f.precoVenda
        const gapL = referencia ? referencia.preco - precoHoje : 0
        const refNome = referencia?.tipo === 'praca' ? (referencia.n === 1 ? 'do vizinho' : `da média dos ${referencia.n} vizinhos`) : 'da média da rede'
        const velhos = slug && usaVizinhos(p.empresaCodigo) ? velhosPor.get(`${p.empresaCodigo}|${slug}`) ?? 0 : 0
        const porque: string[] = [
          pb
            ? `${p.posto} está com ${f.nome} a ${moneyL(precoHoje)}/L na bomba hoje. No período vendeu em média a ${moneyL(f.precoVenda)}/L com custo ${moneyL(f.precoCusto)}/L: sobrou ${moneyL(f.margemL)}/L (margem ${margemPct.toFixed(1).replace('.', ',')}%).`
            : `${p.posto} vendeu ${f.nome} em média a ${moneyL(f.precoVenda)}/L (sem preço de tabela recente) com custo ${moneyL(f.precoCusto)}/L: sobrou ${moneyL(f.margemL)}/L (margem ${margemPct.toFixed(1).replace('.', ',')}%).`,
        ]
        if (referencia) porque.push(referencia.tipo === 'praca' ? `${referencia.n === 1 ? 'O único vizinho com preço atualizado' : `A média dos ${referencia.n} vizinhos deste posto`} está em ${moneyL(referencia.preco)}/L (preço mais antigo de ${referencia.staleDias ?? 0} dias; cada vizinho pesa igual).` : `A média da rede neste combustível sobra ${moneyL(referencia.lbL)}/L, o que daria ${moneyL(referencia.preco)}/L com este custo.`)
        if (velhos > 0) porque.push(`${velhos} vizinho${velhos === 1 ? '' : 's'} com preço de mais de ${PRECO_VELHO_DIAS} dias ficou fora da conta. Atualize na aba Concorrência.`)

        let veredito: Veredito = 'segurar'
        let acao = 'Segurar o preço'
        let motivo = ''
        let quantoL = 0
        let valor = 0
        let alvoPreco: number | null = null
        let risco: string | null = null

        if (referencia && gapL >= GAP_MINIMO && f.litros >= minVol) {
          const frac = referencia.tipo === 'praca' ? 1 : FRAC_REDE
          alvoPreco = precoHoje + frac * gapL
          quantoL = alvoPreco - precoHoje
          valor = quantoL * f.litros
          veredito = 'subir'
          acao = `Subir ${money2(quantoL)}/L`
          motivo = `${moneyL(gapL)}/L abaixo ${refNome}. Com ${Math.round(f.litros).toLocaleString('pt-BR')} L no período, cada R$ 0,01/L vale ${milShort(f.litros * 0.01)}.`
          porque.push(referencia.tipo === 'praca' ? `Alinhar aos vizinhos: ${moneyL(quantoL)}/L × ${Math.round(f.litros).toLocaleString('pt-BR')} L = ${milShort(valor)} no período.` : `Alvo conservador: 70% do caminho até a média (${moneyL(alvoPreco)}/L) × ${Math.round(f.litros).toLocaleString('pt-BR')} L = ${milShort(valor)} no período.`)
          risco = referencia.tipo === 'praca' ? `Subir gradual e acompanhar o volume: a conta assume que o litro não cai.${referencia.n === 1 ? ' Baseado em 1 concorrente só: confira os outros vizinhos.' : ''}` : 'Comparação com a própria rede, não com a rua. Pode haver motivo local (mais concorrência). Cadastre a praça deste posto para a régua certa.'
        } else if (margemPct < FAIXA_PISO) {
          veredito = 'segurar'
          acao = 'Segurar: não corte'
          motivo = `Margem ${margemPct.toFixed(1).replace('.', ',')}% encosta no piso ${moneyL(f.precoCusto)}/L. Cortar aqui vende no prejuízo.`
        } else if (referencia && gapL <= -GAP_MINIMO && margemPct >= FAIXA_SAUDAVEL) {
          // Até onde dá pra ceder: não passar da referência nem descer da margem apertada.
          const precoMin = f.precoCusto / (1 - FAIXA_APERTADA / 100)
          const ate = Math.max(0, Math.min(-gapL, precoHoje - precoMin))
          if (ate >= 0.01) {
            quantoL = ate
            alvoPreco = precoHoje - ate
            if (frescor === 'old' || frescor === 'unknown') {
              veredito = 'confirmar'
              acao = 'Confirmar o custo antes de ceder'
              motivo = `Daria para ceder até ${money2(ate)}/L, mas o custo ${frescor === 'old' ? `é de ${p.custoStaleDays} dias atrás` : 'está sem data'}. Se subiu, essa folga não existe.`
            } else {
              veredito = 'ceder'
              acao = `Pode ceder até ${money2(ate)}/L`
              motivo = `${moneyL(-gapL)}/L acima ${refNome} com margem ${margemPct.toFixed(1).replace('.', ',')}%. Até ${moneyL(alvoPreco)}/L continua acima do piso e da margem apertada.`
            }
            porque.push(`Teto do corte = o menor entre voltar à referência (${moneyL(-gapL)}/L) e manter ${FAIXA_APERTADA}% de margem (${moneyL(precoHoje - precoMin)}/L).`)
          } else {
            motivo = `Acima d${refNome.slice(1)}, mas sem folga real para ceder sem apertar a margem.`
          }
        } else if (margemPct < FAIXA_APERTADA) {
          motivo = `Margem ${margemPct.toFixed(1).replace('.', ',')}% apertada e preço na referência. Só corte se trouxer volume.`
        } else {
          motivo = referencia ? `Preço na referência (${moneyL(referencia.preco)}/L) com margem ${margemPct.toFixed(1).replace('.', ',')}%. Segure e observe.` : 'Sem referência para este combustível: segure e observe.'
        }
        if (veredito !== 'confirmar' && (frescor === 'old' || frescor === 'unknown')) porque.push(frescor === 'old' ? `Custo de ${p.custoStaleDays} dias atrás: confirme antes de mexer no preço.` : 'Custo sem data confirmada: a margem pode estar diferente do que aparece.')

        cards.push({
          id: `${p.empresaCodigo}:${f.produtoCodigo}`, empresaCodigo: p.empresaCodigo, posto: p.posto, fuel: f.nome, produtoCodigo: f.produtoCodigo, slug,
          preco: precoHoje, precoMedio: f.precoVenda, precoFonte: pb ? 'bomba' : 'media', custo: f.precoCusto, lbL: f.margemL, margemPct, litros: f.litros, volumeDia: p.diasOperados > 0 ? f.litros / p.diasOperados : f.litros,
          custoStaleDays: p.custoStaleDays, frescor, referencia, gapL, veredito, acao, motivo, quantoL, valor, alvoPreco, porque, risco,
        })
      }
    }

    // Loja: margem da conveniência abaixo da média da rede (metade do gap × faturamento).
    const conv = setores.conveniencia
    const loja: CardLoja[] = []
    for (const p of conv.postos) {
      if (p.faturamento <= 0) continue
      const gap = conv.margem - p.margem
      if (gap <= 1) continue
      const valor = (gap / 100) * 0.5 * p.faturamento
      if (valor < 300) continue
      loja.push({ empresaCodigo: p.empresaCodigo, posto: p.posto, margemPct: p.margem, redeMargemPct: conv.margem, faturamento: p.faturamento, valor, porque: [
        `A loja do ${p.posto} roda ${p.margem.toFixed(0)}% de margem, ${gap.toFixed(0)} pontos abaixo da média da rede (${conv.margem.toFixed(0)}%).`,
        `Faturamento de loja de ${milShort(p.faturamento)} no período. Fechar metade do gap de margem vale ${milShort(valor)}, mudando o mix, não o volume.`,
      ] })
    }
    loja.sort((a, b) => b.valor - a.valor)

    const postos = new Set(cards.map((c) => c.empresaCodigo)).size
    const n = (v: Veredito) => cards.filter((c) => c.veredito === v).length
    return {
      isLoading: data.isLoading || setores.isLoading,
      hasRede: data.hasRede,
      cards,
      loja,
      totais: { postos, subir: n('subir'), subirValor: cards.filter((c) => c.veredito === 'subir').reduce((s, c) => s + c.valor, 0), segurar: n('segurar'), ceder: n('ceder'), confirmar: n('confirmar'), custoVelho: cards.filter((c) => c.frescor === 'old').length, semData: cards.filter((c) => c.frescor === 'unknown').length },
      comPraca: cards.filter((c) => c.referencia?.tipo === 'praca').length,
      postosComVizinhos: data.postos.filter((p) => usaVizinhos(p.empresaCodigo)).length,
      totalPostos: data.postos.length,
    }
  }, [data, setores, pracaRows, porPostoCfg, dataFinal, bomba])
}

export { milShort, moneyL }
export default useReguaPreco
