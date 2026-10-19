// ============================================================================
// sincronizar-servicos-cci — copia do Prospecção360 os serviços da CCI
// contratados por posto e casa com os postos de cada rede do Visor pelo CNPJ.
//
// Fonte: RPC `exportar_servicos_cci(p_segredo)` do Prospecção (só CNPJ,
// serviço, desde, até e origem — nada de cliente, valor ou vendedor).
// Destino: public.cci_servicos_posto (o app só lê).
// Segredos (supabase secrets): CRON_SECRET (o mesmo do apurar-cron),
// PROSPECCAO_URL, PROSPECCAO_ANON_KEY, PROSPECCAO_SEGREDO.
// Deploy SEMPRE com --no-verify-jwt (o cron chama sem JWT, com x-cron-secret).
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface Rede { id: string; nome: string; chave: string; api_base_url: string }
interface ServicoExport { cnpj: string; servico: string; desde: string; ate: string | null; origem: string | null }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const digitos = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')

/** /EMPRESAS do ERP da rede: código + CNPJ de cada posto (GET, CHAVE na query). */
const empresasDaRede = async (r: Rede): Promise<{ codigo: number; cnpj: string }[]> => {
  const base = r.api_base_url.endsWith('/') ? r.api_base_url.slice(0, -1) : r.api_base_url
  const url = `${base}/EMPRESAS?CHAVE=${encodeURIComponent(r.chave)}&limite=200`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Quality ${res.status} em /EMPRESAS`)
  const body = await res.json() as { resultados?: { codigo?: number; empresaCodigo?: number; cnpj?: string }[] }
  return (body.resultados ?? []).map((e) => ({ codigo: e.codigo ?? e.empresaCodigo ?? 0, cnpj: digitos(e.cnpj) })).filter((e) => e.codigo > 0 && e.cnpj.length >= 11)
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET')
  const provided = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!secret || provided !== secret) return json({ error: 'unauthorized' }, 401)

  const pUrl = Deno.env.get('PROSPECCAO_URL'), pKey = Deno.env.get('PROSPECCAO_ANON_KEY'), pSeg = Deno.env.get('PROSPECCAO_SEGREDO')
  if (!pUrl || !pKey || !pSeg) return json({ error: 'faltam os segredos do Prospecção (PROSPECCAO_URL / _ANON_KEY / _SEGREDO)' }, 500)

  // 1) Serviços do Prospecção (uma chamada só, a rede toda da CCI).
  const pr = await fetch(`${pUrl.replace(/\/$/, '')}/rest/v1/rpc/exportar_servicos_cci`, {
    method: 'POST',
    headers: { apikey: pKey, authorization: `Bearer ${pKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_segredo: pSeg }),
  })
  if (!pr.ok) return json({ error: `Prospecção ${pr.status}: ${(await pr.text()).slice(0, 200)}` }, 502)
  const servicos = (await pr.json()) as ServicoExport[]
  const porCnpj = new Map<string, ServicoExport[]>()
  for (const s of servicos) {
    const c = digitos(s.cnpj)
    if (!c) continue
    const l = porCnpj.get(c) ?? []
    l.push(s)
    porCnpj.set(c, l)
  }

  // 2) Cada rede ativa do Visor: casa os postos pelo CNPJ e substitui a cópia da rede.
  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: redes, error } = await supa.from('redes').select('id, nome, chave, api_base_url').eq('ativo', true)
  if (error) return json({ error: error.message }, 500)

  const agora = new Date().toISOString()
  const resumo: Record<string, unknown>[] = []
  for (const r of (redes ?? []) as Rede[]) {
    try {
      const empresas = await empresasDaRede(r)
      const linhas = empresas.flatMap((e) => (porCnpj.get(e.cnpj) ?? []).map((s) => ({
        rede_id: r.id, empresa_codigo: e.codigo, cnpj: e.cnpj, servico: s.servico, desde: s.desde, ate: s.ate, origem: s.origem, sincronizado_em: agora,
      })))
      // Substitui a cópia da rede (o Prospecção é a fonte da verdade).
      const del = await supa.from('cci_servicos_posto').delete().eq('rede_id', r.id)
      if (del.error) throw new Error(del.error.message)
      if (linhas.length) {
        const ins = await supa.from('cci_servicos_posto').insert(linhas)
        if (ins.error) throw new Error(ins.error.message)
      }
      resumo.push({ rede: r.nome, postos: empresas.length, servicos: linhas.length })
    } catch (e) {
      resumo.push({ rede: r.nome, erro: (e as Error).message })
    }
  }
  return json({ servicosNoProspeccao: servicos.length, redes: resumo })
})
