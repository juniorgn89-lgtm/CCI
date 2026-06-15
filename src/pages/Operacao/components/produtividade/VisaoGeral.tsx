import { useMemo, useState } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatLiters, formatNumber } from '@/lib/formatters'
import BarCell from '@/components/tables/BarCell'
import FrentistaDetalheModal from '@/pages/Operacao/components/produtividade/FrentistaDetalheModal'
import type { AbastecimentoRow } from '@/pages/Operacao/hooks/useOperacaoData'
import type { AbastecimentoRow as AbastecimentoComCusto } from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'

interface Props {
  /** Abastecimentos crus do período — pro modal de detalhe por produto. */
  abastecimentos: AbastecimentoRow[]
  /** Linhas com custo/lucro (analytics) — alimentam o Lucro bruto por dia. */
  abastComCusto?: AbastecimentoComCusto[]
}

type SortKey =
  | 'nome'
  | 'score'
  | 'litros'
  | 'automotivo'
  | 'mixAditivada'
  | 'abastecimentos'
  | 'faturamento'
  | 'lucroBruto'
  | 'ticketMedio'
  | 'ticketMedioAutomotivo'
  | 'variacao'
  | 'progresso'
type SortDir = 'asc' | 'desc'

type PrimarySort = 'abastecimentos' | 'litros' | 'faturamento' | 'lucro'

const PRIMARY_OPTIONS: { key: PrimarySort; label: string }[] = [
  { key: 'abastecimentos', label: 'Abastec.' },
  { key: 'litros', label: 'Litros' },
  { key: 'faturamento', label: 'Faturamento' },
  { key: 'lucro', label: 'Lucro bruto' },
]

const PRIMARY_TO_SORT_KEY: Record<PrimarySort, SortKey> = {
  abastecimentos: 'abastecimentos',
  litros: 'litros',
  faturamento: 'faturamento',
  lucro: 'lucroBruto',
}


// ── Day-grouped helpers (tabela em seções por dia, igual ao webPosto) ──
const upper = (s: string) => (s ?? '').toUpperCase()
const isAutomotivo = (n: string): boolean => {
  const u = upper(n)
  return u.includes('GASOLINA') || u.includes('ETANOL') || u.includes('ALCOOL') || u.includes('ÁLCOOL') ||
    u.includes('DIESEL') || u.includes('S-10') || u.includes('S10') || u.includes('S500')
}
const isGasolina = (n: string) => upper(n).includes('GASOLINA')
const isAditivada = (n: string) => upper(n).includes('ADITIVADA')

/** 'yyyy-MM-dd' → 'dd/MM/yyyy'. */
const formatDia = (iso: string): string => {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}

interface DiaFrentistaRow {
  codigo: number
  nome: string
  litros: number
  automotivo: number
  mixAditivadaPct: number
  abastecimentos: number
  faturamento: number
  lucroBruto: number | null
  ticketMedio: number
  ticketMedioAutomotivo: number
}

const compareDiaRow = (a: DiaFrentistaRow, b: DiaFrentistaRow, key: SortKey, dir: SortDir): number => {
  let av: number | string = 0
  let bv: number | string = 0
  switch (key) {
    case 'nome': av = a.nome; bv = b.nome; break
    case 'litros': av = a.litros; bv = b.litros; break
    case 'automotivo': av = a.automotivo; bv = b.automotivo; break
    case 'mixAditivada': av = a.mixAditivadaPct; bv = b.mixAditivadaPct; break
    case 'abastecimentos': av = a.abastecimentos; bv = b.abastecimentos; break
    case 'faturamento': av = a.faturamento; bv = b.faturamento; break
    case 'lucroBruto': av = a.lucroBruto ?? -Infinity; bv = b.lucroBruto ?? -Infinity; break
    case 'ticketMedio': av = a.ticketMedio; bv = b.ticketMedio; break
    case 'ticketMedioAutomotivo': av = a.ticketMedioAutomotivo; bv = b.ticketMedioAutomotivo; break
    default: av = a.abastecimentos; bv = b.abastecimentos
  }
  if (typeof av === 'string' && typeof bv === 'string') {
    return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
  }
  return dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
}

const VisaoGeral = ({ abastecimentos, abastComCusto }: Props) => {
  const [primarySort, setPrimarySort] = useState<PrimarySort>('abastecimentos')
  const [sortKey, setSortKey] = useState<SortKey>('abastecimentos')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  // Frentista aberto no modal de detalhe por produto.
  const [modalFrentista, setModalFrentista] = useState<{ codigo: number; nome: string } | null>(null)

  // Atualizar ordenação primária reflete na chave de ordenação interna
  const handlePrimarySort = (key: PrimarySort) => {
    setPrimarySort(key)
    setSortKey(PRIMARY_TO_SORT_KEY[key])
    setSortDir('desc')
  }

  // Linhas por (dia × frentista), agrupadas em seções por dia (igual ao
  // relatório de Abastecimento do webPosto). Base (litros/fat/abast/automotivo/
  // mix/tickets) vem das linhas da operação; o Lucro bruto vem do analytics
  // (que tem custo) — "—" enquanto o custo carrega. Agrupa pela data do
  // abastecimento (dataHora), como o webPosto faz na exibição.
  const dias = useMemo(() => {
    const lucroHasData = (abastComCusto?.length ?? 0) > 0
    const lucroMap = new Map<string, number>()
    for (const r of abastComCusto ?? []) {
      if (r.precoCusto <= 0) continue
      const key = `${(r.dataHora || '').slice(0, 10)}|${r.frentistaCodigo}`
      lucroMap.set(key, (lucroMap.get(key) ?? 0) + r.lucroBruto)
    }

    interface Acc {
      codigo: number; nome: string
      litros: number; automotivo: number; gasolina: number; aditivada: number
      abast: number; fat: number; fatAuto: number; abastAuto: number
    }
    const perDay = new Map<string, Map<number, Acc>>()
    for (const a of abastecimentos) {
      const dia = (a.dataHora || '').slice(0, 10)
      if (dia.length !== 10) continue
      const m = perDay.get(dia) ?? new Map<number, Acc>()
      const acc = m.get(a.frentistaCodigo) ?? {
        codigo: a.frentistaCodigo, nome: a.frentistaNome,
        litros: 0, automotivo: 0, gasolina: 0, aditivada: 0, abast: 0, fat: 0, fatAuto: 0, abastAuto: 0,
      }
      const auto = isAutomotivo(a.produtoNome)
      acc.litros += a.litros
      acc.abast += 1
      acc.fat += a.valorTotal
      if (auto) { acc.automotivo += a.litros; acc.fatAuto += a.valorTotal; acc.abastAuto += 1 }
      if (isGasolina(a.produtoNome)) { acc.gasolina += a.litros; if (isAditivada(a.produtoNome)) acc.aditivada += a.litros }
      m.set(a.frentistaCodigo, acc)
      perDay.set(dia, m)
    }

    return Array.from(perDay.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dia, m]) => {
        const accs = Array.from(m.values())
        const linhas: DiaFrentistaRow[] = accs.map((acc) => ({
          codigo: acc.codigo,
          nome: acc.nome,
          litros: acc.litros,
          automotivo: acc.automotivo,
          mixAditivadaPct: acc.gasolina > 0 ? (acc.aditivada / acc.gasolina) * 100 : 0,
          abastecimentos: acc.abast,
          faturamento: acc.fat,
          lucroBruto: lucroHasData ? (lucroMap.get(`${dia}|${acc.codigo}`) ?? 0) : null,
          ticketMedio: acc.abast > 0 ? acc.fat / acc.abast : 0,
          ticketMedioAutomotivo: acc.abastAuto > 0 ? acc.fatAuto / acc.abastAuto : 0,
        }))
        linhas.sort((a, b) => compareDiaRow(a, b, sortKey, sortDir))

        const totGas = accs.reduce((s, a) => s + a.gasolina, 0)
        const totAdit = accs.reduce((s, a) => s + a.aditivada, 0)
        const totFatAuto = accs.reduce((s, a) => s + a.fatAuto, 0)
        const totAbastAuto = accs.reduce((s, a) => s + a.abastAuto, 0)
        const totAbast = linhas.reduce((s, l) => s + l.abastecimentos, 0)
        const totFat = linhas.reduce((s, l) => s + l.faturamento, 0)
        const subtotal: DiaFrentistaRow = {
          codigo: -1,
          nome: `Subtotal ${formatDia(dia)}`,
          litros: linhas.reduce((s, l) => s + l.litros, 0),
          automotivo: linhas.reduce((s, l) => s + l.automotivo, 0),
          mixAditivadaPct: totGas > 0 ? (totAdit / totGas) * 100 : 0,
          abastecimentos: totAbast,
          faturamento: totFat,
          lucroBruto: lucroHasData ? linhas.reduce((s, l) => s + (l.lucroBruto ?? 0), 0) : null,
          ticketMedio: totAbast > 0 ? totFat / totAbast : 0,
          ticketMedioAutomotivo: totAbastAuto > 0 ? totFatAuto / totAbastAuto : 0,
        }
        return { dia, linhas, subtotal }
      })
  }, [abastecimentos, abastComCusto, sortKey, sortDir])

  // Máximos por coluna pra escala das barras (data bars) — sobre todas as linhas.
  const colMax = useMemo(() => {
    const all = dias.flatMap((d) => d.linhas)
    return {
      litros: Math.max(...all.map((f) => f.litros), 0),
      automotivo: Math.max(...all.map((f) => f.automotivo), 0),
      abastecimentos: Math.max(...all.map((f) => f.abastecimentos), 0),
      faturamento: Math.max(...all.map((f) => f.faturamento), 0),
      lucroBruto: Math.max(...all.map((f) => f.lucroBruto ?? 0), 0),
      ticketMedio: Math.max(...all.map((f) => f.ticketMedio), 0),
      ticketAut: Math.max(...all.map((f) => f.ticketMedioAutomotivo), 0),
    }
  }, [dias])

  const handleColumnSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'nome' ? 'asc' : 'desc')
    }
  }

  return (
    <div className="space-y-5">
      {/* Tabela comparativa */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Comparativo de Frentistas
              </h3>
              {/* "?" — clique numa linha abre o detalhe por produto do frentista */}
              <span className="group/help relative inline-flex cursor-help" tabIndex={0} aria-label="Como usar">
                <HelpCircle className="h-3.5 w-3.5 text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200" />
                <span className="pointer-events-none absolute left-0 top-full z-50 mt-2 w-72 rounded-md bg-gray-900 px-3 py-2 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-white opacity-0 shadow-lg transition-opacity group-hover/help:opacity-100 group-focus/help:opacity-100 dark:bg-gray-800">
                  Clique num frentista pra ver o detalhe por produto (litros, preço médio, faturamento e nº de abastecimentos).
                </span>
              </span>
            </div>
            <p className="mt-0.5 text-xs italic text-gray-400">
              Comparação de desempenho entre frentistas · clique pra detalhar por produto
            </p>
          </div>
          <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
            {PRIMARY_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => handlePrimarySort(opt.key)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  primarySort === opt.key
                    ? 'bg-[#1e3a5f] text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              {/* Linha de grupos — agrupa as colunas por tema */}
              <tr>
                <th colSpan={2} className="bg-gray-100/60 px-4 py-1.5 dark:bg-gray-800/60" />
                <GroupTh first label="Operação" colSpan={4} />
                <GroupTh label="Financeiro" colSpan={2} />
                <GroupTh label="Eficiência" colSpan={2} />
              </tr>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <Th className="w-10">#</Th>
                <ThSort label="Frentista" k="nome" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('nome')} align="left" />
                <ThSort label="Litros" k="litros" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('litros')} />
                <ThSort label="Automotivo" k="automotivo" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('automotivo')} />
                <ThSort label="Mix aditiv." k="mixAditivada" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('mixAditivada')} />
                <ThSort label="Abastec." k="abastecimentos" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('abastecimentos')} />
                <ThSort label="Faturamento" k="faturamento" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('faturamento')} groupStart />
                <ThSort label="Lucro bruto" k="lucroBruto" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('lucroBruto')} />
                <ThSort label="Ticket méd." k="ticketMedio" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('ticketMedio')} groupStart />
                <ThSort label="Ticket aut." k="ticketMedioAutomotivo" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('ticketMedioAutomotivo')} />
              </tr>
            </thead>
            {dias.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={10} className="py-8 text-center text-sm text-gray-400">
                    Sem dados de frentistas no período.
                  </td>
                </tr>
              </tbody>
            ) : (
              dias.map((d) => (
                <tbody key={d.dia} className="divide-y divide-gray-100 dark:divide-gray-800">
                  {/* Cabeçalho de dia (igual ao bloco de data do webPosto) */}
                  <tr className="bg-gray-100/70 dark:bg-gray-800/60">
                    <td colSpan={10} className="px-4 py-1.5 text-xs font-semibold tabular-nums text-gray-600 dark:text-gray-300">
                      {formatDia(d.dia)}
                    </td>
                  </tr>
                  {d.linhas.map((f, idx) => (
                    <tr
                      key={`${d.dia}-${f.codigo}`}
                      onClick={() => setModalFrentista({ codigo: f.codigo, nome: f.nome })}
                      title="Ver detalhe por produto"
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40',
                        idx % 2 === 1 && 'bg-gray-50/70 dark:bg-gray-800/30',
                      )}
                    >
                      <td className="px-4 py-2.5 text-xs tabular-nums text-gray-400">{idx + 1}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100">{f.nome}</td>
                      <td className="px-2 py-2.5">
                        <BarCell value={f.litros} max={colMax.litros} formatted={formatLiters(f.litros)} color="blue" align="near" />
                      </td>
                      <td className="px-2 py-2.5">
                        <BarCell value={f.automotivo} max={colMax.automotivo} formatted={formatLiters(f.automotivo)} color="blue" align="near" />
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-gray-500">
                        {f.mixAditivadaPct > 0 ? `${f.mixAditivadaPct.toFixed(0).replace('.', ',')}%` : '—'}
                      </td>
                      <td className="px-2 py-2.5">
                        <BarCell value={f.abastecimentos} max={colMax.abastecimentos} formatted={formatNumber(f.abastecimentos)} color="blue" align="near" />
                      </td>
                      <td className="border-l border-gray-200 px-2 py-2.5 dark:border-gray-700">
                        <BarCell value={f.faturamento} max={colMax.faturamento} formatted={formatCurrency(f.faturamento)} color="green" align="near" />
                      </td>
                      <td className="px-2 py-2.5">
                        {f.lucroBruto === null
                          ? <div className="text-right text-sm text-gray-400">—</div>
                          : <BarCell value={f.lucroBruto} max={colMax.lucroBruto} formatted={formatCurrency(f.lucroBruto)} color="green" align="near" />}
                      </td>
                      <td className="border-l border-gray-200 px-2 py-2.5 dark:border-gray-700">
                        <BarCell value={f.ticketMedio} max={colMax.ticketMedio} formatted={formatCurrency(f.ticketMedio)} color="amber" align="near" />
                      </td>
                      <td className="px-2 py-2.5">
                        {f.ticketMedioAutomotivo > 0
                          ? <BarCell value={f.ticketMedioAutomotivo} max={colMax.ticketAut} formatted={formatCurrency(f.ticketMedioAutomotivo)} color="amber" align="near" />
                          : <div className="text-right text-sm text-gray-400">—</div>}
                      </td>
                    </tr>
                  ))}
                  {/* Subtotal do dia — só quando há mais de um frentista no dia. */}
                  {d.linhas.length > 1 && (
                    <tr className="bg-gray-50/80 text-xs font-semibold text-gray-600 dark:bg-gray-800/40 dark:text-gray-300">
                      <td className="px-4 py-2" />
                      <td className="px-4 py-2">{d.subtotal.nome}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatLiters(d.subtotal.litros)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatLiters(d.subtotal.automotivo)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{d.subtotal.mixAditivadaPct > 0 ? `${d.subtotal.mixAditivadaPct.toFixed(0)}%` : '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatNumber(d.subtotal.abastecimentos)}</td>
                      <td className="border-l border-gray-200 px-4 py-2 text-right tabular-nums dark:border-gray-700">{formatCurrency(d.subtotal.faturamento)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{d.subtotal.lucroBruto === null ? '—' : formatCurrency(d.subtotal.lucroBruto)}</td>
                      <td className="border-l border-gray-200 px-4 py-2 text-right tabular-nums dark:border-gray-700">{formatCurrency(d.subtotal.ticketMedio)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{d.subtotal.ticketMedioAutomotivo > 0 ? formatCurrency(d.subtotal.ticketMedioAutomotivo) : '—'}</td>
                    </tr>
                  )}
                </tbody>
              ))
            )}
          </table>
        </div>
      </div>

      <FrentistaDetalheModal
        open={modalFrentista !== null}
        onClose={() => setModalFrentista(null)}
        nome={modalFrentista?.nome ?? ''}
        codigo={modalFrentista?.codigo ?? -1}
        abastecimentos={abastecimentos}
      />
    </div>
  )
}

interface ThProps {
  children: React.ReactNode
  className?: string
}

const Th = ({ children, className }: ThProps) => (
  <th className={cn('px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400', className)}>
    {children}
  </th>
)

const GroupTh = ({ label, colSpan, first }: { label: string; colSpan: number; first?: boolean }) => (
  <th
    colSpan={colSpan}
    className={cn('bg-gray-100/60 px-4 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:bg-gray-800/60 dark:text-gray-500', !first && 'border-l border-gray-200 dark:border-gray-700')}
  >
    {label}
  </th>
)

interface ThSortProps {
  label: string
  k: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onClick: () => void
  align?: 'left' | 'right' | 'center'
  width?: string
  /** Marca o início de um grupo de colunas — desenha um divisor vertical sutil. */
  groupStart?: boolean
}

const ThSort = ({ label, k, sortKey, sortDir, onClick, align = 'right', width, groupStart }: ThSortProps) => {
  const isActive = sortKey === k
  return (
    <th className={cn(
      'whitespace-nowrap px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400',
      align === 'left' ? 'text-left' : align === 'center' ? 'text-center' : 'text-right',
      groupStart && 'border-l border-gray-200 dark:border-gray-700',
      width
    )}>
      <button
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1 transition-colors hover:text-gray-700 dark:hover:text-gray-200',
          isActive && 'text-gray-900 dark:text-gray-100'
        )}
      >
        {label}
        {isActive ? (
          sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </button>
    </th>
  )
}

export default VisaoGeral
