import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Paperclip, Loader2, Trash2, ExternalLink, Image as ImageIcon, FileText } from 'lucide-react'
import { fetchAnexos, enviarAnexo, urlAnexo, removerAnexo, ANEXO_MAX_BYTES, type AnexoRow, type TarefaRow } from '@/api/supabase/gestaoTarefas'
import { useGestaoBase, btnGhost, fmtDataHora } from './comum'
import { Erro } from './comumUi'

/** Foto ou documento da tarefa (bucket privado; abre por link temporário). */
const AnexosTarefa = ({ tarefa }: { tarefa: TarefaRow }) => {
  const base = useGestaoBase()
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const anexos = useQuery({ queryKey: ['gestao-anexos', tarefa.id], queryFn: () => fetchAnexos(tarefa.id) })
  const invalidar = () => void qc.invalidateQueries({ queryKey: ['gestao-anexos', tarefa.id] })

  const enviar = async (file: File | undefined) => {
    if (!file) return
    setEnviando(true); setErro(null)
    try { await enviarAnexo(tarefa, file, base.autor); invalidar() } catch (e) { setErro(e instanceof Error ? e.message : String(e)) } finally { setEnviando(false); if (input.current) input.current.value = '' }
  }
  const abrir = async (a: AnexoRow) => {
    setErro(null)
    try { window.open(await urlAnexo(a), '_blank', 'noopener') } catch (e) { setErro(e instanceof Error ? e.message : String(e)) }
  }
  const remover = async (a: AnexoRow) => {
    setErro(null)
    try { await removerAnexo(a); invalidar() } catch (e) { setErro(e instanceof Error ? e.message : String(e)) }
  }
  const podeRemover = (a: AnexoRow) => base.podeGerir || a.autor_id === base.userId

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Fotos e documentos</p>
        <button type="button" className={`${btnGhost} h-7 px-2 text-xs`} onClick={() => input.current?.click()} disabled={enviando}>
          {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />} Anexar
        </button>
        <input ref={input} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => void enviar(e.target.files?.[0])} />
      </div>
      {(anexos.data ?? []).length === 0 ? (
        <p className="text-[11px] text-gray-400">Nenhum anexo. Até {Math.round(ANEXO_MAX_BYTES / 1024 / 1024)} MB por arquivo.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
          {(anexos.data ?? []).map((a) => (
            <li key={a.id} className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
              {a.tipo?.startsWith('image/') ? <ImageIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" /> : <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
              <button type="button" onClick={() => void abrir(a)} className="min-w-0 flex-1 truncate text-left font-medium text-gray-800 hover:underline dark:text-gray-200">{a.nome}</button>
              <span className="hidden whitespace-nowrap text-gray-400 sm:inline">{a.autor_nome ?? ''} · {fmtDataHora(a.criado_em)}</span>
              <button type="button" onClick={() => void abrir(a)} className="text-gray-400 hover:text-gray-700" title="Abrir"><ExternalLink className="h-3.5 w-3.5" /></button>
              {podeRemover(a) && <button type="button" onClick={() => void remover(a)} className="text-gray-400 hover:text-red-600" title="Remover"><Trash2 className="h-3.5 w-3.5" /></button>}
            </li>
          ))}
        </ul>
      )}
      <Erro msg={erro} />
    </div>
  )
}

export default AnexosTarefa
