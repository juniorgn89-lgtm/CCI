import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Truck, Users, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt } from '@/lib/formatters'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import type { ReceivableRow, PayableRow } from '@/pages/Financeiro/hooks/useFinanceData'
import type { Cartao } from '@/api/types/financeiro'

interface Props {
  receivables: ReceivableRow[]
  payables: PayableRow[]
  cartoes: Cartao[]
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/** yyyy-MM-dd → [ano, mes(0-11), dia] (sem timezone). */
const parseISO = (s: string): [number, number, number] | null => {
  const m = (s ?? '').split('T')[0].split('-')
  if (m.length !== 3) return null
  const y = Number(m[0]); const mo = Number(m[1]); const d = Number(m[2])
  if (!y || !mo || !d) return null
  return [y, mo - 1, d]
}

interface DayBucket {
  entradas: number
  saidas: number
}

interface ListItem {
  nome: string
  valor: number
}

/**
 * Agenda financeira — espelha o webPosto: calendário mensal com entradas
 * (recebíveis: títulos a receber + cartões, por vencimento) e saídas (títulos a
 * pagar, por vencimento) de cada dia, mais 3 tabelas laterais (fornecedores a
 * pagar / títulos a receber / cartões a receber) filtráveis por dia clicado.
 */
const AgendaFinanceira = ({ receivables, payables, cartoes }: Props) => {
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth())
  // Por padrão já filtra o dia de hoje (mês atual). Trocar de mês limpa o filtro.
  const [selectedDay, setSelectedDay] = useState<number | null>(hoje.getDate())

  // O grid ocupa EXATAMENTE o espaço útil até o fundo do <main> (o container que
  // rola). Medindo o fundo real (não um teto fixo) o conteúdo sempre cabe na
  // viewport — a página não rola, só as listas internas das tabelas. A coluna
  // lateral copia essa altura: resumo fixo + 3 tabelas flex-1. O calendário usa a
  // mesma altura. Abaixo de xl deixa fluir natural (layout empilhado).
  const gridRef = useRef<HTMLDivElement>(null)
  const [gridH, setGridH] = useState<number | undefined>(undefined)
  useLayoutEffect(() => {
    const compute = () => {
      const el = gridRef.current
      if (!el || window.innerWidth < 1280) { setGridH(undefined); return }
      const z = parseFloat(getComputedStyle(document.documentElement).zoom || '1') || 1
      const main = el.closest('main')
      const top = el.getBoundingClientRect().top
      // Fundo útil = base do <main> menos seu padding-bottom.
      const padB = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 8
      const bottom = main ? main.getBoundingClientRect().bottom - padB * z : window.innerHeight
      const avail = (bottom - top) / z - 2
      setGridH(Math.max(320, avail))
    }
    compute()
    const raf = requestAnimationFrame(compute)
    window.addEventListener('resize', compute)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', compute)
    }
  }, [])

  // Buckets por dia do mês selecionado.
  const buckets = useMemo(() => {
    const map = new Map<number, DayBucket>()
    const add = (dia: number, campo: keyof DayBucket, valor: number) => {
      const cur = map.get(dia) ?? { entradas: 0, saidas: 0 }
      cur[campo] += valor
      map.set(dia, cur)
    }
    for (const r of receivables) {
      if (!r.pendente) continue
      const p = parseISO(r.dataVencimento)
      if (p && p[0] === ano && p[1] === mes) add(p[2], 'entradas', r.valor)
    }
    for (const c of cartoes) {
      const p = parseISO(c.vencimento)
      if (p && p[0] === ano && p[1] === mes) add(p[2], 'entradas', c.valor)
    }
    for (const pg of payables) {
      if (pg.statusTag !== 'vencido' && pg.statusTag !== 'a-vencer') continue
      const p = parseISO(pg.vencimento)
      if (p && p[0] === ano && p[1] === mes) add(p[2], 'saidas', pg.saldoRestante)
    }
    return map
  }, [receivables, payables, cartoes, ano, mes])

  // Grid do calendário: semanas (Dom→Sáb).
  const weeks = useMemo(() => {
    const firstWeekday = new Date(ano, mes, 1).getDay()
    const daysInMonth = new Date(ano, mes + 1, 0).getDate()
    const cells: (number | null)[] = []
    for (let i = 0; i < firstWeekday; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    const out: (number | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7))
    return out
  }, [ano, mes])

  const WEEKDAY_H = 36

  // Tabelas laterais: filtra por dia selecionado, senão mês inteiro.
  const buildList = (
    filterFn: (p: [number, number, number]) => boolean,
  ) => {
    const dia = selectedDay
    const inScope = (iso: string): boolean => {
      const p = parseISO(iso)
      if (!p || p[0] !== ano || p[1] !== mes) return false
      if (dia != null && p[2] !== dia) return false
      return filterFn(p)
    }
    return inScope
  }

  const fornecedores = useMemo<ListItem[]>(() => {
    const scope = buildList(() => true)
    const m = new Map<string, number>()
    for (const p of payables) {
      if (p.statusTag !== 'vencido' && p.statusTag !== 'a-vencer') continue
      if (!scope(p.vencimento)) continue
      const nome = p.nomeFornecedor?.trim() || `Fornecedor ${p.fornecedorCodigo}`
      m.set(nome, (m.get(nome) ?? 0) + p.saldoRestante)
    }
    return Array.from(m, ([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payables, ano, mes, selectedDay])

  const titulosReceber = useMemo<ListItem[]>(() => {
    const scope = buildList(() => true)
    const m = new Map<string, number>()
    for (const r of receivables) {
      if (!r.pendente) continue
      if (!scope(r.dataVencimento)) continue
      const nome = r.nomeCliente?.trim() || `Cliente ${r.clienteCodigo}`
      m.set(nome, (m.get(nome) ?? 0) + r.valor)
    }
    return Array.from(m, ([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receivables, ano, mes, selectedDay])

  const cartoesReceber = useMemo<ListItem[]>(() => {
    const scope = buildList(() => true)
    const m = new Map<string, number>()
    for (const c of cartoes) {
      if (!scope(c.vencimento)) continue
      const nome = c.adiministradoraDescricao?.trim() || 'Outros'
      m.set(nome, (m.get(nome) ?? 0) + c.valor)
    }
    return Array.from(m, ([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartoes, ano, mes, selectedDay])

  // Resumo financeiro do escopo (dia selecionado ou mês inteiro).
  const resumo = useMemo(() => {
    const totalPagar = fornecedores.reduce((s, i) => s + i.valor, 0)
    const totalReceber = titulosReceber.reduce((s, i) => s + i.valor, 0)
      + cartoesReceber.reduce((s, i) => s + i.valor, 0)
    const lancamentos = fornecedores.length + titulosReceber.length + cartoesReceber.length
    return { totalPagar, totalReceber, saldo: totalReceber - totalPagar, lancamentos }
  }, [fornecedores, titulosReceber, cartoesReceber])

  const anos = useMemo(() => {
    const y = hoje.getFullYear()
    return [y - 2, y - 1, y, y + 1]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isToday = (d: number) =>
    ano === hoje.getFullYear() && mes === hoje.getMonth() && d === hoje.getDate()

  const escopoLabel = selectedDay != null
    ? `${String(selectedDay).padStart(2, '0')}/${String(mes + 1).padStart(2, '0')}/${ano}`
    : `${MESES[mes]} de ${ano}`

  return (
    <div className="space-y-4">
      {/* Filtros — portados pra sub-bar de topo, ao lado do Completo/Apurado. */}
      <PageHeaderActions>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={mes}
            onChange={(e) => { setMes(Number(e.target.value)); setSelectedDay(null) }}
            className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-medium text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select
            value={ano}
            onChange={(e) => { setAno(Number(e.target.value)); setSelectedDay(null) }}
            className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-medium text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            {anos.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          {selectedDay != null && (
            <button
              onClick={() => setSelectedDay(null)}
              className="h-8 rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-blue-600 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
            >
              Ver mês inteiro
            </button>
          )}
        </div>
      </PageHeaderActions>

      {/* Escopo — acima do grid pra o topo do calendário alinhar com a 1ª tabela. */}
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
        Exibindo: <span className="font-semibold text-gray-700 dark:text-gray-200">{escopoLabel}</span>
        <span className="ml-1 font-normal text-gray-400">· clique num dia para filtrar</span>
      </p>

      <div
        ref={gridRef}
        style={gridH ? { height: gridH } : undefined}
        className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]"
      >
        {/* Calendário */}
        <section className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="grid shrink-0 grid-cols-7 border-b border-gray-200 dark:border-gray-700" style={{ height: WEEKDAY_H }}>
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="flex items-center justify-center text-xs font-semibold text-blue-700 dark:text-blue-400">
                <span className="hidden sm:inline">{d}</span>
                <span className="sm:hidden">{d.slice(0, 3)}</span>
              </div>
            ))}
          </div>
          <div className="grid flex-1 auto-rows-fr grid-cols-7 overflow-y-auto">
            {weeks.flat().map((d, idx) => {
              if (d === null) return <div key={idx} className="border-b border-r border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/40" />
              const b = buckets.get(d) ?? { entradas: 0, saidas: 0 }
              const saldo = b.entradas - b.saidas
              const temMov = b.entradas > 0 || b.saidas > 0
              const selected = selectedDay === d
              const bg = selected
                ? 'bg-[#1e3a5f] text-white'
                : !temMov
                  ? 'bg-white dark:bg-gray-900'
                  : saldo > 0
                    ? 'bg-emerald-50 dark:bg-emerald-900/15'
                    : saldo < 0
                      ? 'bg-red-50 dark:bg-red-900/15'
                      : 'bg-white dark:bg-gray-900'
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDay(selected ? null : d)}
                  className={cn(
                    'flex flex-col border-b border-r border-gray-100 px-2 py-1.5 text-left align-top transition-colors hover:brightness-95 dark:border-gray-800',
                    bg,
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn('text-sm font-bold', selected ? 'text-white' : 'text-gray-700 dark:text-gray-200')}>{d}</span>
                    {isToday(d) && !selected && (
                      <span className="rounded-full bg-blue-100 px-1.5 text-[10px] font-bold text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">hoje</span>
                    )}
                  </div>
                  {temMov && (
                    <div className={cn('mt-0.5 space-y-0.5 text-xs leading-tight tabular-nums', selected ? 'text-white/90' : 'text-gray-600 dark:text-gray-400')}>
                      {b.entradas > 0 && (
                        <p className={selected ? '' : 'text-emerald-700 dark:text-emerald-400'}>
                          ↑ {formatCurrency(b.entradas)}
                        </p>
                      )}
                      {b.saidas > 0 && (
                        <p className={selected ? '' : 'text-red-600 dark:text-red-400'}>
                          ↓ {formatCurrency(b.saidas)}
                        </p>
                      )}
                      <p className={cn('font-semibold', selected ? '' : saldo >= 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-700 dark:text-red-300')}>
                        = {formatCurrency(saldo)}
                      </p>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* Coluna: resumo fixo + 3 tabelas dividindo a altura restante. */}
        <div className="flex min-h-0 flex-col gap-3">
          {/* Resumo financeiro — sempre visível. */}
          <section className="shrink-0 rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
              <Stat label="Total a pagar" value={formatCurrency(resumo.totalPagar)} tone="red" />
              <Stat label="Total a receber" value={formatCurrency(resumo.totalReceber)} tone="green" />
              <Stat
                label="Saldo projetado"
                value={formatCurrency(resumo.saldo)}
                tone={resumo.saldo >= 0 ? 'green' : 'red'}
              />
              <Stat label="Lançamentos" value={String(resumo.lancamentos)} tone="muted" />
            </div>
          </section>

          <SideTable title="Fornecedores a pagar" Icon={Truck} items={fornecedores} color="red" colHeader="Fornecedor" />
          <SideTable title="Títulos a receber" Icon={Users} items={titulosReceber} color="blue" colHeader="Cliente" />
          <SideTable title="Cartões a receber" Icon={CreditCard} items={cartoesReceber} color="violet" colHeader="Administradora" />
        </div>
      </div>
    </div>
  )
}

const SideTable = ({
  title, Icon, items, color, colHeader,
}: {
  title: string
  Icon: typeof Truck
  items: ListItem[]
  color: 'red' | 'blue' | 'violet'
  colHeader: string
}) => {
  const total = items.reduce((s, i) => s + i.valor, 0)
  const count = items.length
  const mostrando = Math.min(5, count)
  const iconBg = {
    red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    violet: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
  }[color]

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
        <h3 className="flex items-baseline gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
          {title}
          {count > 0 && (
            <span className="text-[11px] font-normal text-gray-400">({mostrando} de {count})</span>
          )}
        </h3>
        <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', iconBg)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {items.length === 0 ? (
        <p className="flex-1 px-4 py-8 text-center text-xs text-gray-400">Nada para o período.</p>
      ) : (
        <>
          {/* Card de altura fixa; as linhas que passarem rolam aqui dentro. */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/60">
                <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="px-4 py-1.5 font-medium">{colHeader}</th>
                  <th className="px-4 py-1.5 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map((it) => (
                  <tr key={it.nome}>
                    <td className="max-w-[180px] truncate px-4 py-1.5 text-gray-700 dark:text-gray-300" title={it.nome}>{it.nome}</td>
                    <td className="px-4 py-1.5 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(it.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="shrink-0 border-t border-gray-200 px-4 py-2 text-right text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
            Total · <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(total)}</span>
          </div>
        </>
      )}
    </section>
  )
}

const Stat = ({ label, value, tone }: { label: string; value: string; tone: 'red' | 'green' | 'muted' }) => {
  const valueColor = {
    red: 'text-red-600 dark:text-red-400',
    green: 'text-emerald-600 dark:text-emerald-400',
    muted: 'text-gray-900 dark:text-gray-100',
  }[tone]
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className={cn('truncate text-sm font-bold tabular-nums', valueColor)}>{value}</p>
    </div>
  )
}

export default AgendaFinanceira
