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

const fetchChunkWithRetry = async (
  from: string,
  to: string,
  attempt = 0
): Promise<Abastecimento[]> => {
  try {
    return await fetchAllPages(
      (p) => fetchAbastecimentos({ dataInicial: from, dataFinal: to, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 50
    )
  } catch (err) {
    if (attempt < 1) {
      await new Promise((res) => setTimeout(res, 2000))
      return fetchChunkWithRetry(from, to, attempt + 1)
    }
    // Return empty on final failure — partial data beats a total crash
    console.warn(`[fetchAbastecimentosChunked] chunk ${from}→${to} failed after retry, skipping`)
    return []
  }
}

export const fetchAbastecimentosChunked = async ({
  dataInicial,
  dataFinal,
  chunkDays = 7,
}: Params): Promise<Abastecimento[]> => {
  const chunks = splitDateRange(dataInicial, dataFinal, chunkDays)

  // Process in batches of 2 to reduce server load
  const results: Abastecimento[] = []
  for (let i = 0; i < chunks.length; i += 2) {
    const batch = chunks.slice(i, i + 2)
    const batchResults = await Promise.all(
      batch.map(({ from, to }) => fetchChunkWithRetry(from, to))
    )
    results.push(...batchResults.flat())
  }

  return results
}
