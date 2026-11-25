import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, BellRing, AlertTriangle, Info, CheckCheck, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'
import { useFilterStore } from '@/store/filters'
import { useNotificationStore, type AlertCategory, type AppAlert } from '@/store/notifications'
import { RELEASE_NOTES } from '@/releaseNotes'
import { NovidadesModal } from '@/components/feedback/Novidades'
import { estado, ligar, desligar, precisaInstalar, type EstadoPush } from '@/lib/push'

/**
 * Sino do topo — histórico de avisos da pessoa (padrão dos apps CCI, igual ao NotaOK).
 *
 * Junta três fontes:
 *  1. tabela `notificacoes` (supabase/migrations/20261124000001_notificacoes_historico.sql):
 *     pedidos, notas devolvidas, tarefas — gravada no evento, lido/não lido vale
 *     entre aparelhos; atualiza em tempo real, a cada 2 min e ao voltar pra aba;
 *  2. alertas calculados no app (estoque, financeiro, combustível, bombas — useAlertGenerator);
 *  3. "Novidades da versão" (não lida até abrir).
 *
 * Celular (≤639px): TELA CHEIA via portal, trava a rolagem de trás. Computador:
 * painel de 400px no sino. Fecha no X, no Esc e (computador) clicando fora.
 */

const CHAVE_VISTA = 'visor360.sino.versao' // última versão cujas novidades a pessoa já viu
const lerVista = () => { try { return localStorage.getItem(CHAVE_VISTA) ?? '' } catch { return '' } }
const gravarVista = (v: string) => { try { localStorage.setItem(CHAVE_VISTA, v) } catch { /* ignore */ } }
const dataBR = (iso: string) => iso.split('-').reverse().join('/')

const tempoRelativo = (iso: string) => {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString('pt-BR')
}

const ROTA_ALERTA: Record<AlertCategory, string> = {
  estoque: '/estoques', financeiro: '/financeiro', combustivel: '/dashboard?tab=combustivel', bombas: '/operacao',
}
const NOME_ALERTA: Record<AlertCategory, string> = {
  estoque: 'Estoque', financeiro: 'Financeiro', combustivel: 'Combustível', bombas: 'Bombas',
}

interface NotificacaoRow {
  id: number
  tipo: string
  titulo: string
  texto: string | null
  url: string | null
  criada_em: string
  lida_em: string | null
}

/** Histórico da pessoa na rede aberta. Sem a tabela (migration não rodada) = lista vazia. */
const useHistorico = () => {
  const qc = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const redeId = useTenantStore((s) => s.rede?.id ?? null)
  const chave = ['sino-notificacoes', userId, redeId]

  const q = useQuery({
    queryKey: chave,
    enabled: !!userId && !!supabase,
    refetchInterval: 2 * 60_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<NotificacaoRow[]> => {
      let req = supabase!.from('notificacoes')
        .select('id, tipo, titulo, texto, url, criada_em, lida_em')
        .eq('user_id', userId!)
        .order('criada_em', { ascending: false })
        .limit(60)
      if (redeId) req = req.or(`rede_id.eq.${redeId},rede_id.is.null`)
      const { data, error } = await req
      return error ? [] : ((data ?? []) as NotificacaoRow[])
    },
  })

  // Tempo real: chegou/mudou aviso desta pessoa → recarrega.
  useEffect(() => {
    if (!userId || !supabase) return undefined
    const sb = supabase
    const canal = sb.channel(`notificacoes-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notificacoes', filter: `user_id=eq.${userId}` },
        () => { void qc.invalidateQueries({ queryKey: ['sino-notificacoes', userId] }) })
      .subscribe()
    return () => { void sb.removeChannel(canal) }
  }, [userId, qc])

  const marcarLida = async (id: number) => {
    qc.setQueryData<NotificacaoRow[]>(chave, (l) => l?.map((n) => (n.id === id && !n.lida_em ? { ...n, lida_em: new Date().toISOString() } : n)))
    await supabase?.rpc('notificacoes_marcar_lida', { p_id: id })
  }
  const marcarTodas = async () => {
    const agora = new Date().toISOString()
    qc.setQueryData<NotificacaoRow[]>(chave, (l) => l?.map((n) => (n.lida_em ? n : { ...n, lida_em: agora })))
    await supabase?.rpc('notificacoes_marcar_todas', { p_rede: redeId })
  }
  return { itens: q.data, carregando: q.isLoading, recarregar: q.refetch, marcarLida, marcarTodas }
}

const QUERY_CELULAR = '(max-width: 639px)'
const useCelular = () => {
  const [cel, setCel] = useState(() => window.matchMedia?.(QUERY_CELULAR).matches ?? false)
  useEffect(() => {
    const mq = window.matchMedia?.(QUERY_CELULAR)
    if (!mq) return undefined
    const f = () => setCel(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])
  return cel
}

const ehAlerta = (n: NotificacaoRow) => n.tipo === 'nota_devolvida' || (n.tipo === 'nota_lancar' && /parad/i.test(n.titulo)) || (n.tipo === 'pedido_decidido' && /recusado/i.test(n.titulo))

interface Props {
  /** desktop = barra do Header; mobile = topo do app no celular. */
  variant?: 'desktop' | 'mobile'
}

const SinoNotificacoes = ({ variant = 'desktop' }: Props) => {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const setEmpresas = useFilterStore((s) => s.setEmpresas)
  const { alerts, markAsRead, markAllAsRead } = useNotificationStore()
  const { itens, carregando, recarregar, marcarLida, marcarTodas } = useHistorico()
  const celular = useCelular()
  const [aberto, setAberto] = useState(false)
  const [novidades, setNovidades] = useState(false)
  const [vista, setVista] = useState(lerVista)
  const ref = useRef<HTMLDivElement>(null)

  const fechar = useCallback(() => setAberto(false), [])

  // Computador: fecha ao clicar fora; Esc nos dois. Celular: trava a rolagem de trás.
  useEffect(() => {
    if (!aberto) return undefined
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar() }
    const onDown = (e: MouseEvent) => { if (!celular && ref.current && !ref.current.contains(e.target as Node)) fechar() }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    const overflow = document.body.style.overflow
    if (celular) document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
      document.body.style.overflow = overflow
    }
  }, [aberto, celular, fechar])

  if (!userId) return null

  const ultima = RELEASE_NOTES[0]
  const novidadeNova = !!ultima && vista !== ultima.versao
  const lista = itens ?? []
  const naoLidas = lista.filter((n) => !n.lida_em).length + alerts.filter((a) => !a.read).length + (novidadeNova ? 1 : 0)

  const verNovidade = () => { if (ultima) { gravarVista(ultima.versao); setVista(ultima.versao) } }
  const alternar = () => { if (!aberto) void recarregar(); setAberto((v) => !v) }
  const tocar = (n: NotificacaoRow) => {
    if (!n.lida_em) void marcarLida(n.id)
    fechar()
    if (n.url) navigate(n.url)
  }
  const tocarAlerta = (a: AppAlert) => {
    markAsRead(a.id)
    fechar()
    if (a.empresaCodigo) setEmpresas([a.empresaCodigo])
    navigate(ROTA_ALERTA[a.category])
  }
  const tocarNovidade = () => { verNovidade(); fechar(); setNovidades(true) }
  const todas = () => { void marcarTodas(); markAllAsRead(); verNovidade() }

  const vazio = !carregando && !lista.length && !alerts.length && !ultima

  const painel = (
    <div
      role="dialog"
      aria-label="Notificações"
      className={celular
        ? 'fixed inset-0 z-[70] flex flex-col bg-white pt-[env(safe-area-inset-top)] dark:bg-[#1e293b]'
        : 'absolute right-0 top-11 z-50 flex max-h-[78vh] w-[400px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-2xl dark:border-[#2f3b4f] dark:bg-[#1e293b]'}
    >
      {/* Cabeçalho */}
      <div className={cn('flex shrink-0 items-start gap-2', celular ? 'px-4 pb-3.5 pt-5' : 'px-4 pb-3 pt-4')}>
        <div className="min-w-0 flex-1">
          <p role="heading" aria-level={2} className={cn('font-bold tracking-tight text-gray-900 dark:text-gray-100', celular ? 'text-[19px] leading-tight' : 'text-[17px]')}>
            Notificações
          </p>
          <p className={cn('text-gray-500', celular ? 'mt-1 text-[12.5px] dark:text-[#64748b]' : 'mt-0.5 text-[12px] dark:text-gray-400')}>
            {carregando ? 'Carregando…' : naoLidas ? `${naoLidas} não ${naoLidas === 1 ? 'lida' : 'lidas'}` : 'Tudo em dia'}
          </p>
        </div>
        {naoLidas > 0 && (
          <button
            type="button"
            onClick={todas}
            className={cn(
              'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 font-medium hover:bg-gray-100 dark:hover:bg-white/[0.06]',
              celular ? 'text-teal-700 dark:text-[#5eead4]/90' : 'text-blue-600 dark:text-gray-200',
              celular ? 'text-[14.5px]' : 'text-[12.5px]',
            )}
          >
            <CheckCheck className={celular ? 'h-4 w-4' : 'h-3.5 w-3.5'} /> Marcar todas
          </button>
        )}
        <button
          type="button"
          onClick={fechar}
          aria-label="Fechar"
          className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-[#94a3b8] dark:hover:bg-white/[0.06]"
        >
          <X className={celular ? 'h-5 w-5' : 'h-4 w-4'} />
        </button>
      </div>

      {/* Lista */}
      <div className={cn(
        'min-h-0 flex-1 overflow-y-auto overscroll-contain border-t',
        celular
          ? 'divide-y divide-gray-100 border-gray-100 bg-white dark:divide-white/[0.05] dark:border-white/[0.06] dark:bg-[#192436]'
          : 'divide-y divide-gray-100 border-gray-100 dark:divide-[#2f3b4f] dark:border-[#2f3b4f]',
      )}>
        {vazio && <p className="py-16 text-center text-sm text-gray-500">Nenhuma notificação.</p>}
        {lista.map((n) => (
          <Item key={n.id} celular={celular} Icone={ehAlerta(n) ? AlertTriangle : Info} alerta={ehAlerta(n)}
            titulo={n.titulo} texto={n.texto} quando={tempoRelativo(n.criada_em)} naoLida={!n.lida_em} onClick={() => tocar(n)} />
        ))}
        {alerts.map((a) => (
          <Item key={a.id} celular={celular} Icone={a.severity === 'info' ? Info : AlertTriangle} alerta={a.severity !== 'info'}
            titulo={a.title} texto={a.description} quando={NOME_ALERTA[a.category]} naoLida={!a.read} onClick={() => tocarAlerta(a)} />
        ))}
        {ultima && (
          <Item celular={celular} Icone={Info} titulo={`Novidades da versão ${ultima.versao}`} texto={ultima.resumo}
            quando={dataBR(ultima.data)} naoLida={novidadeNova} onClick={tocarNovidade} />
        )}
      </div>

      <ReceberNoDispositivo celular={celular} userId={userId} />
    </div>
  )

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={alternar}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={naoLidas ? `Notificações (${naoLidas} não ${naoLidas === 1 ? 'lida' : 'lidas'})` : 'Notificações'}
        className={cn(
          'relative flex shrink-0 items-center justify-center rounded-lg transition-colors',
          variant === 'mobile'
            ? 'h-9 w-9 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10'
            : 'h-8 w-8 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300',
          aberto && variant === 'desktop' && 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
        )}
      >
        <Bell className={variant === 'mobile' ? 'h-5 w-5' : 'h-4 w-4'} />
        {naoLidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold tabular-nums text-white">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>
      {aberto && (celular ? createPortal(painel, document.body) : painel)}
      <NovidadesModal open={novidades} onClose={() => setNovidades(false)} releases={RELEASE_NOTES} />
    </div>
  )
}

interface ItemProps {
  celular: boolean
  Icone: ComponentType<{ className?: string }>
  alerta?: boolean
  titulo: string
  texto?: string | null
  quando: string
  naoLida: boolean
  onClick: () => void
}

const Item = ({ celular, Icone, alerta, titulo, texto, quando, naoLida, onClick }: ItemProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'flex w-full items-start gap-3.5 px-4 text-left transition-colors',
      celular ? 'py-[18px]' : 'py-3',
      // Não lida: tinta petróleo no celular (padrão CCI); no computador, realce
      // neutro — o verde destoava do escuro antigo do desktop.
      naoLida
        ? (celular ? 'bg-teal-500/[0.08] hover:bg-teal-500/[0.12]' : 'bg-gray-50 hover:bg-gray-100 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]')
        : 'hover:bg-gray-50 dark:hover:bg-white/[0.04]',
    )}
  >
    <span className={cn(
      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
      alerta ? 'bg-amber-400/15 text-amber-600 dark:text-amber-400'
        : celular ? 'bg-teal-500/[0.12] text-teal-600 dark:text-teal-500' : 'bg-blue-50 text-blue-600 dark:bg-white/[0.06] dark:text-gray-300',
    )}>
      <Icone className="h-3.5 w-3.5" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="flex items-baseline gap-3">
        <span className={cn('min-w-0 flex-1 font-medium text-gray-900 dark:text-gray-100', celular ? 'text-[15.5px] leading-snug dark:text-[#f1f5f9]' : 'text-[13.5px]')}>{titulo}</span>
        <span className={cn('shrink-0 tabular-nums text-gray-400', celular ? 'text-[12.5px] dark:text-[#64748b]' : 'text-[11px] dark:text-gray-500')}>{quando}</span>
        {naoLida && <span className={cn('h-2 w-2 shrink-0 self-center rounded-full', celular ? 'bg-[#0d9488]' : 'bg-blue-500 dark:bg-gray-300')} />}
      </span>
      {texto && (
        <span className={cn('mt-1 block leading-snug text-gray-600', celular ? 'text-[14.5px] dark:text-[#94a3b8]' : 'text-[12.5px] dark:text-gray-400')}>{texto}</span>
      )}
    </span>
  </button>
)

/** "Receber no celular" no telefone; no PC, o nome do sistema (Windows, Mac...). */
const ondeReceber = () => {
  const ua = navigator.userAgent
  if (/Android|iPhone|iPod/.test(ua)) return 'no celular'
  if (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'no tablet'
  if (/Windows/.test(ua)) return 'no Windows'
  if (/Macintosh|Mac OS X/.test(ua)) return 'no Mac'
  if (/CrOS/.test(ua)) return 'no Chromebook'
  return 'neste dispositivo'
}

const SUB: Record<EstadoPush, string> = {
  ligada: 'Ativo neste dispositivo',
  desligada: 'Desligado neste dispositivo',
  bloqueada: 'Bloqueado no navegador',
  indisponivel: 'Este navegador não recebe avisos',
}

const ReceberNoDispositivo = ({ celular, userId }: { celular: boolean; userId: string }) => {
  const [est, setEst] = useState<EstadoPush | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => { void estado(userId).then(setEst) }, [userId])

  if (est == null) return null
  const iphone = est === 'indisponivel' && precisaInstalar()
  if (est === 'indisponivel' && !iphone) return null
  const ligada = est === 'ligada'
  const titulo = `Receber ${ondeReceber()}`

  const alternar = async () => {
    setOcupado(true)
    setErro(null)
    try { if (ligada) await desligar(); else await ligar(userId) } catch (e) { setErro((e as Error).message) } finally {
      setEst(await estado(userId))
      setOcupado(false)
    }
  }

  return (
    <div className={cn(
      'shrink-0 border-t',
      celular
        ? 'border-gray-100 bg-gray-100 pb-[env(safe-area-inset-bottom)] dark:border-white/[0.06] dark:bg-[#121a2d]'
        : 'border-gray-100 bg-gray-50 dark:border-[#2f3b4f] dark:bg-[#172234]',
    )}>
      <button
        type="button"
        role="switch"
        aria-checked={ligada}
        aria-label={titulo}
        onClick={() => void alternar()}
        disabled={ocupado || iphone || est === 'bloqueada'}
        className={cn('flex w-full items-center gap-3.5 px-4 text-left disabled:opacity-70', celular ? 'py-3.5' : 'py-3')}
      >
        <BellRing className={cn('shrink-0', ligada ? 'text-teal-600 dark:text-teal-500' : 'text-gray-400 dark:text-[#64748b]', celular ? 'h-[18px] w-[18px]' : 'h-5 w-5')} />
        <span className="min-w-0 flex-1">
          <span className={cn('block font-medium text-gray-900 dark:text-gray-100', celular ? 'text-[14.5px]' : 'text-[13.5px]')}>{titulo}</span>
          <span className="block text-[11.5px] text-gray-500 dark:text-[#64748b]">{iphone ? 'No iPhone: instale o app na Tela de Início' : SUB[est]}</span>
        </span>
        <span aria-hidden className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', ligada ? 'bg-[#0f766e]' : 'bg-gray-300 dark:bg-[#3e4c63]')}>
          <span className={cn('absolute top-1 h-4 w-4 rounded-full shadow transition-all', ligada ? 'left-6 bg-white dark:bg-[#1e293b]' : 'left-1 bg-white')} />
        </span>
      </button>
      {erro && <p className="px-4 pb-2 text-[11.5px] text-red-600 dark:text-red-400">{erro}</p>}
    </div>
  )
}

export default SinoNotificacoes
