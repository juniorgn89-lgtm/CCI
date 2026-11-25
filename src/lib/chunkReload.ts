/**
 * Versão velha aberta depois de um deploy: o bundle antigo pede um pedaço do app
 * (ex.: assets/PainelLayout-<hash>.js) que não existe mais no servidor e a tela
 * quebra com "Failed to fetch dynamically imported module". Clicar em "Tentar
 * novamente" não resolve (o import falho fica em cache) — só recarregar a página,
 * que baixa a versão nova. Aqui isso acontece sozinho, UMA vez: se recarregou há
 * pouco e o erro voltou, é outro problema (offline, servidor fora) e a tela de
 * erro aparece normalmente.
 */
const CHAVE = 'visor360.recarregouPorVersao'
const JANELA_MS = 30_000

export const ehErroDeVersao = (err: unknown): boolean => {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err ?? '')
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading (CSS )?chunk .* failed|Unable to preload CSS/i.test(msg)
}

/** Recarrega a página se não recarregou pelo mesmo motivo nos últimos 30 s. true = vai recarregar. */
export const recarregarPorVersao = (): boolean => {
  try {
    const ultima = Number(sessionStorage.getItem(CHAVE) ?? 0)
    if (Date.now() - ultima < JANELA_MS) return false
    sessionStorage.setItem(CHAVE, String(Date.now()))
  } catch { /* sem storage: recarrega mesmo assim, uma vez por carregamento */ }
  window.location.reload()
  return true
}

/** Erro do Vite ao pré-carregar um pedaço do app → recarrega antes de a tela quebrar. */
export const instalarRecargaPorVersao = () => {
  window.addEventListener('vite:preloadError', (e) => {
    if (recarregarPorVersao()) e.preventDefault()
  })
}
