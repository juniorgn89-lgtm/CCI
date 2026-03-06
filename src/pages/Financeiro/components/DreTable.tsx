import { useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'
import type { DRE } from '@/api/types/financeiro'

interface DreTableProps {
  data: DRE | undefined
}

interface DreRow {
  label: string
  value: number
  level: number
  isSummary: boolean
}

const DreTable = ({ data }: DreTableProps) => {
  const rows = useMemo((): DreRow[] => {
    if (!data) return []

    const result: DreRow[] = []

    // 1. Receita Bruta
    result.push({ label: 'Receita Bruta', value: data.receitaBruta, level: 0, isSummary: true })

    // 1.1 Vendas por grupo
    const totalVendas = data.vendasGrupo.reduce((acc, g) => acc + g.valorVenda, 0)
    const totalCmv = data.vendasGrupo.reduce((acc, g) => acc + g.cmv, 0)
    const totalDescontosVendas = data.vendasGrupo.reduce((acc, g) => acc + g.desconto, 0)
    const totalAcrescimosVendas = data.vendasGrupo.reduce((acc, g) => acc + g.acrescimo, 0)

    result.push({ label: 'Vendas por Grupo', value: totalVendas, level: 1, isSummary: false })
    for (const grupo of data.vendasGrupo) {
      result.push({ label: grupo.produtoGrupo, value: grupo.valorVenda, level: 2, isSummary: false })
    }

    // 1.2 Descontos
    if (totalDescontosVendas !== 0) {
      result.push({ label: '(-) Descontos sobre Vendas', value: -totalDescontosVendas, level: 1, isSummary: false })
    }

    // 1.3 Acréscimos
    if (totalAcrescimosVendas !== 0) {
      result.push({ label: '(+) Acréscimos sobre Vendas', value: totalAcrescimosVendas, level: 1, isSummary: false })
    }

    // 2. Deduções Fiscais
    result.push({ label: '(-) Deduções Fiscais', value: -data.deducaoFiscal, level: 0, isSummary: false })

    // 3. Receita Líquida
    const receitaLiquida = data.receitaBruta - data.deducaoFiscal
    result.push({ label: 'Receita Líquida', value: receitaLiquida, level: 0, isSummary: true })

    // 4. CMV
    result.push({ label: '(-) Custo das Mercadorias Vendidas (CMV)', value: -totalCmv, level: 0, isSummary: false })

    // 5. Lucro Bruto
    const lucroBruto = receitaLiquida - totalCmv
    result.push({ label: 'Lucro Bruto', value: lucroBruto, level: 0, isSummary: true })

    // 6. Apuração de Receitas (outras receitas)
    const groupedReceitas = new Map<string, { items: { label: string; value: number }[]; total: number }>()
    for (const r of data.apuracaoReceita) {
      const pai = r.planoContaGerencialPAI || 'Outras Receitas'
      const prev = groupedReceitas.get(pai) ?? { items: [], total: 0 }
      prev.items.push({ label: r.planoContaGerencialFILHO || r.descricaoDocumento, value: r.valor })
      prev.total += r.valor
      groupedReceitas.set(pai, prev)
    }

    let totalReceitas = 0
    if (groupedReceitas.size > 0) {
      result.push({ label: '(+) Outras Receitas', value: 0, level: 0, isSummary: false })
      for (const [pai, group] of groupedReceitas) {
        result.push({ label: pai, value: group.total, level: 1, isSummary: false })
        for (const item of group.items) {
          result.push({ label: item.label, value: item.value, level: 2, isSummary: false })
        }
        totalReceitas += group.total
      }
      result[result.length - groupedReceitas.size * 2 - 1].value = totalReceitas
    }

    // 7. Apuração de Pagamentos (despesas)
    const groupedDespesas = new Map<string, { items: { label: string; value: number }[]; total: number }>()
    for (const p of data.apuracaoPagamentos) {
      const pai = p.planoContaGerencialPAI || 'Outras Despesas'
      const prev = groupedDespesas.get(pai) ?? { items: [], total: 0 }
      prev.items.push({ label: p.planoContaGerencialFILHO || p.descricaoDocumento, value: p.valor })
      prev.total += p.valor
      groupedDespesas.set(pai, prev)
    }

    let totalDespesas = 0
    if (groupedDespesas.size > 0) {
      result.push({ label: '(-) Despesas Operacionais', value: 0, level: 0, isSummary: false })
      for (const [pai, group] of groupedDespesas) {
        result.push({ label: pai, value: group.total, level: 1, isSummary: false })
        for (const item of group.items) {
          result.push({ label: item.label, value: item.value, level: 2, isSummary: false })
        }
        totalDespesas += group.total
      }
      // Update the "Despesas Operacionais" header value
      const despesasHeaderIdx = result.findIndex((r) => r.label === '(-) Despesas Operacionais')
      if (despesasHeaderIdx >= 0) {
        result[despesasHeaderIdx].value = -totalDespesas
      }
    }

    // 8. Resultado Operacional
    const resultadoOperacional = lucroBruto + totalReceitas - totalDespesas
    result.push({ label: 'Resultado Operacional', value: resultadoOperacional, level: 0, isSummary: true })

    return result
  }, [data])

  if (!data) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
        <p className="text-sm text-gray-500">Nenhum dado de DRE disponível para o período selecionado.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h3 className="text-lg font-semibold text-gray-900">Demonstrativo de Resultado do Exercício</h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-100 hover:bg-gray-100">
            <TableHead className="text-xs font-medium uppercase text-gray-600">Descrição</TableHead>
            <TableHead className="text-right text-xs font-medium uppercase text-gray-600">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-gray-200">
          {rows.map((row, index) => (
            <TableRow
              key={index}
              className={cn(
                'hover:bg-blue-50',
                row.isSummary && 'bg-gray-50 font-semibold',
              )}
            >
              <TableCell
                className={cn(
                  'text-sm',
                  row.level === 1 && 'pl-8',
                  row.level === 2 && 'pl-14 text-gray-500',
                  row.isSummary && 'font-semibold text-gray-900',
                )}
              >
                {row.label}
              </TableCell>
              <TableCell
                className={cn(
                  'text-right text-sm',
                  row.isSummary && 'font-semibold',
                  row.value > 0 && 'text-green-600',
                  row.value < 0 && 'text-red-600',
                )}
              >
                {formatCurrency(row.value)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export default DreTable
