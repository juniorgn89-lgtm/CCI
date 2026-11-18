/**
 * Guarda os últimos erros do navegador (exceções, promessas rejeitadas e
 * console.error) para anexar ao chamado. Só memória: some ao recarregar.
 * Instalado no boot (main.tsx) para pegar o que aconteceu ANTES de abrir o chamado.
 */
export interface ErroRecente { quando: string; mensagem: string }

const MAX = 15
const buffer: ErroRecente[] = []

const guardar = (mensagem: string) => {
  const m = mensagem.trim().slice(0, 500)
  if (!m) return
  buffer.push({ quando: new Date().toISOString(), mensagem: m })
  if (buffer.length > MAX) buffer.shift()
}

const texto = (v: unknown): string => {
  if (v instanceof Error) return `${v.name}: ${v.message}`
  if (typeof v === 'string') return v
  try { return JSON.stringify(v) } catch { return String(v) }
}

let instalado = false
export const instalarErrosRecentes = () => {
  if (instalado || typeof window === 'undefined') return
  instalado = true
  window.addEventListener('error', (e) => guardar(e.message || texto(e.error)))
  window.addEventListener('unhandledrejection', (e) => guardar(`Promessa rejeitada: ${texto(e.reason)}`))
  const original = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    guardar(args.map(texto).join(' '))
    original(...args)
  }
}

export const errosRecentes = (): ErroRecente[] => [...buffer]
