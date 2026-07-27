import { type CSSProperties, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { setUiScaleSuspended } from '@/lib/uiScale'

/**
 * Landing institucional do Visor360 — a "capa" pública do app (rota `/`).
 *
 * Reproduz fielmente a peça aprovada da CCI (marca teal #0F766E + âmbar #FCB619,
 * fontes Bricolage Grotesque + Instrument Sans). NÃO redesenhar: textos, cores e
 * layout são a peça oficial. As fontes do Google carregam só aqui (injetadas no
 * mount e removidas no unmount), pra não pesar no resto do app. Um usuário já
 * logado que abre a raiz é mandado direto pro painel — a landing é pra visitante.
 */

const MAIL = {
  demo: 'mailto:comercial@cci.app.br?subject=Agendar%20demonstra%C3%A7%C3%A3o%20Visor360',
  rep: 'mailto:comercial@cci.app.br?subject=Quero%20ser%20representante%20Visor360',
  falar: 'mailto:comercial@cci.app.br?subject=Falar%20com%20a%20CCI%20-%20Visor360',
  suporte: 'mailto:comercial@cci.app.br?subject=Suporte%20Visor360',
  email: 'mailto:comercial@cci.app.br',
}

const MODULOS: { icon: string; bg: string; titulo: string; texto: string }[] = [
  { icon: '🗺️', bg: '#eef4ff', titulo: 'Visão Geral da Rede', texto: 'Faturamento, lucro e margem de todos os postos num só lugar, com projeção do período por setor.' },
  { icon: '⛽', bg: '#fef4e2', titulo: 'Combustível', texto: 'Volume, margem por produto e gestão de preços por tabela — com o impacto real do desconto no lucro bruto.' },
  { icon: '🛒', bg: '#eafaf1', titulo: 'Conveniência', texto: 'Desempenho da loja, ticket médio e giro — separando o que vem da pista do que vem do balcão.' },
  { icon: '🔧', bg: '#f0edff', titulo: 'Automotivos', texto: 'Troca de óleo e serviços agregados acompanhados junto do resto da operação do posto.' },
  { icon: '💳', bg: '#e7f6f4', titulo: 'Cartões · Conciliação', texto: 'Cruza o que a maquininha registrou com o que caiu na conta e aponta divergência e taxa cobrada a mais.' },
  { icon: '📊', bg: '#fdeef0', titulo: 'Apuração & Financeiro', texto: 'Fechamento diário automático e qualidade dos dados, sinalizando onde a informação está faltando.' },
]

const NUMEROS: { valor: string; cor: string; label: string }[] = [
  { valor: '6', cor: '#16293f', label: 'módulos num só login' },
  { valor: '1×/dia', cor: '#0F766E', label: 'apuração automática' },
  { valor: '100%', cor: '#16293f', label: 'dados só de leitura' },
  { valor: 'web+app', cor: '#2563eb', label: 'rede no bolso' },
]

const IA_BULLETS = [
  'Compara posto a posto e destaca quem está fora da curva',
  'Estima o ganho potencial de cada ajuste em reais',
  'Só leitura: a IA analisa, quem decide é você',
]

const TRUST = ['Conecta ao seu ERP de posto', 'Apuração automática diária', 'Dados só de leitura', 'Acesso web e celular']

// CSS scoped em `.v360-landing` — não vaza pro app. Inclui as fontes da marca,
// o floaty do mockup e a responsividade mínima (empilha os grids no celular sem
// mudar o layout desktop da peça).
const LANDING_CSS = `
.v360-landing{font-family:'Instrument Sans',system-ui,sans-serif;color:#0f172a;background:#fff;-webkit-font-smoothing:antialiased;min-height:100vh}
.v360-landing h1,.v360-landing h2,.v360-landing h3{font-family:'Bricolage Grotesque','Instrument Sans',sans-serif;margin:0}
.v360-landing a{text-decoration:none}
.v360-landing .tnum{font-variant-numeric:tabular-nums}
@keyframes v360-floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@media(max-width:980px){
  .v360-landing .v360-hero{grid-template-columns:1fr!important}
  .v360-landing .v360-heromock{min-height:480px}
  .v360-landing .v360-ia{grid-template-columns:1fr!important;gap:36px!important}
  .v360-landing .v360-publicos{grid-template-columns:1fr!important}
  .v360-landing .v360-modulos{grid-template-columns:repeat(2,1fr)!important}
  .v360-landing .v360-h1{font-size:44px!important}
}
@media(max-width:640px){
  .v360-landing .v360-modulos{grid-template-columns:1fr!important}
  .v360-landing .v360-numeros{grid-template-columns:repeat(2,1fr)!important}
  .v360-landing .v360-navmenu{display:none!important}
  .v360-landing .v360-nav{justify-content:center!important}
  .v360-landing .v360-h1{font-size:34px!important}
  .v360-landing .v360-wrap{padding-left:20px!important;padding-right:20px!important}
  .v360-landing .v360-heropad{padding:40px 24px 44px!important}
}
`

const card: CSSProperties = { background: '#fff', border: '1px solid #e9eef4', borderRadius: 18, padding: '26px 24px', boxShadow: '0 20px 40px -34px rgba(15,41,63,.4)' }

const Landing = () => {
  const session = useAuthStore((s) => s.session)

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
            <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 23, color: '#16293f', letterSpacing: '-.01em' }}>Visor<span style={{ color: '#0F766E' }}>360</span></div>
          </div>
          <div className="v360-navmenu" style={{ display: 'flex', alignItems: 'center', gap: 28, color: '#475569', fontSize: 14.5, fontWeight: 500, flexWrap: 'wrap' }}>
            <a href="#modulos" style={{ color: '#475569' }}>Módulos</a>
            <a href="#ia" style={{ color: '#475569' }}>Analista de IA</a>
            <a href="#representantes" style={{ color: '#475569' }}>Para representantes</a>
            <a href="#contato" style={{ color: '#475569' }}>Contato</a>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link to="/login" style={{ color: '#16293f', fontSize: 14.5, fontWeight: 600 }}>Entrar</Link>
            <a href={MAIL.demo} style={{ background: '#16293f', color: '#fff', fontWeight: 600, fontSize: 14.5, padding: '11px 20px', borderRadius: 11 }}>Agendar demonstração</a>
          </div>
        </div>

        {/* ===================== HERO ===================== */}
        <div className="v360-wrap" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px' }}>
          <div className="v360-hero" style={{ display: 'grid', gridTemplateColumns: '1fr 1.05fr', gap: 0, alignItems: 'stretch', marginTop: 20, borderRadius: 26, overflow: 'hidden', boxShadow: '0 40px 90px -46px rgba(15,41,63,.4)' }}>
            <div className="v360-heropad" style={{ padding: '56px 46px 60px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#fff' }}>
              <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 8, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#0f766e', fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 999, marginBottom: 22 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#14b8a6', display: 'inline-block' }} /> Analista de IA integrado
              </div>
              <h1 className="v360-h1" style={{ fontSize: 58, fontWeight: 800, lineHeight: 1.0, color: '#16293f', letterSpacing: '-.025em' }}>Menos planilha.<br />Mais lucro.</h1>
              <p style={{ margin: '22px 0 0', fontSize: 18, lineHeight: 1.6, color: '#475569', maxWidth: 470 }}>O Visor360 conecta ao seu sistema, cruza os números de toda a rede e transforma dado bruto em decisão — combustível, loja, cartões e financeiro num só lugar.</p>
              <div style={{ display: 'flex', gap: 14, marginTop: 34, flexWrap: 'wrap' }}>
                <a href={MAIL.demo} style={{ background: '#FCB619', color: '#16293f', fontWeight: 700, fontSize: 16, padding: '15px 28px', borderRadius: 13, boxShadow: '0 16px 34px -14px rgba(252,182,25,.8)' }}>Agendar demonstração</a>
                <a href="#modulos" style={{ background: '#fff', border: '1.5px solid #e2e8f0', color: '#16293f', fontWeight: 600, fontSize: 16, padding: '15px 26px', borderRadius: 13 }}>Conhecer os módulos</a>
              </div>
              <div style={{ display: 'flex', gap: 24, marginTop: 40, flexWrap: 'wrap' }}>
                <div><div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 27, color: '#16293f' }}>6</div><div style={{ fontSize: 13, color: '#64748b' }}>módulos integrados</div></div>
                <div style={{ width: 1, background: '#e2e8f0' }} />
                <div><div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 27, color: '#16293f' }}>tempo real</div><div style={{ fontSize: 13, color: '#64748b' }}>por posto</div></div>
                <div style={{ width: 1, background: '#e2e8f0' }} />
                <div><div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 27, color: '#0F766E' }}>read-only</div><div style={{ fontSize: 13, color: '#64748b' }}>a IA não altera valor</div></div>
              </div>
            </div>

            <div className="v360-heromock" style={{ position: 'relative', background: 'radial-gradient(900px 560px at 60% 20%,#22456b 0%,#16293f 60%,#101f31 100%)', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -80, right: -60, width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle,rgba(252,182,25,.25) 0%,rgba(252,182,25,0) 70%)' }} />
              <div style={{ position: 'relative', padding: '52px 44px 60px' }}>
                <div style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 40px 80px -30px rgba(0,0,0,.6)', border: '1px solid rgba(255,255,255,.12)', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 13px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f87171' }} />
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fbbf24' }} />
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#34d399' }} />
                  </div>
                  <img src="/landing/analise-semanal-full.png" style={{ display: 'block', width: '100%' }} alt="Análise semanal Visor360" />
                </div>
                <div style={{ position: 'absolute', bottom: 22, left: 26, width: 168, height: 344, background: '#0f172a', borderRadius: 28, padding: 7, boxShadow: '0 40px 70px -24px rgba(0,0,0,.6)', animation: 'v360-floaty 7s ease-in-out infinite' }}>
                  <div style={{ width: '100%', height: '100%', background: '#16293f', borderRadius: 22, overflow: 'hidden', padding: '14px 12px', color: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><img src="/landing/SIMBOLO.png" style={{ width: 16, height: 16, objectFit: 'contain' }} alt="" /><span style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 12 }}>Visor<span style={{ color: '#FCB619' }}>360</span></span></div>
                    <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: 12, padding: 11, marginTop: 14 }}>
                      <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em' }}>Lucro hoje</div>
                      <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 20 }} className="tnum">R$ 48,9k</div>
                      <div style={{ fontSize: 10, color: '#5eead4' }}>▲ 12%</div>
                    </div>
                    <div style={{ background: '#fff', color: '#0f172a', borderRadius: 12, padding: 10, marginTop: 9, borderLeft: '3px solid #FCB619' }}>
                      <div style={{ fontSize: 8.5, fontWeight: 700, color: '#b45309' }}>✨ IA</div>
                      <div style={{ fontSize: 9.5, color: '#334155', lineHeight: 1.35, marginTop: 3 }}>Itapoá R$0,21 abaixo da rede</div>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 36, flexWrap: 'wrap', color: '#94a3b8', fontSize: 13.5, fontWeight: 600, letterSpacing: '.02em' }}>
            {TRUST.map((t, i) => (
              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 36 }}>
                {i > 0 && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#cbd5e1' }} />}
                <span>{t}</span>
              </span>
            ))}
          </div>
        </div>

        {/* ===================== MÓDULOS ===================== */}
        <div id="modulos" className="v360-wrap" style={{ maxWidth: 1200, margin: '0 auto', padding: '88px 40px 0' }}>
          <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
            <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: '#0F766E' }}>Módulos</div>
            <h2 style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1, color: '#16293f', letterSpacing: '-.02em', marginTop: 10 }}>Um painel para cada frente do posto</h2>
            <p style={{ margin: '16px 0 0', fontSize: 17, lineHeight: 1.6, color: '#64748b' }}>Ative só o que sua rede usa. Tudo conversa entre si e alimenta o mesmo analista de IA.</p>
          </div>
          <div className="v360-modulos" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, marginTop: 48 }}>
            {MODULOS.map((m) => (
              <div key={m.titulo} style={card}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{m.icon}</div>
                <h3 style={{ fontSize: 19, fontWeight: 800, color: '#16293f', marginTop: 16 }}>{m.titulo}</h3>
                <p style={{ margin: '8px 0 0', fontSize: 14.5, lineHeight: 1.55, color: '#64748b' }}>{m.texto}</p>
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
                <div><div style={{ fontWeight: 800, fontSize: 14, color: '#16293f', fontFamily: "'Bricolage Grotesque',sans-serif" }}>Analista Visor360</div><div style={{ fontSize: 11.5, color: '#94a3b8' }}>Rede AutoBem · 5 postos</div></div>
              </div>
              <div style={{ marginTop: 16, background: '#f8fafc', borderRadius: 12, padding: '15px 16px', fontSize: 14, color: '#334155', lineHeight: 1.55 }}>
                O <strong>diesel S-10 do posto Itapoá</strong> está R$ 0,21/L abaixo da média da rede. Alinhando ao preço dos outros 4 postos, o ganho estimado é de <strong style={{ color: '#15803d' }}>+R$ 14,2 mil/mês</strong> sem perder competitividade local.
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
              <div key={n.label} style={{ padding: '8px 0' }}><div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 44, color: n.cor, letterSpacing: '-.02em' }}>{n.valor}</div><div style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>{n.label}</div></div>
            ))}
          </div>
        </div>

        {/* ===================== DOIS PÚBLICOS ===================== */}
        <div className="v360-wrap" style={{ maxWidth: 1200, margin: '0 auto', padding: '88px 40px 0' }}>
          <div className="v360-publicos" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div style={{ background: '#f6f8fb', border: '1px solid #e9eef4', borderRadius: 22, padding: '38px 34px' }}>
              <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 12.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#0F766E' }}>Para donos de rede</div>
              <h3 style={{ fontSize: 26, fontWeight: 800, color: '#16293f', marginTop: 12, lineHeight: 1.15 }}>Pare de fechar o mês no escuro</h3>
              <p style={{ margin: '12px 0 0', fontSize: 15.5, lineHeight: 1.6, color: '#64748b' }}>Acompanhe cada posto sem depender de planilha manual. O Visor360 mostra onde o lucro está escapando e o que fazer a respeito — hoje, não no fim do mês.</p>
              <a href={MAIL.demo} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 22, background: '#16293f', color: '#fff', fontWeight: 600, fontSize: 15, padding: '13px 22px', borderRadius: 12 }}>Agendar demonstração →</a>
            </div>
            <div id="representantes" style={{ background: '#16293f', borderRadius: 22, padding: '38px 34px', color: '#fff' }}>
              <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 12.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#FCB619' }}>Para representantes</div>
              <h3 style={{ fontSize: 26, fontWeight: 800, marginTop: 12, lineHeight: 1.15 }}>Venda, cadastre e libere planos você mesmo</h3>
              <p style={{ margin: '12px 0 0', fontSize: 15.5, lineHeight: 1.6, color: '#cbd5e1' }}>Um painel comercial próprio pra apresentar os planos, cadastrar o novo cliente e liberar o acesso na hora — sem depender de ninguém pra fechar a venda.</p>
              <a href={MAIL.rep} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 22, background: '#FCB619', color: '#16293f', fontWeight: 700, fontSize: 15, padding: '13px 22px', borderRadius: 12 }}>Quero ser representante →</a>
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
        <div id="contato" style={{ marginTop: 80, borderTop: '1px solid #eef2f7' }}>
          <div className="v360-wrap" style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 40px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 40, flexWrap: 'wrap' }}>
            <div style={{ maxWidth: 320 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src="/landing/SIMBOLO.png" style={{ width: 30, height: 30, objectFit: 'contain' }} alt="" />
                <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 20, color: '#16293f' }}>Visor<span style={{ color: '#0F766E' }}>360</span></div>
              </div>
              <p style={{ margin: '14px 0 0', fontSize: 13.5, lineHeight: 1.6, color: '#94a3b8' }}>Gestão inteligente para redes de postos. Uma solução CCI.</p>
            </div>
            <div style={{ display: 'flex', gap: 56, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#16293f', textTransform: 'uppercase', letterSpacing: '.08em' }}>Produto</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14, fontSize: 14, color: '#64748b' }}>
                  <a href="#modulos" style={{ color: 'inherit' }}>Módulos</a><a href="#ia" style={{ color: 'inherit' }}>Analista de IA</a><a href="#representantes" style={{ color: 'inherit' }}>Para representantes</a>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#16293f', textTransform: 'uppercase', letterSpacing: '.08em' }}>Contato</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14, fontSize: 14, color: '#64748b' }}>
                  <a href={MAIL.demo} style={{ color: 'inherit' }}>Agendar demonstração</a><a href={MAIL.suporte} style={{ color: 'inherit' }}>Suporte</a><a href={MAIL.email} style={{ color: 'inherit' }}>comercial@cci.app.br</a>
                </div>
              </div>
            </div>
          </div>
          <div className="v360-wrap" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 40px', fontSize: 12.5, color: '#b0bac7' }}>© 2026 CCI · Visor360. Todos os direitos reservados.</div>
        </div>

      </div>
    </div>
  )
}

export default Landing
