import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Segundo client Supabase — SÓ LEITURA — apontando pro projeto do **Prospecção360**
 * (banco separado do Visor). Serve exclusivamente ao módulo Rede: lê a view pública
 * `rede_prospeccao` (CNPJ + vendedor + status), que expõe o mínimo pra dizer quem
 * fechou cada cliente. Nunca escreve nada.
 *
 * `storageKey` próprio + `persistSession: false` pra NÃO colidir com a sessão de
 * auth do Visor (que usa o storageKey default). É anon puro: não fazemos login
 * neste projeto — a leitura é liberada por GRANT na view.
 */
const url = import.meta.env.VITE_SUPABASE_PROSPECCAO_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PROSPECCAO_ANON_KEY as string | undefined

export const supabaseRede: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          storageKey: 'sb-prospeccao-readonly',
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null

export const isProspeccaoBridgeConfigured = supabaseRede !== null
