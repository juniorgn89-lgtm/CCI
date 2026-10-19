import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Personagem do guia: técnico de boné segurando um caderno (SVG plano, 2 tons). */
export const TecnicoCaderno = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 120 150" className={className} aria-hidden="true">
    {/* sombra */}
    <ellipse cx="60" cy="144" rx="34" ry="5" className="fill-gray-200 dark:fill-gray-800" />
    {/* corpo (macacão) */}
    <path d="M30 140 L32 98 Q34 84 48 80 L72 80 Q86 84 88 98 L90 140 Z" className="fill-[#1e3a5f] dark:fill-blue-900" />
    {/* alças */}
    <rect x="46" y="80" width="6" height="26" rx="2" className="fill-[#2563eb]" />
    <rect x="68" y="80" width="6" height="26" rx="2" className="fill-[#2563eb]" />
    {/* pescoço + cabeça */}
    <rect x="54" y="68" width="12" height="14" rx="4" className="fill-[#f2c6a0]" />
    <circle cx="60" cy="52" r="20" className="fill-[#f6d2b0]" />
    {/* boné */}
    <path d="M39 48 Q40 30 60 29 Q80 30 81 48 Z" className="fill-[#2563eb]" />
    <path d="M58 46 L92 46 Q94 50 88 51 L58 51 Z" className="fill-[#1e3a5f] dark:fill-blue-800" />
    {/* rosto */}
    <circle cx="53" cy="56" r="2.2" className="fill-gray-800" />
    <circle cx="67" cy="56" r="2.2" className="fill-gray-800" />
    <path d="M53 63 Q60 68 67 63" fill="none" strokeWidth="2.2" strokeLinecap="round" className="stroke-gray-800" />
    {/* braço segurando o caderno */}
    <path d="M86 96 Q98 100 96 116" fill="none" strokeWidth="9" strokeLinecap="round" className="stroke-[#1e3a5f] dark:stroke-blue-900" />
    {/* caderno */}
    <g transform="rotate(-8 80 112)">
      <rect x="62" y="96" width="34" height="40" rx="3" className="fill-white stroke-gray-300 dark:fill-gray-100" strokeWidth="1.5" />
      <rect x="62" y="96" width="5" height="40" rx="1" className="fill-amber-400" />
      <line x1="71" y1="106" x2="91" y2="106" strokeWidth="2" strokeLinecap="round" className="stroke-gray-300" />
      <line x1="71" y1="113" x2="91" y2="113" strokeWidth="2" strokeLinecap="round" className="stroke-gray-300" />
      <line x1="71" y1="120" x2="86" y2="120" strokeWidth="2" strokeLinecap="round" className="stroke-gray-300" />
      <path d="M72 126 l3 3 l6 -7" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="stroke-emerald-500" />
    </g>
    {/* mão + lápis */}
    <circle cx="94" cy="116" r="5" className="fill-[#f6d2b0]" />
    <rect x="34" y="96" width="5" height="22" rx="2" transform="rotate(20 36 107)" className="fill-amber-500" />
  </svg>
)

const GuiaBalao = ({ titulo, children, onEntendi, onNaoMostrarMais, lado = 'esquerda', className }: {
  titulo: string
  children: ReactNode
  onEntendi: () => void
  onNaoMostrarMais: () => void
  /** De que lado do modal o personagem fica (o bico do balão aponta para o modal). */
  lado?: 'esquerda' | 'topo'
  className?: string
}) => (
  <div className={cn(lado === 'esquerda' ? 'flex flex-col items-center' : 'flex items-start gap-3', className)} role="note">
    <div className={cn(
      'relative rounded-2xl border border-blue-200 bg-white p-4 text-[12.5px] leading-relaxed text-gray-700 shadow-xl dark:border-blue-900/50 dark:bg-gray-900 dark:text-gray-200',
      lado === 'topo' && 'order-2 flex-1 p-3',
    )}>
      <p className="mb-1 text-[13px] font-bold text-[#1e3a5f] dark:text-blue-300">{titulo}</p>
      <div className="space-y-1.5">{children}</div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={onEntendi} className="rounded-md bg-[#1e3a5f] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#172d4a]">Entendi</button>
        <button type="button" onClick={onNaoMostrarMais} className="rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">Não mostrar mais</button>
      </div>
      {/* bico do balão */}
      {lado === 'esquerda' && <span className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-blue-200 bg-white dark:border-blue-900/50 dark:bg-gray-900" />}
    </div>
    <TecnicoCaderno className={cn(lado === 'esquerda' ? 'mt-3 h-32 w-28' : 'order-1 h-20 w-16 shrink-0')} />
  </div>
)

export default GuiaBalao
