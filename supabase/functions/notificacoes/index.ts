// @ts-nocheck — roda no Deno (Supabase Edge Runtime), não no Node.
//
// notificacoes — avisos no celular (Web Push) do Visor360. Mesmo desenho do NotaOK.
//
// Ações (body.acao):
//   chave      (usuário logado)  chave pública VAPID para o aparelho se inscrever
//   testar     (usuário logado)  manda um aviso de teste para os aparelhos da pessoa
//   processar  (pg_cron, header x-cron-secret = CRON_SECRET)
//              pega a fila já agrupada (notificacao_preparar) e envia
//
// Deploy:  npx supabase@latest functions deploy notificacoes --no-verify-jwt --project-ref yzmorbfadoxowchkwspl
//          (--no-verify-jwt: o cron chama sem login; o usuário é conferido aqui dentro.)
// Secrets: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY  (npx web-push generate-vapid-keys)
//          VAPID_SUBJECT (opcional; padrão https://visor360.cci.app.br)
//          NOTIFICACOES_CRON_SECRET (o mesmo valor do <NOTIFICACOES_CRON_SECRET> no SQL do cron).
//          Se não existir, usa o CRON_SECRET (o do apurar-cron).
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface Inscricao { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }
interface Mensagem { title: string; body: string; url: string; tag: string }

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

const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

let vapidPronto = false
function prepararVapid() {
  if (vapidPronto) return
  const pub = Deno.env.get('VAPID_PUBLIC_KEY')
  const priv = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!pub || !priv) throw new Erro(503, 'Os avisos no celular ainda não foram configurados no servidor. Avise o suporte da CCI.')
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') || 'https://visor360.cci.app.br', pub, priv)
  vapidPronto = true
}
class Erro extends Error { constructor(public status: number, m: string) { super(m) } }

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios.replace('#', String(n)))
const curto = (s: string | null | undefined) => (s || '').trim().split(/\s+/).slice(0, 3).join(' ')
const brl = (v: unknown) => (Number.isFinite(Number(v)) ? `R$ ${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}` : '')

function montar(tipo: string, qtd: number, itens: any[] | null, resumo: Record<string, number> | null): Mensagem | null {
  const l = itens || []
  const um = qtd === 1 ? l[0] : null
  const fornecedores = () => { const n = [...new Set(l.map((i) => curto(i.fornecedor)).filter(Boolean))]; return n.slice(0, 3).join(', ') + (n.length > 3 ? ` e mais ${n.length - 3}` : '') }
  switch (tipo) {
    case 'pedido_aguardando':
      return {
        title: plural(qtd, 'Pedido aguardando sua liberação', '# pedidos aguardando sua liberação'),
        body: um ? [`Pedido nº ${um.numero}`, curto(um.fornecedor), brl(um.valor)].filter(Boolean).join(' · ') : fornecedores(),
        url: '/compras', tag: um ? `pedido-${um.id}` : 'pedidos-aguardando',
      }
    case 'pedido_decidido': {
      if (um) {
        const t = um.status === 'recusado' ? `Pedido nº ${um.numero} recusado` : um.status === 'liberado_parcial' ? `Pedido nº ${um.numero} liberado em parte` : `Pedido nº ${um.numero} liberado`
        return { title: t, body: [curto(um.fornecedor), um.status === 'recusado' ? (um.motivo || '') : brl(um.valor)].filter(Boolean).join(' · '), url: '/compras', tag: `pedido-${um.id}` }
      }
      return { title: `${qtd} pedidos seus foram decididos`, body: fornecedores(), url: '/compras', tag: 'pedidos-decididos' }
    }
    case 'nota_devolvida':
      return {
        title: plural(qtd, 'Nota do pedido devolvida para correção', '# notas de pedidos devolvidas'),
        body: um ? [`Pedido nº ${um.numero}`, um.nota ? `NF ${um.nota}` : null, curto(um.fornecedor)].filter(Boolean).join(' · ') : fornecedores(),
        url: '/compras', tag: um ? `pedido-${um.id}` : 'notas-devolvidas',
      }
    case 'tarefa_atribuida':
      return {
        title: plural(qtd, 'Nova tarefa para você', '# novas tarefas para você'),
        body: um ? String(um.titulo || '') : l.slice(0, 3).map((i) => i.titulo).join(' · '),
        url: '/gestao?tab=tarefas', tag: um ? `tarefa-${um.id}` : 'tarefas-novas',
      }
    case 'lembrete': {
      const r = resumo || {}
      const partes = [
        r.atrasadas ? plural(r.atrasadas, '1 tarefa atrasada', '# tarefas atrasadas') : null,
        r.vencem_hoje ? plural(r.vencem_hoje, '1 tarefa vence hoje', '# tarefas vencem hoje') : null,
        r.a_liberar ? plural(r.a_liberar, '1 pedido a liberar', '# pedidos a liberar') : null,
        r.notas_devolvidas ? plural(r.notas_devolvidas, '1 pedido com nota devolvida', '# pedidos com nota devolvida') : null,
      ].filter(Boolean)
      if (!partes.length) return null
      return { title: 'Pendências de hoje no Visor360', body: partes.join(' · '), url: (r.atrasadas || r.vencem_hoje) ? '/gestao?tab=tarefas' : '/compras', tag: 'lembrete' }
    }
  }
  return null
}

async function enviar(inscricoes: Inscricao[], msg: Mensagem) {
  const db = admin()
  const corpo = JSON.stringify(msg)
  const r = await Promise.allSettled(inscricoes.map((s) =>
    webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, corpo, { TTL: 6 * 3600, urgency: 'high' })))
  const mortas: string[] = [], vivas: string[] = []
  r.forEach((x, i) => {
    if (x.status === 'fulfilled') vivas.push(inscricoes[i].id)
    else {
      const code = (x.reason as { statusCode?: number })?.statusCode
      if (code === 404 || code === 410) mortas.push(inscricoes[i].id)
      else console.error('notificacoes: envio', code, (x.reason as Error)?.message)
    }
  })
  if (mortas.length) await db.from('push_inscricoes').delete().in('id', mortas)
  if (vivas.length) await db.from('push_inscricoes').update({ usada_em: new Date().toISOString() }).in('id', vivas)
  return { enviadas: vivas.length, removidas: mortas.length }
}

async function processar() {
  prepararVapid()
  const db = admin()
  const { data: linhas, error } = await db.rpc('notificacao_preparar')
  if (error) throw new Error(error.message)
  if (!linhas?.length) return { mensagens: 0 }
  const pessoas = [...new Set(linhas.map((l: any) => l.user_id))]
  const { data: subs, error: e2 } = await db.from('push_inscricoes').select('id, user_id, endpoint, p256dh, auth').in('user_id', pessoas)
  if (e2) throw new Error(e2.message)
  const porPessoa = new Map<string, Inscricao[]>()
  for (const s of (subs || []) as Inscricao[]) porPessoa.set(s.user_id, [...(porPessoa.get(s.user_id) || []), s])
  let enviadas = 0
  for (const l of linhas as any[]) {
    const msg = montar(l.tipo, l.qtd, l.itens, l.resumo)
    const destino = porPessoa.get(l.user_id)
    if (!msg || !destino?.length) continue
    enviadas += (await enviar(destino, msg)).enviadas
  }
  return { mensagens: linhas.length, enviadas }
}

Deno.serve(async (req) => {
  const h = cors(req)
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...h, 'Content-Type': 'application/json' } })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h })
  if (req.method !== 'POST') return json(405, { erro: 'Use POST.' })
  try {
    // Segredo próprio dos avisos (não mexe no da apuração); cai no CRON_SECRET se não houver.
    const cron = Deno.env.get('NOTIFICACOES_CRON_SECRET') || Deno.env.get('CRON_SECRET')
    if (cron && req.headers.get('x-cron-secret') === cron) return json(200, await processar())

    // Demais ações: usuário logado (conferido aqui; a função é --no-verify-jwt por causa do cron).
    const authz = req.headers.get('Authorization') ?? ''
    if (!authz) return json(401, { erro: 'Entre de novo.' })
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authz } }, auth: { persistSession: false } })
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return json(401, { erro: 'Entre de novo.' })

    const body = await req.json().catch(() => ({}))
    if (body.acao === 'chave') {
      const chave = Deno.env.get('VAPID_PUBLIC_KEY')
      if (!chave) return json(503, { erro: 'Os avisos no celular ainda não foram configurados no servidor. Avise o suporte da CCI.' })
      return json(200, { chave })
    }
    if (body.acao === 'testar') {
      prepararVapid()
      const { data: subs, error } = await admin().from('push_inscricoes').select('id, user_id, endpoint, p256dh, auth').eq('user_id', user.id)
      if (error) throw new Error(error.message)
      if (!subs?.length) return json(400, { erro: 'Nenhum aparelho seu está com os avisos ligados.' })
      const r = await enviar(subs as Inscricao[], { title: 'Avisos do Visor360 ligados', body: 'É assim que os avisos vão chegar neste aparelho.', url: '/', tag: 'teste' })
      return json(200, { ...r, aparelhos: subs.length })
    }
    return json(400, { erro: 'Ação inválida.' })
  } catch (e) {
    if (e instanceof Erro) return json(e.status, { erro: e.message })
    console.error('notificacoes:', (e as Error).message)
    return json(500, { erro: 'Não foi possível concluir agora. Tente de novo.' })
  }
})
