import { useState } from 'react'

const lerOculto = (key: string) => {
  try { return localStorage.getItem(key) === 'oculto' } catch { return false }
}
const gravarOculto = (key: string, oculto: boolean) => {
  try { if (oculto) localStorage.setItem(key, 'oculto'); else localStorage.removeItem(key) } catch { /* sem storage: só não lembra */ }
}

/**
 * Guia com personagem e balão de fala, para explicar uma tela/modal pela
 * primeira vez. "Entendi" fecha agora (volta na próxima vez); "Não mostrar mais"
 * guarda a escolha no navegador. `useGuia` dá o estado para um botão "ver dica"
 * trazer o balão de volta.
 */
export const useGuia = (storageKey: string) => {
  const [oculto, setOculto] = useState(() => lerOculto(storageKey))
  const [fechadoAgora, setFechadoAgora] = useState(false)
  return {
    visivel: !oculto && !fechadoAgora,
    entendi: () => setFechadoAgora(true),
    naoMostrarMais: () => { gravarOculto(storageKey, true); setOculto(true) },
    mostrar: () => { gravarOculto(storageKey, false); setOculto(false); setFechadoAgora(false) },
  }
}
