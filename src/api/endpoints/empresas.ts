import { client } from '@/api/client'
import type { PaginatedResponse } from '@/api/types/common'
import type { Empresa } from '@/api/types/empresa'
import { isDemoAtivo, maskEmpresas } from '@/lib/demoMask'

interface FetchEmpresasParams {
  empresaCodigo?: number
  ultimoCodigo?: number
  limite?: number
}

// Modo Demonstração: este é o ponto ÚNICO por onde todo nome de posto entra no
// app — mascarar aqui cobre todas as telas/hooks/tools de uma vez.
/** Postos de UMA rede pela chave dela (Painel › Redes). Só GET. */
export const fetchEmpresasDaRede = (rede: { chave: string; api_base_url: string }) =>
  client.get<PaginatedResponse<Empresa>>('/EMPRESAS', { baseURL: rede.api_base_url, params: { CHAVE: rede.chave, limite: 500 } }).then((res) =>
    isDemoAtivo()
      ? { ...res.data, resultados: maskEmpresas(res.data.resultados ?? []) }
      : res.data,
  )

export const fetchEmpresas = (params?: FetchEmpresasParams) =>
  client.get<PaginatedResponse<Empresa>>('/EMPRESAS', { params }).then((res) =>
    isDemoAtivo()
      ? { ...res.data, resultados: maskEmpresas(res.data.resultados ?? []) }
      : res.data,
  )
