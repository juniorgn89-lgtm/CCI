/**
 * Captura o evento `beforeinstallprompt` no BOOT do app (side-effect no main.tsx)
 * e guarda numa variável de módulo. O navegador dispara esse evento uma única vez
 * e pode ser cedo — se só um componente tardio escutasse, perderia. Aqui a gente
 * segura o evento e avisa quem estiver inscrito (o banner de instalar).
 *
 * É o caminho pra instalar o PWA (adicionar à tela de início) SEM passar por loja.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let deferred: BeforeInstallPromptEvent | null = null
const subs = new Set<() => void>()
const emit = () => subs.forEach((fn) => fn())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    emit()
  })
}

export const getInstallPrompt = () => deferred
export const clearInstallPrompt = () => {
  deferred = null
  emit()
}
export const subscribeInstall = (fn: () => void) => {
  subs.add(fn)
  return () => {
    subs.delete(fn)
  }
}
