import { BrainCircuit } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CaduAvatarProps {
  /** Tamanho + forma do avatar — ex.: 'h-7 w-7 rounded-full'. */
  className?: string
  /** Classe do ícone interno. */
  iconClassName?: string
}

/**
 * Avatar do Cadu IA — ícone de IA (BrainCircuit) sobre um gradiente
 * azul-marinho → azul. Usado no header, nas bolhas do assistente, no
 * "digitando" e na tela de boas-vindas.
 */
const CaduAvatar = ({ className, iconClassName = 'h-3.5 w-3.5' }: CaduAvatarProps) => (
  <span
    className={cn(
      'flex shrink-0 items-center justify-center bg-gradient-to-br from-[#1e3a5f] to-blue-500 text-white shadow-sm',
      className,
    )}
  >
    <BrainCircuit className={iconClassName} />
  </span>
)

export default CaduAvatar
