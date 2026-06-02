import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, CheckCircle2, Clock, Loader2, Play, RefreshCw, AlertCircle, Database, Network, ChevronRight,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'
import { useFilterStore } from '@/store/filters'
import { fetchRedes, type RedeRow } from '@/api/supabase/redes'
import {
  fetchApuracaoStatusByMonth,
  upsertApuracaoDiaria,
  computeApuracaoRows,
  computeFuelProdutoRows,
  upsertApuracaoFuelDiaria,
  upsertAbastecimentosCache,
  abastecimentoToCacheRow,
  buildCostMapFromLmc,
  upsertCaixasCache,
  caixaToCacheRow,
  upsertFormasPagamentoCache,
  formaPagamentoToCacheRow,
  upsertVendasCache,
  deleteVendasCachePeriodo,
  deleteCachePeriodo,
  fetchVendasCache,
  aggregateVendaItensToCache,
  aggregateVendaItensToFuncionarioCache,
  upsertVendasFuncionarioCache,
  fetchUserNamesByIds,
  type ApuracaoMonthMetadata,
  type ProdutoInfo,
  type SetorVenda,
} from '@/api/supabase/apuracao'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchAbastecimentosChunked } from '@/api/helpers/fetchAbastecimentosChunked'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { fetchLmc } from '@/api/endpoints/combustiveis'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchVendaResumo, fetchVendaFormasPagamento, fetchVendaItens, fetchVendaCodigosAutorizados } from '@/api/endpoints/vendas'
import { fetchCaixas } from '@/api/endpoints/financeiro'
import { cn } from '@/lib/utils'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const

type MonthStatus = 'apurado' | 'parcial' | 'nao_apurado' | 'futuro' | 'em_andamento' | 'erro'

interface MonthState {
  status: MonthStatus
  expected: number
  actual: number
  error?: string
  /** Última apuração — quem rodou (nome ou null) + quando (ISO ou null). */
  lastComputedAt?: string | null
  lastComputedByName?: string | null
}

/** Diferença entre data passada e agora em "há X". Curto e direto. */
const relativeTime = (iso: string): string => {
  const past = new Date(iso).getTime()
  if (!isFinite(past)) return ''
  const diffSec = (Date.now() - past) / 1000
  if (diffSec < 60) return 'agora'
  if (diffSec < 3600) return `há ${Math.floor(diffSec / 60)} min`
  if (diffSec < 86400) return `há ${Math.floor(diffSec / 3600)}h`
  if (diffSec < 30 * 86400) return `há ${Math.floor(diffSec / 86400)} ${Math.floor(diffSec / 86400) === 1 ? 'dia' : 'dias'}`
  if (diffSec < 365 * 86400) return `há ${Math.floor(diffSec / (30 * 86400))} m`
  return `há ${Math.floor(diffSec / (365 * 86400))} a`
}

const formatAbsoluteTime = (iso: string): string => {
  const d = new Date(iso)
  if (!isFinite(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const padMonth = (m: number) => String(m).padStart(2, '0')

const lastDayOfMonth = (year: number, month: number) =>
  new Date(year, month, 0).getDate()

const todayParts = () => {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }
}

const threeMonthsBefore = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setMonth(dt.getMonth() - 3)
  return `${dt.getFullYear()}-${padMonth(dt.getMonth() + 1)}-${padMonth(dt.getDate())}`
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Calcula o último dia do mês que conta como "fechado" (anterior ao dia de
 * hoje). Pra mês passado = lastDayOfMonth. Pra mês corrente = ontem ou null.
 */
const closedEndForMonth = (year: number, month: number): string | null => {
  const today = todayParts()
  // Mês inteiro futuro
  if (year > today.year || (year === today.year && month > today.month)) return null
  const lastDay = lastDayOfMonth(year, month)
  // Mês inteiro passado
  if (year < today.year || (year === today.year && month < today.month)) {
    return `${year}-${padMonth(month)}-${padMonth(lastDay)}`
  }
  // Mês corrente — ontem
  if (today.day <= 1) return null
  return `${today.year}-${padMonth(today.month)}-${padMonth(today.day - 1)}`
}

const expectedRowsForMonth = (year: number, month: number, empresasCount: number): number => {
  const end = closedEndForMonth(year, month)
  if (!end) return 0
  const start = `${year}-${padMonth(month)}-01`
  // Conta dias entre start e end
  const startDate = new Date(year, month - 1, 1)
  const endParts = end.split('-').map(Number)
  const endDate = new Date(endParts[0], endParts[1] - 1, endParts[2])
  const days = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1
  return days * empresasCount
  // start is unused as variable but kept for clarity
  void start
}

const Apuracao = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const rede = useTenantStore((s) => s.rede)
  const setRede = useTenantStore((s) => s.setRede)
  const setEmpresas = useFilterStore((s) => s.setEmpresas)

  // Gate: master OU supervisor com pode_apurar=true. Já vem da auth store
  // (bootstrap consolida is_master + pode_apurar em canApurar).
  const isMaster = useAuthStore((s) => s.isMaster)
  const canApurar = useAuthStore((s) => s.canApurar)
  const authLoading = useAuthStore((s) => s.isLoading)
  const currentUser = useAuthStore((s) => s.user)
  const hasAccess = isMaster || canApurar

  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)

  // Empresas da rede atual — usado pra calcular o expected count por mês.
  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas({ limite: 200 }),
    enabled: hasAccess && !!rede,
    staleTime: 10 * 60 * 1000,
  })
  const empresas = empresasData?.resultados ?? []
  const empresasCount = empresas.length

  // Redes disponíveis pro master escolher quando não há nenhuma conectada —
  // permite apurar direto daqui sem passar por /selecionar-rede.
  const { data: redesList = [], isLoading: redesLoading } = useQuery({
    queryKey: ['redes'],
    queryFn: fetchRedes,
    enabled: hasAccess && !rede && isMaster,
    staleTime: 5 * 60 * 1000,
  })

  // Conecta a rede escolhida (mesmo fluxo do /selecionar-rede): seta o tenant,
  // limpa caches e o filtro de empresa. A tela já reflete a rede na sequência.
  const handleConectar = (r: RedeRow) => {
    queryClient.clear()
    setEmpresas([])
    setRede({ id: r.id, nome: r.nome, chave: r.chave, api_base_url: r.api_base_url })
  }

  // Status do ano selecionado — mapa mês → metadata (count + last apuração).
  const { data: statusMap, isLoading: loadingStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['apuracao-status', rede?.id, year],
    queryFn: () => rede ? fetchApuracaoStatusByMonth(rede.id, year) : new Map<number, ApuracaoMonthMetadata>(),
    enabled: hasAccess && !!rede,
    staleTime: 60 * 1000,
  })

  // Resolve user_ids dos lastComputedBy → nomes (via profiles).
  const lastComputedByIds = useMemo(() => {
    if (!statusMap) return [] as string[]
    const ids: string[] = []
    for (const meta of statusMap.values()) {
      if (meta.lastComputedBy) ids.push(meta.lastComputedBy)
    }
    return ids
  }, [statusMap])

  const { data: userNames } = useQuery({
    queryKey: ['apuracao-user-names', lastComputedByIds.slice().sort().join(',')],
    queryFn: () => fetchUserNamesByIds(lastComputedByIds),
    enabled: lastComputedByIds.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  const nameFor = (userId: string | null | undefined): string | null => {
    if (!userId) return null
    const info = userNames?.get(userId)
    if (!info) return null
    return info.full_name || info.email || null
  }

  // Estado por mês durante apuração (em_andamento / erro)
  const [progress, setProgress] = useState<Map<number, MonthState>>(new Map())
  const [running, setRunning] = useState(false)

  const computeStatus = (month: number): MonthState => {
    const ongoing = progress.get(month)
    if (ongoing && (ongoing.status === 'em_andamento' || ongoing.status === 'erro')) {
      return ongoing
    }
    const expected = expectedRowsForMonth(year, month, empresasCount)
    const meta = statusMap?.get(month)
    const actual = meta?.count ?? 0
    const audit = {
      lastComputedAt: meta?.lastComputedAt ?? null,
      lastComputedByName: nameFor(meta?.lastComputedBy),
    }
    if (expected === 0) return { status: 'futuro', expected: 0, actual, ...audit }
    if (actual >= expected) return { status: 'apurado', expected, actual, ...audit }
    if (actual === 0) return { status: 'nao_apurado', expected, actual, ...audit }
    return { status: 'parcial', expected, actual, ...audit }
  }

  /**
   * Apura um mês: fetcha live da Quality + upsert no Supabase. Sequencial.
   */
  const apurarMes = async (month: number): Promise<{ ok: boolean; rows: number; error?: string }> => {
    if (!rede) return { ok: false, rows: 0, error: 'Sem rede conectada' }
    const end = closedEndForMonth(year, month)
    if (!end) return { ok: false, rows: 0, error: 'Mês ainda futuro' }
    const start = `${year}-${padMonth(month)}-01`

    setProgress((prev) => new Map(prev).set(month, { status: 'em_andamento', expected: expectedRowsForMonth(year, month, empresasCount), actual: 0 }))
    try {
      const empresasCodes = empresas.map((e) => e.codigo)
      const lmcStart = threeMonthsBefore(start)

      // Caixas e formas de pagamento são per-empresa (endpoint exige empresaCodigo).
      // Iteramos sequencialmente por empresa pra não estourar rate limit.
      const fetchCaixasAllEmpresas = async () => {
        const all = [] as Awaited<ReturnType<typeof fetchCaixas>>['resultados']
        for (const ec of empresasCodes) {
          const rows = await fetchAllPages(
            (p) => fetchCaixas({ empresaCodigo: ec, dataInicial: start, dataFinal: end, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
            1000, 20,
          )
          all.push(...rows)
        }
        return all
      }
      const fetchFormasAllEmpresas = async () => {
        const all = [] as Awaited<ReturnType<typeof fetchVendaFormasPagamento>>['resultados']
        for (const ec of empresasCodes) {
          const rows = await fetchAllPages(
            (p) => fetchVendaFormasPagamento({ empresaCodigo: ec, dataInicial: start, dataFinal: end, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
            1000, 20,
          )
          all.push(...rows)
        }
        return all
      }
      // Itens de venda da loja (Conveniência) — per-empresa, paginado por cursor.
      const fetchVendaItensAllEmpresas = async () => {
        const all = [] as Awaited<ReturnType<typeof fetchVendaItens>>['resultados']
        for (const ec of empresasCodes) {
          const r = await fetchAllPages(
            (p) => fetchVendaItens({
              empresaCodigo: ec,
              dataInicial: start, dataFinal: end,
              usaProdutoLmc: false,  // produtoCodigo real (casa com o catálogo da Conveniência)
              ultimoCodigo: p.ultimoCodigo, limite: p.limite,
            }),
            1000, 200
          )
          all.push(...r)
        }
        return all
      }
      // vendaCodigo AUTORIZADOS (por empresa) — o /VENDA_ITEM não traz `cancelada`,
      // então cruzamos venda_item.vendaCodigo = venda.vendaCodigo e mantemos só os
      // itens cuja venda está autorizada (/VENDA situacao='A'), igual ao BI.
      const fetchAutorizadosAllEmpresas = async () => {
        const set = new Set<number>()
        for (const ec of empresasCodes) {
          const s = await fetchVendaCodigosAutorizados({ empresaCodigo: ec, dataInicial: start, dataFinal: end })
          for (const c of s) set.add(c)
        }
        return set
      }

      const [abast, lmc, resumo, caixas, formasPgto, vendaItens, produtos, grupos, autorizados] = await Promise.all([
        fetchAbastecimentosChunked({ dataInicial: start, dataFinal: end }),
        fetchAllPages(
          (p) => fetchLmc({
            empresaCodigo: empresasCodes,
            dataInicial: lmcStart, dataFinal: end,
            ultimoCodigo: p.ultimoCodigo, limite: p.limite,
          }),
          1000, 50
        ),
        fetchVendaResumo({ dataInicial: start, dataFinal: end }),
        fetchCaixasAllEmpresas(),
        fetchFormasAllEmpresas(),
        fetchVendaItensAllEmpresas(),
        fetchAllPages((p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 20),
        fetchAllPages((p) => fetchGrupos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 20),
        fetchAutorizadosAllEmpresas(),
      ])

      const rows = computeApuracaoRows({
        redeId: rede.id,
        empresaCodigos: empresasCodes,
        dataInicial: start,
        dataFinal: end,
        abastecimentos: abast,
        lmc,
        vendaResumo: resumo,
        produtos,
      })

      // Quebra por produto (custo CMV+LMC) — alimenta o gráfico "Últimos 12
      // meses" com custo/margem e filtro por combustível.
      const fuelRows = computeFuelProdutoRows({
        redeId: rede.id,
        dataInicial: start,
        dataFinal: end,
        abastecimentos: abast,
        lmc,
        produtos,
        vendaItens,
        autorizados,
      })

      // Grava em paralelo as 4 tabelas do cache. CostMap (montado do LMC, com
      // aliases de produto) entra em cada abast row pra que o front dispense
      // LMC live na leitura — mesma resolução de custo da apuração diária.
      const costMap = buildCostMapFromLmc(lmc, produtos)
      const abastRows = abast.map((a) => abastecimentoToCacheRow(a, rede.id, costMap))
      const caixaRows = caixas
        .map((c) => caixaToCacheRow(c, rede.id))
        .filter((r) => !!r.data_movimento)  // safety: skip rows sem data
      const formaRows = formasPgto.map((f) => formaPagamentoToCacheRow(f, rede.id))
      // Carimba setor + nome de cada produto na apuração (congela a classificação).
      // Espelha EXATAMENTE as medidas do BI de referência:
      //   combustível  = tipoProduto "C"            (qualquer grupo)
      //   automotivos  = tipoGrupo "Pista" e ≠ "C"
      //   conveniência = tipoGrupo "Conveniência"
      //   resto        = "outros" (fora dos setores, igual ao BI)
      const grupoTipoPorCodigo = new Map(grupos.map((g) => [g.grupoCodigo, g.tipoGrupo]))
      const grupoNomePorCodigo = new Map(grupos.map((g) => [g.grupoCodigo, g.nome]))
      const produtoInfo = new Map<number, ProdutoInfo>()
      for (const p of produtos) {
        const tipoGrupo = grupoTipoPorCodigo.get(p.grupoCodigo) ?? ''
        const setor: SetorVenda =
          p.tipoProduto === 'C' ? 'combustivel'
            : tipoGrupo === 'Pista' ? 'automotivos'
              : tipoGrupo === 'Conveniência' ? 'conveniencia'
                : 'outros'
        produtoInfo.set(p.produtoCodigo, { setor, nome: p.nome, grupo: grupoNomePorCodigo.get(p.grupoCodigo) ?? 'Sem grupo' })
      }
      const vendaRows = aggregateVendaItensToCache(vendaItens, rede.id, produtoInfo, autorizados)
      // Produtividade de vendedores da loja (apuracao_vendas_funcionario):
      // agrega por (empresa, dia, funcionario, setor) — só conveniência/pista.
      const vendaFuncRows = aggregateVendaItensToFuncionarioCache(vendaItens, rede.id, produtoInfo, autorizados)
      // Remove ÓRFÃOS (chaves que existiam no cache mas sumiram do cálculo — ex.:
      // venda cancelada depois de uma apuração anterior). Duas camadas:
      //  1) DELETE do período (best-effort; pode ser no-op por RLS de DELETE).
      //  2) TOMBSTONE: lê o que sobrou, e regrava com ZERO as chaves ausentes do
      //     novo cálculo (UPDATE via upsert — funciona mesmo sem permissão de
      //     DELETE). Sem isso a Central continua somando linhas mortas.
      await deleteVendasCachePeriodo(rede.id, start, end)
      const existentesVendas = await fetchVendasCache({ empresaCodigos: empresasCodes, dataInicial: start, dataFinal: end })
      const novasKeys = new Set(vendaRows.map((r) => `${r.empresa_codigo}|${r.data}|${r.produto_codigo}`))
      const tombstones = existentesVendas
        .filter((r) => !novasKeys.has(`${r.empresa_codigo}|${r.data}|${r.produto_codigo}`))
        .map((r) => ({
          rede_id: rede.id, empresa_codigo: r.empresa_codigo, data: r.data, produto_codigo: r.produto_codigo,
          setor: r.setor as SetorVenda, produto_nome: r.produto_nome,
          quantidade: 0, total_venda: 0, total_custo: 0, acrescimos: 0, descontos: 0, linhas: 0, cupons: 0,
          cupons_grupo: 0, cupons_produto: 0,
        }))
      // apuracao_vendas_funcionario tem policy de DELETE (ver SQL), então o
      // deleteCachePeriodo abaixo já remove os órfãos — sem tombstone (evita uma
      // leitura paginada extra por mês, que pesava na apuração).
      // Fecha as portas de órfão nas demais tabelas de cache: apaga o período
      // antes de regravar (precisa das policies de DELETE no Supabase).
      await Promise.all([
        deleteCachePeriodo('apuracao_diaria', 'data', rede.id, start, end),
        deleteCachePeriodo('apuracao_fuel_diaria', 'data', rede.id, start, end),
        deleteCachePeriodo('apuracao_abastecimentos', 'data_fiscal', rede.id, start, end),
        deleteCachePeriodo('apuracao_caixas', 'data_movimento', rede.id, start, end),
        deleteCachePeriodo('apuracao_formas_pagamento', 'data_movimento', rede.id, start, end),
        deleteCachePeriodo('apuracao_vendas_funcionario', 'data', rede.id, start, end),
      ])
      await Promise.all([
        upsertApuracaoDiaria(rows, currentUser?.id),
        upsertApuracaoFuelDiaria(fuelRows, currentUser?.id),
        upsertAbastecimentosCache(abastRows),
        upsertCaixasCache(caixaRows),
        upsertFormasPagamentoCache(formaRows),
        upsertVendasCache([...vendaRows, ...tombstones], currentUser?.id),
        upsertVendasFuncionarioCache(vendaFuncRows, currentUser?.id),
      ])
      return { ok: true, rows: rows.length }
    } catch (e) {
      const msg = (e as Error).message || 'Erro desconhecido'
      setProgress((prev) => new Map(prev).set(month, { status: 'erro', expected: 0, actual: 0, error: msg }))
      return { ok: false, rows: 0, error: msg }
    }
  }

  const handleApurarMes = async (month: number) => {
    setRunning(true)
    await apurarMes(month)
    await refetchStatus()
    // Re-apurar reescreve TODAS as tabelas de cache; invalida o React Query
    // inteiro pra que Central, Conveniência, Dashboard etc. releiam na hora
    // (as chaves rede-vendas-* da Central não casavam com 'apuracao-cache').
    queryClient.invalidateQueries()
    setProgress((prev) => {
      const next = new Map(prev)
      next.delete(month)
      return next
    })
    setRunning(false)
  }

  const handleApurarAno = async () => {
    setRunning(true)
    const today = todayParts()
    const maxMonth = year < today.year ? 12 : today.month
    for (let m = 1; m <= maxMonth; m++) {
      // Só pula meses futuros (sem dados). Meses 'apurado' SÃO reapurados
      // — útil pra preencher colunas/tabelas novas (ex: apuracao_abastecimentos)
      // ou pegar correções retroativas da API Quality.
      const current = computeStatus(m)
      if (current.status === 'futuro') continue
      await apurarMes(m)
      await refetchStatus()
      // Pausa entre meses pra evitar storm na API
      if (m < maxMonth) await sleep(800)
    }
    // Invalida o React Query inteiro — re-apurar reescreveu todas as tabelas
    // de cache e cada tela lê com chaves próprias (rede-vendas-*, apuracao-*…).
    queryClient.invalidateQueries()
    setProgress(new Map())
    setRunning(false)
  }

  if (authLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Você não tem permissão para apurar dados. Peça ao administrador para liberar.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
      </div>
    )
  }

  if (!rede) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <Database className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">
          Nenhuma rede conectada
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Escolha a rede que deseja apurar.
        </p>

        {!isMaster ? (
          <button
            onClick={() => navigate('/selecionar-rede')}
            className="mt-4 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#162d4a]"
          >
            Selecionar rede
          </button>
        ) : redesLoading ? (
          <div className="mt-5 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : redesList.length === 0 ? (
          <p className="mt-5 text-xs text-gray-500 dark:text-gray-400">Nenhuma rede cadastrada.</p>
        ) : (
          <div className="mx-auto mt-5 max-w-sm space-y-2 text-left">
            {redesList.map((r) => (
              <button
                key={r.id}
                onClick={() => handleConectar(r)}
                className="group flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/50 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-800/50 dark:hover:bg-blue-900/10"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
                  <Network className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {r.nome}
                </span>
                <span className="shrink-0 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  Conectar
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" />
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
  const today = todayParts()

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e3a5f]">
            <Database className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">Apuração</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Pré-carregue meses fechados pra que o supervisor abra o dashboard sem espera —{' '}
              <strong>rede {rede.nome}</strong>
            </p>
          </div>
        </div>
        <button
          onClick={handleApurarAno}
          disabled={running || empresasCount === 0}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
            running || empresasCount === 0
              ? 'cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
              : 'bg-[#1e3a5f] text-white hover:bg-[#162d4a]'
          )}
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Apurar ano todo
        </button>
      </div>

      {/* Year selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Ano</span>
        <div className="flex flex-wrap gap-1.5">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              disabled={running}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                y === year
                  ? 'bg-[#1e3a5f] text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
                running && 'cursor-not-allowed opacity-50'
              )}
            >
              {y}
            </button>
          ))}
        </div>
        <button
          onClick={() => refetchStatus()}
          disabled={loadingStatus}
          className="ml-auto inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <RefreshCw className={cn('h-3 w-3', loadingStatus && 'animate-spin')} />
          Atualizar status
        </button>
      </div>

      {/* Loading status */}
      {loadingStatus ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : empresasCount === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Nenhuma empresa encontrada na rede — verifique a CHAVE Quality em /admin/redes.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {MESES.map((label, idx) => {
            const month = idx + 1
            const state = computeStatus(month)
            const isFutureMonth = year > today.year || (year === today.year && month > today.month)
            const isCurrentMonth = year === today.year && month === today.month
            return (
              <MonthCard
                key={month}
                label={label}
                month={month}
                state={state}
                isFutureMonth={isFutureMonth}
                isCurrentMonth={isCurrentMonth}
                disabled={running}
                onApurar={() => handleApurarMes(month)}
              />
            )
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500">
        Apuração faz fetch live da API Quality e grava no Supabase. Mês fechado
        completo fica imutável; mês corrente cobre só dias passados (hoje
        continua sempre live). Funciona apenas na rede atualmente conectada.
      </p>
    </div>
  )
}

interface MonthCardProps {
  label: string
  month: number
  state: MonthState
  isFutureMonth: boolean
  isCurrentMonth: boolean
  disabled: boolean
  onApurar: () => void
}

const MonthCard = ({ label, state, isFutureMonth, isCurrentMonth, disabled, onApurar }: MonthCardProps) => {
  const { Icon, color, statusLabel } = (() => {
    switch (state.status) {
      case 'em_andamento':
        // Pulse (não spin) — o usuário pediu o nome piscando em vez de girando.
        return { Icon: Loader2, color: 'text-blue-600 dark:text-blue-400 animate-pulse', statusLabel: 'Apurando...' }
      case 'apurado':
        return { Icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', statusLabel: 'Apurado' }
      case 'parcial':
        return { Icon: Clock, color: 'text-amber-600 dark:text-amber-400', statusLabel: `Parcial ${state.actual}/${state.expected}` }
      case 'nao_apurado':
        return { Icon: Clock, color: 'text-gray-400', statusLabel: 'Não apurado' }
      case 'futuro':
        return { Icon: Clock, color: 'text-gray-300 dark:text-gray-600', statusLabel: 'Futuro' }
      case 'erro':
        return { Icon: AlertCircle, color: 'text-red-600 dark:text-red-400', statusLabel: state.error ?? 'Erro' }
    }
  })()

  const canApurar = !disabled && !isFutureMonth && state.status !== 'em_andamento'

  // Aviso no mês corrente: quantos dias fechados existem hoje, pra lembrar
  // que sempre há dados pendentes mesmo após uma apuração — todo dia que
  // vira, novo dia "fechado" entra pra fila e o status escorrega de
  // 'apurado' pra 'parcial'.
  const today = new Date()
  const closedDaysCurrentMonth = Math.max(0, today.getDate() - 1)
  const showCurrentMonthHint =
    isCurrentMonth &&
    closedDaysCurrentMonth > 0 &&
    state.status !== 'em_andamento' &&
    state.status !== 'futuro' &&
    state.status !== 'erro'
  const allCovered = state.status === 'apurado'

  return (
    <div
      className={cn(
        'rounded-xl border bg-white p-3 transition-colors dark:bg-gray-900',
        state.status === 'apurado'
          ? 'border-emerald-200 dark:border-emerald-900/40'
          : state.status === 'em_andamento'
          ? 'border-blue-300 dark:border-blue-700'
          : state.status === 'erro'
          ? 'border-red-200 dark:border-red-900/40'
          : 'border-gray-200 dark:border-gray-700',
        (isFutureMonth || state.status === 'futuro') && 'opacity-50'
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</p>
        {isCurrentMonth && (
          <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
            atual
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5 shrink-0', color)} />
        <span className={cn('truncate text-xs font-medium', color)} title={statusLabel}>
          {statusLabel}
        </span>
      </div>

      {/* Audit info — quem rodou a última apuração + quando.
          Aparece só pra meses com pelo menos 1 row gravada (apurado ou parcial). */}
      {state.lastComputedAt && (state.status === 'apurado' || state.status === 'parcial') && (
        <p
          className="mt-1 truncate text-[10px] text-gray-500 dark:text-gray-400"
          title={formatAbsoluteTime(state.lastComputedAt)}
        >
          por <span className="font-medium text-gray-700 dark:text-gray-300">{state.lastComputedByName ?? '—'}</span>
          {' · '}
          {relativeTime(state.lastComputedAt)}
        </p>
      )}

      {/* Aviso no mês corrente — sempre visível pra lembrar que existem dias
          fechados elegíveis pra apuração, mesmo quando o status mostra "Apurado"
          (que envelhece todo dia que passa). */}
      {showCurrentMonthHint && (
        <div
          className={cn(
            'mt-2 flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-[10.5px] leading-snug',
            allCovered
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-400'
              : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-400',
          )}
        >
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            {allCovered
              ? `${closedDaysCurrentMonth} dia${closedDaysCurrentMonth === 1 ? '' : 's'} fechado${closedDaysCurrentMonth === 1 ? '' : 's'} já cobertos. Reapurar quando virar o dia.`
              : `${closedDaysCurrentMonth} dia${closedDaysCurrentMonth === 1 ? '' : 's'} fechado${closedDaysCurrentMonth === 1 ? '' : 's'} pra apurar.`}
          </span>
        </div>
      )}

      <button
        onClick={onApurar}
        disabled={!canApurar}
        className={cn(
          'mt-2.5 w-full rounded-md py-1.5 text-xs font-semibold transition-colors',
          canApurar
            ? state.status === 'apurado'
              ? 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
              : 'bg-[#1e3a5f] text-white hover:bg-[#162d4a]'
            : 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600',
          // Pisca o botão inteiro enquanto o mês tá rodando — feedback visual
          // que o trabalho está em andamento sem o ruído do spinner.
          state.status === 'em_andamento' && 'animate-pulse bg-blue-600 text-white dark:bg-blue-500'
        )}
      >
        {state.status === 'em_andamento' ? 'Apurando...' : state.status === 'apurado' ? 'Reapurar' : 'Apurar'}
      </button>
    </div>
  )
}

export default Apuracao
