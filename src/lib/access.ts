import { APP_STRUCTURE, moduleByPath, incluidoNoPlano } from '@/lib/appStructure'
import { getPlano, type PlanoId } from '@/lib/planos'

/**
 * Trava de acesso por PLANO da rede (`redes.plano`).
 *
 * É um TETO independente da permissão por usuário (`profiles.modulos_permitidos`):
 * o acesso efetivo é a interseção dos dois. O master ignora ambos.
 *
 * Postura de segurança = **fail-open**: rede sem plano definido (null) ou com
 * plano desconhecido/dado ruim → SEM trava (comportamento de hoje). Isso evita
 * trancar clientes pra fora enquanto a coluna/valor não estiver populada. Só
 * quando o plano é um dos conhecidos (basic/premium/pro) a trava vale.
 */

/** Normaliza `rede.plano` pra um PlanoId conhecido; null = sem trava (fail-open). */
export const normalizePlano = (raw: string | null | undefined): PlanoId | null =>
  getPlano(raw)?.id ?? null

/** Módulo do registro que corresponde a um pathname (exato ou por prefixo). */
const moduleForPathname = (pathname: string) =>
  APP_STRUCTURE.find((m) => pathname === m.path || pathname.startsWith(m.path + '/'))

/** Um módulo (por rota) está incluído no plano? Fail-open se plano null. */
export const moduloAllowedByPlano = (path: string, plano: PlanoId | null): boolean => {
  if (!plano) return true
  const m = moduleByPath(path)
  if (!m) return true
  return incluidoNoPlano(m.plano, plano)
}

/** Um pathname (rota) está incluído no plano? Fail-open se plano null. */
export const pathAllowedByPlano = (pathname: string, plano: PlanoId | null): boolean => {
  if (!plano) return true
  const m = moduleForPathname(pathname)
  if (!m) return true
  return incluidoNoPlano(m.plano, plano)
}

/** Uma aba de um módulo está incluída no plano? Fail-open se plano null. */
export const tabAllowedByPlano = (path: string, tabId: string, plano: PlanoId | null): boolean => {
  if (!plano) return true
  const t = moduleByPath(path)?.tabs.find((x) => x.id === tabId)
  if (!t) return true
  return incluidoNoPlano(t.plano, plano)
}
