import { client } from '@/api/client'
import { isOn, recordQuery } from '@/lib/perf/perfStore'

const approxBytes = (x: unknown): number => {
  try { return new Blob([JSON.stringify(x)]).size } catch { return 0 }
}

let installed = false

/**
 * Liga a instrumentação da API live (Quality) anexando interceptors no axios.
 * Cada GET é registrado com {ms, linhas, bytes} quando a flag perf está ON.
 * Cobre TODOS os endpoints live de uma vez — não precisa tocar em cada um.
 * Chamado uma vez no bootstrap do App.
 */
export const initPerf = (): void => {
  if (installed) return
  installed = true

  client.interceptors.request.use((config) => {
    if (isOn()) (config as { metadata?: { start: number } }).metadata = { start: performance.now() }
    return config
  })

  client.interceptors.response.use(
    (response) => {
      if (isOn()) {
        const meta = (response.config as { metadata?: { start: number } }).metadata
        const ms = meta?.start ? performance.now() - meta.start : 0
        const data = response.data as unknown
        const rows = Array.isArray(data)
          ? data.length
          : data && typeof data === 'object' && Array.isArray((data as { resultados?: unknown[] }).resultados)
            ? (data as { resultados: unknown[] }).resultados.length
            : 0
        const lenHeader = Number(response.headers?.['content-length'])
        const bytes = Number.isFinite(lenHeader) && lenHeader > 0 ? lenHeader : approxBytes(data)
        const url = (response.config.url || '').split('?')[0]
        const label = url.replace(/^.*\/INTEGRACAO\/?/, '/') || url || '(live)'
        recordQuery({ source: 'live', label, url, ms, rows, bytes })
      }
      return response
    },
    (error) => Promise.reject(error),
  )
}
