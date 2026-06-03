import { useRef, useState } from 'react'
import { Eye, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import MonthRangeSelect from '@/components/filters/MonthRangeSelect'
import { useFilters } from '@/hooks/useFilters'
import { useFilterStore } from '@/store/filters'
import { offsetPeriod } from '@/lib/period'
import { cn } from '@/lib/utils'

const pad = (n: number) => String(n).padStart(2, '0')
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/**
 * Período "automático" = bate exatamente com um dos 3 presets do MÊS CORRENTE
 * (Completo / Em andamento / Apurado). Qualquer outra coisa — mês passado,
 * multi-mês, datas digitadas — conta como personalizado.
 *
 * Não confundir com o badge "Apurado" do DataFilterModeSelect: lá um período
 * inteiramente no passado é classificado como "Apurado" (tipo), mas aqui
 * (visual do input) ele é "personalizado" porque foi escolhido pelo usuário.
 */
const isAutoPeriod = (dataInicial: string, dataFinal: string): boolean => {
  const now = new Date()
  const today = fmtDate(now)
  const firstM = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
  const lastM = fmtDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  const yesterday = now.getDate() <= 1 ? firstM : fmtDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))

  return (
    (dataInicial === firstM && dataFinal === lastM) // Completo
    || (dataInicial === today && dataFinal === today) // Em andamento
    || (dataInicial === firstM && dataFinal === yesterday) // Apurado clássico
  )
}

/**
 * Toolbar de filtro de período pra ser portada via <PageHeaderActions> em cada
 * página. Estado local (draft) — só "commita" pro filtro global ao clicar
 * Visualizar (que invalida queries e dispara o refetch). Sincroniza com a
 * store global quando ela é alterada por fora (ex: troca de página).
 */
/** Abre o calendário nativo do input de data (fallback: foca o campo). */
const openCalendar = (ref: React.RefObject<HTMLInputElement | null>) => {
  const el = ref.current
  if (!el) return
  if (typeof el.showPicker === 'function') {
    try { el.showPicker(); return } catch { /* sem gesto válido — cai no focus */ }
  }
  el.focus()
}

const DateRangeToolbar = ({ stacked = false }: { stacked?: boolean }) => {
  const periodIni = useFilterStore((s) => s.dataInicial)
  const periodFim = useFilterStore((s) => s.dataFinal)
  const { setPeriodo } = useFilters()
  const iniRef = useRef<HTMLInputElement>(null)
  const fimRef = useRef<HTMLInputElement>(null)

  const [draftIni, setDraftIni] = useState(periodIni)
  const [draftFim, setDraftFim] = useState(periodFim)
  // Sincroniza draft com o filtro global quando este muda externamente
  // (botão "mês passado", etc.). Padrão "store info from previous renders".
  const [prevIni, setPrevIni] = useState(periodIni)
  const [prevFim, setPrevFim] = useState(periodFim)
  if (prevIni !== periodIni) {
    setPrevIni(periodIni)
    setDraftIni(periodIni)
  }
  if (prevFim !== periodFim) {
    setPrevFim(periodFim)
    setDraftFim(periodFim)
  }
  const dirty = draftIni !== periodIni || draftFim !== periodFim
  const handleVisualizar = () => setPeriodo(draftIni, draftFim)
  // Modo empilhado (mobile): aplica na hora — sem rascunho/botão próprio (o
  // sheet tem um único "Visualizar"). No desktop segue com rascunho + Visualizar.
  const commitIni = (v: string) => { setDraftIni(v); if (stacked) setPeriodo(v, draftFim) }
  const commitFim = (v: string) => { setDraftFim(v); if (stacked) setPeriodo(draftIni, v) }
  const commitBoth = (ini: string, fim: string) => { setDraftIni(ini); setDraftFim(fim); if (stacked) setPeriodo(ini, fim) }

  // Desloca o período inteiro em ±1 ano, preservando mês e dia (clampa fim de
  // mês via offsetPeriod). Útil pra comparar o MESMO intervalo no ano anterior.
  const shiftYear = (years: number) => {
    const monthsBack = -years * 12
    commitBoth(offsetPeriod(draftIni, monthsBack), offsetPeriod(draftFim, monthsBack))
  }

  // Azul = período automático; laranja = personalizado. Sempre reflete o draft
  // (o que o usuário está vendo nos inputs), não o que está commitado.
  const auto = isAutoPeriod(draftIni, draftFim)
  // Datas: largura média. Sem labels empilhados (a barra inteira fica mais baixa)
  // — o contexto vem do placeholder nativo + tooltip (title). pr-6 abre espaço
  // pro botão de calendário; esconde o indicador nativo (usamos o nosso).
  const inputClass = cn(
    'h-7 pr-6 text-xs transition-colors [&::-webkit-calendar-picker-indicator]:opacity-0',
    stacked ? 'w-full' : 'w-[118px]',
    auto
      ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40'
      : 'border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/40',
  )

  return (
    <div className={cn('flex gap-1.5', stacked ? 'w-full flex-col items-stretch gap-2' : 'items-center')}>
      <MonthRangeSelect
        draftIni={draftIni}
        draftFim={draftFim}
        onChange={(ini, fim) => commitBoth(ini, fim)}
      />
      <div className="relative">
        <Input
          ref={iniRef}
          type="date"
          value={draftIni}
          onChange={(e) => commitIni(e.target.value)}
          className={inputClass}
          aria-label="Data inicial"
          title="Data inicial"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => openCalendar(iniRef)}
          aria-label="Abrir calendário (data inicial)"
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200"
        >
          <Calendar className="h-3.5 w-3.5" />
        </button>
      </div>
      {!stacked && <span className="text-xs text-gray-400">—</span>}
      <div className="relative">
        <Input
          ref={fimRef}
          type="date"
          value={draftFim}
          onChange={(e) => commitFim(e.target.value)}
          className={inputClass}
          aria-label="Data final"
          title="Data final"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => openCalendar(fimRef)}
          aria-label="Abrir calendário (data final)"
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200"
        >
          <Calendar className="h-3.5 w-3.5" />
        </button>
      </div>
      {/* Seletor de ano — desloca o período inteiro mantendo mês/dia, pra
          comparar o mesmo intervalo em outro ano. */}
      <div className="inline-flex h-7 items-center rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <button
          type="button"
          onClick={() => shiftYear(-1)}
          aria-label="Ano anterior (mantém os mesmos dias)"
          title="Mesmo período, 1 ano antes"
          className="flex h-full items-center rounded-l-md px-1.5 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span
          className="px-1.5 text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-300"
          title="Ano do período — use as setas pra trocar só o ano, mantendo os dias filtrados"
        >
          {draftIni.slice(0, 4)}
        </span>
        <button
          type="button"
          onClick={() => shiftYear(1)}
          aria-label="Próximo ano (mantém os mesmos dias)"
          title="Mesmo período, 1 ano depois"
          className="flex h-full items-center rounded-r-md px-1.5 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      {!stacked && (
        <button
          type="button"
          onClick={handleVisualizar}
          disabled={!dirty}
          title={dirty ? 'Aplicar o período selecionado' : 'Período já aplicado'}
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-all',
            dirty
              ? 'bg-[#1e3a5f] text-white shadow-sm hover:bg-[#162a44]'
              : 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600',
          )}
        >
          <Eye className="h-3.5 w-3.5" />
          Visualizar
          {dirty && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-orange-400" title="Alterações não aplicadas" />}
        </button>
      )}
    </div>
  )
}

export default DateRangeToolbar
