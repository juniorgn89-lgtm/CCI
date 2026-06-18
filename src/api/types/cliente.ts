/** Cadastro de cliente (/INTEGRACAO/CLIENTE). */
export interface Cliente {
  codigo: number
  nome: string
  cpfCnpj: string
  endereco: string
  cidade: string
  uf: string
  telefone: string
  email: string
  codigoExterno: string
  ativo: boolean
  frota: boolean
  faturamento: boolean
}
