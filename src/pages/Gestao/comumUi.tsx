import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { GuiaModal } from '@/components/guia/tipos'
import { cn } from '@/lib/utils'

/**
 * Modal padrão do módulo. No celular (<768px) deixa a barra inferior do app
 * livre (sobe 2rem e limita a altura) e o título fica à esquerda como no
 * desktop. Rodapé de botões: use <ModalRodape> pra ficar fixo embaixo.
 */
export const Modal = ({
  open, onClose, titulo, descricao, children, largura = 'max-w-xl', fundo = '', guia,
}: {
  open: boolean
  onClose: () => void
  titulo: React.ReactNode
  descricao?: React.ReactNode
  children: React.ReactNode
  largura?: string
  /** Fundo no modo escuro. Padrão '' = degradê do Dialog (o padrão do sistema); passe uma classe pra sobrescrever. */
  fundo?: string
  /** Personagem com balão explicando o modal (ver src/lib/guiasModais.ts). */
  guia?: GuiaModal
}) => (
  <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
    <DialogContent guia={guia} className={cn('top-[calc(50%-2rem)] max-h-[calc(100dvh-6rem)] overflow-y-auto md:top-[50%] md:max-h-[92vh] dark:border-gray-700', fundo, largura)}>
      <DialogHeader className="text-left">
        <DialogTitle className="pr-6 text-gray-900 dark:text-gray-100">{titulo}</DialogTitle>
        {descricao && <DialogDescription>{descricao}</DialogDescription>}
      </DialogHeader>
      {children}
    </DialogContent>
  </Dialog>
)

/** Rodapé de ações que fica visível mesmo com o conteúdo rolando. */
export const ModalRodape = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('sticky bottom-0 -mx-6 -mb-6 mt-1 flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 bg-white px-6 py-3 dark:border-gray-700 dark:bg-black', className)}>
    {children}
  </div>
)

/**
 * Confirmação dentro da própria tela (no lugar do confirm()/prompt() do navegador).
 * Use no lugar dos botões do <ModalRodape> enquanto a pessoa decide.
 * `comMotivo` mostra um campo de texto opcional que vai para onConfirmar.
 */
export const ConfirmaAcao = ({
  titulo, texto, rotulo, perigo = false, comMotivo = false, placeholder = 'Motivo (opcional)', ocupado = false, onConfirmar, onVoltar,
}: {
  titulo: React.ReactNode
  texto?: React.ReactNode
  rotulo: string
  perigo?: boolean
  comMotivo?: boolean
  placeholder?: string
  ocupado?: boolean
  onConfirmar: (motivo: string | null) => void
  onVoltar: () => void
}) => {
  const [motivo, setMotivo] = useState('')
  return (
    <div className={cn('w-full rounded-lg border px-3 py-2.5', perigo ? 'border-red-200 bg-red-50/70 dark:border-red-900/50 dark:bg-red-950/20' : 'border-[#1e3a5f]/20 bg-[#1e3a5f]/[0.04] dark:border-blue-400/30 dark:bg-blue-400/10')}>
      <p className={cn('text-[13px] font-semibold', perigo ? 'text-red-700 dark:text-red-300' : 'text-gray-900 dark:text-gray-100')}>{titulo}</p>
      {texto && <p className="mt-0.5 text-[12px] text-gray-600 dark:text-gray-300">{texto}</p>}
      {comMotivo && (
        <textarea autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder={placeholder}
          className="mt-2 w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-[12.5px] text-gray-900 placeholder:text-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
      )}
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onVoltar} disabled={ocupado} className="inline-flex h-9 items-center rounded-lg border border-gray-300 bg-white px-3 text-[13px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">Voltar</button>
        <button type="button" autoFocus={!comMotivo} onClick={() => onConfirmar(motivo.trim() || null)} disabled={ocupado}
          className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold text-white disabled:opacity-60', perigo ? 'bg-red-600 hover:bg-red-700' : 'bg-[#1e3a5f] hover:bg-[#162d4a] dark:bg-[#2563eb] dark:hover:bg-blue-500')}>
          {ocupado && <Loader2 className="h-4 w-4 animate-spin" />} {rotulo}
        </button>
      </div>
    </div>
  )
}

export const Erro = ({ msg }: { msg: string | null }) =>
  msg ? (
    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{msg}</p>
  ) : null

/** Pílulas de segmento (como no Pessoas): opções [{value,label}]. */
export const Segmentos = <T extends string | number>({ opcoes, valor, onChange }: { opcoes: { value: T; label: string }[]; valor: T; onChange: (v: T) => void }) => (
  <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-[#0f0f0f]">
    {opcoes.map((o) => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        className={cn(
          'rounded px-2.5 py-1 text-xs font-semibold transition-colors',
          o.value === valor ? 'bg-[#1e3a5f] text-white dark:bg-blue-700' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200',
        )}
      >
        {o.label}
      </button>
    ))}
  </div>
)

