import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  X, Sparkles, ArrowRight, KeyRound, Phone, MessageCircle, ShieldCheck, Lock,
  BarChart3, Boxes, Users, CircleDollarSign, FileText, Smartphone,
  Zap, Headphones, TrendingUp, LifeBuoy,
} from 'lucide-react'
import {
  BRL, PRECO_BASE, PRECO_IA, WEBPOSTO, linkPagamento, whatsappLink, telefoneLink,
} from '@/pages/Landing/assinatura'

/**
 * Tela de contratação/assinatura do Visor360 (tela cheia, aberta pelo "Quero
 * assinar"). Experiência premium de SaaS: hero com mockup do produto, plano em
 * destaque com grade de módulos, add-on de IA, total dinâmico, passo a passo da
 * chave de API e faixa de benefícios. Renderiza dentro de `.v360-landing`, então
 * herda os tokens de tema (--v-*). Config em src/pages/Landing/assinatura.ts.
 *
 * Regras de negócio intactas: preços fixos, pagamento via Stripe (estado "em
 * configuração" enquanto o link não existe — nunca simula pagamento).
 */

const CSS = `
.v360-checkout .hero{display:grid;grid-template-columns:1.05fr .95fr;gap:32px;align-items:center}
.v360-checkout .cols{display:grid;grid-template-columns:1.55fr 1fr;gap:22px;align-items:start}
.v360-checkout .modgrid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}
.v360-checkout .benefits{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.v360-checkout .cardh{transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
.v360-checkout .cardh:hover{transform:translateY(-2px);box-shadow:0 26px 48px -30px rgba(0,0,0,.55)}
.v360-checkout .modtile{transition:transform .16s ease,background .16s ease}
.v360-checkout .modtile:hover{transform:translateY(-2px)}
.v360-checkout .paybtn{transition:transform .12s ease,box-shadow .18s ease,filter .18s ease}
.v360-checkout .paybtn:not(:disabled):hover{transform:translateY(-1px);filter:brightness(1.03)}
@keyframes v360c-floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@media(max-width:1000px){
  .v360-checkout .cols{grid-template-columns:1fr}
}
@media(max-width:860px){
  .v360-checkout .hero{grid-template-columns:1fr}
  .v360-checkout .heromock{min-height:0}
  .v360-checkout .modgrid{grid-template-columns:repeat(3,1fr)}
  .v360-checkout .benefits{grid-template-columns:repeat(2,1fr)}
  .v360-checkout .heroh1{font-size:32px!important}
}
@media(max-width:480px){
  .v360-checkout .modgrid{grid-template-columns:repeat(2,1fr)}
}
`

const GRAD: Record<string, string> = {
  teal: 'linear-gradient(135deg,#0F766E,#14b8a6)',
  blue: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
  green: 'linear-gradient(135deg,#16a34a,#15803d)',
  amber: 'linear-gradient(135deg,#FCB619,#f59e0b)',
  purple: 'linear-gradient(135deg,#7c3aed,#6d28d9)',
}

const MODULOS_INCLUSOS = [
  { Icon: BarChart3, label: 'Vendas', sub: 'e Margem', tone: 'teal' },
  { Icon: Boxes, label: 'Estoque', sub: 'e Compras', tone: 'blue' },
  { Icon: Users, label: 'Produtividade', sub: 'e Frentistas', tone: 'teal' },
  { Icon: CircleDollarSign, label: 'Financeiro', sub: 'Completo', tone: 'green' },
  { Icon: FileText, label: 'Relatórios', sub: 'Inteligentes', tone: 'blue' },
  { Icon: Smartphone, label: 'App Mobile', sub: 'iOS e Android', tone: 'purple' },
]

const VALOR_HERO = [
  { Icon: Zap, label: 'Decisões mais rápidas' },
  { Icon: ShieldCheck, label: 'Seu posto mais seguro' },
  { Icon: TrendingUp, label: 'Resultados no dia a dia' },
]

const BENEFICIOS = [
  { Icon: Zap, titulo: 'Implantação simplificada', texto: 'Comece a usar rapidamente.' },
  { Icon: Headphones, titulo: 'Suporte especializado', texto: 'A gente acompanha você.' },
  { Icon: ShieldCheck, titulo: 'Dados protegidos', texto: 'Segurança em primeiro lugar.' },
  { Icon: TrendingUp, titulo: 'Gestão baseada em dados', texto: 'Decisões com números reais.' },
]

interface AssinarModalProps {
  open: boolean
  onClose: () => void
}

const AssinarModal = ({ open, onClose }: AssinarModalProps) => {
  const [comIA, setComIA] = useState(false)
  if (!open) return null

  const total = PRECO_BASE + (comIA ? PRECO_IA : 0)
  const link = linkPagamento(comIA)
  const irPagar = () => { if (link) window.open(link, '_blank', 'noopener,noreferrer') }
  const waLink = whatsappLink()
  const telLink = telefoneLink()

  return (
    <div className="v360-checkout" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--v-bg)', display: 'flex', flexDirection: 'column' }}>
      <style>{CSS}</style>

      {/* Header fixo */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', borderBottom: '1px solid var(--v-hair)', background: 'var(--v-bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/landing/SIMBOLO.png" style={{ width: 28, height: 28, objectFit: 'contain' }} alt="" />
          <span style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 18, color: 'var(--v-ink)' }}>Assinar o Visor<span style={{ color: '#0F766E' }}>360</span></span>
        </div>
        <button onClick={onClose} aria-label="Fechar" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 9, border: '1px solid var(--v-border2)', background: 'transparent', color: 'var(--v-muted)', cursor: 'pointer' }}>
          <X size={18} />
        </button>
      </div>

      {/* Conteúdo rolável */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '24px 22px 44px' }}>

          {/* ───── HERO ───── */}
          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 24, background: 'radial-gradient(1100px 560px at 78% 0%,#22456b 0%,#16293f 55%,#101f31 100%)', boxShadow: '0 40px 90px -50px rgba(0,0,0,.7)' }}>
            <div style={{ position: 'absolute', top: -90, right: -50, width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle,rgba(252,182,25,.22) 0%,rgba(252,182,25,0) 70%)' }} />
            <div className="hero" style={{ position: 'relative', padding: '40px 40px 44px' }}>
              {/* Texto */}
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(20,184,166,.14)', border: '1px solid rgba(20,184,166,.4)', color: '#5eead4', fontSize: 12.5, fontWeight: 600, padding: '6px 13px', borderRadius: 999 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#14b8a6' }} /> Gestão completa para postos de combustíveis
                </div>
                <h1 className="heroh1" style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 42, fontWeight: 800, lineHeight: 1.05, color: '#fff', letterSpacing: '-.025em', margin: '18px 0 0' }}>
                  Mais controle,<br />mais resultado para o seu posto.
                </h1>
                <p style={{ margin: '16px 0 0', fontSize: 16, lineHeight: 1.6, color: '#cbd5e1', maxWidth: 440 }}>
                  Todos os módulos do Visor360 numa única solução — vendas, estoque, frentistas, financeiro e muito mais, de onde você estiver.
                </p>
                <div style={{ display: 'flex', gap: 18, marginTop: 22, flexWrap: 'wrap' }}>
                  {VALOR_HERO.map((v) => {
                    const Icon = v.Icon
                    return (
                      <div key={v.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,.08)', color: '#5eead4' }}><Icon size={15} /></span>
                        <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{v.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Mockup (browser + telefone) */}
              <div className="heromock" style={{ position: 'relative', minHeight: 260 }}>
                <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 40px 80px -30px rgba(0,0,0,.6)', border: '1px solid rgba(255,255,255,.12)', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 11px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#f87171' }} />
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#fbbf24' }} />
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#34d399' }} />
                  </div>
                  <img src="/landing/analise-semanal-full.png" style={{ display: 'block', width: '100%' }} alt="Painel do Visor360" />
                </div>
                <div style={{ position: 'absolute', bottom: -14, left: -8, width: 132, height: 264, background: '#0f172a', borderRadius: 24, padding: 6, boxShadow: '0 40px 70px -24px rgba(0,0,0,.6)', animation: 'v360c-floaty 7s ease-in-out infinite' }}>
                  <div style={{ width: '100%', height: '100%', background: '#16293f', borderRadius: 19, overflow: 'hidden', padding: '12px 10px', color: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <img src="/landing/SIMBOLO.png" style={{ width: 14, height: 14, objectFit: 'contain' }} alt="" />
                      <span style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 11 }}>Visor<span style={{ color: '#FCB619' }}>360</span></span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: 10, padding: 9, marginTop: 11 }}>
                      <div style={{ fontSize: 8, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em' }}>Vendas hoje</div>
                      <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 17 }}>R$ 24,5k</div>
                      <div style={{ fontSize: 9, color: '#5eead4' }}>▲ 12%</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 30, marginTop: 10 }}>
                      <div style={{ flex: 1, height: '55%', background: '#0F766E', borderRadius: '2px 2px 0 0' }} />
                      <div style={{ flex: 1, height: '100%', background: '#14b8a6', borderRadius: '2px 2px 0 0' }} />
                      <div style={{ flex: 1, height: '70%', background: '#2563eb', borderRadius: '2px 2px 0 0' }} />
                      <div style={{ flex: 1, height: '45%', background: '#FCB619', borderRadius: '2px 2px 0 0' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ───── DUAS COLUNAS ───── */}
          <div className="cols" style={{ marginTop: 22 }}>
            {/* Esquerda: plano */}
            <div className="cardh" style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)', borderRadius: 22, padding: 26 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--v-muted2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Seu plano</span>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: '#0F766E', background: 'rgba(15,118,110,.14)', border: '1px solid rgba(15,118,110,.35)', padding: '3px 9px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '.05em' }}>Mais completo</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 27, fontWeight: 800, color: 'var(--v-ink)', letterSpacing: '-.01em' }}>Visor360 Completo</h2>
                  <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--v-muted2)' }}>Todos os módulos e o app no celular.</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="tnum" style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 30, color: 'var(--v-ink)', letterSpacing: '-.02em' }}>{BRL(PRECO_BASE)}<span style={{ fontSize: 14, color: 'var(--v-faint)', fontWeight: 600 }}>/mês</span></div>
                </div>
              </div>

              {/* Grade de módulos */}
              <div className="modgrid" style={{ marginTop: 20 }}>
                {MODULOS_INCLUSOS.map((m) => {
                  const Icon = m.Icon
                  return (
                    <div key={m.label} className="modtile" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8, padding: '14px 6px', borderRadius: 14, border: '1px solid var(--v-border2)', background: 'var(--v-bg)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 12, background: GRAD[m.tone], color: '#fff', boxShadow: '0 8px 18px -10px rgba(0,0,0,.5)' }}><Icon size={19} /></span>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--v-ink)', lineHeight: 1.15 }}>{m.label}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--v-faint)' }}>{m.sub}</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Add-on IA */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 18, padding: '14px 16px', borderRadius: 16, border: `1px solid ${comIA ? 'rgba(252,182,25,.55)' : 'var(--v-border2)'}`, background: comIA ? 'rgba(252,182,25,.08)' : 'var(--v-bg)', cursor: 'pointer', transition: 'border-color .16s, background .16s' }}>
                <input type="checkbox" checked={comIA} onChange={(e) => setComIA(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2, accentColor: '#FCB619', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 800, color: 'var(--v-ink)', fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                      <Sparkles size={16} style={{ color: '#f59e0b' }} /> Adicionar Analista de IA
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#b45309', background: 'rgba(252,182,25,.16)', border: '1px solid rgba(252,182,25,.4)', padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '.04em' }}>Recomendado</span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.45, color: 'var(--v-muted2)' }}>Insights automáticos, alertas e análises inteligentes para o seu posto.</p>
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--v-ink)', whiteSpace: 'nowrap' }}>+{BRL(PRECO_IA)}<span style={{ fontSize: 11, color: 'var(--v-faint)', fontWeight: 600 }}>/mês</span></span>
              </label>

              {/* Total */}
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--v-hair)' }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--v-muted2)' }}>Total</span>
                <span className="tnum" style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 34, color: 'var(--v-ink)', letterSpacing: '-.02em' }}>{BRL(total)}<span style={{ fontSize: 15, color: 'var(--v-faint)', fontWeight: 600 }}>/mês</span></span>
              </div>

              {/* Pagamento */}
              <button onClick={irPagar} disabled={!link} className="paybtn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, width: '100%', marginTop: 16, background: '#FCB619', color: '#16293f', fontWeight: 800, fontSize: 16, padding: '16px 20px', borderRadius: 14, border: 'none', boxShadow: '0 18px 38px -16px rgba(252,182,25,.75)', cursor: link ? 'pointer' : 'not-allowed', opacity: link ? 1 : 0.65 }}>
                <Lock size={17} /> {link ? 'Pagar com o Stripe' : 'Pagamento em configuração'} {link && <ArrowRight size={18} />}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 11, fontSize: 12, color: 'var(--v-faint)' }}>
                <ShieldCheck size={14} style={{ color: '#0F766E' }} /> {link ? 'Pagamento seguro via Stripe — o cartão não passa pelo Visor360.' : 'O link de pagamento do Stripe será ativado em breve.'}
              </div>
            </div>

            {/* Direita: chave + suporte */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Passo a passo da chave */}
              <div className="cardh" style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)', borderRadius: 20, padding: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 10, background: 'rgba(15,118,110,.12)', color: '#0F766E' }}><KeyRound size={16} /></span>
                  <span style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 15.5, color: 'var(--v-ink)' }}>Depois de pagar: sua chave de API</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 14 }}>
                  {[
                    'Solicite ao WebPosto (Quality) a sua chave de integração (API) — pelos canais abaixo.',
                    'Informe que deseja conectar o Visor360 à sua base do WebPosto.',
                    'Com a chave em mãos, informe-a no primeiro acesso ao Visor360 — a gente te guia.',
                  ].map((txt, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#0F766E,#14b8a6)', color: '#fff', fontSize: 12, fontWeight: 800, fontFamily: "'Bricolage Grotesque',sans-serif" }}>{i + 1}</span>
                        {i < 2 && <span style={{ width: 2, flex: 1, marginTop: 4, background: 'var(--v-border2)', borderRadius: 2 }} />}
                      </div>
                      <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--v-muted)', paddingTop: 2 }}>{txt}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fale com o WebPosto */}
              <div className="cardh" style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)', borderRadius: 20, padding: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 10, background: 'rgba(37,99,235,.12)', color: '#2563eb' }}><LifeBuoy size={16} /></span>
                  <div>
                    <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 15, color: 'var(--v-ink)' }}>Fale com o WebPosto (Quality)</div>
                    <div style={{ fontSize: 11.5, color: 'var(--v-faint)' }}>Solicite sua chave de integração (API)</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                  <a href={telLink ?? undefined} className="cardh" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 15px', borderRadius: 12, border: '1px solid var(--v-border2)', background: 'var(--v-bg)', color: telLink ? 'var(--v-ink)' : 'var(--v-faint)', fontSize: 13.5, fontWeight: 600, pointerEvents: telLink ? 'auto' : 'none' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}><Phone size={15} style={{ color: '#0F766E' }} /> {WEBPOSTO.telefone || 'Telefone a definir'}</span>
                    <ArrowRight size={15} style={{ color: 'var(--v-faint)' }} />
                  </a>
                  <a href={waLink ?? undefined} target="_blank" rel="noopener noreferrer" className="cardh" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 15px', borderRadius: 12, border: '1px solid rgba(37,211,102,.4)', background: waLink ? 'rgba(37,211,102,.1)' : 'var(--v-bg)', color: waLink ? '#128c3e' : 'var(--v-faint)', fontSize: 13.5, fontWeight: 700, pointerEvents: waLink ? 'auto' : 'none' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}><MessageCircle size={15} /> {waLink ? 'WhatsApp' : 'WhatsApp a definir'}</span>
                    <ArrowRight size={15} />
                  </a>
                </div>
              </div>

              {/* Precisa de ajuda */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'linear-gradient(135deg,rgba(15,118,110,.12),rgba(37,99,235,.08))', border: '1px solid var(--v-border2)', borderRadius: 20, padding: 18 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 10, background: 'rgba(252,182,25,.16)', color: '#f59e0b', flexShrink: 0 }}><Headphones size={17} /></span>
                <div>
                  <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 14.5, color: 'var(--v-ink)' }}>Precisa de ajuda?</div>
                  <p style={{ margin: '3px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--v-muted2)' }}>Nosso time está pronto pra te orientar em todo o processo — comercial@cci.app.br.</p>
                  <Link to="/como-comecar" onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, fontSize: 12.5, fontWeight: 700, color: '#0F766E' }}>Ver o passo a passo completo <ArrowRight size={14} /></Link>
                </div>
              </div>
            </div>
          </div>

          {/* ───── BENEFÍCIOS ───── */}
          <div className="benefits" style={{ marginTop: 22 }}>
            {BENEFICIOS.map((b) => {
              const Icon = b.Icon
              return (
                <div key={b.titulo} className="cardh" style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--v-card)', border: '1px solid var(--v-border)', borderRadius: 16, padding: '18px 16px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: 'rgba(15,118,110,.12)', color: '#0F766E' }}><Icon size={18} /></span>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--v-ink)' }}>{b.titulo}</div>
                    <div style={{ fontSize: 12, color: 'var(--v-muted2)', marginTop: 2 }}>{b.texto}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Rodapé */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 26, fontSize: 12.5, color: 'var(--v-faint)' }}>
            <ShieldCheck size={15} style={{ color: '#0F766E' }} /> Ambiente seguro com Stripe · Dados só de leitura · Uma solução CCI
          </div>
        </div>
      </div>
    </div>
  )
}

export default AssinarModal
