import { useEffect, useRef, useState } from 'react'
import { useIsFetching } from '@tanstack/react-query'

/** Data + hora curtas da última atualização (ex.: "27/06 14:32"). */
const fmtDateTime = (d: Date): string => {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm} ${hh}:${mi}`
}

/**
 * Indicador de frescor — carimba o momento sempre que um ciclo de fetch do
 * React Query termina (dados recém-chegados da API) e mostra a data/hora da
 * última atualização. Vive no Header global, então reflete a última
 * atualização de qualquer tela.
 */
const UltimaAtualizacaoInfo = () => {
  const isFetching = useIsFetching()
  const [stampedAt, setStampedAt] = useState<Date>(() => new Date())
  const wasFetching = useRef(false)

  // Fim de um ciclo de fetch (isFetching volta a 0) → carimba "agora".
  useEffect(() => {
    if (isFetching > 0) {
      wasFetching.current = true
    } else if (wasFetching.current) {
      wasFetching.current = false
      setStampedAt(new Date())
    }
  }, [isFetching])

  const fetching = isFetching > 0

  return (
    <span
      className="hidden items-center gap-1.5 whitespace-nowrap text-[11px] text-gray-400 dark:text-gray-500 sm:inline-flex"
      title="Mostra a data e hora da última atualização dos dados."
    >
      <span className="relative flex h-2 w-2">
        {fetching && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      {/* Mantém a data por extenso mesmo atualizando — só pisca enquanto busca. */}
      <span className={fetching ? 'animate-pulse' : undefined}>Atualizado em {fmtDateTime(stampedAt)}</span>
    </span>
  )
}

export default UltimaAtualizacaoInfo
