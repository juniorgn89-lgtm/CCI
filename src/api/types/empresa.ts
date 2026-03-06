export interface Empresa {
  codigo: number
  empresaCodigo: number
  cnpj: string
  razao: string
  fantasia: string
  tipoLogradouro: string
  logradouro: string
  endereco: string
  bairro: string
  numero: string
  cep: string
  cidade: string
  estado: string
  latitude: number
  longitude: number
  ultimoUsuarioAlteracao: string
  centroCustoPrincipal: string | null
  empresaCodigoExterno: string | null
  sigla: string | null
  tipoImposto: string
}
