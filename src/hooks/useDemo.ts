import { useDemoStore } from '@/store/demo'
import { DEMO_REDE_NOME } from '@/lib/demoMask'

/** true quando o Modo Demonstração está ligado (re-renderiza ao alternar). */
export const useDemoAtivo = (): boolean => useDemoStore((s) => s.ativo)

/**
 * Nome da rede pra EXIBIR: o real, ou "Rede Exemplo" no Modo Demonstração.
 * Use em todo lugar que mostra `rede.nome` pro usuário (header, mobile, painel).
 */
export const useRedeNomeExibicao = (nome: string | null | undefined): string | null => {
  const demo = useDemoStore((s) => s.ativo)
  return demo ? DEMO_REDE_NOME : (nome ?? null)
}
