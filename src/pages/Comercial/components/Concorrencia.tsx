import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  TrendingUp, TrendingDown, DollarSign, Plus, Save, ShieldCheck, Clock, AlertTriangle, X, Trash2, Check, History, RotateCcw, User, ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrencyInt } from '@/lib/formatters'
import { Skeleton } from '@/components/ui/skeleton'
import InfoHint from '@/components/ui/InfoHint'
import { useTenantStore } from '@/store/tenant'
import { useAuthStore } from '@/store/auth'
import { useComercialFlags } from '@/store/comercialFlags'
import {
  insertConcorrenciaPrecos, deleteConcorrente, restoreConcorrente, fetchConcorrenciaExcluidos,
  type ConcorrenciaPrecoInsert, type FuelSlug,
} from '@/api/supabase/concorrencia'
import useConcorrencia, { type FuelView } from '@/pages/Comercial/hooks/useConcorrencia'

const r3 = (v: number) => `R$ ${v.toFixed(3).replace('.', ',')}`
/** yyyy-MM-dd | ISO → DD/MM/YYYY (só a parte de data). */
const dataBR = (iso?: string | null): string => {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return d ? `${d}/${m}/${y}` : iso
}
const epochDay = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86_400_000 }

/* ── Editor de praça (tabela editável → INSERT append-only). Keyed por posto. ── */
const PrecoEditor = ({
  fuels, atual, autores, empresaCodigo, redeId,
}: {
  fuels: FuelView[]
  atual: Map<string, { postos: number; precos: Partial<Record<FuelSlug, number>> }>
  autores: Record<string, { porNome: string | null; em: string }>
  empresaCodigo: number
  redeId: string | null
}) => {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const meuNome = user?.email ?? null
  const slugs = fuels.map((f) => f.slug)
  type Draft = { postos: string; precos: Partial<Record<FuelSlug, string>> }
  const seed = useMemo(() => {
    const d: Record<string, Draft> = {}
    for (const [nome, v] of atual) {
      d[nome] = { postos: String(v.postos), precos: Object.fromEntries(Object.entries(v.precos).map(([k, p]) => [k, p != null ? String(p).replace('.', ',') : ''])) }
    }
    return d
  }, [atual])
  const [draft, setDraft] = useState<Record<string, Draft>>(seed)
  const [novos, setNovos] = useState<{ id: number; nome: string; postos: string; precos: Partial<Record<FuelSlug, string>> }[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  // Exclusão de concorrente salvo (master-only via RLS): confirmação inline por linha.
  const [pendingDel, setPendingDel] = useState<string | null>(null)
  const [delBusy, setDelBusy] = useState(false)

  const handleDelete = async (nome: string) => {
    setDelBusy(true); setMsg(null)
    const res = await deleteConcorrente({ empresaCodigo, concorrenteNome: nome, porNome: meuNome })
    setDelBusy(false); setPendingDel(null)
    if (!res.ok) {
      setMsg({ ok: false, text: res.error?.includes('row-level security') ? 'Sem permissão para excluir (só master).' : (res.error ?? 'Erro ao excluir.') })
      return
    }
    if ((res.count ?? 0) === 0) { setMsg({ ok: false, text: 'Sem permissão para excluir (só master).' }); return }
    setDraft((d) => { const nd = { ...d }; delete nd[nome]; return nd })
    setMsg({ ok: true, text: `Concorrente "${nome}" excluído.` })
    qc.invalidateQueries({ queryKey: ['concorrencia', empresaCodigo] })
    qc.invalidateQueries({ queryKey: ['concorrencia-excluidos', empresaCodigo] })
  }

  const setPreco = (nome: string, slug: FuelSlug, val: string) =>
    setDraft((d) => ({ ...d, [nome]: { ...d[nome], precos: { ...d[nome].precos, [slug]: val } } }))
  const setNovoPreco = (id: number, slug: FuelSlug, val: string) =>
    setNovos((ns) => ns.map((n) => (n.id === id ? { ...n, precos: { ...n.precos, [slug]: val } } : n)))

  const parse = (s?: string) => { if (!s) return NaN; return parseFloat(s.replace(',', '.')) }

  const handleSave = async () => {
    if (redeId == null) { setMsg({ ok: false, text: 'Rede não carregada.' }); return }
    setSaving(true); setMsg(null)
    const rows: ConcorrenciaPrecoInsert[] = []
    // existentes alterados
    for (const [nome, d] of Object.entries(draft)) {
      const base = atual.get(nome)
      for (const slug of slugs) {
        const v = parse(d.precos[slug])
        if (!isFinite(v) || v <= 0) continue
        const cur = base?.precos[slug]
        if (cur != null && Math.abs(cur - v) < 0.0005) continue // inalterado
        rows.push({ rede_id: redeId, empresa_codigo: empresaCodigo, combustivel: slug, concorrente_nome: nome.trim(), concorrente_postos: Math.max(1, Math.round(parse(d.postos)) || 1), preco: v, fonte: 'observado', created_by_nome: meuNome })
      }
    }
    // novos concorrentes
    for (const n of novos) {
      const nome = n.nome.trim()
      if (!nome) continue
      for (const slug of slugs) {
        const v = parse(n.precos[slug])
        if (!isFinite(v) || v <= 0) continue
        rows.push({ rede_id: redeId, empresa_codigo: empresaCodigo, combustivel: slug, concorrente_nome: nome, concorrente_postos: Math.max(1, Math.round(parse(n.postos)) || 1), preco: v, fonte: 'observado', created_by_nome: meuNome })
      }
    }
    if (rows.length === 0) { setSaving(false); setMsg({ ok: false, text: 'Nada alterado pra salvar.' }); return }
    const res = await insertConcorrenciaPrecos(rows)
    setSaving(false)
    if (!res.ok) {
      setMsg({ ok: false, text: res.error?.includes('row-level security') ? 'Sem permissão de cadastro de praça (peça ao admin).' : (res.error ?? 'Erro ao salvar.') })
      return
    }
    setMsg({ ok: true, text: `${rows.length} preço(s) registrado(s).` })
    setNovos([])
    qc.invalidateQueries({ queryKey: ['concorrencia', empresaCodigo] })
  }

  const nomes = Object.keys(draft)
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-gray-100 text-left text-[10px] uppercase tracking-wide text-gray-400 dark:border-gray-800">
            <th className="px-3 py-2 font-semibold">Concorrente</th>
            <th className="px-2 py-2 text-center font-semibold">
              <span className="inline-flex items-center gap-1">nº postos<InfoHint text="Quantos postos o concorrente opera — peso na média de praça ponderada (concorrente com mais postos pesa mais)." /></span>
            </th>
            {fuels.map((f) => <th key={f.slug} className="px-2 py-2 text-right font-semibold">{f.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
          {nomes.map((nome) => (
            <tr key={nome}>
              <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">
                <div className="flex items-center gap-1.5">
                  {pendingDel === nome ? (
                    <span className="inline-flex items-center gap-1">
                      <button type="button" onClick={() => handleDelete(nome)} disabled={delBusy}
                        aria-label={`Confirmar exclusão de ${nome}`}
                        className="inline-flex h-6 items-center gap-1 rounded bg-red-600 px-1.5 text-[10px] font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                        <Check className="h-3 w-3" /> {delBusy ? 'Excluindo…' : 'Excluir'}
                      </button>
                      <button type="button" onClick={() => setPendingDel(null)} aria-label="Cancelar exclusão"
                        className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setPendingDel(nome)}
                      aria-label={`Excluir concorrente ${nome}`}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-300 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-600 dark:hover:bg-red-950/30 dark:hover:text-red-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <span>{nome}</span>
                </div>
                {autores[nome] && (
                  <span className="mt-0.5 flex items-center gap-1 pl-[1.875rem] text-[10px] font-normal text-gray-400 dark:text-gray-500">
                    <User className="h-2.5 w-2.5 shrink-0" />
                    {autores[nome].porNome ?? 'autor não registrado'} · {dataBR(autores[nome].em)}
                    <InfoHint text="Quem fez o último lançamento de preço deste concorrente." />
                  </span>
                )}
              </td>
              <td className="px-2 py-2 text-center">
                <input value={draft[nome].postos} onChange={(e) => setDraft((d) => ({ ...d, [nome]: { ...d[nome], postos: e.target.value } }))}
                  className="w-12 rounded border border-gray-200 bg-white px-1.5 py-1 text-center tabular-nums dark:border-gray-700 dark:bg-gray-800" inputMode="numeric" />
              </td>
              {fuels.map((f) => (
                <td key={f.slug} className="px-2 py-1.5 text-right">
                  <input value={draft[nome].precos[f.slug] ?? ''} onChange={(e) => setPreco(nome, f.slug, e.target.value)} placeholder="—"
                    className="w-16 rounded border border-gray-200 bg-white px-1.5 py-1 text-right tabular-nums focus:border-[#2563eb] dark:border-gray-700 dark:bg-gray-800" inputMode="decimal" />
                </td>
              ))}
            </tr>
          ))}
          {/* ★ meu posto (referência, não editável) */}
          <tr className="bg-blue-50/40 dark:bg-blue-950/15">
            <td className="px-3 py-2 font-bold text-[#2563eb] dark:text-blue-300">★ Meu posto</td>
            <td className="px-2 py-2 text-center tabular-nums text-gray-500">1</td>
            {fuels.map((f) => <td key={f.slug} className="px-2 py-2 text-right font-bold tabular-nums text-[#2563eb] dark:text-blue-300">{f.myPrice != null ? r3(f.myPrice) : '—'}</td>)}
          </tr>
          {/* média ponderada do mercado */}
          <tr className="border-t border-gray-200 dark:border-gray-700">
            <td className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Média do mercado (ponderada)</td>
            <td className="px-2 py-2 text-center tabular-nums text-gray-400">{fuels.reduce((s, f) => Math.max(s, f.competidores.reduce((x, c) => x + c.postos, 0)), 0) || '—'}</td>
            {fuels.map((f) => <td key={f.slug} className="px-2 py-2 text-right font-semibold tabular-nums text-gray-700 dark:text-gray-200">{f.mediaPonderada != null ? r3(f.mediaPonderada) : '—'}</td>)}
          </tr>
          {/* novos concorrentes (draft) */}
          {novos.map((n) => (
            <tr key={n.id} className="bg-emerald-50/30 dark:bg-emerald-950/10">
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => setNovos((ns) => ns.filter((x) => x.id !== n.id))}
                    aria-label="Remover concorrente"
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400">
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <input value={n.nome} onChange={(e) => setNovos((ns) => ns.map((x) => x.id === n.id ? { ...x, nome: e.target.value } : x))} placeholder="Nome do concorrente"
                    className="w-36 rounded border border-gray-200 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-800" />
                </div>
              </td>
              <td className="px-2 py-2 text-center">
                <input value={n.postos} onChange={(e) => setNovos((ns) => ns.map((x) => x.id === n.id ? { ...x, postos: e.target.value } : x))}
                  className="w-12 rounded border border-gray-200 bg-white px-1.5 py-1 text-center tabular-nums dark:border-gray-700 dark:bg-gray-800" inputMode="numeric" />
              </td>
              {fuels.map((f) => (
                <td key={f.slug} className="px-2 py-1.5 text-right">
                  <input value={n.precos[f.slug] ?? ''} onChange={(e) => setNovoPreco(n.id, f.slug, e.target.value)} placeholder="—"
                    className="w-16 rounded border border-gray-200 bg-white px-1.5 py-1 text-right tabular-nums dark:border-gray-700 dark:bg-gray-800" inputMode="decimal" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-3 py-2.5 dark:border-gray-800">
        <button type="button" onClick={() => setNovos((ns) => [...ns, { id: Date.now() + ns.length, nome: '', postos: '1', precos: {} }])}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[12px] font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">
          <Plus className="h-3.5 w-3.5" /> Concorrente
        </button>
        <button type="button" onClick={handleSave} disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-60">
          <Save className="h-3.5 w-3.5" /> {saving ? 'Salvando…' : 'Salvar preços de hoje'}
        </button>
        {msg && <span className={cn('text-[11px]', msg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{msg.text}</span>}
        <span className="ml-auto text-[10px] text-gray-400">Salvar = registra uma observação datada (não sobrescreve). Histórico preservado.</span>
      </div>
    </div>
  )
}

/* ── Histórico 30d de 1 combustível: minha linha (fato) + pontos do concorrente ── */
const MiniHistorico = ({ f }: { f: FuelView }) => {
  const all = [...f.minhaSerie.map((p) => p.data), ...f.pontos.map((p) => p.data)]
  if (all.length === 0) return <p className="py-6 text-center text-[11px] text-gray-400">Sem histórico registrado ainda.</p>
  const xs = all.map(epochDay)
  const x0 = Math.min(...xs), x1 = Math.max(...xs)
  const precos = [...f.minhaSerie.map((p) => p.preco), ...f.pontos.map((p) => p.preco)]
  const y0 = Math.min(...precos) * 0.998, y1 = Math.max(...precos) * 1.002
  const sx = (iso: string) => (x1 > x0 ? ((epochDay(iso) - x0) / (x1 - x0)) * 280 + 10 : 150)
  const sy = (v: number) => (y1 > y0 ? 90 - ((v - y0) / (y1 - y0)) * 80 : 50)
  const line = f.minhaSerie.map((p) => `${sx(p.data)},${sy(p.preco)}`).join(' ')
  return (
    <svg viewBox="0 0 300 100" className="h-28 w-full">
      {f.minhaSerie.length > 1 && <polyline points={line} fill="none" stroke="#2563eb" strokeWidth="1.6" />}
      {f.pontos.map((p, i) => <circle key={i} cx={sx(p.data)} cy={sy(p.preco)} r="2.4" fill="#94a3b8" />)}
    </svg>
  )
}

/* ── Auditoria: concorrentes excluídos (soft-delete) — quem excluiu + restaurar ── */
const HistoricoExclusoes = ({ empresaCodigo }: { empresaCodigo: number }) => {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const { data: rows = [] } = useQuery({
    queryKey: ['concorrencia-excluidos', empresaCodigo],
    queryFn: () => fetchConcorrenciaExcluidos({ empresaCodigo }),
    staleTime: 60 * 1000,
  })
  // 1 entrada por concorrente (soft-delete marca todas as linhas dele): pega a
  // exclusão mais recente (max deleted_at).
  const itens = useMemo(() => {
    const m = new Map<string, { nome: string; porNome: string | null; em: string }>()
    for (const r of rows) {
      const cur = m.get(r.concorrente_nome)
      if (!cur || (r.deleted_at ?? '') > cur.em) {
        m.set(r.concorrente_nome, { nome: r.concorrente_nome, porNome: r.deleted_by_nome, em: r.deleted_at ?? '' })
      }
    }
    return [...m.values()].sort((a, b) => b.em.localeCompare(a.em))
  }, [rows])

  if (itens.length === 0) return null

  const restaurar = async (nome: string) => {
    setBusy(nome)
    await restoreConcorrente({ empresaCodigo, concorrenteNome: nome })
    setBusy(null)
    qc.invalidateQueries({ queryKey: ['concorrencia', empresaCodigo] })
    qc.invalidateQueries({ queryKey: ['concorrencia-excluidos', empresaCodigo] })
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left">
        <History className="h-4 w-4 text-gray-400" />
        <span className="text-[12px] font-semibold text-gray-700 dark:text-gray-200">Histórico de exclusões</span>
        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">{itens.length}</span>
        <ChevronDown className={cn('ml-auto h-4 w-4 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="divide-y divide-gray-50 border-t border-gray-100 dark:divide-gray-800/60 dark:border-gray-800">
          {itens.map((it) => (
            <div key={it.nome} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 text-[12px]">
              <span className="font-medium text-gray-700 line-through dark:text-gray-300">{it.nome}</span>
              <span className="text-[11px] text-gray-400">
                excluído por <strong className="font-semibold text-gray-500 dark:text-gray-400">{it.porNome ?? 'não registrado'}</strong> em {dataBR(it.em)}
              </span>
              <button type="button" onClick={() => restaurar(it.nome)} disabled={busy === it.nome}
                className="ml-auto inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                <RotateCcw className="h-3 w-3" /> {busy === it.nome ? 'Restaurando…' : 'Restaurar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const Concorrencia = () => {
  const [posto, setPosto] = useState<number | null>(null)
  // `data.postos` vem do useRedeSetores (independe do posto), então a 1ª render
  // já lista os postos e o efeito seleciona o primeiro.
  const data = useConcorrencia(posto)
  useEffect(() => {
    if (posto == null && data.postos.length > 0) setPosto(data.postos[0].empresaCodigo)
  }, [data.postos, posto])
  const redeId = useTenantStore((s) => s.rede?.id ?? null)
  const usarPraca = useComercialFlags((s) => s.usarPrecoPraca)
  const [fuelSel, setFuelSel] = useState<FuelSlug | null>(null)

  const atualPivot = useMemo(() => {
    const m = new Map<string, { postos: number; precos: Partial<Record<FuelSlug, number>> }>()
    for (const f of data.byFuel) {
      for (const c of f.competidores) {
        const e = m.get(c.nome) ?? { postos: c.postos, precos: {} }
        e.postos = c.postos
        e.precos[f.slug] = c.preco
        m.set(c.nome, e)
      }
    }
    return m
  }, [data.byFuel])

  const fuelChart = useMemo(
    () => data.byFuel.find((f) => f.slug === fuelSel) ?? data.byFuel.find((f) => f.pontos.length > 0) ?? data.byFuel[0] ?? null,
    [data.byFuel, fuelSel],
  )

  if (data.isLoading && data.byFuel.length === 0) {
    return <div className="space-y-4"><Skeleton className="h-10 w-72 rounded-lg" /><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-28 rounded-2xl" /></div><Skeleton className="h-64 rounded-2xl" /></div>
  }

  // Frescor do combustível SELECIONADO (não o global) — o badge fica ao lado do
  // gráfico daquele combustível, então o stale precisa ser o dele.
  const stale = fuelChart?.maxStaleDays ?? null
  const frescorOk = stale != null && stale <= 3
  const confianca = stale == null ? null : Math.min(100, Math.max(20, 100 - stale * 4)) // cai ~4pp/dia

  return (
    <div className="space-y-4">
      {/* Seletor de posto */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">Meu posto:</span>
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-gray-50 p-0.5 dark:bg-[#0f0f0f]">
          {data.postos.map((p) => (
            <button key={p.empresaCodigo} type="button" onClick={() => { setPosto(p.empresaCodigo); setFuelSel(null) }}
              className={cn('rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors', posto === p.empresaCodigo ? 'bg-[#1e3a5f] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900 dark:text-gray-300')}>
              {p.posto}
            </button>
          ))}
        </div>
      </div>

      {/* base do flag + compliance */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium',
          data.hasPraca ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300')}>
          {data.hasPraca ? <ShieldCheck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          {data.hasPraca
            ? (usarPraca ? 'Flag ligado: análises da rede usam o preço de praça cadastrado.' : 'Praça cadastrada — ligue o flag pra usá-la como referência da rede.')
            : 'Sem praça cadastrada — a referência da rede segue a média interna (cadastre abaixo).'}
        </span>
        <span className="inline-flex items-center gap-1.5 text-gray-400">
          <ShieldCheck className="h-3.5 w-3.5" /> Preço público observado (placa/bomba) — nunca combinado entre concorrentes.
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-transparent bg-gradient-to-br from-[#1e3a5f] to-[#27496f] p-4 text-white shadow-sm">
          <div className="flex items-start justify-between">
            <div><div className="flex items-center gap-1"><p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Índice de preço</p><InfoHint className="text-white/60 hover:text-white" text="Seu preço médio vs a média de praça (ponderada pelo nº de postos de cada concorrente), em base 100. Abaixo de 100 = mais barato que a praça; acima = mais caro." /></div><p className="text-[10px] text-white/50">meu vs praça · 100 = média</p></div>
            <DollarSign className="h-4 w-4 text-white/70" />
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums">{data.indiceGeral != null ? Math.round(data.indiceGeral) : '—'}</p>
          <p className="mt-1 text-[11px] text-white/60">{data.indiceGeral != null ? (Math.abs(data.indiceGeral - 100) < 0.5 ? 'na média da praça' : `${Math.abs(Math.round(data.indiceGeral - 100))}% ${data.indiceGeral < 100 ? 'mais barato' : 'mais caro'} que a praça`) : 'cadastre a praça'}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
          <div className="flex items-center justify-between"><div className="flex items-center gap-1"><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Onde posso subir</p><InfoHint text="Combustível onde você está mais abaixo da praça — há espaço pra subir o preço sem perder competitividade." /></div><TrendingUp className="h-4 w-4 text-emerald-500" /></div>
          <p className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">{data.ondePossoSubir?.label ?? 'Nenhum'}</p>
          <p className="mt-0.5 text-[11px] text-gray-500">{data.ondePossoSubir ? `dá pra cobrar ~${r3(data.ondePossoSubir.gap)}/L a mais` : 'tudo na praça ou acima'}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
          <div className="flex items-center justify-between"><div className="flex items-center gap-1"><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Onde estou caro</p><InfoHint text="Combustível onde você está mais acima da praça — risco de perder volume pra concorrência." /></div><TrendingDown className="h-4 w-4 text-red-500" /></div>
          <p className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">{data.ondeEstouCaro?.label ?? 'Nenhum'}</p>
          <p className="mt-0.5 text-[11px] text-gray-500">{data.ondeEstouCaro ? `~${r3(Math.abs(data.ondeEstouCaro.gap))}/L acima — risco de perder volume` : 'tudo competitivo'}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm dark:border-amber-900/30 dark:bg-amber-950/10">
          <div className="flex items-center justify-between"><div><div className="flex items-center gap-1"><p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700/80 dark:text-amber-400/80">Quanto dá pra ganhar</p><InfoHint className="text-amber-600/70 hover:text-amber-700 dark:text-amber-400/70" text="Estimativa (teto) do lucro adicional se você alinhasse à praça os combustíveis em que está mais barato, sem ficar acima do mercado." /></div><p className="text-[10px] text-amber-700/60">teto · alinhando à praça</p></div></div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">+{formatCurrencyInt(data.ganhoPricing)}</p>
          <p className="mt-0.5 text-[10px] text-amber-700/70">subindo os mais baratos até a praça</p>
        </div>
      </div>

      {/* Tabela editável de praça */}
      {posto != null && data.byFuel.length > 0 ? (
        <PrecoEditor key={posto} fuels={data.byFuel} atual={atualPivot} autores={data.autores} empresaCodigo={posto} redeId={redeId} />
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">Sem combustíveis pra esse posto no período.</div>
      )}

      {/* Auditoria: concorrentes excluídos (quem excluiu + restaurar) */}
      {posto != null && <HistoricoExclusoes empresaCodigo={posto} />}

      {/* Histórico 30d + frescor */}
      {fuelChart && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Histórico de 30 dias</h3>
                <InfoHint text="Evolução do preço nos últimos 30 dias. A linha azul é o seu preço médio realizado (fato); os pontos cinza são observações de preço dos concorrentes registradas na tabela acima." />
              </div>
              <p className="text-[11px] text-gray-400">Sua linha = preço médio realizado (fato) · pontos = observações de concorrentes</p>
            </div>
            <div className="flex items-center gap-0.5 rounded-lg bg-gray-50 p-0.5 dark:bg-[#0f0f0f]">
              {data.byFuel.map((f) => (
                <button key={f.slug} type="button" onClick={() => setFuelSel(f.slug)}
                  className={cn('rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors', fuelChart.slug === f.slug ? 'bg-[#1e3a5f] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400')}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-3 text-[12px]">
            <span className="tabular-nums text-gray-600 dark:text-gray-300">Meu: <strong>{fuelChart.myPrice != null ? r3(fuelChart.myPrice) : '—'}</strong></span>
            <span className="tabular-nums text-gray-600 dark:text-gray-300">Praça: <strong>{fuelChart.mediaPonderada != null ? r3(fuelChart.mediaPonderada) : '—'}</strong></span>
            {fuelChart.indice != null && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums dark:bg-gray-800">índice {Math.round(fuelChart.indice)}</span>}
            {stale != null && (
              <span className={cn('ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                frescorOk ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300')}>
                <Clock className="h-3 w-3" /> alterado há {stale}d · confiança {confianca}%
              </span>
            )}
          </div>
          <MiniHistorico f={fuelChart} />
        </div>
      )}
    </div>
  )
}

export default Concorrencia
