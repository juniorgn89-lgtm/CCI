/**
 * Escala da interface — automática (ajusta ao tamanho da tela) ou manual
 * (o usuário fixa 100/90/80/75% nas Configurações, por máquina).
 *
 * O layout desktop foi desenhado pra ~1440px; abaixo disso ele fica "apertado"
 * (textos colados). Em vez de espremer, encolhemos a interface inteira via CSS
 * `zoom` — reproduzindo o MESMO layout de 1440px, só que menor e cabendo na tela.
 *
 * Detalhes:
 * - `zoom` (não `transform: scale`) porque reflui o layout → sem barra horizontal.
 * - Shell mobile (largura real < MOBILE_BP) nunca é escalado; o swap <768px cuida.
 * - Estável: largura REAL = innerWidth × zoomAtual é invariante ao zoom, então não
 *   há loop de feedback nem flip indevido do breakpoint mobile (boundary = 768px real).
 * - Persistido em localStorage `visor360.uiscale` (por máquina/navegador).
 * - Requer Chromium/Edge ou Firefox recente (suporte a CSS `zoom`).
 */

export type UiScaleMode = 'auto' | 100 | 90 | 85 | 80 | 75

export const UI_SCALE_OPTIONS: { value: UiScaleMode; label: string; hint: string }[] = [
  { value: 'auto', label: 'Automático', hint: 'Ajusta ao tamanho da tela (recomendado)' },
  { value: 100, label: '100%', hint: 'Tamanho original' },
  { value: 90, label: '90%', hint: 'Um pouco menor' },
  { value: 85, label: '1366 × 768', hint: 'Notebook HD — cabe sem rolar' },
  { value: 80, label: '80%', hint: 'Telas antigas / apertadas' },
  { value: 75, label: '75%', hint: 'Telas bem pequenas' },
]

const STORAGE_KEY = 'visor360.uiscale'
const DESIGN_WIDTH = 1440 // largura-alvo do layout desktop
const MIN_ZOOM = 0.75 // piso do modo automático
const MOBILE_BP = 768 // abaixo disso o shell mobile assume

let mode: UiScaleMode = 'auto'
let current = 1
let raf = 0

const readMode = (): UiScaleMode => {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === '100' || v === 'off') return 100
    if (v === '90') return 90
    if (v === '85') return 85
    if (v === '80') return 80
    if (v === '75') return 75
    return 'auto'
  } catch {
    return 'auto'
  }
}

const pickZoom = (realWidth: number): number => {
  if (realWidth < MOBILE_BP) return 1 // shell mobile — nunca escala
  if (mode !== 'auto') return mode / 100 // manual fixo
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

/** Liga a escala e o listener de resize. Chamar uma vez no boot. */
export const initUiScale = (): void => {
  if (typeof window === 'undefined') return
  mode = readMode()
  apply()
  window.addEventListener('resize', schedule, { passive: true })
}

export const getUiScaleMode = (): UiScaleMode => mode

/** Troca o modo (Configurações), persiste e re-aplica na hora. */
export const setUiScaleMode = (m: UiScaleMode): void => {
  mode = m
  try {
    localStorage.setItem(STORAGE_KEY, m === 'auto' ? 'auto' : String(m))
  } catch {
    /* noop */
  }
  apply()
}

export default initUiScale
