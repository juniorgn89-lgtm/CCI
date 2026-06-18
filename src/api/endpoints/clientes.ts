import { client } from '@/api/client'
import type { PaginatedResponse } from '@/api/types/common'
import type { Cliente } from '@/api/types/cliente'

interface FetchClientesParams {
  empresaCodigo?: number
  clienteCodigo?: number[]
  cpfCnpj?: string
  ativo?: boolean
  ultimoCodigo?: number
  limite?: number
}

/** Cadastro de clientes — usado para resolver clienteCodigo → nome. */
export const fetchClientes = (params?: FetchClientesParams) =>
  client.get<PaginatedResponse<Cliente>>('/CLIENTE', { params }).then((res) => res.data)
