import { useMemo } from 'react'
import useRedeProdutividadeCache from '@/pages/Produtividade/hooks/useRedeProdutividadeCache'

/**
 * Produtividade de FRENTISTA por posto — LÊ DO CACHE apurado
 * (`apuracao_vendas_funcionario`, via `useRedeProdutividadeCache` para 1 posto):
 * automotivos de LOJA (setor=automotivos) + aditivada/gasolina/abastecimentos de
 * COMBUSTÍVEL (setor=combustivel, colunas apuradas). NÃO usa mais o /ABASTECIMENTO
 * ao vivo (que anda 500 em jun/jul e zerava o combustível). Só dias apurados.
 *
 * A quebra por combustível do DETALHE (produto a produto) não vem do cache — o
 * detalhe monta ela do /VENDA_ITEM (ver useGruposFuncionario). Aqui `combustiveis`
 * fica vazio (o Resumo/Visão Geral não usam).
 */

/** Quebra por combustível dentro de um funcionário — pro detalhe. */
export interface CombustivelBreak {
  produtoCodigo: number
  nome: string
  litros: number
  abastecimentos: number
  faturamento: number
}

export interface FuncProdRow {
  funcionarioCodigo: number
  nome: string
  ativo: boolean
  /** Cargo (`/FUNCOES.nome`, ex.: "FRENTISTA", "CAIXA."); "Sem cargo" se ausente. */
  funcao: string
  /** Faturamento de automotivos de LOJA (R$). */
  automotivo: number
  automotivoTend: number
  cupons: number
  /** Ticket médio de automotivos (faturamento ÷ cupons). */
  ticket: number
  itens: number
  /** Litros de aditivada (combustível). */
  aditivadaLitros: number
  aditivadaTend: number
  gasolinaLitros: number
  /** Mix = aditivada ÷ gasolina × 100. */
  mixPct: number
  /** Abastecimentos = atendimentos (contagem). */
  abastecimentos: number
  abastTend: number
  litros: number
  faturamentoCombustivel: number
  combustiveis: CombustivelBreak[]
}

export interface Podio {
  funcionarioCodigo: number
  nome: string
  valor: number
}

export interface FrentistaProdKpis {
  automotivo: number
  aditivadaLitros: number
  mixPct: number
  abastecimentos: number
  ticketMedio: number
}

export interface FrentistaProdData {
  rows: FuncProdRow[]
  kpis: FrentistaProdKpis
  podios: { automotivo: Podio[]; aditivada: Podio[]; atendimentos: Podio[] }
  /** Fator de projeção de fim de mês (1 = sem projeção; cache apurado sempre 1). */
  projFactor: number
  isLoading: boolean
  hasEmpresa: boolean
}

const EMPTY_KPIS: FrentistaProdKpis = { automotivo: 0, aditivadaLitros: 0, mixPct: 0, abastecimentos: 0, ticketMedio: 0 }
const EMPTY_PODIOS = { automotivo: [], aditivada: [], atendimentos: [] }

const useFrentistaProdutividade = (postoCodigo?: number | null, _opts?: { lean?: boolean }): FrentistaProdData => {
  const { byPosto, isLoading } = useRedeProdutividadeCache(postoCodigo != null ? [postoCodigo] : [])
  return useMemo(() => {
    if (postoCodigo == null) {
      return { rows: [], kpis: EMPTY_KPIS, podios: EMPTY_PODIOS, projFactor: 1, isLoading: false, hasEmpresa: false }
    }
    return byPosto.get(postoCodigo) ?? { rows: [], kpis: EMPTY_KPIS, podios: EMPTY_PODIOS, projFactor: 1, isLoading, hasEmpresa: true }
  }, [byPosto, postoCodigo, isLoading])
}

export default useFrentistaProdutividade
