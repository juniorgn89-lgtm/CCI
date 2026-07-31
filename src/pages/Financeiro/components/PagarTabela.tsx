import { Fragment, useCallback, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  FileText, Landmark, Smartphone, ArrowLeftRight, Building2, MoreHorizontal, Layers,
  Search, Download, Eye, ChevronLeft, ChevronRight, MousePointerClick, X, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import ShareReportButton from '@/components/feedback/ShareReportButton'
import { escopoLabel, periodoLabel, type ReportPayload } from '@/lib/report/reportTypes'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import type { PayableRow, LocalPeriodFilter } from '@/pages/Financeiro/hooks/useFinanceData'
import usePlanoContasMap from '@/pages/Financeiro/hooks/usePlanoContasMap'
import useScopedEmpresaCodes from '@/pages/Financeiro/hooks/useScopedEmpresaCodes'
import { buildPagarRows, gridColsCards, type InstPagar, type PagarRow } from '@/pages/Financeiro/lib/instrumentos'

const todayISO = () => new Date().toISOString().split('T')[0]
const addDaysISO = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}
const onlyDate = (s: string) => (s ?? '').split('T')[0]
const brDate = (iso: string) => (iso ? onlyDate(iso).split('-').reverse().join('/') : '—')
const endOfWeekISO = (iso: string) => addDaysISO(iso, (7 - new Date(`${iso}T00:00:00`).getDay()) % 7)
const endOfMonthISO = (iso: string) => {
  const [y, m] = iso.split('-').map(Number)
  return `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}

const PAGE_SIZE = 12
type FiltroInst = 'todos' | InstPagar
type Periodo = 'todos' | 'hoje' | 'semana' | 'mes' | 'atrasados'
const PERIODOS: { id: Periodo; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'hoje', label: 'Hoje' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mês' },
  { id: 'atrasados', label: 'Atrasados' },
]

const INSTR: { id: InstPagar; label: string; Icon: typeof FileText; badge: string }[] = [
  { id: 'boleto', label: 'Boleto', Icon: FileText, badge: 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300' },
  { id: 'tributo', label: 'Tributo', Icon: Landmark, badge: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300' },
  { id: 'pix', label: 'PIX', Icon: Smartphone, badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' },
  { id: 'transferencia', label: 'Transferência', Icon: ArrowLeftRight, badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300' },
  { id: 'convenio', label: 'Convênio', Icon: Building2, badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' },
  { id: 'outros', label: 'Outros', Icon: MoreHorizontal, badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
]
const instMeta = (id: InstPagar) => INSTR.find((i) => i.id === id)!

interface Props {
  payables: PayableRow[]
  dateFilter?: ReactNode
  /** Período local — só pro rótulo do PDF de compartilhamento. */
  periodoLocal?: LocalPeriodFilter
}

/**
 * Contas a Pagar por INSTRUMENTO (Boleto · Tributo · PIX · Transferência ·
 * Convênio · Outros, pelo tipoLancamento do /TITULO_PAGAR). Cards de instrumento
 * (passo 1) + período (passo 2) filtram uma tabela única, com Posto, fornecedor
 * multi, ordenação, faixa de atraso, paginação e export. READ-ONLY.
 */
const PagarTabela = ({ payables, dateFilter, periodoLocal }: Props) => {
  const scopedCodes = useScopedEmpresaCodes()
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas({ limite: 200 }), staleTime: 30 * 60 * 1000 })
  const empresaNome = useMemo(
    () => new Map((empresasData?.resultados ?? []).map((e) => [e.empresaCodigo, e.fantasia || e.razao || `Posto ${e.empresaCodigo}`])),
    [empresasData],
  )
  const nomePosto = (cod: number) => empresaNome.get(cod) ?? `Posto ${cod}`

  const planoMap = usePlanoContasMap()
  const planoNome = useCallback((cod: number) => planoMap.get(cod) || 'Sem plano', [planoMap])

  const [inst, setInst] = useState<FiltroInst>('todos')
  const [periodo, setPeriodo] = useState<Periodo>('todos')
  const [fornSel, setFornSel] = useState<string[]>([])
  const [buscaForn, setBuscaForn] = useState('')
  const [abertoForn, setAbertoForn] = useState(false)
  const [planoSel, setPlanoSel] = useState<string[]>([])
  const [buscaPlano, setBuscaPlano] = useState('')
  const [abertoPlano, setAbertoPlano] = useState(false)
  const [ordenar, setOrdenar] = useState<'vencimento' | 'maiorValor' | 'menorValor' | 'maiorAtraso' | 'fornecedor' | 'posto'>('vencimento')
  const [atrasoFaixa, setAtrasoFaixa] = useState<'todos' | '30' | '60' | '90' | '90+'>('todos')
  const [page, setPage] = useState(0)
  const [detalhe, setDetalhe] = useState<string | null>(null)

  // Linhas de pagáveis em aberto (fonte única — bate com o dashboard).
  const rows: PagarRow[] = useMemo(() => buildPagarRows(payables), [payables])

  const escopo = useMemo(() => {
    const hoje = todayISO()
    const eow = endOfWeekISO(hoje)
    const eom = endOfMonthISO(hoje)
    let base = rows.filter((r) => {
      if (periodo === 'todos') return true
      if (periodo === 'atrasados') return r.vencido
      if (r.vencido) return false
      const v = r.vencimento
      if (periodo === 'hoje') return v === hoje
      if (periodo === 'semana') return v >= hoje && v <= eow
      return v >= hoje && v <= eom
    })
    if (fornSel.length > 0) base = base.filter((r) => fornSel.includes(r.fornecedor))
    if (planoSel.length > 0) base = base.filter((r) => planoSel.includes(planoNome(r.planoContaCod)))
    return base
  }, [rows, periodo, fornSel, planoSel, planoNome])

  const cards = useMemo(() => {
    const acc: Record<FiltroInst, { total: number; count: number }> = {
      todos: { total: 0, count: 0 }, boleto: { total: 0, count: 0 }, tributo: { total: 0, count: 0 },
      pix: { total: 0, count: 0 }, transferencia: { total: 0, count: 0 }, convenio: { total: 0, count: 0 }, outros: { total: 0, count: 0 },
    }
    for (const r of escopo) {
      acc.todos.total += r.valor; acc.todos.count += 1
      acc[r.instrumento].total += r.valor; acc[r.instrumento].count += 1
    }
    return acc
  }, [escopo])

  // Cards visíveis — esconde os zerados (menos ruído). Mantém sempre "Todos" e o
  // card ativo, pra a seleção não sumir ao trocar o período.
  const visibleCards = useMemo(
    () => [{ id: 'todos' as const, label: 'Todos', Icon: Layers }, ...INSTR]
      .filter(({ id }) => id === 'todos' || id === inst || cards[id].count > 0),
    [cards, inst],
  )

  // Contagem de títulos por período (respeita instrumento + fornecedor, NÃO o
  // período — é o número que cada pill mostraria ao ser clicado).
  const periodoCounts = useMemo(() => {
    const hoje = todayISO()
    const eow = endOfWeekISO(hoje)
    const eom = endOfMonthISO(hoje)
    let base = rows
    if (fornSel.length > 0) base = base.filter((r) => fornSel.includes(r.fornecedor))
    if (planoSel.length > 0) base = base.filter((r) => planoSel.includes(planoNome(r.planoContaCod)))
    if (inst !== 'todos') base = base.filter((r) => r.instrumento === inst)
    const c: Record<Periodo, number> = { todos: 0, hoje: 0, semana: 0, mes: 0, atrasados: 0 }
    for (const r of base) {
      c.todos += 1
      if (r.vencido) { c.atrasados += 1; continue }
      const v = r.vencimento
      if (v === hoje) c.hoje += 1
      if (v >= hoje && v <= eow) c.semana += 1
      if (v >= hoje && v <= eom) c.mes += 1
    }
    return c
  }, [rows, fornSel, planoSel, planoNome, inst])

  const fornecedores = useMemo(
    () => [...new Set(rows.map((r) => r.fornecedor))].sort((a, b) => a.localeCompare(b)),
    [rows],
  )
  const fornFiltrados = useMemo(() => {
    const q = buscaForn.trim().toLowerCase()
    return q ? fornecedores.filter((f) => f.toLowerCase().includes(q)) : fornecedores
  }, [fornecedores, buscaForn])
  const labelForn = fornSel.length === 0 ? '' : fornSel.length === 1 ? fornSel[0] : `${fornSel.length} fornecedores`
  const planos = useMemo(
    () => [...new Set(rows.map((r) => planoNome(r.planoContaCod)))].sort((a, b) => a.localeCompare(b)),
    [rows, planoNome],
  )
  const planosFiltrados = useMemo(() => {
    const q = buscaPlano.trim().toLowerCase()
    return q ? planos.filter((p) => p.toLowerCase().includes(q)) : planos
  }, [planos, buscaPlano])
  const labelPlano = planoSel.length === 0 ? '' : planoSel.length === 1 ? planoSel[0] : `${planoSel.length} planos`
  const temFiltro = inst !== 'todos' || periodo !== 'todos' || fornSel.length > 0 || planoSel.length > 0 || ordenar !== 'vencimento' || atrasoFaixa !== 'todos'

  const rowsAll = useMemo(() => {
    let base = inst === 'todos' ? escopo : escopo.filter((r) => r.instrumento === inst)
    if (atrasoFaixa !== 'todos') {
      base = base.filter((r) => {
        const d = r.diasAtraso
        if (atrasoFaixa === '30') return d >= 1 && d <= 30
        if (atrasoFaixa === '60') return d >= 31 && d <= 60
        if (atrasoFaixa === '90') return d >= 61 && d <= 90
        return d > 90
      })
    }
    const arr = [...base]
    switch (ordenar) {
      case 'maiorValor': arr.sort((a, b) => b.valor - a.valor); break
      case 'menorValor': arr.sort((a, b) => a.valor - b.valor); break
      case 'maiorAtraso': arr.sort((a, b) => b.diasAtraso - a.diasAtraso); break
      case 'fornecedor': arr.sort((a, b) => a.fornecedor.localeCompare(b.fornecedor)); break
      case 'posto': arr.sort((a, b) => (empresaNome.get(a.empresa) ?? '').localeCompare(empresaNome.get(b.empresa) ?? '') || a.fornecedor.localeCompare(b.fornecedor)); break
      default: {
        // "Mais próximo": menor distância da data de vencimento até hoje (passado
        // OU futuro). O que vence/venceu PERTO de hoje fica no topo; os bem antigos
        // (ex.: 2022) vão pro fim — é o OPOSTO de "Maior atraso", não um clone dele.
        const hoje = new Date().setHours(0, 0, 0, 0)
        const dist = (venc: string) => {
          const t = new Date(`${venc}T00:00:00`).getTime()
          return Number.isNaN(t) ? Infinity : Math.abs(t - hoje)
        }
        arr.sort((a, b) => dist(a.vencimento) - dist(b.vencimento))
      }
    }
    return arr
  }, [escopo, inst, atrasoFaixa, ordenar, empresaNome])

  // Totais por grupo (posto OU fornecedor) — pro agrupador com totalizador.
  // Contagem e soma do "a pagar" de TODO o dataset filtrado, não só da página.
  const grupoTotais = useMemo(() => {
    const porPosto = new Map<number, { count: number; total: number }>()
    const porForn = new Map<string, { count: number; total: number }>()
    for (const r of rowsAll) {
      const p = porPosto.get(r.empresa) ?? { count: 0, total: 0 }
      p.count += 1; p.total += r.valor; porPosto.set(r.empresa, p)
      const f = porForn.get(r.fornecedor) ?? { count: 0, total: 0 }
      f.count += 1; f.total += r.valor; porForn.set(r.fornecedor, f)
    }
    return { porPosto, porForn }
  }, [rowsAll])

  const totalPages = Math.max(1, Math.ceil(rowsAll.length / PAGE_SIZE))
  const pageSafe = Math.min(page, totalPages - 1)
  const pageRows = rowsAll.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE)
  const primeiro = rowsAll.length === 0 ? 0 : pageSafe * PAGE_SIZE + 1
  const ultimo = Math.min(rowsAll.length, (pageSafe + 1) * PAGE_SIZE)

  const trocarInst = (id: FiltroInst) => { setInst(id); setPage(0); setDetalhe(null) }
  const toggleForn = (nome: string) => {
    setFornSel((prev) => (prev.includes(nome) ? prev.filter((c) => c !== nome) : [...prev, nome]))
    setPage(0); setDetalhe(null)
  }
  const togglePlano = (nome: string) => {
    setPlanoSel((prev) => (prev.includes(nome) ? prev.filter((c) => c !== nome) : [...prev, nome]))
    setPage(0); setDetalhe(null)
  }
  const limparFiltros = () => {
    setInst('todos'); setPeriodo('todos'); setFornSel([]); setPlanoSel([]); setOrdenar('vencimento'); setAtrasoFaixa('todos'); setBuscaForn(''); setBuscaPlano(''); setPage(0)
  }

  const exportar = () => {
    const header = ['Fornecedor', 'Posto', 'Instrumento', 'Valor', 'Pago', 'A pagar', 'Vencimento', 'Status', 'Documento']
    const linhas = rowsAll.map((r) => [r.fornecedor, nomePosto(r.empresa), instMeta(r.instrumento).label, r.valorTotal.toFixed(2).replace('.', ','), r.valorPago.toFixed(2).replace('.', ','), r.valor.toFixed(2).replace('.', ','), brDate(r.vencimento), r.vencido ? `Atrasado ${r.diasAtraso}d` : 'A vencer', r.documento])
    const csv = [header, ...linhas].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob([String.fromCharCode(0xFEFF) + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `contas-a-pagar-${inst}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // Resumo pra compartilhar (PDF) = EXATAMENTE a visão filtrada na tela (rowsAll já
  // respeita instrumento, faixa de atraso, fornecedor, plano e período). Os filtros
  // ativos vão no subtítulo pra o destinatário saber que fatia é essa.
  const CAP_LISTA = 30
  const buildReport = (): ReportPayload => {
    const rows = rowsAll
    const total = rows.reduce((s, r) => s + r.valor, 0)
    const vencTotal = rows.filter((r) => r.vencido).reduce((s, r) => s + r.valor, 0)

    const filtros: string[] = []
    if (inst !== 'todos') filtros.push(instMeta(inst).label)
    if (periodo !== 'todos') filtros.push(PERIODOS.find((p) => p.id === periodo)?.label ?? '')
    if (atrasoFaixa !== 'todos') filtros.push(atrasoFaixa === '90+' ? 'atraso +90d' : `atraso até ${atrasoFaixa}d`)
    if (fornSel.length) filtros.push(fornSel.length === 1 ? fornSel[0] : `${fornSel.length} fornecedores`)
    if (planoSel.length) filtros.push(planoSel.length === 1 ? planoSel[0] : `${planoSel.length} planos`)

    // Quebra por instrumento do conjunto filtrado — só quando não há filtro de instrumento.
    const porInst = new Map<InstPagar, { total: number; count: number }>()
    for (const r of rows) {
      const g = porInst.get(r.instrumento) ?? { total: 0, count: 0 }
      g.total += r.valor; g.count += 1
      porInst.set(r.instrumento, g)
    }
    const instRows = INSTR.filter((i) => porInst.has(i.id)).map((i) => {
      const g = porInst.get(i.id)!
      return { label: i.label, value: formatCurrencyInt(g.total), sub: `${g.count} ${g.count === 1 ? 'título' : 'títulos'}` }
    })

    const lista = rows.slice(0, CAP_LISTA).map((r) => ({
      label: `${r.fornecedor} · ${nomePosto(r.empresa)}`,
      value: formatCurrencyInt(r.valor),
      sub: `${r.documento ? `Doc ${r.documento} · ` : ''}${instMeta(r.instrumento).label} · venc. ${brDate(r.vencimento)}${r.vencido ? ` · atrasado ${r.diasAtraso}d` : ''}`,
    }))

    return {
      title: 'Contas a Pagar',
      subtitle: [escopoLabel(scopedCodes.length), periodoLabel(periodoLocal), ...filtros].filter(Boolean).join(' · '),
      kpis: [
        { label: 'A pagar (na tela)', value: formatCurrencyInt(total), tone: 'neg' },
        { label: 'Vencido', value: formatCurrencyInt(vencTotal), tone: 'neg' },
        { label: 'A vencer', value: formatCurrencyInt(total - vencTotal), tone: 'neutral' },
      ],
      sections: [
        ...(inst === 'todos' && instRows.length > 1 ? [{ title: 'Por instrumento', rows: instRows }] : []),
        {
          title: `Contas (${rows.length})`,
          rows: lista,
          note: rows.length > CAP_LISTA ? `Mostrando ${CAP_LISTA} de ${rows.length} (ordem atual da tela).` : undefined,
        },
      ],
      footnote: 'Somente leitura · saldo em aberto (o que falta pagar). Gerado no Visor360.',
    }
  }

  const selCls = 'rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-8 text-[13px] text-gray-700 focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb] dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-200'

  return (
    <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Contas a Pagar</h3>
          <InfoHint text="Títulos a pagar em aberto (/TITULO_PAGAR) por instrumento (tipoLancamento: Boleto · Tributo · PIX · Transferência · Convênio · Outros). Clique num card pra filtrar. Somente leitura." />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dateFilter}
          <ShareReportButton filename="contas-a-pagar.pdf" build={buildReport} />
          <button type="button" onClick={exportar} disabled={rowsAll.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-600 transition-colors hover:border-[#2563eb] hover:text-[#2563eb] disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-500 dark:hover:text-blue-300">
            <Download className="h-3.5 w-3.5" />Exportar
          </button>
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
        <MousePointerClick className="h-3.5 w-3.5 text-[#2563eb]" />
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#2563eb] text-[9px] font-bold text-white">1</span>
        Escolha o <span className="font-semibold text-gray-700 dark:text-gray-200">instrumento</span> (clique num card) — depois o período, no passo 2.
      </p>
      <div className={cn('grid gap-2', gridColsCards(visibleCards.length, 4, 7))}>
        {visibleCards.map(({ id, label, Icon }) => {
          const ativo = inst === id
          const c = cards[id]
          return (
            <button key={id} type="button" onClick={() => trocarInst(id)}
              className={cn('rounded-xl border px-3 py-2.5 text-left transition-colors',
                ativo ? 'border-[#2563eb] bg-blue-50/70 ring-1 ring-[#2563eb] dark:border-blue-500 dark:bg-blue-950/30'
                  : 'border-gray-200 bg-gray-50/60 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/40 dark:hover:border-gray-600')}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</span>
                <Icon className={cn('h-3.5 w-3.5', ativo ? 'text-[#2563eb]' : 'text-gray-400')} />
              </div>
              <p className={cn('mt-1 text-[15px] font-bold tabular-nums', ativo ? 'text-[#1e3a5f] dark:text-blue-300' : 'text-gray-900 dark:text-gray-100')}>{formatCurrency(c.total)}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">{c.count} {c.count === 1 ? 'título' : 'títulos'}</p>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#2563eb] text-[9px] font-bold text-white">2</span>
            Período
          </label>
          <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-[#0f0f0f]">
            {PERIODOS.map((p) => {
              const n = periodoCounts[p.id]
              const ativo = periodo === p.id
              return (
                <button key={p.id} type="button" onClick={() => { setPeriodo(p.id); setPage(0) }}
                  className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
                    ativo ? 'bg-[#1e3a5f] text-white shadow-sm dark:bg-blue-700' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200')}>
                  {p.label}
                  <span className={cn('rounded px-1 text-[10px] font-bold tabular-nums',
                    ativo ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300')}>
                    {n}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400">Fornecedor</label>
          <div className="relative w-80">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input type="text" value={abertoForn ? buscaForn : labelForn}
              onChange={(e) => { setBuscaForn(e.target.value); setAbertoForn(true) }}
              onFocus={() => { setAbertoForn(true); setBuscaForn('') }}
              onBlur={() => setTimeout(() => setAbertoForn(false), 150)}
              placeholder="Todos os fornecedores"
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-8 text-[13px] text-gray-700 placeholder:text-gray-400 focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb] dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-200" />
            {fornSel.length > 0 && !abertoForn && (
              <button type="button" onMouseDown={(e) => { e.preventDefault(); setFornSel([]); setPage(0) }} aria-label="Limpar fornecedores"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {abertoForn && (
              <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-[#161616]">
                <button type="button" onMouseDown={(e) => { e.preventDefault(); setFornSel([]); setPage(0) }}
                  className={cn('block w-full px-3 py-1.5 text-left text-[13px] hover:bg-gray-50 dark:hover:bg-gray-800', fornSel.length === 0 ? 'font-semibold text-[#2563eb]' : 'text-gray-600 dark:text-gray-300')}>
                  Todos os fornecedores
                </button>
                {fornFiltrados.length === 0 ? (
                  <p className="px-3 py-2 text-[12px] text-gray-400">Nenhum fornecedor encontrado</p>
                ) : fornFiltrados.map((f) => {
                  const marcado = fornSel.includes(f)
                  return (
                    <button key={f} type="button" onMouseDown={(e) => { e.preventDefault(); toggleForn(f) }}
                      className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-gray-50 dark:hover:bg-gray-800', marcado ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-200')}>
                      <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', marcado ? 'border-[#2563eb] bg-[#2563eb] text-white' : 'border-gray-300 dark:border-gray-600')}>
                        {marcado && <Check className="h-3 w-3" />}
                      </span>
                      <span className="truncate">{f}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400">Plano de contas</label>
          <div className="relative w-80">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input type="text" value={abertoPlano ? buscaPlano : labelPlano}
              onChange={(e) => { setBuscaPlano(e.target.value); setAbertoPlano(true) }}
              onFocus={() => { setAbertoPlano(true); setBuscaPlano('') }}
              onBlur={() => setTimeout(() => setAbertoPlano(false), 150)}
              placeholder="Todos os planos"
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-8 text-[13px] text-gray-700 placeholder:text-gray-400 focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb] dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-200" />
            {planoSel.length > 0 && !abertoPlano && (
              <button type="button" onMouseDown={(e) => { e.preventDefault(); setPlanoSel([]); setPage(0) }} aria-label="Limpar planos"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {abertoPlano && (
              <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-[#161616]">
                <button type="button" onMouseDown={(e) => { e.preventDefault(); setPlanoSel([]); setPage(0) }}
                  className={cn('block w-full px-3 py-1.5 text-left text-[13px] hover:bg-gray-50 dark:hover:bg-gray-800', planoSel.length === 0 ? 'font-semibold text-[#2563eb]' : 'text-gray-600 dark:text-gray-300')}>
                  Todos os planos
                </button>
                {planosFiltrados.length === 0 ? (
                  <p className="px-3 py-2 text-[12px] text-gray-400">Nenhum plano encontrado</p>
                ) : planosFiltrados.map((p) => {
                  const marcado = planoSel.includes(p)
                  return (
                    <button key={p} type="button" onMouseDown={(e) => { e.preventDefault(); togglePlano(p) }}
                      className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-gray-50 dark:hover:bg-gray-800', marcado ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-200')}>
                      <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', marcado ? 'border-[#2563eb] bg-[#2563eb] text-white' : 'border-gray-300 dark:border-gray-600')}>
                        {marcado && <Check className="h-3 w-3" />}
                      </span>
                      <span className="truncate">{p}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400">Ordenar por</label>
          <select value={ordenar} onChange={(e) => { setOrdenar(e.target.value as typeof ordenar); setPage(0) }} className={selCls}>
            <option value="vencimento">Vencimento (mais próximo)</option>
            <option value="maiorValor">Maior valor</option>
            <option value="menorValor">Menor valor</option>
            <option value="maiorAtraso">Maior atraso</option>
            <option value="fornecedor">Fornecedor (A–Z)</option>
            <option value="posto">Posto (A–Z)</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400">Faixa de atraso</label>
          <select value={atrasoFaixa} onChange={(e) => { setAtrasoFaixa(e.target.value as typeof atrasoFaixa); setPage(0) }} className={selCls}>
            <option value="todos">Todos</option>
            <option value="30">Até 30 dias</option>
            <option value="60">31–60 dias</option>
            <option value="90">61–90 dias</option>
            <option value="90+">+90 dias</option>
          </select>
        </div>
        {temFiltro && (
          <button type="button" onClick={limparFiltros}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] font-semibold text-gray-600 transition-colors hover:border-red-300 hover:text-red-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-red-800 dark:hover:text-red-400">
            <X className="h-3.5 w-3.5" />Limpar filtros
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-gray-200 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:border-gray-700 dark:text-gray-500">
              <th className="py-2 pr-3">Fornecedor</th>
              <th className="py-2 px-3">Posto</th>
              <th className="py-2 px-3">Instrumento</th>
              <th className="py-2 px-3 text-right">Valor</th>
              <th className="py-2 px-3 text-right">Pago</th>
              <th className="py-2 px-3 text-right">A pagar</th>
              <th className="py-2 px-3">Vencimento</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 pl-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={9} className="py-10 text-center text-[13px] text-gray-400 dark:text-gray-500">Nenhuma conta a pagar encontrada</td></tr>
            ) : pageRows.map((r, i) => {
              const m = instMeta(r.instrumento)
              const aberto = detalhe === r.key
              // Agrupador (por posto OU fornecedor): cabeçalho com o total do grupo
              // quando a chave muda (ou na 1ª linha da página).
              const agrupPosto = ordenar === 'posto'
              const agrupForn = ordenar === 'fornecedor'
              const chave = agrupPosto ? String(r.empresa) : r.fornecedor
              const chaveAnt = i > 0 ? (agrupPosto ? String(pageRows[i - 1].empresa) : pageRows[i - 1].fornecedor) : ''
              const novoGrupo = (agrupPosto || agrupForn) && (i === 0 || chave !== chaveAnt)
              const grupoNome = agrupPosto ? nomePosto(r.empresa) : r.fornecedor
              const tot = agrupPosto ? grupoTotais.porPosto.get(r.empresa) : grupoTotais.porForn.get(r.fornecedor)
              return (
                <Fragment key={r.key}>
                  {novoGrupo && (
                    <tr className="bg-gray-100/80 dark:bg-gray-800/50">
                      <td colSpan={9} className="px-3 py-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[12px] font-semibold text-gray-700 dark:text-gray-200">{grupoNome}</span>
                          <span className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                            {tot?.count ?? 0} {(tot?.count ?? 0) === 1 ? 'título' : 'títulos'} · A pagar {formatCurrency(tot?.total ?? 0)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                  <tr className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                    <td className="py-2.5 pr-3">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{r.fornecedor}</p>
                      {r.sub && <p className="text-[11px] text-gray-400 dark:text-gray-500">{r.sub}</p>}
                    </td>
                    <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300">{nomePosto(r.empresa)}</td>
                    <td className="py-2.5 px-3">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', m.badge)}>
                        <m.Icon className="h-3 w-3" />{m.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatCurrency(r.valorTotal)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{r.valorPago > 0 ? formatCurrency(r.valorPago) : <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                    <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(r.valor)}</td>
                    <td className="py-2.5 px-3 tabular-nums text-gray-600 dark:text-gray-300">{brDate(r.vencimento)}</td>
                    <td className="py-2.5 px-3">
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        r.vencido ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300')}>
                        {r.vencido ? `Atrasado · ${r.diasAtraso}d` : 'A vencer'}
                      </span>
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      <button type="button" onClick={() => setDetalhe(aberto ? null : r.key)} title="Ver detalhe" aria-label="Ver detalhe"
                        className={cn('inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                          aberto ? 'bg-[#1e3a5f] text-white dark:bg-blue-700' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200')}>
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                  {aberto && (
                    <tr className="bg-gray-50/60 dark:bg-gray-800/30">
                      <td colSpan={9} className="px-3 py-2.5">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] sm:grid-cols-4">
                          <DetItem label="Fornecedor" value={r.fornecedor} />
                          <DetItem label="Posto" value={nomePosto(r.empresa)} />
                          <DetItem label="Instrumento" value={m.label} />
                          <DetItem label="Documento" value={r.documento || '—'} />
                          <DetItem label="Detalhe" value={r.sub || '—'} />
                          <DetItem label="Vencimento" value={brDate(r.vencimento)} />
                          <DetItem label="Status" value={r.vencido ? `Atrasado ${r.diasAtraso} dias` : 'A vencer'} />
                          <DetItem label="Valor" value={formatCurrency(r.valorTotal)} />
                          <DetItem label="Pago" value={formatCurrency(r.valorPago)} />
                          <DetItem label="A pagar" value={formatCurrency(r.valor)} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {rowsAll.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            Mostrando {primeiro}-{ultimo} de {rowsAll.length} {rowsAll.length === 1 ? 'conta' : 'contas'}
          </span>
          {totalPages > 1 && (
            <div className="inline-flex items-center gap-1">
              <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={pageSafe === 0}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-800">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-[12px] font-semibold tabular-nums text-gray-600 dark:text-gray-300">{pageSafe + 1} / {totalPages}</span>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={pageSafe >= totalPages - 1}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-800">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

const DetItem = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</p>
    <p className="tabular-nums text-gray-700 dark:text-gray-200">{value}</p>
  </div>
)

export default PagarTabela
