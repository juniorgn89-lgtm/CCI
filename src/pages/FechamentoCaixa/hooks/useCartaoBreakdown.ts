import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchVendas } from '@/api/endpoints/vendas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { client } from '@/api/client'
import type { PaginatedResponse } from '@/api/types/common'
import type { Venda } from '@/api/types/venda'

export interface CartaoLinha {
  key: string
  bandeira: string
  tipo: string        // 'Débito' | 'Crédito' | '—'
  gestora: string
  valor: number
  quantidade: number
  /** Valor por PDV (Pista / Conveniência / PDV n). */
  porPdv: Record<string, number>
}

const normTipo = (t: string): string => {
  const u = (t || '').toUpperCase()
  if (u.startsWith('D')) return 'Débito'
  if (u.startsWith('C')) return 'Crédito'
  return t || '—'
}

/** Busca vendas por código em lotes (a /VENDA só popula formaPagamento[] quando
 *  consultada por vendaCodigo, não na listagem por período). */
const CHUNK = 50            // lote por requisição (URL curta o bastante)
const MAX_CODES = 2000      // teto de segurança
const fetchVendasPorCodigo = async (empresaCodigo: number, codes: number[]): Promise<Venda[]> => {
  const out: Venda[] = []
  const limited = codes.slice(0, MAX_CODES)
  for (let i = 0; i < limited.length; i += CHUNK) {
    const chunk = limited.slice(i, i + CHUNK)
    // indexes:null → serializa `vendaCodigo=1&vendaCodigo=2` (sem `[]`), que é o
    // que a Quality entende — com `[]` ela lia só 1 código e devolvia 1 venda.
    const res = await client
      .get<PaginatedResponse<Venda>>('/VENDA', {
        params: { empresaCodigo, vendaCodigo: chunk, situacao: 'A', limite: 1000 },
        paramsSerializer: { indexes: null },
      })
      .then((r) => r.data)
    out.push(...(res.resultados ?? []))
  }
  return out
}

/**
 * Quebra do cartão por bandeira + débito/crédito + administradora — só existe no
 * /VENDA aninhado. Busca SOB DEMANDA (enabled) e em 2 passos: (1) lista as vendas
 * do período pra achar os vendaCodigo dos caixas selecionados; (2) busca esses
 * por código pra trazer formaPagamento[] populado.
 */
const useCartaoBreakdown = (caixaCodigos: number[], pdvByCaixa: Map<number, string>, enabled: boolean) => {
  const dataInicial = useFilterStore((s) => s.dataInicial)
  const dataFinal = useFilterStore((s) => s.dataFinal)
  const empresaCodigo = useFilterStore((s) => s.empresaCodigos)[0]
  const caixaKey = caixaCodigos.join(',')

  // Passo 1 — lista do período (resumo, sem formaPagamento).
  const { data: lista } = useQuery({
    queryKey: ['vendasCartaoLista', empresaCodigo, dataInicial, dataFinal],
    queryFn: () =>
      fetchAllPages(
        (p) => fetchVendas({ empresaCodigo, dataInicial, dataFinal, situacao: 'A', ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
        1000,
        60,
      ),
    enabled: enabled && empresaCodigo != null,
    staleTime: 5 * 60 * 1000,
  })

  // vendaCodigo das vendas que pertencem aos caixas selecionados.
  const codigos = useMemo(() => {
    const sel = new Set(caixaCodigos)
    return (lista ?? []).filter((v) => sel.has(v.caixaCodigo)).map((v) => v.vendaCodigo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista, caixaKey])
  const codigosKey = codigos.join(',')

  // Passo 2 — detalhe por código (traz formaPagamento[] populado).
  const { data: detalhe, isLoading } = useQuery({
    queryKey: ['vendasCartaoDetalhe', empresaCodigo, codigosKey],
    queryFn: () => fetchVendasPorCodigo(empresaCodigo!, codigos),
    enabled: enabled && empresaCodigo != null && codigos.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  const linhas = useMemo<CartaoLinha[]>(() => {
    const map = new Map<string, CartaoLinha>()
    for (const v of detalhe ?? []) {
      const pdv = pdvByCaixa.get(v.caixaCodigo) ?? '—'
      for (const fp of v.formaPagamento ?? []) {
        const isCard =
          !!fp.tipoTransacao || !!fp.bandeira || (fp.tipoFormaPagamento || '').toUpperCase().includes('CARTAO')
        if (!isCard) continue
        const bandeira = fp.bandeira || 'Cartão'
        const tipo = normTipo(fp.tipoTransacao)
        const key = `${bandeira}|${tipo}`
        const prev = map.get(key) ?? { key, bandeira, tipo, gestora: fp.gestora || '', valor: 0, quantidade: 0, porPdv: {} }
        prev.valor += fp.valorPagamento
        prev.quantidade += 1
        prev.porPdv[pdv] = (prev.porPdv[pdv] ?? 0) + fp.valorPagamento
        map.set(key, prev)
      }
    }
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detalhe, caixaKey])

  const total = useMemo(() => linhas.reduce((s, l) => s + l.valor, 0), [linhas])

  // PDVs presentes (ordem: Pista, Conveniência, resto).
  const pdvs = useMemo(() => {
    const s = new Set<string>()
    for (const l of linhas) for (const k of Object.keys(l.porPdv)) s.add(k)
    const ordem = (p: string) => (p === 'Pista' ? 0 : p === 'Conveniência' ? 1 : 2)
    return Array.from(s).sort((a, b) => ordem(a) - ordem(b) || a.localeCompare(b))
  }, [linhas])

  // Carregando enquanto a lista ainda não definiu os códigos, ou o detalhe roda.
  const loading = enabled && (lista == null || (codigos.length > 0 && isLoading))

  return { linhas, total, pdvs, isLoading: loading }
}

export default useCartaoBreakdown
