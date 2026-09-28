import { useEffect } from 'react'

/**
 * "Marca-texto" de linhas: clicar numa linha de tabela que NÃO tem ação própria
 * (drill-down, modal, botão) liga/desliga um destaque amarelo nela — pra
 * acompanhar uma linha numa tabela larga, comparar postos ou apontar numa
 * reunião. Esc limpa todas as marcas.
 *
 * É um listener ÚNICO delegado no documento (nenhuma tabela precisa mudar):
 *  - a linha vira marcada com `data-marcada` (React não mexe em atributos que
 *    não renderizou, então a marca sobrevive a re-renders enquanto o <tr> existir;
 *    paginar/trocar filtro recria a linha e a marca some — é ephemeral mesmo);
 *  - o visual está em index.css (`tr[data-marcada]`), tingindo POR CIMA do fundo
 *    de cada célula (heatmap incluído) com um inset shadow, sem trocar a cor.
 *
 * O que NÃO marca (a linha já responde ao clique de outro jeito):
 *  - clique dentro de botão/link/input/label/summary ou [role=button];
 *  - linha (ou célula) com handler de clique React, detectado pelas props internas
 *    do React no nó (`__reactProps$…`) — cobre onRowClick do DataTable, drill-downs
 *    e modais — ou com `cursor-pointer` (convenção das linhas clicáveis daqui);
 *  - linhas de cabeçalho (thead) e seleção de texto em andamento (arrastar pra
 *    copiar não deve marcar).
 */
const SELETOR_INTERATIVO = 'a, button, input, select, textarea, label, summary, [role="button"], [role="link"], [contenteditable]'

/** O nó (ou seus ancestrais até `ate`) tem um onClick registrado pelo React? */
const temCliqueReact = (inicio: Element, ate: Element): boolean => {
  let el: Element | null = inicio
  while (el) {
    const chave = Object.keys(el).find((k) => k.startsWith('__reactProps'))
    if (chave) {
      const props = (el as unknown as Record<string, { onClick?: unknown; onDoubleClick?: unknown }>)[chave]
      if (props && (typeof props.onClick === 'function' || typeof props.onDoubleClick === 'function')) return true
    }
    if (el === ate) break
    el = el.parentElement
  }
  return false
}

const aoClicar = (e: MouseEvent) => {
  const alvo = e.target as Element | null
  if (!alvo || e.button !== 0 || e.defaultPrevented) return
  const tr = alvo.closest('tr')
  if (!tr || !tr.closest('tbody')) return
  // Ação própria da linha ou do que foi clicado → não interfere.
  if (alvo.closest(SELETOR_INTERATIVO)) return
  if (tr.classList.contains('cursor-pointer') || tr.getAttribute('role') === 'button') return
  if (temCliqueReact(alvo, tr)) return
  // Arrastou pra selecionar texto: não é um "clique na linha".
  const sel = window.getSelection()
  if (sel && sel.toString().length > 0) return

  if (tr.hasAttribute('data-marcada')) tr.removeAttribute('data-marcada')
  else tr.setAttribute('data-marcada', '')
}

const aoTeclar = (e: KeyboardEvent) => {
  if (e.key !== 'Escape') return
  document.querySelectorAll('tr[data-marcada]').forEach((tr) => tr.removeAttribute('data-marcada'))
}

const MarcaTextoLinhas = () => {
  useEffect(() => {
    document.addEventListener('click', aoClicar)
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('click', aoClicar)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [])
  return null
}

export default MarcaTextoLinhas
