import { useMemo, useState } from 'react'
import CalendarioVencimentos, { type ItemVencimento } from '@/pages/Financeiro/components/CalendarioVencimentos'
import ReceberDiaModal from '@/pages/Financeiro/components/ReceberDiaModal'
import type { ReceivableRow } from '@/pages/Financeiro/hooks/useFinanceData'

const onlyDate = (s: string) => (s ?? '').split('T')[0]

/**
 * Calendário do que a rede TEM A RECEBER de clientes (títulos pendentes:
 * notas, faturas, outros). Cartões e apps ficam fora: são repasses da
 * administradora, não cobrança. Clique no dia abre o modal do dia.
 */
const ReceberCalendario = ({ data }: { data: ReceivableRow[] }) => {
  const abertos = useMemo(() => data.filter((r) => r.statusTag === 'vencido' || r.statusTag === 'a-vencer'), [data])
  const itens = useMemo<ItemVencimento[]>(
    () => abertos.map((r) => ({ id: String(r.codigo), venc: onlyDate(r.dataVencimento), valor: r.valor, nome: (r.nomeCliente || `Cliente ${r.clienteCodigo}`).trim() })),
    [abertos],
  )
  const [dia, setDia] = useState<{ dia: string; ids: Set<string> } | null>(null)
  const titulosDoDia = useMemo(() => (dia ? abertos.filter((r) => dia.ids.has(String(r.codigo))) : []), [dia, abertos])
  return (
    <>
      <CalendarioVencimentos
        titulo="Calendário de recebimentos"
        itens={itens}
        onDia={(d, its) => setDia({ dia: d, ids: new Set(its.map((i) => i.id)) })}
        corVencido="orange"
        nomeItens="recebíveis"
        nota="Cartões e apps não entram aqui: são repasses da administradora, não cobrança de cliente."
        hint="Títulos a receber de clientes (notas a prazo, faturas, outros) pela data de vencimento. Laranja = vencido, a cobrar; âmbar = vence em até 7 dias; verde = depois. Subtotal da semana na lateral."
      />
      {dia && <ReceberDiaModal open onClose={() => setDia(null)} dia={dia.dia} titulos={titulosDoDia} />}
    </>
  )
}

export default ReceberCalendario
