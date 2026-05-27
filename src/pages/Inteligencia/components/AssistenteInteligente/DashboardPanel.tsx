import { useState } from 'react'
import { Wand2, Download, FileSpreadsheet, BarChart3, LineChart, PieChart, Table2 } from 'lucide-react'
import { LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { cn } from '@/lib/utils'

interface DashItem {
  id: string
  prompt: string
  type: 'line' | 'bar' | 'table'
  title: string
  data: Array<{ label: string; value: number; valueB?: number }>
}

const SUGGESTED = [
  'Evolução das vendas de gasolina nos últimos 6 meses',
  'Comparação de margem entre as 3 unidades',
  'Top 10 produtos da conveniência por faturamento',
  'Conversão dos frentistas no último mês',
]

const MOCK_DASH: DashItem[] = [
  {
    id: 'd1',
    prompt: 'Evolução das vendas de gasolina nos últimos 6 meses',
    type: 'line',
    title: 'Vendas de Gasolina · 6 meses',
    data: [
      { label: 'Dez', value: 142000 },
      { label: 'Jan', value: 138500 },
      { label: 'Fev', value: 145800 },
      { label: 'Mar', value: 152300 },
      { label: 'Abr', value: 158900 },
      { label: 'Mai', value: 164200 },
    ],
  },
  {
    id: 'd2',
    prompt: 'Comparação de margem entre as 3 unidades',
    type: 'bar',
    title: 'Margem por posto (%)',
    data: [
      { label: 'Centro', value: 12.4 },
      { label: 'Norte', value: 10.8 },
      { label: 'Sul', value: 13.6 },
    ],
  },
]

const DashboardPanel = () => {
  const [items, setItems] = useState<DashItem[]>(MOCK_DASH)
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)

  const generate = async (text: string) => {
    if (!text.trim() || generating) return
    setGenerating(true)
    setPrompt('')
    await new Promise((r) => setTimeout(r, 1100))
    const isBar = /compar|ranking|top/i.test(text)
    const newItem: DashItem = {
      id: `d-${Date.now()}`,
      prompt: text,
      type: isBar ? 'bar' : 'line',
      title: text.slice(0, 60),
      data: isBar
        ? [
            { label: 'Item A', value: Math.round(60 + Math.random() * 40) },
            { label: 'Item B', value: Math.round(60 + Math.random() * 40) },
            { label: 'Item C', value: Math.round(60 + Math.random() * 40) },
            { label: 'Item D', value: Math.round(60 + Math.random() * 40) },
          ]
        : Array.from({ length: 6 }).map((_, i) => ({
            label: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'][i],
            value: Math.round(80 + i * 10 + Math.random() * 20),
          })),
    }
    setItems((curr) => [newItem, ...curr])
    setGenerating(false)
  }

  return (
    <div className="space-y-4">
      {/* Header com input de geração */}
      <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-purple-50/60 to-blue-50/40 p-4 dark:border-gray-700 dark:from-purple-900/10 dark:to-blue-900/10">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 shadow-md shadow-purple-500/20">
            <Wand2 className="h-3.5 w-3.5 text-white" />
          </div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Dashboard gerado por IA</h3>
        </div>
        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
          Descreva o que você quer ver — gráfico, comparação, ranking — e a IA monta o painel pra você.
        </p>
        <form
          onSubmit={(e) => { e.preventDefault(); generate(prompt) }}
          className="mt-3 flex flex-col gap-2 sm:flex-row"
        >
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ex: Evolução das vendas de gasolina nos últimos 6 meses"
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          <button
            type="submit"
            disabled={!prompt.trim() || generating}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              prompt.trim() && !generating
                ? 'bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-md shadow-purple-500/30 hover:opacity-90'
                : 'bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-600',
            )}
          >
            <Wand2 className="h-4 w-4" />
            {generating ? 'Gerando…' : 'Gerar'}
          </button>
        </form>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUGGESTED.map((s) => (
            <button
              key={s}
              onClick={() => generate(s)}
              className="rounded-full border border-gray-300 bg-white/60 px-2.5 py-1 text-[11px] text-gray-600 transition-colors hover:border-purple-300 hover:text-purple-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400 dark:hover:border-purple-500/40 dark:hover:text-purple-300"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de cards de gráficos */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {items.map((item) => {
          const Icon = item.type === 'line' ? LineChart : item.type === 'bar' ? BarChart3 : item.type === 'table' ? Table2 : PieChart
          return (
            <div
              key={item.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gradient-to-br dark:from-gray-900 dark:to-[#0a0a0a]"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-purple-500" />
                    <h4 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</h4>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">"{item.prompt}"</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                    title="Exportar Excel"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                    title="Exportar PDF"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  {item.type === 'line' ? (
                    <ReLineChart data={item.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                      />
                      <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} />
                    </ReLineChart>
                  ) : (
                    <BarChart data={item.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                      <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default DashboardPanel
