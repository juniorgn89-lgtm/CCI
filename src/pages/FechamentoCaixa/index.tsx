import { useMemo, useState } from 'react'
import { Receipt, ChevronDown } from 'lucide-react'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useFilterStore } from '@/store/filters'
import { cn } from '@/lib/utils'
import BarCell from '@/components/tables/BarCell'

interface Caixa {
  id: string
  data: string
  turno: string
  pdv: string
  abertura: string
  fechamento: string
}

interface GrupoRow {
  grupo: string
  quantidade: number
  total: number
  margemBruta: number
}

interface MovimentacaoRow {
  label: string
  valor: number
}

const caixas: Caixa[] = [
  { id: '20260519-1-conv', data: '19/05/2026', turno: '1º TURNO', pdv: 'PDV CONVENIÊNCIA', abertura: '00:18', fechamento: '23:59' },
  { id: '20260519-2-conv', data: '19/05/2026', turno: '2º TURNO', pdv: 'PDV CONVENIÊNCIA', abertura: '00:18', fechamento: '23:59' },
  { id: '20260518-1-conv', data: '18/05/2026', turno: '1º TURNO', pdv: 'PDV CONVENIÊNCIA', abertura: '00:14', fechamento: '23:58' },
  { id: '20260518-1-pista', data: '18/05/2026', turno: '1º TURNO', pdv: 'PDV PISTA', abertura: '00:00', fechamento: '23:55' },
]

// Mock — fator de escala por caixa. Quando o backend chegar, vira fetch real.
const caixaFator: Record<string, number> = {
  '20260519-1-conv': 1,
  '20260519-2-conv': 0.65,
  '20260518-1-conv': 0.82,
  '20260518-1-pista': 1.4,
}

const baseGrupos: GrupoRow[] = [
  { grupo: 'LJ - BEBIDAS ALCOOLICAS', quantidade: 1, total: 12.9, margemBruta: 8.814 },
  { grupo: 'LJ - BEBIDAS NAO ALCOOLICAS', quantidade: 60, total: 498.04, margemBruta: 305.113 },
  { grupo: 'LJ - BOMBONIERE', quantidade: 81, total: 365.34, margemBruta: 128.837 },
  { grupo: 'LJ - CERVEJAS', quantidade: 26, total: 282.78, margemBruta: 150.022 },
  { grupo: 'LJ - CONGELADOS', quantidade: 1, total: 13.5, margemBruta: 4.788 },
  { grupo: 'LJ - CORTESIA', quantidade: 63, total: 0.63, margemBruta: -36.24 },
  { grupo: 'LJ - ELETRONICOS', quantidade: 1, total: 29.9, margemBruta: 11.9 },
  { grupo: 'LJ - ENERGETICO E ISOTONICOS', quantidade: 13, total: 231.05, margemBruta: 114.524 },
  { grupo: 'LJ - FAST-FOOD', quantidade: 746, total: 1210.66, margemBruta: 793.218 },
  { grupo: 'LJ - MINI MERCADO', quantidade: 7, total: 68.46, margemBruta: 24.923 },
  { grupo: 'LJ - SNACKS', quantidade: 14, total: 106.48, margemBruta: 45.278 },
  { grupo: 'LJ - SORVETES', quantidade: 6, total: 74.8, margemBruta: 22.726 },
  { grupo: 'LJ - TABACARIA', quantidade: 66, total: 994.55, margemBruta: 304.958 },
  { grupo: 'LJ - TABACARIA ACESSÓRIOS', quantidade: 4, total: 31.6, margemBruta: 18.567 },
]

const baseEntradas: MovimentacaoRow[] = [
  { label: 'Combustível (R$)', valor: 0 },
  { label: 'Produto (R$)', valor: 3920.69 },
  { label: 'Vale (R$)', valor: 0 },
  { label: 'Suprimento (R$)', valor: 0 },
  { label: 'Recebimento (R$)', valor: 0 },
  { label: 'Cheque Troco (R$)', valor: 0 },
  { label: 'Serviço (R$)', valor: 0 },
  { label: 'Pré Pago Créd. (R$)', valor: 0 },
  { label: 'Fundo Cx Créd. (R$)', valor: 0 },
  { label: 'Ordem Pagto. (R$)', valor: 0 },
  { label: 'Pagamento (-) (R$)', valor: 0 },
  { label: 'Saída Troca V. (-) (R$)', valor: 0 },
  { label: 'Serviço Troca V. (-) (R$)', valor: 0 },
]

const baseSaidas: MovimentacaoRow[] = [
  { label: 'Cartão', valor: 2383.61 },
  { label: 'Dinheiro', valor: 674 },
  { label: 'Transferência Bancária Crédito', valor: 866.72 },
]

const formatCaixaFull = (c: Caixa) =>
  `${c.data} ${c.turno} ${c.pdv} A: ${c.abertura} F: ${c.fechamento}`

const formatCaixaShort = (c: Caixa) =>
  `${c.data} · ${c.turno} · ${c.pdv}`

const fmt = (value: number, digits = 2) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)

const FechamentoCaixa = () => {
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const hasEmpresa = empresaCodigos.length > 0

  const [selectedIds, setSelectedIds] = useState<string[]>(() => [caixas[0].id])

  const selectedCaixas = caixas.filter((c) => selectedIds.includes(c.id))
  const allSelected = selectedIds.length === caixas.length
  const noneSelected = selectedIds.length === 0

  const toggleCaixa = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const selectAll = () => setSelectedIds(caixas.map((c) => c.id))
  const clearAll = () => setSelectedIds([])

  const triggerLabel = noneSelected
    ? 'Selecione um caixa'
    : allSelected
      ? `Todos os caixas (${caixas.length})`
      : selectedIds.length === 1
        ? formatCaixaShort(selectedCaixas[0])
        : `${selectedIds.length} caixas selecionados`

  const metaLine = noneSelected
    ? 'Nenhum caixa selecionado'
    : `Caixas: ${selectedCaixas.map(formatCaixaFull).join(' • ')}`

  const dados = useMemo(() => {
    const fator = selectedIds.reduce((acc, id) => acc + (caixaFator[id] ?? 0), 0)

    const grupos = baseGrupos.map((g) => ({
      ...g,
      quantidade: g.quantidade * fator,
      total: g.total * fator,
      margemBruta: g.margemBruta * fator,
    }))

    const gruposTotal = grupos.reduce(
      (acc, g) => ({
        quantidade: acc.quantidade + g.quantidade,
        total: acc.total + g.total,
        margemBruta: acc.margemBruta + g.margemBruta,
      }),
      { quantidade: 0, total: 0, margemBruta: 0 },
    )

    const entradas = baseEntradas.map((e) => ({ ...e, valor: e.valor * fator }))
    const entradasTotal = entradas.reduce((acc, e) => acc + e.valor, 0)

    const saidas = baseSaidas.map((s) => ({ ...s, valor: s.valor * fator }))
    const saidasTotal = saidas.reduce((acc, s) => acc + s.valor, 0)

    const maxTotal = grupos.reduce((m, g) => Math.max(m, g.total), 0)
    const maxMargemAbs = grupos.reduce((m, g) => Math.max(m, Math.abs(g.margemBruta)), 0)
    const maxEntrada = entradas.reduce((m, e) => Math.max(m, e.valor), 0)
    const maxSaida = saidas.reduce((m, s) => Math.max(m, s.valor), 0)

    return {
      grupos,
      gruposTotal,
      entradas,
      entradasTotal,
      saidas,
      saidasTotal,
      maxTotal,
      maxMargemAbs,
      maxEntrada,
      maxSaida,
    }
  }, [selectedIds])

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-gray-900 dark:text-gray-100">
              Fechamento de Caixa
            </h1>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              Relatório de movimentação e vendas por caixa
            </p>
          </div>
        </div>
      </PageHeaderTitle>

      {!hasEmpresa && <SelectCompanyState />}

      {hasEmpresa && (
        <>
          {/* Filtro de caixas */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Caixas
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'inline-flex h-9 min-w-[280px] items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500',
                    'dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800',
                  )}
                >
                  <span className="truncate">{triggerLabel}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[340px]">
                <DropdownMenuLabel className="flex items-center justify-between gap-3 text-xs">
                  <span>Selecionar caixas</span>
                  <div className="flex items-center gap-2 text-[11px] font-normal">
                    <button
                      type="button"
                      onClick={selectAll}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Todos
                    </button>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <button
                      type="button"
                      onClick={clearAll}
                      className="text-gray-500 hover:underline dark:text-gray-400"
                    >
                      Limpar
                    </button>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {caixas.map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={selectedIds.includes(c.id)}
                    onCheckedChange={() => toggleCaixa(c.id)}
                    onSelect={(e) => e.preventDefault()}
                    className="text-xs"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {c.data} · {c.turno}
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        {c.pdv} · A: {c.abertura} F: {c.fechamento}
                      </span>
                    </div>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            {/* Cabeçalho do relatório */}
            <div className="flex flex-col gap-4 border-b border-gray-200 pb-4 dark:border-gray-700 md:flex-row md:items-start md:justify-between">
              <div className="flex flex-col gap-2">
                <div className="inline-flex w-fit items-center rounded-md bg-gray-900 px-2.5 py-1 text-xs font-bold tracking-wide text-white dark:bg-gray-100 dark:text-gray-900">
                  autobem
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Caixa Geral</h2>
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    {metaLine}
                  </p>
                </div>
              </div>
              <div className="text-left md:text-right">
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">POSTO ITAPOA</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">31.465.040/0001-32</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">21/05/2026 12:13:51 BRT</p>
              </div>
            </div>

            {/* Vendas por Grupos */}
            <section className="mt-6">
              <div className="rounded-t-md border border-b-0 border-gray-200 bg-gray-100 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                Vendas por Grupos
              </div>
              <div className="overflow-x-auto rounded-b-md border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                      <th className="px-4 py-2 text-left">Grupo</th>
                      <th className="px-4 py-2 text-right">Quantidade</th>
                      <th className="px-4 py-2 text-right">Total (R$)</th>
                      <th className="px-4 py-2 text-right">Margem Bruta (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.grupos.map((row) => (
                      <tr
                        key={row.grupo}
                        className="border-b border-gray-100 text-gray-800 last:border-b-0 dark:border-gray-800 dark:text-gray-200"
                      >
                        <td className="px-4 py-2 text-left">{row.grupo}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{fmt(row.quantidade)}</td>
                        <td className="px-2 py-1.5">
                          <BarCell value={row.total} max={dados.maxTotal} formatted={fmt(row.total)} color="blue" align="near" />
                        </td>
                        <td className="px-2 py-1.5">
                          <BarCell
                            value={Math.abs(row.margemBruta)}
                            max={dados.maxMargemAbs}
                            formatted={fmt(row.margemBruta, 3)}
                            color={row.margemBruta < 0 ? 'red' : 'green'}
                            align="near"
                          />
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                      <td className="px-4 py-2 text-left">Total:</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmt(dados.gruposTotal.quantidade)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmt(dados.gruposTotal.total)}</td>
                      <td
                        className={cn(
                          'px-4 py-2 text-right tabular-nums',
                          dados.gruposTotal.margemBruta < 0 && 'text-red-600 dark:text-red-400',
                        )}
                      >
                        {fmt(dados.gruposTotal.margemBruta, 3)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Movimentação Financeira dos Caixas */}
            <section className="mt-6">
              <div className="rounded-t-md border border-b-0 border-gray-200 bg-gray-100 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                Movimentação Financeira dos Caixas
              </div>
              <div className="grid grid-cols-1 gap-0 rounded-b-md border border-gray-200 md:grid-cols-2 md:divide-x md:divide-gray-200 dark:border-gray-700 dark:md:divide-gray-700">
                {/* Entradas */}
                <div>
                  <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                    Entradas
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {dados.entradas.map((row) => (
                        <tr
                          key={row.label}
                          className="border-b border-gray-100 text-gray-800 last:border-b-0 dark:border-gray-800 dark:text-gray-200"
                        >
                          <td className="px-4 py-2 text-left">{row.label}</td>
                          <td className="px-2 py-1.5">
                            <BarCell value={row.valor} max={dados.maxEntrada} formatted={fmt(row.valor)} color="blue" align="near" />
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                        <td className="px-4 py-2 text-left">Total:</td>
                        <td className="px-4 py-2 text-right tabular-nums">{fmt(dados.entradasTotal)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Saídas */}
                <div>
                  <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                    Saídas
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {dados.saidas.map((row) => (
                        <tr
                          key={row.label}
                          className="border-b border-gray-100 text-gray-800 last:border-b-0 dark:border-gray-800 dark:text-gray-200"
                        >
                          <td className="px-4 py-2 text-left">{row.label}</td>
                          <td className="px-2 py-1.5">
                            <BarCell value={row.valor} max={dados.maxSaida} formatted={fmt(row.valor)} color="green" align="near" />
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                        <td className="px-4 py-2 text-left">Total:</td>
                        <td className="px-4 py-2 text-right tabular-nums">{fmt(dados.saidasTotal)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}

export default FechamentoCaixa
