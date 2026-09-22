import { useState } from 'react'
import { MessageCircle, X, Mail, Loader2, CheckCircle2 } from 'lucide-react'
import { insertLandingLead } from '@/api/supabase/leads'
import { useAppConfig } from '@/hooks/useAppConfig'

/**
 * Captação de leads da landing — formulário único (estilo popup de atendimento).
 * Coleta nome, e-mail, telefone e motivo, salva em `landing_leads` (Supabase,
 * insert público) e encaminha o resumo pro WhatsApp/e-mail da CCI. Sem IA e sem
 * backend. Renderiza dentro de `.v360-landing` (herda os tokens de tema).
 *
 * Destinos: WhatsApp = comercial da config (padrão +55 27 99925-0088);
 * e-mail = contato@cci.app.br.
 */

const EMAIL_DEST = 'contato@cci.app.br'
const MOTIVOS = ['Quero assinar', 'Agendar demonstração', 'Trocar de sistema (ERP)', 'Tirar dúvidas']
const SISTEMAS = ['WebPosto (Quality)', 'Linx AutoSystem', 'Outro sistema', 'Não sei']

const Avatar = ({ size = 30 }: { size?: number }) => (
  <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#0F766E,#14b8a6)', color: '#fff' }}>
    <img src="/landing/SIMBOLO.png" alt="" style={{ width: size * 0.55, height: size * 0.55, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
  </span>
)

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid var(--v-border2)',
  background: 'var(--v-bg)', color: 'var(--v-ink)', fontSize: 13.5, padding: '11px 12px', outline: 'none',
}

const LeadChat = () => {
  const cfg = useAppConfig()
  const [open, setOpen] = useState(false)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [motivo, setMotivo] = useState('')
  const [sistema, setSistema] = useState('')
  const [aceite, setAceite] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const telDigits = telefone.replace(/\D/g, '')
  const valido = nome.trim().length > 1 && /.+@.+\..+/.test(email) && telDigits.length >= 10 && aceite

  const resumo = [
    'Olá! Tenho interesse no Visor360.',
    `Nome: ${nome}`,
    `E-mail: ${email}`,
    `Telefone: ${telefone}`,
    motivo && `Motivo: ${motivo}`,
    sistema && `Sistema atual: ${sistema}`,
  ].filter(Boolean).join('\n')

  const waLink = cfg.comercialWhatsapp ? `https://wa.me/${cfg.comercialWhatsapp}?text=${encodeURIComponent(resumo)}` : null
  const mailLink = `mailto:${EMAIL_DEST}?subject=${encodeURIComponent(`Novo lead Visor360 — ${nome || 'interesse'}`)}&body=${encodeURIComponent(resumo)}`

  const enviar = async (canal: 'wa' | 'email') => {
    if (!valido || sending) return
    setSending(true)
    try {
      await insertLandingLead({ nome: nome.trim(), rede: '', cidade: '', sistema, motivo, whatsapp: telefone.trim(), email: email.trim() })
    } catch { /* segue mesmo se falhar (tabela ausente/RLS) — o contato ainda é aberto */ }
    setSending(false)
    setSent(true)
    if (canal === 'wa' && waLink) window.open(waLink, '_blank', 'noopener,noreferrer')
    else window.location.href = mailLink
  }

  return (
    <>
      {open && (
        <div style={{ position: 'fixed', bottom: 88, right: 20, zIndex: 1200, width: 'min(380px,calc(100vw - 32px))', maxHeight: 'calc(100dvh - 130px)', display: 'flex', flexDirection: 'column', background: 'var(--v-card)', border: '1px solid var(--v-border)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 40px 90px -30px rgba(0,0,0,.55)' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '14px 16px', background: 'radial-gradient(600px 200px at 20% 0%,#22456b,#16293f)', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar size={34} />
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 15 }}>Visor<span style={{ color: '#FCB619' }}>360</span> · Atendimento</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,.75)' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} /> online</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fechar" style={{ display: 'inline-flex', padding: 6, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,.12)', color: '#fff', cursor: 'pointer' }}><X size={16} /></button>
          </div>

          <div style={{ overflowY: 'auto', padding: 16 }}>
            {sent ? (
              <div style={{ textAlign: 'center', padding: '20px 8px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: '50%', background: 'rgba(16,185,129,.14)', color: '#34d399' }}><CheckCircle2 size={30} /></div>
                <h3 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 17, color: 'var(--v-ink)', marginTop: 14 }}>Recebemos seus dados! 🎉</h3>
                <p style={{ margin: '8px auto 0', fontSize: 13.5, lineHeight: 1.5, color: 'var(--v-muted2)', maxWidth: 260 }}>Nosso time da CCI vai falar com você. Se o WhatsApp não abriu, é só tocar abaixo.</p>
                {waLink && (
                  <a href={waLink} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, background: '#128c3e', color: '#fff', fontWeight: 700, fontSize: 14, padding: '12px', borderRadius: 11 }}><MessageCircle size={16} /> Abrir o WhatsApp</a>
                )}
              </div>
            ) : (
              <>
                {/* Saudação */}
                <div style={{ display: 'flex', gap: 9, marginBottom: 14 }}>
                  <Avatar />
                  <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--v-ink)', background: 'var(--v-bg)', border: '1px solid var(--v-border2)', borderRadius: 14, padding: '10px 12px' }}>
                    👋 Olá! Como podemos te ajudar? Deixe seus dados que o time da CCI fala com você.
                  </div>
                </div>

                {/* Formulário */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome *" style={inputStyle} />
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="E-mail *" style={inputStyle} />
                  <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, border: '1px solid var(--v-border2)', borderRadius: 10, overflow: 'hidden', background: 'var(--v-bg)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0 10px', borderRight: '1px solid var(--v-border2)', fontSize: 13, color: 'var(--v-muted)', whiteSpace: 'nowrap' }}>🇧🇷 +55</span>
                    <input value={telefone} onChange={(e) => setTelefone(e.target.value)} type="tel" placeholder="Telefone / WhatsApp *" style={{ ...inputStyle, border: 'none', borderRadius: 0, flex: 1 }} />
                  </div>
                  <select value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ ...inputStyle, appearance: 'auto' }}>
                    <option value="">Selecione o motivo…</option>
                    {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={sistema} onChange={(e) => setSistema(e.target.value)} style={{ ...inputStyle, appearance: 'auto' }}>
                    <option value="">Qual sistema (ERP) você usa?</option>
                    {SISTEMAS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--v-muted2)', cursor: 'pointer', marginTop: 2 }}>
                    <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} style={{ width: 15, height: 15, marginTop: 1, accentColor: '#0F766E', flexShrink: 0 }} />
                    <span>Concordo em receber comunicações da CCI. <a href="https://www.cci.app.br" target="_blank" rel="noopener noreferrer" style={{ color: '#0F766E', fontWeight: 600 }}>Política de Privacidade</a></span>
                  </label>

                  <button
                    onClick={() => enviar('wa')}
                    disabled={!valido || sending}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginTop: 4, background: valido ? '#128c3e' : 'var(--v-border2)', color: valido ? '#fff' : 'var(--v-faint)', fontWeight: 700, fontSize: 14.5, padding: '13px', borderRadius: 11, border: 'none', cursor: valido && !sending ? 'pointer' : 'not-allowed' }}
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={17} />} Ir para o WhatsApp
                  </button>
                  <button onClick={() => enviar('email')} disabled={!valido || sending} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'none', border: 'none', color: valido ? 'var(--v-muted)' : 'var(--v-faint)', fontSize: 12.5, fontWeight: 600, cursor: valido && !sending ? 'pointer' : 'not-allowed' }}>
                    <Mail size={13} /> ou enviar por e-mail
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Botão flutuante */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Fechar atendimento' : 'Falar com a CCI'}
        style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1200, display: 'inline-flex', alignItems: 'center', gap: 9, height: 54, padding: open ? 0 : '0 20px', width: open ? 54 : 'auto', justifyContent: 'center', borderRadius: 999, border: 'none', background: 'linear-gradient(135deg,#0F766E,#14b8a6)', color: '#fff', fontWeight: 700, fontSize: 15, boxShadow: '0 18px 40px -12px rgba(15,118,110,.7)', cursor: 'pointer' }}
      >
        {open ? <X size={22} /> : <><MessageCircle size={20} /> Fale com a gente</>}
      </button>
    </>
  )
}

export default LeadChat
