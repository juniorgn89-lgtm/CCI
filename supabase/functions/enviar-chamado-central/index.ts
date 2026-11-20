// @ts-nocheck — roda no Deno (Supabase Edge Runtime), não no Node.
//
// Repassa um chamado do Visor (tabela chamados + print no bucket privado) para
// a CENTRAL CCI (Edge Function receber-chamado, contrato em
// C:\BlakBox\CentralCCI\docs\INTEGRACAO-CHAMADOS.md).
//
// Quem chama: o navegador, logo depois de gravar o chamado (só manda o id) e o
// botão "Reenviar" do Painel › Chamados. O segredo do Visor na Central
// (CENTRAL_CCI_SEGREDO) existe SÓ aqui, nos secrets — nunca no front.
//
// Regras:
//  - Só o AUTOR do chamado ou um administrador (is_master) pode mandar enviar.
//  - O autor e a rede saem do BANCO (não do corpo da requisição).
//  - Idempotente: id_origem = id do chamado no Visor; reenviar não duplica.
//  - Resultado gravado no chamado (central_id / central_enviado_em / central_erro).
//
// Deploy:  supabase functions deploy enviar-chamado-central
//          (COM verificação de JWT: quem chama é um usuário logado do Visor)
// Secrets: CENTRAL_CCI_SEGREDO (obrigatório). CENTRAL_CCI_URL (opcional).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'

const CENTRAL_URL_PADRAO = 'https://ndmglkbegpusemwnyltl.supabase.co/functions/v1/receber-chamado'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { ok: false, erro: 'Use POST.' })

  const segredo = Deno.env.get('CENTRAL_CCI_SEGREDO')
  if (!segredo) return json(500, { ok: false, erro: 'CENTRAL_CCI_SEGREDO não configurado no Visor.' })
  const centralUrl = Deno.env.get('CENTRAL_CCI_URL') || CENTRAL_URL_PADRAO

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json(401, { ok: false, erro: 'Sem login.' })
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json(401, { ok: false, erro: 'Sessão inválida.' })

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  let chamadoId = ''
  try { chamadoId = String((await req.json())?.chamado_id ?? '') } catch { /* corpo inválido */ }
  if (!/^[0-9a-f-]{36}$/i.test(chamadoId)) return json(400, { ok: false, erro: 'chamado_id inválido.' })

  const { data: ch, error: chErr } = await admin.from('chamados').select('*').eq('id', chamadoId).maybeSingle()
  if (chErr) return json(500, { ok: false, erro: chErr.message })
  if (!ch) return json(404, { ok: false, erro: 'Chamado não encontrado.' })

  const { data: perfil } = await admin.from('profiles').select('is_master').eq('user_id', user.id).maybeSingle()
  if (ch.autor_id !== user.id && perfil?.is_master !== true) return json(403, { ok: false, erro: 'Sem permissão.' })

  // Autor e rede vêm do banco.
  let autorEmail: string | null = null
  if (ch.autor_id) {
    const { data: au } = await admin.auth.admin.getUserById(ch.autor_id)
    autorEmail = au?.user?.email ?? null
  }
  let cliente: Record<string, string> | undefined
  if (ch.rede_id) {
    const { data: rede } = await admin.from('redes').select('id, nome').eq('id', ch.rede_id).maybeSingle()
    cliente = { tipo: 'rede', id: ch.rede_id, ...(rede?.nome ? { nome: rede.nome } : {}) }
  }

  let printBase64: string | undefined
  if (ch.print_path) {
    const { data: blob, error: dErr } = await admin.storage.from('chamados').download(ch.print_path)
    if (!dErr && blob) printBase64 = encodeBase64(new Uint8Array(await blob.arrayBuffer()))
  }

  const corpo = {
    id_origem: ch.id,
    tipo: ch.tipo,
    descricao: ch.descricao,
    contexto: ch.contexto ?? {},
    autor: { ...(ch.autor_id ? { id: ch.autor_id } : {}), nome: ch.autor_nome || autorEmail || 'Usuário do Visor', ...(autorEmail ? { email: autorEmail } : {}) },
    ...(cliente ? { cliente } : {}),
    ...(printBase64 ? { print_base64: printBase64 } : {}),
    criado_em: ch.criado_em,
  }

  let status = 0
  let resp: { ok?: boolean; id?: string; erro?: string; duplicado?: boolean } = {}
  try {
    const r = await fetch(centralUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cci-app': 'visor360', 'x-cci-segredo': segredo },
      body: JSON.stringify(corpo),
    })
    status = r.status
    resp = await r.json().catch(() => ({}))
  } catch (e) {
    resp = { erro: `Central fora do ar: ${(e as Error).message}` }
  }

  if ((status === 200 || status === 201) && resp.id) {
    await admin.from('chamados').update({ central_id: resp.id, central_enviado_em: new Date().toISOString(), central_erro: null }).eq('id', ch.id)
    return json(200, { ok: true, central_id: resp.id, duplicado: !!resp.duplicado })
  }
  const erro = resp.erro || `A Central respondeu ${status || 'sem resposta'}.`
  await admin.from('chamados').update({ central_erro: erro.slice(0, 500) }).eq('id', ch.id)
  return json(502, { ok: false, erro })
})
