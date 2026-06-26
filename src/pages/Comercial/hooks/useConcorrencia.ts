import { useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useTenantStore } from '@/store/tenant'
import { useFilterStore } from '@/store/filters'
import useRedeSetores from '@/pages/Dashboard/hooks/useRedeSetores'
import { fetchApuracaoFuelDiaria } from '@/api/supabase/apuracao'
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

export interface CompetidorAtual {
  nome: string
  postos: number
  preco: number
  observadoEm: string
  staleDays: number
}
export interface FuelView {
  slug: FuelSlug
  label: string
  myPrice: number | null
  myVolume: number
  competidores: CompetidorAtual[]
  mediaPonderada: number | null
  indice: number | null
  gap: number | null
  pontos: { data: string; preco: number; nome: string }[]
  minhaSerie: { data: string; preco: number }[]
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

const useConcorrencia = (empresaCodigo: number | null): ConcorrenciaData => {
  const redeId = useTenantStore((s) => s.rede?.id ?? null)
  const dataFinal = useFilterStore((s) => s.dataFinal)
  const hoje = dataFinal // âncora de "hoje" coerente com o filtro
  const desde = useMemo(() => isoMinusDays(hoje, 30), [hoje])
  const rede = useRedeSetores()

  const { data: precos = [], isLoading: lP } = useQuery({
    queryKey: ['concorrencia', empresaCodigo, desde],
    queryFn: () => fetchConcorrenciaPrecos({ empresaCodigo: empresaCodigo!, desde }),
    enabled: empresaCodigo != null,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })

  // Minha série 30d de preço médio (faturamento/litros) por combustível — best
  // effort (apuracao_fuel_diaria). Se vazia, a UI cai numa linha reta no preço atual.
  const { data: fuelRows = [] } = useQuery({
    queryKey: ['concorrencia-meu30', empresaCodigo, desde, hoje],
    queryFn: () => fetchApuracaoFuelDiaria({ empresaCodigos: [empresaCodigo!], dataInicial: desde, dataFinal: hoje }),
    enabled: empresaCodigo != null,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })

  return useMemo(() => {
    const postos = rede.combustivel.postos.map((p) => ({ empresaCodigo: p.empresaCodigo, posto: p.posto }))

    // Meu preço/volume atual por slug (do posto selecionado, fato).
    const myBySlug = new Map<FuelSlug, { preco: number; volume: number }>()
    const posto = rede.combustivel.postos.find((p) => p.empresaCodigo === empresaCodigo)
    if (posto) {
      for (const pr of posto.produtos) {
        const slug = classifyFuelSlug(pr.produto)
        if (!slug || pr.precoVenda <= 0) continue
        const cur = myBySlug.get(slug) ?? { preco: 0, volume: 0 }
        // pondera preço por volume quando há +de 1 produto no mesmo slug.
        cur.preco = cur.volume + pr.qtd > 0 ? (cur.preco * cur.volume + pr.precoVenda * pr.qtd) / (cur.volume + pr.qtd) : pr.precoVenda
        cur.volume += pr.qtd
        myBySlug.set(slug, cur)
      }
    }

    // Minha série 30d por slug (faturamento/litros do dia).
    const serieDia = new Map<FuelSlug, Map<string, { fat: number; lit: number }>>()
    for (const r of fuelRows) {
      const slug = classifyFuelSlug(r.produto_nome ?? '')
      if (!slug || r.litros <= 0) continue
      const m = serieDia.get(slug) ?? new Map()
      const cur = m.get(r.data) ?? { fat: 0, lit: 0 }
      cur.fat += r.faturamento
      cur.lit += r.litros
      m.set(r.data, cur)
      serieDia.set(slug, m)
    }

    // Concorrente: preço ATUAL = última linha por (nome, slug): max(observado_em)
    // → desempate max(created_at) (resolve duplicata do mesmo dia). Pontos 30d = tudo.
    const atualByKey = new Map<string, ConcorrenciaPrecoRow>()
    const pontosBySlug = new Map<FuelSlug, { data: string; preco: number; nome: string }[]>()
    for (const r of precos) {
      const key = `${r.concorrente_nome}|${r.combustivel}`
      const prev = atualByKey.get(key)
      if (!prev || r.observado_em > prev.observado_em || (r.observado_em === prev.observado_em && r.created_at > prev.created_at)) {
        atualByKey.set(key, r)
      }
      const arr = pontosBySlug.get(r.combustivel) ?? []
      arr.push({ data: r.observado_em, preco: r.preco, nome: r.concorrente_nome })
      pontosBySlug.set(r.combustivel, arr)
    }

    const compBySlug = new Map<FuelSlug, CompetidorAtual[]>()
    let freshnessMaxStaleDays: number | null = null
    for (const r of atualByKey.values()) {
      const stale = diffDays(r.observado_em, hoje)
      if (freshnessMaxStaleDays == null || stale > freshnessMaxStaleDays) freshnessMaxStaleDays = stale
      const arr = compBySlug.get(r.combustivel) ?? []
      arr.push({ nome: r.concorrente_nome, postos: r.concorrente_postos, preco: r.preco, observadoEm: r.observado_em, staleDays: stale })
      compBySlug.set(r.combustivel, arr)
    }

    const byFuel: FuelView[] = []
    for (const slug of FUEL_SLUGS) {
      const my = myBySlug.get(slug)
      const competidores = (compBySlug.get(slug) ?? []).sort((a, b) => a.nome.localeCompare(b.nome))
      if (!my && competidores.length === 0) continue
      const totalPostos = competidores.reduce((s, c) => s + c.postos, 0)
      const mediaPonderada = totalPostos > 0
        ? competidores.reduce((s, c) => s + c.preco * c.postos, 0) / totalPostos
        : null
      const myPrice = my?.preco ?? null
      const gap = myPrice != null && mediaPonderada != null ? mediaPonderada - myPrice : null
      const indice = myPrice != null && mediaPonderada != null && mediaPonderada > 0 ? (myPrice / mediaPonderada) * 100 : null
      const minhaSerie = [...(serieDia.get(slug)?.entries() ?? [])]
        .map(([data, v]) => ({ data, preco: v.lit > 0 ? v.fat / v.lit : 0 }))
        .sort((a, b) => a.data.localeCompare(b.data))
      byFuel.push({
        slug, label: FUEL_LABEL[slug],
        myPrice, myVolume: my?.volume ?? 0,
        competidores, mediaPonderada, indice, gap,
        pontos: (pontosBySlug.get(slug) ?? []).sort((a, b) => a.data.localeCompare(b.data)),
        minhaSerie,
      })
    }

    // KPIs agregados (ponderados por volume onde faz sentido).
    let somaMyVol = 0, somaIdxNum = 0, somaIdxDen = 0, ganhoPricing = 0
    let ondePossoSubir: ConcorrenciaData['ondePossoSubir'] = null
    let ondeEstouCaro: ConcorrenciaData['ondeEstouCaro'] = null
    for (const f of byFuel) {
      if (f.myPrice != null && f.mediaPonderada != null) {
        somaIdxNum += f.myPrice * f.myVolume
        somaIdxDen += f.mediaPonderada * f.myVolume
        somaMyVol += f.myVolume
        if (f.gap != null && f.gap > 0) {
          ganhoPricing += f.gap * f.myVolume
          if (!ondePossoSubir || f.gap > ondePossoSubir.gap) ondePossoSubir = { slug: f.slug, label: f.label, gap: f.gap }
        }
        if (f.gap != null && f.gap < 0) {
          if (!ondeEstouCaro || f.gap < ondeEstouCaro.gap) ondeEstouCaro = { slug: f.slug, label: f.label, gap: f.gap }
        }
      }
    }
    const indiceGeral = somaIdxDen > 0 ? (somaIdxNum / somaIdxDen) * 100 : null

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
      autores,
    }
  }, [rede, precos, fuelRows, empresaCodigo, hoje, redeId, lP])
}

export default useConcorrencia
