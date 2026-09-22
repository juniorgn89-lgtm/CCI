/**
 * Config da assinatura do Visor360 — usada pelo modal "Quero assinar", a página
 * "Como começar" e a de confirmação. Os valores REAIS (links do Stripe, contatos
 * do WebPosto, modo manutenção) vêm da tabela `app_config` no Supabase, editável
 * pelo master em Painel → Assinatura (ver useAppConfig). As constantes aqui são
 * só o FALLBACK quando o Supabase não respondeu ainda / linha ausente.
 */

export const PRECO_BASE = 199.99
export const PRECO_IA = 70

export const BRL = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export interface AssinaturaConfig {
  /** Stripe Payment Link do plano base (R$ 199,99/mês). */
  stripeBase: string
  /** Stripe Payment Link do plano + IA (R$ 269,99/mês). */
  stripeIA: string
  /** Chave PUBLICÁVEL do Stripe (pk_...). NUNCA a secreta. */
  stripePk: string
  telefone: string
  whatsapp: string
  whatsappMsg: string
  /** Tela de assinatura em manutenção (mostra aviso no lugar do checkout). */
  manutencao: boolean
  manutencaoMsg: string
}

/** Fallback enquanto a config do Supabase não chega (links de TESTE atuais). */
export const ASSINATURA_DEFAULTS: AssinaturaConfig = {
  stripeBase: 'https://buy.stripe.com/test_6oU6oJ2SAdPugMw9cO3Ru01',
  stripeIA: 'https://buy.stripe.com/test_7sY4gB1OwfXCbsc60C3Ru00',
  stripePk: '',
  telefone: '',
  whatsapp: '',
  whatsappMsg: 'Olá! Sou cliente Visor360 e preciso da minha chave de integração (API) do WebPosto.',
  manutencao: false,
  manutencaoMsg: 'Nossas assinaturas estão passando por uma atualização rápida. Volte em instantes ou fale com a CCI.',
}

/** Link de pagamento do Stripe conforme a escolha da IA. '' = não configurado. */
export const stripeLinkFor = (cfg: AssinaturaConfig, comIA: boolean): string =>
  comIA ? cfg.stripeIA : cfg.stripeBase

/** Link do WhatsApp com mensagem pronta. null = não configurado. */
export const buildWhatsappLink = (whatsapp: string, msg: string): string | null =>
  whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}` : null

/** Link de telefone (tel:). null = não configurado. */
export const buildTelLink = (tel: string): string | null =>
  tel ? `tel:${tel.replace(/[^\d+]/g, '')}` : null
