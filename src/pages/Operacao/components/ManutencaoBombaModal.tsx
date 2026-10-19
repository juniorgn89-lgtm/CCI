import { useState } from 'react'
import { Wrench, Save, Trash2, Check, X, User, History } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import InfoHint from '@/components/ui/InfoHint'
import type { BombaManutencaoRow } from '@/api/supabase/manutencaoBombas'
import { GUIAS } from '@/lib/guiasModais'

/** yyyy-MM-ddTHH:mm local (valor do input datetime-local). */
const agoraLocal = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const dataHoraBR = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/**
 * Manutenções de UMA bomba: registrar a que foi feita (data e hora, responsável,
 * observação) e o histórico. O registro fica salvo no sistema com quem lançou;
 * só o master corrige. O desgaste passa a contar da última manutenção.
 */
const ManutencaoBombaModal = ({ open, onClose, bomba, posto, registros, responsavelPadrao, onRegistrar, onExcluir, podeExcluir }: {
  open: boolean
  onClose: () => void
  bomba: string
  posto: string
  registros: BombaManutencaoRow[]
  responsavelPadrao: string
  onRegistrar: (feitaEmISO: string, responsavel: string, observacao: string) => Promise<{ ok: boolean; error?: string }>
  onExcluir: (id: string) => Promise<{ ok: boolean; error?: string }>
  podeExcluir: boolean
}) => {
  const [quando, setQuando] = useState(agoraLocal)
  const [responsavel, setResponsavel] = useState(responsavelPadrao)
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [excluindo, setExcluindo] = useState<string | null>(null)

  const salvar = async () => {
    setMsg(null)
    const data = new Date(quando)
    if (Number.isNaN(data.getTime())) { setMsg({ ok: false, text: 'Informe a data e a hora.' }); return }
    if (data.getTime() > Date.now() + 60_000) { setMsg({ ok: false, text: 'A data e hora não podem estar no futuro.' }); return }
    if (!responsavel.trim()) { setMsg({ ok: false, text: 'Informe quem fez a manutenção.' }); return }
    setSalvando(true)
    const res = await onRegistrar(data.toISOString(), responsavel, observacao)
    setSalvando(false)
    if (!res.ok) { setMsg({ ok: false, text: res.error ?? 'Erro ao salvar.' }); return }
    setMsg({ ok: true, text: 'Manutenção registrada. O desgaste desta bomba recomeça a contar a partir dela.' })
    setObservacao('')
    setQuando(agoraLocal())
  }

  const excluir = async (id: string) => {
    const res = await onExcluir(id)
    setExcluindo(null)
    setMsg(res.ok ? { ok: true, text: 'Registro excluído.' } : { ok: false, text: res.error ?? 'Erro ao excluir.' })
  }

  const inputCls = 'mt-1 w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent guia={GUIAS.manutencaoBomba} className="max-h-[88vh] w-[95vw] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e3a5f] text-white"><Wrench className="h-4 w-4" /></span>
            Manutenções · {bomba}
          </DialogTitle>
          <DialogDescription>{posto}</DialogDescription>
        </DialogHeader>

        {/* Registrar */}
        <section className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-gray-700 dark:bg-gray-800/30">
          <h4 className="mb-2 flex items-center gap-1 text-[13px] font-semibold text-gray-900 dark:text-gray-100">
            Registrar manutenção feita
            <InfoHint text="Lance a manutenção que foi feita nesta bomba. A partir desse momento o desgaste recomeça do zero: passa a contar só os litros vendidos depois da manutenção. Pode lançar uma manutenção que já aconteceu (data passada), nunca no futuro. Fica salvo com quem registrou." />
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Data e hora</span>
              <input type="datetime-local" value={quando} max={agoraLocal()} onChange={(e) => setQuando(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Responsável</span>
              <input type="text" value={responsavel} placeholder="Quem fez (técnico ou empresa)" onChange={(e) => setResponsavel(e.target.value)} className={inputCls} />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Observação (opcional)</span>
              <input type="text" value={observacao} placeholder="Ex.: troca de filtro, aferição, reparo no bico 3" onChange={(e) => setObservacao(e.target.value)} className={inputCls} />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={salvar} disabled={salvando}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1e3a5f] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#172d4a] disabled:opacity-60">
              <Save className="h-3.5 w-3.5" />{salvando ? 'Salvando…' : 'Registrar manutenção'}
            </button>
            {msg && <span className={cn('text-[11px]', msg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{msg.text}</span>}
          </div>
        </section>

        {/* Histórico */}
        <section>
          <h4 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-gray-900 dark:text-gray-100">
            <History className="h-4 w-4 text-gray-400" /> Histórico
            <span className="text-[11px] font-normal text-gray-400">({registros.length})</span>
          </h4>
          {registros.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 py-6 text-center text-[12px] text-gray-400 dark:border-gray-700">
              Nenhuma manutenção registrada para esta bomba.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
              {registros.map((r, i) => (
                <li key={r.id} className="flex items-start gap-3 px-3 py-2.5 text-[12.5px]">
                  <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', i === 0 ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600')} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {dataHoraBR(r.feita_em)} · {r.responsavel ?? 'sem responsável'}
                      {i === 0 && <span className="ml-1.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">última</span>}
                    </p>
                    {r.observacao && <p className="text-gray-600 dark:text-gray-300">{r.observacao}</p>}
                    <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-gray-400"><User className="h-2.5 w-2.5" />registrado por {r.created_by_nome ?? 'autor não registrado'} em {dataHoraBR(r.created_at)}</p>
                  </div>
                  {podeExcluir && (excluindo === r.id ? (
                    <span className="inline-flex shrink-0 items-center gap-1">
                      <button type="button" onClick={() => excluir(r.id)} className="inline-flex h-6 items-center gap-1 rounded bg-red-600 px-1.5 text-[10px] font-semibold text-white hover:bg-red-700"><Check className="h-3 w-3" />Excluir</button>
                      <button type="button" onClick={() => setExcluindo(null)} aria-label="Cancelar" className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-3.5 w-3.5" /></button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setExcluindo(r.id)} aria-label="Corrigir: excluir este registro (só master)"
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-300 hover:bg-red-50 hover:text-red-600 dark:text-gray-600 dark:hover:bg-red-950/30"><Trash2 className="h-3.5 w-3.5" /></button>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </section>
      </DialogContent>
    </Dialog>
  )
}

export default ManutencaoBombaModal
