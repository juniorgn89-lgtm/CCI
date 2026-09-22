import { useQuery } from '@tanstack/react-query'
import { fetchAppConfig } from '@/api/supabase/appConfig'
import { ASSINATURA_DEFAULTS, type AssinaturaConfig } from '@/pages/Landing/assinatura'

/**
 * Config global da assinatura (Stripe/WebPosto/manutenção), lida da tabela
 * `app_config` no Supabase. Leitura pública (a landing roda deslogada). Enquanto
 * carrega ou se falhar, cai no ASSINATURA_DEFAULTS — nada quebra. Uma query só,
 * compartilhada por todos que usam o hook (mesma queryKey).
 */
export const useAppConfig = (): AssinaturaConfig & { isLoading: boolean } => {
  const { data, isLoading } = useQuery({
    queryKey: ['app-config'],
    queryFn: fetchAppConfig,
    staleTime: 5 * 60 * 1000,
  })

  const cfg: AssinaturaConfig = data
    ? {
        stripeBase: data.stripe_link_base || ASSINATURA_DEFAULTS.stripeBase,
        stripeIA: data.stripe_link_ia || ASSINATURA_DEFAULTS.stripeIA,
        stripePk: data.stripe_pk || ASSINATURA_DEFAULTS.stripePk,
        telefone: data.webposto_telefone || ASSINATURA_DEFAULTS.telefone,
        whatsapp: data.webposto_whatsapp || ASSINATURA_DEFAULTS.whatsapp,
        whatsappMsg: data.webposto_mensagem || ASSINATURA_DEFAULTS.whatsappMsg,
        comercialWhatsapp: data.comercial_whatsapp || ASSINATURA_DEFAULTS.comercialWhatsapp,
        manutencao: data.assinatura_manutencao ?? ASSINATURA_DEFAULTS.manutencao,
        manutencaoMsg: data.assinatura_manutencao_msg || ASSINATURA_DEFAULTS.manutencaoMsg,
      }
    : ASSINATURA_DEFAULTS

  return { ...cfg, isLoading }
}
