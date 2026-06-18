import { useState } from 'react'
import { Wand2, BarChart3, LineChart, Sparkles, AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { cn } from '@/lib/utils'
import { formatCurrencyShort, formatNumber } from '@/lib/formatters'
import { useRedeAssistente } from './hooks/useRedeAssistente'
import { useDashboardGen, type DashChart } from './hooks/useDashboardGen'

interface DashItem extends DashChart {
  id: string
  prompt: string
}

const SUGGESTED = [
  'Faturamento por posto no mês atual',
  'Comparação de margem de combustível entre os postos',
  'Top 10 produtos da conveniência por faturamento',
  'Volume de gasolina por posto',
]

/** Formata o valor do eixo/tooltip conforme a unidade que a IA indicou. */
const fmtVal = (v: number, unidade?: string) => {
  if (unidade === 'R$') return formatCurrencyShort(v)
  if (unidade === '%') return `${v.toFixed(2).replace('.', ',')}%`
  if (unidade === 'L') return `${formatNumber(v)} L`
  return formatNumber(v)
}

const DashboardPanel = () => {
  const { apiKey, isUsable, status } = useRedeAssistente()
  const { generate, generating, error } = useDashboardGen(apiKey)
  const [items, setItems] = useState<DashItem[]>([])
  const [prompt, setPrompt] = useState('')

  const run = async (text: string) => {
    if (!text.trim() || generating || !isUsable) return
    setPrompt('')
    const chart = await generate(text)
    if (chart) {
      setItems((curr) => [{ ...chart, id: `d-${Date.now()}`, prompt: text }, ...curr])
    }
  }

  return (
    <div className="space-y-4">
      {/* Header com input de geração */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/40">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e3a5f]">
            <Wand2 className="h-3.5 w-3.5 text-white" />
          </div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Dashboard gerado por IA</h3>
        </div>
        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
          Descreva o que você quer ver — gráfico, comparação, ranking — e a IA monta o painel com os <strong>dados reais da rede</strong>.
        </p>

        {!isUsable ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {status === 'desabilitado' || status === 'sem-rede'
              ? 'O Cadu não está habilitado para esta rede. O Dashboard por IA depende da configuração do administrador.'
              : 'Configuração de IA pendente — o Dashboard por IA fica disponível quando o administrador configurar a chave.'}
          </div>
        ) : (
          <>
            <form
              onSubmit={(e) => { e.preventDefault(); run(prompt) }}
              className="mt-3 flex flex-col gap-2 sm:flex-row"
            >
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={generating}
                placeholder="Ex: Faturamento por posto no mês atual"
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f] disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
              <button
                type="submit"
                disabled={!prompt.trim() || generating}
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  prompt.trim() && !generating
                    ? 'bg-[#1e3a5f] text-white hover:bg-[#162d4a]'
                    : 'bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-600',
                )}
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {generating ? 'Gerando…' : 'Gerar'}
              </button>
            </form>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => run(s)}
                  disabled={generating}
                  className="rounded-full border border-gray-300 bg-white/60 px-2.5 py-1 text-[11px] text-gray-600 transition-colors hover:border-gray-500 hover:text-gray-900 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:text-gray-100"
                >
                  {s}
                </button>
              ))}
            </div>
            {error && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-red-600 dark:text-red-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                {error}
              </p>
            )}
          </>
        )}
      </div>

      {/* Estado vazio */}
      {items.length === 0 && !generating && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-900">
          <Sparkles className="mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Nenhum gráfico gerado ainda</p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Descreva o que quer ver acima — a IA busca os dados reais e monta o gráfico.</p>
        </div>
      )}

      {/* Grid de cards de gráficos */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {items.map((item) => {
            const Icon = item.type === 'line' ? LineChart : BarChart3
            const vazio = item.series.length === 0
            return (
              <div
                key={item.id}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gradient-to-br dark:from-gray-900 dark:to-[#0a0a0a]"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 text-gray-500" />
                      <h4 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</h4>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">"{item.prompt}"</p>
                  </div>
                  <button
                    onClick={() => setItems((curr) => curr.filter((x) => x.id !== item.id))}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                    title="Remover gráfico"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {vazio ? (
                  <div className="flex h-48 items-center justify-center text-center text-xs text-gray-400">
                    Sem dados pra esse pedido no período.
                  </div>
                ) : (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      {item.type === 'line' ? (
                        <ReLineChart data={item.series}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                          <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={(v) => fmtVal(v, item.unidade)} width={56} />
                          <Tooltip
                            formatter={((v: number) => [fmtVal(v, item.unidade), '']) as never}
                            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                          />
                          <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} />
                        </ReLineChart>
                      ) : (
                        <BarChart data={item.series}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                          <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={(v) => fmtVal(v, item.unidade)} width={56} />
                          <Tooltip
                            formatter={((v: number) => [fmtVal(v, item.unidade), '']) as never}
                            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                          />
                          <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default DashboardPanel
