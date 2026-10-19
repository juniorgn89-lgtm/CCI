import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CCI, FONTE_TITULO } from '@/pages/Diagnostico/lib/marca'

/**
 * O símbolo oficial (o mesmo arquivo do Visor: um triângulo dourado e dois
 * verde-petróleo), sem moldura. Em fundo escuro (claro) ganha uma sombra
 * clara bem leve, só para os triângulos verdes não se perderem no verde.
 */
export const SimboloCCI = ({ className, claro }: { className?: string; claro?: boolean }) => (
  <img src="/brand/visor360-icon-512.png" alt="" className={cn('shrink-0 object-contain', claro && 'drop-shadow-[0_0_6px_rgba(255,255,255,0.35)]', className)} />
)

/** Logo "CCI" com o símbolo, para a capa. */
export const LogoCCI = ({ className }: { className?: string }) => (
  <span className={cn('inline-flex items-center gap-2', className)}>
    <SimboloCCI className="h-10 w-10" claro />
    <span className="text-[30px] font-extrabold leading-none tracking-tight" style={{ fontFamily: FONTE_TITULO, color: CCI.ouro }}>CCI</span>
  </span>
)

/**
 * Triângulos decorativos da capa (como nos slides): um dourado e dois em
 * vidro verde, no canto superior direito. Puramente visual.
 */
export const TriangulosCapa = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    <div className="absolute -right-10 -top-24 h-[420px] w-[420px] opacity-60" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,.14), rgba(255,255,255,0))', clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }} />
    <div className="absolute right-[4%] top-0 h-28 w-28 sm:h-36 sm:w-36" style={{ background: `linear-gradient(160deg, #F7C64A, ${CCI.ouro} 45%, #D99A06)`, clipPath: 'polygon(0 0, 100% 0, 100% 100%)', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }} />
    <div className="absolute right-[18%] top-6 h-20 w-20 border border-white/20 sm:h-24 sm:w-24" style={{ background: 'rgba(255,255,255,.06)', clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }} />
    <div className="absolute -bottom-24 right-[28%] h-72 w-72" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,.10), rgba(255,255,255,0))', clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }} />
  </div>
)

/** Título de seção como nos slides: número grande dourado, sobrelinha espaçada e a conclusão em manchete. */
export const SecaoTitulo = ({ n, sobre, titulo, sub, acao }: { n: number; sobre: string; titulo: ReactNode; sub?: ReactNode; acao?: ReactNode }) => (
  <header className="mb-4 flex flex-wrap items-end gap-x-5 gap-y-2">
    <span className="text-[52px] font-extrabold leading-[0.85] tabular-nums sm:text-[64px]" style={{ fontFamily: FONTE_TITULO, color: CCI.ouro }}>{String(n).padStart(2, '0')}</span>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#0F766E]/80 dark:text-teal-300/80">{sobre}</p>
      <h2 className="mt-1 text-[22px] font-extrabold leading-tight text-[#0B4A44] [text-wrap:balance] sm:text-[26px] dark:text-white" style={{ fontFamily: FONTE_TITULO }}>{titulo}</h2>
      {sub && <p className="mt-1 text-[14px] text-gray-600 dark:text-gray-300">{sub}</p>}
    </div>
    {acao}
  </header>
)

/** Bolinha numerada dourada (como "Por que alterar" dos slides). */
export const NumeroBola = ({ n, tom = 'ouro' }: { n: number; tom?: 'ouro' | 'teal' | 'coral' }) => (
  <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full text-[14px] font-extrabold shadow-[0_4px_12px_rgba(0,0,0,.12)] ring-2 ring-white dark:ring-[#0b2e2b]',
    tom === 'ouro' ? 'bg-[#FCB619] text-[#0B4A44]' : tom === 'teal' ? 'bg-[#0F766E] text-white' : 'bg-[#E4572E] text-white')} style={{ fontFamily: FONTE_TITULO }}>{n}</span>
)

/** Ícone em círculo dourado (cards dos pilares). */
export const IconeOuro = ({ children }: { children: ReactNode }) => (
  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#FCB619] text-[#0B4A44] shadow-[0_6px_16px_rgba(252,182,25,.35)]">{children}</span>
)

/** Sobrelinha espaçada ("COMO ESTÁ HOJE", "POR QUE ALTERAR"). */
export const Sobrelinha = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cn('text-[11px] font-bold uppercase tracking-[0.28em] text-gray-500 dark:text-gray-400', className)}>{children}</p>
)
