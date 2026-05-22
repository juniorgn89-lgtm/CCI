import { useState } from 'react'
import BarCell from '@/components/tables/BarCell'
import { cn } from '@/lib/utils'
import { fmt } from './formatters'
import GrupoProdutosModal, { type GrupoProduto } from './GrupoProdutosModal'

interface GrupoRow {
  grupo: string
  quantidade: number
  total: number
  margemBruta: number
}

interface MovimentacaoRow {
  label: string
  valor: number
}

export interface CaixaGeralData {
  grupos: GrupoRow[]
  gruposTotal: { quantidade: number; total: number; margemBruta: number }
  entradas: MovimentacaoRow[]
  entradasTotal: number
  saidas: MovimentacaoRow[]
  saidasTotal: number
  maxTotal: number
  maxMargemAbs: number
  maxEntrada: number
  maxSaida: number
  produtosPorGrupo: Record<string, GrupoProduto[]>
}

interface CaixaGeralProps {
  dados: CaixaGeralData
  metaLine: string
}

const CaixaGeral = ({ dados, metaLine }: CaixaGeralProps) => {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const produtos = selectedGroup ? (dados.produtosPorGrupo[selectedGroup] ?? []) : []
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Cabeçalho do relatório */}
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-4 dark:border-gray-700 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Caixa Geral</h2>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{metaLine}</p>
          </div>
        </div>
        <div className="text-left md:text-right">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">POSTO ITAPOA</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">31.465.040/0001-32</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">21/05/2026 12:13:51 BRT</p>
        </div>
      </div>

      {/* Vendas por Grupos */}
      <section className="mt-6">
        <div className="flex items-center justify-between rounded-t-md border border-b-0 border-gray-200 bg-gray-100 px-4 py-2 dark:border-gray-700 dark:bg-gray-800">
          <span className="text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">
            Vendas por Grupos
          </span>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            Clique num grupo pra ver os produtos
          </span>
        </div>
        <div className="overflow-x-auto rounded-b-md border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                <th className="px-4 py-2 text-left">Grupo</th>
                <th className="px-4 py-2 text-right">Quantidade</th>
                <th className="px-4 py-2 text-right">Total (R$)</th>
                <th className="px-4 py-2 text-right">Margem Bruta (R$)</th>
              </tr>
            </thead>
            <tbody>
              {dados.grupos.map((row) => (
                <tr
                  key={row.grupo}
                  onClick={() => setSelectedGroup(row.grupo)}
                  className="cursor-pointer border-b border-gray-100 text-gray-800 transition-colors last:border-b-0 hover:bg-blue-50/60 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-blue-900/20"
                >
                  <td className="px-4 py-2 text-left">{row.grupo}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(row.quantidade)}</td>
                  <td className="px-2 py-1.5">
                    <BarCell value={row.total} max={dados.maxTotal} formatted={fmt(row.total)} color="blue" align="near" />
                  </td>
                  <td className="px-2 py-1.5">
                    <BarCell
                      value={Math.abs(row.margemBruta)}
                      max={dados.maxMargemAbs}
                      formatted={fmt(row.margemBruta, 3)}
                      color={row.margemBruta < 0 ? 'red' : 'green'}
                      align="near"
                    />
                  </td>
                </tr>
              ))}
              <tr className="border-t border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                <td className="px-4 py-2 text-left">Total:</td>
                <td className="px-4 py-2 text-right tabular-nums">{fmt(dados.gruposTotal.quantidade)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{fmt(dados.gruposTotal.total)}</td>
                <td
                  className={cn(
                    'px-4 py-2 text-right tabular-nums',
                    dados.gruposTotal.margemBruta < 0 && 'text-red-600 dark:text-red-400',
                  )}
                >
                  {fmt(dados.gruposTotal.margemBruta, 3)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Movimentação Financeira dos Caixas */}
      <section className="mt-6">
        <div className="rounded-t-md border border-b-0 border-gray-200 bg-gray-100 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
          Movimentação Financeira dos Caixas
        </div>
        <div className="grid grid-cols-1 gap-0 rounded-b-md border border-gray-200 md:grid-cols-2 md:divide-x md:divide-gray-200 dark:border-gray-700 dark:md:divide-gray-700">
          {/* Entradas */}
          <div>
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              Entradas
            </div>
            <table className="w-full text-sm">
              <tbody>
                {dados.entradas.map((row) => (
                  <tr
                    key={row.label}
                    className="border-b border-gray-100 text-gray-800 last:border-b-0 dark:border-gray-800 dark:text-gray-200"
                  >
                    <td className="px-4 py-2 text-left">{row.label}</td>
                    <td className="px-2 py-1.5">
                      <BarCell value={row.valor} max={dados.maxEntrada} formatted={fmt(row.valor)} color="blue" align="near" />
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                  <td className="px-4 py-2 text-left">Total:</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(dados.entradasTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Saídas */}
          <div>
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              Saídas
            </div>
            <table className="w-full text-sm">
              <tbody>
                {dados.saidas.map((row) => (
                  <tr
                    key={row.label}
                    className="border-b border-gray-100 text-gray-800 last:border-b-0 dark:border-gray-800 dark:text-gray-200"
                  >
                    <td className="px-4 py-2 text-left">{row.label}</td>
                    <td className="px-2 py-1.5">
                      <BarCell value={row.valor} max={dados.maxSaida} formatted={fmt(row.valor)} color="green" align="near" />
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                  <td className="px-4 py-2 text-left">Total:</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(dados.saidasTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <GrupoProdutosModal
        open={!!selectedGroup}
        onClose={() => setSelectedGroup(null)}
        grupo={selectedGroup}
        produtos={produtos}
      />
    </div>
  )
}

export default CaixaGeral
