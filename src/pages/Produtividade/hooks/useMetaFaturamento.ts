import { useCallback, useSyncExternalStore } from 'react'

/**
 * Meta de FATURAMENTO do período — valor MANUAL (não existe meta de faturamento
 * na API). Persistida em localStorage por POSTO (chave inclui o conjunto de
 * empresas selecionadas) pra que a meta acompanhe o filtro de empresa. READ-ONLY
 * em relação à API; localStorage é permitido pra preferências/metas manuais.
 */
const STORAGE_PREFIX = 'visor360-meta-faturamento-periodo'

const keyFor = (empresaCodigos: number[]): string =>
  `${STORAGE_PREFIX}:${[...empresaCodigos].sort((a, b) => a - b).join('-')}`

/** Lê o valor cru do localStorage (null quando não definido / inválido). */
const readMeta = (empresaCodigos: number[]): number | null => {
  if (empresaCodigos.length === 0) return null
  try {
    const raw = localStorage.getItem(keyFor(empresaCodigos))
    if (raw == null) return null
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

/* Pub/sub mínimo p/ refletir mudanças entre instâncias do hook na mesma aba
 * (o evento 'storage' nativo só dispara em OUTRAS abas). */
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

const subscribe = (cb: () => void): (() => void) => {
  listeners.add(cb)
  window.addEventListener('storage', cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', cb)
  }
}

export interface MetaFaturamento {
  /** Meta definida (R$). null quando o usuário ainda não definiu. */
  meta: number | null
  /** Persiste uma nova meta (>0). Passar null/0 limpa a meta. */
  setMeta: (value: number | null) => void
}

const useMetaFaturamento = (empresaCodigos: number[]): MetaFaturamento => {
  const storageKey = keyFor(empresaCodigos)

  const meta = useSyncExternalStore(
    subscribe,
    // getSnapshot precisa ser estável por valor — devolve string e converte fora.
    () => {
      try {
        return empresaCodigos.length === 0 ? '' : localStorage.getItem(storageKey) ?? ''
      } catch {
        return ''
      }
    },
    () => '',
  )

  const setMeta = useCallback(
    (value: number | null) => {
      if (empresaCodigos.length === 0) return
      try {
        if (value == null || !Number.isFinite(value) || value <= 0) {
          localStorage.removeItem(storageKey)
        } else {
          localStorage.setItem(storageKey, String(value))
        }
        emit()
      } catch {
        /* localStorage indisponível — ignora silenciosamente */
      }
    },
    [empresaCodigos.length, storageKey],
  )

  const parsed = meta === '' ? null : (() => {
    const n = Number(meta)
    return Number.isFinite(n) && n > 0 ? n : null
  })()

  return { meta: parsed, setMeta }
}

export default useMetaFaturamento
export { readMeta }
