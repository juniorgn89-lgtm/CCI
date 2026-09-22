import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowLeft, Phone, MessageCircle, Check } from 'lucide-react'
import { setUiScaleSuspended } from '@/lib/uiScale'
import {
  BRL,
  PRECO_BASE,
  PRECO_IA,
  stripeLinkFor,
  buildWhatsappLink,
  buildTelLink,
} from '@/pages/Landing/assinatura'
import { useAppConfig } from '@/hooks/useAppConfig'

/**
 * "Como começar no Visor360" — página pública (rota `/como-comecar`) com o passo
 * a passo figurado (ilustrado) da jornada: assinar → pedir a chave → informar a
 * chave → usar. Dark-first como a landing (força o tema escuro localmente, sem
 * persistir). Config (Stripe/WebPosto/preços) em src/pages/Landing/assinatura.ts.
 */

const CSS = `
.v360-comecar{
  --v-bg:#0b0e13; --v-ink:#f1f5f9; --v-muted:#b4c0d0; --v-muted2:#93a1b3;
  --v-faint:#6b7686; --v-card:#141821; --v-border:#262c36; --v-border2:#2a313c;
  --v-hair:#222831;
  font-family:'Instrument Sans',system-ui,sans-serif;color:var(--v-ink);background:var(--v-bg);min-height:100vh;-webkit-font-smoothing:antialiased
}
.v360-comecar h1,.v360-comecar h2,.v360-comecar h3{font-family:'Bricolage Grotesque','Instrument Sans',sans-serif;margin:0}
.v360-comecar a{text-decoration:none}
.v360-comecar .step{display:grid;grid-template-columns:1fr 1fr;gap:36px;align-items:center}
.v360-comecar .step.rev .fig{order:2}
@media(max-width:760px){
  .v360-comecar .step,.v360-comecar .step.rev{grid-template-columns:1fr;gap:20px}
  .v360-comecar .step.rev .fig{order:0}
  .v360-comecar .h1{font-size:34px!important}
}
`

/* ─── Ilustrações (SVG 2-tons da marca) ─── */
const TEAL = '#14b8a6'
const AMBER = '#FCB619'
const NAVY = '#22456b'

const FigPagar = () => (
  <svg viewBox="0 0 220 160" width="100%" style={{ maxWidth: 300 }} role="img" aria-label="Pagamento seguro">
    <rect x="24" y="34" width="172" height="104" rx="14" fill={NAVY} />
    <rect x="24" y="34" width="172" height="30" rx="14" fill="#16293f" />
    <rect x="40" y="86" width="140" height="12" rx="6" fill="rgba(255,255,255,.18)" />
    <rect x="40" y="106" width="80" height="12" rx="6" fill="rgba(255,255,255,.12)" />
    <circle cx="168" cy="112" r="18" fill={AMBER} />
    <path d="M161 112l5 5 10-11" fill="none" stroke="#16293f" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="52" cy="49" r="6" fill={TEAL} />
  </svg>
)

const FigChave = () => (
  <svg viewBox="0 0 220 160" width="100%" style={{ maxWidth: 300 }} role="img" aria-label="Solicitar chave de API">
    <circle cx="78" cy="74" r="30" fill="none" stroke={AMBER} strokeWidth="10" />
    <rect x="100" y="69" width="86" height="10" rx="5" fill={AMBER} />
    <rect x="150" y="79" width="10" height="20" rx="5" fill={AMBER} />
    <rect x="176" y="79" width="10" height="26" rx="5" fill={AMBER} />
    <rect x="132" y="104" width="70" height="42" rx="10" fill={TEAL} />
    <path d="M132 146l14-12" stroke={TEAL} strokeWidth="0" />
    <circle cx="150" cy="125" r="3.5" fill="#0b2b28" />
    <circle cx="167" cy="125" r="3.5" fill="#0b2b28" />
    <circle cx="184" cy="125" r="3.5" fill="#0b2b28" />
  </svg>
)

const FigInformar = () => (
  <svg viewBox="0 0 220 160" width="100%" style={{ maxWidth: 300 }} role="img" aria-label="Informar a chave no app">
    <rect x="26" y="26" width="168" height="108" rx="12" fill={NAVY} />
    <rect x="26" y="26" width="168" height="22" rx="12" fill="#16293f" />
    <circle cx="40" cy="37" r="3.5" fill="#f87171" /><circle cx="52" cy="37" r="3.5" fill="#fbbf24" /><circle cx="64" cy="37" r="3.5" fill="#34d399" />
    <rect x="44" y="70" width="132" height="26" rx="7" fill="#0b0e13" stroke={TEAL} strokeWidth="2" />
    <rect x="54" y="80" width="70" height="6" rx="3" fill="rgba(255,255,255,.35)" />
    <rect x="128" y="108" width="48" height="16" rx="8" fill={AMBER} />
  </svg>
)

const FigPronto = () => (
  <svg viewBox="0 0 220 160" width="100%" style={{ maxWidth: 300 }} role="img" aria-label="Rede no painel">
    <rect x="24" y="26" width="172" height="108" rx="12" fill={NAVY} />
    <rect x="40" y="96" width="20" height="26" rx="3" fill={TEAL} />
    <rect x="70" y="80" width="20" height="42" rx="3" fill="#2563eb" />
    <rect x="100" y="66" width="20" height="56" rx="3" fill={TEAL} />
    <rect x="130" y="88" width="20" height="34" rx="3" fill={AMBER} />
    <path d="M40 60l30-10 30 6 30-16" fill="none" stroke={AMBER} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="160" cy="44" r="4" fill={AMBER} />
  </svg>
)

const ComoComecar = () => {
  const cfg = useAppConfig()
  const link = stripeLinkFor(cfg, false)
  const waLink = buildWhatsappLink(cfg.whatsapp, cfg.whatsappMsg)
  const telLink = buildTelLink(cfg.telefone)

  useEffect(() => {
    const prevTitle = document.title
    document.title = 'Como começar — Visor360'
    setUiScaleSuspended(true)
    // Dark-first: força o tema escuro nesta página (não persiste), restaura ao sair.
    const html = document.documentElement
    const original = html.classList.contains('dark')
    html.classList.add('dark')
    const links: HTMLLinkElement[] = []
    const add = (rel: string, href: string, cross?: boolean) => {
      const l = document.createElement('link')
      l.rel = rel; l.href = href; if (cross) l.crossOrigin = 'anonymous'
      document.head.appendChild(l); links.push(l)
    }
    add('preconnect', 'https://fonts.googleapis.com')
    add('preconnect', 'https://fonts.gstatic.com', true)
    add('stylesheet', 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600&display=swap')
    return () => {
      document.title = prevTitle
      setUiScaleSuspended(false)
      html.classList.toggle('dark', original)
      links.forEach((l) => l.remove())
    }
  }, [])

  const irPagar = () => {
    if (link) window.open(link, '_blank', 'noopener,noreferrer')
  }

  const STEPS = [
    {
      fig: <FigPagar />,
      titulo: 'Assine o Visor360',
      texto: `Escolha o plano completo por ${BRL(PRECO_BASE)}/mês. Quer o Analista de IA? Some +${BRL(PRECO_IA)}/mês. O pagamento é seguro, pelo Stripe — o cartão não passa pelo Visor360.`,
      acao: 'pagar' as const,
    },
    {
      fig: <FigChave />,
      titulo: 'Peça sua chave de API ao WebPosto',
      texto: 'Fale com o WebPosto (Quality) e peça a sua chave de integração (API) para conectar ao Visor360. Use os canais abaixo.',
      acao: 'contato' as const,
    },
    {
      fig: <FigInformar />,
      titulo: 'Informe a chave no Visor360',
      texto: 'No seu primeiro acesso, a tela pede a chave de API. Cole a chave e pronto — o app conecta na sua base na hora.',
      acao: 'nenhuma' as const,
    },
    {
      fig: <FigPronto />,
      titulo: 'Pronto: sua rede no painel',
      texto: 'Combustível, loja, operação e financeiro num só lugar, atualizados todo dia — com o Analista de IA apontando onde está a perda (se você adicionou o Plus).',
      acao: 'nenhuma' as const,
    },
  ]

  return (
    <div className="v360-comecar">
      <style>{CSS}</style>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '28px 24px 80px' }}>
        {/* Nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <img src="/landing/SIMBOLO.png" style={{ width: 30, height: 30, objectFit: 'contain' }} alt="" />
            <span style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 20, color: 'var(--v-ink)' }}>Visor<span style={{ color: '#0F766E' }}>360</span></span>
          </Link>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--v-muted)', fontSize: 14, fontWeight: 600 }}>
            <ArrowLeft size={15} /> Voltar
          </Link>
        </div>

        {/* Hero */}
        <div style={{ textAlign: 'center', maxWidth: 680, margin: '0 auto 8px' }}>
          <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: '#0F766E' }}>Passo a passo</div>
          <h1 className="h1" style={{ fontSize: 46, fontWeight: 800, lineHeight: 1.05, color: 'var(--v-ink)', letterSpacing: '-.025em', marginTop: 12 }}>Como começar no Visor360</h1>
          <p style={{ margin: '16px auto 0', fontSize: 17.5, lineHeight: 1.6, color: 'var(--v-muted)', maxWidth: 560 }}>
            Em 4 passos simples você conecta a sua rede e começa a acompanhar tudo num só lugar.
          </p>
        </div>

        {/* Passos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 56 }}>
          {STEPS.map((s, i) => (
            <div
              key={i}
              className={`step${i % 2 === 1 ? ' rev' : ''}`}
              style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)', borderRadius: 22, padding: 28, boxShadow: '0 30px 60px -44px rgba(0,0,0,.6)' }}
            >
              {/* Figura */}
              <div className="fig" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(420px 260px at 50% 30%,rgba(34,69,107,.35),transparent 70%)', borderRadius: 16, padding: 20, minHeight: 180 }}>
                {s.fig}
              </div>
              {/* Texto */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#0F766E,#14b8a6)', color: '#fff', fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 18 }}>{i + 1}</span>
                  <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--v-ink)', letterSpacing: '-.01em' }}>{s.titulo}</h2>
                </div>
                <p style={{ margin: '14px 0 0', fontSize: 15.5, lineHeight: 1.6, color: 'var(--v-muted)' }}>{s.texto}</p>

                {s.acao === 'pagar' && (
                  link ? (
                    <button onClick={irPagar} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 20, background: AMBER, color: '#16293f', fontWeight: 700, fontSize: 15, padding: '13px 22px', borderRadius: 12, border: 'none', cursor: 'pointer', boxShadow: '0 16px 34px -14px rgba(252,182,25,.7)' }}>
                      Pagar com o Stripe <ArrowRight size={16} />
                    </button>
                  ) : (
                    <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 20, background: AMBER, color: '#16293f', fontWeight: 700, fontSize: 15, padding: '13px 22px', borderRadius: 12 }}>
                      Ver planos <ArrowRight size={16} />
                    </Link>
                  )
                )}

                {s.acao === 'contato' && (
                  <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
                    <a href={telLink ?? undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderRadius: 11, border: '1px solid var(--v-border2)', color: telLink ? 'var(--v-ink)' : 'var(--v-faint)', fontSize: 13.5, fontWeight: 600, pointerEvents: telLink ? 'auto' : 'none' }}>
                      <Phone size={15} /> {cfg.telefone || 'Telefone a definir'}
                    </a>
                    <a href={waLink ?? undefined} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderRadius: 11, border: '1px solid rgba(37,211,102,.4)', background: waLink ? 'rgba(37,211,102,.12)' : 'transparent', color: waLink ? '#5eead4' : 'var(--v-faint)', fontSize: 13.5, fontWeight: 700, pointerEvents: waLink ? 'auto' : 'none' }}>
                      <MessageCircle size={15} /> {waLink ? 'WhatsApp' : 'WhatsApp a definir'}
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* CTA final */}
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 24, marginTop: 40, background: 'linear-gradient(135deg,#0b5c55 0%,#0F766E 55%,#12897f 100%)', padding: '48px 32px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: '-.02em' }}>Pronto pra começar?</h2>
          <p style={{ margin: '12px auto 0', fontSize: 16, lineHeight: 1.6, color: '#e3fbf6', maxWidth: 460 }}>
            Assine agora e conecte a sua rede em minutos.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
            {link ? (
              <button onClick={irPagar} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: AMBER, color: '#16293f', fontWeight: 700, fontSize: 16, padding: '15px 30px', borderRadius: 13, border: 'none', cursor: 'pointer', boxShadow: '0 18px 38px -14px rgba(0,0,0,.4)' }}>
                Pagar com o Stripe <ArrowRight size={17} />
              </button>
            ) : (
              <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: AMBER, color: '#16293f', fontWeight: 700, fontSize: 16, padding: '15px 30px', borderRadius: 13 }}>
                Ver planos <ArrowRight size={17} />
              </Link>
            )}
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 18, fontSize: 12.5, color: '#c9f2ec' }}>
            <Check size={14} /> Dados só de leitura · pagamento seguro via Stripe
          </div>
        </div>
      </div>
    </div>
  )
}

export default ComoComecar
