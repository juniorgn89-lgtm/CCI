import { useEffect, useRef, useState } from 'react'
import { MessageCircle, X, Send, Sparkles, Loader2, ChevronRight } from 'lucide-react'
import { insertLandingLead, type NovoLead } from '@/api/supabase/leads'
import { useAppConfig } from '@/hooks/useAppConfig'

/**
 * Chat de captação de leads da landing (scriptado). Balão flutuante que abre uma
 * conversa e coleta os dados um passo por vez; ao final grava em `landing_leads`
 * (Supabase, insert público) e oferece um botão de WhatsApp pro comercial. Sem
 * IA e sem backend — fluxo fixo. Renderiza dentro de `.v360-landing` (herda tokens).
 *
 * O "aviso automático" pro comercial (mensagem disparada sozinha) exige uma Edge
 * Function + API de WhatsApp — fica pra uma fase 2.
 */

type Campo = keyof NovoLead

interface Passo {
  key: Campo
  bot: string[]
  tipo: 'text' | 'tel' | 'email' | 'choices'
  placeholder?: string
  choices?: string[]
  opcional?: boolean
}

const PASSOS: Passo[] = [
  { key: 'nome', bot: ['Olá! 👋 Bora ver o Visor360 na sua rede?', 'Pra começar, como é o seu nome?'], tipo: 'text', placeholder: 'Seu nome' },
  { key: 'rede', bot: ['Prazer, {nome}! Qual o nome do posto ou rede?'], tipo: 'text', placeholder: 'Nome do posto / rede' },
  { key: 'cidade', bot: ['Em qual cidade fica?'], tipo: 'text', placeholder: 'Cidade' },
  { key: 'sistema', bot: ['Qual sistema (ERP) vocês usam hoje?'], tipo: 'choices', choices: ['WebPosto', 'AutoSystem', 'Outro', 'Não sei'] },
  { key: 'whatsapp', bot: ['Qual o seu WhatsApp? (com DDD)'], tipo: 'tel', placeholder: '(27) 99999-9999' },
  { key: 'email', bot: ['Por último, um e-mail pra contato (opcional).'], tipo: 'email', placeholder: 'seu@email.com', opcional: true },
]

interface Msg { from: 'bot' | 'user'; text: string }

const Avatar = () => (
  <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#0F766E,#14b8a6)', color: '#fff' }}>
    <img src="/landing/SIMBOLO.png" alt="" style={{ width: 16, height: 16, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
  </span>
)

const LeadChat = () => {
  const cfg = useAppConfig()
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<NovoLead>({ nome: '', rede: '', cidade: '', sistema: '', whatsapp: '', email: '' })
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const pushBot = (nome: string, texts: string[]) =>
    setMsgs((m) => [...m, ...texts.map((t) => ({ from: 'bot' as const, text: t.replace('{nome}', nome) }))])

  // Semeia as 1as mensagens ao abrir pela 1a vez.
  useEffect(() => {
    if (open && msgs.length === 0 && !done) pushBot('', PASSOS[0].bot)
  }, [open, msgs.length, done])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, sending])

  const finalizar = async (final: NovoLead) => {
    setSending(true)
    try {
      await insertLandingLead(final)
    } catch {
      // Mesmo se falhar (tabela ausente/RLS), seguimos — o lead ainda fala via WhatsApp.
    }
    setSending(false)
    setDone(true)
    pushBot(final.nome, [
      `Perfeito, ${final.nome || 'tudo certo'}! ✅ Recebi seus dados — nosso time da CCI vai falar com você.`,
      'Se quiser adiantar, é só chamar no WhatsApp aqui embaixo. 👇',
    ])
  }

  const responder = (valor: string) => {
    const passo = PASSOS[step]
    const v = valor.trim()
    if (!v && !passo.opcional) return
    setMsgs((m) => [...m, { from: 'user', text: v || '—' }])
    const next: NovoLead = { ...answers, [passo.key]: v }
    setAnswers(next)
    setInput('')
    const ni = step + 1
    if (ni < PASSOS.length) {
      setStep(ni)
      pushBot(next.nome, PASSOS[ni].bot)
    } else {
      void finalizar(next)
    }
  }

  const passoAtual = PASSOS[step]
  const waMsg = `Olá! Sou ${answers.nome}, do ${answers.rede || 'meu posto'}${answers.cidade ? ` (${answers.cidade})` : ''}. Tenho interesse no Visor360.`
  const waLink = cfg.comercialWhatsapp
    ? `https://wa.me/${cfg.comercialWhatsapp}?text=${encodeURIComponent(waMsg)}`
    : `mailto:comercial@cci.app.br?subject=${encodeURIComponent('Interesse no Visor360')}&body=${encodeURIComponent(waMsg)}`

  return (
    <>
      {/* Painel */}
      {open && (
        <div style={{ position: 'fixed', bottom: 88, right: 20, zIndex: 1200, width: 'min(370px,calc(100vw - 32px))', height: 'min(560px,calc(100dvh - 130px))', display: 'flex', flexDirection: 'column', background: 'var(--v-card)', border: '1px solid var(--v-border)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 40px 90px -30px rgba(0,0,0,.55)' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '13px 15px', background: 'radial-gradient(600px 200px at 20% 0%,#22456b,#16293f)', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Avatar />
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 14 }}>Visor<span style={{ color: '#FCB619' }}>360</span> · Atendimento</div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.7)' }}>Responde em minutos</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fechar" style={{ display: 'inline-flex', padding: 5, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,.1)', color: '#fff', cursor: 'pointer' }}><X size={16} /></button>
          </div>

          {/* Mensagens */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, flexDirection: m.from === 'user' ? 'row-reverse' : 'row' }}>
                {m.from === 'bot' && <Avatar />}
                <div style={{ maxWidth: '80%', fontSize: 13.5, lineHeight: 1.45, padding: '9px 12px', borderRadius: 14, background: m.from === 'user' ? '#0F766E' : 'var(--v-bg)', color: m.from === 'user' ? '#fff' : 'var(--v-ink)', border: m.from === 'user' ? 'none' : '1px solid var(--v-border2)' }}>{m.text}</div>
              </div>
            ))}
            {sending && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--v-faint)', fontSize: 12.5 }}><Avatar /> <Loader2 size={14} className="animate-spin" /> enviando…</div>
            )}
          </div>

          {/* Entrada / ações */}
          <div style={{ borderTop: '1px solid var(--v-hair)', padding: 12 }}>
            {done ? (
              <a href={waLink} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: '#128c3e', color: '#fff', fontWeight: 700, fontSize: 14, padding: '12px', borderRadius: 11 }}>
                <MessageCircle size={16} /> Falar agora no WhatsApp
              </a>
            ) : passoAtual?.tipo === 'choices' ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {passoAtual.choices!.map((c) => (
                  <button key={c} onClick={() => responder(c)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 13px', borderRadius: 999, border: '1px solid var(--v-border2)', background: 'var(--v-bg)', color: 'var(--v-ink)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {c} <ChevronRight size={13} style={{ color: 'var(--v-faint)' }} />
                  </button>
                ))}
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); responder(input) }} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  autoFocus
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  type={passoAtual?.tipo === 'email' ? 'email' : passoAtual?.tipo === 'tel' ? 'tel' : 'text'}
                  placeholder={passoAtual?.placeholder}
                  style={{ flex: 1, minWidth: 0, borderRadius: 11, border: '1px solid var(--v-border2)', background: 'var(--v-bg)', color: 'var(--v-ink)', fontSize: 13.5, padding: '11px 13px', outline: 'none' }}
                />
                {passoAtual?.opcional && !input.trim() ? (
                  <button type="button" onClick={() => responder('')} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--v-muted)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>Pular</button>
                ) : (
                  <button type="submit" disabled={!input.trim()} aria-label="Enviar" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 11, border: 'none', background: input.trim() ? '#0F766E' : 'var(--v-border2)', color: '#fff', cursor: input.trim() ? 'pointer' : 'default' }}><Send size={16} /></button>
                )}
              </form>
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
        {open ? <X size={22} /> : <><MessageCircle size={20} /> Fale com a gente <Sparkles size={15} style={{ color: '#FCB619' }} /></>}
      </button>
    </>
  )
}

export default LeadChat
