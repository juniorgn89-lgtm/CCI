// ============================================================================
// eextrato — ponte do Visor360 com a conciliadora e-extrato (Boavista).
// As chaves (chaveAcesso/chaveSecreta) ficam SÓ aqui, como segredos da função;
// o navegador nunca as vê. Só consulta (retornos); remessa de vendas fica fora.
//
// Chamada pelo app (supabase.functions.invoke) com o JWT do usuário. Por ora
// só diretores (MASTER) e a conta da CCI (fase de integração). Ações:
//   { acao: 'status' }                                   → { configurado }
//   { acao: 'consultar', tipo, filtro, todasPaginas? }   → { itens, paginas, completo }
// Segredos (provisório, até a Boavista dizer se a chave é por rede ou da CCI):
//   EEXTRATO_CHAVE_ACESSO, EEXTRATO_CHAVE_SECRETA
// Deploy COM verificação de JWT (padrão; NÃO usar --no-verify-jwt aqui).
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  EEXTRATO_BASE, CAMINHO_RETORNO, montarFiltroXml, validarFiltro, cabecalhos, lerResposta, buscarTodasPaginas,
  type TipoRetorno, type FiltroEextrato,
} from '../_shared/eextrato.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })
const TIPOS = Object.keys(CAMINHO_RETORNO) as TipoRetorno[]
/** Teto de páginas por consulta: acima disso a resposta diz "incompleto". */
const MAX_PAGINAS = 50
const TIMEOUT_MS = 30_000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const { data: u } = await supa.auth.getUser(token)
  if (!u?.user) return json({ error: 'não autenticado' }, 401)
  const { data: perfil } = await supa.from('profiles').select('is_master').eq('user_id', u.user.id).maybeSingle()
  // Mesma regra da tela (src/pages/Financeiro/lib/acessoConciliacao.ts).
  const contaCci = (u.user.email ?? '').toLowerCase() === 'contato@cci.app.br'
  if (!perfil?.is_master && !contaCci) return json({ error: 'só diretores, durante a integração' }, 403)

  const acesso = Deno.env.get('EEXTRATO_CHAVE_ACESSO') ?? ''
  const secreta = Deno.env.get('EEXTRATO_CHAVE_SECRETA') ?? ''
  const configurado = !!acesso && !!secreta

  const body = await req.json().catch(() => ({})) as { acao?: string; tipo?: string; filtro?: FiltroEextrato; todasPaginas?: boolean }
  if (body.acao === 'status') return json({ configurado })

  if (body.acao === 'consultar') {
    // Sem chave: diz isso. Nunca devolve lista vazia como se não houvesse movimento.
    if (!configurado) return json({ error: 'A integração com a e-extrato ainda não tem chave de acesso configurada.' }, 409)
    const tipo = body.tipo as TipoRetorno
    if (!TIPOS.includes(tipo)) return json({ error: 'tipo de consulta inválido' }, 400)
    const filtro = body.filtro ?? {}
    const invalido = validarFiltro(tipo, filtro)
    if (invalido) return json({ error: invalido }, 400)

    const buscar = async (pagina: number) => {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
      try {
        const res = await fetch(EEXTRATO_BASE + CAMINHO_RETORNO[tipo], {
          method: 'POST', headers: cabecalhos(acesso, secreta), body: montarFiltroXml({ ...filtro, pagina }), signal: ctrl.signal,
        })
        const texto = await res.text()
        try { return JSON.parse(texto) } catch { throw new Error(`e-extrato ${res.status}: resposta fora do formato JSON (${texto.slice(0, 160)})`) }
      } finally { clearTimeout(t) }
    }

    try {
      if (!body.todasPaginas) {
        const r = lerResposta(tipo, await buscar(filtro.pagina ?? 1))
        return r.ok ? json({ itens: r.itens, pagina: r.pagina, totalPaginas: r.totalPaginas, completo: r.pagina >= r.totalPaginas }) : json({ error: r.erro }, 422)
      }
      const r = await buscarTodasPaginas(tipo, buscar, MAX_PAGINAS)
      return r.ok ? json({ itens: r.itens, paginas: r.paginas, completo: r.completo }) : json({ error: `${r.erro} (página ${r.pagina})` }, 422)
    } catch (err) {
      const msg = (err as Error).name === 'AbortError' ? 'A e-extrato demorou demais para responder.' : (err as Error).message
      return json({ error: msg }, 502)
    }
  }

  return json({ error: 'ação desconhecida' }, 400)
})
