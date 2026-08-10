import type { Rede } from '@/store/tenant'

/**
 * A "Rede Demonstração" não usa a Quality real — o `api_base_url` dela aponta
 * pra Edge Function `mock-quality` (dados fictícios). É assim que o app sabe que
 * está numa demo (ver project_rede_demo_mock).
 */
export const isDemoApiBaseUrl = (url: string | null | undefined): boolean =>
  !!url && url.includes('mock-quality')

export const isRedeDemo = (rede: Rede | null | undefined): boolean =>
  isDemoApiBaseUrl(rede?.api_base_url)
