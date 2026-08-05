// @ts-nocheck — esse arquivo roda no Deno (Supabase Edge Runtime), não no Node.
//
// Gera um LINK de redefinição de senha (recovery) pro usuário, SEM depender de
// e-mail/SMTP. O master pega o link e manda pro usuário (WhatsApp/copiar); o
// usuário abre o link e define a PRÓPRIA senha em /redefinir-senha. Usa a admin
// API (service_role) — só master pode chamar.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'missing auth header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Quem chamou?
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey)

    // Só master gera link de senha de outros usuários.
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('is_master')
      .eq('user_id', user.id)
      .maybeSingle()
    if (callerProfile?.is_master !== true) {
      return new Response(JSON.stringify({ error: 'forbidden - apenas gerente geral' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { email, redirect_to } = body
    if (!email) {
      return new Response(JSON.stringify({ error: 'email obrigatorio' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Gera o link de recovery (uso único, expira conforme config do projeto —
    // padrão ~1h). O `redirectTo` precisa estar na allowlist de Redirect URLs
    // do projeto pra o link cair em /redefinir-senha (senão volta pro Site URL).
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: redirect_to ? { redirectTo: redirect_to } : undefined,
    })
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const link = data?.properties?.action_link
    if (!link) {
      return new Response(JSON.stringify({ error: 'link não gerado' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ link }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
