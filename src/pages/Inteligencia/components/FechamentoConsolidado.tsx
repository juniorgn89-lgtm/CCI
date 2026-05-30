import { useMemo, useState } from 'react'
import { Wallet, HandCoins, Scale, ClipboardCheck, ArrowUpRight, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt } from '@/lib/formatters'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import BarCell from '@/components/tables/BarCell'
import DiferencaEncerrantes from '@/pages/FechamentoCaixa/components/DiferencaEncerrantes'
import { useFilterStore } from '@/store/filters'
import type { PostoData } from '@/pages/Inteligencia/hooks/useNetworkData'

const brDate = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '—')

interface FechamentoConsolidadoProps {
  postos: PostoData[]
}

interface PostoFechamento {
  empresaCodigo: number
  nome: string
  vendas: number
  sangria: number
  sobras: number
  faltas: number
  diferenca: number
  encerrantesDif: number
  caixasFechados: number
}

interface FuncionarioDiferenca {
  nome: string
  posto: string
  sobras: number
  faltas: number
  diferenca: number
}

// Mock — deriva valores por posto a partir da receita (escala) + variação
// determinística por empresaCodigo (mod) pra dar números diferentes.
const buildMock = (postos: PostoData[]): PostoFechamento[] =>
  postos.map((p, i) => {
    const baseVendas = Math.max(50_000, p.receita / 30) // ~1 dia
    const variacao = ((p.empresaCodigo % 7) + 3) / 10 // 0.3 - 1.0
    const vendas = baseVendas * variacao
    const sangria = vendas * (0.06 + (p.empresaCodigo % 5) * 0.01)
    const sobras = (p.empresaCodigo % 4) * 12.5 + 3.6
    const faltas = -((p.empresaCodigo % 9) * 9.8 + 1.2)
    const diferenca = sobras + faltas
    const encerrantesDif = ((i % 3) - 1) * 5.4 // -5.4 / 0 / 5.4
    const caixasFechados = 2 + (p.empresaCodigo % 3)
    return {
      empresaCodigo: p.empresaCodigo,
      nome: p.fantasia || p.nome,
      vendas,
      sangria,
      sobras,
      faltas,
      diferenca,
      encerrantesDif,
      caixasFechados,
    }
  })

// Mock — top funcionários da rede com maior |diferença| acumulada.
const mockFuncionarios: FuncionarioDiferenca[] = [
  { nome: 'JEAN REIS',                posto: 'POSTO ITAPOA',  sobras: 2.08, faltas: -74.16, diferenca: -72.08 },
  { nome: 'MARCOS BATISTA',           posto: 'POSTO DIVINO',  sobras: 0,    faltas: -58.40, diferenca: -58.40 },
  { nome: 'PAULO HENRIQUE SILVA',     posto: 'POSTO DARWIN',  sobras: 1.16, faltas: -42.80, diferenca: -41.64 },
  { nome: 'CRISTIELE MAURICIO ALVES', posto: 'POSTO ITAPOA',  sobras: 3.64, faltas: 0,      diferenca: 3.64 },
  { nome: 'RENATA OLIVEIRA',          posto: 'POSTO ITAPOA',  sobras: 5.20, faltas: -1.10,  diferenca: 4.10 },
  { nome: 'FERNANDO COSTA',           posto: 'POSTO DIVINO',  sobras: 0,    faltas: -28.00, diferenca: -28.00 },
  { nome: 'LUCAS PEREIRA',            posto: 'POSTO DARWIN',  sobras: 8.40, faltas: 0,      diferenca: 8.40 },
  { nome: 'ANA BEATRIZ SOUZA',        posto: 'POSTO DIVINO',  sobras: 0,    faltas: -19.30, diferenca: -19.30 },
]

const FechamentoConsolidado = ({ postos }: FechamentoConsolidadoProps) => {
  const { dataInicial, dataFinal } = useFilterStore()
  const [selectedPosto, setSelectedPosto] = useState<PostoFechamento | null>(null)
  const periodoLabel = `Data Inicial: ${brDate(dataInicial)} · Data Final: ${brDate(dataFinal)}`

  const dados = useMemo(() => buildMock(postos), [postos])

  const totals = useMemo(() => {
    return dados.reduce(
      (acc, p) => ({
        vendas: acc.vendas + p.vendas,
        sangria: acc.sangria + p.sangria,
        diferenca: acc.diferenca + p.diferenca,
        caixas: acc.caixas + p.caixasFechados,
      }),
      { vendas: 0, sangria: 0, diferenca: 0, caixas: 0 },
    )
  }, [dados])

  // Ranking ordenado pela diferença (pior primeiro — mais negativa em cima).
  const ranking = useMemo(
    () => [...dados].sort((a, b) => a.diferenca - b.diferenca),
    [dados],
  )

  const topFuncionarios = useMemo(
    () => [...mockFuncionarios].sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca)).slice(0, 8),
    [],
  )

  const maxVendas = ranking.reduce((m, p) => Math.max(m, p.vendas), 0)
  const maxSangria = ranking.reduce((m, p) => Math.max(m, p.sangria), 0)
  const maxDifAbs = ranking.reduce((m, p) => Math.max(m, Math.abs(p.diferenca)), 0)

  if (postos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-900">
        <Wallet className="mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          Sem dados de fechamento no período.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* KPI strip da rede */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Total vendas"
          value={formatCurrencyInt(totals.vendas)}
          subtitle={`${dados.length} ${dados.length === 1 ? 'posto' : 'postos'}`}
          Icon={Wallet}
          chipClass="bg-blue-100 dark:bg-blue-900/30"
          iconClass="text-blue-600 dark:text-blue-400"
        />
        <KpiCard
          label="Total sangria"
          value={formatCurrencyInt(totals.sangria)}
          subtitle="Saída de dinheiro"
          Icon={HandCoins}
          chipClass="bg-amber-100 dark:bg-amber-900/30"
          iconClass="text-amber-600 dark:text-amber-400"
        />
        <KpiCard
          label="Diferença líquida"
          value={formatCurrency(totals.diferenca)}
          subtitle="Sobras − faltas"
          Icon={Scale}
          chipClass={totals.diferenca < 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}
          iconClass={totals.diferenca < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}
          valueClass={totals.diferenca < 0 ? 'text-red-700 dark:text-red-400' : undefined}
        />
        <KpiCard
          label="Caixas fechados"
          value={String(totals.caixas)}
          subtitle="Total no período"
          Icon={ClipboardCheck}
          chipClass="bg-purple-100 dark:bg-purple-900/30"
          iconClass="text-purple-600 dark:text-purple-400"
        />
      </div>

      {/* Ranking por posto */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Ranking por Posto
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Ordenado pela diferença (pior primeiro)
            </p>
          </div>
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            Clique num posto pra ver a diferença de encerrantes
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                <th className="px-4 py-2 text-left">Posto</th>
                <th className="px-4 py-2 text-right">Vendas</th>
                <th className="px-4 py-2 text-right">Sangria</th>
                <th className="px-4 py-2 text-right">Sobras</th>
                <th className="px-4 py-2 text-right">Faltas</th>
                <th className="px-4 py-2 text-right">Diferença</th>
                <th className="px-4 py-2 text-right">Encerrantes (Lt)</th>
                <th className="px-4 py-2 text-right">Caixas</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((p) => (
                <tr
                  key={p.empresaCodigo}
                  onClick={() => setSelectedPosto(p)}
                  className="cursor-pointer border-b border-gray-100 text-gray-800 transition-colors last:border-b-0 hover:bg-blue-50/60 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-blue-900/20"
                >
                  <td className="px-4 py-2 text-left font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {p.nome}
                      <ArrowUpRight className="h-3 w-3 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <BarCell value={p.vendas} max={maxVendas} formatted={formatCurrencyInt(p.vendas)} color="blue" align="near" />
                  </td>
                  <td className="px-2 py-1.5">
                    <BarCell value={p.sangria} max={maxSangria} formatted={formatCurrencyInt(p.sangria)} color="blue" align="near" />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                    {p.sobras > 0 ? formatCurrency(p.sobras) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-red-600 dark:text-red-400">
                    {p.faltas < 0 ? formatCurrency(p.faltas) : '—'}
                  </td>
                  <td className="px-2 py-1.5">
                    <BarCell
                      value={Math.abs(p.diferenca)}
                      max={maxDifAbs}
                      formatted={formatCurrency(p.diferenca)}
                      color={p.diferenca < 0 ? 'red' : 'green'}
                      align="near"
                    />
                  </td>
                  <td
                    className={cn(
                      'px-4 py-2 text-right tabular-nums',
                      p.encerrantesDif < 0 ? 'text-red-600 dark:text-red-400' : p.encerrantesDif > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-400',
                    )}
                  >
                    {p.encerrantesDif === 0 ? '0,00' : p.encerrantesDif.toFixed(2).replace('.', ',')}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{p.caixasFechados}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top funcionários com diferença */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-2 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Funcionários com maior diferença
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Top {topFuncionarios.length} da rede no período — bom ponto pra investigação
            </p>
          </div>
        </div>
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {topFuncionarios.map((f, i) => (
            <li key={f.nome} className="flex items-center justify-between gap-3 px-6 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold tabular-nums text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    {f.nome}
                  </p>
                  <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                    {f.posto}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs tabular-nums shrink-0">
                {f.sobras > 0 && (
                  <span className="text-emerald-700 dark:text-emerald-400">
                    +{formatCurrency(f.sobras)}
                  </span>
                )}
                {f.faltas < 0 && (
                  <span className="text-red-600 dark:text-red-400">
                    {formatCurrency(f.faltas)}
                  </span>
                )}
                <span
                  className={cn(
                    'min-w-[80px] rounded-md px-2 py-0.5 text-right text-xs font-semibold',
                    f.diferenca < 0
                      ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                  )}
                >
                  {formatCurrency(f.diferenca)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Detalhe de encerrantes do posto clicado */}
      <Dialog open={selectedPosto !== null} onOpenChange={(o) => { if (!o) setSelectedPosto(null) }}>
        <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-3xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Fechamento detalhado — {selectedPosto?.nome ?? ''}</DialogTitle>
            <DialogDescription>
              Conferência de encerrante × venda (litros) por combustível no período.
            </DialogDescription>
          </DialogHeader>
          {selectedPosto && (
            <div className="-mx-6 flex-1 overflow-auto px-6">
              <DiferencaEncerrantes
                fator={(selectedPosto.empresaCodigo % 7) + 3}
                empresaNome={selectedPosto.nome}
                empresaCnpj=""
                diferencaLt={selectedPosto.encerrantesDif}
                periodoLabel={periodoLabel}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface KpiCardProps {
  label: string
  value: string
  subtitle: string
  Icon: typeof Wallet
  chipClass: string
  iconClass: string
  valueClass?: string
}

const KpiCard = ({ label, value, subtitle, Icon, chipClass, iconClass, valueClass }: KpiCardProps) => (
  <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="flex items-start justify-between gap-2">
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{label}</p>
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', chipClass)}>
        <Icon className={cn('h-4 w-4', iconClass)} />
      </div>
    </div>
    <p className={cn('mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100', valueClass)}>
      {value}
    </p>
    <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{subtitle}</p>
  </div>
)

export default FechamentoConsolidado
