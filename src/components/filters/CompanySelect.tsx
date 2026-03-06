import { useQuery } from '@tanstack/react-query'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useFilters } from '@/hooks/useFilters'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const CompanySelect = () => {
  const { empresaCodigo, setEmpresa } = useFilters()

  const { data: empresasData, isLoading } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 10 * 60 * 1000,
  })

  const empresas = empresasData?.resultados ?? []

  const handleChange = (value: string) => {
    setEmpresa(value === 'all' ? null : Number(value))
  }

  return (
    <Select value={empresaCodigo?.toString() ?? 'all'} onValueChange={handleChange}>
      <SelectTrigger className="h-9 w-[180px] text-sm" disabled={isLoading}>
        <SelectValue placeholder="Empresa" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas as empresas</SelectItem>
        {empresas.map((empresa) => (
          <SelectItem key={empresa.codigo} value={empresa.codigo.toString()}>
            {empresa.fantasia}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default CompanySelect
