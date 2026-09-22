import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ArrowRight, KeyRound, Phone, MessageCircle, LogIn } from 'lucide-react'
import { setUiScaleSuspended } from '@/lib/uiScale'
import { buildWhatsappLink, buildTelLink } from '@/pages/Landing/assinatura'
import { useAppConfig } from '@/hooks/useAppConfig'

/**
 * Página de retorno pós-pagamento (rota pública `/assinatura-confirmada`). É pra
 * onde o Stripe Payment Link redireciona depois do checkout (configurado no
 * painel do Stripe: After payment → Redirect). Apenas informativa — NÃO valida
 * pagamento (não há backend); o Stripe já confirmou do lado dele. Dark-first,
 * mesma identidade da landing.
 */

const CSS = `
.v360-ok{
  --v-bg:#0b0e13; --v-ink:#f1f5f9; --v-muted:#b4c0d0; --v-muted2:#93a1b3;
  --v-faint:#6b7686; --v-card:#141821; --v-border:#262c36; --v-border2:#2a313c; --v-hair:#222831;
  font-family:'Instrument Sans',system-ui,sans-serif;color:var(--v-ink);background:var(--v-bg);min-height:100vh;-webkit-font-smoothing:antialiased
}
.v360-ok h1,.v360-ok h2{font-family:'Bricolage Grotesque','Instrument Sans',sans-serif;margin:0}
.v360-ok a{text-decoration:none}
@keyframes v360ok-pop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
`

const AssinaturaConfirmada = () => {
  const cfg = useAppConfig()
  const waLink = buildWhatsappLink(cfg.whatsapp, cfg.whatsappMsg)
  const telLink = buildTelLink(cfg.telefone)

  useEffect(() => {
    const prevTitle = document.title
    document.title = 'Assinatura confirmada — Visor360'
    setUiScaleSuspended(true)
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

  return (
    <div className="v360-ok">
      <style>{CSS}</style>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 22px 64px' }}>
        {/* Marca */}
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, marginBottom: 36 }}>
          <img src="/landing/SIMBOLO.png" style={{ width: 28, height: 28, objectFit: 'contain' }} alt="" />
          <span style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 19, color: 'var(--v-ink)' }}>Visor<span style={{ color: '#0F766E' }}>360</span></span>
        </Link>

        {/* Confirmação */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 76, height: 76, borderRadius: '50%', background: 'rgba(16,185,129,.14)', color: '#34d399', animation: 'v360ok-pop .5s ease-out both' }}>
            <CheckCircle2 size={40} />
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--v-ink)', marginTop: 20 }}>Assinatura confirmada!</h1>
          <p style={{ margin: '14px auto 0', fontSize: 16, lineHeight: 1.6, color: 'var(--v-muted)', maxWidth: 460 }}>
            Recebemos o seu pagamento. 🎉 Agora é só conectar a sua base — veja os próximos passos abaixo.
          </p>
        </div>

        {/* Próximos passos */}
        <div style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)', borderRadius: 20, padding: 24, marginTop: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 10, background: 'rgba(15,118,110,.12)', color: '#0F766E' }}><KeyRound size={16} /></span>
            <span style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 16, color: 'var(--v-ink)' }}>Próximos passos</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 14 }}>
            {[
              'Nossa equipe vai liberar o seu acesso ao Visor360 — você será avisado.',
              'Solicite ao WebPosto (Quality) a sua chave de integração (API).',
              'No primeiro acesso, informe a chave — o app conecta na sua base na hora.',
            ].map((txt, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#0F766E,#14b8a6)', color: '#fff', fontSize: 12, fontWeight: 800, fontFamily: "'Bricolage Grotesque',sans-serif" }}>{i + 1}</span>
                  {i < 2 && <span style={{ width: 2, flex: 1, marginTop: 4, background: 'var(--v-border2)', borderRadius: 2 }} />}
                </div>
                <span style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--v-muted)', paddingTop: 2 }}>{txt}</span>
              </div>
            ))}
          </div>

          {/* Contatos WebPosto */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <a href={telLink ?? undefined} style={{ flex: 1, minWidth: 150, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 14px', borderRadius: 11, border: '1px solid var(--v-border2)', background: 'var(--v-bg)', color: telLink ? 'var(--v-ink)' : 'var(--v-faint)', fontSize: 13, fontWeight: 600, pointerEvents: telLink ? 'auto' : 'none' }}>
              <Phone size={15} style={{ color: '#0F766E' }} /> {cfg.telefone || 'Telefone a definir'}
            </a>
            <a href={waLink ?? undefined} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: 150, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 14px', borderRadius: 11, border: '1px solid rgba(37,211,102,.4)', background: waLink ? 'rgba(37,211,102,.1)' : 'var(--v-bg)', color: waLink ? '#5eead4' : 'var(--v-faint)', fontSize: 13, fontWeight: 700, pointerEvents: waLink ? 'auto' : 'none' }}>
              <MessageCircle size={15} /> {waLink ? 'WhatsApp do WebPosto' : 'WhatsApp a definir'}
            </a>
          </div>
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
          <Link to="/login" style={{ flex: 1, minWidth: 180, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#FCB619', color: '#16293f', fontWeight: 700, fontSize: 15, padding: '14px 22px', borderRadius: 13 }}>
            <LogIn size={16} /> Acessar o Visor360
          </Link>
          <Link to="/como-comecar" style={{ flex: 1, minWidth: 180, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--v-card)', border: '1px solid var(--v-border2)', color: 'var(--v-ink)', fontWeight: 600, fontSize: 15, padding: '14px 22px', borderRadius: 13 }}>
            Ver o passo a passo <ArrowRight size={16} />
          </Link>
        </div>

        <p style={{ textAlign: 'center', margin: '24px 0 0', fontSize: 12.5, color: 'var(--v-faint)' }}>
          Dúvidas? Fale com a CCI em comercial@cci.app.br · Uma solução CCI
        </p>
      </div>
    </div>
  )
}

export default AssinaturaConfirmada
