import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Upload, X, FileSpreadsheet } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useTenantStore } from '@/store/tenant'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { importGestaoPrecoTabela } from '@/api/supabase/gestaoPrecosTabelas'
import { cn } from '@/lib/utils'

/** Parse BR de preço: "6,250" → 6.25; "1.234,56" → 1234.56. */
const parseBR = (s: string): number => parseFloat(s.replace(/[R$\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))

const ImportTabelaModal = ({ open, onClose, onImported }: {
  open: boolean
  onClose: () => void
  onImported: () => void
}) => {
  const redeId = useTenantStore((s) => s.rede?.id ?? null)
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas({ limite: 200 }), staleTime: 30 * 60 * 1000 })
  const postos = useMemo(
    () => (empresasData?.resultados ?? []).map((e) => ({ codigo: e.empresaCodigo, nome: e.fantasia || e.razao || `Posto ${e.empresaCodigo}` })).sort((a, b) => a.nome.localeCompare(b.nome)),
    [empresasData],
  )

  const [ref, setRef] = useState('')
  const [descricao, setDescricao] = useState('')
  const [vi, setVi] = useState('')
  const [vf, setVf] = useState('')
  const [filialCodigo, setFilialCodigo] = useState<number | null>(null)
  const [texto, setTexto] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const itens = useMemo(() => {
    const out: { produto_nome: string; valor: number }[] = []
    for (const line of texto.split('\n')) {
      const t = line.trim()
      if (!t) continue
      const parts = t.split(/\t|;/).map((s) => s.trim()).filter(Boolean)
      if (parts.length < 2) continue
      const valor = parseBR(parts[parts.length - 1])
      const produto = parts[0]
      if (!produto || !isFinite(valor)) continue
      out.push({ produto_nome: produto, valor })
    }
    return out
  }, [texto])

  // Upload XLSX → acha as colunas Produto + Valor pelo cabeçalho → preenche o texto.
  const handleFile = async (file: File) => {
    setMsg(null)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as string[][]
      let hdr = -1, ipro = -1, ival = -1
      for (let i = 0; i < aoa.length; i++) {
        const row = (aoa[i] ?? []).map((c) => String(c ?? '').toLowerCase().trim())
        const p = row.findIndex((c) => c.includes('produto'))
        const v = row.findIndex((c) => c.startsWith('valor'))
        if (p >= 0 && v >= 0) { hdr = i; ipro = p; ival = v; break }
      }
      if (hdr < 0) { setMsg({ ok: false, text: 'Não achei as colunas "Produto" e "Valor" no arquivo.' }); return }
      const lines: string[] = []
      for (let i = hdr + 1; i < aoa.length; i++) {
        const produto = String(aoa[i]?.[ipro] ?? '').trim()
        const valor = String(aoa[i]?.[ival] ?? '').trim()
        if (produto && valor) lines.push(`${produto}\t${valor}`)
      }
      setTexto(lines.join('\n'))
      setMsg({ ok: true, text: `${lines.length} linha(s) lida(s) do XLSX.` })
    } catch (e) {
      setMsg({ ok: false, text: `Erro ao ler o arquivo: ${(e as Error).message}` })
    }
  }

  const handleImport = async () => {
    if (!redeId) { setMsg({ ok: false, text: 'Rede não carregada.' }); return }
    if (!ref.trim() || !descricao.trim()) { setMsg({ ok: false, text: 'Preencha Ref e Descrição.' }); return }
    if (itens.length === 0) { setMsg({ ok: false, text: 'Suba o XLSX (ou cole linhas "Produto [tab] Valor").' }); return }
    setBusy(true); setMsg(null)
    const posto = postos.find((p) => p.codigo === filialCodigo)
    const res = await importGestaoPrecoTabela({
      redeId,
      ref: ref.trim(),
      descricao: descricao.trim(),
      validadeInicial: vi || null,
      validadeFinal: vf || null,
      diasSemana: null,
      filialNome: posto?.nome ?? null,
      filialEmpresaCodigo: filialCodigo,
      itens,
    })
    setBusy(false)
    if (!res.ok) {
      setMsg({ ok: false, text: res.error?.includes('row-level security') ? 'Sem permissão (só master importa).' : (res.error ?? 'Erro ao importar.') })
      return
    }
    setMsg({ ok: true, text: `${res.count} linha(s) importada(s).` })
    onImported()
    setTimeout(onClose, 700)
  }

  const inp = 'w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[13px] focus:border-[#2563eb] focus:outline-none dark:border-gray-700 dark:bg-gray-800'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-[15px] font-bold">Importar tabela de preço</DialogTitle>
        <DialogDescription className="text-[12px]">
          No WebPosto: <strong>Exportar XLSX</strong> → suba o arquivo aqui. Leio as colunas <strong>Produto</strong> e <strong>Valor</strong> automaticamente.
        </DialogDescription>

        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[11px] font-medium text-gray-500">Ref</label><input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="00003" className={inp} /></div>
            <div><label className="text-[11px] font-medium text-gray-500">Descrição</label><input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="BARATAO" className={inp} /></div>
            <div><label className="text-[11px] font-medium text-gray-500">Validade inicial</label><input type="date" value={vi} onChange={(e) => setVi(e.target.value)} className={inp} /></div>
            <div><label className="text-[11px] font-medium text-gray-500">Validade final (vazio = aberta)</label><input type="date" value={vf} onChange={(e) => setVf(e.target.value)} className={inp} /></div>
            <div className="col-span-2">
              <label className="text-[11px] font-medium text-gray-500">Filial</label>
              <select value={filialCodigo ?? ''} onChange={(e) => setFilialCodigo(e.target.value ? Number(e.target.value) : null)} className={inp}>
                <option value="">Todas as filiais</option>
                {postos.map((p) => <option key={p.codigo} value={p.codigo}>{p.nome}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">Arquivo (Exportar XLSX)</label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[12px] font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Escolher XLSX
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </label>
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-500">Linhas (auto do XLSX, ou cole "Produto [tab] Valor")</label>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={5}
              className={cn(inp, 'font-mono text-[12px]')} />
            <p className="mt-0.5 text-[10.5px] text-gray-400">{itens.length} linha(s) reconhecida(s). Substitui as linhas atuais desta Ref.</p>
          </div>

          {msg && <p className={cn('text-[12px]', msg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{msg.text}</p>}
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[13px] font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400"><X className="h-3.5 w-3.5" />Cancelar</button>
          <button type="button" onClick={handleImport} disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-60">
            <Upload className="h-3.5 w-3.5" /> {busy ? 'Importando…' : 'Importar'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ImportTabelaModal
