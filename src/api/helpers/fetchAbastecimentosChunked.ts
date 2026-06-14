import { fetchAbastecimentos } from '@/api/endpoints/combustiveis'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import type { Abastecimento } from '@/api/types/combustivel'

type TipoData = 'EMISSAO' | 'ENTRADA' | 'FISCAL' | 'MOVIMENTO'

interface Params {
  dataInicial: string
  dataFinal: string
  chunkDays?: number
  /** Critério de data do filtro (espelha Abast./Fiscal/Movimento do webPosto).
   *  Omitido = default da API (= data do abastecimento). */
  tipoData?: TipoData
}

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Parseia 'yyyy-MM-dd' como meia-noite LOCAL (não UTC). `new Date('2026-06-11')`
 *  vira meia-noite UTC, que em fuso negativo (Brasília) recua 1 dia ao formatar
 *  de volta com getDate() — deslocava todo o range −1 dia. */
const parseLocal = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const splitDateRange = (start: string, end: string, chunkDays: number): { from: string; to: string }[] => {
  const chunks: { from: string; to: string }[] = []
  let current = parseLocal(start)
  const endDate = parseLocal(end)
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
  tipoData: TipoData | undefined,
  attempt = 0
): Promise<Abastecimento[]> => {
  try {
    return await fetchAllPages(
      (p) => fetchAbastecimentos({ dataInicial: from, dataFinal: to, tipoData, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 50
    )
  } catch {
    if (attempt < 1) {
      await new Promise((res) => setTimeout(res, 2000))
      return fetchChunkWithRetry(from, to, tipoData, attempt + 1)
    }
    // Return empty on final failure — partial data beats a total crash
    console.warn(`[fetchAbastecimentosChunked] chunk ${from}→${to} failed after retry, skipping`)
    return []
  }
}

// Paralelismo: 4 chunks simultâneos balanceia velocidade vs carga no servidor.
// Subir mais que isso pode disparar rate-limit da Quality em períodos longos.
const PARALLEL_CHUNKS = 4

export const fetchAbastecimentosChunked = async ({
  dataInicial,
  dataFinal,
  chunkDays = 7,
  tipoData,
}: Params): Promise<Abastecimento[]> => {
  const chunks = splitDateRange(dataInicial, dataFinal, chunkDays)

  const results: Abastecimento[] = []
  for (let i = 0; i < chunks.length; i += PARALLEL_CHUNKS) {
    const batch = chunks.slice(i, i + PARALLEL_CHUNKS)
    const batchResults = await Promise.all(
      batch.map(({ from, to }) => fetchChunkWithRetry(from, to, tipoData))
    )
    results.push(...batchResults.flat())
  }

  return results
}
