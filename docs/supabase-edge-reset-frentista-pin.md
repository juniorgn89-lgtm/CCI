# Edge Function: `reset-frentista-pin`

Reseta o PIN (senha de autenticação) de um frentista. Chamada pelo botão
"Resetar PIN" em `/admin/frentistas`. Roda com `service_role` pra poder
atualizar `auth.users.password` de outro usuário.

## Regras

- Caller precisa ser **supervisor da mesma rede** do frentista OU **master**
- O novo PIN é gerado no client (3 primeiras letras minúsculas do nome do
  frentista, sem acentos) e enviado como `new_pin`
- A função apenas valida e aplica — não recalcula o PIN

## Deploy

```bash
supabase functions deploy reset-frentista-pin
```

## Código (`supabase/functions/reset-frentista-pin/index.ts`)

```ts
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

    // Auth check — quem é o caller?
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'missing auth header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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

    // Service-role client pra ler profiles + atualizar password
    const admin = createClient(supabaseUrl, serviceKey)

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role, rede_id, is_master')
      .eq('user_id', user.id)
      .maybeSingle()

    const isMaster = callerProfile?.is_master === true
    const isSupervisor = callerProfile?.role === 'supervisor'
    if (!isMaster && !isSupervisor) {
      return new Response(JSON.stringify({ error: 'forbidden — apenas supervisor ou gerente geral' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Body
    const body = await req.json()
    const { user_id, new_pin } = body as { user_id?: string; new_pin?: string }
    if (!user_id || !new_pin) {
      return new Response(JSON.stringify({ error: 'user_id e new_pin obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (new_pin.length < 3 || new_pin.length > 8) {
      return new Response(JSON.stringify({ error: 'new_pin deve ter entre 3 e 8 caracteres' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Supervisor só pode resetar PIN de frentistas da própria rede
    if (!isMaster) {
      const { data: target } = await admin
        .from('frentistas')
        .select('rede_id')
        .eq('user_id', user_id)
        .maybeSingle()
      if (!target || target.rede_id !== callerProfile.rede_id) {
        return new Response(JSON.stringify({ error: 'forbidden — frentista de outra rede' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Aplica o mesmo prefixo que o login do frentista usa (useFrentistaAuth.ts):
    // pin "iva" => password "frentista-iva". Sem isso o login falha porque o
    // cliente envia a senha com prefixo mas o reset gravaria sem.
    const supabasePassword = `frentista-${new_pin}`

    const { error: updateErr } = await admin.auth.admin.updateUserById(user_id, {
      password: supabasePassword,
    })
    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

## Teste manual

```bash
curl -X POST 'https://<PROJECT>.supabase.co/functions/v1/reset-frentista-pin' \
  -H "Authorization: Bearer <SESSION_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<uuid>","new_pin":"iva"}'
```
