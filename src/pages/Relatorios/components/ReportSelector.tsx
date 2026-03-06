import { FileText, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RelatorioPersonalizadoItem } from '@/api/types/relatorio'

export interface BuiltInReport {
  id: string
  nome: string
  descricao: string
}

export const BUILT_IN_REPORTS: BuiltInReport[] = [
  { id: 'mapa-desempenho', nome: 'Mapa de Desempenho', descricao: 'Desempenho de funcionários com comissões e metas' },
  { id: 'venda-periodo', nome: 'Vendas por Período', descricao: 'Relatório de vendas agrupado por período, produto ou funcionário' },
  { id: 'produtividade', nome: 'Produtividade por Funcionário', descricao: 'Análise de produtividade individual dos funcionários' },
]

export type SelectedReport =
  | { type: 'builtin'; id: string }
  | { type: 'personalizado'; codigo: number }

interface ReportSelectorProps {
  relatoriosPersonalizados: RelatorioPersonalizadoItem[]
  selected: SelectedReport | null
  onSelect: (report: SelectedReport) => void
}

const ReportSelector = ({ relatoriosPersonalizados, selected, onSelect }: ReportSelectorProps) => {
  const isSelected = (report: SelectedReport) => {
    if (!selected) return false
    if (selected.type !== report.type) return false
    if (selected.type === 'builtin' && report.type === 'builtin') return selected.id === report.id
    if (selected.type === 'personalizado' && report.type === 'personalizado') return selected.codigo === report.codigo
    return false
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-700">Relatórios Disponíveis</h3>
      </div>

      <div className="divide-y divide-gray-100">
        <div className="px-4 py-2">
          <span className="text-xs font-medium uppercase text-gray-400">Pré-configurados</span>
        </div>
        {BUILT_IN_REPORTS.map((report) => {
          const sel: SelectedReport = { type: 'builtin', id: report.id }
          return (
            <button
              key={report.id}
              onClick={() => onSelect(sel)}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-blue-50',
                isSelected(sel) && 'bg-blue-50 border-l-4 border-blue-600',
              )}
            >
              <FileText className="h-4 w-4 shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{report.nome}</p>
                <p className="truncate text-xs text-gray-500">{report.descricao}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
            </button>
          )
        })}

        {relatoriosPersonalizados.length > 0 && (
          <>
            <div className="px-4 py-2">
              <span className="text-xs font-medium uppercase text-gray-400">Personalizados</span>
            </div>
            {relatoriosPersonalizados.map((report) => {
              const sel: SelectedReport = { type: 'personalizado', codigo: report.codigo }
              return (
                <button
                  key={report.codigo}
                  onClick={() => onSelect(sel)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-blue-50',
                    isSelected(sel) && 'bg-blue-50 border-l-4 border-blue-600',
                  )}
                >
                  <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{report.descricao}</p>
                    <p className="truncate text-xs text-gray-500">Tipo: {report.tipo}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                </button>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}

export default ReportSelector
