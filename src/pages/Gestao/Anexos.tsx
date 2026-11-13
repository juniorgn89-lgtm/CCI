import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Paperclip, Loader2, Trash2, ExternalLink, Image as ImageIcon, FileText, Camera, CheckCircle2, Circle } from 'lucide-react'
import { enviarAnexo, urlAnexo, removerAnexo, exigeAnexo, ANEXO_MAX_BYTES, type AnexoRow, type TarefaRow } from '@/api/supabase/gestaoTarefas'
import { useGestaoBase, useAnexosTarefa, btnGhost, fmtDataHora } from './comum'
import { Erro } from './comumUi'
import { cn } from '@/lib/utils'

/** Miniatura de uma foto (link temporário do bucket privado). */
const Miniatura = ({ a, onAbrir }: { a: AnexoRow; onAbrir: () => void }) => {
  const url = useQuery({ queryKey: ['gestao-anexo-url', a.id], queryFn: () => urlAnexo(a), staleTime: 50 * 60 * 1000 })
  return (
    <button type="button" onClick={onAbrir} className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800" title="Abrir a foto">
      {url.data ? <img src={url.data} alt={a.nome} className="h-full w-full object-cover" loading="lazy" /> : <ImageIcon className="m-auto h-4 w-4 text-gray-400" />}
    </button>
  )
}

const ACEITA = 'image/*,.pdf,.doc,.docx,.xls,.xlsx'

/**
 * Foto ou documento da tarefa (bucket privado; abre por link temporário).
 * Com documentos exigidos, cada um vira uma linha com o próprio botão: o
 * arquivo enviado ali fica marcado como aquele documento. "Foto" abre a
 * câmera direto no celular.
 */
const AnexosTarefa = ({ tarefa }: { tarefa: TarefaRow }) => {
  const base = useGestaoBase()
  const qc = useQueryClient()
  const arquivo = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  // Para qual documento exigido vai o próximo arquivo escolhido (null = anexo livre).
  const alvo = useRef<string | null>(null)
  const [enviando, setEnviando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const anexos = useAnexosTarefa(tarefa.id)
  const invalidar = () => void qc.invalidateQueries({ queryKey: ['gestao-anexos', tarefa.id] })
  const aberta = tarefa.status === 'a_fazer' || tarefa.status === 'em_andamento'
  const docs = tarefa.documentos_exigidos ?? []
  const lista = anexos.data ?? []

  const escolher = (doc: string | null, via: 'arquivo' | 'camera') => {
    alvo.current = doc
    ;(via === 'camera' ? camera : arquivo).current?.click()
  }
  const enviar = async (file: File | undefined) => {
    if (!file) return
    const doc = alvo.current
    setEnviando(doc ?? ''); setErro(null)
    try { await enviarAnexo(tarefa, file, base.autor, doc); invalidar() } catch (e) { setErro(e instanceof Error ? e.message : String(e)) } finally {
      setEnviando(null)
      if (arquivo.current) arquivo.current.value = ''
      if (camera.current) camera.current.value = ''
    }
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

  const botoes = (doc: string | null, rotulo = 'Anexar') => (
    <span className="inline-flex shrink-0 gap-1">
      <button type="button" className={`${btnGhost} h-7 px-2 text-xs`} onClick={() => escolher(doc, 'camera')} disabled={enviando !== null} title="Tirar foto agora (no celular abre a câmera)">
        <Camera className="h-3.5 w-3.5" /> Foto
      </button>
      <button type="button" className={`${btnGhost} h-7 px-2 text-xs`} onClick={() => escolher(doc, 'arquivo')} disabled={enviando !== null}>
        {enviando === (doc ?? '') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />} {rotulo}
      </button>
    </span>
  )

  const linha = (a: AnexoRow) => (
    <li key={a.id} className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
      {a.tipo?.startsWith('image/') ? <Miniatura a={a} onAbrir={() => void abrir(a)} /> : <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
      <button type="button" onClick={() => void abrir(a)} className="min-w-0 flex-1 truncate text-left font-medium text-gray-800 hover:underline dark:text-gray-200">{a.nome}</button>
      <span className="hidden whitespace-nowrap text-gray-400 sm:inline">{a.autor_nome ?? ''} · {fmtDataHora(a.criado_em)}</span>
      <button type="button" onClick={() => void abrir(a)} className="text-gray-400 hover:text-gray-700" title="Abrir"><ExternalLink className="h-3.5 w-3.5" /></button>
      {podeRemover(a) && <button type="button" onClick={() => void remover(a)} className="text-gray-400 hover:text-red-600" title="Remover"><Trash2 className="h-3.5 w-3.5" /></button>}
    </li>
  )

  const livres = docs.length ? lista.filter((a) => !a.documento || !docs.includes(a.documento)) : lista

  return (
    <div className="space-y-2">
      <input ref={arquivo} type="file" className="hidden" accept={ACEITA} onChange={(e) => void enviar(e.target.files?.[0])} />
      <input ref={camera} type="file" className="hidden" accept="image/*" capture="environment" onChange={(e) => void enviar(e.target.files?.[0])} />

      {docs.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400">Documentos exigidos para concluir</p>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
            {docs.map((d) => {
              const doDoc = lista.filter((a) => a.documento === d)
              const ok = doDoc.length > 0
              return (
                <li key={d}>
                  <div className="flex flex-wrap items-center gap-2 px-2.5 py-2 text-xs">
                    {ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />}
                    <span className={cn('min-w-0 flex-1 font-medium', ok ? 'text-gray-800 dark:text-gray-200' : 'text-gray-600 dark:text-gray-300')}>{d}</span>
                    {aberta && botoes(d, ok ? 'Outro' : 'Anexar')}
                  </div>
                  {doDoc.length > 0 && <ul className="pb-1 pl-6">{doDoc.map(linha)}</ul>}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
            {docs.length ? 'Outras fotos e documentos' : 'Fotos e documentos'}
            {!docs.length && exigeAnexo(tarefa) && <span className="ml-1 font-normal text-amber-600 dark:text-amber-400">· obrigatório para concluir</span>}
          </p>
          {aberta ? botoes(null) : <span />}
        </div>
        {livres.length === 0 ? (
          <p className="text-[11px] text-gray-400">{anexos.isLoading ? 'Carregando…' : `Nenhum anexo. Até ${Math.round(ANEXO_MAX_BYTES / 1024 / 1024)} MB por arquivo.`}</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
            {livres.map(linha)}
          </ul>
        )}
      </div>
      <Erro msg={erro} />
    </div>
  )
}

export default AnexosTarefa
