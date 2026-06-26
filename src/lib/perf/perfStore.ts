/**
 * Harness de medição de performance (BASELINE) — instrumentação leve e REMOVÍVEL.
 *
 * Liga/desliga por flag (zero custo quando off):
 *   localStorage.setItem('visor360.perf', 'on')   // ou window.__perf.on()
 *
 * Captura, por TELA (rota + ?tab):
 *  - tempo de carregamento da tela (mount → todas as queries liquidadas)
 *  - cada consulta (Supabase + API live): ms, nº de linhas, bytes aprox.
 *  - nº de requisições por tela
 *  - tempo de render da árvore da página (via <PerfProfiler>)
 *
 * Fluxo de uso (console do navegador):
 *   __perf.on()                  // liga (persiste na flag)
 *   __perf.setPhase('baseline')  // rótulo da rodada
 *   // navega até a tela, espera carregar
 *   __perf.report()              // imprime tabelas no console
 *   __perf.export()              // baixa baseline-<tela>.json
 *   __perf.diff(baselineJson)    // compara a tela atual com um JSON salvo
 *
 * Pra remover o harness: apague src/lib/perf/, a chamada initPerf() no App e os
 * wraps perfDone()/perfNow() em apuracao.ts.
 */

export interface PerfQueryRec {
  source: 'supabase' | 'live'
  label: string
  table?: string
  url?: string
  ms: number
  rows: number
  bytes: number
}

export interface PerfComponentRec {
  name: string
  renderMs: number
  commits: number
}

export interface PerfScreenReport {
  screen: string
  phase: string
  ts: string
  /** ms do mount da tela até todas as queries liquidarem. null = servido do cache (sem rede). */
  screenLoadMs: number | null
  totalRequests: number
  totalRows: number
  totalBytes: number
  queries: PerfQueryRec[]
  components: PerfComponentRec[]
}

// ── Estado (flag em memória, espelha o localStorage) ───────────────────────
const FLAG_KEY = 'visor360.perf'
let enabled = ((): boolean => {
  try { return localStorage.getItem(FLAG_KEY) === 'on' } catch { return false }
})()

export const isOn = (): boolean => enabled

let phase = 'baseline'
let screen = '(inicial)'
let screenStart = 0
let screenLoadMs: number | null = null
let sawFetching = false
let queries: PerfQueryRec[] = []
const components = new Map<string, PerfComponentRec>()

const now = (): number => performance.now()

const approxBytes = (x: unknown): number => {
  try { return new Blob([JSON.stringify(x)]).size } catch { return 0 }
}

// ── Coleta ────────────────────────────────────────────────────────────────
export const recordQuery = (rec: PerfQueryRec): void => {
  if (!enabled) return
  queries.push(rec)
}

/** Marca o início de uma chamada Supabase. Retorna t0 (0 = harness off). */
export const perfNow = (): number => (enabled ? now() : 0)

/** Fecha a medição de uma chamada Supabase e devolve as linhas inalteradas. */
export const perfDone = <T>(label: string, table: string, rows: T[], t0: number): T[] => {
  if (enabled && t0) {
    recordQuery({ source: 'supabase', label, table, ms: now() - t0, rows: rows.length, bytes: approxBytes(rows) })
  }
  return rows
}

export const recordComponent = (name: string, renderMs: number): void => {
  if (!enabled) return
  const c = components.get(name) ?? { name, renderMs: 0, commits: 0 }
  c.renderMs += renderMs
  c.commits += 1
  components.set(name, c)
}

// ── Ciclo de tela ───────────────────────────────────────────────────────────
export const beginScreen = (name: string): void => {
  if (!enabled) return
  screen = name
  screenStart = now()
  screenLoadMs = null
  sawFetching = false
  queries = []
  components.clear()
}

/** Chamado pelo tracker quando o nº de queries em voo vai de >0 → 0. */
export const onFetchingChange = (count: number): void => {
  if (!enabled) return
  if (count > 0) sawFetching = true
  else if (sawFetching && screenLoadMs === null) screenLoadMs = now() - screenStart
}

// ── Relatório ────────────────────────────────────────────────────────────────
const groupByLabel = (qs: PerfQueryRec[]) => {
  const m = new Map<string, { label: string; source: string; count: number; totalMs: number; totalRows: number; totalBytes: number }>()
  for (const q of qs) {
    const key = q.table ? `${q.label}·${q.table}` : q.label
    const g = m.get(key) ?? { label: key, source: q.source, count: 0, totalMs: 0, totalRows: 0, totalBytes: 0 }
    g.count += 1; g.totalMs += q.ms; g.totalRows += q.rows; g.totalBytes += q.bytes
    m.set(key, g)
  }
  return Array.from(m.values()).sort((a, b) => b.totalMs - a.totalMs)
}

export const snapshot = (): PerfScreenReport => ({
  screen,
  phase,
  ts: new Date().toISOString(),
  screenLoadMs,
  totalRequests: queries.length,
  totalRows: queries.reduce((s, q) => s + q.rows, 0),
  totalBytes: queries.reduce((s, q) => s + q.bytes, 0),
  queries: [...queries],
  components: Array.from(components.values()).sort((a, b) => b.renderMs - a.renderMs),
})

const kb = (b: number): string => `${(b / 1024).toFixed(1)} KB`

const api = {
  on(): void { enabled = true; try { localStorage.setItem(FLAG_KEY, 'on') } catch { /* ignore */ } console.info('[perf] ON') },
  off(): void { enabled = false; try { localStorage.removeItem(FLAG_KEY) } catch { /* ignore */ } console.info('[perf] OFF') },
  setPhase(p: string): void { phase = p; console.info(`[perf] phase = ${p}`) },
  reset(): void { beginScreen(screen) },
  snapshot,
  report(): PerfScreenReport {
    const snap = snapshot()
    console.info(
      `%c[perf] ${snap.screen} · fase ${snap.phase}`,
      'font-weight:bold',
      `\n  carregamento: ${snap.screenLoadMs === null ? 'cache (sem rede)' : Math.round(snap.screenLoadMs) + ' ms'}`,
      `\n  requisições: ${snap.totalRequests} · linhas: ${snap.totalRows} · payload: ${kb(snap.totalBytes)}`,
    )
    console.table(groupByLabel(snap.queries).map((g) => ({
      consulta: g.label, fonte: g.source, n: g.count,
      ms_total: Math.round(g.totalMs), ms_medio: Math.round(g.totalMs / g.count),
      linhas: g.totalRows, payload: kb(g.totalBytes),
    })))
    if (snap.components.length) {
      console.table(snap.components.map((c) => ({ componente: c.name, render_ms: Math.round(c.renderMs), commits: c.commits })))
    }
    return snap
  },
  export(): PerfScreenReport {
    const snap = snapshot()
    try {
      const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `perf-${snap.phase}-${snap.screen.replace(/[^\w]+/g, '_')}.json`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch { /* ignore */ }
    return snap
  },
  diff(baseline: PerfScreenReport): void {
    const cur = snapshot()
    const pct = (a: number, b: number): string => (b ? `${(((a - b) / b) * 100).toFixed(1)}%` : '—')
    console.info(`%c[perf] diff ${cur.screen}: ${baseline.phase} → ${cur.phase}`, 'font-weight:bold')
    console.table([
      { metrica: 'carregamento (ms)', baseline: baseline.screenLoadMs, atual: cur.screenLoadMs, delta_pct: pct(cur.screenLoadMs ?? 0, baseline.screenLoadMs ?? 0) },
      { metrica: 'requisições', baseline: baseline.totalRequests, atual: cur.totalRequests, delta_pct: pct(cur.totalRequests, baseline.totalRequests) },
      { metrica: 'linhas', baseline: baseline.totalRows, atual: cur.totalRows, delta_pct: pct(cur.totalRows, baseline.totalRows) },
      { metrica: 'payload (KB)', baseline: +(baseline.totalBytes / 1024).toFixed(1), atual: +(cur.totalBytes / 1024).toFixed(1), delta_pct: pct(cur.totalBytes, baseline.totalBytes) },
    ])
  },
}

export type PerfApi = typeof api

declare global {
  interface Window { __perf?: PerfApi }
}

try { window.__perf = api } catch { /* SSR/no-window */ }

export default api
