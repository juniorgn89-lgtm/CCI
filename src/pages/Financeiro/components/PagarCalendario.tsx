import { useMemo, useState } from 'react'
import CalendarioVencimentos, { type ItemVencimento } from '@/pages/Financeiro/components/CalendarioVencimentos'
import PagarDiaModal from '@/pages/Financeiro/components/PagarDiaModal'
import type { PayableRow } from '@/pages/Financeiro/hooks/useFinanceData'

const onlyDate = (s: string) => (s ?? '').split('T')[0]

/** Calendário do que a rede TEM A PAGAR (títulos abertos e parciais, pelo saldo). Clique no dia abre o modal do dia. */
const PagarCalendario = ({ data }: { data: PayableRow[] }) => {
  const abertos = useMemo(() => data.filter((r) => r.statusTag === 'vencido' || r.statusTag === 'a-vencer'), [data])
  const itens = useMemo<ItemVencimento[]>(
    () => abertos.map((r) => ({ id: String(r.codigo), venc: onlyDate(r.vencimento), valor: r.saldoRestante, nome: (r.nomeFornecedor || `Fornecedor ${r.fornecedorCodigo}`).trim() })),
    [abertos],
  )
  const [dia, setDia] = useState<{ dia: string; ids: Set<string> } | null>(null)
  const titulosDoDia = useMemo(() => (dia ? abertos.filter((r) => dia.ids.has(String(r.codigo))) : []), [dia, abertos])
  return (
    <>
      <CalendarioVencimentos
        titulo="Calendário de pagamentos"
        itens={itens}
        onDia={(d, its) => setDia({ dia: d, ids: new Set(its.map((i) => i.id)) })}
        corVencido="red"
        nomeItens="títulos"
        hint="Títulos a pagar em aberto pela data de vencimento, pelo saldo que falta pagar. Vermelho = já venceu; âmbar = vence em até 7 dias; verde = depois. Subtotal da semana na lateral."
      />
      {dia && <PagarDiaModal open onClose={() => setDia(null)} dia={dia.dia} titulos={titulosDoDia} />}
    </>
  )
}

export default PagarCalendario
