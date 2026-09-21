/**
 * Config ÚNICA da assinatura do Visor360 — usada pelo modal "Quero assinar" e
 * pela página "Como começar". Preencha as constantes abaixo com os dados reais.
 *
 * >>> PREENCHER: <<<
 *  - STRIPE.base / STRIPE.comIA: os Stripe Payment Links (checkout hospedado).
 *    Cada link já tem o valor fixo (base = R$ 199,99; comIA = R$ 269,99).
 *  - WEBPOSTO.telefone / WEBPOSTO.whatsapp: os contatos reais do WebPosto.
 * Enquanto STRIPE estiver vazio, o botão de pagar fica desabilitado com aviso
 * (nunca cai em e-mail). Enquanto WEBPOSTO estiver vazio, os contatos aparecem
 * como "a definir".
 */

export const PRECO_BASE = 199.99
export const PRECO_IA = 70

export const BRL = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Stripe Payment Links (checkout do Stripe). Deixe vazio até ter o link real. */
export const STRIPE = {
  base: '', // ex.: 'https://buy.stripe.com/xxxxxxxx' — plano base (R$ 199,99/mês)
  comIA: '', // ex.: 'https://buy.stripe.com/yyyyyyyy' — plano + IA (R$ 269,99/mês)
}

export const WEBPOSTO = {
  telefone: '', // ex.: '(27) 3000-0000'
  whatsapp: '', // só dígitos com DDI, ex.: '5527999999999'
  mensagem: 'Olá! Sou cliente Visor360 e preciso da minha chave de integração (API) do WebPosto.',
}

/** Link de pagamento do Stripe conforme a escolha da IA. Vazio = não configurado. */
export const linkPagamento = (comIA: boolean): string => (comIA ? STRIPE.comIA : STRIPE.base)

/** Link do WhatsApp do WebPosto com mensagem pronta. null = não configurado. */
export const whatsappLink = (): string | null =>
  WEBPOSTO.whatsapp
    ? `https://wa.me/${WEBPOSTO.whatsapp}?text=${encodeURIComponent(WEBPOSTO.mensagem)}`
    : null

/** Link de telefone (tel:) do WebPosto. null = não configurado. */
export const telefoneLink = (): string | null =>
  WEBPOSTO.telefone ? `tel:${WEBPOSTO.telefone.replace(/[^\d+]/g, '')}` : null
