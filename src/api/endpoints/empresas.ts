import { client } from '@/api/client'
import type { Empresa } from '@/api/types/empresa'

interface FetchEmpresasParams {
  empresaCodigo?: number
  ultimoCodigo?: number
  limite?: number
}

export const fetchEmpresas = (params?: FetchEmpresasParams) =>
  client.get<Empresa[]>('/EMPRESAS', { params }).then((res) => res.data)
