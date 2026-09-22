/**
 * Letreiro (marquee) de logos que rola sem parar na landing. É a MECÂNICA — os
 * logos entram como arquivos em public/landing/parceiros/ (ou texto por enquanto).
 *
 * ⚠️ Honestidade: só liste marcas como "parceiro" se houver parceria real. Para
 * bandeiras/sistemas que o Visor360 apenas ATENDE, use um título neutro como
 * "Atende postos de todas as bandeiras" — nunca sugira parceria que não existe.
 * Logos de terceiros exigem o arquivo (não dá pra recriar marca registrada).
 */

interface Parceiro {
  nome: string
  /** Caminho do logo (ex.: '/landing/parceiros/petrobras.svg'). Sem isso, mostra o nome como texto. */
  img?: string
}

// PLACEHOLDER — troque os nomes pelos {nome, img} reais quando tiver os arquivos.
const PARCEIROS: Parceiro[] = [
  { nome: 'Petrobras' },
  { nome: 'Ipiranga' },
  { nome: 'Shell' },
  { nome: 'Ale' },
  { nome: 'WebPosto' },
  { nome: 'Linx AutoSystem' },
]

const CSS = `
.v360-mq{position:relative;overflow:hidden;
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);
          mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
.v360-mq-track{display:flex;width:max-content;gap:64px;align-items:center;animation:v360-mq-scroll 34s linear infinite}
.v360-mq:hover .v360-mq-track{animation-play-state:paused}
@keyframes v360-mq-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@media(prefers-reduced-motion:reduce){.v360-mq-track{animation:none;flex-wrap:wrap;justify-content:center;width:auto}}
`

const Logo = ({ p }: { p: Parceiro }) =>
  p.img ? (
    <img src={p.img} alt={p.nome} style={{ height: 30, width: 'auto', objectFit: 'contain', opacity: 0.85 }} />
  ) : (
    <span style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 20, color: 'var(--v-muted2)', whiteSpace: 'nowrap', letterSpacing: '-.01em' }}>{p.nome}</span>
  )

const PartnerMarquee = () => {
  // Duplica a lista pra o loop ficar contínuo (translateX -50%).
  const loop = [...PARCEIROS, ...PARCEIROS]
  return (
    <div className="v360-wrap" style={{ maxWidth: 1200, margin: '64px auto 0', padding: '0 40px' }}>
      <style>{CSS}</style>
      <p style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--v-faint)', marginBottom: 24 }}>
        Atende postos de todas as bandeiras
      </p>
      <div className="v360-mq">
        <div className="v360-mq-track">
          {loop.map((p, i) => <Logo key={`${p.nome}-${i}`} p={p} />)}
        </div>
      </div>
    </div>
  )
}

export default PartnerMarquee
