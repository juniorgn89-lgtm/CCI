import { useMemo, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchBicos } from '@/api/endpoints/combustiveis'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { fetchAbastecimentosChunked } from '@/api/helpers/fetchAbastecimentosChunked'
import { useTabelasPrazo } from '@/pages/Dashboard/hooks/useTabelasPrazo'
import { classifyFuelSlug } from '@/api/supabase/concorrencia'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import useRedeSetores from '@/pages/Dashboard/hooks/useRedeSetores'
import { PRECO_CADASTRO_MIN } from '@/lib/gestaoPrecos'

/**
 * Gestão de Preços (Central da Rede) — sub-fase 1.1: derivação do DESVIO de
 * preço por produto e por posto. Tudo read-only.
 *
 * Desvio (FATO, base FÍSICA /ABASTECIMENTO): `preco_cadastro − valor_unitario`,
 * carimbado no abastecimento. LB cedido (DERIVADO) = Σ desvio>0 × volume
 * (cedido-only é a manchete — decisão 2; o `lbNet` traz cedido − ganho pro
 * tooltip). LB realizado (FATO, base FISCAL) vem do `useRedeSetores`; por isso
 * `lbPotencial = realizado + cedido` cruza bases — ver BASE_MIX_NOTE.
 *
 * FONTE (1.1): live `/ABASTECIMENTO` (sempre traz o preço de tabela). O cache
 * `apuracao_abastecimentos` só ganha `preco_cadastro` após o deploy do cron +
 * re-apuração; o cache-first entra então. A `cobertura` (% de abastecimentos
 * com preço de tabela) acompanha o número desde o 1º render — número sem
 * cobertura visível, não.
 *
 * Combustível só (o `/ABASTECIMENTO` é fuel-only).
 */

export interface GestaoPrecoRow {
  /** produtoCodigo (byProduto) ou empresaCodigo (byPosto). */
  key: number
  label: string
  /** Litros no escopo (FATO). */
  volume: number
  /** Preço de tabela médio, ponderado por volume (FATO). */
  precoTabelaMedio: number
  /** Preço praticado médio, ponderado por volume (FATO). */
  precoPraticadoMedio: number
  /** Tabela − praticado, R$/L (DERIVADO). >0 = cedeu; <0 = vendeu acima. */
  desvioMedio: number
  /** Σ desvio>0 × volume — cedido (DERIVADO, manchete). = lbSancionado + lbAjuste. */
  lbCedido: number
  /** Parte do cedido que casou uma tabela cadastrada (BARATAO) — promo autorizada (DERIVADO). */
  lbSancionado: number
  /** Parte do cedido SEM tabela — ajuste de bomba não-autorizado a investigar (DERIVADO). */
  lbAjuste: number
  /** Σ desvio<0 × volume — vendeu acima (DERIVADO). */
  lbGanho: number
  /** cedido − ganho (DERIVADO, tooltip). */
  lbNet: number
  /** LB realizado (FATO, base fiscal — useRedeSetores). */
  lbRealizado: number
  /** realizado + cedido (DERIVADO, cruza bases). */
  lbPotencial: number
  /** cedido ÷ potencial × 100 (DERIVADO). */
  pctCedido: number
  /** Acréscimos − descontos das vendas (R$, base FISCAL useRedeSetores). <0 = desconto predominou. */
  acresDesc: number
  /** "De onde cedeu": quebra pela OUTRA dimensão (produto→postos; posto→produtos). */
  detalhe: GestaoPrecoDetalhe[]
  /** Atribuição do cedido: ajuste de bomba (não-autorizado) × sancionado por tabela. */
  origem: GestaoPrecoOrigem
}

/** Origem do cedido. `ajusteBomba` = sem cobertura de tabela; `sancionado` = casou
 *  uma "Tabela de Preço de Prazos" cadastrada (desconto legítimo). */
export interface GestaoPrecoOrigem {
  ajusteBomba: number
  sancionado: { ref: string; descricao: string; valor: number }[]
}

export interface GestaoPrecoDetalhe {
  key: number
  label: string
  volume: number
  precoTabelaMedio: number
  precoPraticadoMedio: number
  desvioMedio: number
  lbCedido: number
}

export interface GestaoPrecosData {
  isLoading: boolean
  /** Honestidade do fallback: quantos abastecimentos têm preço de tabela. */
  cobertura: { totalFills: number; comTabela: number; pct: number }
  byProduto: GestaoPrecoRow[]
  byPosto: GestaoPrecoRow[]
  global: { volume: number; lbRealizado: number; lbCedido: number; lbPotencial: number; pctCedido: number }
}

interface Acc {
  vol: number
  tabelaW: number   // Σ preco_cadastro × qtd
  pratW: number     // Σ valor_unitario × qtd
  cedido: number
  ganho: number
}
const blank = (): Acc => ({ vol: 0, tabelaW: 0, pratW: 0, cedido: 0, ganho: 0 })

const useGestaoPrecos = (): GestaoPrecosData => {
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const [nowTs] = useState(() => Date.now())
  const rede = useRedeSetores()

  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas({ limite: 200 }),
    staleTime: 30 * 60 * 1000,
  })
  const permitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])

  // Catálogo p/ nome do produto + bridge de aliases (codigoProduto do
  // abastecimento → produtoCodigo canônico que o useRedeSetores usa).
  const { data: produtosData } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages((p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    staleTime: 30 * 60 * 1000,
  })

  // Bicos do escopo — ponte bico → produtoCodigo do catálogo. O /ABASTECIMENTO
  // (físico) nem sempre traz um codigoProduto que casa direto com o catálogo/
  // venda; resolver pelo bico é o caminho confiável (igual ao useOperacaoData).
  const scopeCodes = useMemo(() => {
    const permit = permitidas.map((e) => e.codigo)
    return empresaCodigos.length > 0 ? permit.filter((c) => empresaCodigos.includes(c)) : permit
  }, [permitidas, empresaCodigos])
  const { data: bicosData = [] } = useQuery({
    queryKey: ['gestao-precos-bicos', scopeCodes.join(',')],
    queryFn: async () => {
      const per = await Promise.all(scopeCodes.map((c) => fetchBicos({ empresaCodigo: c, limite: 1000 }).then((r) => r.resultados)))
      return per.flat()
    },
    enabled: scopeCodes.length > 0,
    staleTime: 30 * 60 * 1000,
  })

  // Tabelas de Preço de Prazos (BARATAO etc.) — live da API — pra atribuição "sancionado".
  const { data: tabelasApi = [] } = useTabelasPrazo()

  // Live /ABASTECIMENTO (rede-wide; o endpoint ignora empresaCodigo → filtra no
  // cliente). Traz preco_cadastro/tabelaPrecoA-C sempre.
  const { data: abastRaw = [], isLoading: loadingAbast } = useQuery({
    queryKey: ['gestao-precos-abast', dataInicial, dataFinal],
    queryFn: () => fetchAbastecimentosChunked({ dataInicial, dataFinal }),
    enabled: !!dataInicial && !!dataFinal,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  return useMemo(() => {
    // Escopo de postos = filtro global (ou todos os permitidos quando vazio).
    const permitSet = new Set(permitidas.map((e) => e.codigo))
    const inScope = (code: number) =>
      permitSet.has(code) && (empresaCodigos.length === 0 || empresaCodigos.includes(code))
    const nomePosto = new Map(permitidas.map((e) => [e.codigo, e.fantasia]))

    // Nome do produto + alias → canônico.
    const nomeProduto = new Map<number, string>()
    const aliasCanonico = new Map<number, number>()
    for (const p of produtosData ?? []) {
      const canon = p.produtoCodigo
      for (const c of [p.produtoCodigo, p.produtoLmcCodigo, p.codigo]) {
        if (typeof c === 'number' && c > 0) {
          aliasCanonico.set(c, canon)
          if (!nomeProduto.has(c)) nomeProduto.set(c, p.nome)
        }
      }
    }
    const canonOf = (codigo: number) => aliasCanonico.get(codigo) ?? codigo

    // Bico → produtoCodigo (catálogo). Resolve o produto físico do abastecimento.
    const bicoToProduto = new Map<number, number>()
    for (const b of bicosData) bicoToProduto.set(b.bicoCodigo, b.produtoCodigo)
    const resolveProd = (codigoProduto: number, codigoBico: number) =>
      canonOf(bicoToProduto.get(codigoBico) ?? codigoProduto)

    const todayISO = new Date(nowTs).toISOString().slice(0, 10)
    const notFuture = (a: { dataFiscal?: string; dataHoraAbastecimento?: string }) => {
      const dF = (a.dataFiscal ?? '').slice(0, 10)
      const dH = (a.dataHoraAbastecimento ?? '').slice(0, 10)
      return !(dF && dF > todayISO) && !(dH && dH > todayISO)
    }

    // ── Atribuição: índice das linhas de tabela de combustível por (posto, slug).
    // Live da API: empresaCodigo e produtoCodigo já vêm resolvidos (sem casar por
    // nome). dias 1–7 (1=domingo) → convenção getDay() 0–6. ──
    type TabLine = { valor: number; ref: string; descricao: string; vi: string | null; vf: string | null; dias: number[] | null }
    const tabelaIdx = new Map<string, TabLine[]>()
    for (const tab of tabelasApi) {
      const dias = tab.diasSemana ? tab.diasSemana.map((d) => (d - 1 + 7) % 7) : null
      for (const it of tab.itens) {
        if (it.tipo !== 'especifico' || it.produtoCodigo == null) continue
        const slug = classifyFuelSlug(nomeProduto.get(canonOf(it.produtoCodigo)) ?? '')
        if (!slug) continue
        // Posto fora do escopo permitido → trata como rede ("all").
        let emp: number | null = it.empresaCodigo
        if (emp != null && !permitSet.has(emp)) emp = null
        const key = `${emp ?? 'all'}|${slug}`
        const arr = tabelaIdx.get(key) ?? []
        arr.push({ valor: it.valor, ref: tab.ref, descricao: tab.descricao, vi: tab.validadeInicial, vf: tab.validadeFinal, dias })
        tabelaIdx.set(key, arr)
      }
    }
    const weekday = (date: string) => { const [y, m, d] = date.split('-').map(Number); return new Date(y, m - 1, d).getDay() }
    // Casa um abastecimento a uma tabela vigente: preço bate (±0,005), dentro da
    // validade + dia da semana. Filial específica do posto OU "all" (rede).
    const matchTabela = (emp: number, slug: string | null, vu: number, date: string): TabLine | null => {
      if (!slug) return null
      const wd = weekday(date)
      const cands = [...(tabelaIdx.get(`${emp}|${slug}`) ?? []), ...(tabelaIdx.get(`all|${slug}`) ?? [])]
      for (const l of cands) {
        if (Math.abs(l.valor - vu) > 0.01) continue
        if (l.vi && date < l.vi) continue
        if (l.vf && date > l.vf) continue
        if (l.dias && l.dias.length > 0 && l.dias.length < 7 && !l.dias.includes(wd)) continue
        return l
      }
      return null
    }
    type SancEntry = { ref: string; descricao: string; total: number }
    const ajusteByPosto = new Map<number, number>()
    const sancByPosto = new Map<number, Map<string, SancEntry>>()
    const ajusteByProduto = new Map<number, number>()
    const sancByProduto = new Map<number, Map<string, SancEntry>>()
    const bumpSanc = (m: Map<number, Map<string, SancEntry>>, k: number, t: TabLine, v: number) => {
      const inner = m.get(k) ?? new Map<string, SancEntry>()
      const e = inner.get(t.ref) ?? { ref: t.ref, descricao: t.descricao, total: 0 }
      e.total += v; inner.set(t.ref, e); m.set(k, inner)
    }

    // LB realizado (fato fiscal) por posto e por produto (canônico), no MESMO
    // escopo (o useRedeSetores já respeita o filtro global).
    const lbPorPosto = new Map<number, number>()
    const lbPorProduto = new Map<number, number>()
    // Acréscimos − descontos (base fiscal) por posto e por produto — mesmo escopo.
    const adPorPosto = new Map<number, number>()
    const adPorProduto = new Map<number, number>()
    for (const p of rede.combustivel.postos) {
      if (!inScope(p.empresaCodigo)) continue
      lbPorPosto.set(p.empresaCodigo, (lbPorPosto.get(p.empresaCodigo) ?? 0) + p.lucroBruto)
      for (const pr of p.produtos) {
        const canon = canonOf(pr.produtoCodigo)
        lbPorProduto.set(canon, (lbPorProduto.get(canon) ?? 0) + pr.lucroBruto)
        const ad = (pr.acrescimos ?? 0) - (pr.descontos ?? 0)
        adPorProduto.set(canon, (adPorProduto.get(canon) ?? 0) + ad)
        adPorPosto.set(p.empresaCodigo, (adPorPosto.get(p.empresaCodigo) ?? 0) + ad)
      }
    }

    // Acumula desvio por produto e por posto + a MATRIZ produto×posto (pro
    // drill "de onde cedeu"). Cobertura conta TODOS os abastecimentos válidos;
    // só os com preço de tabela entram na conta.
    const add = (acc: Acc, q: number, pc: number, vu: number, ced: number, gan: number) => {
      acc.vol += q; acc.tabelaW += pc * q; acc.pratW += vu * q; acc.cedido += ced; acc.ganho += gan
    }
    const bump = (m: Map<number, Map<number, Acc>>, k1: number, k2: number, q: number, pc: number, vu: number, ced: number, gan: number) => {
      const inner = m.get(k1) ?? new Map<number, Acc>()
      const acc = inner.get(k2) ?? blank()
      add(acc, q, pc, vu, ced, gan)
      inner.set(k2, acc); m.set(k1, inner)
    }
    const porProduto = new Map<number, Acc>()
    const porPosto = new Map<number, Acc>()
    const xProduto = new Map<number, Map<number, Acc>>() // produto → posto → acc
    const xPosto = new Map<number, Map<number, Acc>>()   // posto → produto → acc
    let totalFills = 0
    let comTabela = 0

    for (const a of abastRaw) {
      if (a.afericao) continue
      if (!inScope(a.empresaCodigo)) continue
      if (a.quantidade <= 0) continue
      if (!notFuture(a)) continue
      totalFills++
      if (a.precoCadastro <= PRECO_CADASTRO_MIN || a.valorUnitario <= 0) continue
      comTabela++

      const desvioUnit = a.precoCadastro - a.valorUnitario
      const cedido = Math.max(0, desvioUnit) * a.quantidade
      const ganho = Math.max(0, -desvioUnit) * a.quantidade
      const canon = resolveProd(a.codigoProduto, a.codigoBico)
      const q = a.quantidade, pc = a.precoCadastro, vu = a.valorUnitario

      const accP = porProduto.get(canon) ?? blank(); add(accP, q, pc, vu, cedido, ganho); porProduto.set(canon, accP)
      const accE = porPosto.get(a.empresaCodigo) ?? blank(); add(accE, q, pc, vu, cedido, ganho); porPosto.set(a.empresaCodigo, accE)
      bump(xProduto, canon, a.empresaCodigo, q, pc, vu, cedido, ganho)
      bump(xPosto, a.empresaCodigo, canon, q, pc, vu, cedido, ganho)

      // Atribuição do cedido: casou uma tabela cadastrada → sancionado; senão → ajuste de bomba.
      // Acumula por posto E por produto (a matriz sancionado/ajuste alimenta os dois eixos).
      if (cedido > 0) {
        const slug = classifyFuelSlug(nomeProduto.get(canon) ?? '')
        const date = (a.dataFiscal || a.dataHoraAbastecimento || '').slice(0, 10)
        const t = matchTabela(a.empresaCodigo, slug, vu, date)
        if (t) {
          bumpSanc(sancByPosto, a.empresaCodigo, t, cedido)
          bumpSanc(sancByProduto, canon, t, cedido)
        } else {
          ajusteByPosto.set(a.empresaCodigo, (ajusteByPosto.get(a.empresaCodigo) ?? 0) + cedido)
          ajusteByProduto.set(canon, (ajusteByProduto.get(canon) ?? 0) + cedido)
        }
      }
    }

    // Detalhe (quebra pela outra dimensão), ordenado por cedido desc.
    const toDetalhe = (inner: Map<number, Acc> | undefined, nome: (k: number) => string): GestaoPrecoDetalhe[] =>
      Array.from(inner?.entries() ?? [])
        .map(([k, acc]) => {
          const tab = acc.vol > 0 ? acc.tabelaW / acc.vol : 0
          const prat = acc.vol > 0 ? acc.pratW / acc.vol : 0
          return { key: k, label: nome(k), volume: acc.vol, precoTabelaMedio: tab, precoPraticadoMedio: prat, desvioMedio: tab - prat, lbCedido: acc.cedido }
        })
        .sort((a, b) => b.lbCedido - a.lbCedido)
    const nomeProdutoDe = (k: number) => nomeProduto.get(k) ?? `Produto ${k}`
    const nomePostoDe = (k: number) => nomePosto.get(k) ?? `Posto ${k}`
    const origemFrom = (sanc: Map<number, Map<string, SancEntry>>, ajuste: Map<number, number>, key: number): GestaoPrecoOrigem => ({
      ajusteBomba: ajuste.get(key) ?? 0,
      sancionado: [...(sanc.get(key)?.values() ?? [])]
        .map((e) => ({ ref: e.ref, descricao: e.descricao, valor: e.total }))
        .sort((a, b) => b.valor - a.valor),
    })

    const toRow = (key: number, label: string, acc: Acc, lbRealizado: number, acresDesc: number, detalhe: GestaoPrecoDetalhe[], origem: GestaoPrecoOrigem): GestaoPrecoRow => {
      const precoTabelaMedio = acc.vol > 0 ? acc.tabelaW / acc.vol : 0
      const precoPraticadoMedio = acc.vol > 0 ? acc.pratW / acc.vol : 0
      const lbNet = acc.cedido - acc.ganho
      const lbPotencial = lbRealizado + acc.cedido
      const lbSancionado = origem.sancionado.reduce((s, x) => s + x.valor, 0)
      const lbAjuste = Math.max(0, acc.cedido - lbSancionado)
      return {
        key,
        label,
        volume: acc.vol,
        precoTabelaMedio,
        precoPraticadoMedio,
        desvioMedio: precoTabelaMedio - precoPraticadoMedio,
        lbCedido: acc.cedido,
        lbSancionado,
        lbAjuste,
        lbGanho: acc.ganho,
        lbNet,
        lbRealizado,
        lbPotencial,
        pctCedido: lbPotencial > 0 ? (acc.cedido / lbPotencial) * 100 : 0,
        acresDesc,
        detalhe,
        origem,
      }
    }

    const byProduto = Array.from(porProduto.entries())
      .map(([codigo, acc]) => toRow(codigo, nomeProdutoDe(codigo), acc, lbPorProduto.get(codigo) ?? 0, adPorProduto.get(codigo) ?? 0, toDetalhe(xProduto.get(codigo), nomePostoDe), origemFrom(sancByProduto, ajusteByProduto, codigo)))
      .sort((a, b) => b.lbCedido - a.lbCedido)

    const byPosto = Array.from(porPosto.entries())
      .map(([codigo, acc]) => toRow(codigo, nomePostoDe(codigo), acc, lbPorPosto.get(codigo) ?? 0, adPorPosto.get(codigo) ?? 0, toDetalhe(xPosto.get(codigo), nomeProdutoDe), origemFrom(sancByPosto, ajusteByPosto, codigo)))
      .sort((a, b) => b.lbCedido - a.lbCedido)

    const gCedido = byPosto.reduce((s, r) => s + r.lbCedido, 0)
    const gRealizado = byPosto.reduce((s, r) => s + r.lbRealizado, 0)
    const gVol = byPosto.reduce((s, r) => s + r.volume, 0)
    const gPotencial = gRealizado + gCedido

    return {
      isLoading: loadingAbast || rede.isLoading,
      cobertura: { totalFills, comTabela, pct: totalFills > 0 ? (comTabela / totalFills) * 100 : 0 },
      byProduto,
      byPosto,
      global: {
        volume: gVol,
        lbRealizado: gRealizado,
        lbCedido: gCedido,
        lbPotencial: gPotencial,
        pctCedido: gPotencial > 0 ? (gCedido / gPotencial) * 100 : 0,
      },
    }
  }, [abastRaw, produtosData, bicosData, tabelasApi, permitidas, empresaCodigos, rede, nowTs, loadingAbast])
}

export default useGestaoPrecos
