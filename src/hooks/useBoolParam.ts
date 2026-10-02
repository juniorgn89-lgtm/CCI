import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Flag booleana controlada pela URL (`?nome=1`) — deep link e F5 preservam o
 * estado; `false` limpa o parâmetro (URL limpa). Não mexe nos demais parâmetros
 * (`?tab=`, filtros). Mesmo padrão do `useTabParam`: sincroniza quando a URL
 * muda por fora (voltar do browser) sem useEffect.
 */
export const useBoolParam = (name: string): [boolean, (value: boolean) => void] => {
  const [searchParams, setSearchParams] = useSearchParams()
  const fromUrl = searchParams.get(name) === '1'
  const [active, setActive] = useState(fromUrl)

  const [prev, setPrev] = useState(fromUrl)
  if (fromUrl !== prev) {
    setPrev(fromUrl)
    if (fromUrl !== active) setActive(fromUrl)
  }

  const set = (value: boolean) => {
    setActive(value)
    const next = new URLSearchParams(searchParams)
    if (value) next.set(name, '1')
    else next.delete(name)
    setSearchParams(next, { replace: true })
  }

  return [active, set]
}

export default useBoolParam
