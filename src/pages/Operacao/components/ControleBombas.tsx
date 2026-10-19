import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Gauge, AlertTriangle, CheckCircle2, Clock, Wrench, ArrowDown, HelpCircle, Settings, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react'
import { formatCurrency, formatNumber, formatLiters } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/store/filters'
import { useManutencaoConfigs, useManutencoesPosto, diaLocal } from '@/pages/Operacao/hooks/useManutencaoBombas'
import type { BombaManutencaoRow } from '@/api/supabase/manutencaoBombas'
import RowActionButton from '@/components/tables/RowAction'
import ManutencaoBombaModal from '@/pages/Operacao/components/ManutencaoBombaModal'
import type { BombaRow } from '@/pages/Operacao/hooks/useOperacaoData'

const somaDiasBR = (dias: number) => {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  const base = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
  return dias > 300 ? `${base}/${String(d.getFullYear()).slice(2)}` : base
}

interface ControleBombasProps {
  bombaRows: BombaRow[]
  bombaRowsPrev: BombaRow[]
  /** Posto ativo (config é por-posto). `undefined` = 1º do filtro. */
  empresaCodigo?: number | null
  /** Modo grupo (Manutenção com vários postos): cabeçalho do posto + Recolher. */
  grupo?: { nome: string; onRecolher?: () => void }
  /** Histórico de manutenção do posto (registrar/excluir). */
  manut?: ReturnType<typeof useManutencoesPosto>
  /** true = os dados vieram desde a manutenção mais antiga (além do filtro). */
  periodoEstendido?: boolean
  /** Filtro da aba (status, só sem registro, busca pelo nome da bomba). */
  filtro?: FiltroBombas
}

export interface FiltroBombas {
  status: 'todos' | WearStatus
  semRegistro: boolean
  busca: string
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
  /** Litros que contam no desgaste (desde a manutenção, ou o período). */
  litrosBase: number
  /** Dia (yyyy-MM-dd) da última manutenção registrada; null = sem registro. */
  baseDesde: string | null
  /** Dias desde a base (para o ritmo diário da próxima manutenção). */
  diasBase: number
  ultima: BombaManutencaoRow | null
}

/** Preferência local: explicação do controle de manutenção aberta. */
const HELP_KEY = 'visor360.manutencao.ajudaAberta'

const wearStatusMeta = {
  ok: { label: 'Regular', color: 'green', dot: 'bg-green-500', text: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-gray-200 dark:border-gray-700', barFill: 'bg-green-500' },
  warn: { label: 'Manutenção próxima', color: 'amber', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-300 dark:border-amber-700', barFill: 'bg-amber-500' },
  critical: { label: 'Verificar agora', color: 'red', dot: 'bg-red-500', text: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-500 border-2', barFill: 'bg-red-500' },
  'sem-registro': { label: 'Sem movimento', color: 'gray', dot: 'bg-gray-400', text: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700', barFill: 'bg-gray-300' },
} as const


/** Título "Manutenção das bombas" + explicação "Como funciona" (uma vez no topo
 *  da aba, valendo para todos os postos). Lembra se ficou aberta no navegador. */
export const CabecalhoManutencao = () => {
  // Lembra se a explicação ficou aberta (por navegador): sobrevive ao refresh.
  const [showHelp, setShowHelpState] = useState(() => {
    try { return localStorage.getItem(HELP_KEY) === '1' } catch { return false }
  })
  const setShowHelp = (fn: (v: boolean) => boolean) => setShowHelpState((v) => {
    const nv = fn(v)
    try { localStorage.setItem(HELP_KEY, nv ? '1' : '0') } catch { /* sem storage: só não lembra */ }
    return nv
  })

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Manutenção das bombas</h3>
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
            Desgaste = litros vendidos desde a última manutenção registrada ÷ intervalo configurado
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
              <span className="font-semibold text-gray-900 dark:text-gray-100">Desgaste</span> = litros vendidos desde a última manutenção registrada ÷ intervalo configurado. Recalcula a cada nova venda. Sem manutenção registrada, conta os litros do período do filtro.
            </li>
            <li>
              <span className="font-semibold text-gray-900 dark:text-gray-100">Manutenções</span>, em cada bomba: registre a manutenção feita (data e hora, responsável e observação) e veja o histórico. O desgaste recomeça a partir dela, contando o dia inteiro da manutenção. Só o master corrige um registro.
            </li>
            <li>
              O <span className="font-semibold text-gray-900 dark:text-gray-100">intervalo de litros</span> e o <span className="font-semibold text-gray-900 dark:text-gray-100">% de aviso</span> são o <span className="font-semibold text-gray-900 dark:text-gray-100">padrão por posto</span>, definido em Configuração › Parâmetros e exibido em cada card.
            </li>
          </ul>
          <Link
            to="/painel/config#manutencao-bombas"
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
              <span>desgaste abaixo do aviso configurado no posto (padrão 80%)</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /><span className="font-semibold text-gray-900 dark:text-gray-100">Manutenção próxima</span></span>
              <span>do aviso configurado em Parâmetros até 90% — linha âmbar</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /><span className="font-semibold text-gray-900 dark:text-gray-100">Verificar agora</span></span>
              <span>acima de 90% (ou do aviso, se ele for maior) — linha vermelha</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gray-400" /><span className="font-semibold text-gray-900 dark:text-gray-100">Sem movimento</span></span>
              <span>a bomba não vendeu no período</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}

const ControleBombas = ({ bombaRows, bombaRowsPrev, empresaCodigo: empresaCodigoProp, grupo, manut, periodoEstendido = false, filtro }: ControleBombasProps) => {
  const { empresaCodigos } = useFilterStore()
  const empresaCodigo = empresaCodigoProp !== undefined ? empresaCodigoProp : (empresaCodigos[0] ?? null)

  // Config do posto salva no SISTEMA (cai no navegador/padrão enquanto não salva).
  const config = useManutencaoConfigs().get(empresaCodigo).config
  const [modalBomba, setModalBomba] = useState<BombaRow | null>(null)

  // Stats por bomba — desgaste 100% automático: litros vendidos no período ÷
  // intervalo configurado por posto. Sem registro manual.
  // Faixas do status: o aviso segue o "Avisar ao atingir (%)" configurado no
  // posto (antes era 70% fixo e ignorava a configuração); crítico acima de 90%
  // (ou acima do aviso, se ele for configurado acima de 90%).
  const faixaAviso = config.avisarAoAtingirPct > 0 ? config.avisarAoAtingirPct : 80
  // Dias do período até hoje (base do "litros por dia" que vira a próxima em dias).
  const { dataInicial, dataFinal } = useFilterStore()
  const diasPeriodo = (() => {
    if (!dataInicial || !dataFinal) return 0
    const hoje = new Date(); const fim = new Date(`${dataFinal}T00:00:00`)
    const ate = fim > hoje ? hoje : fim
    return Math.max(1, Math.round((ate.getTime() - new Date(`${dataInicial}T00:00:00`).getTime()) / 86_400_000) + 1)
  })()
  const [aberto, setAberto] = useState<number | null>(null)
  const hojeStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
  const faixaCritica = Math.max(90, faixaAviso)
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

      // Base do desgaste: litros DESDE a última manutenção registrada; sem
      // registro, os litros do período do filtro (como antes).
      const ultima = manut?.ultimaPorBomba.get(bomba.bombaCodigo) ?? null
      const baseDesde = ultima ? diaLocal(ultima.feita_em) : null
      const somaDias = (de: string, ate: string) => bomba.dailyLitros.reduce((acc, d) => (d.data >= de && d.data <= ate ? acc + d.litros : acc), 0)
      const litrosPeriodo = periodoEstendido ? somaDias(dataInicial, dataFinal) : litrosMes
      const litrosBase = baseDesde ? somaDias(baseDesde, '9999-12-31') : litrosPeriodo
      const diasBase = baseDesde
        ? Math.max(1, Math.round((Date.parse(`${hojeStr}T00:00:00`) - Date.parse(`${baseDesde}T00:00:00`)) / 86_400_000) + 1)
        : diasPeriodo
      let desgastePct = 0
      let wearStatus: WearStatus = 'sem-registro'
      if (config.intervaloLitros > 0 && litrosBase > 0) {
        desgastePct = (litrosBase / config.intervaloLitros) * 100
        wearStatus = desgastePct > faixaCritica ? 'critical' : desgastePct >= faixaAviso ? 'warn' : 'ok'
      }
      const proximaEstimadaLitros = Math.max(0, config.intervaloLitros - litrosBase)

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
        litrosBase,
        baseDesde,
        diasBase,
        ultima,
      }
    })
  }, [bombaRows, bombaRowsPrev, config, faixaAviso, faixaCritica, manut, periodoEstendido, dataInicial, dataFinal, diasPeriodo, hojeStr])

  // Linhas visíveis: mais desgastada primeiro, respeitando o filtro da aba.
  const busca = (filtro?.busca ?? '').trim().toLowerCase()
  const filtrando = !!filtro && (filtro.status !== 'todos' || filtro.semRegistro || busca !== '')
  const visiveis = [...stats]
    .sort((a, b) => b.desgastePct - a.desgastePct)
    .filter((x) => !filtro || filtro.status === 'todos' || x.wearStatus === filtro.status)
    .filter((x) => !filtro?.semRegistro || !x.ultima)
    .filter((x) => !busca || x.bomba.descricao.toLowerCase().includes(busca) || (x.bomba.referencia ?? '').toLowerCase().includes(busca))
  const criticas = stats.filter((x) => x.wearStatus === 'critical').length
  const proximas = stats.filter((x) => x.wearStatus === 'warn').length
  const maisGasta = [...stats].sort((a, b) => b.desgastePct - a.desgastePct)[0] ?? null

  if (bombaRows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
        <Gauge className="mx-auto h-8 w-8 text-gray-300" />
        <p className="mt-2 text-sm text-gray-400">{grupo ? `${grupo.nome}: nenhuma bomba com movimento no período.` : 'Nenhuma bomba encontrada.'}</p>
      </div>
    )
  }

  return (
    <div className={grupo ? 'space-y-2' : 'space-y-5'}>
      {grupo && (
        <div className={cn('flex flex-wrap items-center gap-2 px-1', criticas > 0 && 'text-red-700 dark:text-red-300')}>
          <span className={cn('h-2.5 w-2.5 rounded-full', criticas > 0 ? 'bg-red-500' : proximas > 0 ? 'bg-amber-500' : 'bg-green-500')} />
          <h4 className="text-[13px] font-bold uppercase tracking-wide text-gray-900 dark:text-gray-100">{grupo.nome}</h4>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {stats.length} bomba{stats.length === 1 ? '' : 's'}
            {maisGasta && maisGasta.wearStatus !== 'sem-registro' && <> · mais desgastada: <b className="font-semibold text-gray-700 dark:text-gray-200">{maisGasta.bomba.descricao} {Math.round(Math.min(100, maisGasta.desgastePct))}%</b></>}
            {criticas > 0 && <b className="ml-1 font-semibold text-red-600 dark:text-red-400">· {criticas} para verificar agora</b>}
            {criticas === 0 && proximas > 0 && <b className="ml-1 font-semibold text-amber-600 dark:text-amber-400">· {proximas} com manutenção próxima</b>}
          </span>
          {grupo.onRecolher && (
            <button type="button" onClick={grupo.onRecolher} className="ml-auto inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:border-[#2563eb] hover:text-[#2563eb] dark:border-gray-700 dark:text-gray-300">
              <ChevronDown className="h-3.5 w-3.5" />Recolher
            </button>
          )}
        </div>
      )}

      {manut && !filtrando && !manut.isLoading && manut.ultimaPorBomba.size === 0 && (
        <p className="px-1 text-[11px] text-gray-500 dark:text-gray-400">
          Nenhuma manutenção registrada neste posto: o desgaste conta os litros do período do filtro. Use <b className="font-semibold">Manutenções</b> na bomba para lançar a última feita; a partir dela o desgaste conta sozinho.
        </p>
      )}

      {/* Filtrando e nada deste posto bate: só a linha, sem tabela vazia. */}
      {filtrando && visiveis.length === 0 ? (
        <p className="px-1 text-[11px] text-gray-400">Nenhuma bomba deste posto no filtro escolhido.</p>
      ) : (
      /* Uma linha por bomba (mais desgastada primeiro); clique abre o detalhe. */
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
        <table className="w-full min-w-[760px] table-fixed text-[12.5px]">
          <thead className="border-b border-gray-100 text-[10px] uppercase tracking-wide text-gray-400 dark:border-gray-800 dark:text-gray-500">
            <tr className="text-left">
              <th className="w-[15%] px-4 py-2.5 font-semibold">Bomba</th>
              <th className="w-[13%] px-3 py-2.5 font-semibold">Status</th>
              <th className="w-[19%] px-3 py-2.5 font-semibold">Desgaste</th>
              <th className="w-[12%] px-3 py-2.5 text-right font-semibold">Litros</th>
              <th className="w-[15%] px-3 py-2.5 font-semibold">Próxima manutenção</th>
              <th className="w-[21%] px-3 py-2.5 font-semibold">Última manutenção</th>
              <th className="w-[5%] px-4 py-2.5 text-right font-semibold">Ilha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {visiveis.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-4 text-center text-[12px] text-gray-400">Nenhuma bomba deste posto no filtro escolhido.</td></tr>
            )}
            {visiveis.map((s) => {
              const meta = wearStatusMeta[s.wearStatus]
              const aberta = aberto === s.bomba.bombaCodigo
              const porDia = s.diasBase > 0 ? s.litrosBase / s.diasBase : 0
              const diasAte = porDia > 0 ? Math.ceil(s.proximaEstimadaLitros / porDia) : null
              return (
                <Fragment key={s.bomba.bombaCodigo}>
                  <tr onClick={() => setAberto(aberta ? null : s.bomba.bombaCodigo)} className={cn('cursor-pointer hover:bg-gray-50/70 dark:hover:bg-gray-800/30', s.wearStatus === 'critical' && 'bg-red-50/40 dark:bg-red-950/10', s.wearStatus === 'warn' && 'bg-amber-50/40 dark:bg-amber-950/10')}>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-gray-900 dark:text-gray-100">
                        {aberta ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                        {s.bomba.descricao}
                      </span>
                      <span className="ml-5 block text-[11px] text-gray-400">{s.bomba.quantidadeBicos} bico{s.bomba.quantidadeBicos !== 1 ? 's' : ''}{s.bomba.referencia ? ` · ref. ${s.bomba.referencia}` : ''}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', meta.bg, meta.text)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />{meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                          <div className={cn('h-1.5 rounded-full', meta.barFill)} style={{ width: `${Math.min(100, s.desgastePct)}%` }} />
                        </div>
                        <span className={cn('w-12 text-right text-[11px] font-semibold tabular-nums', meta.text)}>
                          {s.wearStatus === 'sem-registro' ? '—' : `${Math.round(Math.min(100, s.desgastePct))}%`}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <span className="font-semibold text-gray-800 dark:text-gray-100">{formatLiters(s.litrosBase)}</span>
                      <span className="block text-[11px] text-gray-400">{s.baseDesde ? `desde ${s.baseDesde.split('-').reverse().slice(0, 2).join('/')}` : 'no período'}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {s.litrosBase <= 0 ? <span className="text-gray-400">—</span> : s.proximaEstimadaLitros <= 0 ? (
                        <span className="font-semibold text-red-600 dark:text-red-400">já passou do intervalo</span>
                      ) : (
                        <span className={cn('tabular-nums', s.wearStatus === 'critical' ? 'font-semibold text-red-600 dark:text-red-400' : s.wearStatus === 'warn' ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-200')}>
                          {diasAte != null ? `~${diasAte} dia${diasAte === 1 ? '' : 's'} (${somaDiasBR(diasAte)})` : '—'}
                          <span className="block text-[11px] font-normal text-gray-400">faltam {formatLiters(s.proximaEstimadaLitros)}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 text-[11.5px]">
                          {s.ultima ? (
                            <>
                              <span className="block truncate font-semibold text-gray-800 dark:text-gray-100">{new Date(s.ultima.feita_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                              <span className="block truncate text-[11px] text-gray-400">{s.ultima.responsavel ?? 'sem responsável'}</span>
                            </>
                          ) : <span className="text-gray-400">nenhuma registrada</span>}
                        </span>
                        {manut && <RowActionButton icon={Wrench} label="Manutenções" onClick={() => setModalBomba(s.bomba)} />}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{s.bomba.ilha > 0 ? s.bomba.ilha : '—'}</td>
                  </tr>
                  {aberta && (
                    <tr className="bg-gray-50/60 dark:bg-gray-800/20">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                          <ul className="space-y-1">
                            {s.bomba.combustiveisDetalhes.length > 0 ? s.bomba.combustiveisDetalhes.map((c) => {
                              const pct = s.bomba.litrosVendidos > 0 ? (c.litros / s.bomba.litrosVendidos) * 100 : 0
                              return (
                                <li key={c.nome} className="flex items-center gap-3 text-[12px]">
                                  <span className="w-44 truncate font-medium text-gray-700 dark:text-gray-200">{c.nome}</span>
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"><div className="h-1.5 rounded-full bg-[#2563eb]/70" style={{ width: `${pct}%` }} /></div>
                                  <span className="w-12 text-right text-[11px] tabular-nums text-gray-400">{Math.round(pct)}%</span>
                                  <span className="w-20 text-right font-semibold tabular-nums text-gray-800 dark:text-gray-100">{formatLiters(c.litros)}</span>
                                </li>
                              )
                            }) : <li className="text-[12px] text-gray-400">{s.bomba.combustiveis.join(' · ') || 'Sem venda por combustível no período.'}</li>}
                          </ul>
                          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] md:grid-cols-1">
                            <div className="flex justify-between gap-3"><dt className="text-gray-400">Abastecimentos</dt><dd className="font-semibold tabular-nums text-gray-800 dark:text-gray-100">{formatNumber(s.abastecimentos)}</dd></div>
                            <div className="flex justify-between gap-3"><dt className="text-gray-400">Média por abastecimento</dt><dd className={cn('inline-flex items-center gap-1 font-semibold tabular-nums', s.mediaCaiu15 ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-100')}>{s.mediaCaiu15 && <ArrowDown className="h-3 w-3" />}{formatLiters(s.mediaPorAbastecimento)}</dd></div>
                            <div className="flex justify-between gap-3"><dt className="text-gray-400">Faturamento</dt><dd className="font-semibold tabular-nums text-gray-800 dark:text-gray-100">{formatCurrency(s.bomba.faturamento)}</dd></div>
                            <div className="flex justify-between gap-3"><dt className="text-gray-400">Intervalo · aviso</dt><dd className="font-semibold tabular-nums text-gray-800 dark:text-gray-100">{formatLiters(config.intervaloLitros)} · {faixaAviso}%</dd></div>
                          </dl>
                        </div>
                        {s.mediaCaiu15 && <p className="mt-2 text-[11px] text-red-600 dark:text-red-400">A média por abastecimento caiu mais de 15% em relação ao período anterior: vale conferir a bomba.</p>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      )}

      {modalBomba && manut && (
        <ManutencaoBombaModal
          key={modalBomba.bombaCodigo}
          open
          onClose={() => setModalBomba(null)}
          bomba={modalBomba.descricao}
          posto={grupo?.nome ?? ''}
          registros={manut.porBomba.get(modalBomba.bombaCodigo) ?? []}
          responsavelPadrao={config.responsavel}
          onRegistrar={(iso, r, o) => manut.registrar(modalBomba.bombaCodigo, iso, r, o)}
          onExcluir={manut.excluir}
          podeExcluir={manut.podeExcluir}
        />
      )}

      {/* Sumário de status — só fora do modo grupo (no grupo o cabeçalho resume). */}
      {!grupo && (
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
      )}
    </div>
  )
}

export default ControleBombas
