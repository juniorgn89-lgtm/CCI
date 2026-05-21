import { useCallback, useEffect, useRef, useState } from 'react'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { Check, Fuel, Loader2, RefreshCw, X } from 'lucide-react'
import type { PaginatedResponse } from '@/api/types/common'
import type { Empresa } from '@/api/types/empresa'

/* ─── Timeline steps ─── */

const timelineSteps = [
  'Conectando ao posto...',
  'Carregando abastecimentos e vendas',
  'Processando indicadores',
  'Analisando estoque e produtos',
  'Calculando margens e volumes',
  'Organizando dados financeiros',
  'Preparando painel...',
]

const getActiveStep = (progress: number): number => {
  if (progress < 10) return 0
  if (progress < 25) return 1
  if (progress < 40) return 2
  if (progress < 55) return 3
  if (progress < 70) return 4
  if (progress < 85) return 5
  return 6
}

const STALE_TIMEOUT = 30 * 60 * 1000

/* ─── Timeline Step ─── */

const TimelineStep = ({ label, status }: { label: string; status: 'done' | 'active' | 'pending' }) => (
  <div className="flex items-center gap-3">
    <div className="flex h-5 w-5 shrink-0 items-center justify-center">
      {status === 'done' && (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/20">
          <Check className="h-3 w-3 text-green-400" />
        </div>
      )}
      {status === 'active' && (
        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
      )}
      {status === 'pending' && (
        <div className="h-2 w-2 rounded-full bg-white/20" />
      )}
    </div>
    <span
      className={`text-xs transition-colors duration-300 ${
        status === 'done'
          ? 'text-green-400/80'
          : status === 'active'
            ? 'font-medium text-white'
            : 'text-white/30'
      }`}
    >
      {label}
    </span>
  </div>
)

/* ─── Component ─── */

const LoadingOverlay = () => {
  const isFetching = useIsFetching()
  const queryClient = useQueryClient()
  const { empresaCodigos } = useFilterStore()

  // Get company name from React Query cache
  const empresasCache = queryClient.getQueryData<PaginatedResponse<Empresa>>(['empresas'])
  const empresaNome = empresasCache?.resultados?.find(
    (e) => e.codigo === empresaCodigos[0] || e.empresaCodigo === empresaCodigos[0]
  )?.fantasia

  const [showOverlay, setShowOverlay] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)
  const [progress, setProgress] = useState(0)

  const loadedCompanyKey = useRef<string>('')
  const currentCompanyKey = empresaCodigos.slice().sort().join(',')

  const [showBanner, setShowBanner] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const staleTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Show overlay when company changes
  useEffect(() => {
    if (currentCompanyKey === '' || currentCompanyKey === loadedCompanyKey.current) return
    setShowOverlay(true)
    setFadeOut(false)
    setProgress(0)
    setShowBanner(false)
    setIsRefreshing(false)
    if (staleTimer.current) clearTimeout(staleTimer.current)
  }, [currentCompanyKey])

  // Animate progress — mais rápido, com plateau cedo pra não dar a
  // impressão de "preso em 88%". Total ~1.8s pra chegar a 90%.
  useEffect(() => {
    if (!showOverlay || fadeOut) return

    const steps = [
      { delay: 30, value: 15 },
      { delay: 200, value: 35 },
      { delay: 500, value: 55 },
      { delay: 900, value: 72 },
      { delay: 1400, value: 85 },
      { delay: 1900, value: 92 },
    ]

    const timers = steps.map(({ delay, value }) =>
      setTimeout(() => setProgress(value), delay)
    )

    return () => timers.forEach(clearTimeout)
  }, [showOverlay, fadeOut])

  // Dispensa o overlay assim que isFetching = 0 (tudo terminou) OU após um
  // tempo limite de 2s (dados críticos provavelmente já chegaram; o que tá
  // faltando é prev/comparativos que enchem delta badges em background).
  // Sem o cap, o overlay esperava todas as queries — incluindo prev period
  // que demora ~2.5s sozinho e travava a UI inteira.
  const MAX_OVERLAY_MS = 2000

  const dismissOverlay = useCallback(() => {
    setProgress(100)
    setTimeout(() => {
      setFadeOut(true)
      setTimeout(() => {
        setShowOverlay(false)
        setFadeOut(false)
        loadedCompanyKey.current = currentCompanyKey
        if (staleTimer.current) clearTimeout(staleTimer.current)
        staleTimer.current = setTimeout(() => setShowBanner(true), STALE_TIMEOUT)
      }, 400)
    }, 300)
  }, [currentCompanyKey])

  // Caso 1: isFetching baixou — fade out
  useEffect(() => {
    if (isFetching === 0 && showOverlay && !fadeOut && progress > 0) {
      dismissOverlay()
    }
  }, [isFetching, showOverlay, fadeOut, progress, dismissOverlay])

  // Caso 2: timeout teto — força fade out mesmo com queries pendentes
  useEffect(() => {
    if (!showOverlay || fadeOut) return
    const t = setTimeout(() => {
      // Só dispensa por timeout se ainda não dispensou via isFetching === 0
      if (showOverlay && !fadeOut) dismissOverlay()
    }, MAX_OVERLAY_MS)
    return () => clearTimeout(t)
  }, [showOverlay, fadeOut, dismissOverlay])

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

  const activeStep = getActiveStep(progress)

  return (
    <>
      {/* ─── Overlay ─── */}
      {showOverlay && (
        <div
          className={`fixed inset-0 z-[9998] flex items-center justify-center transition-opacity duration-500 ${
            fadeOut ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="absolute inset-0 bg-gray-950/60 backdrop-blur-sm" />

          <div className="relative z-10 flex flex-col items-center gap-8 rounded-2xl border border-white/10 bg-gray-900/80 px-14 py-10 shadow-2xl backdrop-blur-md">
            <div
              className="absolute -inset-4 -z-10 rounded-3xl opacity-30 blur-[60px]"
              style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)' }}
            />

            {/* Logo */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/20" style={{ animationDuration: '2s' }} />
                <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-500/30">
                  <Fuel className="h-6 w-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-wider text-white">Visor360</h1>
                <p className="text-[10px] text-white/40">
                  {empresaNome ? `Carregando ${empresaNome}` : 'Carregando dados do posto'}
                </p>
              </div>
            </div>

            {/* Timeline */}
            <div className="flex flex-col gap-2.5">
              {timelineSteps.map((label, i) => (
                <TimelineStep
                  key={i}
                  label={label}
                  status={i < activeStep ? 'done' : i === activeStep ? 'active' : 'pending'}
                />
              ))}
            </div>

            {/* Progress bar */}
            <div className="w-full">
              <div className="h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1.5 text-center text-[10px] tabular-nums text-white/30">{progress}%</p>
            </div>
          </div>
        </div>
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
