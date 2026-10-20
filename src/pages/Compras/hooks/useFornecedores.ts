import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCompras, fetchFornecedoresErp } from '@/api/endpoints/compras'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import type { Compra, FornecedorErp } from '@/api/types/compra'
import type { FornecedorRow } from '@/api/supabase/compras'
import { todayLocal } from '@/lib/period'

/** Um fornecedor que pode ser escolhido num pedido: do cadastro do ERP ou do módulo. */
export interface FornecedorOpcao {
  chave: string
  id: string | null
  codigo_erp: number | null
  nome: string
  /** Razão social quando o nome mostrado é o fantasia (entra na busca). */
  razao: string | null
  cnpj: string | null
  cidade: string | null
  origem: 'cadastro' | 'erp'
  /** Notas de compra nos últimos 12 meses (rede inteira). */
  notas: number
  ultimaCompra: string | null
  /** Postos que receberam nota dele nos últimos 12 meses. */
  empresas: Set<number>
}

/** Faixas da lista: quem vendeu pro posto, quem vendeu pra rede, o resto do cadastro. */
export type FaixaFornecedor = 'posto' | 'rede' | 'cadastro'

const umAnoAtras = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10) }
const doc = (v: string | null | undefined) => { const d = (v ?? '').replace(/\D/g, ''); return d || null }
const limpo = (v: string | null | undefined) => (v ?? '').trim()
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Fornecedores do pedido: o CADASTRO do ERP inteiro (/FORNECEDOR) mais o
 * cadastro próprio do módulo, ranqueados pelas NOTAS DE COMPRA dos últimos 12
 * meses (/COMPRA — a mesma leitura do "último fornecedor", cache por rede).
 * Sem busca, a lista mostra só quem emitiu nota (energia, serviços e o próprio
 * posto ficam de fora); buscando, aparece qualquer um do cadastro.
 */
export const useFornecedores = (redeId: string | null, cadastro: FornecedorRow[]) => {
  const reg = useQuery({
    queryKey: ['compras-fornecedores-cadastro', redeId],
    enabled: !!redeId,
    staleTime: 60 * 60_000,
    queryFn: () => fetchAllPages<FornecedorErp>((p) => fetchFornecedoresErp({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 2000, 10),
  })
  const notas = useQuery({
    queryKey: ['compras-erp-cabecalhos', redeId],
    enabled: !!redeId,
    staleTime: 30 * 60_000,
    queryFn: () => fetchAllPages<Compra>((p) => fetchCompras({ dataInicial: umAnoAtras(), dataFinal: todayLocal(), ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 30),
  })

  const opcoes = useMemo<FornecedorOpcao[]>(() => {
    const m = new Map<string, FornecedorOpcao>()
    for (const f of reg.data ?? []) {
      const chave = `erp:${f.fornecedorCodigo}`
      const fantasia = limpo(f.fantasia), razao = limpo(f.razao)
      m.set(chave, {
        chave, id: null, codigo_erp: f.fornecedorCodigo,
        nome: fantasia || razao || `Fornecedor cód ${f.fornecedorCodigo}`,
        razao: razao && razao !== fantasia ? razao : null,
        cnpj: doc(f.cnpjCpf), cidade: [limpo(f.cidade), limpo(f.uf)].filter(Boolean).join('/') || null,
        origem: 'erp', notas: 0, ultimaCompra: null, empresas: new Set(),
      })
    }
    // Cadastro do módulo: liga o id do Visor e acrescenta fornecedor novo (sem código no ERP).
    for (const f of cadastro) {
      const chave = f.codigo_erp ? `erp:${f.codigo_erp}` : `id:${f.id}`
      const cur = m.get(chave)
      if (cur) { cur.id = f.id; continue }
      m.set(chave, { chave, id: f.id, codigo_erp: f.codigo_erp, nome: f.nome, razao: null, cnpj: doc(f.cnpj), cidade: null, origem: 'cadastro', notas: 0, ultimaCompra: null, empresas: new Set() })
    }
    for (const c of notas.data ?? []) {
      if (!c.fornecedorCodigo) continue
      const chave = `erp:${c.fornecedorCodigo}`
      let cur = m.get(chave)
      if (!cur) {
        // Nota de fornecedor que não veio no cadastro: entra pelo código, sem inventar nome.
        cur = { chave, id: null, codigo_erp: c.fornecedorCodigo, nome: `Fornecedor cód ${c.fornecedorCodigo}`, razao: null, cnpj: doc(c.cnpjCpfFornecedor), cidade: null, origem: 'erp', notas: 0, ultimaCompra: null, empresas: new Set() }
        m.set(chave, cur)
      }
      cur.notas += 1
      cur.empresas.add(c.empresaCodigo)
      const dia = (c.dataEntrada || c.dataMovimento || '').slice(0, 10)
      if (dia && (!cur.ultimaCompra || dia > cur.ultimaCompra)) cur.ultimaCompra = dia
    }
    return [...m.values()]
  }, [reg.data, cadastro, notas.data])

  const faixaDe = (o: FornecedorOpcao, empresa: number | null): FaixaFornecedor =>
    empresa != null && o.empresas.has(empresa) ? 'posto' : o.notas > 0 ? 'rede' : 'cadastro'

  /**
   * Lista inteira, em faixas (posto → rede → resto do cadastro) e, dentro de
   * cada uma, pela compra mais recente. Sem termo: só quem tem nota no ano.
   */
  const buscar = (termo: string, empresa: number | null): { o: FornecedorOpcao; faixa: FaixaFornecedor }[] => {
    const t = norm(termo.trim())
    const dig = termo.replace(/\D/g, '')
    const ordemFaixa: Record<FaixaFornecedor, number> = { posto: 0, rede: 1, cadastro: 2 }
    return opcoes
      .filter((o) => {
        if (!t) return o.notas > 0 || o.origem === 'cadastro'
        return norm(o.nome).includes(t) || norm(o.razao ?? '').includes(t) ||
          (dig.length >= 2 && ((o.cnpj ?? '').includes(dig) || String(o.codigo_erp ?? '').includes(dig)))
      })
      .map((o) => ({ o, faixa: faixaDe(o, empresa) }))
      .sort((a, b) => ordemFaixa[a.faixa] - ordemFaixa[b.faixa] || (b.o.ultimaCompra ?? '').localeCompare(a.o.ultimaCompra ?? '') || a.o.nome.localeCompare(b.o.nome))
  }

  return {
    opcoes,
    buscar,
    carregandoErp: reg.isLoading || notas.isLoading,
    /** O cadastro do ERP não veio: a lista fica só com quem tem nota (pelo código) e o cadastro do módulo. */
    erroCadastro: reg.isError,
  }
}
