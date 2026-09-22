import { Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, MessageCircle, Mail, Check, MapPin, Server, Inbox } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { fetchLandingLeads, setLeadAtendido, type LandingLeadRow } from '@/api/supabase/leads'

/**
 * Painel → Leads (master): lista os leads captados pelo chat da landing
 * (`landing_leads`). Marca como atendido e dá atalho de WhatsApp/e-mail.
 */

const soDigitos = (s: string) => s.replace(/\D/g, '')

const waLink = (l: LandingLeadRow) => {
  const num = soDigitos(l.whatsapp)
  if (!num) return null
  const msg = `Olá ${l.nome}! Sou da CCI · Visor360. Vi seu interesse${l.rede ? ` (${l.rede})` : ''} e queria te ajudar.`
  const ddi = num.length <= 11 ? `55${num}` : num
  return `https://wa.me/${ddi}?text=${encodeURIComponent(msg)}`
}

const Leads = () => {
  const isMaster = useAuthStore((s) => s.isMaster)
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['landing-leads'], queryFn: fetchLandingLeads })

  if (!isMaster) return <Navigate to="/dashboard" replace />

  const leads = data ?? []
  const novos = leads.filter((l) => !l.atendido).length

  const toggle = async (l: LandingLeadRow) => {
    try {
      await setLeadAtendido(l.id, !l.atendido)
      await queryClient.invalidateQueries({ queryKey: ['landing-leads'] })
    } catch { /* RLS/erro — silencioso; a lista não muda */ }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-16">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Leads</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Captados pelo chat da landing page.</p>
        </div>
        {!isLoading && (
          <div className="flex gap-2 text-center">
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 dark:border-gray-700 dark:bg-gray-900">
              <div className="text-base font-bold text-gray-900 dark:text-gray-100">{leads.length}</div>
              <div className="text-[10px] uppercase tracking-wide text-gray-400">total</div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 dark:border-amber-700/40 dark:bg-amber-900/20">
              <div className="text-base font-bold text-amber-700 dark:text-amber-300">{novos}</div>
              <div className="text-[10px] uppercase tracking-wide text-amber-500">novos</div>
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 p-6 text-sm text-gray-500 dark:text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Carregando leads…</div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-300">
          Não consegui carregar os leads. Confirme que a tabela <code>landing_leads</code> existe (docs/supabase-landing-leads.sql) e que você é master.
        </div>
      ) : leads.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white/50 p-10 text-center dark:border-gray-700 dark:bg-gray-900/40">
          <Inbox className="h-8 w-8 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Nenhum lead ainda</p>
          <p className="text-xs text-gray-400">Assim que alguém usar o chat da landing, aparece aqui.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map((l) => {
            const wa = waLink(l)
            return (
              <div key={l.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{l.nome}</span>
                    {!l.atendido && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">novo</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-gray-500 dark:text-gray-400">
                    {l.rede && <span className="truncate">{l.rede}</span>}
                    {l.cidade && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{l.cidade}</span>}
                    {l.sistema && <span className="inline-flex items-center gap-1"><Server className="h-3 w-3" />{l.sistema}</span>}
                    <span>{new Date(l.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-700/40 dark:bg-green-900/20 dark:text-green-300"><MessageCircle className="h-4 w-4" /></a>
                  )}
                  {l.email && (
                    <a href={`mailto:${l.email}`} title={l.email} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"><Mail className="h-4 w-4" /></a>
                  )}
                  <button
                    onClick={() => toggle(l)}
                    title={l.atendido ? 'Marcar como não atendido' : 'Marcar como atendido'}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${l.atendido ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'border border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'}`}
                  >
                    <Check className="h-3.5 w-3.5" /> {l.atendido ? 'Atendido' : 'Atender'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Leads
