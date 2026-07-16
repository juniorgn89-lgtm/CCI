import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Users, Info } from 'lucide-react'
import { fetchGestaoPrecosCliente } from '@/api/supabase/gestaoPrecosCliente'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import HeaderHint from '@/components/tables/HeaderHint'

const r3 = (v?: number | null) => (v == null ? '—' : `R$ ${v.toFixed(3).replace('.', ',')}`)
const REGRA: Record<string, string> = {
  sempre: 'Sempre aplicar',
  so_bomba_maior: 'Só se bomba > tabela',
  so_bomba_menor: 'Só se bomba < tabela',
}

const GestaoPrecosCliente = () => {
  const { data: linhas = [], isLoading } = useQuery({ queryKey: ['gp-cliente'], queryFn: fetchGestaoPrecosCliente, staleTime: 5 * 60 * 1000 })
  const [busca, setBusca] = useState('')

  const filtradas = useMemo(() => {
    const q = busca.trim().toUpperCase()
    if (!q) return linhas
    return linhas.filter((l) => `${l.cliente_nome} ${l.produto_nome}`.toUpperCase().includes(q))
  }, [linhas, busca])

  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />

  if (linhas.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/60 p-10 text-center dark:border-gray-700 dark:bg-gray-900/40">
        <Users className="mx-auto mb-2 h-5 w-5 text-gray-300 dark:text-gray-600" />
        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Nenhum preço especial por cliente</p>
        <p className="mt-1 text-[12px] text-gray-400">Cadastre a tabela de preço por cliente no WebPosto para vê-la aqui.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente ou produto…"
            className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-2 text-[12.5px] focus:border-[#2563eb] focus:outline-none dark:border-gray-700 dark:bg-[#0f0f0f]" />
        </div>
        <span className="text-[11px] text-gray-400">{filtradas.length} de {linhas.length}</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-gray-100 text-left text-[10px] uppercase tracking-wide text-gray-400 dark:border-gray-800">
              <th className="px-3 py-2 font-semibold">Cliente</th>
              <th className="px-2 py-2 font-semibold">Produto</th>
              <th className="px-2 py-2 text-center font-semibold">Prazo</th>
              <th className="px-2 py-2 text-right font-semibold">Preço base</th>
              <th className="px-2 py-2 text-right font-semibold">Ajuste</th>
              <HeaderHint label="Preço calculado" align="right" className="px-2 font-semibold" help="Preço final do contrato (base ± ajuste) — a referência do cliente." />
              <th className="px-3 py-2 font-semibold">Regra</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {filtradas.map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">{l.cliente_nome}</td>
                <td className="px-2 py-2 text-gray-700 dark:text-gray-300">{l.produto_nome}</td>
                <td className="px-2 py-2 text-center text-[11px] text-gray-500 dark:text-gray-400">{l.prazo || 'Todos'}</td>
                <td className="px-2 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{r3(l.preco_base)}</td>
                <td className={cn('px-2 py-2 text-right tabular-nums font-medium', l.tipo === 'especifico' ? 'text-gray-500 dark:text-gray-400' : l.valor < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                  {l.tipo === 'especifico' ? `= ${r3(l.valor)}` : `${l.valor < 0 ? '−' : '+'}R$ ${Math.abs(l.valor).toFixed(3).replace('.', ',')}`}
                </td>
                <td className="px-2 py-2 text-right font-bold tabular-nums text-[#1e3a5f] dark:text-blue-200">{r3(l.preco_calculado)}</td>
                <td className="px-3 py-2 text-[11px] text-gray-500 dark:text-gray-400">{REGRA[l.regra] ?? l.regra}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="flex items-center gap-1.5 px-1 text-[11px] text-gray-400">
        <Info className="h-3 w-3 shrink-0" /> Espelho do contrato por cliente (preço calculado = referência). A comparação <strong>praticado × contrato por cliente</strong> chega em breve.
      </p>
    </div>
  )
}

export default GestaoPrecosCliente
