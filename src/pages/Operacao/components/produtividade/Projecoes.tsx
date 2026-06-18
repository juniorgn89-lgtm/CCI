import { useMemo } from 'react'
import { Fuel, ShoppingBag, TrendingUp } from 'lucide-react'
import { formatCurrency, formatLiters } from '@/lib/formatters'
import { useFilterStore } from '@/store/filters'
import useVendedoresConveniencia from '@/pages/Produtividade/hooks/useVendedoresConveniencia'
import type { FrentistaProdRow, PeriodInfo } from '@/pages/Operacao/components/ProdutividadeTab'

interface Props {
  frentistas: FrentistaProdRow[]
  periodInfo: PeriodInfo
}

// Filtra registros sintéticos / inválidos (sem nome, codigo zerado, fallback numérico)
const isValidNome = (nome: string | null | undefined): boolean => {
  if (!nome) return false
  const t = nome.trim()
  if (t === '' || /^\d+$/.test(t)) return false
  if (/^(Frentista|Funcionário|Funcionario) \d+$/.test(t)) return false
  return true
}

const lastDayOfMonth = (year: number, month: number): number => new Date(year, month, 0).getDate()

/**
 * Pró-rata pelo mês corrente: projeta o total do fim do mês a partir do
 * realizado e dos dias DECORRIDOS no mês. Quando o período não é o mês corrente
 * (ex.: mês fechado), `elapsedDays >= daysInMonth` → projeção = realizado.
 */
interface ProRata {
  elapsedDays: number
  daysInMonth: number
  factor: number
  isCurrentMonth: boolean
}

const computeProRata = (periodInfo: PeriodInfo): ProRata => {
  const { dataInicial, todayStr } = periodInfo
  const [y, m] = (dataInicial ?? '').split('-').map(Number)
  if (!y || !m) return { elapsedDays: 0, daysInMonth: 0, factor: 1, isCurrentMonth: false }
  const daysInMonth = lastDayOfMonth(y, m)
  const [ty, tm, td] = (todayStr ?? '').split('-').map(Number)
  const isCurrentMonth = ty === y && tm === m
  // Dias decorridos: hoje (se mês corrente) ou o mês inteiro (mês fechado).
  const elapsedDays = isCurrentMonth ? Math.min(td, daysInMonth) : daysInMonth
  const factor = elapsedDays > 0 ? daysInMonth / elapsedDays : 1
  return { elapsedDays, daysInMonth, factor, isCurrentMonth }
}

const Projecoes = ({ frentistas, periodInfo }: Props) => {
  const { dataInicial } = useFilterStore()
  const proRata = useMemo(() => computeProRata(periodInfo), [periodInfo])

  // ── Tabela de Combustível (frentistas) ──
  const fuelRows = useMemo(() => {
    return frentistas
      .filter((f) => isValidNome(f.nome))
      .map((f) => {
        const litrosProj = f.litros * proRata.factor
        const fatProj = f.faturamento * proRata.factor
        return {
          codigo: f.funcionarioCodigo,
          nome: f.nome,
          litros: f.litros,
          faturamento: f.faturamento,
          litrosProjetado: litrosProj,
          faturamentoProjetado: fatProj,
        }
      })
      .sort((a, b) => b.litros - a.litros)
  }, [frentistas, proRata.factor])

  // ── Tabela de Produtos / loja (vendedores) ──
  const { rows: vendedores, isLoading: loadingVendedores } = useVendedoresConveniencia()
  const lojaRows = useMemo(() => {
    return vendedores
      .filter((v) => isValidNome(v.nome))
      .map((v) => ({
        codigo: v.funcionarioCodigo,
        nome: v.nome,
        faturamento: v.faturamento,
        lucroBruto: v.lucroBruto,
        faturamentoProjetado: v.faturamento * proRata.factor,
        lucroProjetado: v.lucroBruto * proRata.factor,
      }))
      .sort((a, b) => b.faturamento - a.faturamento)
  }, [vendedores, proRata.factor])

  const [yStr, mStr] = (dataInicial ?? '').split('-')
  const mesNomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const mesLabel = mStr ? `${mesNomes[parseInt(mStr, 10) - 1] ?? ''}/${yStr}` : ''

  const fuelTotals = useMemo(() => ({
    litros: fuelRows.reduce((s, r) => s + r.litros, 0),
    faturamento: fuelRows.reduce((s, r) => s + r.faturamento, 0),
    litrosProjetado: fuelRows.reduce((s, r) => s + r.litrosProjetado, 0),
    faturamentoProjetado: fuelRows.reduce((s, r) => s + r.faturamentoProjetado, 0),
  }), [fuelRows])

  const lojaTotals = useMemo(() => ({
    faturamento: lojaRows.reduce((s, r) => s + r.faturamento, 0),
    lucroBruto: lojaRows.reduce((s, r) => s + r.lucroBruto, 0),
    faturamentoProjetado: lojaRows.reduce((s, r) => s + r.faturamentoProjetado, 0),
    lucroProjetado: lojaRows.reduce((s, r) => s + r.lucroProjetado, 0),
  }), [lojaRows])

  return (
    <div className="space-y-5">
      {/* Badge explicativo */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-400">
          <TrendingUp className="h-3.5 w-3.5" />
          Projeção pró-rata pelo mês corrente
        </span>
        {proRata.daysInMonth > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {proRata.isCurrentMonth
              ? `${proRata.elapsedDays} de ${proRata.daysInMonth} dias decorridos${mesLabel ? ` em ${mesLabel}` : ''}`
              : `Mês fechado${mesLabel ? ` (${mesLabel})` : ''} — projeção = realizado`}
          </span>
        )}
      </div>

      {/* Tabela Combustível */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <Fuel className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Combustível — por frentista</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Frentista</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Litros (realizado)</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Faturamento (realizado)</th>
                <th className="border-l border-gray-200 px-4 py-2 text-right text-xs font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">Litros (projeção mês)</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Faturamento (projeção mês)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {fuelRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-gray-400">Sem dados de frentistas no período.</td>
                </tr>
              ) : (
                fuelRows.map((r, idx) => (
                  <tr key={r.codigo} className={idx % 2 === 1 ? 'bg-gray-50/70 dark:bg-gray-800/30' : undefined}>
                    <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100">{r.nome}</td>
                    <td className="px-4 py-2.5 text-right text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">{formatLiters(r.litros)}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(r.faturamento)}</td>
                    <td className="border-l border-gray-200 px-4 py-2.5 text-right text-sm font-semibold tabular-nums text-blue-600 dark:border-gray-700 dark:text-blue-400">{formatLiters(r.litrosProjetado)}</td>
                    <td className="px-4 py-2.5 text-right text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400">{formatCurrency(r.faturamentoProjetado)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {fuelRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-200">
                  <td className="px-4 py-2.5">Total</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatLiters(fuelTotals.litros)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(fuelTotals.faturamento)}</td>
                  <td className="border-l border-gray-200 px-4 py-2.5 text-right tabular-nums dark:border-gray-700">{formatLiters(fuelTotals.litrosProjetado)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(fuelTotals.faturamentoProjetado)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Tabela Produtos / loja */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <ShoppingBag className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Produtos (loja) — por vendedor</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Vendedor</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Faturamento (realizado)</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Lucro bruto (realizado)</th>
                <th className="border-l border-gray-200 px-4 py-2 text-right text-xs font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">Faturamento (projeção mês)</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Lucro bruto (projeção mês)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loadingVendedores ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-gray-400">Carregando vendas da loja…</td>
                </tr>
              ) : lojaRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-gray-400">Sem vendas de loja apuradas no período.</td>
                </tr>
              ) : (
                lojaRows.map((r, idx) => (
                  <tr key={r.codigo} className={idx % 2 === 1 ? 'bg-gray-50/70 dark:bg-gray-800/30' : undefined}>
                    <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100">{r.nome}</td>
                    <td className="px-4 py-2.5 text-right text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(r.faturamento)}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(r.lucroBruto)}</td>
                    <td className="border-l border-gray-200 px-4 py-2.5 text-right text-sm font-semibold tabular-nums text-emerald-600 dark:border-gray-700 dark:text-emerald-400">{formatCurrency(r.faturamentoProjetado)}</td>
                    <td className="px-4 py-2.5 text-right text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(r.lucroProjetado)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {lojaRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-200">
                  <td className="px-4 py-2.5">Total</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(lojaTotals.faturamento)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(lojaTotals.lucroBruto)}</td>
                  <td className="border-l border-gray-200 px-4 py-2.5 text-right tabular-nums dark:border-gray-700">{formatCurrency(lojaTotals.faturamentoProjetado)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(lojaTotals.lucroProjetado)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}

export default Projecoes
