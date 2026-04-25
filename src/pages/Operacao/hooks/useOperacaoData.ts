import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchBombas, fetchBicos } from '@/api/endpoints/combustiveis'
import { fetchAbastecimentosChunked } from '@/api/helpers/fetchAbastecimentosChunked'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchCaixas } from '@/api/endpoints/financeiro'
import { fetchVendaFormasPagamento } from '@/api/endpoints/vendas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'

/* ── Types ───────────────────────────────────────────────── */

export interface OperacaoKpiData {
  totalAbastecimentos: number
  totalLitros: number
  faturamentoCombustivel: number
  ticketMedio: number
  frentistasAtivos: number
  bombasAtivas: number
  caixasAbertos: number
  totalApurado: number
}

export interface FrentistaRow {
  [key: string]: unknown
  funcionarioCodigo: number
  nome: string
  ativo: boolean
  litrosVendidos: number
  atendimentos: number
  faturamento: number
  ticketMedio: number
}

export interface BombaRow {
  bombaCodigo: number
  descricao: string
  referencia: string
  quantidadeBicos: number
  ilha: number
  fabricante: string
  modelo: string
  litrosVendidos: number
  abastecimentos: number
  faturamento: number
  combustiveis: string[]
}

export interface AbastecimentoRow {
  [key: string]: unknown
  codigo: number
  dataHora: string
  frentistaNome: string
  frentistaCodigo: number
  produtoNome: string
  produtoCodigo: number
  bicoCodigo: number
  litros: number
  valorUnitario: number
  valorTotal: number
  placa: string
}

export interface TurnoFrentista {
  nome: string
  litros: number
  atendimentos: number
  faturamento: number
}

export interface TurnoPagamento {
  tipo: string
  nome: string
  valor: number
  quantidade: number
}

export interface TurnoRow {
  caixaCodigo: number
  turno: string
  turnoCodigo: number
  funcionarioNome: string
  funcionarioCodigo: number
  dataMovimento: string
  abertura: string
  fechamento: string
  fechado: boolean
  apurado: number
  diferenca: number
  totalVendas: number
  frentistas: TurnoFrentista[]
  pagamentos: TurnoPagamento[]
}

export interface CaixaResumo {
  totalApurado: number
  totalDiferenca: number
  caixasAbertos: number
  caixasFechados: number
}

export interface PagamentoBreakdown {
  tipo: string
  nome: string
  valor: number
  quantidade: number
}

/* ── Hook ────────────────────────────────────────────────── */

const useOperacaoData = () => {
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null
  const hasEmpresa = empresaCodigos.length > 0

  // Abastecimentos — chunked by week to avoid 50k API limit
  const { data: abastecimentosData, isLoading: l1 } = useQuery({
    queryKey: ['abastecimentos', dataInicial, dataFinal],
    queryFn: () => fetchAbastecimentosChunked({ dataInicial, dataFinal }),
    enabled: hasEmpresa,
  })

  // Funcionários (direct call — small dataset)
  const { data: funcionariosRaw, isLoading: l2 } = useQuery({
    queryKey: ['funcionarios', empresaCodigo],
    queryFn: () => fetchFuncionarios({ empresaCodigo: empresaCodigo!, limite: 1000 }),
    enabled: hasEmpresa && empresaCodigo !== null,
    staleTime: 30 * 60 * 1000,
  })

  // Bombas (no pagination params in this endpoint)
  const { data: bombasRaw, isLoading: l3 } = useQuery({
    queryKey: ['bombas', empresaCodigo],
    queryFn: () => fetchBombas({ empresaCodigo: empresaCodigo! }),
    enabled: hasEmpresa && empresaCodigo !== null,
    staleTime: 30 * 60 * 1000,
  })

  // Bicos (direct call — small dataset)
  const { data: bicosRaw, isLoading: l4 } = useQuery({
    queryKey: ['bicos', empresaCodigo],
    queryFn: () => fetchBicos({ empresaCodigo: empresaCodigo!, limite: 1000 }),
    enabled: hasEmpresa && empresaCodigo !== null,
    staleTime: 30 * 60 * 1000,
  })

  // Produtos (cached, shared across modules)
  const { data: produtosData, isLoading: l5 } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages(
      (p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 100
    ),
    staleTime: 30 * 60 * 1000,
  })

  // Caixas (direct call)
  const { data: caixasRaw, isLoading: l6 } = useQuery({
    queryKey: ['caixas', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchCaixas({ empresaCodigo: empresaCodigo!, dataInicial, dataFinal, limite: 1000 }),
    enabled: hasEmpresa && empresaCodigo !== null,
  })

  // Formas de pagamento
  const { data: formasPgtoRaw, isLoading: l7 } = useQuery({
    queryKey: ['vendaFormasPgto', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchVendaFormasPagamento({ empresaCodigo: empresaCodigo!, dataInicial, dataFinal, limite: 1000 }),
    enabled: hasEmpresa && empresaCodigo !== null,
  })

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6 || l7

  const computed = useMemo(() => {
    // Filter abastecimentos by empresa client-side (endpoint has no empresaCodigo param)
    const abastecimentos = (abastecimentosData ?? []).filter(
      (a) => !empresaCodigo || a.empresaCodigo === empresaCodigo
    )
    const funcionarios = funcionariosRaw?.resultados ?? []
    const bombas = bombasRaw?.resultados ?? []
    const bicos = bicosRaw?.resultados ?? []
    const produtos = produtosData ?? []
    const caixas = caixasRaw?.resultados ?? []
    const formasPgto = formasPgtoRaw?.resultados ?? []

    // ── Maps ──
    const funcMap = new Map<number, { nome: string; ativo: boolean }>()
    for (const f of funcionarios) {
      funcMap.set(f.funcionarioCodigo, { nome: f.nome, ativo: f.ativo })
    }

    // Map by produtoCodigo, produtoLmcCodigo, and codigo (API primary key)
    // Abastecimento.codigoProduto may match any of these
    const produtoMap = new Map<number, string>()
    for (const p of produtos) {
      produtoMap.set(p.produtoCodigo, p.nome)
      if (p.produtoLmcCodigo) produtoMap.set(p.produtoLmcCodigo, p.nome)
      if (p.codigo) produtoMap.set(p.codigo, p.nome)
    }

    const bicoToBomba = new Map<number, number>()
    const bicoProduto = new Map<number, number>()
    for (const b of bicos) {
      bicoToBomba.set(b.bicoCodigo, b.bombaCodigo)
      bicoProduto.set(b.bicoCodigo, b.produtoCodigo)
    }

    // Resolve product name: try direct lookup first, then via bico → produtoCodigo
    const resolveProdutoNome = (codigoProduto: number, codigoBico: number): string => {
      const direct = produtoMap.get(codigoProduto)
      if (direct) return direct
      const viaBico = bicoProduto.get(codigoBico)
      if (viaBico) {
        const nome = produtoMap.get(viaBico)
        if (nome) return nome
      }
      return `Produto ${codigoProduto}`
    }

    // ── Frentistas ──
    const frentistaAgg = new Map<number, { litros: number; count: number; valor: number }>()
    for (const a of abastecimentos) {
      const prev = frentistaAgg.get(a.codigoFrentista) ?? { litros: 0, count: 0, valor: 0 }
      frentistaAgg.set(a.codigoFrentista, {
        litros: prev.litros + a.quantidade,
        count: prev.count + 1,
        valor: prev.valor + a.valorTotal,
      })
    }

    const frentistaRows: FrentistaRow[] = Array.from(frentistaAgg.entries())
      .map(([cod, agg]) => {
        const func = funcMap.get(cod)
        return {
          funcionarioCodigo: cod,
          nome: func?.nome ?? `Frentista ${cod}`,
          ativo: func?.ativo ?? true,
          litrosVendidos: agg.litros,
          atendimentos: agg.count,
          faturamento: agg.valor,
          ticketMedio: agg.count > 0 ? agg.valor / agg.count : 0,
        }
      })
      .sort((a, b) => b.litrosVendidos - a.litrosVendidos)

    // ── Bombas ──
    const bombaAgg = new Map<number, { litros: number; count: number; valor: number; combustiveis: Set<string> }>()
    for (const a of abastecimentos) {
      const bombaCod = bicoToBomba.get(a.codigoBico) ?? 0
      const prev = bombaAgg.get(bombaCod) ?? { litros: 0, count: 0, valor: 0, combustiveis: new Set<string>() }
      prev.litros += a.quantidade
      prev.count += 1
      prev.valor += a.valorTotal
      const prodNome = resolveProdutoNome(a.codigoProduto, a.codigoBico)
      if (!prodNome.startsWith('Produto ')) prev.combustiveis.add(prodNome)
      bombaAgg.set(bombaCod, prev)
    }

    const bombaRows: BombaRow[] = bombas
      .map((b) => {
        const agg = bombaAgg.get(b.bombaCodigo) ?? { litros: 0, count: 0, valor: 0, combustiveis: new Set<string>() }
        const bombaBicos = bicos.filter((bi) => bi.bombaCodigo === b.bombaCodigo)
        const combustiveis =
          agg.combustiveis.size > 0
            ? Array.from(agg.combustiveis)
            : bombaBicos.map((bi) => produtoMap.get(bi.produtoCodigo) ?? '').filter(Boolean)
        return {
          bombaCodigo: b.bombaCodigo,
          descricao: b.descricao || `Bomba ${b.bombaCodigo}`,
          referencia: b.bombaReferencia,
          quantidadeBicos: b.quantidadeBicos,
          ilha: b.ilha,
          fabricante: b.fabricante,
          modelo: b.modelo,
          litrosVendidos: agg.litros,
          abastecimentos: agg.count,
          faturamento: agg.valor,
          combustiveis: [...new Set(combustiveis)],
        }
      })
      .sort((a, b) => b.litrosVendidos - a.litrosVendidos)

    // ── Abastecimentos table ──
    const abastecimentoRows: AbastecimentoRow[] = abastecimentos
      .map((a) => ({
        codigo: a.codigo,
        dataHora: a.dataHoraAbastecimento || `${a.dataFiscal} ${a.horaFiscal}`,
        frentistaNome: funcMap.get(a.codigoFrentista)?.nome ?? `Frentista ${a.codigoFrentista}`,
        frentistaCodigo: a.codigoFrentista,
        produtoNome: resolveProdutoNome(a.codigoProduto, a.codigoBico),
        produtoCodigo: a.codigoProduto,
        bicoCodigo: a.codigoBico,
        litros: a.quantidade,
        valorUnitario: a.valorUnitario,
        valorTotal: a.valorTotal,
        placa: a.placa,
      }))
      .sort((a, b) => b.dataHora.localeCompare(a.dataHora))

    // ── Helper: extract HH:mm from time or datetime string ──
    const extractTime = (raw: string | null | undefined): string => {
      if (!raw) return ''
      // If it contains a space, it's "YYYY-MM-DD HH:mm:ss" → take the time part
      if (raw.includes(' ')) {
        const timePart = raw.split(' ')[1]
        return timePart ? timePart.substring(0, 5) : ''
      }
      // If it contains 'T', it's ISO format
      if (raw.includes('T')) {
        const timePart = raw.split('T')[1]
        return timePart ? timePart.substring(0, 5) : ''
      }
      // Otherwise assume it's already HH:mm:ss
      return raw.substring(0, 5)
    }

    // ── Turnos (from Caixas) with frentistas cross-reference ──
    const turnoRows: TurnoRow[] = caixas
      .map((c) => {
        const caixaDate = c.dataMovimento?.substring(0, 10) ?? ''

        // Convert caixa open/close to UTC timestamps for comparison
        const aberturaTs = c.abertura ? new Date(c.abertura).getTime() : null
        const fechamentoTs = c.fechamento ? new Date(c.fechamento).getTime() : null

        const shiftAbast = abastecimentos.filter((a) => {
          // Pre-filter by date for performance
          const abastDate = (a.dataFiscal || a.dataHoraAbastecimento?.substring(0, 10)) ?? ''
          if (abastDate !== caixaDate) return false
          // Time window via UTC timestamps
          if (!a.dataHoraAbastecimento || !aberturaTs) return true
          const abastTs = new Date(a.dataHoraAbastecimento).getTime()
          if (abastTs < aberturaTs) return false
          if (fechamentoTs && abastTs > fechamentoTs) return false
          return true
        })

        // Aggregate frentistas who worked this shift
        const frentistaAgg = new Map<number, { litros: number; count: number; valor: number }>()
        for (const a of shiftAbast) {
          const prev = frentistaAgg.get(a.codigoFrentista) ?? { litros: 0, count: 0, valor: 0 }
          frentistaAgg.set(a.codigoFrentista, {
            litros: prev.litros + a.quantidade,
            count: prev.count + 1,
            valor: prev.valor + a.valorTotal,
          })
        }

        const frentistas: TurnoFrentista[] = Array.from(frentistaAgg.entries())
          .map(([cod, agg]) => ({
            nome: funcMap.get(cod)?.nome ?? `Frentista ${cod}`,
            litros: agg.litros,
            atendimentos: agg.count,
            faturamento: agg.valor,
          }))
          .sort((a, b) => b.litros - a.litros)

        // Cross-reference formas de pagamento for this shift
        const shiftPgto = formasPgto.filter((fp) => {
          const fpDate = fp.dataMovimento?.substring(0, 10) ?? ''
          return fpDate === caixaDate
        })

        const pgtoAggShift = new Map<string, { nome: string; valor: number; count: number }>()
        for (const fp of shiftPgto) {
          const tipo = fp.tipoFormaPagamento || 'OUTROS'
          const prev = pgtoAggShift.get(tipo) ?? { nome: fp.nomeFormaPagamento || tipo, valor: 0, count: 0 }
          prev.valor += fp.valorPagamento
          prev.count += 1
          pgtoAggShift.set(tipo, prev)
        }

        const pagamentos: TurnoPagamento[] = Array.from(pgtoAggShift.entries())
          .map(([tipo, agg]) => ({ tipo, nome: agg.nome, valor: agg.valor, quantidade: agg.count }))
          .sort((a, b) => b.valor - a.valor)

        const totalVendas = pagamentos.reduce((s, p) => s + p.valor, 0)

        return {
          caixaCodigo: c.caixaCodigo,
          turno: c.turno || `Turno ${c.turnoCodigo}`,
          turnoCodigo: c.turnoCodigo,
          funcionarioNome: funcMap.get(c.funcionarioCodigo)?.nome ?? `Funcionário ${c.funcionarioCodigo}`,
          funcionarioCodigo: c.funcionarioCodigo,
          dataMovimento: c.dataMovimento,
          abertura: extractTime(c.abertura),
          fechamento: extractTime(c.fechamento),
          fechado: c.fechado,
          apurado: c.apurado,
          diferenca: c.diferenca,
          totalVendas,
          frentistas,
          pagamentos,
        }
      })
      .sort((a, b) => {
        if (a.fechado !== b.fechado) return a.fechado ? 1 : -1
        return b.dataMovimento.localeCompare(a.dataMovimento)
      })

    // ── Caixa summary ──
    const caixaResumo: CaixaResumo = {
      totalApurado: caixas.reduce((s, c) => s + c.apurado, 0),
      totalDiferenca: caixas.filter((c) => c.fechado).reduce((s, c) => s + c.diferenca, 0),
      caixasAbertos: caixas.filter((c) => !c.fechado).length,
      caixasFechados: caixas.filter((c) => c.fechado).length,
    }

    // ── Payment breakdown ──
    const pgtoAgg = new Map<string, { nome: string; valor: number; count: number }>()
    for (const fp of formasPgto) {
      const tipo = fp.tipoFormaPagamento || 'OUTROS'
      const prev = pgtoAgg.get(tipo) ?? { nome: fp.nomeFormaPagamento || tipo, valor: 0, count: 0 }
      prev.valor += fp.valorPagamento
      prev.count += 1
      pgtoAgg.set(tipo, prev)
    }

    const pagamentoBreakdown: PagamentoBreakdown[] = Array.from(pgtoAgg.entries())
      .map(([tipo, agg]) => ({
        tipo,
        nome: agg.nome,
        valor: agg.valor,
        quantidade: agg.count,
      }))
      .sort((a, b) => b.valor - a.valor)

    // ── KPIs ──
    const totalLitros = abastecimentos.reduce((s, a) => s + a.quantidade, 0)
    const totalFat = abastecimentos.reduce((s, a) => s + a.valorTotal, 0)

    const kpis: OperacaoKpiData = {
      totalAbastecimentos: abastecimentos.length,
      totalLitros,
      faturamentoCombustivel: totalFat,
      ticketMedio: abastecimentos.length > 0 ? totalFat / abastecimentos.length : 0,
      frentistasAtivos: frentistaRows.filter((f) => f.ativo).length,
      bombasAtivas: bombaRows.filter((b) => b.abastecimentos > 0).length,
      caixasAbertos: caixaResumo.caixasAbertos,
      totalApurado: caixaResumo.totalApurado,
    }

    // Filter lists for UI
    const frentistasList = frentistaRows.map((f) => ({ codigo: f.funcionarioCodigo, nome: f.nome }))
    // Build unique combustíveis list from resolved names
    const combMap = new Map<number, string>()
    for (const a of abastecimentos) {
      if (!combMap.has(a.codigoProduto)) {
        combMap.set(a.codigoProduto, resolveProdutoNome(a.codigoProduto, a.codigoBico))
      }
    }
    const combustiveisList = Array.from(combMap.entries()).map(([codigo, nome]) => ({ codigo, nome }))

    return {
      kpis,
      frentistaRows,
      bombaRows,
      abastecimentoRows,
      turnoRows,
      caixaResumo,
      pagamentoBreakdown,
      frentistasList,
      combustiveisList,
    }
  }, [abastecimentosData, funcionariosRaw, bombasRaw, bicosRaw, produtosData, caixasRaw, formasPgtoRaw, empresaCodigo])

  return {
    ...computed,
    isLoading,
    hasEmpresa,
  }
}

export default useOperacaoData
