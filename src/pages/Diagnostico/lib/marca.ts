/**
 * Identidade CCI do Diagnóstico (o material que vai para o cliente): verde-
 * petróleo + dourado, título em Bricolage Grotesque (a fonte da landing),
 * corpo em Inter. Só o Diagnóstico usa; o resto do Visor segue azul-marinho.
 */
export const CCI = {
  teal: '#0F766E',
  tealEscuro: '#0B4F4A',
  tealFundo: '#083B37',
  ouro: '#FCB619',
  tinta: '#0B4A44',
} as const

export const FONTE_TITULO = "'Bricolage Grotesque', 'Inter', system-ui, sans-serif"

/** Carrega a fonte de título do Google Fonts enquanto o Diagnóstico está aberto (CSP já libera). */
export const carregarFonteMarca = (): (() => void) => {
  const links: HTMLLinkElement[] = []
  const add = (rel: string, href: string, cross = false) => {
    const l = document.createElement('link')
    l.rel = rel
    l.href = href
    if (cross) l.crossOrigin = 'anonymous'
    document.head.appendChild(l)
    links.push(l)
  }
  add('preconnect', 'https://fonts.googleapis.com')
  add('preconnect', 'https://fonts.gstatic.com', true)
  add('stylesheet', 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&display=swap')
  return () => { links.forEach((l) => l.remove()) }
}
