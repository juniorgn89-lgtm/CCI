import { useState, Fragment } from 'react'
import { ChevronDown, ChevronRight, LayoutGrid } from 'lucide-react'
import { formatCurrency, formatPercent, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { Setor, EmpresaDetail, TotalRow, ProductDetail } from '@/pages/Dashboard/hooks/useDashboardData'

interface SectorDetailSectionProps {
  sectorDetails: Record<Setor, { empresas: EmpresaDetail[]; total: TotalRow }>
}

const tabs: { key: Setor; label: string }[] = [
  { key: 'combustivel', label: 'COMBUSTÍVEIS' },
  { key: 'automotivos', label: 'AUTOMOTIVOS' },
  { key: 'conveniencia', label: 'CONVENIÊNCIAS' },
]

const fmtCur = (v: number) => formatCurrency(v)
const fmtPct = (v: number) => formatPercent(v)
const fmtNum = (v: number) => formatNumber(v)

const MarginBar = ({ value }: { value: number }) => {
  const width = Math.min(Math.abs(value), 100)
  const color = value >= 10 ? 'bg-green-400' : value >= 5 ? 'bg-yellow-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-1">
      <span className="w-12 text-right text-xs">{fmtPct(value)}</span>
      <div className="h-2 w-16 rounded-full bg-gray-100">
        <div className={cn('h-2 rounded-full', color)} style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

const ProductRow = ({ product }: { product: ProductDetail }) => (
  <tr className="border-t border-gray-100 text-xs text-gray-600 hover:bg-gray-50">
    <td className="py-2 pl-12">{product.nome}</td>
    <td className="py-2 text-right">{fmtNum(product.litros)}</td>
    <td className="py-2 text-right">{fmtCur(product.lucroBruto)}</td>
    <td className="py-2"><MarginBar value={product.margem} /></td>
    <td className="py-2 text-right">{fmtCur(product.precoVenda)}</td>
    <td className="py-2 text-right">{fmtCur(product.precoCusto)}</td>
    <td className="py-2 text-right">{fmtCur(product.lbPorLitro)}</td>
  </tr>
)

const EmpresaRow = ({ empresa }: { empresa: EmpresaDetail }) => {
  const [expanded, setExpanded] = useState(false)

  return (
    <Fragment>
      <tr
        className="cursor-pointer border-t border-gray-200 bg-gray-50/50 text-sm font-medium text-gray-900 hover:bg-blue-50/50"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="py-2.5 pl-4">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
            {empresa.empresa}
          </div>
        </td>
        <td className="py-2.5 text-right">{fmtNum(empresa.litros)}</td>
        <td className="py-2.5 text-right">{fmtCur(empresa.lucroBruto)}</td>
        <td className="py-2.5"><MarginBar value={empresa.margem} /></td>
        <td className="py-2.5 text-right">{fmtCur(empresa.precoVenda)}</td>
        <td className="py-2.5 text-right">{fmtCur(empresa.precoCusto)}</td>
        <td className="py-2.5 text-right">{fmtCur(empresa.lbPorLitro)}</td>
      </tr>
      {expanded &&
        empresa.produtos.map((product) => (
          <ProductRow key={product.produtoCodigo} product={product} />
        ))}
    </Fragment>
  )
}

const SectorDetailSection = ({ sectorDetails }: SectorDetailSectionProps) => {
  const [activeTab, setActiveTab] = useState<Setor>('combustivel')
  const { empresas, total } = sectorDetails[activeTab]

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Detalhamento de informações por setor
          </h2>
          <p className="text-sm text-gray-500">
            Aqui temos todas as vendas setorizadas com maior nível de detalhes
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
          <div className="flex items-center rounded-md bg-white px-2 py-1 shadow-sm">
            <LayoutGrid className="h-4 w-4 text-gray-500" />
          </div>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'rounded-md px-4 py-1.5 text-xs font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-[#1e3a5f] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {empresas.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            Dados detalhados não disponíveis para este setor no período selecionado.
          </div>
        ) : (
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase text-gray-500">
                <th className="px-4 py-3 text-left">Empresa</th>
                <th className="px-2 py-3 text-right">Litros</th>
                <th className="px-2 py-3 text-right">Lucro Bruto</th>
                <th className="px-2 py-3 text-left">Margem</th>
                <th className="px-2 py-3 text-right">Preço venda</th>
                <th className="px-2 py-3 text-right">Preço custo</th>
                <th className="px-2 py-3 text-right">L.B. por litro</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((empresa) => (
                <EmpresaRow key={empresa.empresaCodigo} empresa={empresa} />
              ))}
              {/* Total row */}
              <tr className="border-t-2 border-gray-300 bg-gray-50 text-sm font-semibold text-gray-900">
                <td className="px-4 py-3">Total</td>
                <td className="px-2 py-3 text-right">{fmtNum(total.litros)}</td>
                <td className="px-2 py-3 text-right">{fmtCur(total.lucroBruto)}</td>
                <td className="px-2 py-3"><MarginBar value={total.margem} /></td>
                <td className="px-2 py-3 text-right">{fmtCur(total.precoVenda)}</td>
                <td className="px-2 py-3 text-right">{fmtCur(total.precoCusto)}</td>
                <td className="px-2 py-3 text-right">{fmtCur(total.lbPorLitro)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default SectorDetailSection
