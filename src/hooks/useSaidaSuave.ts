import { useLayoutEffect, useRef, type RefObject } from 'react'

/**
 * Saída suave de janelas (modais e painéis laterais), por QUALQUER caminho de
 * fechar — X, Cancelar, Esc, clicar fora, depois de salvar. Na maioria das telas
 * a janela é desmontada na hora (o pai some com ela), sem tempo de animar. Aqui,
 * no instante da desmontagem, uma CÓPIA estática da janela (e do fundo escuro,
 * que é o irmão anterior no portal) fica na página só durante a animação de saída
 * e depois é removida. Não clica, não lê tela (aria-hidden).
 *
 * - O Radix monta o conteúdo um instante depois (portal): a referência é
 *   acompanhada a cada atualização e a última conhecida é usada ao desmontar.
 * - Ignora a desmontagem-relâmpago do StrictMode (dev) e a que o próprio Radix
 *   já animou (data-state="closed").
 * - Respeita "reduzir movimento" do sistema.
 */
export const useSaidaSuave = (ref: RefObject<HTMLElement | null>, animacao: string, comFundo = true) => {
  const ultimo = useRef<HTMLElement | null>(null)
  const montouEm = useRef(0)
  // A cada atualização: guarda o elemento atual (o do portal chega depois).
  useLayoutEffect(() => { if (ref.current) ultimo.current = ref.current })
  useLayoutEffect(() => {
    montouEm.current = Date.now()
    return () => {
      const el = ref.current ?? ultimo.current
      if (!el || !el.isConnected) return
      if (Date.now() - montouEm.current < 120) return // StrictMode: monta/desmonta/monta
      if (el.dataset.state === 'closed') return // o Radix já animou a saída
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
      const fantasmas: HTMLElement[] = []
      const clonar = (node: HTMLElement, anim: string) => {
        const c = node.cloneNode(true) as HTMLElement
        c.removeAttribute('data-state') // não reexecuta a animação de entrada
        c.removeAttribute('id')
        c.removeAttribute('role')
        c.setAttribute('aria-hidden', 'true')
        c.style.pointerEvents = 'none'
        c.style.animation = anim
        document.body.appendChild(c)
        fantasmas.push(c)
      }
      const fundo = comFundo ? el.previousElementSibling : null
      if (fundo instanceof HTMLElement) clonar(fundo, 'janela-fundo-saida .22s ease-in forwards')
      clonar(el, animacao)
      window.setTimeout(() => fantasmas.forEach((f) => f.remove()), 260)
    }
  }, [])
}

export default useSaidaSuave
