import { useState } from 'react'
import { Droplets, Wrench, Store, Globe, LineChart, HelpCircle } from 'lucide-react'
import { formatCurrency, formatCurrencyInt } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/store/filters'
import CombustivelDetailModal from './modals/CombustivelDetailModal'
import AutomotivosDetailModal from './modals/AutomotivosDetailModal'
import ConvenienciaDetailModal from './modals/ConvenienciaDetailModal'
import GlobalDetailModal from './modals/GlobalDetailModal'
import ProjecaoDetailModal from './modals/ProjecaoDetailModal'

/* ─── Mock por segmento ────────────────────────────────────
 * Automotivos = produtos com tipo != C e centro de custo = PISTA.
 * Valores mockados — quando o backend fornecer breakdown por segmento, é só
 * trocar os literais por dados reais (a estrutura dos cards continua igual).
 * ────────────────────────────────────────────────────────── */
const segments = {
  combustivel: { lucroBruto: 562225, margem: 11.35, lucroPorLitro: 0.67 },
  automotivos: { lucroBruto: 103385, faturamento: 162613, margem: 63.58 },
  conveniencia: { lucroBruto: 166254, faturamento: 334167, margem: 49.75 },
  global: { lucroBruto: 831864, faturamento: 5450987, margem: 15.26 },
}

const projecaoLinhas = [
  { setor: 'Automotivos', faturamento: 210042, lucroBruto: 133539, margem: 63.58 },
  { setor: 'Combustível', faturamento: 6399183, lucroBruto: 726207, margem: 11.35 },
  { setor: 'Conveniência', faturamento: 431633, lucroBruto: 214745, margem: 49.75 },
]
const projecaoTotal = {
  faturamento: projecaoLinhas.reduce((s, r) => s + r.faturamento, 0),
  lucroBruto: projecaoLinhas.reduce((s, r) => s + r.lucroBruto, 0),
  margem: 15.26,
}

const fmtPct = (v: number): string => `${v.toFixed(2).replace('.', ',')}%`

type ModalKey = 'combustivel' | 'automotivos' | 'conveniencia' | 'global' | 'projecao' | null

interface SegmentCardProps {
  label: string
  Icon: typeof Droplets
  cardBg: string
  iconBg: string
  iconColor: string
  lucroBruto: number
  primary?: { label: string; value: string }
  secondary?: { label: string; value: string }
  onClick?: () => void
}

const SegmentCard = ({ label, Icon, cardBg, iconBg, iconColor, lucroBruto, primary, secondary, onClick }: SegmentCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'flex w-full flex-col rounded-xl border border-gray-200 p-5 text-left shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-gray-700',
      onClick && 'cursor-pointer hover:-translate-y-0.5',
      cardBg,
    )}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</p>
        <p className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
          Lucro bruto
          <span
            className="group relative inline-flex cursor-help"
            tabIndex={0}
            onClick={(e) => e.stopPropagation()}
            aria-label="O que é Lucro bruto?"
          >
            <HelpCircle className="h-3 w-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
            <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-60 -translate-x-1/2 rounded-md bg-gray-900 px-3 py-2 text-[11px] font-normal normal-case leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100 dark:bg-gray-700">
              <strong>Faturamento − Custo</strong> dos produtos vendidos. Não inclui
              despesas operacionais, impostos ou descontos comerciais.
            </span>
          </span>
        </p>
      </div>
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconBg)}>
        <Icon className={cn('h-5 w-5', iconColor)} />
      </div>
    </div>
    <p className="mt-3 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
      {formatCurrencyInt(lucroBruto)}
    </p>
    {(primary || secondary) && (
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
        {primary && (
          <div>
            <p className="text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100">{primary.value}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{primary.label}</p>
          </div>
        )}
        {secondary && (
          <div>
            <p className="text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100">{secondary.value}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{secondary.label}</p>
          </div>
        )}
      </div>
    )}
    {onClick && (
      <p className="mt-2 text-right text-[10px] text-gray-400 dark:text-gray-500">Ver detalhes →</p>
    )}
  </button>
)

const ProjecoesPainel = () => {
  const dataInicial = useFilterStore((s) => s.dataInicial)
  const dataFinal = useFilterStore((s) => s.dataFinal)
  const [openModal, setOpenModal] = useState<ModalKey>(null)

  // Faturamento de combustível derivado da margem (mantém consistência com o card).
  const combustivelFaturamento =
    segments.combustivel.margem > 0 ? segments.combustivel.lucroBruto / (segments.combustivel.margem / 100) : 0

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SegmentCard
          label="Combustível"
          Icon={Droplets}
          cardBg="bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900"
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          iconColor="text-blue-600 dark:text-blue-400"
          lucroBruto={segments.combustivel.lucroBruto}
          primary={{ label: 'Margem', value: fmtPct(segments.combustivel.margem) }}
          secondary={{ label: 'L. bruto / litro', value: formatCurrency(segments.combustivel.lucroPorLitro) }}
          onClick={() => setOpenModal('combustivel')}
        />

        <SegmentCard
          label="Automotivos"
          Icon={Wrench}
          cardBg="bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900"
          iconBg="bg-amber-100 dark:bg-amber-900/30"
          iconColor="text-amber-600 dark:text-amber-400"
          lucroBruto={segments.automotivos.lucroBruto}
          primary={{ label: 'Faturamento', value: formatCurrencyInt(segments.automotivos.faturamento) }}
          secondary={{ label: 'Margem', value: fmtPct(segments.automotivos.margem) }}
          onClick={() => setOpenModal('automotivos')}
        />

        <SegmentCard
          label="Conveniência"
          Icon={Store}
          cardBg="bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900"
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          iconColor="text-emerald-600 dark:text-emerald-400"
          lucroBruto={segments.conveniencia.lucroBruto}
          primary={{ label: 'Faturamento', value: formatCurrencyInt(segments.conveniencia.faturamento) }}
          secondary={{ label: 'Margem', value: fmtPct(segments.conveniencia.margem) }}
          onClick={() => setOpenModal('conveniencia')}
        />

        <SegmentCard
          label="Global"
          Icon={Globe}
          cardBg="bg-gradient-to-br from-violet-50/60 to-white dark:from-violet-950/20 dark:to-gray-900"
          iconBg="bg-violet-100 dark:bg-violet-900/30"
          iconColor="text-violet-600 dark:text-violet-400"
          lucroBruto={segments.global.lucroBruto}
          primary={{ label: 'Faturamento', value: formatCurrencyInt(segments.global.faturamento) }}
          secondary={{ label: 'Margem', value: fmtPct(segments.global.margem) }}
          onClick={() => setOpenModal('global')}
        />

        {/* Projeção — tabela compacta */}
        <button
          type="button"
          onClick={() => setOpenModal('projecao')}
          className="flex flex-col rounded-xl border border-gray-200 bg-gradient-to-br from-slate-50/60 to-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-gray-700 dark:from-slate-900/40 dark:to-gray-900"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Projeção</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Fim do período</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
              <LineChart className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            </div>
          </div>
          <table className="mt-3 w-full text-[11px]">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <th className="py-1 font-medium">Setor</th>
                <th className="py-1 text-right font-medium">Faturamento</th>
                <th className="py-1 text-right font-medium">Lucro bruto</th>
                <th className="py-1 text-right font-medium">Margem</th>
              </tr>
            </thead>
            <tbody className="text-gray-800 dark:text-gray-200">
              {projecaoLinhas.map((r) => (
                <tr key={r.setor} className="border-b border-gray-100 last:border-b-0 dark:border-gray-800">
                  <td className="py-1">{r.setor}</td>
                  <td className="py-1 text-right tabular-nums">{formatCurrencyInt(r.faturamento)}</td>
                  <td className="py-1 text-right tabular-nums">{formatCurrencyInt(r.lucroBruto)}</td>
                  <td className="py-1 text-right tabular-nums">{fmtPct(r.margem)}</td>
                </tr>
              ))}
              <tr className="font-semibold text-gray-900 dark:text-gray-100">
                <td className="pt-1.5">Total</td>
                <td className="pt-1.5 text-right tabular-nums">{formatCurrencyInt(projecaoTotal.faturamento)}</td>
                <td className="pt-1.5 text-right tabular-nums">{formatCurrencyInt(projecaoTotal.lucroBruto)}</td>
                <td className="pt-1.5 text-right tabular-nums">{fmtPct(projecaoTotal.margem)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-right text-[10px] text-gray-400 dark:text-gray-500">Ver detalhes →</p>
        </button>
      </div>

      <CombustivelDetailModal
        open={openModal === 'combustivel'}
        onClose={() => setOpenModal(null)}
        dataInicial={dataInicial}
        dataFinal={dataFinal}
        totalLucroBruto={segments.combustivel.lucroBruto}
        margemPct={segments.combustivel.margem}
        lucroPorLitro={segments.combustivel.lucroPorLitro}
      />

      <AutomotivosDetailModal
        open={openModal === 'automotivos'}
        onClose={() => setOpenModal(null)}
        dataInicial={dataInicial}
        dataFinal={dataFinal}
        totalFaturamento={segments.automotivos.faturamento}
        totalLucroBruto={segments.automotivos.lucroBruto}
        margemPct={segments.automotivos.margem}
      />

      <ConvenienciaDetailModal
        open={openModal === 'conveniencia'}
        onClose={() => setOpenModal(null)}
        dataInicial={dataInicial}
        dataFinal={dataFinal}
        totalFaturamento={segments.conveniencia.faturamento}
        totalLucroBruto={segments.conveniencia.lucroBruto}
        margemPct={segments.conveniencia.margem}
      />

      <GlobalDetailModal
        open={openModal === 'global'}
        onClose={() => setOpenModal(null)}
        dataInicial={dataInicial}
        dataFinal={dataFinal}
        global={{
          faturamento: segments.global.faturamento,
          lucroBruto: segments.global.lucroBruto,
          margem: segments.global.margem,
        }}
        combustivel={{
          faturamento: combustivelFaturamento,
          lucroBruto: segments.combustivel.lucroBruto,
          margem: segments.combustivel.margem,
        }}
        automotivos={{
          faturamento: segments.automotivos.faturamento,
          lucroBruto: segments.automotivos.lucroBruto,
          margem: segments.automotivos.margem,
        }}
        conveniencia={{
          faturamento: segments.conveniencia.faturamento,
          lucroBruto: segments.conveniencia.lucroBruto,
          margem: segments.conveniencia.margem,
        }}
      />

      <ProjecaoDetailModal
        open={openModal === 'projecao'}
        onClose={() => setOpenModal(null)}
        dataInicial={dataInicial}
        dataFinal={dataFinal}
        setores={[
          {
            setor: 'Combustível',
            realizadoFaturamento: combustivelFaturamento,
            projetadoFaturamento: projecaoLinhas.find((p) => p.setor === 'Combustível')?.faturamento ?? 0,
            realizadoLucro: segments.combustivel.lucroBruto,
            projetadoLucro: projecaoLinhas.find((p) => p.setor === 'Combustível')?.lucroBruto ?? 0,
            margemProjetada: projecaoLinhas.find((p) => p.setor === 'Combustível')?.margem ?? 0,
          },
          {
            setor: 'Automotivos',
            realizadoFaturamento: segments.automotivos.faturamento,
            projetadoFaturamento: projecaoLinhas.find((p) => p.setor === 'Automotivos')?.faturamento ?? 0,
            realizadoLucro: segments.automotivos.lucroBruto,
            projetadoLucro: projecaoLinhas.find((p) => p.setor === 'Automotivos')?.lucroBruto ?? 0,
            margemProjetada: projecaoLinhas.find((p) => p.setor === 'Automotivos')?.margem ?? 0,
          },
          {
            setor: 'Conveniência',
            realizadoFaturamento: segments.conveniencia.faturamento,
            projetadoFaturamento: projecaoLinhas.find((p) => p.setor === 'Conveniência')?.faturamento ?? 0,
            realizadoLucro: segments.conveniencia.lucroBruto,
            projetadoLucro: projecaoLinhas.find((p) => p.setor === 'Conveniência')?.lucroBruto ?? 0,
            margemProjetada: projecaoLinhas.find((p) => p.setor === 'Conveniência')?.margem ?? 0,
          },
        ]}
      />
    </>
  )
}

export default ProjecoesPainel
