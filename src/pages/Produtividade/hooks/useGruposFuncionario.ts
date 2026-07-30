import { useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchVendaItens } from '@/api/endpoints/vendas'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { classifySetor } from '@/lib/setorClassification'
import useVendaCodigosAutorizados from '@/hooks/useVendaCodigosAutorizados'
import type { CombustivelBreak } from '@/pages/Produtividade/hooks/useFrentistaProdutividade'

/**
 * Derivações AO VIVO por funcionário a partir do `/VENDA_ITEM` do período (que o
 * cache `apuracao_vendas_funcionario` não guarda — ele só tem total por setor):
 *
 *  1. **Grupos de produto automotivo** (setor 'automotivos'/tipoGrupo 'Pista')
 *     vendidos por funcionário, quebrados por grupo de produto.
 *  2. **Evolução diária** no período — litros de combustível e faturamento de
 *     automotivos por dia. Só os dias COM movimento (o frentista tem folga; um dia
 *     em 0 é "não trabalhou", não "vendeu pouco") → a série é dos turnos dele.
 *
 * Conta só itens de vendas AUTORIZADAS (cruza `vendaCodigo` com `/VENDA`
 * situacao='A' — o /VENDA_ITEM não traz `cancelada`; ver
 * project_venda_item_sem_cancelada), então o total dos grupos bate com o card
 * "Automotivos". Uma única busca de itens alimenta as duas derivações.
 */
export interface GrupoVenda {
  grupo: string
  faturamento: number
  itens: number
}

/** Ponto diário no formato que o AnaliseSemanalLineCard consome (`litros` = a
 *  quantidade plotada/tooltip; `faturamento` = R$ do dia). */
export interface DiaEvol {
  data: string // yyyy-MM-dd
  litros: number
  faturamento: number
}

export interface EvolucaoFunc {
  /** Combustível (todos): litros = litros/dia, faturamento = R$/dia. */
  litros: DiaEvol[]
  /** Gasolina aditivada: litros = litros/dia, faturamento = R$/dia. */
  aditivada: DiaEvol[]
  /** Automotivos: litros = nº de itens/dia, faturamento = R$/dia. */
  automotivos: DiaEvol[]
}

const useGruposFuncionario = (
  postoCodigo?: number | null,
): { byFunc: Map<number, GrupoVenda[]>; evolucaoByFunc: Map<number, EvolucaoFunc>; combByFunc: Map<number, CombustivelBreak[]>; isLoading: boolean } => {
  const { dataInicial, dataFinal } = useFilterStore()
  const empresaCodigos = postoCodigo != null ? [postoCodigo] : []
  const hasEmpresa = empresaCodigos.length > 0

  // Itens de venda do posto no período (todos; filtramos por setor/autorizado no
  // memo). Cap alto (150 págs = 150k itens) fica bem acima de 1 mês de posto único.
  const { data: itens = [], isLoading: lItens } = useQuery({
    queryKey: ['produtividade-venda-itens', postoCodigo ?? 'none', dataInicial, dataFinal],
    queryFn: () =>
      fetchAllPages(
        (p) => fetchVendaItens({
          empresaCodigo: postoCodigo ?? undefined,
          dataInicial, dataFinal,
          usaProdutoLmc: false,
          ultimoCodigo: p.ultimoCodigo, limite: p.limite,
        }),
        1000, 150,
      ),
    enabled: hasEmpresa && !!dataInicial && !!dataFinal,
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  // Vendas autorizadas do período (exclui canceladas / itens órfãos).
  const { autorizados, isLoading: lAut } = useVendaCodigosAutorizados(
    empresaCodigos, dataInicial ?? '', dataFinal ?? '', hasEmpresa,
  )

  // Catálogo (rede-wide, compartilhado por query key com os outros hooks).
  const { data: produtosData, isLoading: lProd } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages((p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    enabled: hasEmpresa,
    staleTime: 30 * 60 * 1000,
  })
  const { data: gruposData, isLoading: lGrp } = useQuery({
    queryKey: ['grupos'],
    queryFn: () => fetchAllPages((p) => fetchGrupos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    enabled: hasEmpresa,
    staleTime: 30 * 60 * 1000,
  })

  const { byFunc, evolucaoByFunc, combByFunc } = useMemo(() => {
    const byFunc = new Map<number, GrupoVenda[]>()
    const evolucaoByFunc = new Map<number, EvolucaoFunc>()
    const combByFunc = new Map<number, CombustivelBreak[]>()
    if (!produtosData || !gruposData) return { byFunc, evolucaoByFunc, combByFunc }

    // produtoCodigo → { setor, grupo (nome), nome do produto }.
    const grupoTipo = new Map(gruposData.map((g) => [g.grupoCodigo, g.tipoGrupo]))
    const grupoNome = new Map(gruposData.map((g) => [g.grupoCodigo, g.nome]))
    const info = new Map<number, { setor: string; grupo: string; nome: string; aditivada: boolean }>()
    for (const p of produtosData) {
      const setor = classifySetor(p.tipoProduto, grupoTipo.get(p.grupoCodigo))
      info.set(p.produtoCodigo, {
        setor,
        grupo: grupoNome.get(p.grupoCodigo) ?? 'Sem grupo',
        nome: p.nome ?? `Produto ${p.produtoCodigo}`,
        // Aditivada = combustível cujo nome contém "ADITIVADA" (mesmo critério do
        // frentistaScore, pra a série bater com o KPI "Litros aditivada").
        aditivada: setor === 'combustivel' && (p.nome ?? '').toUpperCase().includes('ADITIVADA'),
      })
    }

    const acc = new Map<number, Map<string, GrupoVenda>>() // grupos (automotivos)
    const combAcc = new Map<number, Map<number, CombustivelBreak>>() // combustível por produto (detalhe)
    // dia → { litros qty/R$ de combustível, aditivada qty/R$, itens/R$ de automotivos }
    const evo = new Map<number, Map<string, { lq: number; lf: number; adq: number; adf: number; ai: number; af: number }>>()
    for (const it of itens) {
      if (!autorizados.has(it.vendaCodigo)) continue
      if (!it.funcionarioCodigo) continue
      const pi = info.get(it.produtoCodigo)
      if (!pi) continue

      // Evolução diária: litros de combustível (+aditivada) e itens/faturamento de automotivos.
      const dia = (it.dataMovimento ?? '').slice(0, 10)
      if (dia && (pi.setor === 'combustivel' || pi.setor === 'automotivos')) {
        let em = evo.get(it.funcionarioCodigo)
        if (!em) { em = new Map(); evo.set(it.funcionarioCodigo, em) }
        const d = em.get(dia) ?? { lq: 0, lf: 0, adq: 0, adf: 0, ai: 0, af: 0 }
        if (pi.setor === 'combustivel') {
          d.lq += it.quantidade ?? 0; d.lf += it.totalVenda ?? 0
          if (pi.aditivada) { d.adq += it.quantidade ?? 0; d.adf += it.totalVenda ?? 0 }
        } else { d.ai += it.quantidade ?? 0; d.af += it.totalVenda ?? 0 }
        em.set(dia, d)
      }

      // Quebra por combustível (pro detalhe): litros/abast/faturamento por produto.
      if (pi.setor === 'combustivel') {
        let cm = combAcc.get(it.funcionarioCodigo)
        if (!cm) { cm = new Map(); combAcc.set(it.funcionarioCodigo, cm) }
        const c = cm.get(it.produtoCodigo) ?? { produtoCodigo: it.produtoCodigo, nome: pi.nome, litros: 0, abastecimentos: 0, faturamento: 0 }
        c.litros += it.quantidade ?? 0
        c.abastecimentos += 1
        c.faturamento += it.totalVenda ?? 0
        cm.set(it.produtoCodigo, c)
      }

      // Grupos: só automotivos.
      if (pi.setor !== 'automotivos') continue
      let m = acc.get(it.funcionarioCodigo)
      if (!m) { m = new Map(); acc.set(it.funcionarioCodigo, m) }
      const g = m.get(pi.grupo) ?? { grupo: pi.grupo, faturamento: 0, itens: 0 }
      g.faturamento += it.totalVenda ?? 0
      g.itens += it.quantidade ?? 0
      m.set(pi.grupo, g)
    }

    for (const [cod, m] of acc) {
      byFunc.set(cod, [...m.values()].sort((a, b) => b.faturamento - a.faturamento))
    }

    // Séries diárias — só dias COM movimento (turnos), ordenadas por data.
    for (const [cod, em] of evo) {
      const dias = [...em.keys()].sort()
      const litros: DiaEvol[] = []
      const aditivada: DiaEvol[] = []
      const automotivos: DiaEvol[] = []
      for (const dia of dias) {
        const v = em.get(dia)!
        if (v.lq > 0) litros.push({ data: dia, litros: v.lq, faturamento: v.lf })
        if (v.adq > 0) aditivada.push({ data: dia, litros: v.adq, faturamento: v.adf })
        if (v.af > 0) automotivos.push({ data: dia, litros: v.ai, faturamento: v.af })
      }
      evolucaoByFunc.set(cod, { litros, aditivada, automotivos })
    }

    // Quebra por combustível por funcionário (maior litragem primeiro).
    for (const [cod, cm] of combAcc) {
      combByFunc.set(cod, [...cm.values()].sort((a, b) => b.litros - a.litros))
    }

    return { byFunc, evolucaoByFunc, combByFunc }
  }, [itens, autorizados, produtosData, gruposData])

  return { byFunc, evolucaoByFunc, combByFunc, isLoading: hasEmpresa && (lItens || lAut || lProd || lGrp) }
}

export default useGruposFuncionario
