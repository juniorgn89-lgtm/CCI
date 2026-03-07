import { useState, Fragment } from 'react'
import { ChevronDown, ChevronRight, LayoutGrid, Table2 } from 'lucide-react'
import { formatCurrency, formatPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { Setor, EmpresaDetail, TotalRow } from '@/pages/Dashboard/hooks/useDashboardData'

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
const fmtLitros = (v: number) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)
const fmtInt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)

const MarginBar = ({ value }: { value: number }) => {
  const width = Math.min(Math.abs(value), 100)
  const color = value >= 10 ? 'bg-green-400' : value >= 5 ? 'bg-yellow-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 text-right text-xs">{fmtPct(value)}</span>
      <div className="h-2 w-16 rounded-full bg-gray-100">
        <div className={cn('h-2 rounded-full', color)} style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

// ========== COMBUSTÍVEIS TABLE ==========

const FuelProductRow = ({ product }: { product: EmpresaDetail['produtos'][0] }) => (
  <tr className="border-t border-gray-100 text-xs text-gray-600 hover:bg-gray-50">
    <td className="px-4 py-2 pl-12">{product.nome}</td>
    <td className="px-4 py-2 text-right tabular-nums">{fmtLitros(product.litros)}</td>
    <td className="px-4 py-2 text-right tabular-nums">{fmtCur(product.lucroBruto)}</td>
    <td className="px-4 py-2"><MarginBar value={product.margem} /></td>
    <td className="px-4 py-2 text-right tabular-nums">{fmtCur(product.precoVenda)}</td>
    <td className="px-4 py-2 text-right tabular-nums">{fmtCur(product.precoCusto)}</td>
    <td className="px-6 py-2 text-right tabular-nums font-medium">{fmtCur(product.lbPorLitro)}</td>
  </tr>
)

const FuelEmpresaRow = ({ empresa }: { empresa: EmpresaDetail }) => {
  const [expanded, setExpanded] = useState(false)
  return (
    <Fragment>
      <tr
        className="cursor-pointer border-t border-gray-200 bg-gray-50/50 text-sm font-medium text-gray-900 hover:bg-blue-50/50"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
            {empresa.empresa}
          </div>
        </td>
        <td className="px-4 py-2.5 text-right tabular-nums">{fmtLitros(empresa.litros)}</td>
        <td className="px-4 py-2.5 text-right tabular-nums">{fmtCur(empresa.lucroBruto)}</td>
        <td className="px-4 py-2.5"><MarginBar value={empresa.margem} /></td>
        <td className="px-4 py-2.5 text-right tabular-nums">{fmtCur(empresa.precoVenda)}</td>
        <td className="px-4 py-2.5 text-right tabular-nums">{fmtCur(empresa.precoCusto)}</td>
        <td className="px-6 py-2.5 text-right tabular-nums font-semibold">{fmtCur(empresa.lbPorLitro)}</td>
      </tr>
      {expanded && empresa.produtos.map((p) => <FuelProductRow key={p.produtoCodigo} product={p} />)}
    </Fragment>
  )
}

const FuelTable = ({ empresas, total }: { empresas: EmpresaDetail[]; total: TotalRow }) => (
  <table className="w-full min-w-[900px]">
    <thead>
      <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase text-gray-500">
        <th className="px-4 py-3 text-left">Empresa</th>
        <th className="px-4 py-3 text-right">Litros</th>
        <th className="px-4 py-3 text-right">Lucro Bruto</th>
        <th className="px-4 py-3 text-left">Margem</th>
        <th className="px-4 py-3 text-right">Preço venda</th>
        <th className="px-4 py-3 text-right">Preço custo</th>
        <th className="px-6 py-3 text-right">L.B. por litro</th>
      </tr>
    </thead>
    <tbody>
      {empresas.map((e) => <FuelEmpresaRow key={e.empresaCodigo} empresa={e} />)}
      <tr className="border-t-2 border-gray-300 bg-gray-50 text-sm font-semibold text-gray-900">
        <td className="px-4 py-3">Total</td>
        <td className="px-4 py-3 text-right tabular-nums">{fmtLitros(total.litros)}</td>
        <td className="px-4 py-3 text-right tabular-nums">{fmtCur(total.lucroBruto)}</td>
        <td className="px-4 py-3"><MarginBar value={total.margem} /></td>
        <td className="px-4 py-3 text-right tabular-nums">{fmtCur(total.precoVenda)}</td>
        <td className="px-4 py-3 text-right tabular-nums">{fmtCur(total.precoCusto)}</td>
        <td className="px-6 py-3 text-right tabular-nums font-bold">{fmtCur(total.lbPorLitro)}</td>
      </tr>
    </tbody>
  </table>
)

// ========== AUTOMOTIVOS / CONVENIÊNCIAS TABLE ==========

const NonFuelEmpresaRow = ({ empresa }: { empresa: EmpresaDetail }) => (
  <tr className="border-t border-gray-200 text-sm text-gray-900 hover:bg-blue-50/50">
    <td className="px-4 py-2.5">
      <div className="flex items-center gap-2">
        <ChevronRight className="h-4 w-4 text-gray-300" />
        <span className="font-medium">{empresa.empresa}</span>
      </div>
    </td>
    <td className="px-4 py-2.5 text-right tabular-nums">{fmtInt(empresa.quantidade ?? 0)}</td>
    <td className="px-4 py-2.5 text-right tabular-nums">{fmtCur(empresa.faturamento ?? 0)}</td>
    <td className="px-4 py-2.5 text-right tabular-nums">{fmtCur(empresa.lucroBruto)}</td>
    <td className="px-4 py-2.5"><MarginBar value={empresa.margem} /></td>
    <td className="px-4 py-2.5 text-right tabular-nums">{fmtCur(empresa.precoMedio ?? 0)}</td>
    <td className="px-4 py-2.5 text-right tabular-nums">{fmtCur(empresa.custoMedio ?? 0)}</td>
    <td className="px-6 py-2.5 text-right tabular-nums font-semibold">{fmtCur(empresa.ticketMedio ?? 0)}</td>
  </tr>
)

const NonFuelTable = ({ empresas, total }: { empresas: EmpresaDetail[]; total: TotalRow }) => (
  <table className="w-full min-w-[900px]">
    <thead>
      <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase text-gray-500">
        <th className="px-4 py-3 text-left">Empresa</th>
        <th className="px-4 py-3 text-right">Quantidade</th>
        <th className="px-4 py-3 text-right">Faturamento</th>
        <th className="px-4 py-3 text-right">Lucro bruto</th>
        <th className="px-4 py-3 text-left">Margem</th>
        <th className="px-4 py-3 text-right">Preço médio</th>
        <th className="px-4 py-3 text-right">Custo médio</th>
        <th className="px-6 py-3 text-right">Ticket médio</th>
      </tr>
    </thead>
    <tbody>
      {empresas.map((e) => <NonFuelEmpresaRow key={e.empresaCodigo} empresa={e} />)}
      <tr className="border-t-2 border-gray-300 bg-gray-50 text-sm font-semibold text-gray-900">
        <td className="px-4 py-3">Total</td>
        <td className="px-4 py-3 text-right tabular-nums">{fmtInt(total.quantidade ?? 0)}</td>
        <td className="px-4 py-3 text-right tabular-nums">{fmtCur(total.faturamento ?? 0)}</td>
        <td className="px-4 py-3 text-right tabular-nums">{fmtCur(total.lucroBruto)}</td>
        <td className="px-4 py-3"><MarginBar value={total.margem} /></td>
        <td className="px-4 py-3 text-right tabular-nums">{fmtCur(total.precoMedio ?? 0)}</td>
        <td className="px-4 py-3 text-right tabular-nums">{fmtCur(total.custoMedio ?? 0)}</td>
        <td className="px-6 py-3 text-right tabular-nums font-bold">{fmtCur(total.ticketMedio ?? 0)}</td>
      </tr>
    </tbody>
  </table>
)

// ========== MAIN SECTION ==========

const SectorDetailSection = ({ sectorDetails }: SectorDetailSectionProps) => {
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<Setor>('combustivel')
  const { empresas, total } = sectorDetails[activeTab]

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <Table2 className="h-5 w-5 text-gray-400" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Detalhamento de informações por setor
            </h2>
            <p className="text-sm text-gray-500">
              Aqui temos todas as vendas setorizadas com maior nível de detalhes
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-gray-400 transition-transform duration-200',
            expanded && 'rotate-180'
          )}
        />
      </button>

      {expanded && (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-1 border-t border-gray-200 px-6 py-3">
            <div className="flex items-center rounded-md bg-white px-2 py-1">
              <LayoutGrid className="h-4 w-4 text-gray-500" />
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
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
            ) : activeTab === 'combustivel' ? (
              <FuelTable empresas={empresas} total={total} />
            ) : (
              <NonFuelTable empresas={empresas} total={total} />
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default SectorDetailSection
