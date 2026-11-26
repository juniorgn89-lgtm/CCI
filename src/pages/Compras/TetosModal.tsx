import { useState } from 'react'
import { cn } from '@/lib/utils'
import { formatCurrencyInt } from '@/lib/formatters'
import { Modal, ModalRodape, Erro } from '@/pages/Gestao/comumUi'
import { CAMPO, ROTULO } from '@/pages/Gestao/estiloForm'
import { SETOR_LABEL, salvarTeto, type PedidoRow, type SetorCompra, type TetoRow } from '@/api/supabase/compras'
import { useComprasBase, btnGhost } from './comum'
import { Loader2 } from 'lucide-react'
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
    <Modal open onClose={onClose} lateral titulo="Tetos de compra do mês" descricao="Valor máximo a liberar por posto e setor em cada mês. Zero = sem teto. O pedido que passar do teto não é bloqueado: ele avisa quem libera." largura="max-w-[720px]">
      <Erro msg={erro} />
      {/* Um cartão por posto; cada setor com o teto em R$ e quanto já foi liberado no mês. */}
      <div className="space-y-3">
        {base.postos.map((p) => (
          <section key={p.codigo} className="rounded-xl border border-gray-200 p-4 dark:border-white/[0.08]">
            <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">{p.fantasia || p.razao}</p>
            {p.cidade && <p className="text-[11.5px] text-gray-500 dark:text-gray-400">{p.cidade}</p>}
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              {SETORES.map((st) => {
                const k = `${p.codigo}:${st}`
                const teto = Number((valores[k] ?? '').replace(',', '.')) || 0
                const usado = liberadoNoMes(pedidos, p.codigo, st)
                const pct = teto > 0 ? Math.min(100, (usado / teto) * 100) : 0
                return (
                  <label key={st} className="block">
                    <span className={ROTULO}>{SETOR_LABEL[st]}</span>
                    <span className="relative block">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12.5px] text-gray-400">R$</span>
                      <input inputMode="decimal" value={valores[k] ?? ''} placeholder="sem teto" onChange={(e) => setValores({ ...valores, [k]: e.target.value })} onBlur={() => salvar(p.codigo, st)} disabled={salvando === k}
                        className={cn(CAMPO, 'pl-9 text-right tabular-nums')} />
                      {salvando === k && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />}
                    </span>
                    <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.08]">
                      <span className={cn('block h-full rounded-full', pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-[#1e3a5f] dark:bg-teal-500')} style={{ width: `${teto > 0 ? pct : 0}%` }} />
                    </span>
                    <span className={cn('mt-1 block text-[11.5px] tabular-nums', pct >= 100 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400')}>
                      liberado {formatCurrencyInt(usado)}{teto > 0 ? ` de ${formatCurrencyInt(teto)}` : ''}
                    </span>
                  </label>
                )
              })}
            </div>
          </section>
        ))}
      </div>
      <ModalRodape>
        <button type="button" onClick={onClose} className={btnGhost}>Fechar</button>
      </ModalRodape>
    </Modal>
  )
}

export default TetosModal
