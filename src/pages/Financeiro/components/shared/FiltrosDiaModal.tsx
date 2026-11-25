import type { ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

import type { OrdemDia, Opcao } from '@/pages/Financeiro/components/shared/filtrosDia'

const ORDENS_DIA: { id: OrdemDia; label: string }[] = [
  { id: 'valor', label: 'Maior valor' },
  { id: 'nome', label: 'Nome (A–Z)' },
  { id: 'emissao', label: 'Emissão mais antiga' },
  { id: 'atraso', label: 'Maior atraso' },
]

const campo = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-[12.5px] text-gray-800 outline-none transition-colors focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 dark:border-[#2f3b4f] dark:bg-[#0b1220] dark:text-[#e2e8f0] dark:focus:border-[#0d9488] dark:focus:ring-[#0d9488]/20'


interface Props<O extends string> {
  /** Algo antes da busca (ex.: alternador Por nome / Título a título). */
  inicio?: ReactNode
  busca: string
  onBusca: (v: string) => void
  placeholder: string
  /** Postos presentes no dia — o seletor só aparece com 2 ou mais. */
  postos: Opcao[]
  posto: string
  onPosto: (v: string) => void
  /** Filtro extra opcional (ex.: categoria no a pagar). */
  extra?: { label: string; opcoes: Opcao[]; valor: string; onChange: (v: string) => void }
  ordem: O
  onOrdem: (v: O) => void
  /** Opções de ordem; padrão = as da modal do dia. */
  ordens?: { id: O; label: string }[]
  mostrando: number
  total: number
  onLimpar: () => void
}

/** Barra de filtros da janela de um dia do calendário (a receber / a pagar). */
const FiltrosDiaModal = <O extends string = OrdemDia,>({ inicio, busca, onBusca, placeholder, postos, posto, onPosto, extra, ordem, onOrdem, ordens, mostrando, total, onLimpar }: Props<O>) => {
  const lista = ordens ?? (ORDENS_DIA as unknown as { id: O; label: string }[])
  const filtrado = busca.trim() !== '' || posto !== '' || (extra?.valor ?? '') !== ''
  return (
    <div className="flex flex-wrap items-center gap-2">
      {inicio}
      <label className="relative min-w-[240px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input value={busca} onChange={(e) => onBusca(e.target.value)} placeholder={placeholder} aria-label="Buscar"
          className={cn(campo, 'w-full pl-9 pr-8')} />
        {busca && (
          <button type="button" onClick={() => onBusca('')} aria-label="Limpar busca"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </label>
      {postos.length > 1 && (
        <select value={posto} onChange={(e) => onPosto(e.target.value)} aria-label="Posto" className={cn(campo, 'max-w-[220px]')}>
          <option value="">Todos os postos</option>
          {postos.map((p) => <option key={p.valor} value={p.valor}>{p.label} ({p.n})</option>)}
        </select>
      )}
      {extra && extra.opcoes.length > 1 && (
        <select value={extra.valor} onChange={(e) => extra.onChange(e.target.value)} aria-label={extra.label} className={cn(campo, 'max-w-[240px]')}>
          <option value="">{`Todas as ${extra.label.toLowerCase()}s`}</option>
          {extra.opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.label} ({o.n})</option>)}
        </select>
      )}
      <select value={ordem} onChange={(e) => onOrdem(e.target.value as O)} aria-label="Ordenar por" className={campo}>
        {lista.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      {filtrado && (
        <span className="inline-flex items-center gap-2 text-[11.5px] text-gray-500 dark:text-[#94a3b8]">
          {mostrando} de {total}
          <button type="button" onClick={onLimpar} className="font-semibold text-[#2563eb] hover:underline dark:text-[#5eead4]">Limpar filtros</button>
        </span>
      )}
    </div>
  )
}

export default FiltrosDiaModal
