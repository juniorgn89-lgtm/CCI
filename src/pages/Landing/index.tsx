import { type CSSProperties, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Sun, Moon, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { setUiScaleSuspended } from '@/lib/uiScale'
import { PLANOS } from '@/lib/planos'
import LandingInstallButton from '@/pages/Landing/InstallButton'
import LeadChat from '@/components/landing/LeadChat'

/**
 * Landing institucional do Visor360 — a "capa" pública do app (rota `/`).
 *
 * Reproduz a peça aprovada da CCI (marca teal #0F766E + âmbar #FCB619, fontes
 * Bricolage Grotesque + Instrument Sans). As cores estruturais (fundo, texto,
 * cards, bordas) vêm de variáveis CSS que trocam no modo escuro. A landing ABRE
 * SEMPRE NO ESCURO (é a cara da marca) e volta pro escuro a cada refresh — o
 * visitante pode clarear pelo botão sol/lua na nav, mas só durante a sessão. O
 * tema é controlado localmente (classe `dark` no <html>, restaurada ao sair) pra
 * NÃO gravar preferência nem mexer no tema do app quando ele logar. As seções
 * que já nascem escuras (hero mock, destaque IA, CTA teal) e os acentos
 * (teal/âmbar) ficam iguais nos dois temas — o contraste é proposital.
 *
 * As fontes do Google carregam só aqui (injetadas no mount e removidas no
 * unmount), pra não pesar no resto do app. Um usuário já logado que abre a raiz
 * é mandado direto pro painel — a landing é pra visitante.
 */

const MAIL = {
  demo: 'mailto:comercial@cci.app.br?subject=Agendar%20demonstra%C3%A7%C3%A3o%20Visor360',
  falar: 'mailto:comercial@cci.app.br?subject=Falar%20com%20a%20CCI%20-%20Visor360',
  suporte: 'mailto:comercial@cci.app.br?subject=Suporte%20Visor360',
  email: 'mailto:comercial@cci.app.br',
}

/**
 * A landing vende UM plano base (tudo, MENOS a IA) + o Analista de IA como
 * add-on opcional. As funções vêm achatadas do catálogo de planos (fonte da
 * verdade em src/lib/planos.ts) — reusar PLANOS mantém a lista em sincronia sem
 * tocar no gating por plano do app.
 */
const IA_FEATURE = 'Analista de IA — a Inteligência que explica o número'
const FUNCOES_BASE = PLANOS.flatMap((p) => p.recursos).filter((r) => r !== IA_FEATURE)

const MODULOS: { icon: string; bg: string; titulo: string; texto: string }[] = [
  { icon: '🗺️', bg: '#eef4ff', titulo: 'Visão Geral da Rede', texto: 'Faturamento, lucro, margem e projeção de todos os postos num só lugar — com mapa da rede e o cadastro de cada posto.' },
  { icon: '⛽', bg: '#fef4e2', titulo: 'Combustível', texto: 'Volume, margem por produto e gestão de preços por tabela — com o impacto real do desconto no lucro bruto.' },
  { icon: '🛒', bg: '#eafaf1', titulo: 'Conveniência', texto: 'Desempenho da loja, ticket médio e giro — separando o que vem da pista do que vem do balcão.' },
  { icon: '🔧', bg: '#f0edff', titulo: 'Automotivos', texto: 'Troca de óleo e serviços agregados acompanhados junto do resto da operação do posto.' },
  { icon: '⚙️', bg: '#e7f6f4', titulo: 'Operação', texto: 'Bombas, desgaste e reabastecimento — do nível dos tanques ao quanto comprar até o fim do mês.' },
  { icon: '📊', bg: '#fdeef0', titulo: 'Apuração & Financeiro', texto: 'Fechamento diário automático e qualidade dos dados, sinalizando onde a informação está faltando.' },
]

const NUMEROS: { valor: string; cor: string; label: string }[] = [
  { valor: '6', cor: 'var(--v-ink)', label: 'módulos num só login' },
  { valor: '1×/dia', cor: '#0F766E', label: 'apuração automática' },
  { valor: '100%', cor: 'var(--v-ink)', label: 'dados só de leitura' },
  { valor: 'web+app', cor: '#2563eb', label: 'rede no bolso' },
]

const IA_BULLETS = [
  'Compara posto a posto e destaca quem está fora da curva',
  'Estima o ganho potencial de cada ajuste em reais',
  'Só leitura: a IA analisa, quem decide é você',
]

const TRUST = ['Conecta ao seu ERP de posto', 'Apuração automática diária', 'Dados só de leitura', 'App no celular e no PC — sem loja']

// CSS scoped em `.v360-landing` — não vaza pro app. Inclui as fontes da marca,
// o floaty do mockup, a responsividade mínima (empilha os grids no celular sem
// mudar o layout desktop da peça) e os tokens de cor claro/escuro. As cores
// estruturais usam var(--v-*); o modo escuro (`.dark` no <html>) só redefine os
// tokens — nenhuma regra de layout muda.
const LANDING_CSS = `
.v360-landing{
  --v-bg:#fff; --v-ink:#16293f; --v-ink2:#0f172a; --v-muted:#475569;
  --v-muted2:#64748b; --v-faint:#94a3b8; --v-card:#fff; --v-border:#e9eef4;
  --v-border2:#e2e8f0; --v-hair:#eef2f7; --v-soft:#f6f8fb;
  font-family:'Instrument Sans',system-ui,sans-serif;color:var(--v-ink2);background:var(--v-bg);-webkit-font-smoothing:antialiased;min-height:100vh
}
.dark .v360-landing{
  --v-bg:#0b0e13; --v-ink:#f1f5f9; --v-ink2:#e5e7eb; --v-muted:#b4c0d0;
  --v-muted2:#93a1b3; --v-faint:#6b7686; --v-card:#141821; --v-border:#262c36;
  --v-border2:#2a313c; --v-hair:#222831; --v-soft:#10141a;
}
.v360-landing h1,.v360-landing h2,.v360-landing h3{font-family:'Bricolage Grotesque','Instrument Sans',sans-serif;margin:0}
.v360-landing h1,.v360-landing h2,.v360-landing h3,.v360-landing p{overflow-wrap:break-word}
.v360-landing a{text-decoration:none}
.v360-landing .tnum{font-variant-numeric:tabular-nums}
.v360-landing .v360-themebtn{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:11px;border:1px solid var(--v-border2);background:var(--v-card);color:var(--v-muted);cursor:pointer;transition:color .15s,border-color .15s}
.v360-landing .v360-themebtn:hover{color:var(--v-ink);border-color:var(--v-faint)}
@keyframes v360-floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@media(max-width:980px){
  .v360-landing .v360-hero{grid-template-columns:1fr!important}
  .v360-landing .v360-heromock{min-height:420px}
  .v360-landing .v360-ia{grid-template-columns:1fr!important;gap:36px!important}
  .v360-landing .v360-publicos{grid-template-columns:1fr!important}
  .v360-landing .v360-modulos{grid-template-columns:repeat(2,1fr)!important}
  .v360-landing .v360-h1{font-size:44px!important}
}
@media(max-width:640px){
  .v360-landing .v360-modulos{grid-template-columns:1fr!important}
  .v360-landing .v360-planos{grid-template-columns:1fr!important}
  .v360-landing .v360-numeros{grid-template-columns:repeat(2,1fr)!important}
  .v360-landing .v360-navmenu{display:none!important}
  .v360-landing .v360-nav{flex-direction:column!important;align-items:center!important;gap:14px!important}
  .v360-landing .v360-sitecci{display:none!important}
  .v360-landing .v360-herophone{display:none!important}
  .v360-landing .v360-h1{font-size:34px!important}
  .v360-landing h2{font-size:30px!important;line-height:1.15!important}
  .v360-landing .v360-num{font-size:32px!important}
  .v360-landing .v360-wrap{padding-left:20px!important;padding-right:20px!important}
  .v360-landing .v360-heropad{padding:40px 24px 44px!important}
  .v360-landing .v360-heromock{min-height:0!important}
  .v360-landing .v360-mockpad{padding:32px 22px 40px!important}
}
@media(max-width:400px){
  .v360-landing .v360-h1{font-size:30px!important}
  .v360-landing h2{font-size:26px!important}
  .v360-landing .v360-num{font-size:28px!important}
  .v360-landing .v360-numeros{gap:12px!important}
  .v360-landing .v360-heropad{padding:32px 18px 36px!important}
}
`

const card: CSSProperties = { background: 'var(--v-card)', border: '1px solid var(--v-border)', borderRadius: 18, padding: '26px 24px', boxShadow: '0 20px 40px -34px rgba(15,41,63,.4)' }

const Landing = () => {
  const session = useAuthStore((s) => s.session)
  // A landing abre sempre no escuro; refresh volta pro escuro. Tema local (não
  // persiste) — o clarear vale só pra sessão atual.
  const [dark, setDark] = useState(true)
  const toggleTheme = () => setDark((v) => !v)

  // Enquanto a landing está montada, ela manda no tema (classe `dark` no <html>);
  // ao sair (ex.: ir pro /login), restaura o tema original do app.
  useEffect(() => {
    const html = document.documentElement
    const original = html.classList.contains('dark')
    return () => { html.classList.toggle('dark', original) }
  }, [])
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  // Fontes da marca (Google) só nesta página — injeta no mount, limpa no unmount.
  useEffect(() => {
    const prevTitle = document.title
    document.title = 'Visor360 — Gestão inteligente para redes de postos'
    // A landing é peça pixel-specific → sem o auto-zoom do dashboard denso.
    setUiScaleSuspended(true)
    const links: HTMLLinkElement[] = []
    const add = (rel: string, href: string, cross?: boolean) => {
      const l = document.createElement('link')
      l.rel = rel
      l.href = href
      if (cross) l.crossOrigin = 'anonymous'
      document.head.appendChild(l)
      links.push(l)
    }
    add('preconnect', 'https://fonts.googleapis.com')
    add('preconnect', 'https://fonts.gstatic.com', true)
    add('stylesheet', 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600&display=swap')
    return () => {
      document.title = prevTitle
      setUiScaleSuspended(false)
      links.forEach((l) => l.remove())
    }
  }, [])

  // Usuário logado não vê a landing — vai direto pro painel.
  if (session) return <Navigate to="/dashboard" replace />

  return (
    <div className="v360-landing">
      <style>{LANDING_CSS}</style>
      <div style={{ width: '100%', overflow: 'hidden' }}>

        {/* ===================== NAV ===================== */}
        <div className="v360-wrap v360-nav" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap', maxWidth: 1200, margin: '0 auto', padding: '26px 40px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <img src="/landing/SIMBOLO.png" style={{ width: 34, height: 34, objectFit: 'contain' }} alt="" />
            <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 23, color: 'var(--v-ink)', letterSpacing: '-.01em' }}>Visor<span style={{ color: '#0F766E' }}>360</span></div>
          </div>
          <div className="v360-navmenu" style={{ display: 'flex', alignItems: 'center', gap: 28, color: 'var(--v-muted)', fontSize: 14.5, fontWeight: 500, flexWrap: 'wrap' }}>
            <a href="#modulos" style={{ color: 'var(--v-muted)' }}>Módulos</a>
            <a href="#planos" style={{ color: 'var(--v-muted)' }}>Planos</a>
            <a href="#ia" style={{ color: 'var(--v-muted)' }}>Analista de IA</a>
            <a href="#contato" style={{ color: 'var(--v-muted)' }}>Contato</a>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <a href="https://www.cci.app.br" target="_blank" rel="noopener noreferrer" title="Ir para o site da CCI" className="v360-sitecci" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#0F766E', fontSize: 14.5, fontWeight: 700 }}>Site da CCI ↗</a>
            <button
              type="button"
              onClick={toggleTheme}
              className="v360-themebtn"
              aria-label={dark ? 'Ativar modo claro' : 'Ativar modo escuro'}
              title={dark ? 'Modo claro' : 'Modo escuro'}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <LandingInstallButton />
            <Link to="/login" style={{ background: '#16293f', color: '#fff', fontWeight: 600, fontSize: 14.5, padding: '11px 20px', borderRadius: 11 }}>Acessar</Link>
          </div>
        </div>

        {/* ===================== HERO ===================== */}
        <div className="v360-wrap" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px' }}>
          <div className="v360-hero" style={{ display: 'grid', gridTemplateColumns: '1fr 1.05fr', gap: 0, alignItems: 'stretch', marginTop: 20, borderRadius: 26, overflow: 'hidden', boxShadow: '0 40px 90px -46px rgba(15,41,63,.4)' }}>
            <div className="v360-heropad" style={{ padding: '56px 46px 60px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'var(--v-card)' }}>
              <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 8, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#0f766e', fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 999, marginBottom: 22 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#14b8a6', display: 'inline-block' }} /> Analista de IA integrado
              </div>
              <h1 className="v360-h1" style={{ fontSize: 58, fontWeight: 800, lineHeight: 1.0, color: 'var(--v-ink)', letterSpacing: '-.025em' }}>Menos planilha.<br />Mais lucro.</h1>
              <p style={{ margin: '22px 0 0', fontSize: 18, lineHeight: 1.6, color: 'var(--v-muted)', maxWidth: 470 }}>O Visor360 conecta ao seu sistema, cruza os números de toda a rede e transforma dado bruto em decisão — combustível, loja, operação e financeiro num só lugar.</p>
              <div style={{ display: 'flex', gap: 14, marginTop: 34, flexWrap: 'wrap' }}>
                <Link to="/como-comecar" style={{ background: '#FCB619', color: '#16293f', fontWeight: 700, fontSize: 16, padding: '15px 28px', borderRadius: 13, boxShadow: '0 16px 34px -14px rgba(252,182,25,.8)' }}>Assinar agora</Link>
                <a href="#modulos" style={{ background: 'var(--v-card)', border: '1.5px solid var(--v-border2)', color: 'var(--v-ink)', fontWeight: 600, fontSize: 16, padding: '15px 26px', borderRadius: 13 }}>Conhecer os módulos</a>
              </div>
              <p style={{ margin: '16px 0 0', fontSize: 14.5, color: 'var(--v-muted2)' }}><strong style={{ color: 'var(--v-ink)' }}>R$ 199,99/mês</strong> · Analista de IA opcional (+R$ 70/mês) · sem fidelidade</p>
              <div style={{ display: 'flex', gap: 24, marginTop: 40, flexWrap: 'wrap' }}>
                <div><div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 27, color: 'var(--v-ink)' }}>6</div><div style={{ fontSize: 13, color: 'var(--v-muted2)' }}>módulos integrados</div></div>
                <div style={{ width: 1, background: 'var(--v-border2)' }} />
                <div><div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 27, color: 'var(--v-ink)' }}>tempo real</div><div style={{ fontSize: 13, color: 'var(--v-muted2)' }}>por posto</div></div>
                <div style={{ width: 1, background: 'var(--v-border2)' }} />
                <div><div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 27, color: '#0F766E' }}>read-only</div><div style={{ fontSize: 13, color: 'var(--v-muted2)' }}>a IA não altera valor</div></div>
              </div>
            </div>

            <div className="v360-heromock" style={{ position: 'relative', background: 'radial-gradient(900px 560px at 60% 20%,#22456b 0%,#16293f 60%,#101f31 100%)', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -80, right: -60, width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle,rgba(252,182,25,.25) 0%,rgba(252,182,25,0) 70%)' }} />
              <div className="v360-mockpad" style={{ position: 'relative', padding: '52px 44px 60px' }}>
                <div style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 40px 80px -30px rgba(0,0,0,.6)', border: '1px solid rgba(255,255,255,.12)', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 13px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f87171' }} />
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fbbf24' }} />
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#34d399' }} />
                  </div>
                  <img src="/landing/analise-semanal-full.png" style={{ display: 'block', width: '100%' }} alt="Análise semanal Visor360" />
                </div>
                <div className="v360-herophone" style={{ position: 'absolute', bottom: 22, left: 26, width: 168, height: 344, background: '#0f172a', borderRadius: 28, padding: 7, boxShadow: '0 40px 70px -24px rgba(0,0,0,.6)', animation: 'v360-floaty 7s ease-in-out infinite' }}>
                  <div style={{ width: '100%', height: '100%', background: '#16293f', borderRadius: 22, overflow: 'hidden', padding: '14px 12px', color: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><img src="/landing/SIMBOLO.png" style={{ width: 16, height: 16, objectFit: 'contain' }} alt="" /><span style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 12 }}>Visor<span style={{ color: '#FCB619' }}>360</span></span></div>
                    <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: 12, padding: 11, marginTop: 14 }}>
                      <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em' }}>Lucro hoje</div>
                      <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 20 }} className="tnum">R$ 48,9k</div>
                      <div style={{ fontSize: 10, color: '#5eead4' }}>▲ 12%</div>
                    </div>
                    <div style={{ background: '#fff', color: '#0f172a', borderRadius: 12, padding: 10, marginTop: 9, borderLeft: '3px solid #FCB619' }}>
                      <div style={{ fontSize: 8.5, fontWeight: 700, color: '#b45309' }}>✨ IA</div>
                      <div style={{ fontSize: 9.5, color: '#334155', lineHeight: 1.35, marginTop: 3 }}>Aurora Centro R$0,21 abaixo da rede</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 34, marginTop: 12 }}>
                      <div style={{ flex: 1, height: '60%', background: '#0F766E', borderRadius: '3px 3px 0 0' }} />
                      <div style={{ flex: 1, height: '100%', background: '#14b8a6', borderRadius: '3px 3px 0 0' }} />
                      <div style={{ flex: 1, height: '70%', background: '#2563eb', borderRadius: '3px 3px 0 0' }} />
                      <div style={{ flex: 1, height: '45%', background: '#FCB619', borderRadius: '3px 3px 0 0' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===================== TRUST STRIP ===================== */}
        <div className="v360-wrap" style={{ maxWidth: 1200, margin: '44px auto 0', padding: '0 40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 36, flexWrap: 'wrap', color: 'var(--v-faint)', fontSize: 13.5, fontWeight: 600, letterSpacing: '.02em' }}>
            {TRUST.map((t, i) => (
              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 36 }}>
                {i > 0 && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--v-border2)' }} />}
                <span>{t}</span>
              </span>
            ))}
          </div>
        </div>

        {/* ===================== MÓDULOS ===================== */}
        <div id="modulos" className="v360-wrap" style={{ maxWidth: 1200, margin: '0 auto', padding: '88px 40px 0' }}>
          <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
            <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: '#0F766E' }}>Módulos</div>
            <h2 style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1, color: 'var(--v-ink)', letterSpacing: '-.02em', marginTop: 10 }}>Um painel para cada frente do posto</h2>
            <p style={{ margin: '16px 0 0', fontSize: 17, lineHeight: 1.6, color: 'var(--v-muted2)' }}>Ative só o que sua rede usa. Tudo conversa entre si e alimenta o mesmo analista de IA.</p>
          </div>
          <div className="v360-modulos" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, marginTop: 48 }}>
            {MODULOS.map((m) => (
              <div key={m.titulo} style={card}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{m.icon}</div>
                <h3 style={{ fontSize: 19, fontWeight: 800, color: 'var(--v-ink)', marginTop: 16 }}>{m.titulo}</h3>
                <p style={{ margin: '8px 0 0', fontSize: 14.5, lineHeight: 1.55, color: 'var(--v-muted2)' }}>{m.texto}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ===================== DESTAQUE IA ===================== */}
        <div id="ia" style={{ marginTop: 96, background: 'radial-gradient(1100px 620px at 78% 0%,#22456b 0%,#16293f 55%,#101f31 100%)' }}>
          <div className="v360-ia v360-wrap" style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(252,182,25,.14)', border: '1px solid rgba(252,182,25,.4)', color: '#fcd77f', fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 999 }}>✨ Analista de IA</div>
              <h2 style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.08, color: '#fff', letterSpacing: '-.02em', marginTop: 20 }}>O número que importa, já explicado.</h2>
              <p style={{ margin: '18px 0 0', fontSize: 17.5, lineHeight: 1.6, color: '#cbd5e1', maxWidth: 480 }}>Em vez de você caçar o problema na planilha, o Visor360 lê os dados da rede e escreve, em português, onde está a perda e quanto ela vale — pronto pra decidir.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 30 }}>
                {IA_BULLETS.map((b) => (
                  <div key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}><span style={{ color: '#5eead4', fontSize: 18, lineHeight: 1.3 }}>✓</span><span style={{ color: '#e2e8f0', fontSize: 15.5, lineHeight: 1.5 }}>{b}</span></div>
                ))}
              </div>
            </div>
            <div style={{ background: '#fff', borderRadius: 18, padding: 26, boxShadow: '0 50px 90px -40px rgba(0,0,0,.6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingBottom: 16, borderBottom: '1px solid #eef2f7' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#FCB619,#f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>✨</div>
                <div><div style={{ fontWeight: 800, fontSize: 14, color: '#16293f', fontFamily: "'Bricolage Grotesque',sans-serif" }}>Analista Visor360</div><div style={{ fontSize: 11.5, color: '#94a3b8' }}>Rede Aurora · 5 postos</div></div>
              </div>
              <div style={{ marginTop: 16, background: '#f8fafc', borderRadius: 12, padding: '15px 16px', fontSize: 14, color: '#334155', lineHeight: 1.55 }}>
                O <strong>diesel S-10 do posto Aurora Centro</strong> está R$ 0,21/L abaixo da média da rede. Alinhando ao preço dos outros 4 postos, o ganho estimado é de <strong style={{ color: '#15803d' }}>+R$ 14,2 mil/mês</strong> sem perder competitividade local.
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <div style={{ flex: 1, background: '#ecfdf5', borderRadius: 11, padding: '12px 14px' }}><div style={{ fontSize: 11, color: '#059669' }}>Ganho estimado</div><div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 18, color: '#047857' }} className="tnum">+R$ 14,2k</div></div>
                <div style={{ flex: 1, background: '#eff6ff', borderRadius: 11, padding: '12px 14px' }}><div style={{ fontSize: 11, color: '#2563eb' }}>Diferença/L</div><div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 18, color: '#1d4ed8' }} className="tnum">R$ 0,21</div></div>
              </div>
            </div>
          </div>
        </div>

        {/* ===================== NÚMEROS DA REDE ===================== */}
        <div className="v360-wrap" style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 40px 0' }}>
          <div className="v360-numeros" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20, textAlign: 'center' }}>
            {NUMEROS.map((n) => (
              <div key={n.label} style={{ padding: '8px 0' }}><div className="v360-num" style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 44, color: n.cor, letterSpacing: '-.02em' }}>{n.valor}</div><div style={{ fontSize: 14, color: 'var(--v-muted2)', marginTop: 4 }}>{n.label}</div></div>
            ))}
          </div>
        </div>

        {/* ===================== PLANOS ===================== */}
        <div id="planos" className="v360-wrap" style={{ maxWidth: 1200, margin: '0 auto', padding: '88px 40px 0' }}>
          <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
            <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: '#0F766E' }}>Plano</div>
            <h2 style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1, color: 'var(--v-ink)', letterSpacing: '-.02em', marginTop: 10 }}>Um plano. Tudo liberado.</h2>
            <p style={{ margin: '16px 0 0', fontSize: 17, lineHeight: 1.6, color: 'var(--v-muted2)' }}>Todos os módulos e o app no celular num plano só. O Analista de IA entra como opcional, quando você quiser.</p>
            <Link to="/como-comecar" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, fontSize: 14.5, fontWeight: 700, color: '#0F766E' }}>Como começar — veja o passo a passo →</Link>
          </div>

          <div style={{ maxWidth: 470, margin: '48px auto 0' }}>
            <div style={{ position: 'relative', background: 'linear-gradient(160deg,#1c3a5c 0%,#16293f 100%)', border: '1px solid #24476e', borderRadius: 22, padding: '36px 32px 30px', boxShadow: '0 44px 80px -34px rgba(15,41,63,.6)', color: '#fff', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'absolute', top: 18, right: 18, background: 'rgba(252,182,25,.16)', border: '1px solid rgba(252,182,25,.5)', color: '#fcd77f', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '5px 11px', borderRadius: 999 }}>Tudo incluído</div>
              <h3 style={{ fontSize: 26, fontWeight: 800, color: '#fff', fontFamily: "'Bricolage Grotesque',sans-serif" }}>Visor360 Completo</h3>
              <p style={{ margin: '8px 0 0', fontSize: 14.5, lineHeight: 1.5, color: '#cbd5e1' }}>Tudo da plataforma: combustível, loja, operação e financeiro.</p>

              <div style={{ margin: '22px 0 4px', paddingBottom: 22, borderBottom: '1px solid rgba(255,255,255,.12)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                  <span className="tnum" style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 46, color: '#fff', letterSpacing: '-.02em' }}>R$ 199,99</span>
                  <span style={{ fontSize: 15, color: '#93a7c4', fontWeight: 600 }}>/mês</span>
                </div>
                <div style={{ fontSize: 12.5, color: '#93a7c4', marginTop: 4 }}>todas as funções liberadas, sem pacote extra</div>
              </div>

              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fcd77f', marginTop: 18 }}>Tudo o que está incluído:</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                {FUNCOES_BASE.map((r) => (
                  <li key={r} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13.5, lineHeight: 1.45, color: '#dbe4ef' }}>
                    <span style={{ color: '#5eead4', fontSize: 14, lineHeight: 1.35, flexShrink: 0 }}>✓</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>

              <Link to="/como-comecar" style={{ background: '#FCB619', color: '#16293f', fontWeight: 700, fontSize: 15.5, padding: '15px 20px', borderRadius: 12, textAlign: 'center', boxShadow: '0 16px 34px -14px rgba(252,182,25,.7)', display: 'block', width: '100%', marginTop: 26 }}>Quero assinar</Link>
            </div>

            {/* Add-on: Analista de IA — vendido à parte */}
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 14, background: 'var(--v-card)', border: '1px solid var(--v-border)', borderRadius: 16, padding: '16px 18px', boxShadow: '0 20px 40px -34px rgba(15,41,63,.4)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#FCB619,#f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Sparkles size={20} color="#16293f" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--v-ink)', fontFamily: "'Bricolage Grotesque',sans-serif" }}>Analista de IA</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--v-muted)', background: 'var(--v-soft)', border: '1px solid var(--v-border2)', padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '.04em' }}>Opcional</span>
                </div>
                <p style={{ margin: '3px 0 0', fontSize: 12.5, lineHeight: 1.4, color: 'var(--v-muted2)' }}>A Inteligência que explica o número e aponta onde está a perda.</p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 18, color: 'var(--v-ink)' }}>+R$ 70</div>
                <div style={{ fontSize: 11, color: 'var(--v-faint)' }}>/mês</div>
              </div>
            </div>
          </div>

          <p style={{ textAlign: 'center', margin: '22px 0 0', fontSize: 13.5, color: 'var(--v-faint)' }}>O plano conecta ao seu ERP de posto, com dados só de leitura. A liberação é feita pela equipe da CCI.</p>
        </div>

        {/* ===================== DOIS PÚBLICOS ===================== */}
        <div className="v360-wrap" style={{ maxWidth: 1200, margin: '0 auto', padding: '88px 40px 0' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', background: 'var(--v-soft)', border: '1px solid var(--v-border)', borderRadius: 22, padding: '42px 36px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 12.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#0F766E' }}>Para donos de rede</div>
            <h3 style={{ fontSize: 28, fontWeight: 800, color: 'var(--v-ink)', marginTop: 12, lineHeight: 1.15 }}>Pare de fechar o mês no escuro</h3>
            <p style={{ margin: '12px auto 0', fontSize: 16, lineHeight: 1.6, color: 'var(--v-muted2)', maxWidth: 520 }}>Acompanhe cada posto sem depender de planilha manual. O Visor360 mostra onde o lucro está escapando e o que fazer a respeito — hoje, não no fim do mês. Tudo por <strong style={{ color: 'var(--v-ink)' }}>R$ 199,99/mês</strong>.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
              <Link to="/como-comecar" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#FCB619', color: '#16293f', fontWeight: 700, fontSize: 15, padding: '13px 24px', borderRadius: 12 }}>Assinar agora →</Link>
              <a href={MAIL.demo} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--v-card)', border: '1px solid var(--v-border2)', color: 'var(--v-ink)', fontWeight: 600, fontSize: 15, padding: '13px 22px', borderRadius: 12 }}>Agendar demonstração</a>
            </div>
          </div>
        </div>

        {/* ===================== CTA FINAL ===================== */}
        <div className="v360-wrap" style={{ maxWidth: 1200, margin: '88px auto 0', padding: '0 40px' }}>
          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 26, background: 'linear-gradient(135deg,#0b5c55 0%,#0F766E 55%,#12897f 100%)', padding: '64px 48px', textAlign: 'center' }}>
            <div style={{ position: 'absolute', top: -100, right: -60, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(252,182,25,.3) 0%,rgba(252,182,25,0) 70%)' }} />
            <div style={{ position: 'relative' }}>
              <h2 style={{ fontSize: 38, fontWeight: 800, color: '#fff', letterSpacing: '-.02em', lineHeight: 1.1 }}>Veja a sua rede no Visor360</h2>
              <p style={{ margin: '14px auto 0', fontSize: 17, lineHeight: 1.6, color: '#e3fbf6', maxWidth: 520 }}>Uma demonstração rápida com os seus próprios números. Sem compromisso.</p>
              <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 30, flexWrap: 'wrap' }}>
                <a href={MAIL.demo} style={{ background: '#FCB619', color: '#16293f', fontWeight: 700, fontSize: 16, padding: '16px 32px', borderRadius: 13, boxShadow: '0 18px 38px -14px rgba(0,0,0,.4)' }}>Agendar demonstração</a>
                <a href={MAIL.falar} style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.3)', color: '#fff', fontWeight: 600, fontSize: 16, padding: '16px 28px', borderRadius: 13 }}>Falar com a CCI</a>
              </div>
            </div>
          </div>
        </div>

        {/* ===================== RODAPÉ CCI ===================== */}
        <div id="contato" style={{ marginTop: 80, borderTop: '1px solid var(--v-hair)' }}>
          <div className="v360-wrap" style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 40px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 40, flexWrap: 'wrap' }}>
            <div style={{ maxWidth: 320 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src="/landing/SIMBOLO.png" style={{ width: 30, height: 30, objectFit: 'contain' }} alt="" />
                <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 20, color: 'var(--v-ink)' }}>Visor<span style={{ color: '#0F766E' }}>360</span></div>
              </div>
              <p style={{ margin: '14px 0 0', fontSize: 13.5, lineHeight: 1.6, color: 'var(--v-faint)' }}>Gestão inteligente para redes de postos. Uma solução CCI.</p>
              <a href="https://www.cci.app.br" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 14, background: 'rgba(15,118,110,.1)', border: '1px solid rgba(15,118,110,.3)', color: '#0F766E', fontWeight: 700, fontSize: 13.5, padding: '9px 15px', borderRadius: 10 }}>Conheça a CCI · www.cci.app.br ↗</a>
            </div>
            <div style={{ display: 'flex', gap: 56, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--v-ink)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Produto</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14, fontSize: 14, color: 'var(--v-muted2)' }}>
                  <a href="#modulos" style={{ color: 'inherit' }}>Módulos</a><a href="#planos" style={{ color: 'inherit' }}>Planos</a><a href="#ia" style={{ color: 'inherit' }}>Analista de IA</a><a href="/como-comecar" style={{ color: 'inherit' }}>Como começar</a>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--v-ink)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Contato</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14, fontSize: 14, color: 'var(--v-muted2)' }}>
                  <a href={MAIL.demo} style={{ color: 'inherit' }}>Agendar demonstração</a><a href={MAIL.suporte} style={{ color: 'inherit' }}>Suporte</a><a href={MAIL.email} style={{ color: 'inherit' }}>comercial@cci.app.br</a>
                </div>
              </div>
            </div>
          </div>
          <div className="v360-wrap" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 40px', fontSize: 12.5, color: 'var(--v-faint)' }}>© 2026 CCI · Visor360. Todos os direitos reservados.</div>
        </div>

      </div>

      <LeadChat />
    </div>
  )
}

export default Landing
