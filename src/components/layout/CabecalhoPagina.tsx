import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { ChevronRight, RefreshCw, Clock } from 'lucide-react'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useModuloAbas, moduloDaRota } from '@/store/moduloAbas'
import useIsMobile from '@/hooks/useIsMobile'
import { useTenantStore } from '@/store/tenant'
import { useRedeNomeExibicao } from '@/hooks/useDemo'
import { REGISTRY } from '@/lib/moduleRegistry'
import { nomeLegivel } from '@/lib/nomeLegivel'
import { PAGE_HEADER_TITLE_SLOT_ID } from '@/components/layout/PageHeaderTitle'
import { HEADER_TRAY_SLOT_ID } from '@/components/layout/HeaderTray'
import JanelasBar from '@/components/layout/JanelasBar'
import { useJanelas } from '@/store/janelas'

const fmtDataHora = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`
}
const haQuanto = (d: Date, agora: number) => {
  const min = Math.floor((agora - d.getTime()) / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  return `há ${h} h`
}

/**
 * Status "Atualizado em … · há N min" + botão de atualizar (como o "Última
 * busca" do NotaOK). Atualiza só os dados ao vivo; o cache da apuração
 * (meses fechados) não é relido.
 */
const StatusAtualizacao = () => {
  const qc = useQueryClient()
  const buscando = useIsFetching() > 0
  const [quando, setQuando] = useState(() => new Date())
  const [agora, setAgora] = useState(() => Date.now())
  const estava = useRef(false)

  useEffect(() => {
    if (buscando) { estava.current = true; return }
    if (estava.current) {
      estava.current = false
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setQuando(new Date())
    }
  }, [buscando])
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const atualizar = () => {
    void qc.invalidateQueries({
      predicate: (q) => {
        const first = q.queryKey[0]
        return typeof first !== 'string' || !first.startsWith('apuracao')
      },
    })
  }

  return (
    <div className="flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white pl-3 pr-1 text-[11.5px] text-gray-500 dark:border-[#2f3b4f] dark:bg-[#1e293b] dark:text-[#94a3b8]">
      <span className="relative flex h-2 w-2 shrink-0">
        {buscando && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <Clock className="hidden h-3.5 w-3.5 shrink-0 xl:block" />
      <span className="whitespace-nowrap">
        Atualizado em <b className="font-semibold text-gray-800 dark:text-[#f1f5f9]">{fmtDataHora(quando)}</b>
        <span className="text-gray-400 dark:text-[#64748b]"> · {buscando ? 'atualizando…' : haQuanto(quando, agora)}</span>
      </span>
      <button type="button" onClick={atualizar} aria-label="Atualizar dados"
        className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06] dark:hover:text-gray-200">
        <RefreshCw className={cn('h-3.5 w-3.5', buscando && 'animate-spin')} />
      </button>
    </div>
  )
}

interface Props {
  /** Filtros globais (período etc.) — só nas telas que usam filtro. */
  filtros?: ReactNode
  scrolled?: boolean
}

/**
 * Cabeçalho do painel de conteúdo (padrão NotaOK / apps CCI):
 *   Rede › [janelas abertas]        (computador; no celular: Rede › Módulo › Tela)
 *   Título grande + subtítulo       |  filtros · status de atualização · engrenagem
 * O título é a tela aberta (ou o módulo, se ele não tem telas).
 */
const CabecalhoPagina = ({ filtros, scrolled }: Props) => {
  const { pathname } = useLocation()
  const modulo = moduloDaRota(pathname)
  const abasPath = useModuloAbas((s) => s.path)
  const tabs = useModuloAbas((s) => s.tabs)
  const ativa = useModuloAbas((s) => s.active)
  const isMobile = useIsMobile()
  const redeNome = useRedeNomeExibicao(useTenantStore((s) => s.rede?.nome))
  // Todas as janelas fechadas: só a barra fica (sem título nem filtros da tela anterior).
  const semJanelas = useJanelas((s) => s.vazio) && !isMobile

  const tela = modulo && abasPath === modulo.path ? tabs.find((t) => t.id === ativa)?.label : undefined
  const meta = modulo ? REGISTRY[modulo.path] : undefined
  const titulo = tela ?? modulo?.label ?? ''
  const subtitulo = meta?.subtitle ? meta.subtitle.charAt(0).toUpperCase() + meta.subtitle.slice(1) : null
  const redeLegivel = redeNome ? nomeLegivel(redeNome) : null
  const trilha = [redeLegivel, modulo?.label ?? null, tela ?? null].filter(Boolean) as string[]

  return (
    <div className={cn('shrink-0 bg-gray-50 px-4 pb-4 pt-5 transition-shadow duration-200 dark:bg-[#0b1220] md:px-8 md:pt-6', scrolled && 'shadow-md')}>
      {!isMobile ? (
        <nav aria-label="Janelas abertas" className={cn('flex min-w-0 items-center gap-1.5 text-[12.5px]', !semJanelas && 'mb-7')}>
          {redeLegivel && (
            <>
              <span className="shrink-0 text-gray-500 dark:text-[#64748b]">{redeLegivel}</span>
              <ChevronRight className="h-3 w-3 shrink-0 text-gray-400 dark:text-[#64748b]" />
            </>
          )}
          <JanelasBar titulo={titulo} />
        </nav>
      ) : trilha.length > 0 && (
        <nav aria-label="Você está em" className="mb-7 flex min-w-0 items-center gap-1.5 text-[12.5px]">
          {trilha.map((t, i) => (
            <span key={`${i}-${t}`} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-gray-400 dark:text-[#64748b]" />}
              <span className={cn('truncate', i === trilha.length - 1 ? 'font-semibold text-gray-900 dark:text-[#f1f5f9]' : 'text-gray-500 dark:text-[#64748b]')}>{t}</span>
            </span>
          ))}
        </nav>
      )}
      <div className={cn('flex flex-wrap items-end justify-between gap-x-4 gap-y-2', semJanelas && 'hidden')}>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          {titulo && (
            <div className="min-w-0">
              <h1 className="truncate text-[26px] font-bold leading-tight text-gray-900 dark:text-[#f1f5f9]">{titulo}</h1>
              {subtitulo && <p className="mt-1 truncate text-[13.5px] text-gray-500 dark:text-[#94a3b8]">{subtitulo}</p>}
            </div>
          )}
          {/* Conteúdo que a página põe no cabeçalho (ex.: abas com o menu recolhido). */}
          <div id={PAGE_HEADER_TITLE_SLOT_ID} className="flex min-w-0 items-center" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filtros}
          <StatusAtualizacao />
          <div id={HEADER_TRAY_SLOT_ID} className="flex items-center gap-1" />
        </div>
      </div>
    </div>
  )
}

export default CabecalhoPagina
