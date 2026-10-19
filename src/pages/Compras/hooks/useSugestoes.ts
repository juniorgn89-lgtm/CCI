import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import useEstoqueAnalytics, { type ProductAnalyticsRow } from '@/pages/Estoques/hooks/useEstoqueAnalytics'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import type { SetorCompra } from '@/api/supabase/compras'

export type StatusSugestao = ProductAnalyticsRow['necessidadeStatus']

/** Produto pronto pra entrar num pedido: o que o estoque diz e o porquê da quantidade. */
export interface Sugestao {
  produtoCodigo: number
  nome: string
  unidade: string | null
  setor: SetorCompra
  categoria: string
  saldo: number
  minimo: number
  vendaDia: number
  diasCobertura: number
  /** Dias desde a última venda (null = nunca vendeu nos últimos 6 meses). */
  diasParado: number | null
  status: StatusSugestao
  qtdSugerida: number
  custo: number
  justificativa: string
  prioridade: number
}

export const COBERTURA_PADRAO = 30
export const LEAD_TIME_PADRAO = 7

const fmtQ = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: v < 10 ? 1 : 0 })
const diasDesde = (iso: string | null) => { if (!iso) return null; const d = new Date(`${iso.slice(0, 10)}T12:00:00`); return Math.max(0, Math.round((Date.now() - d.getTime()) / 86400000)) }

/**
 * Status e quantidade com a cobertura e o lead time escolhidos pelo usuário:
 * comprar o que falta pra cobrir (cobertura + lead time) dias de venda.
 */
export const recalcular = (s: Sugestao, coberturaDias: number, leadTimeDias: number): Sugestao => {
  const alvoDias = Math.max(1, coberturaDias) + Math.max(0, leadTimeDias)
  let status: StatusSugestao
  if (s.saldo < 0) status = 'negativo'
  else if (s.vendaDia <= 0) status = 'sem_movimento'
  else if (s.saldo === 0) status = 'critico'
  else if (s.diasCobertura < coberturaDias / 2) status = 'critico'
  else if (s.diasCobertura < coberturaDias) status = 'baixo'
  else status = 'ok'
  const qtd = status === 'critico' || status === 'baixo' ? Math.ceil(Math.max(0, s.vendaDia * alvoDias - s.saldo)) : 0
  const partes: string[] = [`estoque ${fmtQ(s.saldo)}${s.minimo > 0 ? ` (mínimo ${fmtQ(s.minimo)})` : ''}`]
  if (s.vendaDia > 0) partes.push(`vende ${fmtQ(s.vendaDia)} por dia`)
  if (status === 'critico' || status === 'baixo') {
    partes.push(s.saldo <= 0 ? 'zerado com venda' : `cobre ${fmtQ(s.diasCobertura)} ${s.diasCobertura < 1.5 ? 'dia' : 'dias'}`)
    if (qtd > 0) partes.push(`pedindo ${fmtQ(qtd)} cobre ${alvoDias} dias (${coberturaDias} + ${leadTimeDias} de entrega)`)
  } else if (status === 'sem_movimento') partes.push('sem venda nos últimos 30 dias')
  else if (status === 'negativo') partes.push('saldo negativo no sistema: acertar o estoque antes de comprar')
  else if (s.vendaDia > 0) partes.push(`cobre ${fmtQ(s.diasCobertura)} dias`)
  const prioridade = status === 'critico' ? 0 : status === 'baixo' ? 1 : status === 'ok' ? 2 : status === 'sem_movimento' ? 3 : 4
  return { ...s, status, qtdSugerida: qtd, justificativa: partes.join(' · '), prioridade }
}

/**
 * Sugestões de reposição de um posto, pelo motor da aba Estoques (saldo atual,
 * mínimo cadastrado, venda dos últimos 30 dias), classificadas por setor como a
 * Central faz: combustível = tipoProduto 'C', automotivos = grupo do tipo
 * "Pista", o resto = conveniência. `todos` traz o catálogo inteiro do posto;
 * `sugestoes`/`catalogo`/`buscar` respeitam o setor pedido ('outros' = tudo).
 */
export const useSugestoes = (empresaCodigo: number | null, setor: SetorCompra, coberturaDias = COBERTURA_PADRAO, leadTimeDias = LEAD_TIME_PADRAO) => {
  const est = useEstoqueAnalytics(COBERTURA_PADRAO, COBERTURA_PADRAO, empresaCodigo)
  const produtos = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages((p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    staleTime: 30 * 60 * 1000,
  })
  const grupos = useQuery({
    queryKey: ['grupos'],
    queryFn: () => fetchAllPages((p) => fetchGrupos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    staleTime: 30 * 60 * 1000,
  })

  const setorDe = useMemo(() => {
    const m = new Map<number, SetorCompra>()
    const unidade = new Map<number, string>()
    const grupoTipo = new Map((grupos.data ?? []).map((g) => [g.grupoCodigo, g.tipoGrupo]))
    for (const p of produtos.data ?? []) {
      unidade.set(p.produtoCodigo, p.unidadeCompra || p.unidadeVenda || '')
      if (p.tipoProduto === 'C' || p.combustivel) m.set(p.produtoCodigo, 'combustivel')
      else if ((grupoTipo.get(p.grupoCodigo) ?? '') === 'Pista') m.set(p.produtoCodigo, 'automotivos')
      else m.set(p.produtoCodigo, 'conveniencia')
    }
    return { setor: (c: number): SetorCompra => m.get(c) ?? 'conveniencia', unidade: (c: number) => unidade.get(c) ?? null }
  }, [produtos.data, grupos.data])

  const todos = useMemo<Sugestao[]>(() => {
    const rows = (est.productAnalytics ?? []) as ProductAnalyticsRow[]
    return rows.map((r) => recalcular({
      produtoCodigo: r.produtoCodigo, nome: r.produtoNome, unidade: setorDe.unidade(r.produtoCodigo), setor: setorDe.setor(r.produtoCodigo), categoria: r.categoria,
      saldo: r.saldoAtual, minimo: r.estoqueMinimo, vendaDia: r.mediaDiariaVendas, diasCobertura: r.diasCobertura, diasParado: diasDesde(r.ultimaVenda),
      status: r.necessidadeStatus, qtdSugerida: 0, custo: r.precoCustoCadastro > 0 ? r.precoCustoCadastro : r.custoMedio, justificativa: '', prioridade: 9,
    }, coberturaDias, leadTimeDias))
  }, [est.productAnalytics, setorDe, coberturaDias, leadTimeDias])

  const doSetor = useMemo(() => (setor === 'outros' ? todos : todos.filter((t) => t.setor === setor)), [todos, setor])
  const sugestoes = useMemo(() => doSetor.filter((t) => (t.status === 'critico' || t.status === 'baixo') && t.qtdSugerida > 0).sort((a, b) => a.prioridade - b.prioridade || b.vendaDia * b.custo - a.vendaDia * a.custo), [doSetor])
  /** Quantas sugestões acionáveis por setor (os cards de categoria). */
  const porSetor = useMemo(() => {
    const c: Record<SetorCompra, number> = { combustivel: 0, automotivos: 0, conveniencia: 0, outros: 0 }
    for (const t of todos) if ((t.status === 'critico' || t.status === 'baixo') && t.qtdSugerida > 0) c[t.setor] += 1
    return c
  }, [todos])
  const buscar = (termo: string, limite = 30, base: Sugestao[] = doSetor) => {
    const t = termo.trim().toLowerCase()
    if (!t) return []
    const termos = t.split(/\s+/).filter(Boolean)
    return base.filter((x) => { const alvo = `${x.nome} ${x.produtoCodigo} ${x.categoria}`.toLowerCase(); return termos.every((k) => alvo.includes(k)) }).sort((a, b) => a.prioridade - b.prioridade).slice(0, limite)
  }
  return { sugestoes, catalogo: doSetor, todos, porSetor, buscar, carregando: est.isLoading || produtos.isLoading || grupos.isLoading, temPosto: est.hasEmpresa }
}
