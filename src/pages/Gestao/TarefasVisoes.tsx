import { useState } from 'react'
import { AlertTriangle, ListChecks } from 'lucide-react'
import { estaAtrasada, type TarefaRow, type TarefaStatus } from '@/api/supabase/gestaoTarefas'
import { containerCls, fmtDataHora, hojeLocal } from './comum'
import { cn } from '@/lib/utils'

/* Kanban (arrastar entre colunas). A Agenda mensal vive em Agenda.tsx. */

interface Ctx {
  nomePosto: (c: number | null) => string | null
  nomeUsuario: (id: string | null) => string | null
  nomeSetor: (id: string | null) => string | null
}

/** Colunas do quadro. "Atrasada" é derivada (aberta e vencida): não recebe
 *  arraste; soltar nas outras muda o status. */
type Coluna = TarefaStatus | 'atrasada'
const COLUNAS: { id: Coluna; label: string; dot: string; solta: TarefaStatus | null }[] = [
  { id: 'a_fazer', label: 'A fazer', dot: 'bg-gray-400', solta: 'a_fazer' },
  { id: 'em_andamento', label: 'Em andamento', dot: 'bg-blue-500', solta: 'em_andamento' },
  { id: 'atrasada', label: 'Atrasada', dot: 'bg-red-500', solta: null },
  { id: 'concluida', label: 'Concluída', dot: 'bg-emerald-500', solta: 'concluida' },
  { id: 'cancelada', label: 'Cancelada', dot: 'bg-gray-300 dark:bg-gray-600', solta: 'cancelada' },
]
const colunaDe = (t: TarefaRow): Coluna => (estaAtrasada(t) ? 'atrasada' : t.status)

const Cartao = ({ t, ctx, onAbrir, arrastavel }: { t: TarefaRow; ctx: Ctx; onAbrir: (t: TarefaRow) => void; arrastavel?: boolean }) => {
  const atrasada = estaAtrasada(t)
  const aberta = t.status === 'a_fazer' || t.status === 'em_andamento'
  const hoje = aberta && !atrasada && t.vence_dia === hojeLocal()
  const feitos = t.checklist.filter((c) => c.feito).length
  const posto = ctx.nomePosto(t.empresa_codigo)
  const resp = ctx.nomeUsuario(t.responsavel_id)
  const setor = ctx.nomeSetor(t.setor_id)
  const fechada = t.status === 'concluida' || t.status === 'cancelada'
  return (
    <button
      type="button"
      draggable={arrastavel}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move' }}
      onClick={() => onAbrir(t)}
      className={cn(
        'w-full rounded-lg border bg-white p-2.5 text-left shadow-sm transition-colors hover:border-[#1e3a5f]/40 dark:bg-gray-900/70 dark:hover:border-blue-500/50',
        atrasada ? 'border-red-300 dark:border-red-900/60' : 'border-gray-200 dark:border-gray-700',
        arrastavel && 'cursor-grab active:cursor-grabbing',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn('text-[12.5px] font-semibold leading-snug text-gray-900 dark:text-gray-100', fechada && 'text-gray-500 dark:text-gray-400')}>{t.titulo}</p>
        {atrasada && <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300">Atrasada</span>}
        {hoje && <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Hoje</span>}
      </div>
      <p className="mt-1 truncate text-[11px] text-gray-500 dark:text-gray-400">
        {posto ? <span className="uppercase">{posto}</span> : <span>Rede</span>}{resp && <> · {resp}</>}
      </p>
      <p className={cn('mt-0.5 text-[11px] tabular-nums', atrasada ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400')}>
        {atrasada && <AlertTriangle className="mr-1 inline h-3 w-3" />}{fmtDataHora(t.vence_em)}
      </p>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-400 dark:text-gray-500">
        <span>{t.rotina_id ? 'rotina' : 'avulsa'}</span>
        {setor && <span>{setor}</span>}
        {t.checklist.length > 0 && <span className={cn('inline-flex items-center gap-0.5', feitos === t.checklist.length ? 'text-emerald-600 dark:text-emerald-400' : '')}><ListChecks className="h-3 w-3" />{feitos}/{t.checklist.length}</span>}
      </p>
    </button>
  )
}

export const Kanban = ({ tarefas, ctx, onAbrir, onMudar }: {
  tarefas: TarefaRow[]; ctx: Ctx
  onAbrir: (t: TarefaRow) => void
  onMudar: (t: TarefaRow, s: TarefaStatus) => void
}) => {
  const [sobre, setSobre] = useState<Coluna | null>(null)
  const soltar = (status: TarefaStatus) => (e: React.DragEvent) => {
    e.preventDefault()
    setSobre(null)
    const id = e.dataTransfer.getData('text/plain')
    const t = tarefas.find((x) => x.id === id)
    if (t && t.status !== status) onMudar(t, status)
  }
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {COLUNAS.map((col) => {
        const itens = tarefas.filter((t) => colunaDe(t) === col.id)
        const recebe = col.solta !== null
        return (
          <div
            key={col.id}
            onDragOver={recebe ? (e) => { e.preventDefault(); if (sobre !== col.id) setSobre(col.id) } : undefined}
            onDragLeave={recebe ? () => setSobre(null) : undefined}
            onDrop={recebe ? soltar(col.solta as TarefaStatus) : undefined}
            className={cn(containerCls, 'flex min-h-[18rem] flex-col p-3 transition-shadow', sobre === col.id && 'ring-2 ring-blue-500/50')}
          >
            <div className="mb-2.5 flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                <span className={cn('h-2 w-2 rounded-full', col.dot)} />
                {col.label}
              </span>
              <span className="rounded-full bg-gray-100 px-1.5 text-[11px] tabular-nums text-gray-600 dark:bg-gray-800 dark:text-gray-300">{itens.length}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {itens.length === 0 && (
                <p className="py-10 text-center text-[11px] text-gray-400 dark:text-gray-500">{recebe ? 'Arraste tarefas para cá' : 'Nenhuma atrasada'}</p>
              )}
              {itens.map((t) => <Cartao key={t.id} t={t} ctx={ctx} onAbrir={onAbrir} arrastavel />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
