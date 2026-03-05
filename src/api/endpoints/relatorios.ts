import { client } from '@/api/client'
import type { ProdutividadeFuncionario } from '@/api/types/funcionario'

interface FetchProdutividadeFuncionarioParams {
  empresaCodigo?: number
  dataInicial?: string
  dataFinal?: string
}

export const fetchProdutividadeFuncionario = (params?: FetchProdutividadeFuncionarioParams) =>
  client.get<ProdutividadeFuncionario[]>('/RELATORIO/PRODUTIVIDADE_FUNCIONARIO', { params }).then((res) => res.data)
