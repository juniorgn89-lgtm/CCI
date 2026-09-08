import { type CSSProperties, useEffect, useState } from 'react'
import { getInstallPrompt, clearInstallPrompt, subscribeInstall } from '@/lib/pwaInstall'

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

/**
 * Opção MANUAL de instalar o app, na landing (ao lado do "Acessar"). Aqui não
 * há popup automático — o visitante clica se quiser. Android/Chrome desktop:
 * instala na hora (evento capturado no boot). iPhone/navegador sem suporte:
 * abre o passo a passo. Some se já estiver rodando instalado.
 */
const LandingInstallButton = () => {
  const [, force] = useState(0)
  const [help, setHelp] = useState(false)
  useEffect(() => subscribeInstall(() => force((n) => n + 1)), [])

  if (isStandalone()) return null

  const onClick = async () => {
    const p = getInstallPrompt()
    if (p) {
      await p.prompt()
      await p.userChoice
      clearInstallPrompt()
      return
    }
    setHelp(true)
  }

  const btn: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: '#fff',
    border: '1.5px solid #0F766E',
    color: '#0F766E',
    fontWeight: 700,
    fontSize: 14.5,
    padding: '9px 16px',
    borderRadius: 11,
    cursor: 'pointer',
  }

  return (
    <>
      <button type="button" onClick={onClick} title="Instalar o app no celular" style={btn}>
        📲 Baixe o app
      </button>
      {help && <InstructionsModal onClose={() => setHelp(false)} />}
    </>
  )
}

const InstructionsModal = ({ onClose }: { onClose: () => void }) => {
  const ios = isIOS()
  const desktop = !/android|iphone|ipad|ipod/i.test(navigator.userAgent)
  const subtitle = desktop
    ? 'Instale o Visor360 como um app no seu computador — sem passar por loja.'
    : 'Adicione o app à tela de início do seu celular — sem passar por loja.'
  const passos = ios
    ? [
        <>Toque no ícone <strong>Compartilhar</strong> (o quadrado com a seta ↑) na barra do navegador.</>,
        <>Escolha <strong>Adicionar à Tela de Início</strong>.</>,
        <>Confirme em <strong>Adicionar</strong> — pronto, o Visor360 vira um app.</>,
      ]
    : desktop
      ? [
          <>Na barra de endereço, clique no ícone de <strong>instalar</strong> (um monitor com seta ↓) — ou abra o menu do navegador (<strong>⋮</strong> no Chrome, <strong>⋯</strong> no Edge).</>,
          <>Escolha <strong>Instalar Visor360</strong>.</>,
          <>Confirme em <strong>Instalar</strong> — pronto, o Visor360 abre como app.</>,
        ]
      : [
          <>Abra o menu do navegador (<strong>⋮</strong>).</>,
          <>Toque em <strong>Instalar app</strong> (ou <strong>Adicionar à tela inicial</strong>).</>,
          <>Confirme — pronto, o Visor360 vira um app.</>,
        ]

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 18, maxWidth: 400, width: '100%', padding: '26px 24px', boxShadow: '0 40px 90px -30px rgba(0,0,0,.5)' }}
      >
        <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 20, color: '#16293f' }}>
          Instalar o Visor<span style={{ color: '#0F766E' }}>360</span>
        </div>
        <p style={{ margin: '8px 0 18px', fontSize: 14.5, color: '#64748b', lineHeight: 1.55 }}>
          {subtitle}
        </p>
        <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {passos.map((p, i) => (
            <li key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', fontSize: 14, lineHeight: 1.5, color: '#334155' }}>
              <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: '#ecfdf5', color: '#0F766E', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={onClose}
          style={{ marginTop: 22, width: '100%', background: '#16293f', color: '#fff', fontWeight: 600, fontSize: 15, padding: '12px 20px', borderRadius: 12, border: 'none', cursor: 'pointer' }}
        >
          Entendi
        </button>
      </div>
    </div>
  )
}

export default LandingInstallButton
