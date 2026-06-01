import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import CompanySelect from '@/components/filters/CompanySelect'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import DataFilterModeSelect from '@/components/filters/DataFilterModeSelect'
import ComparisonSelect from '@/components/filters/ComparisonSelect'

interface MobileFilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Esconde o seletor de posto (Central da Rede = sempre rede-wide). */
  hideCompanySelect?: boolean
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </div>
)

/**
 * Painel de filtros mobile — desce do topo. Reaproveita os MESMOS controles
 * já ligados aos stores (posto/período/escopo/comparativo), então aplicar é
 * imediato; "Visualizar" só fecha o painel.
 */
const MobileFilterSheet = ({ open, onOpenChange, hideCompanySelect }: MobileFilterSheetProps) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="top" className="max-h-[88vh] overflow-y-auto rounded-b-2xl">
      <SheetTitle className="text-base font-bold">Filtros</SheetTitle>
      <div className="mt-4 space-y-4">
        {!hideCompanySelect && <Field label="Posto"><CompanySelect /></Field>}
        <Field label="Período"><DateRangeToolbar /></Field>
        <Field label="Escopo"><DataFilterModeSelect /></Field>
        <Field label="Comparativo"><ComparisonSelect /></Field>
      </div>
      <button
        type="button"
        onClick={() => onOpenChange(false)}
        className="mt-6 w-full rounded-lg bg-[#1e3a5f] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#162d4a] active:scale-[0.99]"
      >
        Visualizar
      </button>
    </SheetContent>
  </Sheet>
)

export default MobileFilterSheet
