import { useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import {
  fetchVendaItens,
  fetchVendaCodigosAutorizados,
  fetchVendaCodigosCancelados,
} from '@/api/endpoints/vendas'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { useFilterStore } from '@/store/filters'
import { fuelLabel } from '@/lib/fuel'
import type { VendaItem } from '@/api/types/venda'

/** Ref estável p/ default das queries de set (evita novo Set por render). */
const EMPTY_SET: Set<number> = new Set()

export interface BaseTotais {
  litros: number
  faturamento: number
  custo: number
  lucroBruto: number
  margemPct: number
  /** Cupons distintos (vendaCodigo) da base. */
  cupons: number
}

export interface FuelMovFiscalRow {
  nome: string
  movLitros: number
  movFat: number
  fisLitros: number
  fisFat: number
}

/**
 * VALIDAÇÃO (descartável) do conceito Movimento × Fiscal pro COMBUSTÍVEL, AO VIVO.
 *
 * Lê `/VENDA_ITEM` (todos os itens de combustível do período) e cruza com dois
 * conjuntos de `/VENDA`:
 *  - autorizados (situacao='A') → base FISCAL (o que a Central mostra hoje)
 *  - cancelados  (situacao='C') → excluídos da base MOVIMENTO
 *
 * Bases:
 *  - Movimento = itens NÃO-cancelados (autorizados + pendentes/contingência)
 *  - Fiscal    = itens cujo `vendaCodigo` está autorizado
 *  - Δ (gap)   = Movimento − Fiscal = não-fiscalizado (pendente/contingência)
 *
 * Mesma fonte e mesmos campos nas duas bases (só muda o filtro de situação),
 * então litros E faturamento são diretamente comparáveis. SÓ valida o gap — a
 * versão definitiva moverá isto pro cache (apuracao_vendas) com Movimento default.
 *
 * Requer posto(s) selecionado(s) no filtro (rede-wide ao vivo seria pesado).
 */
const useFuelMovimentoValidacao = (empresaCodigoOverride?: number | null) => {
  const { empresaCodigos: filterCodes, dataInicial, dataFinal } = useFilterStore()
  const empresaCodigos = empresaCodigoOverride !== undefined
    ? (empresaCodigoOverride !== null ? [empresaCodigoOverride] : [])
    : filterCodes
  // Só vale com EXATAMENTE 1 posto: o selo é ao vivo (rede-wide ou multi-posto
  // seria pesado e perde o sentido "verificar este posto"). Sem isso, não busca.
  const hasEmpresa = empresaCodigos.length === 1
  const codesKey = empresaCodigos.join(',')

  const { data: produtosData } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages((p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    staleTime: 30 * 60 * 1000,
  })

  const fetchItens = async (): Promise<VendaItem[]> => {
    const per = await Promise.all(
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
    return per.flat()
  }

  const fetchSet = (
    fn: (p: { empresaCodigo?: number; dataInicial?: string; dataFinal?: string }) => Promise<Set<number>>,
  ) => async (): Promise<Set<number>> => {
    const sets = await Promise.all(
      empresaCodigos.map((emp) => fn({ empresaCodigo: emp, dataInicial, dataFinal })),
    )
    const all = new Set<number>()
    for (const s of sets) for (const c of s) all.add(c)
    return all
  }

  const { data: vendaItens = [], isLoading: isLoadingItens } = useQuery({
    queryKey: ['fuel-movfiscal-itens', codesKey, dataInicial, dataFinal],
    queryFn: fetchItens,
    enabled: hasEmpresa,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })
  const { data: autorizados = EMPTY_SET, isLoading: isLoadingAut } = useQuery({
    queryKey: ['fuel-movfiscal-aut', codesKey, dataInicial, dataFinal],
    queryFn: fetchSet(fetchVendaCodigosAutorizados),
    enabled: hasEmpresa,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })
  const { data: canceladas = EMPTY_SET, isLoading: isLoadingCanc } = useQuery({
    queryKey: ['fuel-movfiscal-canc', codesKey, dataInicial, dataFinal],
    queryFn: fetchSet(fetchVendaCodigosCancelados),
    enabled: hasEmpresa,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  const isLoading = isLoadingItens || isLoadingAut || isLoadingCanc

  return useMemo(() => {
    // Combustível = tipoProduto "C"; nome alias-expandido.
    const fuelCodes = new Set<number>()
    const nomePorCodigo = new Map<number, string>()
    for (const p of produtosData ?? []) {
      if (p.tipoProduto !== 'C') continue
      for (const c of [p.produtoCodigo, p.produtoLmcCodigo, p.codigo]) {
        if (typeof c === 'number' && c > 0) {
          fuelCodes.add(c)
          if (!nomePorCodigo.has(c)) nomePorCodigo.set(c, p.nome)
        }
      }
    }
    const isFuel = (prod: number) => fuelCodes.size === 0 || fuelCodes.has(prod)
    const inPeriod = (d: string) => {
      const dd = (d || '').slice(0, 10)
      return dd >= dataInicial && dd <= dataFinal
    }

    interface Acc { litros: number; faturamento: number; custo: number; lucroBruto: number; cupons: Set<number> }
    const blank = (): Acc => ({ litros: 0, faturamento: 0, custo: 0, lucroBruto: 0, cupons: new Set() })
    const mov = blank()
    const fis = blank()
    const byFuel = new Map<string, FuelMovFiscalRow>()

    for (const it of vendaItens) {
      if (it.quantidade <= 0 || !isFuel(it.produtoCodigo)) continue
      if (!inPeriod(it.dataMovimento)) continue
      if (canceladas.has(it.vendaCodigo)) continue // Movimento EXCLUI canceladas
      const custo = it.precoCusto * it.quantidade
      const lucro = it.totalVenda - custo
      const nome = fuelLabel(nomePorCodigo.get(it.produtoCodigo) ?? `Produto ${it.produtoCodigo}`)
        || `Produto ${it.produtoCodigo}`
      const isFiscal = autorizados.has(it.vendaCodigo)

      mov.litros += it.quantidade
      mov.faturamento += it.totalVenda
      mov.custo += custo
      mov.lucroBruto += lucro
      mov.cupons.add(it.vendaCodigo)

      const f = byFuel.get(nome) ?? { nome, movLitros: 0, movFat: 0, fisLitros: 0, fisFat: 0 }
      f.movLitros += it.quantidade
      f.movFat += it.totalVenda

      if (isFiscal) {
        fis.litros += it.quantidade
        fis.faturamento += it.totalVenda
        fis.custo += custo
        fis.lucroBruto += lucro
        fis.cupons.add(it.vendaCodigo)
        f.fisLitros += it.quantidade
        f.fisFat += it.totalVenda
      }
      byFuel.set(nome, f)
    }

    const totais = (a: Acc): BaseTotais => ({
      litros: a.litros,
      faturamento: a.faturamento,
      custo: a.custo,
      lucroBruto: a.lucroBruto,
      margemPct: a.faturamento > 0 ? (a.lucroBruto / a.faturamento) * 100 : 0,
      cupons: a.cupons.size,
    })

    return {
      hasEmpresa,
      isLoading,
      movimento: totais(mov),
      fiscal: totais(fis),
      porFuel: Array.from(byFuel.values()).sort((a, b) => b.movLitros - a.movLitros),
    }
  }, [vendaItens, autorizados, canceladas, produtosData, dataInicial, dataFinal, hasEmpresa, isLoading])
}

export default useFuelMovimentoValidacao
