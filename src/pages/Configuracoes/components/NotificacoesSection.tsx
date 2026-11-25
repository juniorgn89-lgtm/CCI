import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff, Loader2, Send, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'
import InfoHint from '@/components/ui/InfoHint'
import { estado, ligar, desligar, testar, precisaInstalar, type EstadoPush } from '@/lib/push'
import { fetchMeuPapel } from '@/api/supabase/gestaoTarefas'

/** Tipos de aviso (mesmos ids do banco: docs/supabase-notificacoes.sql). */
const TIPOS = [
  { id: 'pedido_aguardando', nome: 'Pedido aguardando liberação', quem: 'Quem libera compras' },
  { id: 'pedido_decidido', nome: 'Meu pedido foi liberado ou recusado', quem: 'Quem pediu' },
  { id: 'nota_devolvida', nome: 'Nota do pedido devolvida', quem: 'Quem pediu e quem libera' },
  { id: 'tarefa_atribuida', nome: 'Nova tarefa para mim', quem: 'O responsável' },
  { id: 'lembrete', nome: 'Resumo da manhã', quem: 'Pendências de cada um, uma vez por dia' },
] as const
type TipoId = (typeof TIPOS)[number]['id']
const COLUNA: Record<TipoId, string> = {
  pedido_aguardando: 'pedido_aguardando', pedido_decidido: 'pedido_decidido', nota_devolvida: 'nota_devolvida',
  tarefa_atribuida: 'tarefa_atribuida', lembrete: 'lembrete',
}
const DIAS = [{ d: 1, n: 'Seg' }, { d: 2, n: 'Ter' }, { d: 3, n: 'Qua' }, { d: 4, n: 'Qui' }, { d: 5, n: 'Sex' }, { d: 6, n: 'Sáb' }, { d: 7, n: 'Dom' }]

interface ConfigRede {
  ativo: boolean; dias: number[]; hora_inicio: string; hora_fim: string
  pedido_aguardando: boolean; pedido_decidido: boolean; nota_devolvida: boolean; tarefa_atribuida: boolean; lembrete: boolean
}

const sb = () => { if (!supabase) throw new Error('Supabase não configurado.'); return supabase }
const semTabela = (code?: string) => code === '42P01' || code === 'PGRST205'

const Chave = ({ on, onClick, disabled, label }: { on: boolean; onClick: () => void; disabled?: boolean; label: string }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onClick}
    className={cn('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0 transition-colors disabled:opacity-50', on ? 'bg-[#1e3a5f] dark:bg-blue-500' : 'bg-gray-300 dark:bg-gray-700')}>
    <span className={cn('absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', on ? 'translate-x-5' : 'translate-x-0')} />
  </button>
)

/** Linha de configuração: texto à esquerda, chave à direita (como no celular). */
const LinhaChave = ({ titulo, ajuda, on, onClick, disabled }: { titulo: string; ajuda?: string; on: boolean; onClick: () => void; disabled?: boolean }) => (
  <div className="flex items-center gap-3 px-4 py-3">
    <div className="min-w-0 flex-1">
      <p className="text-[13.5px] font-medium text-gray-900 dark:text-gray-100">{titulo}</p>
      {ajuda && <p className="text-[11.5px] text-gray-500 dark:text-gray-400">{ajuda}</p>}
    </div>
    <Chave on={on} onClick={onClick} disabled={disabled} label={titulo} />
  </div>
)

/** Configurações › Avisos no celular: este aparelho, o que eu recebo e a janela da rede. */
const NotificacoesSection = () => {
  const qc = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const isMaster = useAuthStore((s) => s.isMaster)
  const rede = useTenantStore((s) => s.rede)
  const [est, setEst] = useState<EstadoPush | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  useEffect(() => { void estado(userId).then(setEst) }, [userId])

  const papel = useQuery({ queryKey: ['notif-meu-papel', userId], queryFn: fetchMeuPapel, enabled: !!userId && !isMaster, staleTime: 10 * 60_000 })
  const podeRede = isMaster || papel.data === 'supervisor'

  const pref = useQuery({
    queryKey: ['notif-pref', userId], enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await sb().from('notificacao_pref').select('desligados').maybeSingle()
      if (error) { if (semTabela(error.code)) return null; throw error }
      return ((data as { desligados?: string[] } | null)?.desligados ?? []) as string[]
    },
  })
  const config = useQuery({
    queryKey: ['notif-config', rede?.id], enabled: !!rede?.id,
    queryFn: async () => {
      const { data, error } = await sb().from('notificacao_config').select('*').eq('rede_id', rede!.id).maybeSingle()
      if (error) { if (semTabela(error.code)) return null; throw error }
      return data as (ConfigRede & { hora_inicio: string; hora_fim: string }) | null
    },
  })
  const aparelhos = useQuery({
    queryKey: ['notif-aparelhos', rede?.id], enabled: !!rede?.id && podeRede,
    queryFn: async () => {
      const { data } = await sb().rpc('notificacao_aparelhos', { p_rede: rede!.id })
      return (Array.isArray(data) ? data[0] : data) as { pessoas: number; aparelhos: number } | null
    },
  })

  const [form, setForm] = useState<ConfigRede | null>(null)
  useEffect(() => {
    if (config.data) setForm({ ...config.data, hora_inicio: config.data.hora_inicio.slice(0, 5), hora_fim: config.data.hora_fim.slice(0, 5) })
  }, [config.data])

  const rodar = async (chave: string, fn: () => Promise<string | void>) => {
    setOcupado(chave); setMsg(null)
    try { const t = await fn(); if (t) setMsg({ tipo: 'ok', texto: t }) } catch (e) { setMsg({ tipo: 'erro', texto: (e as Error).message }) } finally { setOcupado(null); setEst(await estado(userId)) }
  }

  const desligados = new Set(pref.data ?? [])
  const alternarTipo = (id: TipoId) => rodar(`tipo:${id}`, async () => {
    const n = new Set(desligados); if (n.has(id)) n.delete(id); else n.add(id)
    const { error } = await sb().rpc('notificacao_pref_salvar', { p_desligados: [...n] })
    if (error) throw new Error(error.message)
    await qc.invalidateQueries({ queryKey: ['notif-pref', userId] })
  })

  const salvarRede = () => form && rede && rodar('rede', async () => {
    const { error } = await sb().rpc('notificacao_config_salvar', {
      p_rede: rede.id, p_ativo: form.ativo, p_dias: form.dias, p_inicio: form.hora_inicio, p_fim: form.hora_fim,
      p_aguardando: form.pedido_aguardando, p_decidido: form.pedido_decidido, p_devolvida: form.nota_devolvida,
      p_tarefa: form.tarefa_atribuida, p_lembrete: form.lembrete,
    })
    if (error) throw new Error(error.message)
    await qc.invalidateQueries({ queryKey: ['notif-config', rede.id] })
    return 'Janela da rede salva.'
  })

  const bancoPronto = pref.data !== null && config.data !== null
  if (!userId) return null

  return (
    <section id="avisos" className="flex scroll-mt-6 flex-col gap-3">
      <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        Avisos no celular <InfoHint text="O Visor avisa na barra do celular quando você precisa agir: pedido para liberar, pedido decidido, nota devolvida, tarefa nova e um resumo das pendências de manhã. Cada pessoa liga no próprio aparelho." />
      </h2>
      <div className="flex-1 space-y-5 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-5">
        {!pref.isLoading && !bancoPronto && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">Os avisos ainda não foram ativados no banco de dados. Avise o suporte da CCI.</p>
        )}

        {/* Este aparelho */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-800">
          {est === 'ligada' ? <Bell className="h-5 w-5 text-emerald-600" /> : <BellOff className="h-5 w-5 text-gray-400" />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Neste aparelho: {est === 'ligada' ? 'ligado' : est === 'bloqueada' ? 'bloqueado pelo navegador' : est === 'indisponivel' ? 'não disponível' : 'desligado'}</p>
            <p className="text-[12px] text-gray-500 dark:text-gray-400">
              {est === 'bloqueada' ? 'Libere nas configurações do navegador (cadeado › Notificações) e volte aqui.'
                : est === 'indisponivel' ? 'Use o Chrome no Android ou o app instalado no iPhone.'
                : precisaInstalar() ? 'No iPhone: instale o Visor360 na Tela de Início (Compartilhar › Adicionar à Tela de Início) e ligue por lá.'
                : 'Os avisos chegam só dentro da janela de horário da rede.'}
            </p>
          </div>
          {est === 'ligada' ? (
            <>
              <button type="button" disabled={!!ocupado} onClick={() => rodar('testar', async () => { const r = await testar(); return `Aviso de teste enviado para ${r.aparelhos} aparelho(s).` })}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-[13px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                {ocupado === 'testar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Testar
              </button>
              <button type="button" disabled={!!ocupado} onClick={() => rodar('desligar', async () => { await desligar(); return 'Avisos desligados neste aparelho.' })}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-[13px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                <BellOff className="h-4 w-4" /> Desligar
              </button>
            </>
          ) : est === 'desligada' && (
            <button type="button" disabled={!!ocupado || !bancoPronto} onClick={() => rodar('ligar', async () => { await ligar(userId); return 'Avisos ligados neste aparelho. Toque em Testar para ver como chegam.' })}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-3.5 text-[13px] font-semibold text-white hover:bg-[#162d4a] disabled:opacity-50 dark:bg-blue-600">
              {ocupado === 'ligar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} Ligar avisos
            </button>
          )}
        </div>
        {msg && <p className={cn('text-[12.5px]', msg.tipo === 'ok' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400')}>{msg.texto}</p>}

        {/* O que eu quero receber */}
        {bancoPronto && (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">O que eu quero receber</p>
            <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800 sm:grid sm:grid-cols-2 sm:divide-y-0 [&>*]:border-gray-100 sm:[&>*]:border-b dark:[&>*]:border-gray-800 sm:[&>*:nth-child(odd)]:border-r">
              {TIPOS.map((t) => (
                <LinhaChave key={t.id} titulo={t.nome} ajuda={t.quem} on={!desligados.has(t.id)} disabled={!!ocupado} onClick={() => alternarTipo(t.id)} />
              ))}
            </div>
          </div>
        )}

        {/* Janela da rede (supervisor e diretor) */}
        {bancoPronto && podeRede && form && rede && (
          <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Janela de envio · {rede.nome}</p>
              <InfoHint text="Vale para todos da rede. Fora destes dias e horário nada é enviado; o que acontecer nesse meio-tempo entra no resumo da manhã seguinte." />
              {aparelhos.data && <span className="ml-auto text-[11px] text-gray-500">{aparelhos.data.pessoas} pessoa(s) com avisos ligados · {aparelhos.data.aparelhos} aparelho(s)</span>}
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-transparent">
              <LinhaChave titulo="Avisos da rede ligados" ajuda="Desligado, ninguém da rede recebe aviso." on={form.ativo} onClick={() => setForm({ ...form, ativo: !form.ativo })} />
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Dias</p>
              <div className="flex flex-wrap gap-1.5">
              {DIAS.map(({ d, n }) => {
                const on = form.dias.includes(d)
                return <button key={d} type="button" onClick={() => setForm({ ...form, dias: on ? form.dias.filter((x) => x !== d) : [...form.dias, d].sort() })}
                  className={cn('h-9 w-12 rounded-lg border text-[12.5px] font-semibold transition-colors', on ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white dark:border-blue-500 dark:bg-blue-600' : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-transparent dark:text-gray-400')}>{n}</button>
                })}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Horário</p>
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-gray-700 dark:text-gray-300">
                Das <input type="time" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} className="h-9 rounded-lg border border-gray-300 bg-white px-2 dark:border-gray-700 dark:bg-gray-950" />
                às <input type="time" value={form.hora_fim} onChange={(e) => setForm({ ...form, hora_fim: e.target.value })} className="h-9 rounded-lg border border-gray-300 bg-white px-2 dark:border-gray-700 dark:bg-gray-950" />
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Avisos que a rede manda</p>
              <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-transparent sm:grid sm:grid-cols-2 sm:divide-y-0 [&>*]:border-gray-100 sm:[&>*]:border-b dark:[&>*]:border-gray-800 sm:[&>*:nth-child(odd)]:border-r">
                {TIPOS.map((t) => {
                  const k = COLUNA[t.id] as keyof ConfigRede
                  return <LinhaChave key={t.id} titulo={t.nome} on={!!form[k]} onClick={() => setForm({ ...form, [k]: !form[k] })} />
                })}
              </div>
            </div>
            <div className="flex justify-end">
            <button type="button" disabled={!!ocupado} onClick={salvarRede}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-3.5 text-[13px] font-semibold text-white hover:bg-[#162d4a] disabled:opacity-50 dark:bg-blue-600">
              {ocupado === 'rede' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar janela da rede
            </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default NotificacoesSection
