import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, ChevronDown, Network } from 'lucide-react'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useFilters } from '@/hooks/useFilters'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

/** Compara duas listas de códigos sem se importar com a ordem. */
const sameCodes = (a: number[], b: number[]): boolean =>
  a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i])

const CompanySelect = () => {
  const [open, setOpen] = useState(false)
  const { empresaCodigos, setEmpresas } = useFilters()

  // Rascunho local: a seleção só é APLICADA (e dispara fetch) ao clicar em
  // "Aplicar". Sem isso, cada checkbox recarregava os dados na hora.
  const [draft, setDraft] = useState<number[]>(empresaCodigos)
  // Ressincroniza o rascunho com o aplicado toda vez que o menu abre (descarta
  // rascunhos não aplicados de uma abertura anterior).
  useEffect(() => {
    if (open) setDraft(empresaCodigos)
  }, [open, empresaCodigos])

  const { data: empresasData, isLoading } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 10 * 60 * 1000,
  })

  // Aplica a restrição do usuário (profiles.empresa_codigos). Master/sem
  // restrição vê todas; supervisor/frentista restrito vê só as permitidas.
  const empresas = useEmpresasPermitidas(empresasData?.resultados ?? [])

  // `[]` = "Todos os postos" → a rede inteira consolidada. É a mesma semântica
  // que o Dashboard/Central já usa (matchesEmpresa trata lista vazia como rede
  // toda permitida). Selecionar N postos consolida exatamente esse subconjunto.
  // O estado dos checkboxes reflete o RASCUNHO (não o aplicado).
  const allSelected = draft.length === 0

  // Liga/desliga um posto NO RASCUNHO (não aplica ainda).
  const toggle = (codigo: number) => {
    if (draft.includes(codigo)) {
      setDraft(draft.filter((c) => c !== codigo))
    } else {
      setDraft([...draft, codigo])
    }
  }

  const selectAll = () => setDraft([])

  // Aplica o rascunho → dispara o fetch uma única vez e fecha o menu.
  const dirty = !sameCodes(draft, empresaCodigos)
  const apply = () => {
    if (dirty) setEmpresas(draft)
    setOpen(false)
  }

  // Rótulo do gatilho = seleção APLICADA (não o rascunho). 1–2 postos: nomes
  // com "·"; 3+: colapsa pra contagem.
  const getLabel = (): string => {
    if (empresaCodigos.length === 0) return 'Todos'
    const nomes = empresaCodigos
      .map((c) => empresas.find((e) => e.codigo === c)?.fantasia)
      .filter((n): n is string => !!n)
    if (nomes.length === 0) return 'Todos'
    return nomes.length <= 2 ? nomes.join(' · ') : `${nomes.length} postos`
  }

  const TriggerIcon = empresaCodigos.length === 0 ? Network : Building2

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-[200px] justify-between border-blue-200 bg-blue-50/50 text-[11px] font-normal hover:bg-blue-100/60 dark:border-blue-900/40 dark:bg-blue-950/30 dark:hover:bg-blue-900/30 xl:w-[240px] xl:text-xs"
          disabled={isLoading}
        >
          <span className="flex items-center gap-1.5 truncate">
            <TriggerIcon className="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-400" />
            <span className="truncate">{isLoading ? 'Carregando...' : getLabel()}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px]">
        <DropdownMenuLabel className="py-1">
          <span className="text-xs text-gray-500">Selecione o posto</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Todos os postos → rede consolidada ([]). Manter o menu aberto pra
            permitir refinar a seleção sem reabrir. */}
        <DropdownMenuCheckboxItem
          checked={allSelected}
          onCheckedChange={() => selectAll()}
          onSelect={(e) => e.preventDefault()}
        >
          <span className="flex items-center gap-1.5">
            <Network className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
            <span className="font-medium">Todos os postos</span>
            <span className="text-[10px] text-gray-400">rede consolidada</span>
          </span>
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        {empresas.map((empresa) => (
          <DropdownMenuCheckboxItem
            key={empresa.codigo}
            checked={draft.includes(empresa.codigo)}
            onCheckedChange={() => toggle(empresa.codigo)}
            onSelect={(e) => e.preventDefault()}
          >
            {empresa.fantasia}
          </DropdownMenuCheckboxItem>
        ))}

        <DropdownMenuSeparator />

        {/* Aplica a seleção de uma vez — o fetch só dispara aqui. */}
        <div className="px-2 py-1.5">
          <Button
            size="sm"
            className="h-7 w-full bg-[#1e3a5f] text-[11px] text-white hover:bg-[#1e3a5f]/90"
            onClick={apply}
            disabled={!dirty}
          >
            {dirty ? 'Aplicar' : 'Aplicado'}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default CompanySelect
