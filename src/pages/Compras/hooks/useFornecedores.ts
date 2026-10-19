import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchTitulosPagar } from '@/api/endpoints/financeiro'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import type { TituloPagar } from '@/api/types/financeiro'
import type { FornecedorRow } from '@/api/supabase/compras'
import { todayLocal } from '@/lib/period'

/** Um fornecedor que pode ser escolhido num pedido: do cadastro do Visor ou visto no ERP. */
export interface FornecedorOpcao {
  chave: string
  id: string | null
  codigo_erp: number | null
  nome: string
  cnpj: string | null
  origem: 'cadastro' | 'erp'
  /** Quantos títulos a pagar nos últimos 12 meses (só ERP). */
  titulos: number
  ultimaCompra: string | null
}

const umAnoAtras = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10) }

/**
 * O ERP não tem endpoint de fornecedor: a lista nasce dos títulos a pagar dos
 * últimos 12 meses (quem já emitiu nota pra rede), somada ao cadastro próprio
 * do módulo. Busca por nome, código ou CNPJ.
 */
export const useFornecedores = (redeId: string | null, cadastro: FornecedorRow[]) => {
  const erp = useQuery({
    queryKey: ['compras-fornecedores-erp', redeId],
    enabled: !!redeId,
    staleTime: 30 * 60_000,
    queryFn: () => fetchAllPages((p) => fetchTitulosPagar({ dataInicial: umAnoAtras(), dataFinal: todayLocal(), apenasPendente: false, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 30),
  })
  const opcoes = useMemo<FornecedorOpcao[]>(() => {
    const m = new Map<string, FornecedorOpcao>()
    for (const f of cadastro) {
      const chave = f.codigo_erp ? `erp:${f.codigo_erp}` : `id:${f.id}`
      m.set(chave, { chave, id: f.id, codigo_erp: f.codigo_erp, nome: f.nome, cnpj: f.cnpj, origem: 'cadastro', titulos: 0, ultimaCompra: null })
    }
    for (const t of (erp.data ?? []) as TituloPagar[]) {
      if (!t.fornecedorCodigo) continue
      const chave = `erp:${t.fornecedorCodigo}`
      const cur = m.get(chave)
      const dia = (t.dataMovimento || t.vencimento || '').slice(0, 10)
      if (cur) {
        cur.titulos += 1
        if (dia && (!cur.ultimaCompra || dia > cur.ultimaCompra)) cur.ultimaCompra = dia
        if (!cur.cnpj && t.cpfCnpjFornecedor) cur.cnpj = t.cpfCnpjFornecedor
      } else {
        m.set(chave, { chave, id: null, codigo_erp: t.fornecedorCodigo, nome: (t.nomeFornecedor || `Fornecedor ${t.fornecedorCodigo}`).trim(), cnpj: t.cpfCnpjFornecedor || null, origem: 'erp', titulos: 1, ultimaCompra: dia || null })
      }
    }
    return [...m.values()].sort((a, b) => b.titulos - a.titulos || a.nome.localeCompare(b.nome))
  }, [cadastro, erp.data])

  const buscar = (termo: string, limite = 12) => {
    const t = termo.trim().toLowerCase()
    const dig = t.replace(/\D/g, '')
    if (!t) return opcoes.slice(0, limite)
    return opcoes.filter((o) => o.nome.toLowerCase().includes(t) || (dig && ((o.cnpj ?? '').replace(/\D/g, '').includes(dig) || String(o.codigo_erp ?? '').includes(dig)))).slice(0, limite)
  }
  return { opcoes, buscar, carregandoErp: erp.isLoading }
}
