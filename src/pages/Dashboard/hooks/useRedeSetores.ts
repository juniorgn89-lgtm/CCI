import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { useTenantStore } from '@/store/tenant'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchVendaItens } from '@/api/endpoints/vendas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { fetchVendasCache, splitPeriodAtToday } from '@/api/supabase/apuracao'
import { offsetPeriod, todayLocal } from '@/lib/period'

/**
 * Dados REDE-WIDE por setor (Combustível / Automotivos / Conveniência) pra a
 * Central da Rede — todos os postos, venda fiscal (apuracao_vendas), com ano
 * anterior. Dias fechados vêm do cache Supabase; o dia corrente é live.
 *
 * Classificação por produto:
 *  - combustível  = produto.combustivel === true
 *  - automotivos  = grupo começa com "PS -" (produtos de pista)
 *  - conveniência = demais (loja)
 */
export type SetorId = 'combustivel' | 'automotivos' | 'conveniencia'

const classify = (
  produtoCodigo: number,
  isFuel: Set<number>,
  isPista: Set<number>,
): SetorId => {
  if (isFuel.has(produtoCodigo)) return 'combustivel'
  if (isPista.has(produtoCodigo)) return 'automotivos'
  return 'conveniencia'
}

export interface RedeProdutoRow {
  produtoCodigo: number
  produto: string
  qtd: number
  qtdAnoAnterior: number
  lucroBruto: number
  lucroBrutoAnoAnterior: number
  faturamentoAnoAnterior: number
  margem: number
  acrescimos: number
  descontos: number
  precoVenda: number
  precoCusto: number
  lbPorUnidade: number
}

export interface RedePostoRow {
  empresaCodigo: number
  posto: string
  qtd: number
  qtdAnoAnterior: number
  faturamento: number
  faturamentoAnoAnterior: number
  lucroBruto: number
  lucroBrutoAnoAnterior: number
  margem: number
  acrescimos: number
  descontos: number
  precoVenda: number
  precoCusto: number
  lbPorUnidade: number
  produtos: RedeProdutoRow[]
}

export interface RedeSetor {
  id: SetorId
  unidadeLabel: string
  lbLabel: string
  qtd: number
  qtdAnoAnterior: number
  faturamento: number
  custo: number
  lucroBruto: number
  lucroBrutoAnoAnterior: number
  margem: number
  lucroPorUnidade: number
  acrescimos: number
  descontos: number
  postos: RedePostoRow[]
}

export interface RedeSetoresData {
  combustivel: RedeSetor
  automotivos: RedeSetor
  conveniencia: RedeSetor
  global: {
    faturamento: number
    custo: number
    lucroBruto: number
    margem: number
    faturamentoAnoAnterior: number
    lucroBrutoAnoAnterior: number
  }
  isLoading: boolean
  hasRede: boolean
}

/** Agregado mínimo por venda (cache ou live) usado na agregação. */
interface VendaAgg {
  empresaCodigo: number
  produtoCodigo: number
  setor: SetorId
  nome: string
  quantidade: number
  totalVenda: number
  totalCusto: number
  acrescimos: number
  descontos: number
}

const emptySetor = (id: SetorId, unidadeLabel: string, lbLabel: string): RedeSetor => ({
  id, unidadeLabel, lbLabel,
  qtd: 0, qtdAnoAnterior: 0, faturamento: 0, custo: 0, lucroBruto: 0,
  lucroBrutoAnoAnterior: 0, margem: 0, lucroPorUnidade: 0, acrescimos: 0, descontos: 0,
  postos: [],
})

const useRedeSetores = (): RedeSetoresData => {
  const { dataInicial, dataFinal } = useFilterStore()
  const rede = useTenantStore((s) => s.rede)

  const split = useMemo(() => splitPeriodAtToday(dataInicial, dataFinal), [dataInicial, dataFinal])
  const closedIni = split.closedDays?.dataInicial ?? ''
  const closedEnd = split.closedDays?.dataFinal ?? ''
  const todayIni = split.todayPart?.dataInicial ?? ''
  const todayEnd = split.todayPart?.dataFinal ?? ''
  // AA "mesmos dias decorridos" (igual ao BI): corta o ano anterior no mesmo
  // ponto que o período atual tem dados. Sem isso, um mês corrente parcial
  // compara X dias contra um mês CHEIO do ano passado (queda enganosa). O teto
  // é hoje (proxy do "LastSale" do BI) — só morde quando o fim selecionado é
  // futuro (ex.: mês corrente inteiro escolhido no meio do mês).
  const hoje = todayLocal()
  const fimEfetivo = dataFinal > hoje ? hoje : dataFinal
  const anoAntIni = offsetPeriod(dataInicial, 12)
  const anoAntFim = offsetPeriod(fimEfetivo, 12)

  // Empresas (postos) da rede + nomes.
  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas({ limite: 200 }),
    staleTime: 30 * 60 * 1000,
  })
  const empresas = useMemo(
    () => (empresasData?.resultados ?? []).map((e) => ({ codigo: e.empresaCodigo, nome: e.fantasia || e.razao || `Posto ${e.empresaCodigo}` })),
    [empresasData],
  )
  const empresasPermitidas = useEmpresasPermitidas(empresas)
  const codes = useMemo(() => empresasPermitidas.map((e) => e.codigo), [empresasPermitidas])
  const nomePorEmpresa = useMemo(() => new Map(empresasPermitidas.map((e) => [e.codigo, e.nome])), [empresasPermitidas])
  const hasRede = !!rede && codes.length > 0

  // Produtos + grupos pra classificar.
  const { data: produtosData, isLoading: lProd } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages((p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    staleTime: 30 * 60 * 1000,
  })
  const { data: gruposData, isLoading: lGrp } = useQuery({
    queryKey: ['grupos'],
    queryFn: () => fetchAllPages((p) => fetchGrupos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    staleTime: 30 * 60 * 1000,
  })

  // Cache: dias fechados (rede), período atual.
  const { data: closedRows = [], isLoading: lClosed } = useQuery({
    queryKey: ['rede-vendas-closed', rede?.id, codes.join(','), closedIni, closedEnd],
    queryFn: () => fetchVendasCache({ empresaCodigos: codes, dataInicial: closedIni, dataFinal: closedEnd }),
    enabled: hasRede && !!split.closedDays,
    staleTime: 5 * 60 * 1000,
  })

  // Hoje: live (todos os postos), agregado.
  const { data: todayItens = [], isLoading: lToday } = useQuery({
    queryKey: ['rede-vendas-today', codes.join(','), todayIni, todayEnd],
    queryFn: async () => {
      const all = await Promise.all(
        codes.map((c) => fetchAllPages(
          (p) => fetchVendaItens({ empresaCodigo: c, dataInicial: todayIni, dataFinal: todayEnd, usaProdutoLmc: false, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
          1000, 50,
        )),
      )
      return all.flat()
    },
    enabled: hasRede && !!split.todayPart,
    staleTime: 60 * 1000,
  })

  // Ano anterior (cache — período fechado).
  const { data: anoAntRows = [], isLoading: lPrev } = useQuery({
    queryKey: ['rede-vendas-anoant', rede?.id, codes.join(','), anoAntIni, anoAntFim],
    queryFn: () => fetchVendasCache({ empresaCodigos: codes, dataInicial: anoAntIni, dataFinal: anoAntFim }),
    enabled: hasRede,
    staleTime: 5 * 60 * 1000,
  })

  return useMemo<RedeSetoresData>(() => {
    const isLoading = lProd || lGrp || lClosed || lToday || lPrev

    // Conjuntos de classificação (alias-expandido pros aliases de combustível).
    const isFuel = new Set<number>()
    const isPista = new Set<number>()
    const nomeProduto = new Map<number, string>()
    if (produtosData && gruposData) {
      // Mesma classificação do BI: combustível = tipoProduto "C"; automotivos =
      // grupo "Pista" (não-C); conveniência = grupo "Conveniência" (o resto cai
      // em conveniência só no fallback live de "hoje", impacto desprezível).
      const grupoTipo = new Map(gruposData.map((g) => [g.grupoCodigo, g.tipoGrupo]))
      for (const p of produtosData) {
        nomeProduto.set(p.produtoCodigo, p.nome)
        if (p.tipoProduto === 'C') {
          for (const c of [p.produtoCodigo, p.produtoLmcCodigo, p.codigo]) {
            if (typeof c === 'number' && c > 0) isFuel.add(c)
          }
          continue
        }
        if ((grupoTipo.get(p.grupoCodigo) ?? '') === 'Pista') isPista.add(p.produtoCodigo)
      }
    }

    // Setor: prioriza o que foi CARIMBADO na apuração (cache); só reclassifica
    // ao vivo em linhas antigas (pré-carimbo) ou no "hoje" live. Isso elimina a
    // deriva histórica de classificação.
    const setorOf = (s: string | null | undefined, pc: number): SetorId =>
      (s === 'combustivel' || s === 'automotivos' || s === 'conveniencia') ? s : classify(pc, isFuel, isPista)
    const nomeDe = (cacheNome: string | null | undefined, pc: number): string =>
      cacheNome || nomeProduto.get(pc) || `Produto ${pc}`

    const curr: VendaAgg[] = closedRows
      .filter((r) => r.setor !== 'outros')  // 'outros' fica fora dos setores (igual ao BI)
      .map((r) => ({
        empresaCodigo: r.empresa_codigo, produtoCodigo: r.produto_codigo,
        setor: setorOf(r.setor, r.produto_codigo), nome: nomeDe(r.produto_nome, r.produto_codigo),
        quantidade: r.quantidade, totalVenda: r.total_venda, totalCusto: r.total_custo,
        acrescimos: r.acrescimos ?? 0, descontos: r.descontos ?? 0,
      }))
    for (const it of todayItens) {
      if (it.quantidade <= 0) continue
      if (it.cancelada === 'S') continue  // BI conta só cancelada="N"
      const setor = classify(it.produtoCodigo, isFuel, isPista)
      // Combustível: custo = precoCusto × qtd (igual ao BI). Demais: totalCusto.
      const custo = setor === 'combustivel'
        ? it.precoCusto * it.quantidade
        : (it.totalCusto > 0 ? it.totalCusto : it.precoCusto * it.quantidade)
      curr.push({ empresaCodigo: it.empresaCodigo, produtoCodigo: it.produtoCodigo,
        setor, nome: nomeDe(null, it.produtoCodigo),
        quantidade: it.quantidade, totalVenda: it.totalVenda, totalCusto: custo,
        acrescimos: it.totalAcrescimo ?? 0, descontos: it.totalDesconto ?? 0 })
    }

    // Ano anterior por (setor|empresa) → Map<produto, { qtd, lucro, nome }>. Guardar
    // por produto permite incluir itens que venderam SÓ no ano passado (senão o
    // total do ano anterior fica subestimado).
    const seKey = (s: SetorId, e: number) => `${s}|${e}`
    const prevBySE = new Map<string, Map<number, { qtd: number; lucro: number; fat: number; nome: string }>>()
    for (const r of anoAntRows) {
      if (r.setor === 'outros') continue  // 'outros' fica fora dos setores
      const s = setorOf(r.setor, r.produto_codigo)
      const k = seKey(s, r.empresa_codigo)
      let m = prevBySE.get(k)
      if (!m) { m = new Map(); prevBySE.set(k, m) }
      const prev = m.get(r.produto_codigo) ?? { qtd: 0, lucro: 0, fat: 0, nome: nomeDe(r.produto_nome, r.produto_codigo) }
      prev.qtd += r.quantidade
      prev.lucro += r.total_venda - r.total_custo
      prev.fat += r.total_venda
      m.set(r.produto_codigo, prev)
    }

    // Estrutura por setor → posto → produto.
    interface ProdAcc { produtoCodigo: number; nome: string; qtd: number; fat: number; custo: number; acr: number; desc: number }
    interface PostoAcc { empresaCodigo: number; produtos: Map<number, ProdAcc>; qtd: number; fat: number; custo: number; acr: number; desc: number }
    const setores: Record<SetorId, Map<number, PostoAcc>> = {
      combustivel: new Map(), automotivos: new Map(), conveniencia: new Map(),
    }
    for (const a of curr) {
      const postoMap = setores[a.setor]
      const posto = postoMap.get(a.empresaCodigo) ?? { empresaCodigo: a.empresaCodigo, produtos: new Map(), qtd: 0, fat: 0, custo: 0, acr: 0, desc: 0 }
      posto.qtd += a.quantidade; posto.fat += a.totalVenda; posto.custo += a.totalCusto; posto.acr += a.acrescimos; posto.desc += a.descontos
      const prod = posto.produtos.get(a.produtoCodigo) ?? { produtoCodigo: a.produtoCodigo, nome: a.nome, qtd: 0, fat: 0, custo: 0, acr: 0, desc: 0 }
      prod.qtd += a.quantidade; prod.fat += a.totalVenda; prod.custo += a.totalCusto; prod.acr += a.acrescimos; prod.desc += a.descontos
      posto.produtos.set(a.produtoCodigo, prod)
      postoMap.set(a.empresaCodigo, posto)
    }

    const buildSetor = (id: SetorId): RedeSetor => {
      const isComb = id === 'combustivel'
      const setor = emptySetor(id, isComb ? 'Litros' : 'Quantidade', isComb ? 'L.B. por litro' : 'L.B. por unidade')
      const postoMap = setores[id]
      for (const [empresaCodigo, posto] of postoMap) {
        const produtos: RedeProdutoRow[] = []
        let pQtdAnt = 0, pLucroAnt = 0, pFatAnt = 0
        const prevMap = prevBySE.get(seKey(id, empresaCodigo)) ?? new Map<number, { qtd: number; lucro: number; fat: number; nome: string }>()
        for (const prod of posto.produtos.values()) {
          const lucro = prod.fat - prod.custo
          const ant = prevMap.get(prod.produtoCodigo) ?? { qtd: 0, lucro: 0, fat: 0 }
          pQtdAnt += ant.qtd; pLucroAnt += ant.lucro; pFatAnt += ant.fat
          produtos.push({
            produtoCodigo: prod.produtoCodigo,
            produto: prod.nome,
            qtd: prod.qtd,
            qtdAnoAnterior: ant.qtd,
            lucroBruto: lucro,
            lucroBrutoAnoAnterior: ant.lucro,
            faturamentoAnoAnterior: ant.fat,
            margem: prod.fat > 0 ? (lucro / prod.fat) * 100 : 0,
            acrescimos: prod.acr,
            descontos: prod.desc,
            precoVenda: prod.qtd > 0 ? prod.fat / prod.qtd : 0,
            precoCusto: prod.qtd > 0 ? prod.custo / prod.qtd : 0,
            lbPorUnidade: prod.qtd > 0 ? lucro / prod.qtd : 0,
          })
        }
        // Produtos que venderam SÓ no ano anterior (sem venda no período atual).
        for (const [pc, ant] of prevMap) {
          if (posto.produtos.has(pc)) continue
          pQtdAnt += ant.qtd; pLucroAnt += ant.lucro; pFatAnt += ant.fat
          produtos.push({
            produtoCodigo: pc,
            produto: ant.nome,
            qtd: 0,
            qtdAnoAnterior: ant.qtd,
            lucroBruto: 0,
            lucroBrutoAnoAnterior: ant.lucro,
            faturamentoAnoAnterior: ant.fat,
            margem: 0,
            acrescimos: 0,
            descontos: 0,
            precoVenda: 0,
            precoCusto: 0,
            lbPorUnidade: 0,
          })
        }
        produtos.sort((a, b) => b.lucroBruto - a.lucroBruto)
        const lucro = posto.fat - posto.custo
        setor.postos.push({
          empresaCodigo,
          posto: nomePorEmpresa.get(empresaCodigo) ?? `Posto ${empresaCodigo}`,
          qtd: posto.qtd,
          qtdAnoAnterior: pQtdAnt,
          faturamento: posto.fat,
          faturamentoAnoAnterior: pFatAnt,
          lucroBruto: lucro,
          lucroBrutoAnoAnterior: pLucroAnt,
          margem: posto.fat > 0 ? (lucro / posto.fat) * 100 : 0,
          acrescimos: posto.acr,
          descontos: posto.desc,
          precoVenda: posto.qtd > 0 ? posto.fat / posto.qtd : 0,
          precoCusto: posto.qtd > 0 ? posto.custo / posto.qtd : 0,
          lbPorUnidade: posto.qtd > 0 ? lucro / posto.qtd : 0,
          produtos,
        })
        setor.qtd += posto.qtd; setor.faturamento += posto.fat; setor.custo += posto.custo
        setor.acrescimos += posto.acr; setor.descontos += posto.desc
        setor.qtdAnoAnterior += pQtdAnt; setor.lucroBrutoAnoAnterior += pLucroAnt
      }
      setor.postos.sort((a, b) => b.lucroBruto - a.lucroBruto)
      setor.lucroBruto = setor.faturamento - setor.custo
      setor.margem = setor.faturamento > 0 ? (setor.lucroBruto / setor.faturamento) * 100 : 0
      setor.lucroPorUnidade = setor.qtd > 0 ? setor.lucroBruto / setor.qtd : 0
      return setor
    }

    const combustivel = buildSetor('combustivel')
    const automotivos = buildSetor('automotivos')
    const conveniencia = buildSetor('conveniencia')

    const gFat = combustivel.faturamento + automotivos.faturamento + conveniencia.faturamento
    const gCusto = combustivel.custo + automotivos.custo + conveniencia.custo
    const gLucro = gFat - gCusto
    const gLucroAnt = combustivel.lucroBrutoAnoAnterior + automotivos.lucroBrutoAnoAnterior + conveniencia.lucroBrutoAnoAnterior

    return {
      combustivel, automotivos, conveniencia,
      global: {
        faturamento: gFat,
        custo: gCusto,
        lucroBruto: gLucro,
        margem: gFat > 0 ? (gLucro / gFat) * 100 : 0,
        faturamentoAnoAnterior: 0,
        lucroBrutoAnoAnterior: gLucroAnt,
      },
      isLoading,
      hasRede,
    }
  }, [closedRows, todayItens, anoAntRows, produtosData, gruposData, nomePorEmpresa, hasRede, lProd, lGrp, lClosed, lToday, lPrev])
}

export default useRedeSetores
