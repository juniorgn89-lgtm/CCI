import { useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchTitulosReceber } from '@/api/endpoints/financeiro'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import {
  fetchApuracaoDiaria, fetchVendasSetorDiaria, fetchFormasPagamentoCache, fetchCaixasCache,
  fetchApuracaoAfericoes, fetchVendasCache,
} from '@/api/supabase/apuracao'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { fpgCategoria } from '@/pages/QualidadeDados/hooks/useQualidadeDados'
import { todayLocal } from '@/lib/period'

/**
 * Resumo de ONTEM da rede (postos que a pessoa pode ver), para o Briefing.
 * Tudo FATO do cache de apuração (vendas por setor, formas de pagamento,
 * caixas, aferições, venda por produto) + títulos a receber em aberto (mesma
 * consulta do Financeiro, cache compartilhado). Nada inventado: o que não vem
 * fica null e a tela não mostra.
 */

const isoMinusDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d - n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export type GrupoRecebimento = 'cartao' | 'dinheiro' | 'prazo' | 'outros'
const grupoDe = (tipo: string, nome: string): GrupoRecebimento => {
  const c = fpgCategoria(tipo, nome)
  if (c === 'Dinheiro') return 'dinheiro'
  if (c === 'A prazo') return 'prazo'
  if (c === 'PIX' || c === 'Débito' || c === 'Crédito' || c === 'Cartão') return 'cartao'
  return 'outros'
}

export interface ResumoOntem {
  carregando: boolean
  temDados: boolean
  ontem: string
  semanaPassada: string
  vendas: number
  vendasSemanaPassada: number | null
  lucroBruto: number
  litros: number
  /** Venda por setor (combustivel / automotivos / conveniencia). */
  setores: { id: 'combustivel' | 'automotivos' | 'conveniencia'; valor: number }[]
  recebido: number
  recebimento: { grupo: GrupoRecebimento; valor: number }[]
  /** Σ diferença dos caixas do dia (+ sobra / − falta) e quantos caixas. */
  caixa: { diferenca: number; caixas: number; abertos: number } | null
  afericoes: { litros: number; qtd: number }
  /** Produto mais vendido (R$) fora do combustível. */
  topProduto: { nome: string; valor: number; setor: string } | null
  /** Títulos a receber em aberto (null enquanto carrega ou se falhar). */
  prazo: { vencidosValor: number; vencidosQtd: number; hojeValor: number; hojeQtd: number; abertoValor: number } | null
  carregandoPrazo: boolean
}

const useResumoOntem = (enabled: boolean): ResumoOntem => {
  const hoje = todayLocal()
  const ontem = useMemo(() => isoMinusDays(hoje, 1), [hoje])
  const semanaPassada = useMemo(() => isoMinusDays(ontem, 7), [ontem])

  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas({ limite: 200 }), staleTime: 30 * 60 * 1000, enabled })
  const permitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const codes = useMemo(() => permitidas.map((e) => e.codigo), [permitidas])
  const k = codes.join(',')
  const on = enabled && codes.length > 0
  const dia = { empresaCodigos: codes, dataInicial: ontem, dataFinal: ontem }

  const diaria = useQuery({ queryKey: ['resumo-ontem', 'diaria', k, semanaPassada, ontem], enabled: on, staleTime: 10 * 60_000,
    queryFn: () => fetchApuracaoDiaria({ empresaCodigos: codes, dataInicial: semanaPassada, dataFinal: ontem }) })
  const setor = useQuery({ queryKey: ['resumo-ontem', 'setor', k, ontem], enabled: on, staleTime: 10 * 60_000, queryFn: () => fetchVendasSetorDiaria(dia) })
  const formas = useQuery({ queryKey: ['resumo-ontem', 'formas', k, ontem], enabled: on, staleTime: 10 * 60_000, queryFn: () => fetchFormasPagamentoCache(dia) })
  const caixas = useQuery({ queryKey: ['resumo-ontem', 'caixas', k, ontem], enabled: on, staleTime: 10 * 60_000, queryFn: () => fetchCaixasCache(dia) })
  const afer = useQuery({ queryKey: ['resumo-ontem', 'afer', k, ontem], enabled: on, staleTime: 10 * 60_000, queryFn: () => fetchApuracaoAfericoes(dia) })
  const prod = useQuery({ queryKey: ['resumo-ontem', 'produtos', k, ontem], enabled: on, staleTime: 10 * 60_000, queryFn: () => fetchVendasCache(dia) })
  // Mesma chave/consulta do Financeiro (títulos em aberto da rede): reaproveita o cache.
  const receber = useQuery({
    queryKey: ['titulosReceberPend', 'rede'],
    enabled: on,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    queryFn: () => fetchAllPages(
      (p) => fetchTitulosReceber({ dataInicial: '2015-01-01', dataFinal: '2045-12-31', apenasPendente: true, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 20,
    ),
  })

  return useMemo(() => {
    const permit = new Set(codes)
    const dRows = (diaria.data ?? []).filter((r) => r.data === ontem)
    const dSem = (diaria.data ?? []).filter((r) => r.data === semanaPassada)
    const vendasDiaria = dRows.reduce((s, r) => s + (r.vendas_total ?? 0), 0)
    const sem = dSem.reduce((s, r) => s + (r.vendas_total ?? 0), 0)

    const porSetor = new Map<string, number>()
    for (const r of setor.data ?? []) porSetor.set(r.setor, (porSetor.get(r.setor) ?? 0) + r.total_venda)
    const setores = (['combustivel', 'automotivos', 'conveniencia'] as const)
      .map((id) => ({ id, valor: porSetor.get(id) ?? 0 }))
      .filter((x) => x.valor > 0)
    const vendasSetor = setores.reduce((s, x) => s + x.valor, 0)
    const vendas = vendasSetor > 0 ? vendasSetor : vendasDiaria

    const porGrupo = new Map<GrupoRecebimento, number>()
    for (const f of formas.data ?? []) {
      const g = grupoDe(f.tipo_forma_pagamento ?? '', f.nome_forma_pagamento ?? '')
      porGrupo.set(g, (porGrupo.get(g) ?? 0) + f.valor_pagamento)
    }
    const recebimento = (['cartao', 'dinheiro', 'outros', 'prazo'] as const)
      .map((grupo) => ({ grupo, valor: porGrupo.get(grupo) ?? 0 }))
      .filter((x) => x.valor > 0)
      .sort((a, b) => b.valor - a.valor)
    const recebido = recebimento.reduce((s, x) => s + x.valor, 0)

    const cx = caixas.data ?? []
    const caixa = cx.length
      ? { diferenca: cx.reduce((s, c) => s + (c.diferenca ?? 0), 0), caixas: cx.length, abertos: cx.filter((c) => !c.fechado).length }
      : null

    const afericoes = { litros: (afer.data ?? []).reduce((s, a) => s + (Number(a.quantidade) || 0), 0), qtd: (afer.data ?? []).length }

    const porProduto = new Map<string, { nome: string; valor: number; setor: string }>()
    for (const p of prod.data ?? []) {
      if (p.setor === 'combustivel') continue
      const key = `${p.produto_codigo}`
      const cur = porProduto.get(key) ?? { nome: p.produto_nome, valor: 0, setor: p.setor }
      cur.valor += p.total_venda
      porProduto.set(key, cur)
    }
    const topProduto = [...porProduto.values()].sort((a, b) => b.valor - a.valor)[0] ?? null

    let prazo: ResumoOntem['prazo'] = null
    if (receber.data) {
      let vencidosValor = 0, vencidosQtd = 0, hojeValor = 0, hojeQtd = 0, abertoValor = 0
      for (const t of receber.data) {
        if (!t.pendente || !permit.has(t.empresaCodigo)) continue
        const venc = (t.dataVencimento ?? '').slice(0, 10)
        abertoValor += t.valor
        if (venc && venc < hoje) { vencidosValor += t.valor; vencidosQtd++ } else if (venc === hoje) { hojeValor += t.valor; hojeQtd++ }
      }
      prazo = { vencidosValor, vencidosQtd, hojeValor, hojeQtd, abertoValor }
    }

    return {
      carregando: diaria.isLoading || setor.isLoading || formas.isLoading,
      temDados: vendas > 0,
      ontem,
      semanaPassada,
      vendas,
      vendasSemanaPassada: sem > 0 ? sem : null,
      lucroBruto: dRows.reduce((s, r) => s + r.fuel_lucro_bruto, 0),
      litros: dRows.reduce((s, r) => s + r.fuel_litros, 0),
      setores,
      recebido,
      recebimento,
      caixa,
      afericoes,
      topProduto,
      prazo,
      carregandoPrazo: receber.isLoading,
    }
  }, [codes, diaria.data, diaria.isLoading, setor.data, setor.isLoading, formas.data, formas.isLoading, caixas.data, afer.data, prod.data, receber.data, receber.isLoading, ontem, semanaPassada, hoje])
}

export default useResumoOntem
