import { useQuery } from '@tanstack/react-query'
import { fetchTabelaPrecoPrazo } from '@/api/endpoints/precos'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import type { TabelaPrecoPrazo } from '@/api/types/precos'

/** Linha da tabela de prazo, já normalizada pra tela. */
export interface ItemPrazoVM {
  id: string
  empresaCodigo: number | null
  produtoCodigo: number | null
  grupoCodigo: number | null
  clienteCodigo: number | null
  grupoClienteCodigo: number | null
  /** 'especifico' = valor em R$; 'desconto' = percentual. */
  tipo: 'especifico' | 'desconto'
  valor: number
}

/** Cabeçalho normalizado (uma "Ref"). */
export interface TabelaPrazoVM {
  id: string
  ref: string
  descricao: string
  validadeInicial: string | null
  validadeFinal: string | null
  /** Dias de vigência (1 = domingo … 7 = sábado). Null/7 dígitos = todos. */
  diasSemana: number[] | null
  horaDia: boolean
  /** Códigos de prazo desta tabela — casam com o `formaPagamentoCodigo` da venda. */
  prazoCodigos: number[]
  itens: ItemPrazoVM[]
}

const dia = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : null)
const parseDias = (s: string | null | undefined): number[] | null => {
  if (!s) return null
  const ds = s.split('').map(Number).filter((n) => n >= 1 && n <= 7)
  return ds.length === 0 || ds.length === 7 ? null : ds
}

const toVM = (t: TabelaPrecoPrazo): TabelaPrazoVM => ({
  id: String(t.tabelaPrecoPrazoCodigo),
  ref: t.referencia,
  descricao: t.descricao,
  validadeInicial: dia(t.validadeInicial),
  validadeFinal: dia(t.validadeFinal),
  diasSemana: parseDias(t.diasSemana),
  horaDia: t.horaDia,
  prazoCodigos: t.prazoCodigo ?? [],
  itens: (t.precoEspecialItem ?? []).map((i) => ({
    id: String(i.precoPrazoItemCodigo),
    empresaCodigo: i.empresaCodigo,
    produtoCodigo: i.produtoCodigo,
    grupoCodigo: i.grupoCodigo,
    clienteCodigo: i.clienteCodigo,
    grupoClienteCodigo: i.grupoClienteCodigo,
    tipo: i.tipo === 0 ? 'especifico' : 'desconto',
    valor: i.valor,
  })),
})

/**
 * Tabelas de Preço de Prazos (BARATAO, TABACARIA, …) live da API Quality.
 * São poucas tabelas (uma leitura paginada basta). Substitui a ingestão XLSX.
 */
export const useTabelasPrazo = () =>
  useQuery({
    queryKey: ['tabela-preco-prazo'],
    queryFn: async () => {
      const rows = await fetchAllPages(
        (p) => fetchTabelaPrecoPrazo({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
        200,
        20,
      )
      return rows.map(toVM)
    },
    staleTime: 10 * 60 * 1000,
  })
