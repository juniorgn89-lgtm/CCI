// ============================================================================
// servicos-cci — Admin › Redes: ver e marcar os serviços da CCI por posto,
// gravando no Prospecção360 (a fonte) e atualizando a cópia do Visor na hora.
//
// Chamada pelo app (supabase.functions.invoke) com o JWT do usuário: só
// MASTER do Visor pode. Ações:
//   { acao: 'postos', rede_id }                      → postos da rede (ERP) + se é lead no Prospecção + serviços ativos
//   { acao: 'marcar', rede_id, empresa_codigo, servico, ligado, desde? } → grava no Prospecção e na cópia local
//   { acao: 'datar', rede_id, empresas: number[], servico, desde } → corrige a data de início (marco do Diagnóstico)
// Segredos: PROSPECCAO_URL, PROSPECCAO_ANON_KEY, PROSPECCAO_SEGREDO (os mesmos da sincronização).
// Deploy COM verificação de JWT (padrão; NÃO usar --no-verify-jwt aqui).
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })
const digitos = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')
const hoje = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10) // America/Sao_Paulo

interface Rede { id: string; nome: string; chave: string; api_base_url: string }

const empresasDaRede = async (r: Rede) => {
  const base = r.api_base_url.endsWith('/') ? r.api_base_url.slice(0, -1) : r.api_base_url
  const res = await fetch(`${base}/EMPRESAS?CHAVE=${encodeURIComponent(r.chave)}&limite=200`)
  if (!res.ok) throw new Error(`Quality ${res.status} em /EMPRESAS`)
  const body = await res.json() as { resultados?: { codigo?: number; empresaCodigo?: number; cnpj?: string; fantasia?: string; razao?: string; razaoSocial?: string }[] }
  return (body.resultados ?? [])
    .map((e) => ({ codigo: e.codigo ?? e.empresaCodigo ?? 0, cnpj: digitos(e.cnpj), nome: (e.fantasia || e.razao || e.razaoSocial || '').trim() }))
    .filter((e) => e.codigo > 0)
}

const rpc = async (nome: string, args: Record<string, unknown>) => {
  const url = Deno.env.get('PROSPECCAO_URL')!.replace(/\/$/, '')
  const key = Deno.env.get('PROSPECCAO_ANON_KEY')!
  const res = await fetch(`${url}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_segredo: Deno.env.get('PROSPECCAO_SEGREDO'), ...args }),
  })
  if (!res.ok) throw new Error(`Prospecção ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Só master do Visor.
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const { data: u } = await supa.auth.getUser(token)
  if (!u?.user) return json({ error: 'não autenticado' }, 401)
  const { data: perfil } = await supa.from('profiles').select('is_master, full_name').eq('user_id', u.user.id).maybeSingle()
  if (!perfil?.is_master) return json({ error: 'só administrador' }, 403)
  const autor = (perfil.full_name as string | null) || u.user.email || 'administrador'

  const body = await req.json().catch(() => ({})) as { acao?: string; rede_id?: string; empresa_codigo?: number; servico?: string; ligado?: boolean; desde?: string; empresas?: number[] }
  if (!body.rede_id) return json({ error: 'rede_id obrigatório' }, 400)
  const { data: rede } = await supa.from('redes').select('id, nome, chave, api_base_url').eq('id', body.rede_id).maybeSingle()
  if (!rede) return json({ error: 'rede não encontrada' }, 404)

  try {
    const empresas = await empresasDaRede(rede as Rede)

    if (body.acao === 'postos') {
      const cnpjs = empresas.map((e) => e.cnpj).filter((c) => c.length >= 11)
      const leads = cnpjs.length ? await rpc('cnpjs_no_prospeccao', { p_cnpjs: cnpjs }) as { cnpj: string; lead_nome: string }[] : []
      const noProsp = new Map(leads.map((l) => [l.cnpj, l.lead_nome]))
      const { data: servs } = await supa.from('cci_servicos_posto').select('empresa_codigo, servico, desde, ate').eq('rede_id', rede.id)
      const d = hoje()
      return json({
        postos: empresas.map((e) => ({
          empresa_codigo: e.codigo, nome: e.nome || `Posto ${e.codigo}`, cnpj: e.cnpj,
          no_prospeccao: noProsp.has(e.cnpj), lead_nome: noProsp.get(e.cnpj) ?? null,
          ativos: (servs ?? []).filter((s) => s.empresa_codigo === e.codigo && (!s.ate || s.ate >= d)).map((s) => ({ servico: s.servico, desde: s.desde })),
        })),
      })
    }

    if (body.acao === 'marcar') {
      const e = empresas.find((x) => x.codigo === body.empresa_codigo)
      if (!e || !body.servico || typeof body.ligado !== 'boolean') return json({ error: 'posto ou serviço inválido' }, 400)
      // Ligar aceita a data real de início (não no futuro); encerrar é sempre hoje.
      const pedida = typeof body.desde === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.desde) ? body.desde : null
      if (pedida && pedida > hoje()) return json({ error: 'A data de início não pode ser no futuro.' }, 400)
      const d = body.ligado && pedida ? pedida : hoje()
      const r = await rpc('marcar_servico_cci', { p_cnpj: e.cnpj, p_servico: body.servico, p_ligado: body.ligado, p_data: d, p_autor: autor })
      if (r === 'sem_lead') return json({ error: 'Este posto não está cadastrado como lead no Prospecção (CNPJ não encontrado).' }, 409)
      // Cópia local na hora (a sincronização da madrugada confirma depois).
      if (body.ligado) {
        const ja = await supa.from('cci_servicos_posto').select('desde').eq('rede_id', rede.id).eq('empresa_codigo', e.codigo).eq('servico', body.servico).is('ate', null).limit(1)
        if (!ja.data?.length) {
          const ins = await supa.from('cci_servicos_posto').insert({ rede_id: rede.id, empresa_codigo: e.codigo, cnpj: e.cnpj, servico: body.servico, desde: d, ate: null, origem: 'manual' })
          if (ins.error && !/duplicate/i.test(ins.error.message)) throw new Error(ins.error.message)
        }
      } else {
        const up = await supa.from('cci_servicos_posto').update({ ate: d }).eq('rede_id', rede.id).eq('empresa_codigo', e.codigo).eq('servico', body.servico).is('ate', null)
        if (up.error) throw new Error(up.error.message)
      }
      return json({ ok: true })
    }

    if (body.acao === 'datar') {
      const desde = typeof body.desde === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.desde) ? body.desde : null
      if (!desde || desde > hoje()) return json({ error: 'Data de início inválida (não pode ser no futuro).' }, 400)
      const alvos = empresas.filter((x) => Array.isArray(body.empresas) && body.empresas.includes(x.codigo))
      if (!alvos.length || !body.servico) return json({ error: 'posto ou serviço inválido' }, 400)
      const falhas: string[] = []
      for (const e of alvos) {
        const r = await rpc('datar_servico_cci', { p_cnpj: e.cnpj, p_servico: body.servico, p_desde: desde, p_autor: autor })
        if (r !== 'ok') { falhas.push(e.nome || `Posto ${e.codigo}`); continue }
        const up = await supa.from('cci_servicos_posto').update({ desde }).eq('rede_id', rede.id).eq('empresa_codigo', e.codigo).eq('servico', body.servico).is('ate', null)
        if (up.error) throw new Error(up.error.message)
      }
      return json({ ok: true, falhas })
    }

    return json({ error: 'ação desconhecida' }, 400)
  } catch (err) {
    return json({ error: (err as Error).message }, 502)
  }
})
