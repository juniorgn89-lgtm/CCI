// @ts-nocheck — roda no Deno (Supabase Edge Runtime), não no Node.
//
// chamados-central — o Visor conversando com a CENTRAL CCI sobre chamados já
// enviados (o envio em si é a enviar-chamado-central). Mesmo modelo do NotaOK.
//
// body.acao:
//  - 'sincronizar' { ids? } → pergunta à Central o status e a resposta
//    (consultar-chamados) e atualiza aqui. Antes, reenvia os cancelamentos que
//    ainda não chegaram lá.
//  - 'cancelar' { chamado_id } → avisa a Central (cancelar-chamado) de um
//    chamado já cancelado aqui (rpc chamado_cancelar, com o motivo).
//
// Quem pode: diretor (is_master) vê/mexe em todos; os demais, só nos próprios
// chamados e só com a permissão de abrir chamado (profiles.pode_abrir_chamados).
//
// 404 da Central: "função não publicada" (corpo sem `ok`) → indisponivel, tenta
// de novo depois. "Chamado não encontrado" (corpo { ok:false, erro }) é erro de
// verdade → grava em central_erro e aparece para o diretor (não fica escondido).
//
// Deploy:  npx supabase@latest functions deploy chamados-central --project-ref yzmorbfadoxowchkwspl
//          (COM verificação de JWT: quem chama é um usuário logado do Visor)
// Secrets: CENTRAL_CCI_SEGREDO (o mesmo do envio) · CENTRAL_CCI_URL (opcional).
// SQL:     docs/supabase-chamados-meus.sql
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CENTRAL_URL_PADRAO = 'https://ndmglkbegpusemwnyltl.supabase.co/functions/v1/receber-chamado'
const STATUS_VALIDOS = ['novo', 'analise', 'resolvido', 'descartado', 'cancelado']

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/** As funções da Central ficam ao lado da receber-chamado. */
const urlCentral = (funcao: string) =>
  (Deno.env.get('CENTRAL_CCI_URL') || CENTRAL_URL_PADRAO).trim().replace(/receber-chamado\/?$/, funcao)

const chamarCentral = async (segredo: string, funcao: string, corpo: unknown): Promise<{ status: number; dados: any }> => {
  try {
    const r = await fetch(urlCentral(funcao), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cci-app': 'visor360', 'x-cci-segredo': segredo },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(20_000),
    })
    return { status: r.status, dados: await r.json().catch(() => ({})) }
  } catch (e) {
    console.error(`chamados-central: falha de rede em ${funcao}`, (e as Error).message)
    return { status: 0, dados: {} }
  }
}

/** 404 do gateway (função ainda não publicada na Central) × 404 da própria função. */
const funcaoAusente = (status: number, dados: any) => status === 404 && dados?.ok !== false

const erroCentral = (status: number, dados: any) =>
  status === 401 ? 'A integração com a Central está mal configurada (segredo). Avise a CCI.'
  : status === 404 ? (dados?.erro || 'A Central não encontrou este chamado.')
  : status === 400 ? (dados?.erro || 'Pedido inválido.')
  : 'A Central não respondeu. Tente de novo.'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { ok: false, erro: 'Use POST.' })

  const segredo = (Deno.env.get('CENTRAL_CCI_SEGREDO') || '').trim()
  if (!segredo) return json(500, { ok: false, erro: 'CENTRAL_CCI_SEGREDO não configurado no Visor.' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json(401, { ok: false, erro: 'Sem login.' })
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json(401, { ok: false, erro: 'Sessão inválida.' })

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: perfil } = await admin.from('profiles').select('*').eq('user_id', user.id).maybeSingle()
  const master = perfil?.is_master === true
  if (!master && perfil?.pode_abrir_chamados !== true) return json(403, { ok: false, erro: 'Sem permissão para chamados.' })
  const meus = (q: any) => (master ? q : q.eq('autor_id', user.id))

  let body: any = {}
  try { body = await req.json() } catch { return json(400, { ok: false, erro: 'Corpo inválido.' }) }

  // Avisa a Central de um cancelamento.
  const avisarCancelamento = async (ch: any) => {
    let autorNome: string | null = null
    let autorEmail: string | null = null
    if (ch.cancelado_por) {
      const { data: p } = await admin.from('profiles').select('full_name').eq('user_id', ch.cancelado_por).maybeSingle()
      const { data: au } = await admin.auth.admin.getUserById(ch.cancelado_por)
      autorNome = p?.full_name ?? null
      autorEmail = au?.user?.email ?? null
    }
    const { status, dados } = await chamarCentral(segredo, 'cancelar-chamado', {
      id_origem: ch.id,
      motivo: ch.cancelado_motivo,
      autor: {
        ...(ch.cancelado_por ? { id: ch.cancelado_por } : {}),
        nome: autorNome || autorEmail || 'Usuário do Visor',
        ...(autorEmail ? { email: autorEmail } : {}),
      },
      ...(ch.cancelado_em ? { cancelado_em: ch.cancelado_em } : {}),
    })
    if (status === 200 || status === 201) {
      await admin.from('chamados').update({ central_cancelado_em: new Date().toISOString(), central_erro: null }).eq('id', ch.id)
      return { ok: true }
    }
    if (funcaoAusente(status, dados)) return { ok: false, indisponivel: true }
    const erro = erroCentral(status, dados)
    await admin.from('chamados').update({ central_erro: erro.slice(0, 500) }).eq('id', ch.id)
    return { ok: false, erro }
  }

  if (body.acao === 'cancelar') {
    const id = String(body.chamado_id ?? '')
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json(400, { ok: false, erro: 'Chamado inválido.' })
    const { data: ch } = await meus(admin.from('chamados').select('*').eq('id', id)).maybeSingle()
    if (!ch) return json(404, { ok: false, erro: 'Chamado não encontrado.' })
    if (ch.status !== 'cancelado') return json(400, { ok: false, erro: 'Cancele o chamado antes de avisar a Central.' })
    if (!ch.central_id) return json(200, { ok: true, local: true }) // nunca foi para a Central: vale só aqui
    if (ch.central_cancelado_em) return json(200, { ok: true })
    const r = await avisarCancelamento(ch)
    return r.ok || r.indisponivel ? json(200, r) : json(502, r)
  }

  if (body.acao === 'sincronizar') {
    let q = meus(admin.from('chamados').select('*').not('central_id', 'is', null))
    if (Array.isArray(body.ids) && body.ids.length) q = q.in('id', body.ids.slice(0, 200))
    const { data: lista, error } = await q.order('criado_em', { ascending: false }).limit(200)
    if (error) return json(500, { ok: false, erro: error.message })
    if (!lista?.length) return json(200, { ok: true, atualizados: 0 })

    // 1) Cancelamentos que ainda não chegaram à Central.
    for (const ch of lista.filter((c: any) => c.status === 'cancelado' && !c.central_cancelado_em)) {
      const r = await avisarCancelamento(ch)
      if (r.indisponivel) break
      if (r.ok) ch.central_cancelado_em = new Date().toISOString()
    }

    // 2) Status e resposta da Central.
    const { status, dados } = await chamarCentral(segredo, 'consultar-chamados', { ids_origem: lista.map((c: any) => c.id) })
    if (funcaoAusente(status, dados)) return json(200, { ok: false, indisponivel: true })
    if (status !== 200) return json(502, { ok: false, erro: erroCentral(status, dados) })

    const porId = new Map((dados?.chamados || []).map((c: any) => [String(c.id_origem), c]))
    const agora = new Date().toISOString()
    let atualizados = 0
    for (const ch of lista as any[]) {
      const c: any = porId.get(ch.id)
      if (!c) continue
      // Cancelado aqui e a Central ainda não sabe: mantém o "cancelado".
      const novo = ch.status === 'cancelado' && c.status !== 'cancelado' ? 'cancelado' : c.status
      const patch: Record<string, unknown> = {
        status: STATUS_VALIDOS.includes(novo) ? novo : ch.status,
        resposta: c.resposta ?? null,
        resolvido_por_nome: c.resolvido_por_nome ?? null,
        central_sincronizado_em: agora,
      }
      if (patch.status !== ch.status || patch.resposta !== ch.resposta || patch.resolvido_por_nome !== ch.resolvido_por_nome) {
        patch.atualizado_em = c.atualizado_em || agora
        atualizados++
      }
      await admin.from('chamados').update(patch).eq('id', ch.id)
    }
    return json(200, { ok: true, atualizados })
  }

  return json(400, { ok: false, erro: 'Ação inválida.' })
})
