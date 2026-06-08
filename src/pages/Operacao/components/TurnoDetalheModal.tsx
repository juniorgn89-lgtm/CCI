import { useMemo } from 'react'
import {
  Wallet, Fuel, Users, Clock, Calendar, TrendingUp, DollarSign, Receipt,
  Banknote, CreditCard, Smartphone, Scale, AlertTriangle,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency, formatNumber, formatLiters, formatDate } from '@/lib/formatters'
import type { TurnoGroup } from '@/pages/Operacao/hooks/useOperacaoData'

interface TurnoDetalheModalProps {
  open: boolean
  onClose: () => void
  turno: TurnoGroup | null
}

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

const TurnoDetalheModal = ({ open, onClose, turno }: TurnoDetalheModalProps) => {
  const stats = useMemo(() => {
    if (!turno) return null
    const totalCombustivel = turno.frentistas.reduce((s, f) => s + f.faturamento, 0)
    const conveniencia = Math.max(0, turno.apuradoTotal - totalCombustivel)
    const totalLitros = turno.frentistas.reduce((s, f) => s + f.litros, 0)
    const totalAbast = turno.frentistas.reduce((s, f) => s + f.atendimentos, 0)
    const esperado = turno.apuradoTotal - turno.diferencaTotal
    return { totalCombustivel, conveniencia, totalLitros, totalAbast, esperado }
  }, [turno])

  if (!turno || !stats) return null

  const dataLabel = turno.dataMovimento
    ? turno.dataMovimento.split('-').reverse().join('/')
    : '-'
  const horarioLabel = `${formatIsoTime(turno.abertura)} - ${turno.fechado ? formatIsoTime(turno.fechamento) : 'Aberto'}`
  const totalPagamentos = turno.pagamentos.reduce((s, p) => s + p.valor, 0)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-500" />
              {turno.turno} · {dataLabel}
              {!turno.fechado ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute h-2 w-2 animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative h-2 w-2 rounded-full bg-green-500" />
                  </span>
                  Ao vivo
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  Fechado
                </span>
              )}
            </span>
          </DialogTitle>
          <DialogDescription>
            Detalhamento do turno — abastecimentos, apurado e formas de pagamento
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-auto">
          {/* Faixa de contexto */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800/50">
            <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(turno.dataMovimento)}
            </span>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <Clock className="h-3.5 w-3.5" />
              {horarioLabel}
            </span>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <Users className="h-3.5 w-3.5" />
              {turno.responsaveis.length > 0 ? turno.responsaveis.join(' · ') : 'Sem responsável'}
            </span>
          </div>

          {/* KPIs */}
          <section className="rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              Indicadores
            </div>
            <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
              <Kpi Icon={TrendingUp} label="Apurado" value={formatCurrency(turno.apuradoTotal)} />
              {turno.fechado && (
                <Kpi Icon={DollarSign} label="Esperado" value={formatCurrency(stats.esperado)} />
              )}
              {turno.fechado && (
                <Kpi
                  Icon={Scale}
                  label="Diferença"
                  value={`${turno.diferencaTotal > 0 ? '+' : ''}${formatCurrency(turno.diferencaTotal)}`}
                  tone={turno.diferencaTotal > 0.005 ? 'positive' : turno.diferencaTotal < -0.005 ? 'negative' : undefined}
                />
              )}
              <Kpi Icon={Fuel} label="Combustível" value={formatCurrency(stats.totalCombustivel)} />
              {stats.conveniencia > 0 && (
                <Kpi Icon={Wallet} label="Conveniência" value={formatCurrency(stats.conveniencia)} />
              )}
              <Kpi Icon={Receipt} label="Abastecimentos" value={formatNumber(stats.totalAbast)} />
              <Kpi Icon={Fuel} label="Litros" value={formatLiters(stats.totalLitros)} />
            </div>
          </section>

          {/* Seções: frentistas + pagamentos lado a lado */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* Abastecimentos por frentista */}
            <section className="rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                <Users className="h-3.5 w-3.5" />
                Frentistas do Turno
              </div>
              {turno.frentistas.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-gray-400">Sem abastecimentos.</p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {turno.frentistas
                    .slice()
                    .sort((a, b) => b.faturamento - a.faturamento)
                    .map((f) => (
                      <li key={f.nome} className="px-3 py-2">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate font-medium text-gray-900 dark:text-gray-100" title={f.nome}>
                            {f.nome}
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                            {formatCurrency(f.faturamento)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] tabular-nums text-gray-400">
                          {formatNumber(f.atendimentos)} abast. · {formatLiters(f.litros)}
                        </p>
                      </li>
                    ))}
                </ul>
              )}
            </section>

            {/* Formas de pagamento */}
            <section className="rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                <Wallet className="h-3.5 w-3.5" />
                Formas de Pagamento
              </div>
              {turno.pagamentos.length === 0 ? (
                // Sem detalhamento mas com apurado > 0 → sinal de sync falhada
                // entre apuracao_caixas e apuracao_formas_pagamento. Sugere
                // re-apurar; se o cache ainda voltar vazio depois disso, é
                // problema upstream (API Quality não retornou as formas).
                turno.apuradoTotal > 0 ? (
                  <div className="m-3 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                          Detalhamento indisponível
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300/80">
                          O turno fechou com {formatCurrency(turno.apuradoTotal)} mas a quebra por forma
                          de pagamento não foi sincronizada. Reapure o mês em
                          <span className="font-medium"> /admin/apuracao</span>. Se persistir, o
                          endpoint de formas pode ter falhado naquele dia.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="px-3 py-6 text-center text-xs text-gray-400">Sem pagamentos.</p>
                )
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {turno.pagamentos
                    .slice()
                    .sort((a, b) => b.valor - a.valor)
                    .map((p) => {
                      const PgtoIcon = paymentIcon(p.tipo)
                      const pct = totalPagamentos > 0 ? (p.valor / totalPagamentos) * 100 : 0
                      return (
                        <li key={p.tipo} className="px-3 py-2">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="flex min-w-0 items-center gap-1.5 truncate font-medium text-gray-900 dark:text-gray-100" title={p.nome}>
                              <PgtoIcon className="h-3 w-3 shrink-0 text-gray-400" />
                              <span className="truncate">{p.nome}</span>
                            </span>
                            <span className="shrink-0 font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                              {formatCurrency(p.valor)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[10px] tabular-nums text-gray-400">
                            {formatNumber(p.quantidade)} transaç{p.quantidade === 1 ? 'ão' : 'ões'} · {pct.toFixed(0).replace('.', ',')}%
                          </p>
                        </li>
                      )
                    })}
                </ul>
              )}
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const Kpi = ({
  Icon,
  label,
  value,
  tone,
}: {
  Icon: typeof Wallet
  label: string
  value: string
  tone?: 'positive' | 'negative'
}) => (
  <div className={cn(
    'rounded-lg border p-2.5',
    tone === 'positive'
      ? 'border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white dark:border-emerald-900/50 dark:from-emerald-950/30 dark:to-gray-900'
      : tone === 'negative'
      ? 'border-red-200 bg-gradient-to-br from-red-50/70 to-white dark:border-red-900/50 dark:from-red-950/30 dark:to-gray-900'
      : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
  )}>
    <div className="flex items-center justify-between">
      <p className={cn(
        'text-[10px] font-semibold uppercase tracking-wider',
        tone === 'positive' ? 'text-emerald-700 dark:text-emerald-300'
          : tone === 'negative' ? 'text-red-700 dark:text-red-300'
          : 'text-gray-500 dark:text-gray-400',
      )}>
        {label}
      </p>
      <Icon className={cn(
        'h-3.5 w-3.5',
        tone === 'positive' ? 'text-emerald-500'
          : tone === 'negative' ? 'text-red-500'
          : 'text-gray-400',
      )} />
    </div>
    <p className={cn(
      'mt-1 text-sm font-bold tabular-nums',
      tone === 'positive' ? 'text-emerald-700 dark:text-emerald-300'
        : tone === 'negative' ? 'text-red-700 dark:text-red-300'
        : 'text-gray-900 dark:text-gray-100',
    )}>
      {value}
    </p>
  </div>
)

export default TurnoDetalheModal
