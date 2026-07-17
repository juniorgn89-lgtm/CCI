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
  /** Chunks simultâneos. Default 4 (velocidade). A apuração passa 1 pra ficar
   *  100% sequencial e não estourar o rate-limit sob CHAVE já sufocada. */
  parallelChunks?: number
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
  } catch (err) {
    if (attempt < 1) {
      await new Promise((res) => setTimeout(res, 2000))
      return fetchChunkWithRetry(from, to, tipoData, attempt + 1)
    }
    // Propaga a falha do chunk. O agregador decide: falha PARCIAL vira dado
    // parcial (com aviso); falha TOTAL vira erro — NUNCA um vazio silencioso,
    // que a UI confunde com "sem dados".
    throw err
  }
}

// Paralelismo default: 4 chunks simultâneos balanceia velocidade vs carga no
// servidor. Subir mais que isso pode disparar rate-limit da Quality em períodos
// longos. A apuração sobrescreve pra 1 (sequencial).
const PARALLEL_CHUNKS = 4

export const fetchAbastecimentosChunked = async ({
  dataInicial,
  dataFinal,
  chunkDays = 7,
  tipoData,
  parallelChunks = PARALLEL_CHUNKS,
}: Params): Promise<Abastecimento[]> => {
  const chunks = splitDateRange(dataInicial, dataFinal, chunkDays)
  const parallel = Math.max(1, parallelChunks)

  const results: Abastecimento[] = []
  let failed = 0
  let lastError: unknown = null
  for (let i = 0; i < chunks.length; i += parallel) {
    const batch = chunks.slice(i, i + parallel)
    const settled = await Promise.allSettled(
      batch.map(({ from, to }) => fetchChunkWithRetry(from, to, tipoData))
    )
    settled.forEach((s, k) => {
      if (s.status === 'fulfilled') {
        results.push(...s.value)
      } else {
        failed++
        lastError = s.reason
        const { from, to } = batch[k]
        console.warn(`[fetchAbastecimentosChunked] chunk ${from}→${to} failed after retry`, s.reason)
      }
    })
  }

  // Falha TOTAL (todas as janelas falharam) → erro explícito, pra UI mostrar
  // "API indisponível" em vez de "sem dados". Falha parcial mantém o dado
  // parcial (o console.warn acima registra as janelas perdidas).
  if (chunks.length > 0 && failed === chunks.length) {
    throw new Error(
      `Falha ao carregar abastecimentos: todas as ${chunks.length} janela(s) retornaram erro da API. ` +
      `Último erro: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    )
  }

  return results
}
