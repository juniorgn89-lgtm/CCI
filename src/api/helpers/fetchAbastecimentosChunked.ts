import { fetchAbastecimentos } from '@/api/endpoints/combustiveis'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import type { Abastecimento } from '@/api/types/combustivel'

interface Params {
  dataInicial: string
  dataFinal: string
  chunkDays?: number
}

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const splitDateRange = (start: string, end: string, chunkDays: number): { from: string; to: string }[] => {
  const chunks: { from: string; to: string }[] = []
  let current = new Date(start)
  const endDate = new Date(end)
  while (current <= endDate) {
    const chunkEnd = new Date(current)
    chunkEnd.setDate(chunkEnd.getDate() + chunkDays - 1)
    if (chunkEnd > endDate) chunkEnd.setTime(endDate.getTime())
    chunks.push({ from: fmtDate(current), to: fmtDate(chunkEnd) })
    current = new Date(chunkEnd)
    current.setDate(current.getDate() + 1)
  }
  return chunks
}

export const fetchAbastecimentosChunked = async ({
  dataInicial,
  dataFinal,
  chunkDays = 7,
}: Params): Promise<Abastecimento[]> => {
  const chunks = splitDateRange(dataInicial, dataFinal, chunkDays)
  const results = await Promise.all(
    chunks.map(({ from, to }) =>
      fetchAllPages(
        (p) => fetchAbastecimentos({ dataInicial: from, dataFinal: to, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
        1000, 50
      )
    )
  )
  return results.flat()
}
