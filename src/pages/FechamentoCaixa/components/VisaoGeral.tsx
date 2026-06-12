import { useMemo, useState } from 'react'
import {
  Receipt, Banknote, CreditCard, Smartphone, Wallet,
  DollarSign, Scale, TrendingUp, Users, AlertTriangle, ChevronRight,
} from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import { Skeleton } from '@/components/ui/skeleton'
import { useFilterStore } from '@/store/filters'
import { cn } from '@/lib/utils'
import useOperacaoData from '@/pages/Operacao/hooks/useOperacaoData'
import useShowSkeleton from '@/hooks/useShowSkeleton'
import useCartaoBreakdown from '@/pages/FechamentoCaixa/hooks/useCartaoBreakdown'
import CartaoDetalheModal from './CartaoDetalheModal'
import CaixaSelect, { type CaixaOption } from './CaixaSelect'

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

/** Diferença exibida = apresentado − apurado (fecha por subtração, igual às
 *  outras abas); sem apresentado do caixa, cai na diferença oficial do /CAIXA. */
const difCaixa = (c: { apresentadoTotal: number | null; apurado: number; diferenca: number }): number =>
  c.apresentadoTotal != null ? c.apresentadoTotal - c.apurado : c.diferenca

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
  const [cartaoOpen, setCartaoOpen] = useState(false)

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

  const caixaOptions: CaixaOption[] = useMemo(
    () =>
      caixasFiltrados.map((c) => ({
        key: caixaKey(c),
        dataIso: c.dataMovimento.substring(0, 10),
        dataLabel: fmtBRDate(c.dataMovimento.substring(0, 10)),
        turno: c.turno,
        turnoCodigo: c.turnoCodigo,
        caixaLabel: `Caixa #${c.caixaCodigo}`,
        subLabel: `${c.funcionarioNome} · A: ${formatIsoTime(c.abertura)} F: ${formatIsoTime(c.fechamento)}`,
        pdvLabel: c.pdvLabel,
        fechado: c.fechado,
        apurado: c.apurado,
        diferenca: difCaixa(c),
      })),
    [caixasFiltrados],
  )

  const selectedCaixas = useMemo(
    () => caixasFiltrados.filter((c) => selectedKeys.includes(caixaKey(c))),
    [caixasFiltrados, selectedKeys],
  )

  // Quebra do cartão (débito/crédito + bandeira) — busca /VENDA sob demanda.
  const selectedCaixaCodigos = useMemo(() => selectedCaixas.map((c) => c.caixaCodigo), [selectedCaixas])
  const pdvByCaixa = useMemo(
    () => new Map(selectedCaixas.map((c) => [c.caixaCodigo, c.pdvLabel])),
    [selectedCaixas],
  )
  const cartao = useCartaoBreakdown(selectedCaixaCodigos, pdvByCaixa, cartaoOpen)

  const noneSelected = selectedKeys.length === 0

  const agregados = useMemo(() => {
    const apurado = selectedCaixas.reduce((s, c) => s + c.apurado, 0)
    const diferencaFechados = selectedCaixas
      .filter((c) => c.fechado)
      .reduce((s, c) => s + difCaixa(c), 0)

    // Formas de pagamento: preferimos o apresentado POR CAIXA
    // (/CAIXA_APRESENTADO) — separa Pista × Loja de verdade. Sem esse dado,
    // caímos no balde do DIA inteiro (a forma não tem caixaCodigo); aí contamos
    // uma vez POR DIA pra não duplicar quando há vários caixas do mesmo dia.
    const usaApresentado = selectedCaixas.some((c) => c.apresentadoFormas.length > 0)
    const pgtoMap = new Map<string, { tipo: string; nome: string; valor: number; quantidade: number }>()
    if (usaApresentado) {
      for (const c of selectedCaixas) {
        for (const p of c.apresentadoFormas) {
          const prev = pgtoMap.get(p.tipo) ?? { tipo: p.tipo, nome: p.nome, valor: 0, quantidade: 0 }
          prev.valor += p.valor
          prev.quantidade += p.quantidade
          pgtoMap.set(p.tipo, prev)
        }
      }
    } else {
      const diasContados = new Set<string>()
      for (const c of selectedCaixas) {
        const dia = c.dataMovimento?.slice(0, 10) ?? String(c.caixaCodigo)
        if (diasContados.has(dia)) continue
        diasContados.add(dia)
        for (const p of c.pagamentos) {
          const prev = pgtoMap.get(p.tipo) ?? { tipo: p.tipo, nome: p.nome, valor: 0, quantidade: 0 }
          prev.valor += p.valor
          prev.quantidade += p.quantidade
          pgtoMap.set(p.tipo, prev)
        }
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
        .filter((c) => c.fechado && Math.abs(difCaixa(c)) > 0.005)
        .sort((a, b) => Math.abs(difCaixa(b)) - Math.abs(difCaixa(a))),
    [selectedCaixas],
  )

  return (
    <div className="space-y-4">
      <CaixaSelect
        options={caixaOptions}
        selectedKeys={selectedKeys}
        onChange={setSelectedKeys}
        includeAbertos={includeAbertos}
        onIncludeAbertosChange={setIncludeAbertos}
        loading={showSkeleton}
        rightSlot={
          selectedKeys.length > 0 ? (
            <span className="ml-auto text-[11px] text-gray-400 dark:text-gray-500">
              {selectedKeys.length} de {caixasFiltrados.length} caixas selecionados
            </span>
          ) : undefined
        }
      />

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
                  ? `${((agregados.totalCombustivel / agregados.apurado) * 100).toFixed(0).replace('.', ',')}% do apurado`
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
                    const isCartao = p.tipo.toUpperCase().includes('CARTAO') || p.nome.toUpperCase().includes('CART')
                    return (
                      <li key={p.tipo} className="px-4 py-2.5">
                        <div
                          className={cn('flex items-center justify-between gap-2 text-xs', isCartao && 'cursor-pointer')}
                          onClick={isCartao ? () => setCartaoOpen(true) : undefined}
                          title={isCartao ? 'Ver débito/crédito por bandeira' : p.nome}
                        >
                          <span className="flex min-w-0 items-center gap-1.5 truncate font-medium text-gray-900 dark:text-gray-100">
                            <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                            <span className="truncate">{p.nome}</span>
                            {isCartao && (
                              <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-blue-50 px-1 py-0.5 text-[9px] font-semibold text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                                detalhar <ChevronRight className="h-2.5 w-2.5" />
                              </span>
                            )}
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
                            {p.quantidade > 0 ? `${formatNumber(p.quantidade)} transaç${p.quantidade === 1 ? 'ão' : 'ões'} · ` : ''}{pct.toFixed(0).replace('.', ',')}%
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
                          {formatNumber(f.atendimentos)} abast. · {formatNumber(f.litros)} L · {pct.toFixed(0).replace('.', ',')}%
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
                          difCaixa(c) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                        )}>
                          {difCaixa(c) > 0 ? '+' : ''}{formatCurrency(difCaixa(c))}
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

      <CartaoDetalheModal
        open={cartaoOpen}
        onClose={() => setCartaoOpen(false)}
        linhas={cartao.linhas}
        total={cartao.total}
        pdvs={cartao.pdvs}
        isLoading={cartao.isLoading}
      />
    </div>
  )
}

export default VisaoGeral
