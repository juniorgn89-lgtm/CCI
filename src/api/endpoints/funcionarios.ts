import { client } from '@/api/client'
import type { PaginatedResponse } from '@/api/types/common'
import type { Funcionario, FuncionarioMeta, Funcao, Placares } from '@/api/types/funcionario'

interface FetchFuncionariosParams {
  empresaCodigo?: number
  funcaoCodigo?: number
  ativo?: boolean
  ultimoCodigo?: number
  limite?: number
}

interface FetchFuncionarioMetaParams {
  empresaCodigo?: number
  funcionarioCodigo?: number
  ultimoCodigo?: number
  limite?: number
}

interface FetchFuncoesParams {
  ultimoCodigo?: number
  limite?: number
}

interface FetchPlacaresParams {
  empresaCodigo?: number
  funcionarioCodigo?: number
  dataInicial?: string
  dataFinal?: string
  ultimoCodigo?: number
  limite?: number
}

export const fetchFuncionarios = (params?: FetchFuncionariosParams) =>
  client.get<PaginatedResponse<Funcionario>>('/FUNCIONARIO', { params }).then((res) => res.data)

export const fetchFuncionarioMeta = (params?: FetchFuncionarioMetaParams) =>
  client.get<PaginatedResponse<FuncionarioMeta>>('/FUNCIONARIO_META', { params }).then((res) => res.data)

export const fetchFuncoes = (params?: FetchFuncoesParams) =>
  client.get<PaginatedResponse<Funcao>>('/FUNCOES', { params }).then((res) => res.data)

export const fetchPlacares = (params?: FetchPlacaresParams) =>
  client.get<PaginatedResponse<Placares>>('/PLACARES', { params }).then((res) => res.data)
