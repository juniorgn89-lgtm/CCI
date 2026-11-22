/** Lógica dos filtros de coluna estilo Excel (a parte visual fica em
 *  src/components/FiltroColuna.tsx — separado por causa do Fast Refresh). */
import { useCallback, useMemo, useState } from 'react'

export const VAZIO = '(vazio)'
const texto = (v: unknown) => {
  const t = v == null ? '' : String(v).trim()
  return t || VAZIO
}
const ordenar = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' })

export type DefColuna<T> = ((linha: T) => unknown) | { valor: (linha: T) => unknown; ordem?: (linha: T) => unknown }

const valorDe = <T,>(def: DefColuna<T>, linha: T) => texto(typeof def === 'function' ? def(linha) : def.valor(linha))
const ordemDe = <T,>(def: DefColuna<T>, linha: T) =>
  typeof def === 'function' || !def.ordem ? null : String(def.ordem(linha) ?? '')

export interface FiltroDeColuna {
  ativo: boolean
  marcados: Set<string> | null
  valores: () => { valor: string; qtd: number; ordem: string }[]
  aplicar: (novo: Set<string> | null) => void
}

export const useFiltrosColuna = <T, K extends string>(linhas: T[] | undefined, colunas: Record<K, DefColuna<T>>) => {
  // { [chave]: valores marcados } — chave ausente = sem filtro na coluna.
  const [filtros, setFiltros] = useState<Partial<Record<K, Set<string>>>>({})
  const lista = useMemo(() => linhas ?? [], [linhas])

  const passa = useCallback(
    (linha: T, ignorar?: K) =>
      (Object.entries(filtros) as [K, Set<string>][]).every(
        ([chave, marcados]) => chave === ignorar || !colunas[chave] || marcados.has(valorDe(colunas[chave], linha)),
      ),
    [filtros, colunas],
  )

  const filtradas = useMemo(() => lista.filter((l) => passa(l)), [lista, passa])

  const de = (chave: K): FiltroDeColuna => {
    const marcados = filtros[chave] ?? null
    return {
      ativo: !!marcados,
      marcados,
      // Valores disponíveis respeitando os filtros das outras colunas.
      valores: () => {
        const qtd = new Map<string, number>()
        const ordem = new Map<string, string>()
        for (const l of lista) {
          if (!passa(l, chave)) continue
          const v = valorDe(colunas[chave], l)
          qtd.set(v, (qtd.get(v) ?? 0) + 1)
          if (!ordem.has(v)) ordem.set(v, ordemDe(colunas[chave], l) ?? v)
        }
        // Um valor marcado que sumiu (pelos outros filtros) continua na lista, com 0.
        for (const v of marcados ?? []) if (!qtd.has(v)) qtd.set(v, 0)
        return [...qtd.entries()]
          .map(([valor, n]) => ({ valor, qtd: n, ordem: ordem.get(valor) ?? valor }))
          .sort((a, b) => Number(a.valor === VAZIO) - Number(b.valor === VAZIO) || ordenar(a.ordem, b.ordem))
      },
      aplicar: (novo) =>
        setFiltros((f) => {
          const r = { ...f }
          if (novo) r[chave] = novo
          else delete r[chave]
          return r
        }),
    }
  }

  return { filtradas, de, qtdAtivos: Object.keys(filtros).length, limpar: () => setFiltros({}) }
}
