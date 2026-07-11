import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { LayoutGrid, RefreshCw } from 'lucide-react'
import { moduloPermiteTodos } from '@/lib/moduleScope'
import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useFocusMode } from '@/store/focusMode'
import { useTopbarUi } from '@/store/topbarUi'
import { useFilterStore } from '@/store/filters'
import { useTenantStore } from '@/store/tenant'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import HeaderContextMenu from '@/components/layout/HeaderContextMenu'
import UltimaAtualizacaoInfo from '@/components/layout/UltimaAtualizacaoInfo'
import { HEADER_TRAY_SLOT_ID } from '@/components/layout/HeaderTray'
import { HEADER_TITLE_SLOT_ID } from '@/components/layout/PageHeaderTitle'

interface HeaderProps {
  onMobileMenuOpen: () => void
}

const formatRelativeTime = (date: Date): string => {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMin < 1) return 'Atualizado agora'
  if (diffMin === 1) return 'Atualizado há 1 min'
  if (diffMin < 60) return `Atualizado há ${diffMin} min`

  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `Último: ${hours}:${minutes}`
}

const Header = ({ onMobileMenuOpen }: HeaderProps) => {
  const queryClient = useQueryClient()
  const isFetching = useIsFetching()

  // Seletor de posto ao lado da rede (todas as telas, incl. Central — a Central
  // consolida qualquer subconjunto). Some só quando o usuário tem 1 posto.
  // Query cacheada (queryKey ['empresas']) — deduplica com outras instâncias.
  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 10 * 60 * 1000,
  })
  const empresasPermitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const liveLock = useTopbarUi((s) => s.liveLock)
  const showCompanySelect = empresasPermitidas.length !== 1

  // Rótulo central (apagado) — qual POSTO o usuário está vendo. Regra de nome:
  // "Todos" quando rede-wide ([]); o nome de CADA posto selecionado quando há
  // seleção (truncado por CSS se a lista for longa).
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const tenantNome = useTenantStore((s) => s.rede?.nome)
  const fantasiasSel = empresaCodigos
    .map((c) => empresasPermitidas.find((e) => e.codigo === c)?.fantasia)
    .filter((n): n is string => !!n)
  // 1–2 postos: nomes com "·"; 3+: colapsa pra contagem (evita fila truncada).
  const postoNome =
    empresaCodigos.length === 0 || fantasiasSel.length === 0
      ? null
      : fantasiasSel.length <= 2
        ? fantasiasSel.join(' · ')
        : `${fantasiasSel.length} postos`
  // "Todos" ([]) mostra o NOME DA REDE em todas as telas (incl. Central) — fica
  // claro que é a rede consolidada. Fallback "Todos" só se não houver nome de rede.
  const contextoLabel = postoNome ?? (tenantNome ?? 'Todos')
  // Filtro de empresa (pílula) em TODAS as telas. Módulos gateados (operacionais
  // por-posto) não permitem "Todos" — a pílula esconde a opção e, quando ainda
  // não há posto escolhido, o rótulo pede a seleção.
  const allowTodos = moduloPermiteTodos(useLocation().pathname)
  const pillLabel = !allowTodos && empresaCodigos.length !== 1 ? 'Selecione um posto' : contextoLabel
  // No Modo Foco a sidebar some — mostramos o hambúrguer no desktop também,
  // pra trocar de módulo sem sair do foco.
  const focusActive = useFocusMode((s) => s.active)

  const [lastRefreshLabel, setLastRefreshLabel] = useState('Atualizado agora')
  const [manualRefreshing, setManualRefreshing] = useState(false)
  const lastRefreshTime = useRef(new Date())

  // Track when manual refresh completes — sync legítimo com isFetching global.
  useEffect(() => {
    if (manualRefreshing && isFetching === 0) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setManualRefreshing(false)
      lastRefreshTime.current = new Date()
      setLastRefreshLabel('Atualizado agora')
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [manualRefreshing, isFetching])

  // Update the relative time label every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefreshLabel(formatRelativeTime(lastRefreshTime.current))
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = () => {
    setManualRefreshing(true)
    // Invalida apenas dados live (Quality API + caixas live, etc.). As caches
    // do Supabase (apuracao-*) ficam preservadas — meses fechados são imutáveis
    // e re-ler do Supabase só adicionaria latência. Mês corrente continua sendo
    // refrescado porque o fetch live de hoje (abast-resumo-today, vendaResumo
    // do período, caixas) é re-invalidado.
    queryClient.invalidateQueries({
      predicate: (query) => {
        const first = query.queryKey[0]
        if (typeof first !== 'string') return true
        return !first.startsWith('apuracao')
      },
    })
  }

  return (
    <header className="shrink-0 bg-white dark:bg-gray-900">
      <div className="relative flex h-12 items-center justify-between pl-3 pr-4 md:pr-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onMobileMenuOpen}
            className={cn(
              'rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
              // Mobile: sempre. Desktop: só no Modo Foco (sidebar escondida).
              !focusActive && 'md:hidden',
            )}
            title={focusActive ? 'Selecionar módulo (sem sair do foco)' : 'Abrir menu'}
            aria-label="Abrir menu de módulos"
          >
            <LayoutGrid className="h-5 w-5" />
          </button>

          {/* Logo + nome — fixos na barra de topo (fora do menu que recolhe,
              estilo Gmail). Marca CCI oficial: símbolo dos 3 triângulos +
              wordmark com "360" em teal. Link externo pro Portal CCI. */}
          <a
            href="https://portal-cci-eight.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir Portal CCI"
            title="Abrir Portal CCI"
            className="group mr-1 flex shrink-0 items-center gap-2.5"
          >
            <img
              src="/brand/visor360-icon-512.png"
              alt="Visor360"
              className="h-[30px] w-[30px] shrink-0 object-contain transition-transform group-hover:scale-105"
            />
            <span className="hidden flex-col leading-tight sm:flex">
              <span className="text-[15px] font-bold tracking-[-0.01em] text-[#1e3a5f] dark:text-white">
                Visor<span className="text-[#0F766E] dark:text-[#14b8a6]">360</span>
              </span>
              <span className="text-[10px] text-gray-500 dark:text-white/55">Gestão de postos</span>
            </span>
          </a>

          {/* Slot de título do módulo no Header (ao lado do logo), preenchido por
              páginas com <PageHeaderTitle placement="header">. Piloto: Central da Rede. */}
          <div id={HEADER_TITLE_SLOT_ID} className="flex min-w-0 items-center" />
        </div>

        <div className="flex items-center gap-2">
          {/* Pílula de contexto (posto/rede visível) ANTES do Atualizar, em todas as telas. */}
          <HeaderContextMenu label={pillLabel} showCompanySelect={showCompanySelect} allowTodos={allowTodos} liveLock={liveLock} />
          {/* Referência de frescor do dado — última atualização EM TEMPO REAL. */}
          <UltimaAtualizacaoInfo />
          <button
            onClick={handleRefresh}
            title={lastRefreshLabel}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${
              isFetching > 0
                ? 'text-blue-500 dark:text-blue-400'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
            aria-label="Atualizar dados"
          >
            <RefreshCw className={`h-4 w-4${isFetching > 0 ? ' animate-spin' : ''}`} />
          </button>
          {/* Engrenagem do módulo (ModuleSettings via slot). */}
          <div id={HEADER_TRAY_SLOT_ID} className="flex items-center gap-1" />
        </div>
      </div>
    </header>
  )
}

export default Header
