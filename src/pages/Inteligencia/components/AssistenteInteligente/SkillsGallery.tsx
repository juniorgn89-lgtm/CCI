import { Sparkles, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CADU_SKILLS,
  SKILL_GRUPOS,
  SKILL_TONE_STYLE,
  type CaduSkill,
  type SkillGrupo,
} from './skills'

interface SkillsGalleryProps {
  /** Dispara a pergunta da skill no chat. */
  onPick: (prompt: string) => void
  /** Desabilita os cartões (Cadu indisponível ou já processando). */
  disabled?: boolean
  /** Modo compacto (popover durante a conversa) — cartões menores, sem cabeçalho. */
  compact?: boolean
  className?: string
}

const SkillCard = ({
  skill,
  onPick,
  disabled,
  compact,
}: {
  skill: CaduSkill
  onPick: (prompt: string) => void
  disabled?: boolean
  compact?: boolean
}) => {
  const Icon = skill.Icon
  const tone = SKILL_TONE_STYLE[skill.tone]
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(skill.prompt)}
      title={skill.desc}
      className={cn(
        'group relative flex items-start gap-3 overflow-hidden rounded-xl border bg-gradient-to-br to-white text-left transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-lg disabled:pointer-events-none disabled:opacity-50',
        'dark:to-gray-900/60',
        tone.card,
        tone.hover,
        compact ? 'p-2.5' : 'p-3.5',
        skill.destaque
          ? 'border-amber-300/70 ring-1 ring-amber-300/50 dark:border-amber-600/40 dark:ring-amber-600/30'
          : 'border-gray-200 dark:border-gray-700',
      )}
    >
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105',
          compact ? 'h-9 w-9' : 'h-11 w-11',
          tone.icon,
        )}
      >
        <Icon className={compact ? 'h-[18px] w-[18px]' : 'h-5 w-5'} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'font-bold text-gray-900 dark:text-gray-100',
              compact ? 'text-[12.5px]' : 'text-sm',
            )}
          >
            {skill.label}
          </span>
          {skill.destaque && (
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          )}
        </div>
        {!compact && (
          <p className="mt-1 text-[11.5px] leading-snug text-gray-500 dark:text-gray-400">
            {skill.desc}
          </p>
        )}
      </div>
      {!compact && (
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 translate-x-1 text-gray-300 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400" />
      )}
    </button>
  )
}

/**
 * Galeria de "Análises prontas" do Cadu — agrupa as skills por tema. Usada no
 * estado vazio do chat (modo galeria) e no popover durante a conversa (compact).
 */
/**
 * Distribuição em 2 colunas (desktop): cada coluna empilha seus grupos coladinhos
 * (masonry), sem alinhar linhas — assim não sobra buraco quando um grupo tem mais
 * cards que o vizinho. Esquerda: combustível + vendas; direita: financeiro + estoque.
 */
const COLUNAS: SkillGrupo[][] = [
  ['Combustível & margem', 'Vendas & equipe'],
  ['Financeiro', 'Estoque'],
]

const GrupoBloco = ({
  grupo,
  onPick,
  disabled,
  compact,
}: {
  grupo: SkillGrupo
  onPick: (prompt: string) => void
  disabled?: boolean
  compact?: boolean
}) => {
  const doGrupo = CADU_SKILLS.filter((s) => s.grupo === grupo)
  if (doGrupo.length === 0) return null
  return (
    <div>
      <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {grupo}
      </h4>
      <div className="grid grid-cols-1 gap-2">
        {doGrupo.map((skill) => (
          <SkillCard key={skill.id} skill={skill} onPick={onPick} disabled={disabled} compact={compact} />
        ))}
      </div>
    </div>
  )
}

const SkillsGallery = ({ onPick, disabled, compact, className }: SkillsGalleryProps) => {
  // Popover (compact): uma coluna só, todos os grupos empilhados.
  if (compact) {
    return (
      <div className={cn('space-y-4', className)}>
        {SKILL_GRUPOS.map((grupo) => (
          <GrupoBloco key={grupo} grupo={grupo} onPick={onPick} disabled={disabled} compact />
        ))}
      </div>
    )
  }

  // Galeria (estado vazio): 2 colunas masonry no desktop, 1 coluna no mobile.
  return (
    <div className={cn('grid grid-cols-1 items-start gap-x-4 gap-y-4 sm:grid-cols-2', className)}>
      {COLUNAS.map((coluna, i) => (
        <div key={i} className="space-y-4">
          {coluna.map((grupo) => (
            <GrupoBloco key={grupo} grupo={grupo} onPick={onPick} disabled={disabled} />
          ))}
        </div>
      ))}
    </div>
  )
}

export default SkillsGallery
