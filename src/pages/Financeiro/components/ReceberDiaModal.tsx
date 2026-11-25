import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import FiltrosDiaModal from '@/pages/Financeiro/components/shared/FiltrosDiaModal'
import { opcoesDe, norm, type OrdemDia } from '@/pages/Financeiro/components/shared/filtrosDia'
import BarraTarefaTitulos from '@/pages/Financeiro/components/shared/BarraTarefaTitulos'
import { usePodeCriarTarefa, type TituloSelecionado } from '@/pages/Financeiro/components/shared/tarefaTitulos'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'
import { GUIAS } from '@/lib/guiasModais'
import type { ReceivableRow } from '@/pages/Financeiro/hooks/useFinanceData'

interface Props {
  open: boolean
  onClose: () => void
  /** Dia de vencimento (yyyy-MM-dd) da linha clicada. */
  dia: string
  /** Títulos a receber em aberto que vencem nesse dia. */
  titulos: ReceivableRow[]
}

const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const onlyDate = (s: string) => (s ?? '').split('T')[0]
const brDate = (iso: string) => (iso ? onlyDate(iso).split('-').reverse().join('/') : '—')
const diaNome = (iso: string) => {
  const [y, m, d] = onlyDate(iso).split('-').map(Number)
  return DIAS_SEMANA[new Date(y, m - 1, d).getDay()]
}
const getStr = (r: ReceivableRow, k: string) => (r as Record<string, unknown>)[k] as string | undefined
const numTitulo = (r: ReceivableRow) => r.documento?.trim() || `#${r.tituloCodigo}`

/** Detalhamento dos títulos a receber que vencem num dia do calendário. */
const ReceberDiaModal = ({ open, onClose, dia, titulos }: Props) => {
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas({ limite: 200 }), staleTime: 30 * 60 * 1000 })
  const nomePosto = useMemo(() => {
    const m = new Map((empresasData?.resultados ?? []).map((e) => [e.empresaCodigo, e.fantasia || e.razao || `Posto ${e.empresaCodigo}`]))
    return (cod: number) => m.get(cod) ?? `Posto ${cod}`
  }, [empresasData])
  const [busca, setBusca] = useState('')
  const [posto, setPosto] = useState('')
  const [ordem, setOrdem] = useState<OrdemDia>('valor')
  // Seleção para criar tarefa (só com o módulo Tarefas ligado e permissão de criar).
  const podeTarefa = usePodeCriarTarefa()
  const [marcados, setMarcados] = useState<Set<number>>(() => new Set())
  const alternar = (cod: number) => setMarcados((m) => { const n = new Set(m); if (n.has(cod)) n.delete(cod); else n.add(cod); return n })

  const postos = useMemo(() => opcoesDe(titulos, (r) => String(r.empresaCodigo), (k) => nomePosto(Number(k))), [titulos, nomePosto])
  const variosPostos = postos.length > 1

  const ord = useMemo(() => {
    const q = norm(busca.trim())
    const lista = titulos.filter((r) => {
      if (posto && String(r.empresaCodigo) !== posto) return false
      if (!q) return true
      return norm(`${r.nomeCliente ?? ''} ${numTitulo(r)} ${getStr(r, 'cpfCnpjCliente') ?? ''}`).includes(q)
    })
    const nome = (r: ReceivableRow) => r.nomeCliente || ''
    return lista.sort((a, b) => ordem === 'nome' ? nome(a).localeCompare(nome(b), 'pt-BR')
      : ordem === 'emissao' ? onlyDate(a.dataMovimento).localeCompare(onlyDate(b.dataMovimento))
      : ordem === 'atraso' ? b.diasAtraso - a.diasAtraso
      : b.valor - a.valor)
  }, [titulos, busca, posto, ordem])

  const todosMarcados = ord.length > 0 && ord.every((r) => marcados.has(r.codigo))
  const algunsMarcados = !todosMarcados && ord.some((r) => marcados.has(r.codigo))
  const alternarTodos = () => setMarcados((m) => {
    const n = new Set(m)
    if (todosMarcados) ord.forEach((r) => n.delete(r.codigo)); else ord.forEach((r) => n.add(r.codigo))
    return n
  })
  const selecionados: TituloSelecionado[] = titulos.filter((r) => marcados.has(r.codigo)).map((r) => ({ nome: r.nomeCliente || `Cliente ${r.clienteCodigo}`, documento: numTitulo(r), valor: r.valor, empresaCodigo: r.empresaCodigo, posto: nomePosto(r.empresaCodigo) }))

  // Cartões de cima seguem o filtro (o que está na tabela é o que soma).
  const resumo = useMemo(() => {
    const total = ord.reduce((s, r) => s + r.valor, 0)
    const clientes = new Set(ord.map((r) => r.clienteCodigo)).size
    const vencido = titulos.some((r) => r.statusTag === 'vencido')
    const maxDias = ord.reduce((mx, r) => Math.max(mx, r.statusTag === 'vencido' ? r.diasAtraso : 0), 0)
    return { total, clientes, vencido, maxDias }
  }, [ord, titulos])

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent guia={podeTarefa ? GUIAS.receberDiaTarefa : GUIAS.receberDia} className="flex max-h-[90vh] w-[96vw] max-w-7xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="tabular-nums">{brDate(dia)}</span>
            <span className="text-sm font-normal text-gray-400">{diaNome(dia)}</span>
            <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold', resumo.vencido
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400')}>
              {resumo.vencido ? 'Vencido' : 'A vencer'}
            </span>
          </DialogTitle>
          <DialogDescription>
            {titulos.length} título{titulos.length !== 1 ? 's' : ''} · {new Set(titulos.map((r) => r.clienteCodigo)).size} cliente{new Set(titulos.map((r) => r.clienteCodigo)).size !== 1 ? 's' : ''} a receber{variosPostos ? ` · ${postos.length} postos` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Chip label="A receber no dia" value={formatCurrency(resumo.total)} />
          <Chip label="Clientes" value={String(resumo.clientes)} />
          <Chip label="Maior atraso" value={resumo.maxDias > 0 ? `${resumo.maxDias} dias` : '—'} tone={resumo.maxDias > 0 ? 'red' : undefined} />
        </div>

        <FiltrosDiaModal busca={busca} onBusca={setBusca} placeholder="Buscar cliente, documento ou CPF/CNPJ…"
          postos={postos} posto={posto} onPosto={setPosto} ordem={ordem} onOrdem={setOrdem}
          mostrando={ord.length} total={titulos.length} onLimpar={() => { setBusca(''); setPosto('') }} />

        {podeTarefa && (
          <BarraTarefaTitulos tipo="receber" dia={dia} selecionados={selecionados} vencido={resumo.vencido} onLimpar={() => setMarcados(new Set())} />
        )}

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/60">
                <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {podeTarefa && (
                    <th className="w-9 py-2 pl-3">
                      <input type="checkbox" className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-[#0d9488] dark:border-[#3e4c63]" aria-label="Selecionar todos os títulos visíveis"
                        checked={todosMarcados} ref={(el) => { if (el) el.indeterminate = algunsMarcados }} onChange={alternarTodos} />
                    </th>
                  )}
                  <th className="min-w-[260px] px-3 py-2 font-medium">Cliente</th>
                  {variosPostos && <th className="px-3 py-2 font-medium">Posto</th>}
                  <th className="px-3 py-2 font-medium">Documento</th>
                  <th className="px-3 py-2 font-medium">Emissão</th>
                  <th className="px-3 py-2 text-right font-medium">Valor</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Atraso</th>
                  <th className="px-3 py-2 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {ord.map((r) => {
                  const doc = getStr(r, 'cpfCnpjCliente')
                  return (
                    <tr key={r.codigo} className={cn('hover:bg-gray-50/70 dark:hover:bg-gray-800/40', marcados.has(r.codigo) && 'bg-teal-50/60 dark:!bg-[#0d9488]/[0.10]')}>
                      {podeTarefa && (
                        <td className="w-9 py-2 pl-3">
                          <input type="checkbox" className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-[#0d9488] dark:border-[#3e4c63]" aria-label="Selecionar título"
                            checked={marcados.has(r.codigo)} onChange={() => alternar(r.codigo)} />
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <p className="font-medium text-gray-800 dark:text-gray-200">{r.nomeCliente || `Cliente ${r.clienteCodigo}`}</p>
                        {doc && <p className="text-[10px] tabular-nums text-gray-400">{doc}</p>}
                      </td>
                      {variosPostos && <td className="max-w-[200px] truncate px-3 py-2 text-gray-600 dark:text-gray-300">{nomePosto(r.empresaCodigo)}</td>}
                      <td className="px-3 py-2 font-medium tabular-nums text-gray-700 dark:text-gray-300">{numTitulo(r)}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-500 dark:text-gray-400">{brDate(r.dataMovimento)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(r.valor)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{r.diasAtraso > 0 ? `${r.diasAtraso}d` : '—'}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold', r.statusTag === 'vencido'
                          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400')}>
                          {r.statusTag === 'vencido' ? 'Vencido' : 'A vencer'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {ord.length === 0 && (
                  <tr><td colSpan={(variosPostos ? 7 : 6) + (podeTarefa ? 1 : 0)} className="px-3 py-8 text-center text-[12px] text-gray-400">Nenhum título com esses filtros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const Chip = ({ label, value, tone }: { label: string; value: string; tone?: 'red' }) => (
  <div className="rounded-lg border border-gray-200 p-2.5 dark:border-gray-700">
    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
    <p className={cn('mt-0.5 text-sm font-bold tabular-nums', tone === 'red' ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100')}>{value}</p>
  </div>
)

export default ReceberDiaModal
