import { useMemo, useCallback, useState } from 'react'
import { ChevronDown, ChevronRight, Minimize2, Maximize2 } from 'lucide-react'
import ExportButton from '@/components/tables/ExportButton'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'
import exportToCsv, { type ExportColumn } from '@/lib/exportCsv'
import type { DRE } from '@/api/types/financeiro'

interface DreTableProps {
  data: DRE | undefined
}

interface DreRow {
  id: string
  label: string
  value: number
  level: number
  isSummary: boolean
  parentId?: string
  hasChildren: boolean
  [key: string]: unknown
}

const csvExportColumns: ExportColumn<DreRow>[] = [
  { header: 'Descrição', accessor: (r) => r.label },
  { header: 'Valor', accessor: (r) => r.value },
  { header: 'Nível', accessor: (r) => r.level },
]

const DreTable = ({ data }: DreTableProps) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const rows = useMemo((): DreRow[] => {
    if (!data) return []

    const result: DreRow[] = []
    let idx = 0
    const id = () => `d${idx++}`

    // Receita Bruta
    const rbId = id()
    result.push({ id: rbId, label: 'Receita Bruta', value: data.receitaBruta, level: 0, isSummary: true, hasChildren: true })

    const totalVendas = data.vendasGrupo.reduce((s, g) => s + g.valorVenda, 0)
    const totalCmv = data.vendasGrupo.reduce((s, g) => s + g.cmv, 0)
    const totalDesc = data.vendasGrupo.reduce((s, g) => s + g.desconto, 0)
    const totalAcresc = data.vendasGrupo.reduce((s, g) => s + g.acrescimo, 0)

    const vgId = id()
    result.push({ id: vgId, label: 'Vendas por Grupo', value: totalVendas, level: 1, isSummary: false, parentId: rbId, hasChildren: true })
    for (const g of data.vendasGrupo) {
      result.push({ id: id(), label: g.produtoGrupo, value: g.valorVenda, level: 2, isSummary: false, parentId: vgId, hasChildren: false })
    }

    if (totalDesc !== 0) {
      result.push({ id: id(), label: '(-) Descontos', value: -totalDesc, level: 1, isSummary: false, parentId: rbId, hasChildren: false })
    }
    if (totalAcresc !== 0) {
      result.push({ id: id(), label: '(+) Acréscimos', value: totalAcresc, level: 1, isSummary: false, parentId: rbId, hasChildren: false })
    }

    // Deduções
    result.push({ id: id(), label: '(-) Deduções Fiscais', value: -data.deducaoFiscal, level: 0, isSummary: false, hasChildren: false })

    // Receita Líquida
    const receitaLiquida = data.receitaBruta - data.deducaoFiscal
    result.push({ id: id(), label: 'Receita Líquida', value: receitaLiquida, level: 0, isSummary: true, hasChildren: false })

    // CMV
    const cmvId = id()
    result.push({ id: cmvId, label: '(-) Custo das Mercadorias Vendidas (CMV)', value: -totalCmv, level: 0, isSummary: false, hasChildren: true })
    for (const g of data.vendasGrupo) {
      if (g.cmv > 0) {
        result.push({ id: id(), label: g.produtoGrupo, value: -g.cmv, level: 1, isSummary: false, parentId: cmvId, hasChildren: false })
      }
    }

    // Lucro Bruto
    const lucroBruto = receitaLiquida - totalCmv
    const margemBruta = data.receitaBruta > 0 ? (lucroBruto / data.receitaBruta) * 100 : 0
    result.push({ id: id(), label: `Lucro Bruto (${margemBruta.toFixed(1)}%)`, value: lucroBruto, level: 0, isSummary: true, hasChildren: false })

    // Outras Receitas
    const groupedReceitas = new Map<string, { items: { label: string; value: number; id: string }[]; total: number }>()
    for (const r of data.apuracaoReceita) {
      const pai = r.planoContaGerencialPAI || 'Outras Receitas'
      const prev = groupedReceitas.get(pai) ?? { items: [], total: 0 }
      prev.items.push({ label: r.planoContaGerencialFILHO || r.descricaoDocumento, value: r.valor, id: id() })
      prev.total += r.valor
      groupedReceitas.set(pai, prev)
    }

    let totalReceitas = 0
    if (groupedReceitas.size > 0) {
      const recId = id()
      result.push({ id: recId, label: '(+) Outras Receitas', value: 0, level: 0, isSummary: false, hasChildren: true })
      for (const [pai, group] of groupedReceitas) {
        const gId = id()
        result.push({ id: gId, label: pai, value: group.total, level: 1, isSummary: false, parentId: recId, hasChildren: true })
        for (const item of group.items) {
          result.push({ id: item.id, label: item.label, value: item.value, level: 2, isSummary: false, parentId: gId, hasChildren: false })
        }
        totalReceitas += group.total
      }
      const recIdx = result.findIndex((r) => r.id === recId)
      if (recIdx >= 0) result[recIdx].value = totalReceitas
    }

    // Despesas Operacionais
    const groupedDespesas = new Map<string, { items: { label: string; value: number; id: string }[]; total: number }>()
    for (const p of data.apuracaoPagamentos) {
      const pai = p.planoContaGerencialPAI || 'Outras Despesas'
      const prev = groupedDespesas.get(pai) ?? { items: [], total: 0 }
      prev.items.push({ label: p.planoContaGerencialFILHO || p.descricaoDocumento, value: p.valor, id: id() })
      prev.total += p.valor
      groupedDespesas.set(pai, prev)
    }

    let totalDespesas = 0
    if (groupedDespesas.size > 0) {
      const despId = id()
      result.push({ id: despId, label: '(-) Despesas Operacionais', value: 0, level: 0, isSummary: false, hasChildren: true })
      for (const [pai, group] of groupedDespesas) {
        const gId = id()
        result.push({ id: gId, label: pai, value: group.total, level: 1, isSummary: false, parentId: despId, hasChildren: true })
        for (const item of group.items) {
          result.push({ id: item.id, label: item.label, value: item.value, level: 2, isSummary: false, parentId: gId, hasChildren: false })
        }
        totalDespesas += group.total
      }
      const despIdx = result.findIndex((r) => r.id === despId)
      if (despIdx >= 0) result[despIdx].value = -totalDespesas
    }

    // Resultado Operacional
    const resultadoOperacional = lucroBruto + totalReceitas - totalDespesas
    const margemOp = data.receitaBruta > 0 ? (resultadoOperacional / data.receitaBruta) * 100 : 0
    result.push({ id: id(), label: `Resultado Operacional (${margemOp.toFixed(1)}%)`, value: resultadoOperacional, level: 0, isSummary: true, hasChildren: false })

    return result
  }, [data])

  const visibleRows = useMemo(() => {
    return rows.filter((row) => {
      if (!row.parentId) return true
      let current = row
      while (current.parentId) {
        if (!expanded.has(current.parentId)) return false
        const parent = rows.find((r) => r.id === current.parentId)
        if (!parent) break
        current = parent
      }
      return true
    })
  }, [rows, expanded])

  const expandAll = () => {
    setExpanded(new Set(rows.filter((r) => r.hasChildren).map((r) => r.id)))
  }

  const collapseAll = () => setExpanded(new Set())

  const handleExport = useCallback(() => {
    exportToCsv('financeiro-dre', rows, csvExportColumns)
  }, [rows])

  if (!data) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-16 dark:border-gray-700 dark:bg-gray-900">
        <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum dado de DRE disponível para o período selecionado.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Demonstrativo de Resultado do Exercício</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => expanded.size > 0 ? collapseAll() : expandAll()}
            className="flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            {expanded.size > 0 ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            {expanded.size > 0 ? 'Minimizar tudo' : 'Expandir tudo'}
          </button>
          <ExportButton onExport={handleExport} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Conta</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {visibleRows.map((row) => {
              const isExpandable = row.hasChildren
              const isExpanded = expanded.has(row.id)

              return (
                <tr
                  key={row.id}
                  onClick={() => isExpandable && toggleExpand(row.id)}
                  className={cn(
                    'transition-colors',
                    row.isSummary && 'bg-gray-50 dark:bg-gray-800/40',
                    isExpandable && 'cursor-pointer hover:bg-blue-50/50 dark:hover:bg-gray-800/50',
                    !isExpandable && !row.isSummary && 'hover:bg-gray-50/50 dark:hover:bg-gray-800/30',
                  )}
                >
                  <td
                    className={cn(
                      'px-6 py-2.5 text-sm',
                      row.level === 1 && 'pl-10',
                      row.level === 2 && 'pl-16 text-gray-500 dark:text-gray-400',
                      row.isSummary && 'font-semibold text-gray-900 dark:text-gray-100',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {isExpandable && (
                        isExpanded
                          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      )}
                      {row.label}
                    </div>
                  </td>
                  <td
                    className={cn(
                      'px-6 py-2.5 text-right text-sm tabular-nums',
                      row.isSummary && 'font-semibold',
                      row.value > 0 && 'text-blue-600 dark:text-blue-400',
                      row.value < 0 && 'text-red-600 dark:text-red-400',
                      row.value === 0 && 'text-gray-400',
                    )}
                  >
                    {formatCurrency(row.value)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default DreTable
