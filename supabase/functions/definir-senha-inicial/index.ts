// @ts-nocheck — roda no Deno (Supabase Edge Runtime), não no Node.
//
// definir-senha-inicial — a CCI (master) define a senha de PRIMEIRO ACESSO de
// um usuário (Painel › Usuários › "Senha inicial"), para liberar o cliente na
// hora sem link de redefinição. Também confirma o e-mail, senão o login falha.
//
// Segurança: só master chama; não altera senha de outro master; a senha NUNCA
// é gravada em tabela nem em log (só vai para o Auth do Supabase).
//
// Deploy: npx supabase@latest functions deploy definir-senha-inicial --project-ref yzmorbfadoxowchkwspl
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ORIGENS = ['https://visor360.cci.app.br', 'http://localhost:5173', 'http://localhost:5199']
const cors = (req: Request) => {
  const o = req.headers.get('Origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ORIGENS.includes(o) ? o : ORIGENS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

Deno.serve(async (req) => {
  const h = cors(req)
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...h, 'Content-Type': 'application/json' } })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h })
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' })

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const authz = req.headers.get('Authorization') ?? ''
    if (!authz) return json(401, { error: 'Entre de novo.' })
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authz } }, auth: { persistSession: false } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json(401, { error: 'Entre de novo.' })

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const { data: quem } = await admin.from('profiles').select('is_master').eq('user_id', user.id).maybeSingle()
    if (quem?.is_master !== true) return json(403, { error: 'Só a CCI pode definir a senha inicial.' })

    const { user_id, senha } = await req.json().catch(() => ({}))
    if (!user_id || typeof senha !== 'string') return json(400, { error: 'Informe o usuário e a senha.' })
    if (senha.length < 6) return json(400, { error: 'A senha precisa ter pelo menos 6 caracteres.' })
    if (senha.length > 72) return json(400, { error: 'A senha pode ter no máximo 72 caracteres.' })

    const { data: alvo } = await admin.from('profiles').select('is_master').eq('user_id', user_id).maybeSingle()
    if (!alvo) return json(404, { error: 'Usuário não encontrado.' })
    if (alvo.is_master && user_id !== user.id) return json(403, { error: 'Não dá para definir a senha de outro diretor da CCI.' })

    const { error } = await admin.auth.admin.updateUserById(user_id, { password: senha, email_confirm: true })
    if (error) return json(400, { error: error.message })
    return json(200, { ok: true })
  } catch (e) {
    console.error('definir-senha-inicial:', (e as Error).message)
    return json(500, { error: 'Não foi possível definir a senha agora. Tente de novo.' })
  }
})
