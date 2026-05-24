/**
 * Caricatura animada de um frentista abastecendo um carro — peça decorativa
 * do painel esquerdo do Login. Usa SVG inline com animações via CSS
 * (keyframes definidos em src/index.css: login-bob, login-car-bounce,
 * login-fuel-drop, login-coin-pop).
 *
 * Cores combinam com a paleta do Login: navy (#1e3a5f) pro uniforme,
 * âmbar (#f5c518) pra bomba e moedas (combina com a tagline), vermelho
 * pop pro carro, peach pra pele.
 */
const FrentistaCarScene = () => (
  <svg
    viewBox="0 0 280 160"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full max-w-[280px]"
    aria-hidden="true"
  >
    {/* Linha do chão */}
    <line x1="0" y1="142" x2="280" y2="142" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

    {/* Bomba de combustível (lado esquerdo) */}
    <g>
      <rect x="22" y="55" width="34" height="70" rx="3" fill="#f5c518" />
      <rect x="28" y="62" width="22" height="14" rx="1" fill="#1e3a5f" />
      <rect x="30" y="65" width="18" height="3" fill="#f5c518" opacity="0.9" />
      <rect x="30" y="70" width="14" height="2" fill="#f5c518" opacity="0.7" />
      {/* Topo da bomba */}
      <rect x="28" y="50" width="22" height="6" rx="2" fill="#d4a017" />
      {/* Suporte do gatilho na lateral */}
      <rect x="56" y="78" width="4" height="10" fill="#1e3a5f" />
    </g>

    {/* Mangueira da bomba até o carro — curva suave */}
    <path
      id="hose-path"
      d="M 60 88 Q 100 110, 145 105"
      stroke="#1f2937"
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
    />

    {/* Gota de combustível animada percorrendo a mangueira */}
    <circle
      r="2.5"
      fill="#f5c518"
      style={{
        offsetPath: 'path("M 60 88 Q 100 110, 145 105")',
        animation: 'login-fuel-drop 2.2s linear infinite',
      }}
    />
    <circle
      r="2"
      fill="#f5c518"
      style={{
        offsetPath: 'path("M 60 88 Q 100 110, 145 105")',
        animation: 'login-fuel-drop 2.2s linear 0.8s infinite',
      }}
    />

    {/* Bico no tanque do carro */}
    <rect x="142" y="100" width="10" height="6" rx="1" fill="#1f2937" />
    <rect x="148" y="102" width="6" height="2" fill="#374151" />

    {/* Frentista — agrupado pra animação de bob */}
    <g style={{ animation: 'login-bob 2.4s ease-in-out infinite', transformOrigin: 'center' }}>
      {/* Pernas */}
      <rect x="76" y="105" width="5" height="22" fill="#475569" rx="1" />
      <rect x="84" y="105" width="5" height="22" fill="#475569" rx="1" />
      {/* Sapatos */}
      <ellipse cx="78" cy="129" rx="4" ry="2" fill="#1f2937" />
      <ellipse cx="86" cy="129" rx="4" ry="2" fill="#1f2937" />
      {/* Corpo (uniforme navy) */}
      <rect x="73" y="78" width="20" height="30" rx="4" fill="#1e3a5f" />
      {/* Detalhe do uniforme — listra amarela */}
      <rect x="73" y="92" width="20" height="2" fill="#f5c518" opacity="0.8" />
      {/* Braço esquerdo */}
      <rect x="67" y="80" width="6" height="20" fill="#1e3a5f" rx="2" />
      {/* Mão esquerda */}
      <circle cx="70" cy="100" r="3" fill="#fdba74" />
      {/* Braço direito segurando a mangueira/bico */}
      <rect x="93" y="82" width="6" height="14" fill="#1e3a5f" rx="2" />
      <rect x="97" y="92" width="4" height="14" fill="#1e3a5f" rx="2" transform="rotate(40 99 99)" />
      <circle cx="106" cy="100" r="3" fill="#fdba74" />
      {/* Cabeça */}
      <circle cx="83" cy="68" r="9" fill="#fdba74" />
      {/* Olhos */}
      <circle cx="80" cy="67" r="1.2" fill="#1f2937" />
      <circle cx="86" cy="67" r="1.2" fill="#1f2937" />
      {/* Sorriso */}
      <path d="M 80 71 Q 83 73, 86 71" stroke="#1f2937" strokeWidth="1" fill="none" strokeLinecap="round" />
      {/* Boné (uniforme) */}
      <path d="M 74 62 Q 83 54, 92 62 L 92 64 L 74 64 Z" fill="#1e3a5f" />
      <rect x="71" y="63" width="18" height="2" rx="1" fill="#1e3a5f" />
    </g>

    {/* Carro — sedan estilizado, com bounce sutil de suspensão */}
    <g style={{ animation: 'login-car-bounce 1.6s ease-in-out infinite' }}>
      {/* Corpo principal */}
      <rect x="155" y="100" width="105" height="22" rx="5" fill="#ef4444" />
      {/* Teto */}
      <path d="M 168 100 L 178 82 L 230 82 L 244 100 Z" fill="#ef4444" />
      {/* Janelas */}
      <path d="M 175 99 L 183 86 L 205 86 L 205 99 Z" fill="#bae6fd" opacity="0.75" />
      <path d="M 209 99 L 209 86 L 226 86 L 237 99 Z" fill="#bae6fd" opacity="0.75" />
      {/* Coluna entre janelas */}
      <rect x="205" y="86" width="3" height="13" fill="#ef4444" />
      {/* Faróis */}
      <circle cx="256" cy="108" r="2" fill="#fef3c7" />
      <circle cx="158" cy="108" r="2" fill="#fef08a" opacity="0.7" />
      {/* Maçaneta */}
      <rect x="190" y="110" width="6" height="1.5" rx="0.5" fill="#1f2937" opacity="0.5" />
      {/* Tampa do tanque (onde o bico encosta) */}
      <circle cx="156" cy="110" r="2.5" fill="#1f2937" opacity="0.6" />
      {/* Sombra leve abaixo do carro */}
      <ellipse cx="207" cy="140" rx="55" ry="2" fill="rgba(0,0,0,0.25)" />
      {/* Rodas */}
      <g>
        <circle cx="175" cy="128" r="9" fill="#1f2937" />
        <circle cx="175" cy="128" r="4" fill="#94a3b8" />
        <circle cx="175" cy="128" r="1.5" fill="#475569" />
      </g>
      <g>
        <circle cx="238" cy="128" r="9" fill="#1f2937" />
        <circle cx="238" cy="128" r="4" fill="#94a3b8" />
        <circle cx="238" cy="128" r="1.5" fill="#475569" />
      </g>
    </g>

    {/* Moedinhas $ subindo da bomba (efeito de "ganhando dinheiro") */}
    <text
      x="38"
      y="40"
      fontSize="10"
      fontWeight="bold"
      fill="#86efac"
      style={{ animation: 'login-coin-pop 3s ease-out infinite' }}
    >
      $
    </text>
    <text
      x="48"
      y="40"
      fontSize="9"
      fontWeight="bold"
      fill="#86efac"
      style={{ animation: 'login-coin-pop 3s ease-out 1.5s infinite' }}
    >
      $
    </text>
  </svg>
)

export default FrentistaCarScene
