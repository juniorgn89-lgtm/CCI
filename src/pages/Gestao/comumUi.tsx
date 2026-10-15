import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/**
 * Modal padrão do módulo. No celular (<768px) deixa a barra inferior do app
 * livre (sobe 2rem e limita a altura) e o título fica à esquerda como no
 * desktop. Rodapé de botões: use <ModalRodape> pra ficar fixo embaixo.
 */
export const Modal = ({
  open, onClose, titulo, descricao, children, largura = 'max-w-xl',
}: {
  open: boolean
  onClose: () => void
  titulo: React.ReactNode
  descricao?: React.ReactNode
  children: React.ReactNode
  largura?: string
}) => (
  <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
    <DialogContent className={cn('top-[calc(50%-2rem)] max-h-[calc(100dvh-6rem)] overflow-y-auto md:top-[50%] md:max-h-[92vh] dark:border-gray-700 dark:bg-gray-900', largura)}>
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

