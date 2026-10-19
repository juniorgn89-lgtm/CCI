import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/formatters'
import type { ReabastTanque, ReabastNivel } from '@/pages/Dashboard/hooks/useReabastecimento'
import { COR_NIVEL, produtoCurto } from '@/pages/Dashboard/components/tanqueNivel'

/** Só o desenho do tanque, com o nível preenchido de baixo pra cima. */
export const TanqueSvg = ({ pct, nivel, id, className }: { pct: number; nivel: ReabastNivel; id: string; className?: string }) => {
  const p = Math.max(0, Math.min(100, pct))
  const cor = COR_NIVEL[nivel]
  const altura = (24 * p) / 100
  const y = 30 - altura
  return (
    <svg viewBox="0 0 32 34" className={className ?? 'h-9 w-9'} aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <rect x="5" y="6" width="22" height="24" rx="6" />
        </clipPath>
      </defs>
      <rect x="12" y="2" width="8" height="5" rx="1.5" className="fill-gray-300 dark:fill-gray-600" />
      <rect x="5" y="6" width="22" height="24" rx="6" className="fill-gray-100 dark:fill-gray-800" />
      <rect x="5" y={y} width="22" height={altura} fill={cor.fill} clipPath={`url(#${id})`} opacity="0.9" />
      <rect x="5" y="6" width="22" height="24" rx="6" fill="none" stroke={nivel === 'ok' ? 'currentColor' : cor.fill} strokeWidth={nivel === 'ok' ? 1 : 1.5} className="text-gray-300 dark:text-gray-600" />
      <rect x="8" y="30" width="4" height="3" className="fill-gray-300 dark:fill-gray-600" />
      <rect x="20" y="30" width="4" height="3" className="fill-gray-300 dark:fill-gray-600" />
    </svg>
  )
}

/** Ícone de tanque com % e produto; vira botão quando recebe onClick. */
export const TanqueIcone = ({ t, onClick, ativo }: { t: ReabastTanque; onClick?: () => void; ativo?: boolean }) => {
  const pct = Math.max(0, Math.min(100, t.nivelPct))
  const cor = COR_NIVEL[t.nivel]
  const id = `tq-${t.empresaCodigo}-${t.tanqueCodigo}`
  const title = `${t.tanqueNome} · ${t.produtoNome}\n${formatNumber(Math.round(t.estoqueAtual))} L de ${formatNumber(Math.round(t.capacidade))} L (${pct.toFixed(1).replace('.', ',')}%)\nCabe ${formatNumber(Math.round(Math.max(0, t.capacidade - t.estoqueAtual)))} L · ${t.estoqueFonte === 'estimado' ? 'físico estimado' : 'escritural'}${onClick ? '\nClique para ver ao vivo' : ''}`
  const conteudo = (
    <>
      <TanqueSvg pct={pct} nivel={t.nivel} id={id} />
      <span className={cn('text-[11px] font-bold tabular-nums leading-tight', cor.text)}>{Math.round(pct)}%</span>
      <span className="max-w-full truncate text-[9px] leading-tight text-gray-500 dark:text-gray-400">{produtoCurto(t.produtoNome)}</span>
    </>
  )
  if (!onClick) return <div className="flex w-14 flex-col items-center" title={title}>{conteudo}</div>
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick() }}
      title={title}
      className={cn(
        'flex w-14 flex-col items-center rounded-lg py-0.5 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a5f] dark:hover:bg-white/10',
        ativo && 'ring-2 ring-[#1e3a5f] dark:ring-blue-400',
      )}
    >
      {conteudo}
    </button>
  )
}
