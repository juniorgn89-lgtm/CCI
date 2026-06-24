import { useState } from 'react'
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

const CompanySelect = () => {
  const [open, setOpen] = useState(false)
  const { empresaCodigos, setEmpresas } = useFilters()

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
  const allSelected = empresaCodigos.length === 0

  // Liga/desliga um posto da seleção. Desmarcar o último volta pra "Todos" (rede
  // consolidada) — evita estado vazio sem dado.
  const toggle = (codigo: number) => {
    if (empresaCodigos.includes(codigo)) {
      setEmpresas(empresaCodigos.filter((c) => c !== codigo))
    } else {
      setEmpresas([...empresaCodigos, codigo])
    }
  }

  const selectAll = () => setEmpresas([])

  const getLabel = (): string => {
    if (allSelected) return 'Todos os postos'
    if (empresaCodigos.length === 1) {
      const empresa = empresas.find((e) => e.codigo === empresaCodigos[0])
      return empresa?.fantasia ?? 'Empresa'
    }
    return `${empresaCodigos.length} postos`
  }

  const TriggerIcon = allSelected ? Network : Building2

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
            checked={empresaCodigos.includes(empresa.codigo)}
            onCheckedChange={() => toggle(empresa.codigo)}
            onSelect={(e) => e.preventDefault()}
          >
            {empresa.fantasia}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default CompanySelect
