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

/** Impacto no caixa: pilha de moedas com uma seta subindo (ganho). */
export const IlDinheiro = ({ className }: Props) => (
  <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
    {[98, 86, 74].map((cy) => (
      <g key={cy}>
        <path d={`M56 ${cy}v12a26 8 0 0 0 52 0v-12z`} className="fill-slate-500 dark:fill-slate-300" />
        <ellipse cx="82" cy={cy} rx="26" ry="8" className="fill-blue-600 dark:fill-blue-500" />
      </g>
    ))}
    <ellipse cx="82" cy="74" rx="15" ry="4.5" className="stroke-white" strokeWidth="2" fill="none" opacity="0.6" />
    <rect x="145" y="52" width="11" height="52" rx="5" className="fill-blue-600 dark:fill-blue-500" />
    <path d="M150.5 34 133 58h35z" className="fill-blue-600 dark:fill-blue-500" />
  </svg>
)

/** Ação / o que fazer: prancheta com checklist (dois itens marcados). */
export const IlLista = ({ className }: Props) => (
  <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
    <rect x="64" y="22" width="92" height="104" rx="10" className="fill-blue-600" opacity="0.1" />
    <rect x="64" y="22" width="92" height="104" rx="10" className="stroke-blue-600 dark:stroke-blue-500" strokeWidth="3" />
    <rect x="96" y="14" width="28" height="14" rx="4" className="fill-slate-500 dark:fill-slate-300" />
    {[42, 70].map((y) => (
      <g key={y}>
        <rect x="76" y={y} width="18" height="18" rx="4" className="fill-blue-600 dark:fill-blue-500" />
        <path d={`M80 ${y + 9}l4 4 7-8`} className="stroke-white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="102" y={y + 5} width="42" height="6" rx="3" className="fill-slate-500 dark:fill-slate-300" opacity="0.5" />
      </g>
    ))}
    <rect x="76" y="98" width="18" height="18" rx="4" className="stroke-slate-400 dark:stroke-slate-600" strokeWidth="3" fill="none" />
    <rect x="102" y="103" width="34" height="6" rx="3" className="fill-slate-500 dark:fill-slate-300" opacity="0.35" />
  </svg>
)

/** Ranking: pódio 1º/2º/3º com uma estrela no topo do vencedor. */
export const IlRanking = ({ className }: Props) => (
  <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
    <rect x="50" y="78" width="38" height="44" rx="4" className="fill-slate-500 dark:fill-slate-300" />
    <rect x="92" y="56" width="38" height="66" rx="4" className="fill-blue-600 dark:fill-blue-500" />
    <rect x="134" y="94" width="38" height="28" rx="4" className="fill-slate-400 dark:fill-slate-600" />
    <path d="M111 17 115 28.5 127.2 28.8 117.5 36.1 121 47.8 111 40.8 101 47.8 104.5 36.1 94.8 28.8 107 28.5Z" className="fill-blue-600 dark:fill-blue-500" />
    <rect x="40" y="122" width="140" height="6" rx="3" className="fill-slate-400 dark:fill-slate-600" opacity="0.5" />
  </svg>
)

/** Agenda / vencimento: folha de calendário com um dia destacado. */
export const IlCalendario = ({ className }: Props) => (
  <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
    <rect x="52" y="32" width="116" height="92" rx="10" className="fill-blue-600" opacity="0.1" />
    <path d="M62 32h96a10 10 0 0 1 10 10v12H52V42a10 10 0 0 1 10-10z" className="fill-blue-600 dark:fill-blue-500" />
    <rect x="52" y="32" width="116" height="92" rx="10" className="stroke-blue-600 dark:stroke-blue-500" strokeWidth="3" />
    <rect x="74" y="22" width="9" height="20" rx="4" className="fill-slate-500 dark:fill-slate-300" />
    <rect x="137" y="22" width="9" height="20" rx="4" className="fill-slate-500 dark:fill-slate-300" />
    {[72, 98].map((y) => [72, 98, 124, 150].map((x) => (
      <circle key={`${x}-${y}`} cx={x} cy={y} r="6" className="fill-slate-500 dark:fill-slate-300" opacity="0.35" />
    )))}
    <circle cx="124" cy="72" r="13" className="stroke-blue-600 dark:stroke-blue-500" strokeWidth="3" fill="none" />
    <circle cx="124" cy="72" r="6" className="fill-blue-600 dark:fill-blue-500" />
  </svg>
)

/** Combustível: bomba com bico e uma gota caindo. */
export const IlCombustivel = ({ className }: Props) => (
  <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
    <rect x="52" y="118" width="78" height="8" rx="4" className="fill-slate-400 dark:fill-slate-600" opacity="0.5" />
    <rect x="58" y="36" width="54" height="84" rx="9" className="fill-blue-600 dark:fill-blue-500" />
    <rect x="62" y="28" width="46" height="12" rx="5" className="fill-slate-500 dark:fill-slate-300" />
    <rect x="68" y="48" width="34" height="24" rx="4" className="fill-white" opacity="0.92" />
    <rect x="70" y="82" width="30" height="5" rx="2.5" className="fill-white" opacity="0.5" />
    <rect x="70" y="92" width="18" height="5" rx="2.5" className="fill-white" opacity="0.5" />
    <path d="M112 60h10a8 8 0 0 1 8 8v10" className="stroke-slate-500 dark:stroke-slate-300" strokeWidth="4" fill="none" strokeLinecap="round" />
    <rect x="130" y="76" width="16" height="13" rx="4" className="fill-slate-500 dark:fill-slate-300" />
    <rect x="137" y="88" width="6" height="8" rx="2" className="fill-slate-500 dark:fill-slate-300" />
    <path d="M140 98c4.8 5.4 6 8.4 6 11.4a6 6 0 1 1-12 0c0-3 1.2-6 6-11.4z" className="fill-blue-600 dark:fill-blue-500" />
  </svg>
)

/** Automotivos: uma chave de boca com uma gota de óleo. */
export const IlAutomotivo = ({ className }: Props) => (
  <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
    <line x1="72" y1="102" x2="128" y2="54" className="stroke-blue-600 dark:stroke-blue-500" strokeWidth="15" strokeLinecap="round" />
    <path d="M140.5 61.3A13 13 0 1 0 145.3 43.5" className="stroke-blue-600 dark:stroke-blue-500" strokeWidth="9" fill="none" strokeLinecap="round" />
    <path d="M66.5 92.5A11 11 0 1 0 62.5 107.5" className="stroke-blue-600 dark:stroke-blue-500" strokeWidth="8" fill="none" strokeLinecap="round" />
    <path d="M156 96c6.4 7.2 8 11.2 8 15.2a8 8 0 1 1-16 0c0-4 1.6-8 8-15.2z" className="fill-slate-500 dark:fill-slate-300" />
  </svg>
)

/** Conveniência: uma sacola de compras da loja. */
export const IlConveniencia = ({ className }: Props) => (
  <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
    <path d="M82 56v-5a12 12 0 0 1 24 0v5" className="stroke-slate-500 dark:stroke-slate-300" strokeWidth="4.5" fill="none" strokeLinecap="round" />
    <path d="M114 56v-5a12 12 0 0 1 24 0v5" className="stroke-slate-500 dark:stroke-slate-300" strokeWidth="4.5" fill="none" strokeLinecap="round" />
    <rect x="66" y="56" width="88" height="68" rx="10" className="fill-blue-600 dark:fill-blue-500" />
    <rect x="66" y="72" width="88" height="4" className="fill-white" opacity="0.25" />
    <rect x="98" y="88" width="24" height="22" rx="5" className="fill-white" opacity="0.85" />
  </svg>
)

/** Preço / margem cedida: etiqueta com uma seta de ajuste pra baixo. */
export const IlPreco = ({ className }: Props) => (
  <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
    <path d="M84 46H140a8 8 0 0 1 8 8V84a8 8 0 0 1-8 8H84L60 69Z" className="fill-blue-600 dark:fill-blue-500" />
    <circle cx="78" cy="69" r="6" className="fill-white" opacity="0.9" />
    <rect x="94" y="60" width="34" height="7" rx="3" className="fill-white" opacity="0.85" />
    <rect x="94" y="74" width="22" height="6" rx="3" className="fill-white" opacity="0.55" />
    <rect x="166" y="46" width="10" height="34" rx="5" className="fill-slate-500 dark:fill-slate-300" />
    <path d="M171 96 157 78h28z" className="fill-slate-500 dark:fill-slate-300" />
  </svg>
)

/** Conciliação de cartão: cartão com um selo de check. */
export const IlCartao = ({ className }: Props) => (
  <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
    <rect x="44" y="42" width="126" height="78" rx="11" className="fill-blue-600 dark:fill-blue-500" />
    <rect x="62" y="60" width="24" height="18" rx="4" className="fill-white" opacity="0.9" />
    <rect x="62" y="90" width="44" height="6" rx="3" className="fill-white" opacity="0.5" />
    <rect x="114" y="90" width="24" height="6" rx="3" className="fill-white" opacity="0.5" />
    <rect x="62" y="102" width="30" height="6" rx="3" className="fill-white" opacity="0.35" />
    <circle cx="146" cy="100" r="18" className="fill-white" />
    <circle cx="146" cy="100" r="18" className="stroke-blue-600 dark:stroke-blue-500" strokeWidth="3" fill="none" />
    <path d="M138 100l6 6 11-13" className="stroke-blue-600 dark:stroke-blue-500" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** Títulos a receber/pagar: um boleto com uma seta que entra e outra que sai. */
export const IlTitulos = ({ className }: Props) => (
  <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
    <rect x="80" y="28" width="60" height="90" rx="8" className="fill-blue-600" opacity="0.1" />
    <rect x="80" y="28" width="60" height="90" rx="8" className="stroke-blue-600 dark:stroke-blue-500" strokeWidth="3" />
    <rect x="90" y="40" width="40" height="5" rx="2.5" className="fill-slate-500 dark:fill-slate-300" opacity="0.5" />
    <rect x="90" y="50" width="30" height="5" rx="2.5" className="fill-slate-500 dark:fill-slate-300" opacity="0.5" />
    <rect x="90" y="64" width="24" height="8" rx="3" className="fill-slate-500 dark:fill-slate-300" opacity="0.4" />
    {[90, 96, 101, 108, 114, 120, 125].map((x, i) => (
      <rect key={x} x={x} y="98" width={i % 3 === 2 ? 4 : 2} height="14" className="fill-slate-500 dark:fill-slate-300" opacity="0.6" />
    ))}
    <path d="M40 56H72" className="stroke-blue-600 dark:stroke-blue-500" strokeWidth="4" strokeLinecap="round" />
    <path d="M80 56 68 50v12z" className="fill-blue-600 dark:fill-blue-500" />
    <path d="M144 92H176" className="stroke-slate-500 dark:stroke-slate-300" strokeWidth="4" strokeLinecap="round" />
    <path d="M186 92 174 86v12z" className="fill-slate-500 dark:fill-slate-300" />
  </svg>
)

/** Estoque / capital parado: três caixas empilhadas. */
export const IlEstoque = ({ className }: Props) => (
  <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
    <rect x="42" y="122" width="136" height="6" rx="3" className="fill-slate-400 dark:fill-slate-600" opacity="0.5" />
    <rect x="50" y="78" width="52" height="44" rx="6" className="fill-slate-500 dark:fill-slate-300" />
    <rect x="50" y="90" width="52" height="4" className="fill-white" opacity="0.26" />
    <rect x="71" y="78" width="10" height="44" className="fill-white" opacity="0.26" />
    <rect x="118" y="78" width="52" height="44" rx="6" className="fill-blue-600 dark:fill-blue-500" />
    <rect x="118" y="90" width="52" height="4" className="fill-white" opacity="0.3" />
    <rect x="139" y="78" width="10" height="44" className="fill-white" opacity="0.3" />
    <rect x="84" y="32" width="52" height="44" rx="6" className="fill-blue-600 dark:fill-blue-500" />
    <rect x="84" y="44" width="52" height="4" className="fill-white" opacity="0.3" />
    <rect x="105" y="32" width="10" height="44" className="fill-white" opacity="0.3" />
  </svg>
)

/** Giro de estoque: duas setas em ciclo com uma caixa no centro. */
export const IlGiro = ({ className }: Props) => (
  <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
    <path d="M72 54A40 40 0 0 1 148 54" className="stroke-blue-600 dark:stroke-blue-500" strokeWidth="5" fill="none" strokeLinecap="round" />
    <path d="M140 52h16l-8 14z" className="fill-blue-600 dark:fill-blue-500" />
    <path d="M148 86A40 40 0 0 1 72 86" className="stroke-blue-600 dark:stroke-blue-500" strokeWidth="5" fill="none" strokeLinecap="round" />
    <path d="M80 88H64l8-14z" className="fill-blue-600 dark:fill-blue-500" />
    <rect x="98" y="58" width="24" height="24" rx="5" className="fill-slate-500 dark:fill-slate-300" />
    <rect x="98" y="67" width="24" height="4" className="fill-white" opacity="0.3" />
    <rect x="107" y="58" width="6" height="24" className="fill-white" opacity="0.3" />
  </svg>
)

/** Média histórica de vendas: gráfico de barras crescente. */
export const IlBarras = ({ className }: Props) => (
  <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
    <line x1="34" y1="20" x2="34" y2="114" className="stroke-slate-400 dark:stroke-slate-600" strokeWidth="2.5" opacity="0.6" strokeLinecap="round" />
    <line x1="34" y1="114" x2="192" y2="114" className="stroke-slate-400 dark:stroke-slate-600" strokeWidth="2.5" opacity="0.6" strokeLinecap="round" />
    {[
      { x: 48, y: 84, o: 0.45 },
      { x: 84, y: 66, o: 0.62 },
      { x: 120, y: 48, o: 0.8 },
      { x: 156, y: 30, o: 1 },
    ].map((b) => (
      <rect key={b.x} x={b.x} y={b.y} width="28" height={114 - b.y} rx="4" className="fill-blue-600 dark:fill-blue-500" opacity={b.o} />
    ))}
  </svg>
)

/** Equipe / quadro: três figuras de pessoas lado a lado. */
export const IlPessoas = ({ className }: Props) => (
  <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
    <circle cx="64" cy="74" r="13" className="fill-slate-500 dark:fill-slate-300" />
    <path d="M44 120v-8a20 20 0 0 1 40 0v8z" className="fill-slate-500 dark:fill-slate-300" />
    <circle cx="156" cy="74" r="13" className="fill-slate-500 dark:fill-slate-300" />
    <path d="M136 120v-8a20 20 0 0 1 40 0v8z" className="fill-slate-500 dark:fill-slate-300" />
    <circle cx="110" cy="66" r="16" className="fill-blue-600 dark:fill-blue-500" />
    <path d="M84 122v-8a26 26 0 0 1 52 0v8z" className="fill-blue-600 dark:fill-blue-500" />
  </svg>
)

/** Analista de IA: uma faísca com brilhos ao redor. */
export const IlIA = ({ className }: Props) => (
  <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
    <path d="M98 28Q105 61 138 68Q105 75 98 108Q91 75 58 68Q91 61 98 28Z" className="fill-blue-600 dark:fill-blue-500" />
    <path d="M156 21Q159 33 171 36Q159 39 156 51Q153 39 141 36Q153 33 156 21Z" className="fill-blue-400" />
    <path d="M158 88Q160 96 168 98Q160 100 158 108Q156 100 148 98Q156 96 158 88Z" className="fill-slate-500 dark:fill-slate-300" />
    <circle cx="84" cy="52" r="2.5" className="fill-white" opacity="0.6" />
  </svg>
)

/** Compliance ANP: um escudo com uma balança dentro. */
export const IlCompliance = ({ className }: Props) => (
  <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
    <path d="M110 22 154 38V72C154 98 134 114 110 122 86 114 66 98 66 72V38Z" className="fill-blue-600" opacity="0.12" />
    <path d="M110 22 154 38V72C154 98 134 114 110 122 86 114 66 98 66 72V38Z" className="stroke-blue-600 dark:stroke-blue-500" strokeWidth="3" fill="none" strokeLinejoin="round" />
    <circle cx="110" cy="46" r="3.5" className="fill-slate-500 dark:fill-slate-300" />
    <line x1="110" y1="49" x2="110" y2="90" className="stroke-slate-500 dark:stroke-slate-300" strokeWidth="3.5" strokeLinecap="round" />
    <line x1="85" y1="57" x2="135" y2="57" className="stroke-slate-500 dark:stroke-slate-300" strokeWidth="3.5" strokeLinecap="round" />
    <line x1="85" y1="57" x2="85" y2="64" className="stroke-slate-500 dark:stroke-slate-300" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="135" y1="57" x2="135" y2="64" className="stroke-slate-500 dark:stroke-slate-300" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M75 64a10 5 0 0 0 20 0" className="stroke-slate-500 dark:stroke-slate-300" strokeWidth="3" fill="none" strokeLinecap="round" />
    <path d="M125 64a10 5 0 0 0 20 0" className="stroke-slate-500 dark:stroke-slate-300" strokeWidth="3" fill="none" strokeLinecap="round" />
    <path d="M99 98h22l-6-8h-10z" className="fill-slate-500 dark:fill-slate-300" />
    <line x1="92" y1="100" x2="128" y2="100" className="stroke-slate-500 dark:stroke-slate-300" strokeWidth="3" strokeLinecap="round" />
  </svg>
)

/** Radar de preços: círculos concêntricos com varredura e um ponto. */
export const IlRadar = ({ className }: Props) => (
  <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
    <line x1="52" y1="74" x2="148" y2="74" className="stroke-slate-400 dark:stroke-slate-600" strokeWidth="2" opacity="0.35" strokeLinecap="round" />
    <line x1="100" y1="26" x2="100" y2="122" className="stroke-slate-400 dark:stroke-slate-600" strokeWidth="2" opacity="0.35" strokeLinecap="round" />
    <circle cx="100" cy="74" r="16" className="stroke-slate-400 dark:stroke-slate-600" strokeWidth="2.5" fill="none" opacity="0.7" />
    <circle cx="100" cy="74" r="32" className="stroke-slate-400 dark:stroke-slate-600" strokeWidth="2.5" fill="none" opacity="0.7" />
    <circle cx="100" cy="74" r="48" className="stroke-blue-600 dark:stroke-blue-500" strokeWidth="3" fill="none" />
    <path d="M100 74 116.4 28.9A48 48 0 0 1 143.5 53.7Z" className="fill-blue-600" opacity="0.16" />
    <line x1="100" y1="74" x2="143.5" y2="53.7" className="stroke-blue-600 dark:stroke-blue-500" strokeWidth="3.5" strokeLinecap="round" />
    <circle cx="100" cy="74" r="4" className="fill-blue-600 dark:fill-blue-500" />
    <circle cx="122.6" cy="51.4" r="6" className="fill-blue-600 dark:fill-blue-500" />
    <circle cx="122.6" cy="51.4" r="2.5" className="fill-white" />
  </svg>
)

/** Você × praça: duas etiquetas de preço comparadas lado a lado. */
export const IlConcorrencia = ({ className }: Props) => (
  <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
    <path d="M70 40 94 60V96a6 6 0 0 1-6 6L52 102a6 6 0 0 1-6-6L46 60Z" className="fill-blue-600 dark:fill-blue-500" />
    <circle cx="70" cy="56" r="5" className="fill-white" opacity="0.9" />
    <rect x="54" y="72" width="32" height="6" rx="3" className="fill-white" opacity="0.85" />
    <rect x="54" y="84" width="22" height="5" rx="3" className="fill-white" opacity="0.55" />
    <path d="M150 40 174 60V96a6 6 0 0 1-6 6L132 102a6 6 0 0 1-6-6L126 60Z" className="fill-slate-500 dark:fill-slate-300" />
    <circle cx="150" cy="56" r="5" className="fill-white" opacity="0.7" />
    <rect x="134" y="72" width="32" height="6" rx="3" className="fill-white" opacity="0.6" />
    <rect x="134" y="84" width="22" height="5" rx="3" className="fill-white" opacity="0.4" />
    <path d="M104 68 116 80M116 68 104 80" className="stroke-slate-500 dark:stroke-slate-300" strokeWidth="4" strokeLinecap="round" />
  </svg>
)

/** Desempenho de bomba: bico de abastecimento com uma barra de nível. */
export const IlBomba = ({ className }: Props) => (
  <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
    <rect x="60" y="38" width="52" height="14" rx="7" className="fill-blue-600 dark:fill-blue-500" />
    <rect x="98" y="30" width="24" height="32" rx="8" className="fill-blue-600 dark:fill-blue-500" />
    <rect x="102" y="54" width="18" height="36" rx="9" className="fill-blue-600 dark:fill-blue-500" />
    <path d="M102 66c-11 1-12 13-3 19" className="stroke-blue-600 dark:stroke-blue-500" strokeWidth="5" fill="none" strokeLinecap="round" />
    <rect x="104" y="36" width="12" height="4" rx="2" className="fill-white" opacity="0.4" />
    <path d="M111 90c0 7-7 9-13 12" className="stroke-slate-500 dark:stroke-slate-300" strokeWidth="4" fill="none" strokeLinecap="round" />
    <rect x="48" y="104" width="124" height="13" rx="6.5" className="fill-slate-300 dark:fill-slate-700" />
    <rect x="48" y="104" width="80" height="13" rx="6.5" className="fill-blue-600 dark:fill-blue-500" />
  </svg>
)

/** Reabastecimento: um caminhão-tanque de lado. */
export const IlCaminhao = ({ className }: Props) => (
  <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
    <rect x="38" y="48" width="100" height="42" rx="21" className="fill-blue-600 dark:fill-blue-500" />
    <line x1="72" y1="48" x2="72" y2="90" className="stroke-white" strokeWidth="3" opacity="0.22" />
    <line x1="104" y1="48" x2="104" y2="90" className="stroke-white" strokeWidth="3" opacity="0.22" />
    <rect x="58" y="40" width="16" height="9" rx="3" className="fill-slate-500 dark:fill-slate-300" />
    <rect x="40" y="90" width="140" height="9" rx="3" className="fill-slate-500 dark:fill-slate-300" />
    <path d="M138 60H160L178 84V90H138Z" className="fill-slate-500 dark:fill-slate-300" />
    <path d="M152 66H160L170 82H152Z" className="fill-white" opacity="0.85" />
    <circle cx="72" cy="102" r="12" className="fill-slate-500 dark:fill-slate-300" />
    <circle cx="72" cy="102" r="4.5" className="fill-white" />
    <circle cx="104" cy="102" r="12" className="fill-slate-500 dark:fill-slate-300" />
    <circle cx="104" cy="102" r="4.5" className="fill-white" />
    <circle cx="152" cy="102" r="12" className="fill-slate-500 dark:fill-slate-300" />
    <circle cx="152" cy="102" r="4.5" className="fill-white" />
  </svg>
)

/** Ao vivo: um ponto com ondas concêntricas e um selo LIVE. */
export const IlAoVivo = ({ className }: Props) => (
  <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
    <circle cx="92" cy="76" r="44" className="stroke-blue-600 dark:stroke-blue-500" strokeWidth="3" fill="none" opacity="0.16" />
    <circle cx="92" cy="76" r="30" className="stroke-blue-600 dark:stroke-blue-500" strokeWidth="3.5" fill="none" opacity="0.34" />
    <circle cx="92" cy="76" r="16" className="stroke-blue-600 dark:stroke-blue-500" strokeWidth="4" fill="none" opacity="0.6" />
    <circle cx="92" cy="76" r="8" className="fill-blue-600 dark:fill-blue-500" />
    <rect x="138" y="22" width="56" height="24" rx="12" className="fill-blue-600 dark:fill-blue-500" />
    <circle cx="152" cy="34" r="4.5" className="fill-white" />
    <rect x="162" y="29" width="26" height="9" rx="4.5" className="fill-white" opacity="0.9" />
  </svg>
)

/** Qualidade de dados: uma lupa sobre um documento com um alerta. */
export const IlDetetive = ({ className }: Props) => (
  <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
    <rect x="52" y="26" width="76" height="98" rx="8" className="fill-blue-600" opacity="0.1" />
    <rect x="52" y="26" width="76" height="98" rx="8" className="stroke-blue-600 dark:stroke-blue-500" strokeWidth="3" />
    {[44, 56, 68].map((y, i) => (
      <rect key={y} x="64" y={y} width={i === 2 ? 30 : 48} height="5" rx="2.5" className="fill-slate-500 dark:fill-slate-300" opacity="0.5" />
    ))}
    <circle cx="120" cy="88" r="26" className="fill-blue-600" opacity="0.08" />
    <circle cx="120" cy="88" r="26" className="stroke-blue-600 dark:stroke-blue-500" strokeWidth="5" fill="none" />
    <path d="M104 76a12 12 0 0 1 8-8" className="stroke-white" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
    <line x1="139" y1="107" x2="160" y2="128" className="stroke-blue-600 dark:stroke-blue-500" strokeWidth="7" strokeLinecap="round" />
    <path d="M154 30 168 54h-28z" className="fill-amber-500" opacity="0.18" />
    <path d="M154 30 168 54h-28z" className="stroke-amber-500" strokeWidth="2.6" fill="none" strokeLinejoin="round" />
    <line x1="154" y1="39" x2="154" y2="46" className="stroke-amber-500" strokeWidth="2.6" strokeLinecap="round" />
    <circle cx="154" cy="50" r="1.7" className="fill-amber-500" />
  </svg>
)
