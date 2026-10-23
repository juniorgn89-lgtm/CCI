/**
 * Quem vê a aba Conciliação de cartão (e-extrato) durante a integração:
 * diretores (acesso total, `is_master`) e a conta da CCI. A Edge Function
 * `eextrato` aplica a mesma regra — mudar aqui, mudar lá.
 */
const CONTAS_LIBERADAS = ['contato@cci.app.br']

export const podeVerConciliacaoCartao = (isMaster: boolean, email: string | null | undefined) =>
  isMaster || (!!email && CONTAS_LIBERADAS.includes(email.toLowerCase()))
