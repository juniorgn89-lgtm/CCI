import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, RefreshCw } from 'lucide-react'
import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query'
import { navItems } from '@/components/layout/Sidebar'
import NotificationBell from '@/components/layout/NotificationBell'
import RedeSwitcher from '@/components/layout/RedeSwitcher'
import CompanySelect from '@/components/filters/CompanySelect'
import ComparisonSelect from '@/components/filters/ComparisonSelect'
import DataFilterModeSelect from '@/components/filters/DataFilterModeSelect'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { showsGlobalFilters } from '@/lib/globalFilters'
import { HEADER_TRAY_SLOT_ID } from '@/components/layout/HeaderTray'

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
  const { pathname } = useLocation()
  const queryClient = useQueryClient()
  const isFetching = useIsFetching()

  const showDataFilters = showsGlobalFilters(pathname)

  // Mesma lógica do antigo GlobalFilterBar: esconde o seletor de posto quando
  // o usuário só tem uma empresa permitida (não há o que escolher).
  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 10 * 60 * 1000,
    enabled: showDataFilters,
  })
  const empresasPermitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const showCompanySelect = showDataFilters && empresasPermitidas.length !== 1

  const [lastRefreshLabel, setLastRefreshLabel] = useState('Atualizado agora')
  const [manualRefreshing, setManualRefreshing] = useState(false)
  const lastRefreshTime = useRef(new Date())

  // Track when manual refresh completes
  useEffect(() => {
    if (manualRefreshing && isFetching === 0) {
      setManualRefreshing(false)
      lastRefreshTime.current = new Date()
      setLastRefreshLabel('Atualizado agora')
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

  // Match exato OU sub-rota (ex.: /comercial/vendas/pista ainda casa com
  // /comercial/vendas) — mesma lógica do Sidebar, evita "Visor360" aparecer
  // em rotas filhas.
  const currentModule = navItems.find(
    (item) => pathname === item.path || pathname.startsWith(item.path + '/'),
  )
  const title = currentModule?.label ?? 'Visor360'

  return (
    <header className="shrink-0 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onMobileMenuOpen}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 md:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          {/* Título do módulo no Header — sempre escondido pra evitar
              repetição com o PageHeaderTitle da sub-bar. Mostra só "Visor360"
              quando não há módulo (rotas fora do catálogo). */}
          {!currentModule && (
            <Link
              to="/"
              aria-label="Página inicial"
              title="Página inicial"
              className="hidden text-sm font-semibold text-gray-900 transition-colors hover:text-blue-600 dark:text-gray-100 dark:hover:text-blue-300 xl:block"
            >
              {title}
            </Link>
          )}
          <RedeSwitcher />
        </div>

        <div className="flex items-center gap-2">
          {showCompanySelect && <CompanySelect />}
          {/* Filtros de escopo/comparação — escondidos em /inteligencia e nas
              telas de Admin (nível de rede, não de posto/período). */}
          {showDataFilters && <DataFilterModeSelect />}
          {showDataFilters && <ComparisonSelect />}
          <div id={HEADER_TRAY_SLOT_ID} className="flex items-center gap-1" />
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
          <NotificationBell />
        </div>
      </div>
    </header>
  )
}

export default Header
