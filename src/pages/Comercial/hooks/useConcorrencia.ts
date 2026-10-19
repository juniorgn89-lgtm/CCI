import { useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useTenantStore } from '@/store/tenant'
import { useFilterStore } from '@/store/filters'
import useRedeSetores from '@/pages/Dashboard/hooks/useRedeSetores'
import usePrecoBomba from '@/pages/Comercial/hooks/usePrecoBomba'
import {
  fetchConcorrenciaPrecos, classifyFuelSlug, FUEL_SLUGS, FUEL_LABEL,
  type FuelSlug, type ConcorrenciaPrecoRow,
} from '@/api/supabase/concorrencia'

/**
 * Concorrência por posto: cruza preço de praça MANUAL (concorrencia_precos,
 * fato sobre dado manual) com o MEU preço e volume (fato: faturamento/litros).
 *
 * FATO: meu preço, meu volume, minha série 30d, gap/índice (sobre o dado manual).
 * MANUAL: preço do concorrente (frescor sustenta "preciso"). NADA é escrito aqui.
 */

/** Preço de vizinho com mais dias que isso fica FORA da média (aparece marcado). */
export const PRECO_VELHO_DIAS = 7

/** Um vizinho = um posto físico perto do meu posto (cada posto tem a sua lista). */
export interface CompetidorAtual {
  nome: string
  preco: number
  observadoEm: string
  staleDays: number
  /** true = preço com mais de PRECO_VELHO_DIAS dias: não entra na média. */
  velho: boolean
}
export interface FuelView {
  slug: FuelSlug
  label: string
  myPrice: number | null
  myVolume: number
  competidores: CompetidorAtual[]
  /** Média SIMPLES dos vizinhos com preço atualizado (até PRECO_VELHO_DIAS). */
  mediaVizinhos: number | null
  /** Quantos vizinhos entraram na média. */
  vizinhosNaConta: number
  indice: number | null
  gap: number | null
  /** Frescor DESTE combustível = pior (maior) stale entre seus concorrentes.
   *  `null` quando não há concorrente cadastrado. Usado no badge do gráfico
   *  (antes ele mostrava o stale GLOBAL, que não batia com o combustível). */
  maxStaleDays: number | null
}
export interface ConcorrenciaData {
  isLoading: boolean
  redeId: string | null
  postos: { empresaCodigo: number; posto: string }[]
  byFuel: FuelView[]
  indiceGeral: number | null
  ondePossoSubir: { slug: FuelSlug; label: string; gap: number } | null
  ondeEstouCaro: { slug: FuelSlug; label: string; gap: number } | null
  ganhoPricing: number
  freshnessMaxStaleDays: number | null
  hasPraca: boolean
  /** true enquanto os preços na tela ainda são do posto ANTERIOR (troca de posto).
   *  O editor não pode montar nesse estado, senão herda os vizinhos errados. */
  trocandoPosto: boolean
  /** Autor do último lançamento por concorrente (quem lançou · data). */
  autores: Record<string, { porNome: string | null; em: string }>
}

const isoMinusDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d - n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
const diffDays = (fromIso: string, toIso: string) =>
  Math.round((new Date(`${toIso}T00:00:00`).getTime() - new Date(`${fromIso}T00:00:00`).getTime()) / 86_400_000)

// Comercial é REDE-WIDE → o "Meu posto" é seletor PRÓPRIO desta aba, então o
// useRedeSetores precisa de TODOS os postos (ignora o filtro global). Ref estável.
const REDE_WIDE: number[] = []

const useConcorrencia = (empresaCodigo: number | null): ConcorrenciaData => {
  const redeId = useTenantStore((s) => s.rede?.id ?? null)
  const dataFinal = useFilterStore((s) => s.dataFinal)
  const hoje = dataFinal // âncora de "hoje" coerente com o filtro
  const desde = useMemo(() => isoMinusDays(hoje, 30), [hoje])
  const rede = useRedeSetores({ empresaCodigos: REDE_WIDE })
  const bomba = usePrecoBomba()

  const { data: precos = [], isLoading: lP, isPlaceholderData: trocandoPosto } = useQuery({
    queryKey: ['concorrencia', empresaCodigo, desde],
    queryFn: () => fetchConcorrenciaPrecos({ empresaCodigo: empresaCodigo!, desde }),
    enabled: empresaCodigo != null,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })

  return useMemo(() => {
    const postos = rede.combustivel.postos.map((p) => ({ empresaCodigo: p.empresaCodigo, posto: p.posto }))

    // Meu preço por slug = preço de BOMBA hoje (o mesmo da régua e da análise do
    // posto); sem tabela recente, a média vendida no período. Volume = período.
    const myBySlug = new Map<FuelSlug, { preco: number; volume: number }>()
    const posto = rede.combustivel.postos.find((p) => p.empresaCodigo === empresaCodigo)
    if (posto) {
      for (const pr of posto.produtos) {
        const slug = classifyFuelSlug(pr.produto)
        if (!slug || pr.precoVenda <= 0) continue
        const cur = myBySlug.get(slug) ?? { preco: 0, volume: 0 }
        const preco = bomba.get(posto.empresaCodigo, pr.produtoCodigo)?.preco ?? pr.precoVenda
        // pondera preço por volume quando há +de 1 produto no mesmo slug.
        cur.preco = cur.volume + pr.qtd > 0 ? (cur.preco * cur.volume + preco * pr.qtd) / (cur.volume + pr.qtd) : preco
        cur.volume += pr.qtd
        myBySlug.set(slug, cur)
      }
    }

    // Concorrente: preço ATUAL = última linha por (nome, slug): max(observado_em)
    // → desempate max(created_at) (resolve duplicata do mesmo dia).
    const atualByKey = new Map<string, ConcorrenciaPrecoRow>()
    for (const r of precos) {
      const key = `${r.concorrente_nome}|${r.combustivel}`
      const prev = atualByKey.get(key)
      if (!prev || r.observado_em > prev.observado_em || (r.observado_em === prev.observado_em && r.created_at > prev.created_at)) {
        atualByKey.set(key, r)
      }
    }

    const compBySlug = new Map<FuelSlug, CompetidorAtual[]>()
    let freshnessMaxStaleDays: number | null = null
    for (const r of atualByKey.values()) {
      // Clamp em 0: se `observado_em` for futuro (relógio/âncora), stale negativo
      // gerava confiança > 100% e frescor sempre "ok". Nunca menos que hoje.
      const stale = Math.max(0, diffDays(r.observado_em, hoje))
      if (freshnessMaxStaleDays == null || stale > freshnessMaxStaleDays) freshnessMaxStaleDays = stale
      const arr = compBySlug.get(r.combustivel) ?? []
      arr.push({ nome: r.concorrente_nome, preco: r.preco, observadoEm: r.observado_em, staleDays: stale, velho: stale > PRECO_VELHO_DIAS })
      compBySlug.set(r.combustivel, arr)
    }

    const byFuel: FuelView[] = []
    for (const slug of FUEL_SLUGS) {
      const my = myBySlug.get(slug)
      const competidores = (compBySlug.get(slug) ?? []).sort((a, b) => a.nome.localeCompare(b.nome))
      if (!my && competidores.length === 0) continue
      // Cada vizinho pesa igual; preço velho fica fora da conta (mas aparece na lista).
      const atualizados = competidores.filter((c) => !c.velho)
      const vizinhosNaConta = atualizados.length
      const mediaVizinhos = vizinhosNaConta > 0 ? atualizados.reduce((s, c) => s + c.preco, 0) / vizinhosNaConta : null
      const myPrice = my?.preco ?? null
      const gap = myPrice != null && mediaVizinhos != null ? mediaVizinhos - myPrice : null
      const indice = myPrice != null && mediaVizinhos != null && mediaVizinhos > 0 ? (myPrice / mediaVizinhos) * 100 : null
      const maxStaleDays = competidores.length > 0 ? Math.max(...competidores.map((c) => c.staleDays)) : null
      byFuel.push({
        slug, label: FUEL_LABEL[slug],
        myPrice, myVolume: my?.volume ?? 0,
        competidores, mediaVizinhos, vizinhosNaConta, indice, gap, maxStaleDays,
      })
    }

    // KPIs agregados (ponderados por volume onde faz sentido).
    let somaIdxNum = 0, somaIdxDen = 0, ganhoPricing = 0
    let ondePossoSubir: ConcorrenciaData['ondePossoSubir'] = null
    let ondeEstouCaro: ConcorrenciaData['ondeEstouCaro'] = null
    for (const f of byFuel) {
      if (f.myPrice != null && f.mediaVizinhos != null) {
        somaIdxNum += f.myPrice * f.myVolume
        somaIdxDen += f.mediaVizinhos * f.myVolume
        if (f.gap != null && f.gap > 0) {
          ganhoPricing += f.gap * f.myVolume
          if (!ondePossoSubir || f.gap > ondePossoSubir.gap) ondePossoSubir = { slug: f.slug, label: f.label, gap: f.gap }
        }
        if (f.gap != null && f.gap < 0) {
          if (!ondeEstouCaro || f.gap < ondeEstouCaro.gap) ondeEstouCaro = { slug: f.slug, label: f.label, gap: f.gap }
        }
      }
    }
    // Ponderado por volume; mas se o volume vier 0 pra todos (ex.: sem venda no
    // período, com preço e praça cadastrados), cai na MÉDIA SIMPLES dos índices
    // por combustível — senão o KPI dizia "cadastre a praça" mesmo com praça.
    const indicesValidos = byFuel.map((f) => f.indice).filter((v): v is number => v != null)
    const indiceGeral = somaIdxDen > 0
      ? (somaIdxNum / somaIdxDen) * 100
      : (indicesValidos.length > 0 ? indicesValidos.reduce((s, v) => s + v, 0) / indicesValidos.length : null)

    // Autor do ÚLTIMO lançamento por concorrente (max created_at) — "quem lançou".
    const autores: Record<string, { porNome: string | null; em: string }> = {}
    const autorAt: Record<string, string> = {}
    for (const r of precos) {
      if (!autores[r.concorrente_nome] || r.created_at > autorAt[r.concorrente_nome]) {
        autores[r.concorrente_nome] = { porNome: r.created_by_nome, em: r.observado_em }
        autorAt[r.concorrente_nome] = r.created_at
      }
    }

    return {
      isLoading: (lP && precos.length === 0) || rede.isLoading,
      redeId,
      postos,
      byFuel,
      indiceGeral,
      ondePossoSubir,
      ondeEstouCaro,
      ganhoPricing,
      freshnessMaxStaleDays,
      hasPraca: atualByKey.size > 0,
      trocandoPosto,
      autores,
    }
  }, [rede, bomba, precos, empresaCodigo, hoje, redeId, lP, trocandoPosto])
}

export default useConcorrencia
