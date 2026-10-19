import { useEffect, useRef } from 'react'
import { Filter, X } from 'lucide-react'
import InfoHint from '@/components/ui/InfoHint'
import type { FiltroLink } from '@/pages/Financeiro/lib/filtroLink'

const FAIXA_LABEL: Record<string, string> = { vencidas: 'Vencidas', hoje: 'Vencem hoje', d7: 'Próximos 7 dias', d30: '8 a 30 dias', depois: 'Depois de 30 dias' }

/** Faixa "veio filtrado do modal": mostra o recorte aplicado e deixa limpar. */
const FiltroLinkBar = ({ filtro, catLabel, onLimpar }: { filtro: FiltroLink; catLabel?: string; onLimpar: () => void }) => {
  // Chegou filtrado: leva a tela até a lista (ela fica abaixo dos cards e do calendário).
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [])
  const partes = [
    filtro.faixas ? filtro.faixas.map((f) => FAIXA_LABEL[f] ?? f).join(' + ') : null,
    catLabel ?? null,
    filtro.q ? `"${filtro.q}"` : null,
  ].filter((p): p is string => !!p && p !== filtro.rotulo && p !== `"${filtro.rotulo}"`)
  return (
    <div ref={ref} className="flex scroll-mt-24 flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-[12px] text-[#1e3a5f] dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
      <Filter className="h-3.5 w-3.5 shrink-0" />
      <span>Filtrado como no modal: {filtro.rotulo ? <b className="font-semibold">{filtro.rotulo}</b> : null}{partes.length ? <>{filtro.rotulo ? ' · ' : ''}{partes.join(' · ')}</> : null}</span>
      <InfoHint text="Mesma faixa de vencimento, categoria e busca do modal. Faturas aqui contam uma linha por fatura (duplicata, pelo saldo e vencimento da fatura); no modal, por título — a contagem muda e o total pode variar uns reais." />
      <button type="button" onClick={onLimpar} className="ml-auto inline-flex items-center gap-1 font-semibold hover:underline"><X className="h-3.5 w-3.5" /> Ver tudo</button>
    </div>
  )
}

export default FiltroLinkBar
