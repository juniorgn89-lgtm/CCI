import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Fuel, Gauge, AlertTriangle, CheckCircle2, Clock, Wrench, ArrowDown, HelpCircle, Settings, ExternalLink } from 'lucide-react'
import { formatCurrency, formatNumber, formatLiters } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/store/filters'
import { useManutencaoStore, getConfigOrDefault } from '@/store/manutencao'
import type { BombaRow } from '@/pages/Operacao/hooks/useOperacaoData'

interface ControleBombasProps {
  bombaRows: BombaRow[]
  bombaRowsPrev: BombaRow[]
  /** Posto ativo (config é por-posto). `undefined` = 1º do filtro. */
  empresaCodigo?: number | null
}

type WearStatus = 'ok' | 'warn' | 'critical' | 'sem-registro'

interface BombaStats {
  bomba: BombaRow
  litrosMes: number
  abastecimentos: number
  mediaPorAbastecimento: number
  prevMedia: number
  mediaQueda: number  // pct (-100 to ∞)
  mediaCaiu15: boolean
  // Wear (100% automático: litros do período ÷ intervalo configurado)
  desgastePct: number  // 0-100+
  wearStatus: WearStatus
  proximaEstimadaLitros: number  // litros restantes até o intervalo
}

const wearStatusMeta = {
  ok: { label: 'Regular', color: 'green', dot: 'bg-green-500', text: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-gray-200 dark:border-gray-700', barFill: 'bg-green-500' },
  warn: { label: 'Manutenção próxima', color: 'amber', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-300 dark:border-amber-700', barFill: 'bg-amber-500' },
  critical: { label: 'Verificar agora', color: 'red', dot: 'bg-red-500', text: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-500 border-2', barFill: 'bg-red-500' },
  'sem-registro': { label: 'Sem movimento', color: 'gray', dot: 'bg-gray-400', text: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700', barFill: 'bg-gray-300' },
} as const

const rankStyle = (pos: number): string => {
  if (pos === 1) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
  if (pos === 2) return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
  if (pos === 3) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
  return 'bg-gray-50 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400'
}

const ControleBombas = ({ bombaRows, bombaRowsPrev, empresaCodigo: empresaCodigoProp }: ControleBombasProps) => {
  const { empresaCodigos } = useFilterStore()
  const empresaCodigo = empresaCodigoProp !== undefined ? empresaCodigoProp : (empresaCodigos[0] ?? null)

  const { configs } = useManutencaoStore()
  const config = getConfigOrDefault(configs, empresaCodigo)

  const [showHelp, setShowHelp] = useState(false)

  // Stats por bomba — desgaste 100% automático: litros vendidos no período ÷
  // intervalo configurado por posto. Sem registro manual.
  const stats = useMemo<BombaStats[]>(() => {
    const prevMap = new Map<number, BombaRow>()
    for (const b of bombaRowsPrev) prevMap.set(b.bombaCodigo, b)

    return bombaRows.map((bomba) => {
      const prev = prevMap.get(bomba.bombaCodigo)
      const litrosMes = bomba.litrosVendidos
      const abastecimentos = bomba.abastecimentos
      const mediaPorAbastecimento = abastecimentos > 0 ? litrosMes / abastecimentos : 0
      const prevMedia = prev && prev.abastecimentos > 0 ? prev.litrosVendidos / prev.abastecimentos : 0
      const mediaQueda = prevMedia > 0 ? ((mediaPorAbastecimento - prevMedia) / prevMedia) * 100 : 0
      const mediaCaiu15 = prevMedia > 0 && mediaQueda <= -15

      let desgastePct = 0
      let wearStatus: WearStatus = 'sem-registro'
      if (config.intervaloLitros > 0 && litrosMes > 0) {
        desgastePct = (litrosMes / config.intervaloLitros) * 100
        wearStatus = desgastePct > 90 ? 'critical' : desgastePct >= 70 ? 'warn' : 'ok'
      }
      const proximaEstimadaLitros = Math.max(0, config.intervaloLitros - litrosMes)

      return {
        bomba,
        litrosMes,
        abastecimentos,
        mediaPorAbastecimento,
        prevMedia,
        mediaQueda,
        mediaCaiu15,
        desgastePct,
        wearStatus,
        proximaEstimadaLitros,
      }
    })
  }, [bombaRows, bombaRowsPrev, config])

  if (bombaRows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <Gauge className="mx-auto h-8 w-8 text-gray-300" />
        <p className="mt-2 text-sm text-gray-400">Nenhuma bomba encontrada.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Controle de manutenção</h3>
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              aria-expanded={showHelp}
              aria-label="Como funciona o controle de manutenção"
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded-full transition-colors',
                showHelp ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-blue-600 dark:hover:text-blue-400',
              )}
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Desgaste calculado automaticamente: litros vendidos no período ÷ intervalo configurado
          </p>
        </div>
      </div>

      {/* Painel de ajuda */}
      {showHelp && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-sm dark:border-blue-800/40 dark:bg-blue-900/20">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
            Como funciona
          </p>
          <ul className="ml-4 list-disc space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
            <li>
              <span className="font-semibold text-gray-900 dark:text-gray-100">Desgaste</span> = litros vendidos no período ÷ intervalo configurado. Recalcula a cada nova venda.
            </li>
            <li>
              O <span className="font-semibold text-gray-900 dark:text-gray-100">intervalo de litros</span> e o <span className="font-semibold text-gray-900 dark:text-gray-100">% de aviso</span> são o <span className="font-semibold text-gray-900 dark:text-gray-100">padrão por posto</span>, definido em Configurações e exibido em cada card.
            </li>
          </ul>
          <Link
            to="/configuracoes#manutencao-bombas"
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-50 hover:border-blue-400 dark:border-blue-700/60 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
          >
            <Settings className="h-3.5 w-3.5" />
            Ir para configuração das bombas
            <ExternalLink className="h-3 w-3 opacity-70" />
          </Link>

          <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
            Status visuais
          </p>
          <ul className="ml-4 list-disc space-y-1 text-xs text-gray-700 dark:text-gray-300">
            <li className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500" /><span className="font-semibold text-gray-900 dark:text-gray-100">Regular</span></span>
              <span>desgaste abaixo de 70%</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /><span className="font-semibold text-gray-900 dark:text-gray-100">Manutenção próxima</span></span>
              <span>entre 70% e 90% — borda âmbar no card</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /><span className="font-semibold text-gray-900 dark:text-gray-100">Verificar agora</span></span>
              <span>acima de 90% — borda vermelha 2px no card</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gray-400" /><span className="font-semibold text-gray-900 dark:text-gray-100">Sem movimento</span></span>
              <span>a bomba não vendeu no período</span>
            </li>
          </ul>
        </div>
      )}

      {/* Cards das bombas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {stats.map((s, idx) => {
          const meta = wearStatusMeta[s.wearStatus]
          const rank = idx + 1
          return (
            <div
              key={s.bomba.bombaCodigo}
              className={cn(
                'flex h-full flex-col rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-900',
                meta.border,
              )}
            >
              {/* Header */}
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
                    <Fuel className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">{s.bomba.descricao}</p>
                      <span
                        className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums', rankStyle(rank))}
                        title={`${rank}º em litros vendidos no período`}
                      >
                        {rank}º
                      </span>
                    </div>
                    {s.bomba.referencia && <p className="text-[10px] text-gray-400">Ref: {s.bomba.referencia}</p>}
                  </div>
                </div>
                <span className={cn('flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', meta.bg, meta.text)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
                  {meta.label}
                </span>
              </div>

              {/* Combustíveis com litros bombeados */}
              {s.bomba.combustiveisDetalhes.length > 0 ? (
                <ul className="mb-3 space-y-1">
                  {s.bomba.combustiveisDetalhes.map((c) => {
                    const pct = s.bomba.litrosVendidos > 0 ? (c.litros / s.bomba.litrosVendidos) * 100 : 0
                    return (
                      <li key={c.nome} className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-2 py-1 dark:bg-gray-800/60">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[10px] font-medium uppercase tracking-wide text-gray-700 dark:text-gray-300">{c.nome}</p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500">{pct.toFixed(2)}% da bomba</p>
                        </div>
                        <p className="shrink-0 text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatLiters(c.litros)}</p>
                      </li>
                    )
                  })}
                </ul>
              ) : s.bomba.combustiveis.length > 0 ? (
                <div className="mb-3 flex flex-wrap gap-1">
                  {s.bomba.combustiveis.map((c) => (
                    <span key={c} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">{c}</span>
                  ))}
                </div>
              ) : null}

              {/* Stats */}
              <div className="mb-3 grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Litros/mês</p>
                  <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatLiters(s.litrosMes)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Abastec.</p>
                  <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(s.abastecimentos)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Média/abast.</p>
                  <p className={cn('flex items-center gap-1 text-sm font-semibold tabular-nums', s.mediaCaiu15 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100')}>
                    {s.mediaCaiu15 && <ArrowDown className="h-3 w-3" />}
                    {formatLiters(s.mediaPorAbastecimento)}
                  </p>
                </div>
              </div>

              {/* Wear bar */}
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between text-[10px]">
                  <span className="text-gray-500 dark:text-gray-400">Desgaste</span>
                  <span className={cn('font-semibold tabular-nums', meta.text)}>
                    {s.wearStatus === 'sem-registro' ? '—' : `${Math.min(100, s.desgastePct).toFixed(2)}%`}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                  <div className={cn('h-1.5 rounded-full transition-all', meta.barFill)} style={{ width: `${Math.min(100, s.desgastePct)}%` }} />
                </div>
              </div>

              {/* Padrão configurado + próxima estimada */}
              <div className="mb-3 grid grid-cols-2 gap-2 border-t border-gray-100 pt-2 text-[10px] dark:border-gray-800">
                <div>
                  <p className="text-gray-400">Intervalo padrão</p>
                  <p className="font-medium tabular-nums text-gray-700 dark:text-gray-300">
                    {formatLiters(config.intervaloLitros)} · avisa {config.avisarAoAtingirPct}%
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Próxima estimada</p>
                  <p className="font-medium tabular-nums text-gray-700 dark:text-gray-300">
                    {s.litrosMes > 0 ? `+${formatLiters(s.proximaEstimadaLitros)}` : '—'}
                  </p>
                </div>
              </div>

              {/* Footer info */}
              <div className="mt-auto flex items-center justify-between pt-2 text-[10px] text-gray-400">
                <span>{s.bomba.quantidadeBicos} bico{s.bomba.quantidadeBicos !== 1 ? 's' : ''}</span>
                {s.bomba.ilha > 0 && <span>Ilha {s.bomba.ilha}</span>}
                <span>{formatCurrency(s.bomba.faturamento)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Sumário visual de status (rodapé contextual) */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          {stats.filter((s) => s.wearStatus === 'ok').length} regular
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-amber-500" />
          {stats.filter((s) => s.wearStatus === 'warn').length} próximas
        </span>
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
          {stats.filter((s) => s.wearStatus === 'critical').length} críticas
        </span>
        <span className="flex items-center gap-1.5">
          <Wrench className="h-3.5 w-3.5 text-gray-400" />
          {stats.filter((s) => s.wearStatus === 'sem-registro').length} sem movimento
        </span>
      </div>
    </div>
  )
}

export default ControleBombas
