import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Fuel, Gauge, AlertTriangle, CheckCircle2, Clock, Wrench, Save, ArrowDown, HelpCircle, Settings, ExternalLink, History, ArrowLeft } from 'lucide-react'
import { formatCurrency, formatNumber, formatLiters } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/store/filters'
import {
  useManutencaoStore,
  type ManutencaoMode,
  type BombaManutencaoRecord,
  getConfigOrDefault,
  getManutencao,
  getManutencaoHistory,
} from '@/store/manutencao'
import type { BombaRow } from '@/pages/Operacao/hooks/useOperacaoData'

interface ControleBombasProps {
  bombaRows: BombaRow[]
  bombaRowsPrev: BombaRow[]
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
  // Wear
  litrosDesdeManutencao: number
  desgastePct: number  // 0-100+
  wearStatus: WearStatus
  manutencao: BombaManutencaoRecord | null
  proximaEstimadaLitros: number  // litros restantes até intervalo
  /** True quando o modo Automático sem registro manual está usando o total do período como base */
  usingAutoBasis: boolean
}

const wearStatusMeta = {
  ok: { label: 'Regular', color: 'green', dot: 'bg-green-500', text: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-gray-200 dark:border-gray-700', barFill: 'bg-green-500' },
  warn: { label: 'Manutenção próxima', color: 'amber', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-300 dark:border-amber-700', barFill: 'bg-amber-500' },
  critical: { label: 'Verificar agora', color: 'red', dot: 'bg-red-500', text: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-500 border-2', barFill: 'bg-red-500' },
  'sem-registro': { label: 'Sem registro', color: 'gray', dot: 'bg-gray-400', text: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700', barFill: 'bg-gray-300' },
} as const

interface ManutBufferEntry { dataUltima: string; litrosUltima: string }

const rankStyle = (pos: number): string => {
  if (pos === 1) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
  if (pos === 2) return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
  if (pos === 3) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
  return 'bg-gray-50 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400'
}

const formatBrDate = (yyyymmdd: string): string => {
  if (!yyyymmdd || yyyymmdd.length < 10) return '-'
  const [y, m, d] = yyyymmdd.split('-')
  return `${d}/${m}/${y}`
}

const ControleBombas = ({ bombaRows, bombaRowsPrev }: ControleBombasProps) => {
  const { empresaCodigos } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null

  const { mode, manutencoes, configs, setMode, setManutencao, clearManutencao } = useManutencaoStore()
  const config = getConfigOrDefault(configs, empresaCodigo)

  // Manual edit buffer per pump.
  // Strings (não numbers) — assim o input fica totalmente controlado pelo
  // que o usuário digita e backspace funciona sem o saved value voltar a aparecer.
  // Conversão para number só acontece em handleSaveManutencao.
  const [manutBuffer, setManutBuffer] = useState<Record<number, ManutBufferEntry>>({})
  const [showHelp, setShowHelp] = useState(false)
  // Bombas com card "virado" mostrando o histórico de manutenções
  const [flippedPumps, setFlippedPumps] = useState<Set<number>>(new Set())
  // Reseta flip ao trocar de empresa (cards remontam com novos códigos).
  // Padrão "store info from previous renders" — set-state durante render
  // a partir da comparação com prev.
  const [prevEmpresa, setPrevEmpresa] = useState(empresaCodigo)
  if (empresaCodigo !== prevEmpresa) {
    setPrevEmpresa(empresaCodigo)
    setFlippedPumps(new Set())
  }

  const toggleFlip = (bombaCodigo: number) => {
    setFlippedPumps((prev) => {
      const next = new Set(prev)
      if (next.has(bombaCodigo)) next.delete(bombaCodigo)
      else next.add(bombaCodigo)
      return next
    })
  }

  // Stats por bomba
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

      // Manutenção e desgaste
      const manutencao = getManutencao(manutencoes, empresaCodigo, bomba.bombaCodigo)
      let litrosDesdeManutencao = 0
      let wearStatus: WearStatus = 'sem-registro'
      let desgastePct = 0
      let usingAutoBasis = false

      if (manutencao) {
        // Tem registro manual → usa data da última manutenção como ponto de partida
        litrosDesdeManutencao = bomba.dailyLitros
          .filter((d) => d.data >= manutencao.dataUltima)
          .reduce((s, d) => s + d.litros, 0)
        desgastePct = config.intervaloLitros > 0
          ? (litrosDesdeManutencao / config.intervaloLitros) * 100
          : 0
        wearStatus = desgastePct > 90 ? 'critical' : desgastePct >= 70 ? 'warn' : 'ok'
      } else if (mode === 'auto' && config.intervaloLitros > 0 && bomba.litrosVendidos > 0) {
        // Modo Automático sem registro manual: usa total bombeado no período como base.
        // Permite ao gerente ver desgaste/alertas só configurando o intervalo (sem precisar
        // registrar manutenção prévia). Reflete "% do intervalo consumido neste período".
        litrosDesdeManutencao = bomba.litrosVendidos
        desgastePct = (litrosDesdeManutencao / config.intervaloLitros) * 100
        wearStatus = desgastePct > 90 ? 'critical' : desgastePct >= 70 ? 'warn' : 'ok'
        usingAutoBasis = true
      }

      const proximaEstimadaLitros = Math.max(0, config.intervaloLitros - litrosDesdeManutencao)

      return {
        bomba,
        litrosMes,
        abastecimentos,
        mediaPorAbastecimento,
        prevMedia,
        mediaQueda,
        mediaCaiu15,
        litrosDesdeManutencao,
        desgastePct,
        wearStatus,
        manutencao,
        usingAutoBasis,
        proximaEstimadaLitros,
      }
    })
  }, [bombaRows, bombaRowsPrev, manutencoes, empresaCodigo, config, mode])

  const handleSaveManutencao = (bombaCodigo: number) => {
    if (empresaCodigo === null) return
    const buf = manutBuffer[bombaCodigo]
    if (!buf || !buf.dataUltima) return
    setManutencao(empresaCodigo, bombaCodigo, {
      dataUltima: buf.dataUltima,
      litrosUltima: Number(buf.litrosUltima) || 0,
    })
    setManutBuffer((prev) => {
      const n = { ...prev }
      delete n[bombaCodigo]
      return n
    })
  }

  const handleClearManutencao = (bombaCodigo: number) => {
    if (empresaCodigo !== null) clearManutencao(empresaCodigo, bombaCodigo)
    setManutBuffer((prev) => {
      const n = { ...prev }
      delete n[bombaCodigo]
      return n
    })
  }

  const updateBuffer = (bombaCodigo: number, patch: Partial<ManutBufferEntry>) => {
    setManutBuffer((prev) => {
      let current = prev[bombaCodigo]
      if (!current) {
        // Primeira edição: seed do valor salvo (caso exista) para que tocar
        // um campo não apague visualmente o outro.
        const saved = empresaCodigo !== null ? getManutencao(manutencoes, empresaCodigo, bombaCodigo) : null
        current = {
          dataUltima: saved?.dataUltima ?? '',
          litrosUltima: saved?.litrosUltima ? String(saved.litrosUltima) : '',
        }
      }
      return { ...prev, [bombaCodigo]: { ...current, ...patch } }
    })
  }

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

      {/* Toggle Auto/Manual */}
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
                showHelp
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              )}
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {mode === 'auto'
              ? 'Desgaste calculado por litros vendidos desde a última manutenção'
              : 'Informe manualmente data e litros da última manutenção por bomba'}
          </p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
          {(['auto', 'manual'] as ManutencaoMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                mode === m
                  ? 'bg-[#1e3a5f] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'
              )}
            >
              {m === 'auto' ? 'Automático' : 'Manual'}
            </button>
          ))}
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
              <span className="font-semibold text-gray-900 dark:text-gray-100">Desgaste</span> = litros vendidos desde a última manutenção ÷ intervalo configurado. Recalcula a cada nova venda.
            </li>
            <li>
              O <span className="font-semibold text-gray-900 dark:text-gray-100">intervalo de litros</span> e o <span className="font-semibold text-gray-900 dark:text-gray-100">% de aviso</span> são definidos por posto em Configurações.
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
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span className="font-semibold text-gray-900 dark:text-gray-100">Regular</span>
              </span>
              <span>desgaste abaixo de 70%</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="font-semibold text-gray-900 dark:text-gray-100">Manutenção próxima</span>
              </span>
              <span>entre 70% e 90% — borda âmbar no card</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span className="font-semibold text-gray-900 dark:text-gray-100">Verificar agora</span>
              </span>
              <span>acima de 90% — borda vermelha 2px no card</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-gray-400" />
                <span className="font-semibold text-gray-900 dark:text-gray-100">Sem registro</span>
              </span>
              <span>nenhuma manutenção registrada para a bomba</span>
            </li>
          </ul>

          <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
            Após registrar a manutenção
          </p>
          <ul className="ml-4 list-disc space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
            <li>
              <span className="font-semibold text-gray-900 dark:text-gray-100">Última manutenção</span> exibe a data informada (DD/MM/AAAA).
            </li>
            <li>
              <span className="font-semibold text-gray-900 dark:text-gray-100">Próxima estimada</span> mostra quantos litros faltam até a bomba atingir o intervalo configurado.
            </li>
            <li>
              A barra de desgaste reinicia a partir da data de manutenção e cresce conforme novos abastecimentos.
            </li>
            <li>
              O botão <span className="font-semibold text-gray-900 dark:text-gray-100">Limpar</span> remove o registro e devolve a bomba para “Sem registro”.
            </li>
          </ul>

          <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
            Modo Automático × Manual
          </p>
          <ul className="ml-4 list-disc space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
            <li>
              <span className="font-semibold text-gray-900 dark:text-gray-100">Automático:</span> não exige registro manual.
              Basta configurar o <span className="font-medium">intervalo de litros</span> em Configurações que cada bomba começa a mostrar desgaste e gerar alertas automaticamente, usando o
              <span className="font-medium"> total vendido no período</span> como base de cálculo.
              A célula "Última manutenção" do card aparece marcada como <span className="font-medium text-blue-600 dark:text-blue-400">Modo auto</span>.
            </li>
            <li>
              <span className="font-semibold text-gray-900 dark:text-gray-100">Manual:</span> habilita o formulário "Registrar manutenção" em cada bomba, permitindo informar data e litros do momento da última troca — o desgaste passa a ser calculado a partir dessa data.
            </li>
            <li>
              Se houver <span className="font-medium">registro manual</span> em uma bomba, ele <span className="font-medium">prevalece</span> sobre o modo Automático para aquela bomba específica (mesmo com o toggle em Auto).
            </li>
          </ul>
        </div>
      )}

      {/* Cards das bombas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {stats.map((s, idx) => {
          const meta = wearStatusMeta[s.wearStatus]
          const buf = manutBuffer[s.bomba.bombaCodigo]
          const rank = idx + 1
          const isFlipped = flippedPumps.has(s.bomba.bombaCodigo)
          const history = getManutencaoHistory(manutencoes, empresaCodigo, s.bomba.bombaCodigo)
          return (
            <div
              key={s.bomba.bombaCodigo}
              className="relative h-full"
              style={{ perspective: '1200px' }}
            >
              <div
                className="relative h-full transition-transform duration-500"
                style={{
                  transformStyle: 'preserve-3d',
                  transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
              >
                {/* ── FRONT FACE ── */}
                <div
                  className={cn(
                    'flex h-full flex-col rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-900',
                    meta.border,
                  )}
                  style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
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
                        className={cn(
                          'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                          rankStyle(rank),
                        )}
                        title={`${rank}º em litros vendidos no período`}
                      >
                        {rank}º
                      </span>
                    </div>
                    {s.bomba.referencia && (
                      <p className="text-[10px] text-gray-400">Ref: {s.bomba.referencia}</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleFlip(s.bomba.bombaCodigo)}
                    title="Ver histórico de manutenções"
                    aria-label="Ver histórico de manutenções"
                    className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                  >
                    <Wrench className="h-3.5 w-3.5" />
                  </button>
                  <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', meta.bg, meta.text)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
                    {meta.label}
                  </span>
                </div>
              </div>

              {/* Combustíveis com litros bombeados.
                  Se temos detalhes (dados do período), mostra como linha tipo
                  "GASOLINA COMUM · 28.500 L". Senão (bicos cadastrados sem
                  movimento ainda), cai pra chips simples só com o nome. */}
              {s.bomba.combustiveisDetalhes.length > 0 ? (
                <ul className="mb-3 space-y-1">
                  {s.bomba.combustiveisDetalhes.map((c) => {
                    const pct = s.bomba.litrosVendidos > 0
                      ? (c.litros / s.bomba.litrosVendidos) * 100
                      : 0
                    return (
                      <li
                        key={c.nome}
                        className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-2 py-1 dark:bg-gray-800/60"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[10px] font-medium uppercase tracking-wide text-gray-700 dark:text-gray-300">
                            {c.nome}
                          </p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500">
                            {pct.toFixed(2)}% da bomba
                          </p>
                        </div>
                        <p className="shrink-0 text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                          {formatLiters(c.litros)}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              ) : s.bomba.combustiveis.length > 0 ? (
                <div className="mb-3 flex flex-wrap gap-1">
                  {s.bomba.combustiveis.map((c) => (
                    <span key={c} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      {c}
                    </span>
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
                  <p className={cn(
                    'flex items-center gap-1 text-sm font-semibold tabular-nums',
                    s.mediaCaiu15 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'
                  )}>
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
                  <div
                    className={cn('h-1.5 rounded-full transition-all', meta.barFill)}
                    style={{ width: `${Math.min(100, s.desgastePct)}%` }}
                  />
                </div>
              </div>

              {/* Última manutenção + próxima estimada */}
              <div className="mb-3 grid grid-cols-2 gap-2 border-t border-gray-100 pt-2 text-[10px] dark:border-gray-800">
                <div>
                  <p className="text-gray-400">Última manutenção</p>
                  <p className="font-medium tabular-nums text-gray-700 dark:text-gray-300">
                    {s.manutencao
                      ? formatBrDate(s.manutencao.dataUltima)
                      : s.usingAutoBasis
                      ? <span className="text-blue-600 dark:text-blue-400">Modo auto</span>
                      : 'Sem registro'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Próxima estimada</p>
                  <p className="font-medium tabular-nums text-gray-700 dark:text-gray-300">
                    {s.manutencao || s.usingAutoBasis ? `+${formatLiters(s.proximaEstimadaLitros)}` : '—'}
                  </p>
                </div>
              </div>

              {/* Modo manual: formulário de registro de manutenção
                  Aparece logo abaixo de "Última manutenção / Próxima estimada" */}
              {mode === 'manual' && (
                <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-800/50">
                  <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    <Wrench className="h-3 w-3" />
                    Registrar manutenção
                  </p>
                  <div className="grid grid-cols-1 gap-1.5">
                    <label className="block">
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">Data da última manutenção</span>
                      <input
                        type="date"
                        value={
                          buf
                            ? buf.dataUltima
                            : s.manutencao?.dataUltima ?? ''
                        }
                        onChange={(e) => updateBuffer(s.bomba.bombaCodigo, { dataUltima: e.target.value })}
                        className="mt-0.5 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">Litros no momento da manutenção</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="Ex: 500.000"
                        value={
                          buf
                            ? buf.litrosUltima
                            : s.manutencao?.litrosUltima ? String(s.manutencao.litrosUltima) : ''
                        }
                        onChange={(e) => updateBuffer(s.bomba.bombaCodigo, { litrosUltima: e.target.value })}
                        className="mt-0.5 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs tabular-nums text-gray-700 placeholder:text-gray-300 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-600"
                      />
                    </label>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      onClick={() => handleSaveManutencao(s.bomba.bombaCodigo)}
                      disabled={!buf?.dataUltima}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors',
                        buf?.dataUltima
                          ? 'bg-[#1e3a5f] text-white hover:bg-[#172d4a]'
                          : 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-700'
                      )}
                    >
                      <Save className="h-3 w-3" />
                      Salvar
                    </button>
                    {(buf || s.manutencao) && (
                      <button
                        onClick={() => handleClearManutencao(s.bomba.bombaCodigo)}
                        title="Limpar dados de manutenção"
                        className="flex items-center justify-center gap-1 rounded-md border border-gray-200 px-2 py-1.5 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Footer info */}
              <div className="mt-auto flex items-center justify-between pt-2 text-[10px] text-gray-400">
                <span>{s.bomba.quantidadeBicos} bico{s.bomba.quantidadeBicos !== 1 ? 's' : ''}</span>
                {s.bomba.ilha > 0 && <span>Ilha {s.bomba.ilha}</span>}
                <span>{formatCurrency(s.bomba.faturamento)}</span>
              </div>
                </div>

                {/* ── BACK FACE: histórico de manutenções ── */}
                <div
                  className="absolute inset-0 flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900"
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  }}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleFlip(s.bomba.bombaCodigo)}
                        title="Voltar para os dados da bomba"
                        aria-label="Voltar"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">{s.bomba.descricao}</p>
                        <p className="text-[10px] text-gray-400">Histórico de manutenções</p>
                      </div>
                    </div>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                      <History className="h-3.5 w-3.5 text-gray-500" />
                    </div>
                  </div>

                  {history.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center text-center">
                      <Wrench className="mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Nenhuma manutenção registrada</p>
                      <p className="mt-1 text-[10px] text-gray-400">Use o modo Manual e o formulário desta bomba para registrar a primeira</p>
                    </div>
                  ) : (
                    <ol className="flex flex-1 flex-col gap-2 overflow-y-auto">
                      {history.map((rec, hIdx) => {
                        const next = history[hIdx + 1]
                        // Δ litros: quanto foi bombeado entre a manutenção atual e a anterior
                        const deltaLitros = next ? rec.litrosUltima - next.litrosUltima : null
                        // Δ dias: quantos dias se passaram entre as duas manutenções
                        let deltaDias: number | null = null
                        if (next?.dataUltima && rec.dataUltima) {
                          const diffMs = new Date(rec.dataUltima).getTime() - new Date(next.dataUltima).getTime()
                          if (diffMs > 0) deltaDias = Math.round(diffMs / (24 * 3600 * 1000))
                        }
                        const isLatest = hIdx === 0
                        return (
                          <li
                            key={`${rec.dataUltima}-${rec.litrosUltima}-${hIdx}`}
                            className={cn(
                              'rounded-lg border px-3 py-2',
                              isLatest
                                ? 'border-blue-200 bg-blue-50/40 dark:border-blue-800/40 dark:bg-blue-900/10'
                                : 'border-gray-200 bg-gray-50/60 dark:border-gray-700 dark:bg-gray-800/40',
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                                {formatBrDate(rec.dataUltima)}
                              </span>
                              <span
                                className={cn(
                                  'rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                                  isLatest
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                    : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
                                )}
                              >
                                {isLatest ? 'Mais recente' : `${hIdx + 1}ª anterior`}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-gray-600 dark:text-gray-400">
                              <span>
                                Litros no momento: <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatLiters(rec.litrosUltima)}</span>
                              </span>
                              {deltaLitros !== null && (
                                <span className="tabular-nums text-gray-500">
                                  +{formatLiters(deltaLitros)}
                                  {deltaDias !== null && ` em ${deltaDias}d`}
                                </span>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                  )}

                  <div className="mt-3 border-t border-gray-100 pt-2 text-center text-[10px] text-gray-400 dark:border-gray-800">
                    Mantém as últimas 4 manutenções
                  </div>
                </div>
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
          {stats.filter((s) => s.wearStatus === 'sem-registro').length} sem registro
        </span>
      </div>
    </div>
  )
}

export default ControleBombas
