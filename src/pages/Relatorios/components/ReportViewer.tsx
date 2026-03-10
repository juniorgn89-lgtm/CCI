import { useMemo, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FileText, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useFilterStore } from '@/store/filters'
import {
  fetchMapaDesempenho,
  fetchVendaPeriodo,
  fetchProdutividadeFuncionario,
  fetchRelatorioPersonalizado,
} from '@/api/endpoints/relatorios'
import type { SelectedReport } from './ReportSelector'

interface ReportViewerProps {
  selected: SelectedReport
}

const getReportLabel = (selected: SelectedReport): string => {
  if (selected.type === 'builtin') {
    const labels: Record<string, string> = {
      'mapa-desempenho': 'Mapa de Desempenho',
      'venda-periodo': 'Vendas por Período',
      'produtividade': 'Produtividade por Funcionário',
    }
    return labels[selected.id] ?? selected.id
  }
  return `Relatório Personalizado #${selected.codigo}`
}

const ReportViewer = ({ selected }: ReportViewerProps) => {
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null

  const queryKey = selected.type === 'builtin'
    ? ['relatorio', selected.id, empresaCodigos, dataInicial, dataFinal]
    : ['relatorio', 'personalizado', selected.codigo, empresaCodigos, dataInicial, dataFinal]

  const fetchReport = useCallback(async (): Promise<Blob> => {
    if (selected.type === 'builtin') {
      switch (selected.id) {
        case 'mapa-desempenho':
          return fetchMapaDesempenho({ dataInicial, dataFinal, filial: empresaCodigos.length > 0 ? empresaCodigos : undefined })
        case 'venda-periodo':
          return fetchVendaPeriodo({
            empresaCodigo: empresaCodigo ?? 0,
            dataInicial,
            dataFinal,
            ordenacaoPor: 'REFERENCIA',
            tipoData: 'FISCAL',
          })
        case 'produtividade':
          return fetchProdutividadeFuncionario({ dataInicial, dataFinal, filial: empresaCodigo ?? undefined })
        default:
          throw new Error(`Relatório desconhecido: ${selected.id}`)
      }
    }
    return fetchRelatorioPersonalizado(selected.codigo, {
      dataInicial,
      dataFinal,
      filial: empresaCodigos.length > 0 ? empresaCodigos : undefined,
    })
  }, [selected, empresaCodigos, empresaCodigo, dataInicial, dataFinal])

  const { data: blob, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: fetchReport,
    retry: 1,
    staleTime: 0,
  })

  const objectUrl = useMemo(() => {
    if (!blob) return null
    return URL.createObjectURL(blob)
  }, [blob])

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  const handleDownload = () => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${getReportLabel(selected).replace(/\s+/g, '_')}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-gray-200 px-6 py-4">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="mt-3 text-sm text-gray-500">Gerando relatório...</p>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-gray-200 px-6 py-4">
          <FileText className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900">{getReportLabel(selected)}</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="h-10 w-10 text-red-400" />
          <p className="mt-3 text-sm font-medium text-gray-700">
            Não foi possível gerar o relatório.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Verifique os filtros selecionados e tente novamente.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900">{getReportLabel(selected)}</h3>
        </div>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="mr-1.5 h-4 w-4" />
          Baixar PDF
        </Button>
      </div>
      {objectUrl ? (
        <iframe
          src={objectUrl}
          className="h-[600px] w-full"
          title={getReportLabel(selected)}
        />
      ) : (
        <div className="flex items-center justify-center py-24">
          <p className="text-sm text-gray-500">Nenhum dado disponível.</p>
        </div>
      )}
    </div>
  )
}

export default ReportViewer
