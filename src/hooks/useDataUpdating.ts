import { useEffect, useRef, useState } from 'react'
import { useIsFetching } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'

/**
 * `true` enquanto uma mudança de FILTRO aplicado (posto/período) está sendo
 * buscada — usado pra pulsar o conteúdo ("atualizando..."). NÃO arma em
 * refetches de fundo (ex.: o polling do Ao Vivo a cada 60s), só quando o
 * usuário de fato muda o recorte. Auto-desarma quando o fetch assenta (ou num
 * teto curto, pra nunca ficar preso ligado).
 */
const useDataUpdating = (): boolean => {
  const key = useFilterStore(
    (s) => `${[...s.empresaCodigos].sort().join(',')}|${s.dataInicial}|${s.dataFinal}`,
  )
  const isFetching = useIsFetching()
  const [updating, setUpdating] = useState(false)
  const prevKey = useRef(key)
  const sawFetch = useRef(false)

  // Arma quando o recorte aplicado muda.
  useEffect(() => {
    if (prevKey.current === key) return
    prevKey.current = key
    sawFetch.current = false
    setUpdating(true)
  }, [key])

  // Desarma: viu o fetch começar e terminar → 150ms depois; nunca viu fetch
  // (cache instantâneo) → janela curta de 600ms pra dar tempo de começar.
  useEffect(() => {
    if (!updating) return
    if (isFetching > 0) {
      sawFetch.current = true
      return
    }
    const delay = sawFetch.current ? 150 : 600
    const t = setTimeout(() => setUpdating(false), delay)
    return () => clearTimeout(t)
  }, [isFetching, updating])

  return updating
}

export default useDataUpdating
