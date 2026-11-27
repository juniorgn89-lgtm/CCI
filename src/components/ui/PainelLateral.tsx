import { useEffect, useRef } from 'react'
import useSaidaSuave from '@/hooks/useSaidaSuave'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import GuiaDoModal from '@/components/guia/GuiaDoModal'
import { GUIA_ATTR, type GuiaModal } from '@/components/guia/tipos'

/** Clique/foco dentro do balão do guia (portal fora do painel) não fecha o painel. */
const noGuia = (e: Event) => (e.target instanceof Element && !!e.target.closest(`[${GUIA_ATTR}]`))

/**
 * Painel lateral (padrão Atlas): abre da direita, ocupando a altura toda — para
 * formulários e "editar um registro" (criar usuário, nova tarefa, rotina…).
 * Cabeçalho fixo (título + subtítulo + fechar), corpo que rola por dentro e
 * rodapé fixo com os botões. O centro da tela fica para confirmações curtas e
 * análises com gráfico.
 *
 * - `onSubmit`: corpo e rodapé viram um <form> (Enter envia; botão type="submit").
 * - Padrão: Dialog do Radix (Esc fecha, foco preso dentro; menus do Radix por
 *   cima funcionam).
 * - `naoModal`: sem o Radix — para telas que abrem OUTRAS janelas próprias por
 *   cima (ex.: Admin › editar usuário → postos / módulos). Fundo escuro clicável
 *   fecha; Esc fecha só se não houver outra janela aberta por cima.
 */
interface Props {
  open: boolean
  onClose: () => void
  titulo: React.ReactNode
  subtitulo?: React.ReactNode
  children: React.ReactNode
  /** Botões do rodapé (ficam presos embaixo). */
  rodape?: React.ReactNode
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void
  /** Largura máxima; padrão 460px (formulário). Ex.: 'max-w-[640px]'. */
  largura?: string
  /** Corpo sem margem interna (o conteúdo traz as próprias seções). */
  semPadding?: boolean
  naoModal?: boolean
  /** Dica do personagem ao lado do painel (só no modo padrão). */
  guia?: GuiaModal
  /** Camada (z-index) no modo naoModal; o de cima usa um número maior. */
  camada?: number
}

const CABECALHO = 'flex shrink-0 items-start justify-between gap-4 border-b border-gray-200 px-6 py-5 dark:border-[#2f3b4f]'
const TITULO = 'text-[18px] font-semibold leading-tight text-gray-900 dark:text-gray-100'
const FECHAR = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900 dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.12] dark:hover:text-white'
const PAINEL = 'fixed inset-y-0 right-0 flex w-full flex-col border-l border-gray-200 bg-white shadow-2xl outline-none dark:border-[#2f3b4f] dark:bg-[#1e293b]'

const PainelLateral = ({ open, onClose, titulo, subtitulo, children, rodape, onSubmit, largura = 'max-w-[460px]', semPadding, naoModal, camada = 40, guia }: Props) => {
  const painelRef = useRef<HTMLDivElement>(null)
  useSaidaSuave(painelRef, 'painel-sai .22s cubic-bezier(.4, 0, 1, 1) forwards')
  const corpo = (
    <>
      <div className={cn('min-h-0 flex-1 overflow-y-auto', !semPadding && 'px-6 pb-6 pt-5')}>{children}</div>
      {rodape && (
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gray-200 bg-white px-6 py-4 dark:border-[#2f3b4f] dark:bg-[#1e293b]">
          {rodape}
        </div>
      )}
    </>
  )
  const conteudo = onSubmit ? <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">{corpo}</form> : corpo

  if (naoModal) return open ? <PainelSolto {...{ onClose, titulo, subtitulo, largura, camada }}>{conteudo}</PainelSolto> : null

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="janela-fundo-entra fixed inset-0 z-50 bg-black/40 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          ref={painelRef}
          aria-describedby={undefined}
          onPointerDownOutside={(e) => { if (guia && noGuia(e)) e.preventDefault() }}
          onInteractOutside={(e) => { if (guia && noGuia(e)) e.preventDefault() }}
          onFocusOutside={(e) => { if (guia && noGuia(e)) e.preventDefault() }}
          onOpenAutoFocus={(e) => {
            // Foca o 1º campo de digitação (não o botão de fechar).
            e.preventDefault()
            const el = e.currentTarget as HTMLElement
            el.querySelector<HTMLElement>('[autofocus], input:not([type="hidden"]):not([type="checkbox"]):not([disabled]), textarea:not([disabled]), select:not([disabled])')?.focus()
          }}
          className={cn(PAINEL, 'painel-entra z-50 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right', largura)}
        >
          <div className={CABECALHO}>
            <div className="min-w-0">
              <DialogPrimitive.Title className={TITULO}>{titulo}</DialogPrimitive.Title>
              {subtitulo && <p className="mt-1 text-[12.5px] text-gray-500 dark:text-gray-400">{subtitulo}</p>}
            </div>
            <DialogPrimitive.Close aria-label="Fechar" className={FECHAR}><X className="h-4 w-4" /></DialogPrimitive.Close>
          </div>
          {conteudo}
          {guia && <GuiaDoModal guia={guia} contentRef={painelRef} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** Versão sem Radix (naoModal): deixa outras janelas próprias abrirem por cima. */
const PainelSolto = ({ onClose, titulo, subtitulo, largura, camada, children }: {
  onClose: () => void; titulo: React.ReactNode; subtitulo?: React.ReactNode; largura: string; camada: number; children: React.ReactNode
}) => {
  const painelRef = useRef<HTMLDivElement>(null)
  useSaidaSuave(painelRef, 'painel-sai .22s cubic-bezier(.4, 0, 1, 1) forwards')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Só o painel de cima fecha com Esc.
      const paineis = document.querySelectorAll<HTMLElement>('[data-painel-lateral]')
      const topo = [...paineis].sort((a, b) => Number(b.dataset.camada) - Number(a.dataset.camada))[0]
      if (topo?.dataset.camada === String(camada)) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, camada])
  return (
    <>
      <div className="janela-fundo-entra fixed inset-0 bg-black/40" style={{ zIndex: camada }} onMouseDown={onClose} />
      <div ref={painelRef} role="dialog" aria-modal="true" data-painel-lateral data-camada={camada} className={cn(PAINEL, 'painel-entra', largura)} style={{ zIndex: camada }}>
        <div className={CABECALHO}>
          <div className="min-w-0">
            <h2 className={TITULO}>{titulo}</h2>
            {subtitulo && <p className="mt-1 truncate text-[12.5px] text-gray-500 dark:text-gray-400">{subtitulo}</p>}
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} className={FECHAR}><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </>
  )
}

export default PainelLateral
