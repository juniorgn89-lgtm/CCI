import type { Empresa } from '@/api/types/empresa'
import { useDemoStore } from '@/store/demo'

/**
 * Máscara do Modo Demonstração (ver src/store/demo.ts).
 *
 * Ponto ÚNICO de mascaramento dos postos: `fetchEmpresas` (/EMPRESAS) passa a
 * resposta por `maskEmpresas` quando a demo está ativa — e como TODO nome de
 * posto do app vem desse endpoint, cobre as ~60 telas/hooks sem tocar em cada
 * uma. O que é mascarado: nome fantasia/razão, sigla, CNPJ e endereço de rua.
 * O que fica: cidade/UF e coordenadas (o mapa da Rede continua funcionando; uma
 * cidade não identifica o posto).
 */

export const DEMO_REDE_NOME = 'Rede Exemplo'

export const isDemoAtivo = (): boolean => useDemoStore.getState().ativo

// Registro código → índice estável ("Posto 1", "Posto 2"…). A numeração segue a
// ordem crescente de código conforme os postos aparecem: a 1ª lista completa (que
// o app carrega logo no boot) define tudo; respostas parciais só consultam. Vive
// na sessão — um F5 refaz na mesma ordem, então o rótulo não muda no meio da demo.
const registro = new Map<number, number>()

const registrar = (codigos: number[]) => {
  for (const c of [...codigos].sort((a, b) => a - b)) {
    if (!registro.has(c)) registro.set(c, registro.size + 1)
  }
}

/** Rótulo mascarado de um posto pelo código ("Posto 3"). */
export const demoPostoLabel = (codigo: number | null | undefined): string => {
  if (codigo == null) return 'Posto'
  if (!registro.has(codigo)) registrar([codigo])
  return `Posto ${registro.get(codigo)}`
}

const codigoDe = (e: Empresa) => e.codigo || e.empresaCodigo

export const maskEmpresa = (e: Empresa): Empresa => {
  const label = demoPostoLabel(codigoDe(e))
  return {
    ...e,
    fantasia: label,
    razao: label,
    sigla: null,
    cnpj: '',
    tipoLogradouro: '',
    logradouro: '',
    endereco: '',
    numero: '',
    bairro: '',
    cep: '',
  }
}

export const maskEmpresas = (lista: Empresa[]): Empresa[] => {
  registrar(lista.map(codigoDe))
  return lista.map(maskEmpresa)
}

/** Nome de posto vindo de OUTRA fonte (ex.: frentistas.empresa_nome) — mascara pelo código. */
export const maskPostoNome = (codigo: number | null | undefined, nome: string, demo = isDemoAtivo()): string =>
  demo ? demoPostoLabel(codigo) : nome
