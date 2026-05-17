import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, ChevronDown } from 'lucide-react'
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

  // Se o user tem acesso a 1 único posto, seleciona automaticamente — não
  // faz sentido ele escolher entre uma opção só, e isso deixa o dashboard
  // já mostrando "o" posto dele em vez do shape "Central da Rede".
  useEffect(() => {
    if (empresas.length === 1 && empresaCodigos.length === 0) {
      setEmpresas([empresas[0].codigo])
    }
  }, [empresas, empresaCodigos.length, setEmpresas])

  const handleSelect = (codigo: number) => {
    setEmpresas([codigo])
    setOpen(false)
  }

  const getLabel = (): string => {
    if (empresaCodigos.length === 0) return 'Selecione o posto'
    if (empresaCodigos.length === 1) {
      const empresa = empresas.find((e) => e.codigo === empresaCodigos[0])
      return empresa?.fantasia ?? 'Empresa'
    }
    return `${empresaCodigos.length} empresas`
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-[220px] justify-between text-xs font-normal xl:w-[280px] xl:text-sm"
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
        <DropdownMenuLabel className="py-1">
          <span className="text-xs text-gray-500">Selecione o posto</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {empresas.map((empresa) => (
          <DropdownMenuCheckboxItem
            key={empresa.codigo}
            checked={empresaCodigos.includes(empresa.codigo)}
            onCheckedChange={() => handleSelect(empresa.codigo)}
          >
            {empresa.fantasia}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default CompanySelect
