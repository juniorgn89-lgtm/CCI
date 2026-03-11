import { useQuery } from '@tanstack/react-query'
import { Building2, ChevronDown } from 'lucide-react'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useFilters } from '@/hooks/useFilters'
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
  const { empresaCodigos, setEmpresas } = useFilters()

  const { data: empresasData, isLoading } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 10 * 60 * 1000,
  })

  const empresas = empresasData?.resultados ?? []

  const handleToggle = (codigo: number) => {
    const isSelected = empresaCodigos.includes(codigo)
    if (isSelected) {
      setEmpresas(empresaCodigos.filter((c) => c !== codigo))
    } else {
      setEmpresas([...empresaCodigos, codigo])
    }
  }

  const handleSelectAll = () => {
    setEmpresas(empresas.map((e) => e.codigo))
  }

  const handleClear = () => {
    setEmpresas([])
  }

  const getLabel = (): string => {
    if (empresaCodigos.length === 0) return 'Todas as empresas'
    if (empresaCodigos.length === 1) {
      const empresa = empresas.find((e) => e.codigo === empresaCodigos[0])
      return empresa?.fantasia ?? 'Empresa'
    }
    if (empresaCodigos.length === empresas.length && empresas.length > 0) {
      return 'Todas as empresas'
    }
    return `${empresaCodigos.length} empresas`
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-[280px] justify-between text-sm font-normal"
          disabled={isLoading}
        >
          <span className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
            <span className="truncate">{isLoading ? 'Carregando...' : getLabel()}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px]">
        <DropdownMenuLabel className="flex items-center justify-between py-1">
          <span className="text-xs text-gray-500">Empresas</span>
          <span className="flex gap-2">
            <button
              onClick={handleSelectAll}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Todas
            </button>
            <button
              onClick={handleClear}
              className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              Limpar
            </button>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {empresas.map((empresa) => (
          <DropdownMenuCheckboxItem
            key={empresa.codigo}
            checked={empresaCodigos.includes(empresa.codigo)}
            onCheckedChange={() => handleToggle(empresa.codigo)}
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
