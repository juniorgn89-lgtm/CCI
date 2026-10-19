import { useMemo, useState } from 'react'
import { Sun, MessageCircle, Copy, Check, AlertTriangle, CalendarCheck } from 'lucide-react'
import { estaAtrasada, type TarefaRow, type UsuarioRede } from '@/api/supabase/gestaoTarefas'
import ShareReportButton from '@/components/feedback/ShareReportButton'
import type { ReportPayload } from '@/lib/report/reportTypes'
import InfoHint from '@/components/ui/InfoHint'
import { cn } from '@/lib/utils'
import { containerCls, btnGhost, somaDias } from './comum'

interface Props {
  tarefas: TarefaRow[]
  /** Instante da última leitura (ms). */
  agora: number
  hoje: string
  usuarios: UsuarioRede[]
  nomePosto: (codigo: number | null | undefined) => string | null
  nomeSetor: (id: string | null | undefined) => string | null
}

const noPrazo = (t: TarefaRow) => t.status === 'concluida' && !!t.concluida_em && new Date(t.concluida_em).getTime() <= new Date(t.vence_em).getTime()
const br = (iso: string) => iso.split('-').reverse().join('/')
const hora = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const diasEntre = (a: string, b: string) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86_400_000)

const contar = <T,>(xs: T[], chave: (x: T) => string) => {
  const m = new Map<string, number>()
  for (const x of xs) m.set(chave(x), (m.get(chave(x)) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

/**
 * Gestão → Painel → "Resumo do dia": o briefing pronto pra mandar no grupo
 * do WhatsApp de manhã — ontem (execução), hoje (o que vence, por posto e por
 * pessoa) e as atrasadas. Determinístico, derivado das tarefas já carregadas.
 * Texto pro WhatsApp, cópia e PDF. O envio automático diário depende de um
 * provedor de WhatsApp/e-mail (ainda não contratado) — por isso é manual.
 */
const ResumoDoDia = ({ tarefas, agora, hoje, usuarios, nomePosto, nomeSetor }: Props) => {
  const [copiado, setCopiado] = useState(false)
  const nomeUsuario = (id: string | null) => (id ? usuarios.find((u) => u.user_id === id)?.nome ?? 'Usuário' : 'Sem responsável')

  const r = useMemo(() => {
    const ontem = somaDias(hoje, -1)
    const ativas = tarefas.filter((t) => t.status !== 'cancelada')
    const vencOntem = ativas.filter((t) => t.vence_dia === ontem)
    const prazoOntem = vencOntem.filter(noPrazo)
    const concluidasOntem = ativas.filter((t) => t.status === 'concluida' && !!t.concluida_em && t.concluida_em.slice(0, 10) === ontem)
    const hojeAbertas = ativas.filter((t) => t.vence_dia === hoje && (t.status === 'a_fazer' || t.status === 'em_andamento'))
    const hojeFeitas = ativas.filter((t) => t.vence_dia === hoje && t.status === 'concluida')
    const atrasadas = ativas.filter((t) => estaAtrasada(t, agora) && t.vence_dia < hoje).sort((a, b) => a.vence_em.localeCompare(b.vence_em))
    const porPosto = contar(hojeAbertas, (t) => nomePosto(t.empresa_codigo) ?? 'Sem posto')
    const porPessoa = contar(hojeAbertas, (t) => nomeUsuario(t.responsavel_id))
    const execOntem = vencOntem.length ? Math.round((prazoOntem.length / vencOntem.length) * 100) : null
    return { ontem, vencOntem, prazoOntem, concluidasOntem, hojeAbertas, hojeFeitas, atrasadas, porPosto, porPessoa, execOntem }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefas, agora, hoje, usuarios])

  const texto = useMemo(() => {
    const L: string[] = [`*Visor360 · Tarefas · ${br(hoje)}*`, '']
    L.push(`*Ontem (${br(r.ontem)})*: ${r.vencOntem.length ? `${r.prazoOntem.length} de ${r.vencOntem.length} no prazo (${r.execOntem}%)` : 'nenhuma tarefa vencia'}`)
    L.push('')
    L.push(`*Hoje*: ${r.hojeAbertas.length} ${r.hojeAbertas.length === 1 ? 'tarefa vence' : 'tarefas vencem'}${r.hojeFeitas.length ? ` · ${r.hojeFeitas.length} já ${r.hojeFeitas.length === 1 ? 'concluída' : 'concluídas'}` : ''}`)
    for (const [n, q] of r.porPosto.slice(0, 8)) L.push(`• ${n}: ${q}`)
    if (r.porPessoa.length) { L.push('Por pessoa:'); for (const [n, q] of r.porPessoa.slice(0, 8)) L.push(`• ${n}: ${q}`) }
    L.push('')
    L.push(`*Atrasadas*: ${r.atrasadas.length}`)
    for (const t of r.atrasadas.slice(0, 10)) {
      const d = diasEntre(t.vence_dia, hoje)
      L.push(`• ${t.titulo} · ${nomePosto(t.empresa_codigo) ?? 'sem posto'} · há ${d} dia${d === 1 ? '' : 's'} · ${nomeUsuario(t.responsavel_id)}`)
    }
    if (r.atrasadas.length > 10) L.push(`… e mais ${r.atrasadas.length - 10}`)
    L.push('', 'Gerado pelo Visor360.')
    return L.join('\n')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r, hoje])

  const buildPdf = (): ReportPayload => ({
    title: `Tarefas · resumo de ${br(hoje)}`,
    subtitle: 'Ontem, hoje e o que está atrasado',
    kpis: [
      { label: 'Execução de ontem', value: r.execOntem === null ? '—' : `${r.execOntem}%`, tone: r.execOntem === null ? 'neutral' : r.execOntem >= 90 ? 'pos' : 'neg' },
      { label: 'Vencem hoje', value: String(r.hojeAbertas.length) },
      { label: 'Concluídas hoje', value: String(r.hojeFeitas.length), tone: 'pos' },
      { label: 'Atrasadas', value: String(r.atrasadas.length), tone: r.atrasadas.length ? 'neg' : 'pos' },
    ],
    sections: [
      { title: 'Hoje, por posto', rows: r.porPosto.map(([n, q]) => ({ label: n, value: String(q) })) },
      { title: 'Hoje, por pessoa', rows: r.porPessoa.map(([n, q]) => ({ label: n, value: String(q) })) },
      {
        title: 'Atrasadas',
        rows: r.atrasadas.map((t) => { const d = diasEntre(t.vence_dia, hoje); return { label: t.titulo, value: `há ${d} dia${d === 1 ? '' : 's'}`, sub: `${nomePosto(t.empresa_codigo) ?? 'sem posto'} · ${nomeSetor(t.setor_id) ?? 'sem setor'} · ${nomeUsuario(t.responsavel_id)} · vencia ${br(t.vence_dia)} ${hora(t.vence_em)}` } }),
        note: r.atrasadas.length === 0 ? 'Nada atrasado.' : undefined,
      },
    ],
    footnote: 'Visor360 · Tarefas · gerado a partir das tarefas registradas, sem estimativa.',
  })

  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); setCopiado(true); window.setTimeout(() => setCopiado(false), 2000) } catch { /* sem clipboard: o usuário usa o WhatsApp */ }
  }
  const whatsapp = () => window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')

  return (
    <div className={cn(containerCls, 'p-4')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <Sun className="h-4 w-4 text-amber-500" /> Resumo do dia · {br(hoje)}
            <InfoHint text="O briefing da manhã, pronto pra mandar no grupo: como foi ontem, o que vence hoje (por posto e por pessoa) e o que está atrasado. Sai como texto pro WhatsApp, cópia ou PDF. O envio automático todo dia depende de contratar um provedor de WhatsApp ou e-mail; por enquanto é com um clique." />
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Derivado das tarefas registradas. Nada estimado.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={whatsapp} className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#1ebe5d]"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</button>
          <button type="button" onClick={() => void copiar()} className={cn(btnGhost, 'h-8 text-[12px]')}>{copiado ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />} {copiado ? 'Copiado' : 'Copiar texto'}</button>
          <ShareReportButton filename="tarefas-resumo-do-dia.pdf" build={buildPdf} label="PDF" />
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg bg-gray-50 p-3 text-xs dark:bg-white/[0.04]">
          <p className="inline-flex items-center gap-1 font-semibold text-gray-700 dark:text-gray-200"><CalendarCheck className="h-3.5 w-3.5 text-emerald-500" /> Ontem · {br(r.ontem)}</p>
          <p className="mt-1 text-gray-600 dark:text-gray-300">
            {r.vencOntem.length === 0 ? 'Nenhuma tarefa vencia.' : <>{r.prazoOntem.length} de {r.vencOntem.length} no prazo <b className={cn(r.execOntem! >= 90 ? 'text-emerald-600 dark:text-emerald-400' : r.execOntem! >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400')}>({r.execOntem}%)</b></>}
            {r.concluidasOntem.length > 0 && <> · {r.concluidasOntem.length} concluída{r.concluidasOntem.length === 1 ? '' : 's'} ontem</>}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 text-xs dark:bg-white/[0.04]">
          <p className="inline-flex items-center gap-1 font-semibold text-gray-700 dark:text-gray-200"><Sun className="h-3.5 w-3.5 text-amber-500" /> Hoje · {r.hojeAbertas.length} {r.hojeAbertas.length === 1 ? 'vence' : 'vencem'}{r.hojeFeitas.length ? ` · ${r.hojeFeitas.length} feita${r.hojeFeitas.length === 1 ? '' : 's'}` : ''}</p>
          <ul className="mt-1 space-y-0.5 text-gray-600 dark:text-gray-300">
            {r.porPosto.length === 0 && <li>Nada vencendo hoje.</li>}
            {r.porPosto.slice(0, 5).map(([n, q]) => <li key={n} className="flex justify-between gap-2"><span className="truncate">{n}</span><b className="tabular-nums">{q}</b></li>)}
          </ul>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 text-xs dark:bg-white/[0.04]">
          <p className="inline-flex items-center gap-1 font-semibold text-gray-700 dark:text-gray-200"><AlertTriangle className={cn('h-3.5 w-3.5', r.atrasadas.length ? 'text-red-500' : 'text-gray-400')} /> Atrasadas · {r.atrasadas.length}</p>
          <ul className="mt-1 space-y-0.5 text-gray-600 dark:text-gray-300">
            {r.atrasadas.length === 0 && <li>Nada atrasado. 👋</li>}
            {r.atrasadas.slice(0, 5).map((t) => { const d = diasEntre(t.vence_dia, hoje); return <li key={t.id} className="flex justify-between gap-2"><span className="truncate">{t.titulo} <span className="text-gray-400">· {nomePosto(t.empresa_codigo) ?? ''}</span></span><span className="shrink-0 text-red-600 dark:text-red-400">há {d}d</span></li> })}
            {r.atrasadas.length > 5 && <li className="text-gray-400">… e mais {r.atrasadas.length - 5}</li>}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default ResumoDoDia
