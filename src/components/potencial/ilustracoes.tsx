/**
 * Ilustrações spot-art FLAT 2-tons (navy/slate + azul do app) pro carrossel do
 * "Potencial desta tela". Sem dependência externa (SVG inline) e theme-aware via
 * classes Tailwind `fill-*`/`stroke-*` (light + dark). viewBox 220×140.
 */

type Props = { className?: string }

/** Rede consolidada: postos lado a lado ligados por uma linha. */
export const IlRede = ({ className }: Props) => (
  <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
    <line x1="46" y1="40" x2="110" y2="40" className="stroke-blue-400" strokeWidth="3" strokeDasharray="1 7" strokeLinecap="round" opacity="0.7" />
    <line x1="110" y1="40" x2="174" y2="40" className="stroke-blue-400" strokeWidth="3" strokeDasharray="1 7" strokeLinecap="round" opacity="0.7" />
    {[46, 110, 174].map((cx) => (
      <g key={cx} transform={`translate(${cx - 15},46)`}>
        <rect x="0" y="10" width="30" height="42" rx="5" className="fill-blue-600 dark:fill-blue-500" />
        <rect x="6" y="17" width="18" height="12" rx="2.5" className="fill-white" opacity="0.9" />
        <rect x="9" y="33" width="12" height="4" rx="2" className="fill-white" opacity="0.55" />
        <rect x="9" y="40" width="12" height="4" rx="2" className="fill-white" opacity="0.55" />
        <path d="M30 22h6a4 4 0 0 1 4 4v14" className="stroke-slate-500 dark:stroke-slate-300" strokeWidth="3.2" fill="none" strokeLinecap="round" />
        <circle cx="15" cy="4" r="5" className="fill-slate-500 dark:fill-slate-300" />
      </g>
    ))}
    <rect x="30" y="104" width="160" height="7" rx="3.5" className="fill-slate-400 dark:fill-slate-600" opacity="0.5" />
  </svg>
)

/** Projeção: linha real subindo + cauda tracejada até a bandeira (alvo). */
export const IlProjecao = ({ className }: Props) => (
  <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
    <line x1="28" y1="18" x2="28" y2="112" className="stroke-slate-400 dark:stroke-slate-600" strokeWidth="2.5" opacity="0.6" strokeLinecap="round" />
    <line x1="28" y1="112" x2="196" y2="112" className="stroke-slate-400 dark:stroke-slate-600" strokeWidth="2.5" opacity="0.6" strokeLinecap="round" />
    <path d="M28 96 C60 92 66 74 92 70 S128 58 150 44" className="stroke-blue-600 dark:stroke-blue-500" strokeWidth="4" fill="none" strokeLinecap="round" />
    <path d="M150 44 C164 38 172 32 184 22" className="stroke-blue-400" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="2 9" />
    <circle cx="150" cy="44" r="5.5" className="fill-blue-600 stroke-white dark:fill-blue-500" strokeWidth="2.5" />
    <g transform="translate(178,10)">
      <line x1="6" y1="0" x2="6" y2="20" className="stroke-slate-500 dark:stroke-slate-300" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M6 1h15l-4 5 4 5H6z" className="fill-slate-500 dark:fill-slate-300" />
    </g>
  </svg>
)

/** Confiança: medidor (gauge) com ponteiro + selo com check. */
export const IlConfianca = ({ className }: Props) => (
  <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
    <path d="M40 104 A62 62 0 0 1 164 104" className="stroke-slate-300 dark:stroke-slate-700" strokeWidth="10" fill="none" strokeLinecap="round" />
    <path d="M40 104 A62 62 0 0 1 132 51" className="stroke-blue-600 dark:stroke-blue-500" strokeWidth="10" fill="none" strokeLinecap="round" />
    <circle cx="102" cy="104" r="8" className="fill-slate-500 dark:fill-slate-300" />
    <line x1="102" y1="104" x2="140" y2="66" className="stroke-slate-500 dark:stroke-slate-300" strokeWidth="5" strokeLinecap="round" />
    <g transform="translate(150,74)">
      <path d="M18 0 3 6v10c0 9 7 14 15 18 8-4 15-9 15-18V6z" className="fill-blue-600 dark:fill-blue-500" />
      <path d="M11 16l5 5 9-10" className="stroke-white" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </svg>
)

/** Base fiscal: documento com linhas + selo tracejado (âmbar) com check. */
export const IlFiscal = ({ className }: Props) => (
  <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
    <rect x="58" y="20" width="86" height="104" rx="8" className="fill-blue-600" opacity="0.12" />
    <rect x="58" y="20" width="86" height="104" rx="8" className="stroke-blue-600 dark:stroke-blue-500" strokeWidth="3" />
    {[38, 52, 66, 80].map((y, i) => (
      <rect key={y} x="72" y={y} width={i === 3 ? 40 : 58} height="5" rx="2.5" className="fill-slate-500 dark:fill-slate-300" opacity="0.5" />
    ))}
    <g transform="translate(120,80)">
      <circle cx="20" cy="20" r="22" className="fill-amber-500" opacity="0.16" />
      <circle cx="20" cy="20" r="22" className="stroke-amber-500" strokeWidth="3" strokeDasharray="3 4" />
      <path d="M12 20l6 6 11-12" className="stroke-amber-500" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </svg>
)
