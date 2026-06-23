/**
 * Classificação de CARGO (/FUNCOES.nome) → papel operacional → setor.
 *
 * Fonte da verdade pro headcount setorizado da Produtividade. O `/FUNCIONARIO`
 * só traz `funcaoCodigo`; o catálogo `/FUNCOES` traz o `nome` do cargo (campo
 * `nome`, não `descricao` — a API diverge do nosso tipo). Classificamos pelo
 * NOME (estável entre tenants) e não pelo código (que muda por rede).
 *
 * Cargos reais observados na rede (23/06/2026): FRENTISTA, CAIXA, GERENTE PISTA,
 * CHEFE DE PISTA, TROCADOR DE OLEO, GERENTE CONVENIENCIA.
 *
 * Regra de denominador (Fase 1): a métrica-estrela por setor usa só OPERADORES
 * (frentista / caixa / trocador) — gerências/chefias são overhead e ficam fora
 * do denominador-estrela (mas contam na "equipe total" do setor).
 */
export type FuncaoRole =
  | 'frentista'
  | 'caixa'
  | 'trocador'
  | 'gerente_pista'
  | 'chefe_pista'
  | 'gerente_conv'
  | 'outro'

export type FuncaoSetor = 'combustivel' | 'conveniencia' | 'automotivos' | 'outro'

/** Classifica o nome do cargo (case/acento-insensível) num papel operacional. */
export const classifyFuncaoRole = (nome: string | null | undefined): FuncaoRole => {
  const n = (nome ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // tira acentos (combining marks)
    .toUpperCase()
  if (n.includes('FRENTISTA')) return 'frentista'
  if (n.includes('TROCADOR')) return 'trocador'
  if (n.includes('CHEFE') && n.includes('PISTA')) return 'chefe_pista'
  if (n.includes('GERENTE') && n.includes('PISTA')) return 'gerente_pista'
  if (n.includes('GERENTE') && (n.includes('CONVENIENCIA') || n.includes('LOJA'))) return 'gerente_conv'
  if (n.includes('CAIXA')) return 'caixa'
  return 'outro'
}

/** Setor a que o papel pertence (equipe completa do setor). */
export const roleToSetor = (role: FuncaoRole): FuncaoSetor => {
  switch (role) {
    case 'frentista':
    case 'chefe_pista':
    case 'gerente_pista':
      return 'combustivel'
    case 'caixa':
    case 'gerente_conv':
      return 'conveniencia'
    case 'trocador':
      return 'automotivos'
    default:
      return 'outro'
  }
}

/** É um papel OPERADOR (denominador-estrela, exclui gerência/chefia)? */
export const isOperador = (role: FuncaoRole): boolean =>
  role === 'frentista' || role === 'caixa' || role === 'trocador'
