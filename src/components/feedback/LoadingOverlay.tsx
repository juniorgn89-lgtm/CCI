import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { Database, RefreshCw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { nomeLegivel } from '@/lib/nomeLegivel'
import type { PaginatedResponse } from '@/api/types/common'
import type { Empresa } from '@/api/types/empresa'

const STALE_TIMEOUT = 30 * 60 * 1000

/* ─── Rastreio da troca de posto (painel lateral) ─── */

type Etapa = 'feito' | 'ativo' | 'pendente'

/** Uma etapa do rastreio: bolinha + título + texto; a linha desce até a próxima. */
const PassoRastreio = ({ estado, titulo, children, ultimo, Icone }: {
  estado: Etapa
  titulo: string
  children?: ReactNode
  ultimo?: boolean
  Icone?: typeof Database
}) => (
  <div className="relative flex gap-4">
    <div className="relative flex w-7 shrink-0 justify-center">
      {/* linha até a próxima etapa: cheia quando esta já passou; com o pontinho descendo quando está em andamento */}
      {!ultimo && (
        <div className={cn('absolute bottom-0 left-1/2 top-7 w-[3px] -translate-x-1/2 overflow-hidden rounded-full', estado === 'feito' ? 'bg-teal-500' : 'bg-gray-200 dark:bg-white/10')}>
          {estado === 'ativo' && <span className="trilha-desce absolute left-0 h-3 w-[3px] rounded-full bg-teal-500" />}
        </div>
      )}
      {estado === 'ativo' && Icone ? (
        <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-white shadow-[0_0_0_4px_rgba(20,184,166,0.18)]">
          <Icone className="h-3.5 w-3.5" />
        </span>
      ) : (
        <span className={cn('relative z-10 mt-1.5 h-4 w-4 rounded-full border-[3px]',
          estado === 'feito' ? 'border-teal-500 bg-teal-500' : 'border-gray-300 bg-white dark:border-white/20 dark:bg-[#1e293b]')} />
      )}
    </div>
    <div className={cn('min-w-0', ultimo ? 'pb-0' : 'pb-7')}>
      <p className={cn('text-[15px] font-semibold leading-7', estado === 'pendente' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100')}>{titulo}</p>
      {children && <div className="space-y-0.5 text-[12.5px] leading-snug text-gray-500 dark:text-gray-400">{children}</div>}
    </div>
  </div>
)

const horaAgora = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/* ─── Component ─── */

const LoadingOverlay = () => {
  const isFetching = useIsFetching()
  const queryClient = useQueryClient()
  const { empresaCodigos } = useFilterStore()

  // Get company name from React Query cache
  const empresasCache = queryClient.getQueryData<PaginatedResponse<Empresa>>(['empresas'])
  const todasEmpresas = empresasCache?.resultados ?? []
  const nomesPostos = empresaCodigos.map((c) => {
    const e = todasEmpresas.find((x) => x.codigo === c || x.empresaCodigo === c)
    return e ? nomeLegivel(e.fantasia || e.razao) : `Posto ${c}`
  })

  const [showOverlay, setShowOverlay] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)
  /** 'preparando' enquanto busca; 'pronto' = tudo chegou; 'liberado' = passou do tempo, o resto chega na tela. */
  const [fase, setFase] = useState<'preparando' | 'pronto' | 'liberado'>('preparando')
  const [inicio, setInicio] = useState('')
  /** Só depois de um mínimo em "preparando" o fim pode ser anunciado (o rastreio não pisca). */
  const [podeConcluir, setPodeConcluir] = useState(false)

  const loadedCompanyKey = useRef<string>('')
  const currentCompanyKey = empresaCodigos.slice().sort().join(',')

  const [showBanner, setShowBanner] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const staleTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Show overlay when company changes — reset de múltiplos states + timer
  // em resposta a mudança externa, fora do padrão de derivação simples.
  useEffect(() => {
    if (currentCompanyKey === '' || currentCompanyKey === loadedCompanyKey.current) return
    /* eslint-disable react-hooks/set-state-in-effect */
    setShowOverlay(true)
    setFadeOut(false)
    setFase('preparando')
    setInicio(horaAgora())
    setPodeConcluir(false)
    setShowBanner(false)
    setIsRefreshing(false)
    /* eslint-enable react-hooks/set-state-in-effect */
    if (staleTimer.current) clearTimeout(staleTimer.current)
  }, [currentCompanyKey])

  // Dispensa o overlay assim que isFetching = 0 (tudo terminou) OU após um
  // tempo limite de 2s (dados críticos provavelmente já chegaram; o que tá
  // faltando é prev/comparativos que enchem delta badges em background).
  // Sem o cap, o overlay esperava todas as queries — incluindo prev period
  // que demora ~2.5s sozinho e travava a UI inteira.
  const MAX_OVERLAY_MS = 2400
  const MIN_PREPARANDO_MS = 700
  /** Quanto o "Dados prontos" fica à vista antes de o painel sair. */
  const MOSTRA_PRONTO_MS = 900

  const dismissOverlay = useCallback((comoFicou: 'pronto' | 'liberado') => {
    setFase(comoFicou)
    setTimeout(() => {
      setFadeOut(true)
      setTimeout(() => {
        setShowOverlay(false)
        setFadeOut(false)
        loadedCompanyKey.current = currentCompanyKey
        if (staleTimer.current) clearTimeout(staleTimer.current)
        staleTimer.current = setTimeout(() => setShowBanner(true), STALE_TIMEOUT)
      }, 320)
    }, MOSTRA_PRONTO_MS)
  }, [currentCompanyKey])

  useEffect(() => {
    if (!showOverlay || fadeOut || podeConcluir) return
    const t = setTimeout(() => setPodeConcluir(true), MIN_PREPARANDO_MS)
    return () => clearTimeout(t)
  }, [showOverlay, fadeOut, podeConcluir])

  // Caso 1: isFetching baixou — fade out (dismissOverlay dispara timeouts e
  // múltiplos setStates em resposta a state externo, fora do padrão simples)
  useEffect(() => {
    if (isFetching === 0 && showOverlay && !fadeOut && podeConcluir && fase === 'preparando') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      dismissOverlay('pronto')
    }
  }, [isFetching, showOverlay, fadeOut, podeConcluir, fase, dismissOverlay])

  // Caso 2: timeout teto — força fade out mesmo com queries pendentes
  useEffect(() => {
    if (!showOverlay || fadeOut || fase !== 'preparando') return
    const t = setTimeout(() => dismissOverlay('liberado'), MAX_OVERLAY_MS)
    return () => clearTimeout(t)
  }, [showOverlay, fadeOut, fase, dismissOverlay])

  // Banner refresh
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true)
    queryClient.invalidateQueries()
  }, [queryClient])

  useEffect(() => {
    if (isRefreshing && isFetching === 0) {
      // Keep banner visible briefly to show completion
      const t = setTimeout(() => {
        setShowBanner(false)
        setIsRefreshing(false)
        if (staleTimer.current) clearTimeout(staleTimer.current)
        staleTimer.current = setTimeout(() => setShowBanner(true), STALE_TIMEOUT)
      }, 1500)
      return () => clearTimeout(t)
    }
  }, [isRefreshing, isFetching])

  const handleDismissBanner = useCallback(() => {
    setShowBanner(false)
    if (staleTimer.current) clearTimeout(staleTimer.current)
    staleTimer.current = setTimeout(() => setShowBanner(true), STALE_TIMEOUT)
  }, [])

  useEffect(() => {
    return () => {
      if (staleTimer.current) clearTimeout(staleTimer.current)
    }
  }, [])

  const fechar = () => { if (fase === 'preparando') dismissOverlay('liberado') }
  const concluido = fase !== 'preparando'
  const todos = todasEmpresas.length > 1 && empresaCodigos.length >= todasEmpresas.length

  return (
    <>
      {/* ─── Rastreio da troca de posto: painel lateral que fecha sozinho ─── */}
      {showOverlay && createPortal(
        <div className={cn('fixed inset-0 z-[9998] transition-opacity duration-300', fadeOut ? 'opacity-0' : 'opacity-100')}>
          <div className="janela-fundo-entra absolute inset-0 bg-black/30" />
          <aside role="status" aria-live="polite"
            className={cn('painel-entra absolute inset-y-0 right-0 flex w-full max-w-[380px] flex-col border-l border-gray-200 bg-white shadow-2xl transition-transform duration-300 dark:border-[#2f3b4f] dark:bg-[#1e293b]', fadeOut && 'translate-x-full')}>
            <div className="flex items-start justify-between gap-3 px-7 pb-2 pt-8">
              <div className="min-w-0">
                <h2 className="text-[19px] font-semibold text-gray-900 dark:text-gray-100">Trocando de posto</h2>
                <span className="mt-2 inline-block rounded-md bg-gray-100 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-white/[0.07] dark:text-gray-400">
                  Busca iniciada às {inicio}
                </span>
              </div>
              <button type="button" onClick={fechar} aria-label="Fechar" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.08] dark:hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-7 pt-5">
              <PassoRastreio estado="feito" titulo={empresaCodigos.length === 1 ? 'Posto confirmado' : 'Postos confirmados'}>
                {todos ? <p>Todos os {empresaCodigos.length} postos da rede</p> : (
                  <>
                    {nomesPostos.slice(0, 4).map((n, i) => <p key={i}>{n}</p>)}
                    {nomesPostos.length > 4 && <p>+ {nomesPostos.length - 4} {nomesPostos.length - 4 === 1 ? 'posto' : 'postos'}</p>}
                  </>
                )}
              </PassoRastreio>
              <PassoRastreio estado={concluido ? 'feito' : 'ativo'} titulo="Preparando os dados" Icone={Database}>
                <p>Buscando vendas, estoque e financeiro no sistema do posto.</p>
                {!concluido && isFetching > 0 && <p className="text-gray-400 dark:text-gray-500">{isFetching} {isFetching === 1 ? 'consulta' : 'consultas'} em andamento</p>}
              </PassoRastreio>
              <PassoRastreio ultimo estado={concluido ? 'feito' : 'pendente'} titulo={fase === 'liberado' ? 'Painel liberado' : 'Dados prontos'}>
                {fase === 'pronto' && <p>Tudo carregado. Fechando…</p>}
                {fase === 'liberado' && <p>O principal já chegou; os comparativos terminam de carregar na própria tela.</p>}
              </PassoRastreio>
            </div>

            <div className="flex items-center gap-2.5 border-t border-gray-100 px-7 py-4 dark:border-white/[0.06]">
              <img src="/brand/visor360-app-192.png" alt="" className="h-7 w-7 rounded-md" />
              <p className="text-[11.5px] text-gray-500 dark:text-gray-400">Visor360 · só leitura: nada é alterado no sistema do posto.</p>
            </div>
          </aside>
        </div>,
        document.body,
      )}

      {/* ─── Stale banner ─── */}
      {showBanner && !showOverlay && (
        <div className="fixed bottom-6 right-6 z-[9998] animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-4 rounded-xl border border-blue-500/20 bg-gray-900/95 px-5 py-4 shadow-2xl backdrop-blur-md">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
              <RefreshCw className={`h-5 w-5 text-blue-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            </div>
            <div className="mr-2">
              <p className="text-sm font-medium text-white">
                {isRefreshing ? 'Atualizando dados...' : 'Novos dados disponíveis'}
              </p>
              <p className="text-xs text-gray-400">
                {isRefreshing ? 'Aguarde enquanto os dados são atualizados' : 'Já se passaram 30 minutos desde a última atualização'}
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              {isRefreshing ? 'Atualizando...' : 'Atualizar agora'}
            </button>
            {!isRefreshing && (
              <button
                onClick={handleDismissBanner}
                className="shrink-0 rounded-md p-1 text-gray-500 transition-colors hover:text-gray-300"
                aria-label="Dispensar"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default LoadingOverlay
