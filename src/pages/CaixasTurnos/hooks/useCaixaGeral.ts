import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchBicos, fetchTanques } from '@/api/endpoints/combustiveis'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchAbastecimentosChunked } from '@/api/helpers/fetchAbastecimentosChunked'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import {
  fetchCaixas,
  fetchCaixasApresentado,
  fetchTitulosReceber,
} from '@/api/endpoints/financeiro'
import { CAIXA_APRESENTADO_FORMAS } from '@/api/types/financeiro'
import { fetchVendaItens, fetchVendaCodigosAutorizados } from '@/api/endpoints/vendas'
import type { VendaItem } from '@/api/types/venda'
import { isCartaoForma } from '@/lib/formaPagamento'

/* ──────────────────────────────────────────────────────────────────────────
 * Hook do relatório "Caixa Geral" (réplica do webPosto).
 * Escopo: empresaCodigo (primeiro selecionado) + dataInicial/dataFinal globais.
 * Tudo via GET. Reusa endpoints existentes.
 * ────────────────────────────────────────────────────────────────────────── */

const EMPTY_SET: Set<number> = new Set()

/* ── Tipos de saída ── */

export interface BicoRow {
  bicoNumero: string
  produtoNome: string
  /** Rótulo do print: "001 ETANOL COMUM." */
  label: string
  encInicial: number
  encFinal: number
  afericao: number
  volVendas: number
  precoMedio: number
  totalLiquido: number
}

export interface BicoTotais {
  afericao: number
  volVendas: number
  totalLiquido: number
}

export interface VendaCombustivelRow {
  produtoNome: string
  quantidade: number
  precoCustoMedio: number
  totalCustoMedio: number
  total: number
  margemBruta: number
  /** Saldo de estoque (volume) do(s) tanque(s) do produto. Pode ser null se
   *  não houver fonte para o produto. Ver nota de origem no relatório. */
  saldo: number | null
}

export interface VendaCombustivelTotais {
  quantidade: number
  totalCusto: number
  total: number
  margemBruta: number
}

export interface VendaGrupoRow {
  grupoNome: string
  quantidade: number
  total: number
  margemBruta: number
}

export interface VendaGrupoTotais {
  quantidade: number
  total: number
  margemBruta: number
}

export interface CobrarRow {
  responsavel: string
  documento: string
  valor: number
  vencimento: string
}

export interface MovLinha {
  nome: string
  valor: number
}

export interface CaixaGeralData {
  bicos: BicoRow[]
  bicoTotais: BicoTotais
  vendasCombustivel: VendaCombustivelRow[]
  vendasCombustivelTotais: VendaCombustivelTotais
  vendasGrupos: VendaGrupoRow[]
  vendasGruposTotais: VendaGrupoTotais
  cobrar: CobrarRow[]
  cobrarTotal: number
  /** Saídas = formas do /CAIXA_APRESENTADO (Σ *Apresentado por forma). */
  saidas: MovLinha[]
  saidasTotal: number
  /** Entradas (combustível + produto + demais linhas do print). */
  entradas: MovLinha[]
  entradasTotal: number
  /** Diferenças de fechamento (Σ *Diferenca do /CAIXA_APRESENTADO). */
  diferencasFechamento: number
  /** Faturamento de combustível (= total bloco 3a) — exposto pra entradas. */
  faturamentoCombustivel: number
  /** Faturamento de produtos/loja (= grupos − combustível) — pra entradas. */
  faturamentoProdutos: number
}

/* ── Hook ── */

const useCaixaGeral = () => {
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null
  const hasEmpresa = empresaCodigos.length > 0
  const enabled = hasEmpresa && empresaCodigo !== null

  // ── Catálogo: produtos + grupos (cache compartilhado, longa validade) ──
  const { data: produtosData, isLoading: lProd } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages((p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    staleTime: 30 * 60 * 1000,
  })

  const { data: gruposData, isLoading: lGrupos } = useQuery({
    queryKey: ['grupos'],
    queryFn: () => fetchAllPages((p) => fetchGrupos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 50),
    staleTime: 30 * 60 * 1000,
  })

  // ── Bicos do posto (pequeno) ──
  const { data: bicosRaw, isLoading: lBicos } = useQuery({
    queryKey: ['bicos', empresaCodigo],
    queryFn: () => fetchBicos({ empresaCodigo: empresaCodigo!, limite: 1000 }),
    enabled,
    staleTime: 30 * 60 * 1000,
  })

  // ── Tanques (saldo escritural por produto — fonte candidata da coluna "Saldo") ──
  const { data: tanquesRaw, isLoading: lTanques } = useQuery({
    queryKey: ['tanques', empresaCodigo],
    queryFn: () => fetchTanques({ empresaCodigo: empresaCodigo!, limite: 1000 }),
    enabled,
    staleTime: 30 * 60 * 1000,
  })

  // ── Abastecimentos do período (Bloco 2) ──
  // tipoData='MOVIMENTO': o relatório "Caixa Geral" do webPosto filtra por
  // DATA DE MOVIMENTO (data do caixa), não pela data do abastecimento — é o
  // que faz os totais baterem com o print.
  const { data: abastData, isLoading: lAbast } = useQuery({
    queryKey: ['caixaGeral-abast', dataInicial, dataFinal, 'MOVIMENTO'],
    queryFn: () => fetchAbastecimentosChunked({ dataInicial, dataFinal, tipoData: 'MOVIMENTO' }),
    enabled,
    staleTime: 5 * 60 * 1000,
  })

  // ── VENDA_ITEM do período (Blocos 3a/3b) ──
  const { data: vendaItens = [], isLoading: lItens } = useQuery({
    queryKey: ['fuel-venda-analytics', empresaCodigos.join(','), dataInicial, dataFinal],
    queryFn: async (): Promise<VendaItem[]> => {
      const perEmpresa = await Promise.all(
        empresaCodigos.map((emp) =>
          fetchAllPages(
            (p) => fetchVendaItens({
              empresaCodigo: emp,
              dataInicial,
              dataFinal,
              usaProdutoLmc: false,
              ultimoCodigo: p.ultimoCodigo,
              limite: p.limite,
            }),
            1000, 50,
          ),
        ),
      )
      return perEmpresa.flat()
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  })

  // vendaCodigo autorizados (/VENDA situacao='A') — só estes contam.
  const { data: autorizados = EMPTY_SET, isLoading: lAut } = useQuery({
    queryKey: ['fuel-venda-autorizados', empresaCodigos.join(','), dataInicial, dataFinal],
    queryFn: async (): Promise<Set<number>> => {
      const sets = await Promise.all(
        empresaCodigos.map((emp) => fetchVendaCodigosAutorizados({ empresaCodigo: emp, dataInicial, dataFinal })),
      )
      const all = new Set<number>()
      for (const s of sets) for (const c of s) all.add(c)
      return all
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  })

  // ── Caixas do período (pra filtrar o apresentado à janela) ──
  const { data: caixasRaw, isLoading: lCaixas } = useQuery({
    queryKey: ['caixas', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchAllPages((p) => fetchCaixas({ empresaCodigo: empresaCodigo!, dataInicial, dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 20),
    enabled,
    staleTime: 5 * 60 * 1000,
  })

  // ── Apresentado por caixa (Bloco 4b — saídas + diferenças) ──
  const { data: apresentadoRaw, isLoading: lApres } = useQuery({
    queryKey: ['caixasApresentado', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchAllPages((p) => fetchCaixasApresentado({ empresaCodigo: empresaCodigo!, dataInicial, dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 50),
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  // ── Títulos a receber pendentes / a prazo (Bloco 4a) ──
  const { data: titulosRaw, isLoading: lTitulos } = useQuery({
    queryKey: ['caixaGeral-titulos', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchAllPages((p) => fetchTitulosReceber({ empresaCodigo: empresaCodigo!, dataInicial, dataFinal, apenasPendente: true, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 50),
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const isLoading =
    lProd || lGrupos || lBicos || lTanques || lAbast || lItens || lAut || lCaixas || lApres || lTitulos

  const data = useMemo<CaixaGeralData>(() => {
    const produtos = produtosData ?? []
    const grupos = gruposData ?? []
    const bicos = bicosRaw?.resultados ?? []
    const tanques = tanquesRaw?.resultados ?? []
    const abast = (abastData ?? []).filter((a) => !empresaCodigo || a.empresaCodigo === empresaCodigo)
    const caixas = caixasRaw ?? []
    const apresentado = apresentadoRaw ?? []
    const titulos = titulosRaw ?? []

    // ── Mapas de produto ──
    // nome por código (alias-expandido) + grupoCodigo + tipoProduto.
    const produtoNome = new Map<number, string>()
    const produtoGrupo = new Map<number, number>()
    const produtoTipo = new Map<number, string>()
    const fuelCodes = new Set<number>()
    for (const p of produtos) {
      for (const c of [p.produtoCodigo, p.produtoLmcCodigo, p.codigo]) {
        if (typeof c === 'number' && c > 0) {
          if (!produtoNome.has(c)) produtoNome.set(c, p.nome)
          if (!produtoGrupo.has(c)) produtoGrupo.set(c, p.grupoCodigo)
          if (!produtoTipo.has(c)) produtoTipo.set(c, p.tipoProduto)
          if (p.tipoProduto === 'C') fuelCodes.add(c)
        }
      }
    }
    const isFuel = (prod: number) => fuelCodes.has(prod)

    const grupoNome = new Map<number, string>()
    for (const g of grupos) grupoNome.set(g.grupoCodigo, g.nome)

    const inPeriod = (d: string) => {
      const dd = (d ?? '').slice(0, 10)
      return dd >= dataInicial && dd <= dataFinal
    }

    /* ── BLOCO 2 — Movimentação de Bicos ── */
    const bicoInfo = new Map<number, { numero: string; produtoCodigo: number }>()
    for (const b of bicos) bicoInfo.set(b.bicoCodigo, { numero: b.bicoNumero, produtoCodigo: b.produtoCodigo })

    interface BicoAgg {
      encMin: number
      encMax: number
      afericao: number
      volVendas: number
      totalLiquido: number
    }
    const bicoAgg = new Map<number, BicoAgg>()
    for (const a of abast) {
      const entry = bicoAgg.get(a.codigoBico) ?? {
        encMin: Infinity, encMax: -Infinity, afericao: 0, volVendas: 0, totalLiquido: 0,
      }
      // Encerrante: menor/maior do período. Ignora 0/negativos (registros sem leitura).
      if (typeof a.encerrante === 'number' && a.encerrante > 0) {
        entry.encMin = Math.min(entry.encMin, a.encerrante)
        entry.encMax = Math.max(entry.encMax, a.encerrante)
      }
      if (a.afericao) {
        entry.afericao += a.quantidade
      } else {
        entry.volVendas += a.quantidade
        entry.totalLiquido += a.valorTotal
      }
      bicoAgg.set(a.codigoBico, entry)
    }

    const bicoRows: BicoRow[] = Array.from(bicoAgg.entries())
      .map(([bicoCodigo, agg]) => {
        const info = bicoInfo.get(bicoCodigo)
        const numero = info?.numero ?? String(bicoCodigo)
        const prodNome = info ? (produtoNome.get(info.produtoCodigo) ?? `Produto ${info.produtoCodigo}`) : `Bico ${bicoCodigo}`
        const encInicial = agg.encMin === Infinity ? 0 : agg.encMin
        const encFinal = agg.encMax === -Infinity ? 0 : agg.encMax
        return {
          bicoNumero: numero,
          produtoNome: prodNome,
          // Rótulo do print: "001 ETANOL COMUM." — número zero-padded + nome upper.
          label: `${numero.padStart(3, '0')} ${prodNome.toUpperCase()}`,
          encInicial,
          encFinal,
          afericao: agg.afericao,
          volVendas: agg.volVendas,
          precoMedio: agg.volVendas > 0 ? agg.totalLiquido / agg.volVendas : 0,
          totalLiquido: agg.totalLiquido,
        }
      })
      .sort((a, b) => a.bicoNumero.localeCompare(b.bicoNumero, undefined, { numeric: true }))

    const bicoTotais: BicoTotais = bicoRows.reduce(
      (acc, r) => ({
        afericao: acc.afericao + r.afericao,
        volVendas: acc.volVendas + r.volVendas,
        totalLiquido: acc.totalLiquido + r.totalLiquido,
      }),
      { afericao: 0, volVendas: 0, totalLiquido: 0 },
    )

    /* ── Saldo de combustível por nome de produto (candidato à coluna "Saldo") ── */
    // /TANQUE.estoqueEscritural por produto do tanque, somado por nome de
    // combustível. ORIGEM INCERTA — ver relatório do componente.
    const saldoPorProduto = new Map<string, number>()
    for (const t of tanques) {
      const nome = produtoNome.get(t.produtoCodigo)
      if (!nome) continue
      const saldo = typeof t.estoqueEscritural === 'number' ? t.estoqueEscritural : 0
      saldoPorProduto.set(nome, (saldoPorProduto.get(nome) ?? 0) + saldo)
    }
    const hasSaldoSource = tanques.length > 0

    /* ── BLOCO 3a — Vendas de Combustíveis (VENDA_ITEM) ── */
    interface FuelAgg { nome: string; qty: number; custo: number; total: number }
    const fuelByName = new Map<string, FuelAgg>()
    for (const it of vendaItens) {
      if (empresaCodigo != null && it.empresaCodigo !== empresaCodigo) continue
      if (!autorizados.has(it.vendaCodigo)) continue
      if (it.quantidade <= 0) continue
      if (!isFuel(it.produtoCodigo)) continue
      if (!inPeriod(it.dataMovimento)) continue
      const nome = produtoNome.get(it.produtoCodigo) ?? `Produto ${it.produtoCodigo}`
      const custo = it.precoCusto * it.quantidade
      const cur = fuelByName.get(nome) ?? { nome, qty: 0, custo: 0, total: 0 }
      cur.qty += it.quantidade
      cur.custo += custo
      cur.total += it.totalVenda
      fuelByName.set(nome, cur)
    }
    const vendasCombustivel: VendaCombustivelRow[] = Array.from(fuelByName.values())
      .map((f) => ({
        produtoNome: f.nome,
        quantidade: f.qty,
        precoCustoMedio: f.qty > 0 ? f.custo / f.qty : 0,
        totalCustoMedio: f.custo,
        total: f.total,
        margemBruta: f.total - f.custo,
        saldo: hasSaldoSource ? (saldoPorProduto.get(f.nome) ?? 0) : null,
      }))
      .sort((a, b) => a.produtoNome.localeCompare(b.produtoNome))
    const vendasCombustivelTotais: VendaCombustivelTotais = vendasCombustivel.reduce(
      (acc, r) => ({
        quantidade: acc.quantidade + r.quantidade,
        totalCusto: acc.totalCusto + r.totalCustoMedio,
        total: acc.total + r.total,
        margemBruta: acc.margemBruta + r.margemBruta,
      }),
      { quantidade: 0, totalCusto: 0, total: 0, margemBruta: 0 },
    )

    /* ── BLOCO 3b — Vendas por Grupos (VENDA_ITEM agregado por grupo) ── */
    // Combustível agrupa em "COMBUSTIVEIS" (rótulo do print); demais usam o nome
    // do grupo do produto (/GRUPO via produtoGrupo).
    interface GrupoAgg { nome: string; qty: number; total: number; custo: number }
    const grupoAggMap = new Map<string, GrupoAgg>()
    for (const it of vendaItens) {
      if (empresaCodigo != null && it.empresaCodigo !== empresaCodigo) continue
      if (!autorizados.has(it.vendaCodigo)) continue
      if (it.quantidade <= 0) continue
      if (!inPeriod(it.dataMovimento)) continue
      let nome: string
      let custo: number
      if (isFuel(it.produtoCodigo)) {
        nome = 'COMBUSTIVEIS'
        custo = it.precoCusto * it.quantidade
      } else {
        const gc = produtoGrupo.get(it.produtoCodigo)
        nome = (gc != null ? grupoNome.get(gc) : undefined) ?? 'Sem grupo'
        custo = it.totalCusto
      }
      const cur = grupoAggMap.get(nome) ?? { nome, qty: 0, total: 0, custo: 0 }
      cur.qty += it.quantidade
      cur.total += it.totalVenda
      cur.custo += custo
      grupoAggMap.set(nome, cur)
    }
    const vendasGrupos: VendaGrupoRow[] = Array.from(grupoAggMap.values())
      .map((g) => ({
        grupoNome: g.nome,
        quantidade: g.qty,
        total: g.total,
        margemBruta: g.total - g.custo,
      }))
      .sort((a, b) => {
        // COMBUSTIVEIS primeiro (igual ao print), depois alfabético.
        if (a.grupoNome === 'COMBUSTIVEIS') return -1
        if (b.grupoNome === 'COMBUSTIVEIS') return 1
        return a.grupoNome.localeCompare(b.grupoNome)
      })
    const vendasGruposTotais: VendaGrupoTotais = vendasGrupos.reduce(
      (acc, r) => ({
        quantidade: acc.quantidade + r.quantidade,
        total: acc.total + r.total,
        margemBruta: acc.margemBruta + r.margemBruta,
      }),
      { quantidade: 0, total: 0, margemBruta: 0 },
    )

    /* ── BLOCO 4a — Vendas a Cobrar (TITULO_RECEBER pendente) ── */
    const cobrar: CobrarRow[] = titulos
      .map((t) => ({
        responsavel: t.nomeCliente || `Cliente ${t.clienteCodigo}`,
        documento: t.documento || (t.tituloNumero ? String(t.tituloNumero) : '—'),
        valor: t.valor,
        vencimento: (t.dataVencimento ?? '').slice(0, 10),
      }))
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.responsavel.localeCompare(b.responsavel))
    const cobrarTotal = cobrar.reduce((s, r) => s + r.valor, 0)

    /* ── BLOCO 4b — Movimentação Financeira dos Caixas ── */
    // Saídas = Σ *Apresentado por forma do /CAIXA_APRESENTADO (filtrado à janela
    // pelos caixas do período). TEF unificado em Cartão.
    const periodoCaixaCods = new Set(caixas.map((c) => c.caixaCodigo))
    const apresentadoList = apresentado.filter((a) => periodoCaixaCods.has(a.caixaCodigo))

    const saidasMap = new Map<string, number>()
    let prePagApresentado = 0
    let totalDiferenca = 0
    for (const a of apresentadoList) {
      const rec = a as unknown as Record<string, number>
      for (const f of CAIXA_APRESENTADO_FORMAS) {
        const vApr = Number(rec[`${f.key}Apresentado`]) || 0
        const vDif = Number(rec[`${f.key}Diferenca`]) || 0
        totalDiferenca += vDif
        if (f.key === 'prePag') {
          prePagApresentado += vApr
          continue // Pré-Pago entra nas ENTRADAS, não nas saídas.
        }
        if (vApr === 0) continue
        // Unifica TEF em Cartão (mesma regra do resto do app).
        const nome = isCartaoForma(f.key, f.nome) ? 'Cartão' : f.nome
        saidasMap.set(nome, (saidasMap.get(nome) ?? 0) + vApr)
      }
    }
    const saidas: MovLinha[] = Array.from(saidasMap.entries())
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor)
    const saidasTotal = saidas.reduce((s, l) => s + l.valor, 0)

    // Entradas — Combustível (= bloco 3a) + Produto (= grupos − combustível) +
    // Pré Pago Créd (do apresentado) + linhas do print que não temos fonte (0,00).
    const faturamentoCombustivel = vendasCombustivelTotais.total
    const faturamentoProdutos = vendasGruposTotais.total - faturamentoCombustivel
    const entradas: MovLinha[] = [
      { nome: 'Combustível', valor: faturamentoCombustivel },
      { nome: 'Produto', valor: faturamentoProdutos },
      { nome: 'Pré Pago Créd', valor: prePagApresentado },
      { nome: 'Vale', valor: 0 },
      { nome: 'Suprimento', valor: 0 },
      { nome: 'Recebimento', valor: 0 },
      { nome: 'Cheque Troco', valor: 0 },
      { nome: 'Serviço', valor: 0 },
      { nome: 'Fundo Cx Créd', valor: 0 },
      { nome: 'Ordem Pagto', valor: 0 },
      { nome: 'Pagamento', valor: 0 },
      { nome: 'Saída Troca', valor: 0 },
      { nome: 'Serviço Troca', valor: 0 },
    ]
    const entradasTotal = entradas.reduce((s, l) => s + l.valor, 0)

    return {
      bicos: bicoRows,
      bicoTotais,
      vendasCombustivel,
      vendasCombustivelTotais,
      vendasGrupos,
      vendasGruposTotais,
      cobrar,
      cobrarTotal,
      saidas,
      saidasTotal,
      entradas,
      entradasTotal,
      diferencasFechamento: totalDiferenca,
      faturamentoCombustivel,
      faturamentoProdutos,
    }
  }, [produtosData, gruposData, bicosRaw, tanquesRaw, abastData, vendaItens, autorizados, caixasRaw, apresentadoRaw, titulosRaw, empresaCodigo, dataInicial, dataFinal])

  return { data, isLoading, hasEmpresa }
}

export default useCaixaGeral
