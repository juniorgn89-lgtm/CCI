import { Fragment, useMemo, useState } from 'react'
import { Clock, CalendarDays, CalendarRange, AlertTriangle, List, Search, Download, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import type { ReceivableRow } from '@/pages/Financeiro/hooks/useFinanceData'

const todayISO = () => new Date().toISOString().split('T')[0]
const addDaysISO = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}
const endOfWeekISO = (iso: string) => addDaysISO(iso, (7 - new Date(`${iso}T00:00:00`).getDay()) % 7)
const endOfMonthISO = (iso: string) => {
  const [y, m] = iso.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
}
const onlyDate = (s: string) => (s ?? '').split('T')[0]
const brDate = (iso: string) => (iso ? onlyDate(iso).split('-').reverse().join('/') : '—')
const nomeCli = (r: ReceivableRow) => r.nomeCliente?.trim() || `Cliente ${r.clienteCodigo}`
const statusText = (r: ReceivableRow) =>
  r.statusTag === 'vencido' ? `Atrasado (${r.diasAtraso}d)` : onlyDate(r.dataVencimento) === todayISO() ? 'Vence hoje' : 'A vencer'

type FiltroId = 'hoje' | 'semana' | 'mes' | 'atrasados' | 'todos'
const PAGE_SIZE = 10

const CARD_META: { id: FiltroId; label: string; Icon: typeof Clock }[] = [
  { id: 'hoje', label: 'Hoje', Icon: Clock },
  { id: 'semana', label: 'Esta semana', Icon: CalendarDays },
  { id: 'mes', label: 'Este mês', Icon: CalendarRange },
  { id: 'atrasados', label: 'Atrasados', Icon: AlertTriangle },
  { id: 'todos', label: 'Todos', Icon: List },
]

/**
 * Contas a Receber — lista operacional (layout do anexo): cards-filtro DINÂMICOS
 * (clicar filtra a tabela), busca por cliente, tabela paginada e Exportar.
 * READ-ONLY: sem "Nova Receita"/editar/excluir (Ações = só "ver detalhe"). A
 * coluna "Processo" do anexo (jurídico) vira "Documento" — o nº real do título.
 * Dado real do /TITULO_RECEBER em aberto.
 */
const ReceberTabela = ({ data }: { data: ReceivableRow[] }) => {
  const hoje = todayISO()
  const [filtro, setFiltro] = useState<FiltroId>('todos')
  const [busca, setBusca] = useState('')
  const [page, setPage] = useState(0)
  const [detalhe, setDetalhe] = useState<number | null>(null)

  const { buckets, counts, totais } = useMemo(() => {
    const pend = data.filter((r) => r.pendente)
    const eow = endOfWeekISO(hoje)
    const eom = endOfMonthISO(hoje)
    const aVencer = pend.filter((r) => r.statusTag === 'a-vencer')
    const noIntervalo = (r: ReceivableRow, ini: string, fim: string) => {
      const v = onlyDate(r.dataVencimento)
      return v >= ini && v <= fim
    }
    const b: Record<FiltroId, ReceivableRow[]> = {
      hoje: aVencer.filter((r) => onlyDate(r.dataVencimento) === hoje),
      semana: aVencer.filter((r) => noIntervalo(r, hoje, eow)),
      mes: aVencer.filter((r) => noIntervalo(r, hoje, eom)),
      atrasados: pend.filter((r) => r.statusTag === 'vencido'),
      todos: pend,
    }
    const c = {} as Record<FiltroId, number>
    const t = {} as Record<FiltroId, number>
    for (const k of Object.keys(b) as FiltroId[]) {
      c[k] = b[k].length
      t[k] = b[k].reduce((s, r) => s + r.valor, 0)
    }
    return { buckets: b, counts: c, totais: t }
  }, [data, hoje])

  const rowsAll = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const base = buckets[filtro]
    const filtered = q ? base.filter((r) => nomeCli(r).toLowerCase().includes(q)) : base
    return [...filtered].sort((a, b) => {
      if (a.statusTag !== b.statusTag) return a.statusTag === 'vencido' ? -1 : 1
      return onlyDate(a.dataVencimento).localeCompare(onlyDate(b.dataVencimento))
    })
  }, [buckets, filtro, busca])

  // Paginação (reseta ao trocar filtro/busca via key derivada).
  const totalPages = Math.max(1, Math.ceil(rowsAll.length / PAGE_SIZE))
  const pageSafe = Math.min(page, totalPages - 1)
  const rows = rowsAll.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE)
  const primeiro = rowsAll.length === 0 ? 0 : pageSafe * PAGE_SIZE + 1
  const ultimo = Math.min(rowsAll.length, (pageSafe + 1) * PAGE_SIZE)

  const trocarFiltro = (id: FiltroId) => { setFiltro(id); setPage(0); setDetalhe(null) }
  const onBusca = (v: string) => { setBusca(v); setPage(0) }

  const exportar = () => {
    const header = ['Cliente', 'Valor', 'Vencimento', 'Documento', 'Status']
    const linhas = rowsAll.map((r) => [nomeCli(r), r.valor.toFixed(2).replace('.', ','), brDate(r.dataVencimento), r.documento || '', statusText(r)])
    const csv = [header, ...linhas].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    // BOM (U+FEFF) via charCode — Excel abre UTF-8 certo; sem caractere literal (lint).
    const blob = new Blob([String.fromCharCode(0xFEFF) + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `contas-a-receber-${filtro}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Contas a Receber</h3>
          <InfoHint text="Títulos a receber em aberto. Clique num card pra filtrar a tabela (Hoje / Esta semana / Este mês / Atrasados / Todos) e use a busca pra achar um cliente. Somente leitura — não há criação/edição de lançamentos." />
        </div>
        <button
          type="button"
          onClick={exportar}
          disabled={rowsAll.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-600 transition-colors hover:border-[#2563eb] hover:text-[#2563eb] disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-500 dark:hover:text-blue-300"
        >
          <Download className="h-3.5 w-3.5" />Exportar
        </button>
      </div>

      {/* ── Cards-filtro dinâmicos ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {CARD_META.map(({ id, label, Icon }) => {
          const ativo = filtro === id
          const critico = id === 'atrasados' && totais[id] > 0
          return (
            <button
              key={id}
              type="button"
              onClick={() => trocarFiltro(id)}
              className={cn(
                'relative rounded-xl border px-3 py-2.5 text-left transition-colors',
                ativo
                  ? 'border-violet-400 bg-violet-50/70 ring-1 ring-violet-400 dark:border-violet-500 dark:bg-violet-950/30'
                  : critico
                    ? 'border-red-200 bg-red-50/40 hover:border-red-300 dark:border-red-900/40 dark:bg-red-950/15'
                    : 'border-gray-200 bg-gray-50/60 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/40 dark:hover:border-gray-600',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</span>
                <Icon className={cn('h-3.5 w-3.5', ativo ? 'text-violet-500' : critico ? 'text-red-500' : 'text-gray-400')} />
              </div>
              <p className={cn('mt-1 text-[17px] font-bold tabular-nums', ativo ? 'text-violet-700 dark:text-violet-300' : critico ? 'text-red-700 dark:text-red-300' : 'text-gray-900 dark:text-gray-100')}>
                {formatCurrency(totais[id])}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">{counts[id]} {counts[id] === 1 ? 'parcela' : 'parcelas'}</p>
            </button>
          )
        })}
      </div>

      {/* ── Busca de cliente ── */}
      <div>
        <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400">Cliente</label>
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => onBusca(e.target.value)}
            placeholder="Buscar cliente..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-3 text-[13px] text-gray-700 placeholder:text-gray-400 focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb] dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-200"
          />
        </div>
      </div>

      {/* ── Tabela ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-gray-200 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:border-gray-700 dark:text-gray-500">
              <th className="py-2 pr-3 font-semibold">Descrição</th>
              <th className="py-2 px-3 text-right font-semibold">Valor</th>
              <th className="py-2 px-3 font-semibold">Vencimento</th>
              <th className="py-2 px-3 font-semibold">Documento</th>
              <th className="py-2 px-3 font-semibold">Status</th>
              <th className="py-2 pl-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[13px] text-gray-400 dark:text-gray-500">Nenhum registro encontrado</td>
              </tr>
            ) : (
              rows.map((r) => {
                const vencido = r.statusTag === 'vencido'
                const venceHoje = r.statusTag === 'a-vencer' && onlyDate(r.dataVencimento) === hoje
                const aberto = detalhe === r.codigo
                return (
                  <Fragment key={r.codigo}>
                    <tr className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                      <td className="py-2.5 pr-3">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{nomeCli(r)}</p>
                        {(r.tipo || r.situacaoLabel) && (
                          <p className="text-[11px] text-gray-400 dark:text-gray-500">{r.tipo || r.situacaoLabel}</p>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(r.valor)}</td>
                      <td className="py-2.5 px-3 tabular-nums text-gray-600 dark:text-gray-300">{brDate(r.dataVencimento)}</td>
                      <td className="py-2.5 px-3 tabular-nums text-gray-500 dark:text-gray-400">{r.documento || '—'}</td>
                      <td className="py-2.5 px-3">
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          vencido
                            ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
                            : venceHoje
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                              : 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300',
                        )}>
                          {vencido ? `Atrasado · ${r.diasAtraso}d` : venceHoje ? 'Vence hoje' : 'A vencer'}
                        </span>
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <button
                          type="button"
                          onClick={() => setDetalhe(aberto ? null : r.codigo)}
                          title="Ver detalhe"
                          aria-label="Ver detalhe"
                          className={cn('inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                            aberto ? 'bg-[#1e3a5f] text-white dark:bg-blue-700' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200')}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                    {aberto && (
                      <tr key={`${r.codigo}-det`} className="bg-gray-50/60 dark:bg-gray-800/30">
                        <td colSpan={6} className="px-3 py-2.5">
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] sm:grid-cols-4">
                            <DetItem label="Cliente" value={nomeCli(r)} />
                            <DetItem label="CPF/CNPJ" value={r.cpfCnpjCliente || '—'} />
                            <DetItem label="Documento" value={r.documento || '—'} />
                            <DetItem label="Tipo" value={r.tipo || '—'} />
                            <DetItem label="Emissão" value={brDate(r.dataMovimento)} />
                            <DetItem label="Vencimento" value={brDate(r.dataVencimento)} />
                            <DetItem label="Situação" value={r.situacaoLabel || '—'} />
                            <DetItem label="Valor" value={formatCurrency(r.valor)} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Paginação ── */}
      {rowsAll.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            Mostrando {primeiro}-{ultimo} de {rowsAll.length} {rowsAll.length === 1 ? 'resultado' : 'resultados'}
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

export default ReceberTabela
