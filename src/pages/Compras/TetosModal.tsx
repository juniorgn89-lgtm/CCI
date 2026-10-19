import { useState } from 'react'
import { cn } from '@/lib/utils'
import { formatCurrencyInt } from '@/lib/formatters'
import { Modal, ModalRodape, Erro } from '@/pages/Gestao/comumUi'
import { SETOR_LABEL, salvarTeto, type PedidoRow, type SetorCompra, type TetoRow } from '@/api/supabase/compras'
import { useComprasBase, btnGhost, inputCls } from './comum'
import { GUIAS } from '@/lib/guiasModais'
import { liberadoNoMes } from './hooks/usePedidos'

const SETORES: SetorCompra[] = ['conveniencia', 'automotivos', 'combustivel', 'outros']

/** Teto mensal de compra por posto × setor; a barra mostra quanto do mês já foi liberado. */
const TetosModal = ({ onClose, tetos, pedidos, onMudou }: { onClose: () => void; tetos: TetoRow[]; pedidos: PedidoRow[]; onMudou: () => void }) => {
  const base = useComprasBase()
  const [valores, setValores] = useState<Record<string, string>>(() => Object.fromEntries(tetos.map((t) => [`${t.empresa_codigo}:${t.setor}`, String(t.valor_mensal)])))
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState<string | null>(null)

  const salvar = async (empresa: number, setor: SetorCompra) => {
    const k = `${empresa}:${setor}`
    const v = Number((valores[k] ?? '').replace(',', '.')) || 0
    const atual = tetos.find((t) => t.empresa_codigo === empresa && t.setor === setor)?.valor_mensal ?? 0
    if (v === atual || !base.redeId) return
    setSalvando(k); setErro(null)
    try { await salvarTeto(base.redeId, empresa, setor, v, base.autor); onMudou() } catch (e) { setErro((e as Error).message) } finally { setSalvando(null) }
  }

  return (
    <Modal guia={GUIAS.tetos} fundo="" open onClose={onClose} titulo="Tetos de compra do mês" descricao="Valor máximo a liberar por posto e setor em cada mês. Zero = sem teto. O pedido que passar do teto não é bloqueado: ele avisa quem libera." largura="max-w-3xl">
      <Erro msg={erro} />
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead className="text-[10px] uppercase tracking-wider text-gray-400">
            <tr>
              <th className="py-2 pr-3 text-left font-semibold">Posto</th>
              {SETORES.map((s) => <th key={s} className="px-2 py-2 text-left font-semibold">{SETOR_LABEL[s]}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {base.postos.map((p) => (
              <tr key={p.codigo}>
                <td className="py-2 pr-3 font-medium text-gray-800 dark:text-gray-200">{p.fantasia || p.razao}</td>
                {SETORES.map((s) => {
                  const k = `${p.codigo}:${s}`
                  const teto = Number((valores[k] ?? '').replace(',', '.')) || 0
                  const usado = liberadoNoMes(pedidos, p.codigo, s)
                  const pct = teto > 0 ? Math.min(100, (usado / teto) * 100) : 0
                  return (
                    <td key={s} className="px-2 py-2 align-top">
                      <input inputMode="decimal" value={valores[k] ?? ''} placeholder="0" onChange={(e) => setValores({ ...valores, [k]: e.target.value })} onBlur={() => salvar(p.codigo, s)} disabled={salvando === k} className={cn(inputCls, 'h-8 w-28 px-2 text-right text-[12px] tabular-nums')} />
                      <div className="mt-1 h-1 w-28 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-[#1e3a5f] dark:bg-blue-500')} style={{ width: `${teto > 0 ? pct : 0}%` }} />
                      </div>
                      <p className="mt-0.5 text-[10px] tabular-nums text-gray-400">liberado {formatCurrencyInt(usado)}{teto > 0 ? ` de ${formatCurrencyInt(teto)}` : ''}</p>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ModalRodape>
        <button type="button" onClick={onClose} className={btnGhost}>Fechar</button>
      </ModalRodape>
    </Modal>
  )
}

export default TetosModal
