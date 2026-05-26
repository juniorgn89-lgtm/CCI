import { useMemo, useState } from 'react'
import {
  Receipt, ChevronDown, Banknote, CreditCard, Smartphone, Wallet,
  DollarSign, Scale, TrendingUp, Users, AlertTriangle,
} from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import { Skeleton } from '@/components/ui/skeleton'
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
import useOperacaoData from '@/pages/Operacao/hooks/useOperacaoData'
import useShowSkeleton from '@/hooks/useShowSkeleton'

/* ─── Helpers ──────────────────────────────────────────── */

const formatIsoTime = (iso: string | null | undefined): string => {
  if (!iso) return '-'
  if (iso.includes('T')) return iso.split('T')[1]?.substring(0, 5) ?? '-'
  if (iso.includes(' ')) return iso.split(' ')[1]?.substring(0, 5) ?? '-'
  return iso.substring(0, 5)
}

const paymentIcon = (tipo: string) => {
  const t = tipo.toUpperCase()
  if (t.includes('DINHEIRO') || t.includes('ESPECIE')) return Banknote
  if (t.includes('CARTAO') || t.includes('CREDITO') || t.includes('DEBITO')) return CreditCard
  if (t.includes('PIX')) return Smartphone
  return Wallet
}

const fmtBRDate = (iso: string): string =>
  iso ? iso.split('-').reverse().join('/') : '-'

const ContentSkeleton = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
    <Skeleton className="h-64 w-full" />
  </div>
)

/** Chave única do caixa (caixaCodigo + dataMovimento). */
const caixaKey = (c: { caixaCodigo: number; dataMovimento: string }) =>
  `${c.caixaCodigo}-${c.dataMovimento.substring(0, 10)}`

/**
 * Aba "Visão Geral" do Fechamento de Caixa — dados reais via useOperacaoData.
 * Seletor de caixas próprio (turnoRows), KPIs agregados, formas de pagamento,
 * frentistas envolvidos e listagem de sobras/faltas por caixa.
 */
const VisaoGeral = () => {
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const empresaKey = empresaCodigos.join(',')

  const { turnoRows, isLoading } = useOperacaoData()
  const showSkeleton = useShowSkeleton(isLoading, turnoRows.length > 0)

  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [includeAbertos, setIncludeAbertos] = useState(false)

  const [prevEmpresaKey, setPrevEmpresaKey] = useState(empresaKey)
  if (prevEmpresaKey !== empresaKey) {
    setPrevEmpresaKey(empresaKey)
    setSelectedKeys([])
  }

  const [prevIncludeAbertos, setPrevIncludeAbertos] = useState(includeAbertos)
  if (prevIncludeAbertos !== includeAbertos) {
    setPrevIncludeAbertos(includeAbertos)
    if (!includeAbertos) {
      setSelectedKeys((prev) =>
        prev.filter((k) => turnoRows.find((r) => caixaKey(r) === k)?.fechado),
      )
    }
  }

  const caixasFiltrados = useMemo(() => {
    return turnoRows
      .filter((r) => includeAbertos || r.fechado)
      .sort((a, b) => {
        const dateDiff = b.dataMovimento.localeCompare(a.dataMovimento)
        if (dateDiff !== 0) return dateDiff
        return a.turnoCodigo - b.turnoCodigo
      })
  }, [turnoRows, includeAbertos])

  const caixasPorData = useMemo(() => {
    const map = new Map<string, typeof caixasFiltrados>()
    for (const c of caixasFiltrados) {
      const day = c.dataMovimento.substring(0, 10)
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(c)
    }
    return Array.from(map.entries()).map(([data, lista]) => ({ data, lista }))
  }, [caixasFiltrados])

  const selectedCaixas = useMemo(
    () => caixasFiltrados.filter((c) => selectedKeys.includes(caixaKey(c))),
    [caixasFiltrados, selectedKeys],
  )

  const allSelected =
    caixasFiltrados.length > 0 && selectedKeys.length === caixasFiltrados.length
  const noneSelected = selectedKeys.length === 0

  const agregados = useMemo(() => {
    const apurado = selectedCaixas.reduce((s, c) => s + c.apurado, 0)
    const diferencaFechados = selectedCaixas
      .filter((c) => c.fechado)
      .reduce((s, c) => s + c.diferenca, 0)

    const pgtoMap = new Map<string, { tipo: string; nome: string; valor: number; quantidade: number }>()
    for (const c of selectedCaixas) {
      for (const p of c.pagamentos) {
        const prev = pgtoMap.get(p.tipo) ?? { tipo: p.tipo, nome: p.nome, valor: 0, quantidade: 0 }
        prev.valor += p.valor
        prev.quantidade += p.quantidade
        pgtoMap.set(p.tipo, prev)
      }
    }
    const pagamentos = Array.from(pgtoMap.values()).sort((a, b) => b.valor - a.valor)
    const totalPagamentos = pagamentos.reduce((s, p) => s + p.valor, 0)

    const frentMap = new Map<string, { nome: string; litros: number; atendimentos: number; faturamento: number }>()
    for (const c of selectedCaixas) {
      for (const f of c.frentistas) {
        const prev = frentMap.get(f.nome) ?? { nome: f.nome, litros: 0, atendimentos: 0, faturamento: 0 }
        prev.litros += f.litros
        prev.atendimentos += f.atendimentos
        prev.faturamento += f.faturamento
        frentMap.set(f.nome, prev)
      }
    }
    const frentistas = Array.from(frentMap.values()).sort((a, b) => b.faturamento - a.faturamento)
    const totalCombustivel = frentistas.reduce((s, f) => s + f.faturamento, 0)
    const conveniencia = Math.max(0, apurado - totalCombustivel)

    return {
      apurado, diferencaFechados, pagamentos, totalPagamentos,
      frentistas, totalCombustivel, conveniencia,
    }
  }, [selectedCaixas])

  const caixasComDiferenca = useMemo(
    () =>
      selectedCaixas
        .filter((c) => c.fechado && Math.abs(c.diferenca) > 0.005)
        .sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca)),
    [selectedCaixas],
  )

  const toggleCaixa = (k: string) =>
    setSelectedKeys((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]))
  const selectAll = () => setSelectedKeys(caixasFiltrados.map(caixaKey))
  const clearAll = () => setSelectedKeys([])

  const triggerLabel = noneSelected
    ? 'Selecione um caixa'
    : allSelected
    ? `Todos os caixas (${caixasFiltrados.length})`
    : selectedKeys.length === 1
    ? `${selectedCaixas[0].turno} · ${fmtBRDate(selectedCaixas[0].dataMovimento)}`
    : `${selectedKeys.length} caixas selecionados`

  return (
    <div className="space-y-4">
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
          <DropdownMenuContent align="start" className="max-h-[70vh] w-[360px] overflow-y-auto">
            <DropdownMenuLabel className="flex items-center justify-between gap-3 text-xs">
              <span>Selecionar caixas</span>
              <div className="flex items-center gap-2 text-[11px] font-normal">
                <button type="button" onClick={selectAll} className="text-blue-600 hover:underline dark:text-blue-400">
                  Todos
                </button>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <button type="button" onClick={clearAll} className="text-gray-500 hover:underline dark:text-gray-400">
                  Limpar
                </button>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {caixasFiltrados.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-gray-400">
                {showSkeleton ? 'Carregando...' : 'Nenhum caixa no período.'}
              </p>
            ) : (
              caixasPorData.map(({ data, lista }, gi) => {
                const allDaySelected = lista.every((c) => selectedKeys.includes(caixaKey(c)))
                const toggleDay = () => {
                  const dayKeys = lista.map(caixaKey)
                  setSelectedKeys((prev) =>
                    allDaySelected
                      ? prev.filter((k) => !dayKeys.includes(k))
                      : [...new Set([...prev, ...dayKeys])],
                  )
                }
                return (
                  <div key={data} className={cn(gi > 0 && 'mt-1 border-t border-gray-100 pt-1 dark:border-gray-800')}>
                    <div className="flex items-center justify-between px-2 py-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        {fmtBRDate(data)}
                      </span>
                      <button
                        type="button"
                        onClick={toggleDay}
                        className="text-[10px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {allDaySelected ? 'Desmarcar dia' : 'Selecionar dia'}
                      </button>
                    </div>
                    {lista.map((c) => {
                      const key = caixaKey(c)
                      return (
                        <DropdownMenuCheckboxItem
                          key={key}
                          checked={selectedKeys.includes(key)}
                          onCheckedChange={() => toggleCaixa(key)}
                          onSelect={(e) => e.preventDefault()}
                          className={cn(
                            'text-xs',
                            !c.fechado && 'border-l-2 border-amber-400 bg-amber-50/40 dark:border-amber-500/70 dark:bg-amber-900/10',
                          )}
                        >
                          <div className="flex w-full flex-col gap-1">
                            <span className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-gray-100">
                              <span>{c.turno} · Caixa #{c.caixaCodigo}</span>
                              {!c.fechado && (
                                <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                  Em aberto
                                </span>
                              )}
                            </span>
                            <span className="text-[11px] text-gray-500 dark:text-gray-400">
                              {c.funcionarioNome} · A: {formatIsoTime(c.abertura)} F: {formatIsoTime(c.fechamento)}
                            </span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                <span className="opacity-70">Apurado</span>
                                <span className="tabular-nums">{formatCurrency(c.apurado)}</span>
                              </span>
                              {c.fechado && Math.abs(c.diferenca) > 0.005 && (
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums',
                                    c.diferenca > 0
                                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                      : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
                                  )}
                                >
                                  {c.diferenca > 0 ? '+' : ''}{formatCurrency(c.diferenca)}
                                </span>
                              )}
                            </div>
                          </div>
                        </DropdownMenuCheckboxItem>
                      )
                    })}
                  </div>
                )
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={includeAbertos}
            onChange={(e) => setIncludeAbertos(e.target.checked)}
            className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
          />
          Incluir caixas abertos
        </label>
        {selectedKeys.length > 0 && (
          <span className="ml-auto text-[11px] text-gray-400 dark:text-gray-500">
            {selectedKeys.length} de {caixasFiltrados.length} caixas selecionados
          </span>
        )}
      </div>

      {showSkeleton ? (
        <ContentSkeleton />
      ) : noneSelected ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-20 text-center dark:border-gray-700 dark:bg-gray-900">
          <Receipt className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Selecione um ou mais caixas pra ver o relatório
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Use o filtro acima — pode marcar dias inteiros ou caixas individuais.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-blue-950/20 dark:to-gray-900">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Apurado Total</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {formatCurrency(agregados.apurado)}
              </p>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                {selectedKeys.length} {selectedKeys.length === 1 ? 'caixa' : 'caixas'} selecionado{selectedKeys.length === 1 ? '' : 's'}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-emerald-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-emerald-950/20 dark:to-gray-900">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Combustível</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {formatCurrency(agregados.totalCombustivel)}
              </p>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                {agregados.apurado > 0
                  ? `${((agregados.totalCombustivel / agregados.apurado) * 100).toFixed(1).replace('.', ',')}% do apurado`
                  : '—'}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-purple-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-purple-950/20 dark:to-gray-900">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Conveniência</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <Wallet className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {formatCurrency(agregados.conveniencia)}
              </p>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                Apurado − Combustível
              </p>
            </div>

            <div className={cn(
              'rounded-xl border bg-gradient-to-br p-5 shadow-sm',
              agregados.diferencaFechados < -0.005
                ? 'border-red-200 from-red-50/60 to-white dark:border-red-900/40 dark:from-red-950/20 dark:to-gray-900'
                : agregados.diferencaFechados > 0.005
                ? 'border-amber-200 from-amber-50/60 to-white dark:border-amber-900/40 dark:from-amber-950/20 dark:to-gray-900'
                : 'border-gray-200 from-gray-50/60 to-white dark:border-gray-700 dark:from-gray-800/30 dark:to-gray-900',
            )}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Diferença</p>
                <div className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg',
                  agregados.diferencaFechados < -0.005
                    ? 'bg-red-100 dark:bg-red-900/30'
                    : agregados.diferencaFechados > 0.005
                    ? 'bg-amber-100 dark:bg-amber-900/30'
                    : 'bg-gray-100 dark:bg-gray-800',
                )}>
                  <Scale className={cn(
                    'h-5 w-5',
                    agregados.diferencaFechados < -0.005
                      ? 'text-red-600 dark:text-red-400'
                      : agregados.diferencaFechados > 0.005
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-gray-500 dark:text-gray-400',
                  )} />
                </div>
              </div>
              <p className={cn(
                'mt-2 text-2xl font-bold tabular-nums',
                agregados.diferencaFechados < -0.005
                  ? 'text-red-700 dark:text-red-300'
                  : agregados.diferencaFechados > 0.005
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-gray-900 dark:text-gray-100',
              )}>
                {agregados.diferencaFechados > 0 ? '+' : ''}{formatCurrency(agregados.diferencaFechados)}
              </p>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                Caixas fechados · {selectedCaixas.filter((c) => c.fechado).length}/{selectedKeys.length}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-blue-500" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Formas de Pagamento
                  </h3>
                </div>
                {agregados.totalPagamentos > 0 && (
                  <span className="text-[11px] tabular-nums text-gray-400">
                    Total: {formatCurrency(agregados.totalPagamentos)}
                  </span>
                )}
              </div>
              {agregados.pagamentos.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-gray-400">
                  Sem pagamentos registrados nos caixas selecionados.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {agregados.pagamentos.map((p) => {
                    const Icon = paymentIcon(p.tipo)
                    const pct = agregados.totalPagamentos > 0
                      ? (p.valor / agregados.totalPagamentos) * 100
                      : 0
                    return (
                      <li key={p.tipo} className="px-4 py-2.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="flex min-w-0 items-center gap-1.5 truncate font-medium text-gray-900 dark:text-gray-100" title={p.nome}>
                            <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                            <span className="truncate">{p.nome}</span>
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                            {formatCurrency(p.valor)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                            <div className="h-full rounded-full bg-blue-500/70" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="shrink-0 text-[10px] tabular-nums text-gray-400">
                            {formatNumber(p.quantidade)} transaç{p.quantidade === 1 ? 'ão' : 'ões'} · {pct.toFixed(1).replace('.', ',')}%
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Frentistas
                  </h3>
                </div>
                {agregados.totalCombustivel > 0 && (
                  <span className="text-[11px] tabular-nums text-gray-400">
                    Total: {formatCurrency(agregados.totalCombustivel)}
                  </span>
                )}
              </div>
              {agregados.frentistas.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-gray-400">
                  Sem abastecimentos nos caixas selecionados.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {agregados.frentistas.map((f) => {
                    const pct = agregados.totalCombustivel > 0
                      ? (f.faturamento / agregados.totalCombustivel) * 100
                      : 0
                    return (
                      <li key={f.nome} className="px-4 py-2.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0 flex-1 truncate font-medium text-gray-900 dark:text-gray-100" title={f.nome}>
                            {f.nome}
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                            {formatCurrency(f.faturamento)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] tabular-nums text-gray-400">
                          {formatNumber(f.atendimentos)} abast. · {formatNumber(f.litros)} L · {pct.toFixed(1).replace('.', ',')}%
                        </p>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>

          {caixasComDiferenca.length > 0 && (
            <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Sobras e Faltas por Caixa
                </h3>
                <span className="text-[11px] text-gray-400">
                  — {caixasComDiferenca.length} {caixasComDiferenca.length === 1 ? 'caixa' : 'caixas'} com diferença
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Data</th>
                      <th className="px-4 py-2 text-left font-medium">Turno</th>
                      <th className="px-4 py-2 text-left font-medium">Caixa</th>
                      <th className="px-4 py-2 text-left font-medium">Responsável</th>
                      <th className="px-4 py-2 text-right font-medium">Apurado</th>
                      <th className="px-4 py-2 text-right font-medium">Diferença</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {caixasComDiferenca.map((c) => (
                      <tr key={caixaKey(c)} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-2 tabular-nums text-gray-500 dark:text-gray-400">{fmtBRDate(c.dataMovimento)}</td>
                        <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{c.turno}</td>
                        <td className="px-4 py-2 tabular-nums text-gray-500 dark:text-gray-400">#{c.caixaCodigo}</td>
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{c.funcionarioNome}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(c.apurado)}</td>
                        <td className={cn(
                          'px-4 py-2 text-right font-semibold tabular-nums',
                          c.diferenca > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                        )}>
                          {c.diferenca > 0 ? '+' : ''}{formatCurrency(c.diferenca)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

export default VisaoGeral
