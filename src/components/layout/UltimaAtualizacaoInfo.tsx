import { useEffect, useRef, useState } from 'react'
import { useIsFetching } from '@tanstack/react-query'

/** Tempo relativo curto desde a última atualização. */
const relative = (d: Date): string => {
  const sec = (Date.now() - d.getTime()) / 1000
  if (sec < 60) return 'agora mesmo'
  if (sec < 3600) {
    const min = Math.floor(sec / 60)
    return `há ${min} min`
  }
  const h = Math.floor(sec / 3600)
  return `há ${h}h`
}

/**
 * Indicador de frescor EM TEMPO REAL — substitui o antigo "Apurado em …".
 * Carimba o momento sempre que um ciclo de fetch do React Query termina (dados
 * recém-chegados da API) e mostra o tempo relativo, atualizando sozinho. Vive
 * no Header global, então reflete a última atualização de qualquer tela.
 */
const UltimaAtualizacaoInfo = () => {
  const isFetching = useIsFetching()
  const [stampedAt, setStampedAt] = useState<Date>(() => new Date())
  const [label, setLabel] = useState('agora mesmo')
  const wasFetching = useRef(false)

  // Fim de um ciclo de fetch (isFetching volta a 0) → carimba "agora".
  useEffect(() => {
    if (isFetching > 0) {
      wasFetching.current = true
    } else if (wasFetching.current) {
      wasFetching.current = false
      const now = new Date()
      setStampedAt(now)
      setLabel(relative(now))
    }
  }, [isFetching])

  // Mantém o "há X min" vivo sem depender de novo fetch.
  useEffect(() => {
    const id = setInterval(() => setLabel(relative(stampedAt)), 30_000)
    return () => clearInterval(id)
  }, [stampedAt])

  const fetching = isFetching > 0

  return (
    <span
      className="hidden items-center gap-1.5 whitespace-nowrap text-[11px] text-gray-400 dark:text-gray-500 sm:inline-flex"
      title="Os dados são atualizados em tempo real direto da API. Mostra quando foi a última atualização."
    >
      <span className="relative flex h-2 w-2">
        {fetching && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      {fetching ? 'Atualizando…' : <>Tempo real · atualizado {label}</>}
    </span>
  )
}

export default UltimaAtualizacaoInfo
