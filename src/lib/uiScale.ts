/**
 * Auto-escala da interface em telas "desktop antigo" (1024–1440px).
 *
 * O layout desktop foi desenhado pra ~1440px; abaixo disso ele tenta encaixar as
 * mesmas colunas/tabelas em menos espaço e fica "apertado" (textos colados). Em
 * vez de espremer, encolhemos a interface inteira via CSS `zoom` proporcional —
 * reproduzindo o MESMO layout de 1440px, só que menor e cabendo na tela.
 *
 * Detalhes:
 * - Telas grandes (≥ DESIGN_WIDTH) → zoom 1 (nada muda).
 * - Shell mobile (largura real < MOBILE_BP) → zoom 1; o swap <768px cuida.
 * - `zoom` (não `transform: scale`) porque ele REFLUI o layout — sem overflow nem
 *   barra horizontal. Suportado em Chromium/Edge (e Firefox recente).
 * - Estável: a largura REAL = innerWidth × zoomAtual é INVARIANTE ao zoom, então
 *   não há loop de feedback com media queries nem com o matchMedia do useIsMobile
 *   (o boundary mobile/desktop continua em 768px de largura real).
 * - Desligável: localStorage `visor360.uiscale = 'off'`.
 */

const DESIGN_WIDTH = 1440 // largura-alvo do layout desktop
const MIN_ZOOM = 0.8 // piso (em 1024px → efetivo 1280; texto a 80%)
const MOBILE_BP = 768 // abaixo disso o shell mobile assume

let current = 1
let raf = 0
let enabled = true

const pickZoom = (realWidth: number): number => {
  if (!enabled) return 1
  if (realWidth < MOBILE_BP) return 1 // deixa o shell mobile cuidar
  if (realWidth >= DESIGN_WIDTH) return 1
  return Math.max(MIN_ZOOM, realWidth / DESIGN_WIDTH)
}

const apply = (): void => {
  raf = 0
  // largura real (a zoom=1) = innerWidth atual × zoom aplicado — invariante.
  const realWidth = window.innerWidth * current
  const next = Math.round(pickZoom(realWidth) * 1000) / 1000
  if (next === current) return
  current = next
  const style = document.documentElement.style
  if (next === 1) style.removeProperty('zoom')
  else style.setProperty('zoom', String(next))
}

const schedule = (): void => {
  if (raf) return
  raf = window.requestAnimationFrame(apply)
}

/** Liga o auto-scale e o listener de resize. Chamar uma vez no boot. */
export const initUiScale = (): void => {
  if (typeof window === 'undefined') return
  try {
    enabled = localStorage.getItem('visor360.uiscale') !== 'off'
  } catch {
    enabled = true
  }
  apply()
  window.addEventListener('resize', schedule, { passive: true })
}

export default initUiScale
