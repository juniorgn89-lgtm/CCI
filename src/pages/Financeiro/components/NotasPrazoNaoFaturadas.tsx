import { useMemo, useState } from 'react'
import { FileText, ChevronRight, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt } from '@/lib/formatters'
import type { ReceivableRow } from '@/pages/Financeiro/hooks/useFinanceData'
import InfoHint from '@/components/ui/InfoHint'

interface Props {
  /** Snapshot de títulos a receber em aberto (filtra convertido=false aqui dentro). */
  data: ReceivableRow[]
}

const todayISO = () => new Date().toISOString().split('T')[0]
const addDaysISO = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}
const onlyDate = (s: string) => (s ?? '').split('T')[0]
const brDate = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '—')
const nomeCli = (r: { nomeCliente?: string; clienteCodigo: number }) => r.nomeCliente?.trim() || `Cliente ${r.clienteCodigo}`
// "Não faturada" = título a receber EM ABERTO (pendente) ainda NÃO convertido em
// boleto/duplicata (convertido=false). Exigir `pendente` evita somar títulos já
// baixados/faturados que ainda venham com convertido=false no histórico — era a
// causa do total divergir do webPosto.
const isNaoFaturada = (r: ReceivableRow) =>
  r.pendente === true && (r as unknown as { convertido?: boolean | null }).convertido === false
/** Número do documento: tituloNumero → documento → #tituloCodigo. */
const numDoc = (r: ReceivableRow) => {
  const n = (r as unknown as { tituloNumero?: number }).tituloNumero
  const d = (r as unknown as { documento?: string }).documento
  return n ? String(n) : (d?.trim() || `#${r.tituloCodigo}`)
}
const getDoc = (r: ReceivableRow) => (r as unknown as { documento?: string }).documento?.trim() || ''

type Quick = 'todos' | 'atual' | 'proximo'

/**
 * Notas a Prazo Não Faturadas — títulos a receber em aberto com convertido=false
 * (ainda não convertidos em boleto/duplicata = não faturados). Mostra o potencial
 * de faturamento futuro: total, qtd, clientes, ticket médio, lista por cliente e
 * previsão por janela de vencimento.
 */
const NotasPrazoNaoFaturadas = ({ data }: Props) => {
  const hoje = todayISO()
  const [ano, setAno] = useState<number | 'todos'>('todos')
  const [quick, setQuick] = useState<Quick>('todos')
  const [aberto, setAberto] = useState<Set<number>>(new Set())

  const base = useMemo(() => data.filter(isNaoFaturada), [data])

  const anos = useMemo(() => {
    const set = new Set<number>()
    for (const r of base) { const y = Number(onlyDate(r.dataVencimento).slice(0, 4)); if (y) set.add(y) }
    return Array.from(set).sort((a, b) => b - a)
  }, [base])

  // Janela do filtro rápido (por vencimento).
  const filtrados = useMemo(() => {
    const ymAtual = hoje.slice(0, 7)
    const prox = new Date(`${hoje}T00:00:00`); prox.setMonth(prox.getMonth() + 1)
    const ymProx = `${prox.getFullYear()}-${String(prox.getMonth() + 1).padStart(2, '0')}`
    return base.filter((r) => {
      const v = onlyDate(r.dataVencimento)
      if (ano !== 'todos' && Number(v.slice(0, 4)) !== ano) return false
      if (quick === 'atual' && v.slice(0, 7) !== ymAtual) return false
      if (quick === 'proximo' && v.slice(0, 7) !== ymProx) return false
      return true
    })
  }, [base, ano, quick, hoje])

  const stats = useMemo(() => {
    const total = filtrados.reduce((s, r) => s + r.valor, 0)
    const clientes = new Set(filtrados.map((r) => r.clienteCodigo))
    const ticket = filtrados.length > 0 ? total / filtrados.length : 0
    // Previsão de faturamento por janela (vencimento futuro).
    const win = (dias: number) => {
      const fim = addDaysISO(hoje, dias)
      return filtrados.reduce((s, r) => {
        const v = onlyDate(r.dataVencimento)
        return v >= hoje && v <= fim ? s + r.valor : s
      }, 0)
    }
    // Agrupado por cliente (lista expansível).
    type Item = { numero: string; movimento: string; vencimento: string; documento: string; valor: number }
    const map = new Map<number, { codigo: number; nome: string; total: number; itens: Item[] }>()
    for (const r of filtrados) {
      const g = map.get(r.clienteCodigo) ?? { codigo: r.clienteCodigo, nome: nomeCli(r), total: 0, itens: [] }
      g.total += r.valor
      g.itens.push({
        numero: numDoc(r),
        movimento: onlyDate(r.dataMovimento),
        vencimento: onlyDate(r.dataVencimento),
        documento: getDoc(r),
        valor: r.valor,
      })
      map.set(r.clienteCodigo, g)
    }
    const grupos = Array.from(map.values())
      .map((g) => ({ ...g, itens: g.itens.sort((a, b) => a.vencimento.localeCompare(b.vencimento)) }))
      .sort((a, b) => b.total - a.total)
    return { total, clientes: clientes.size, qtd: filtrados.length, ticket, prev7: win(7), prev15: win(15), prev30: win(30), grupos }
  }, [filtrados, hoje])

  // % do potencial de recebimento futuro (não faturado ÷ tudo em aberto).
  const totalAberto = useMemo(() => data.reduce((s, r) => s + r.valor, 0), [data])
  const pctPotencial = totalAberto > 0 ? (stats.total / totalAberto) * 100 : 0

  const toggle = (cod: number) => setAberto((prev) => {
    const n = new Set(prev)
    if (n.has(cod)) n.delete(cod); else n.add(cod)
    return n
  })

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <FileText className="h-4 w-4 text-gray-400" />
          Notas a prazo não faturadas
          <InfoHint text="Títulos a receber em aberto ainda não convertidos em boleto/duplicata (convertido=false) — potencial de faturamento futuro." />
        </h3>
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={ano}
            onChange={(e) => setAno(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
            className="h-7 rounded-md border border-gray-200 bg-white px-2 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <option value="todos">Todos os anos</option>
            {anos.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          {([['todos', 'Todos'], ['atual', 'Mês atual'], ['proximo', 'Próximo mês']] as [Quick, string][]).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setQuick(v)}
              className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                quick === v ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800')}
            >{label}</button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[280px_1fr]">
        {/* Resumo + previsão + alerta */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Total a faturar" value={formatCurrency(stats.total)} tone="indigo" />
            <Metric label="Ticket médio" value={formatCurrency(stats.ticket)} />
            <Metric label="Notas" value={String(stats.qtd)} />
            <Metric label="Clientes" value={String(stats.clientes)} />
          </div>

          <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">Previsão de faturamento</p>
            <ul className="space-y-1 text-xs">
              {([['7 dias', stats.prev7], ['15 dias', stats.prev15], ['30 dias', stats.prev30]] as [string, number][]).map(([l, v]) => (
                <li key={l} className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{l}</span>
                  <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(v)}</span>
                </li>
              ))}
            </ul>
          </div>

          {stats.total > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Existem <b>{formatCurrency(stats.total)}</b> em notas ainda não faturadas — {pctPotencial.toFixed(2)}% do total em aberto.
              </span>
            </div>
          )}
        </div>

        {/* Lista expansível por cliente */}
        <div className="min-h-0">
          {stats.grupos.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">Nenhuma nota a prazo não faturada no filtro.</p>
          ) : (
            <ul className="max-h-[340px] divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
              {stats.grupos.map((g) => {
                const exp = aberto.has(g.codigo)
                return (
                  <li key={g.codigo}>
                    <button onClick={() => toggle(g.codigo)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform', exp && 'rotate-90')} />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-800 dark:text-gray-200" title={g.nome}>{g.nome}</span>
                      <span className="shrink-0 text-[11px] text-gray-400">{g.itens.length} nota{g.itens.length !== 1 ? 's' : ''}</span>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(g.total)}</span>
                    </button>
                    {exp && (
                      <div className="overflow-x-auto bg-gray-50/60 px-3 pb-2 dark:bg-gray-900/40">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-left uppercase tracking-wide text-gray-400">
                              <th className="py-1 pl-6 pr-3 font-medium">Nº título</th>
                              <th className="px-3 py-1 font-medium">Movimento</th>
                              <th className="px-3 py-1 font-medium">Documento</th>
                              <th className="px-3 py-1 font-medium">Vencimento</th>
                              <th className="px-3 py-1 text-right font-medium">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.itens.map((it, i) => (
                              <tr key={i} className="text-gray-600 dark:text-gray-400">
                                <td className="py-1 pl-6 pr-3 font-medium tabular-nums text-gray-700 dark:text-gray-300">{it.numero}</td>
                                <td className="px-3 py-1 tabular-nums">{brDate(it.movimento)}</td>
                                <td className="px-3 py-1">{it.documento || '—'}</td>
                                <td className="px-3 py-1 tabular-nums">{brDate(it.vencimento)}</td>
                                <td className="px-3 py-1 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(it.valor)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

const Metric = ({ label, value, tone }: { label: string; value: string; tone?: 'indigo' }) => (
  <div className={cn('rounded-lg border p-2.5', tone === 'indigo' ? 'border-indigo-200 bg-indigo-50 dark:border-indigo-900/50 dark:bg-indigo-950/20' : 'border-gray-200 dark:border-gray-700')}>
    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
    <p className={cn('mt-0.5 text-sm font-bold tabular-nums', tone === 'indigo' ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-gray-100')}>{value}</p>
  </div>
)

export default NotasPrazoNaoFaturadas
