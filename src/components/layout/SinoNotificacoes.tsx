import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell, BellRing, ShoppingCart, Undo2, AlarmClock, CalendarClock, Sparkles, Settings2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'
import { RELEASE_NOTES } from '@/releaseNotes'
import { NovidadesModal } from '@/components/feedback/Novidades'
import { estado, ligar, desligar, precisaInstalar, type EstadoPush } from '@/lib/push'

/**
 * Sino da barra de topo (mesmo desenho do NotaOK): o que está esperando a
 * pessoa agora (pelo papel dela), as novidades da versão e, no rodapé, o
 * "Receber no celular" deste aparelho. As contas seguem as mesmas regras do
 * resumo da manhã (docs/supabase-notificacoes.sql).
 */

const CHAVE_VISTA = 'visor360.sino.versao' // última versão cujas novidades a pessoa já viu no sino
const lerVista = () => { try { return localStorage.getItem(CHAVE_VISTA) ?? '' } catch { return '' } }
const dataBR = (iso: string) => iso.split('-').reverse().join('/')
const fmt = (n: number) => n.toLocaleString('pt-BR')
const hojeLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Pendencia {
  id: string
  Icone: ComponentType<{ className?: string }>
  titulo: string
  texto: string
  href: string
  tom?: 'alerta'
}

const usePendencias = (ativo: boolean) => {
  const rede = useTenantStore((s) => s.rede)
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const podeLiberar = useAuthStore((s) => s.canLiberarCompras)
  const compras = !!rede?.compras_habilitado
  const tarefas = !!rede?.gestao_habilitado

  return useQuery({
    queryKey: ['sino-pendencias', rede?.id, userId, podeLiberar, compras, tarefas],
    enabled: ativo && !!supabase && !!rede?.id && !!userId && (compras || tarefas),
    refetchInterval: 2 * 60_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Pendencia[]> => {
      const sb = supabase!
      const redeId = rede!.id
      const conta = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
        const { count, error } = await q
        return error ? 0 : count ?? 0
      }
      const agora = new Date().toISOString()

      const [aLiberar, devolvidas, atrasadas, vencemHoje] = await Promise.all([
        compras && podeLiberar
          ? conta(sb.from('compras_pedidos').select('id', { count: 'exact', head: true }).eq('rede_id', redeId).eq('status', 'aguardando'))
          : 0,
        compras
          ? (async () => {
              const { data, error } = await sb.from('compras_pedido_notas').select('pedido_id').eq('rede_id', redeId).eq('situacao', 'devolvida')
              if (error || !data?.length) return 0
              const ids = [...new Set((data as { pedido_id: string }[]).map((n) => n.pedido_id))]
              if (podeLiberar) return ids.length
              // Quem só pede vê as devolvidas dos pedidos dele.
              return conta(sb.from('compras_pedidos').select('id', { count: 'exact', head: true }).in('id', ids).eq('solicitante_id', userId!))
            })()
          : 0,
        tarefas
          ? conta(sb.from('gestao_tarefas').select('id', { count: 'exact', head: true }).eq('rede_id', redeId).eq('responsavel_id', userId!)
              .in('status', ['a_fazer', 'em_andamento']).lt('vence_em', agora))
          : 0,
        tarefas
          ? conta(sb.from('gestao_tarefas').select('id', { count: 'exact', head: true }).eq('rede_id', redeId).eq('responsavel_id', userId!)
              .in('status', ['a_fazer', 'em_andamento']).gte('vence_em', agora).eq('vence_dia', hojeLocal()))
          : 0,
      ])

      const itens: (Pendencia | false)[] = [
        aLiberar > 0 && { id: 'liberar', Icone: ShoppingCart, titulo: 'Pedidos aguardando liberação', href: '/compras',
          texto: aLiberar === 1 ? '1 pedido de compra esperando você liberar ou recusar.' : `${fmt(aLiberar)} pedidos de compra esperando você liberar ou recusar.` },
        devolvidas > 0 && { id: 'devolvidas', Icone: Undo2, tom: 'alerta', titulo: 'Nota devolvida para correção', href: '/compras',
          texto: devolvidas === 1 ? 'A nota de 1 pedido voltou do NotaOK para corrigir.' : `As notas de ${fmt(devolvidas)} pedidos voltaram do NotaOK para corrigir.` },
        atrasadas > 0 && { id: 'atrasadas', Icone: AlarmClock, tom: 'alerta', titulo: 'Tarefas atrasadas', href: '/gestao?tab=tarefas',
          texto: atrasadas === 1 ? '1 tarefa sua passou do prazo.' : `${fmt(atrasadas)} tarefas suas passaram do prazo.` },
        vencemHoje > 0 && { id: 'hoje', Icone: CalendarClock, titulo: 'Tarefas que vencem hoje', href: '/gestao?tab=tarefas',
          texto: vencemHoje === 1 ? '1 tarefa sua vence hoje.' : `${fmt(vencemHoje)} tarefas suas vencem hoje.` },
      ]
      return itens.filter((i): i is Pendencia => !!i)
    },
  })
}

interface Props {
  /** desktop = barra branca/escura do Header; mobile = cabeçalho navy do app. */
  variant?: 'desktop' | 'mobile'
}

const SinoNotificacoes = ({ variant = 'desktop' }: Props) => {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const [aberto, setAberto] = useState(false)
  const [novidades, setNovidades] = useState(false)
  const [vista, setVista] = useState(lerVista)
  const ref = useRef<HTMLDivElement>(null)
  const { data: pendencias, isLoading, refetch } = usePendencias(!!userId)
  const ultima = RELEASE_NOTES[0]

  // Abrir o sino conta como "vi as novidades": o ponto some ao fechar.
  const fechar = useCallback(() => {
    setAberto(false)
    if (ultima) setVista(ultima.versao)
  }, [ultima])

  useEffect(() => {
    if (!aberto) return undefined
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) fechar() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [aberto, fechar])

  if (!userId) return null

  const novidadeNova = !!ultima && vista !== ultima.versao
  const lista = pendencias ?? []
  const avisos = lista.length + (novidadeNova ? 1 : 0)
  const alternar = () => {
    if (aberto) { fechar(); return }
    setAberto(true)
    void refetch()
    if (ultima) { try { localStorage.setItem(CHAVE_VISTA, ultima.versao) } catch { /* ignore */ } }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={alternar}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={avisos ? `Notificações (${avisos})` : 'Notificações'}
        className={cn(
          'relative flex shrink-0 items-center justify-center rounded-lg transition-colors',
          variant === 'mobile'
            ? 'h-9 w-9 text-white/90 hover:bg-white/10 active:bg-white/15'
            : 'h-8 w-8 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300',
          aberto && variant === 'desktop' && 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
        )}
      >
        <Bell className={variant === 'mobile' ? 'h-5 w-5' : 'h-4 w-4'} />
        {avisos > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white tabular-nums">
            {avisos > 9 ? '9+' : avisos}
          </span>
        )}
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Notificações"
          className={cn(
            'z-50 flex max-h-[75dvh] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-2xl dark:border-gray-700 dark:bg-gray-900',
            'fixed left-3 right-3 top-14 sm:absolute sm:left-auto sm:right-0 sm:top-11 sm:w-[380px]',
          )}
        >
          <div className="border-b border-gray-100 px-4 pb-3 pt-4 dark:border-gray-800">
            <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Notificações</p>
            <p className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">
              {isLoading ? 'Carregando…' : lista.length ? (lista.length === 1 ? '1 pendência' : `${lista.length} pendências`) : 'Tudo em dia'}
            </p>
          </div>

          <div className="flex-1 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800">
            {lista.map((p) => (
              <Item key={p.id} Icone={p.Icone} titulo={p.titulo} texto={p.texto} tom={p.tom} to={p.href} onClick={fechar} />
            ))}
            {ultima && (
              <Item
                Icone={Sparkles}
                titulo={`Novidades da versão ${ultima.versao}`}
                data={dataBR(ultima.data)}
                texto={ultima.resumo}
                novo={novidadeNova}
                onClick={() => { fechar(); setNovidades(true) }}
              />
            )}
          </div>

          <ReceberNoCelular userId={userId} onConfigurar={fechar} />
        </div>
      )}

      <NovidadesModal open={novidades} onClose={() => setNovidades(false)} releases={RELEASE_NOTES} />
    </div>
  )
}

interface ItemProps {
  Icone: ComponentType<{ className?: string }>
  titulo: string
  texto: string
  data?: string
  tom?: 'alerta'
  novo?: boolean
  to?: string
  onClick: () => void
}

const Item = ({ Icone, titulo, texto, data, tom, novo, to, onClick }: ItemProps) => {
  const corpo = (
    <>
      <span className={cn(
        'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
        tom === 'alerta'
          ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
          : 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300',
      )}>
        <Icone className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 text-[14px] font-medium text-gray-900 dark:text-gray-100">{titulo}</span>
          {novo && <span className="h-2 w-2 shrink-0 rounded-full bg-teal-500" />}
          {data && <span className="shrink-0 text-[11.5px] tabular-nums text-gray-400">{data}</span>}
        </span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-gray-600 dark:text-gray-400">{texto}</span>
      </span>
    </>
  )
  const classe = 'flex w-full items-start gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800'
  return to
    ? <Link to={to} onClick={onClick} className={classe}>{corpo}</Link>
    : <button type="button" onClick={onClick} className={classe}>{corpo}</button>
}

const SUB: Record<EstadoPush, string> = {
  ligada: 'Ligado neste aparelho',
  desligada: 'Desligado neste aparelho',
  bloqueada: 'Bloqueado no navegador (cadeado › Notificações)',
  indisponivel: 'Este navegador não recebe avisos',
}

const ReceberNoCelular = ({ userId, onConfigurar }: { userId: string; onConfigurar: () => void }) => {
  const [est, setEst] = useState<EstadoPush | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => { void estado(userId).then(setEst) }, [userId])

  if (est == null) return null
  const iphone = est === 'indisponivel' && precisaInstalar()
  const ligada = est === 'ligada'
  const travado = est === 'bloqueada' || (est === 'indisponivel' && !iphone) || iphone

  const alternar = async () => {
    setOcupado(true)
    setErro(null)
    try { if (ligada) await desligar(); else await ligar(userId) } catch (e) { setErro((e as Error).message) } finally {
      setEst(await estado(userId))
      setOcupado(false)
    }
  }

  return (
    <div className="shrink-0 border-t border-gray-100 bg-gray-50/70 dark:border-gray-800 dark:bg-black/20">
      <div className="flex items-center gap-3 px-4 py-3">
        <BellRing className={cn('h-5 w-5 shrink-0', ligada ? 'text-teal-600 dark:text-teal-300' : 'text-gray-400')} />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium text-gray-900 dark:text-gray-100">Receber no celular</span>
          <span className="block text-[11.5px] text-gray-500 dark:text-gray-400">{iphone ? 'No iPhone: instale o Visor360 na Tela de Início' : SUB[est]}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={ligada}
          aria-label="Receber no celular"
          disabled={ocupado || travado}
          onClick={() => void alternar()}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0 transition-colors disabled:opacity-50',
            ligada ? 'bg-[#1e3a5f] dark:bg-teal-600' : 'bg-gray-300 dark:bg-gray-700',
          )}
        >
          <span className={cn('absolute left-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition-transform', ligada ? 'translate-x-5' : 'translate-x-0')}>
            {ocupado && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
          </span>
        </button>
      </div>
      {erro && <p className="px-4 pb-2 text-[11.5px] text-red-600 dark:text-red-400">{erro}</p>}
      <Link
        to="/configuracoes#avisos"
        onClick={onConfigurar}
        className="flex items-center gap-1.5 border-t border-gray-100 px-4 py-2.5 text-[12px] font-medium text-gray-500 hover:text-gray-800 dark:border-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <Settings2 className="h-3.5 w-3.5" /> Escolher o que receber
      </Link>
    </div>
  )
}

export default SinoNotificacoes
