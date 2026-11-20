// @ts-nocheck — roda no Deno (Supabase Edge Runtime), não no Node.
//
// central-cci — a "porta" do Visor360 para a Central CCI (módulo Pessoas).
// Contrato: C:\BlakBox\CentralCCI\docs\ARQUITETURA-FASES-2-3.md.
//
// Quem chama: SÓ a Edge Function `acessos` da Central, com o pedido assinado por
// HMAC (segredo de SAÍDA, diferente do segredo dos chamados):
//   x-cci-operacao   uuid por operação
//   x-cci-timestamp  segundos Unix (tolerância de 5 min)
//   x-cci-assinatura hex(HMAC_SHA256(segredo, "<timestamp>.<operacao>.<corpo>"))
//   x-cci-diretor    e-mail do diretor que pediu (log)
//
// Ações:
//   leitura  — catalogo, listar, opcoes (postos de uma ou mais redes, via Quality GET)
//   escrita  — criar, alterar, desativar, reativar, link_senha  (etapa 2, 20/11/2026)
//
// Regras da escrita (decisão do dono):
//   • Diretores (is_master) NUNCA são alterados pela Central → 403 proibido.
//     Ninguém vira diretor pela Central (papel "diretor" é recusado).
//   • Usuário novo entra aprovado e recebe um LINK para criar a senha (a Central
//     mostra e manda no WhatsApp). O link não é guardado em lugar nenhum.
//   • Cada operação é gravada em central_operacoes ANTES de executar: o mesmo
//     pedido não roda duas vezes (anti-repetição). SQL: docs/supabase-central-operacoes.sql.
//
// Deploy:  npx supabase@latest functions deploy central-cci --no-verify-jwt --project-ref yzmorbfadoxowchkwspl
//          (--no-verify-jwt: quem chama é a Central; a proteção é a assinatura HMAC)
// Secrets: CENTRAL_CCI_SEGREDO_SAIDA (o MESMO valor do CCI_SAIDA_VISOR360 da Central).
//          VISOR_URL (opcional; padrão https://visor360.cci.app.br) — destino do link de senha.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TOLERANCIA_S = 300
const ESCRITA = new Set(['criar', 'alterar', 'desativar', 'reativar', 'link_senha'])
/** Duração do link de recuperação no Supabase (padrão do projeto: 1 h). */
const LINK_VALIDADE_S = 3600

/**
 * Módulos do Visor (cópia de src/lib/modulos.ts → MODULOS). Mantenha igual:
 * a Edge Function não importa código do front.
 */
const MODULOS = [
  { id: 'dashboard', nome: 'Central da Rede' },
  { id: 'bombas', nome: 'Operação' },
  { id: 'produtividade', nome: 'Produtividade' },
  { id: 'estoques', nome: 'Estoques' },
  { id: 'financeiro', nome: 'Financeiro' },
  { id: 'qualidade-dados', nome: 'Qualidade de Dados' },
  { id: 'comercial', nome: 'Comercial · Lucro' },
  { id: 'inteligencia', nome: 'Inteligência' },
]
const MODULOS_IDS = new Set(MODULOS.map((m) => m.id))

/** Chaves liga/desliga de profiles (as mesmas da tela Painel › Usuários). */
const PERMISSOES = [
  { id: 'pode_apurar', nome: 'Apurar meses', descricao: 'Roda a apuração e pré-carrega meses fechados.' },
  { id: 'pode_ver_reabastecimento', nome: 'Ver reabastecimento', descricao: 'Vê o painel de estoque de combustível baixo.' },
  { id: 'pode_demonstrar', nome: 'Modo demonstração', descricao: 'Mascara nome da rede e dos postos para apresentar o sistema.' },
  { id: 'pode_gerir_tarefas', nome: 'Gerir tarefas', descricao: 'Cria rotinas, setores e tarefas do módulo Tarefas.' },
  { id: 'pode_liberar_compras', nome: 'Liberar compras', descricao: 'Aprova pedidos de compra e define tetos.' },
  { id: 'pode_apagar_compras', nome: 'Apagar pedidos de compra', descricao: 'Pode apagar pedidos do módulo Compras.' },
  { id: 'pode_cadastrar_concorrencia', nome: 'Cadastrar concorrência', descricao: 'Cadastra preços e postos concorrentes.' },
  { id: 'pode_abrir_chamados', nome: 'Abrir chamados', descricao: 'Vê o botão de reportar bug/melhoria com print.' },
]
const PERMISSOES_IDS = new Set(PERMISSOES.map((p) => p.id))
const PAPEIS_EDITAVEIS = new Set(['user', 'supervisor'])

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const recusa = (status: number, codigo: string, erro: string, campo?: string) =>
  json(status, { ok: false, codigo, erro, ...(campo ? { campo } : {}) })

class Recusa extends Error {
  constructor(public status: number, public codigo: string, message: string, public campo?: string) { super(message) }
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const iguais = (a: string, b: string) => {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}
const assinar = async (segredo: string, msg: string) => {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)))
}
const ehUuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)
const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Perfil do Visor → Usuário no formato do contrato. */
const paraUsuario = (p: any, au?: { email: string | null; last_sign_in_at: string | null; created_at?: string }) => {
  const diretor = !!p.is_master
  const redesIds = [...new Set([...(p.redes_permitidas?.length ? p.redes_permitidas : [p.rede_id])].filter(Boolean))]
  const permissoes: Record<string, unknown> = { modulos: p.modulos_permitidos ?? [] }
  for (const k of PERMISSOES) permissoes[k.id] = !!p[k.id]
  return {
    id: p.user_id,
    email: au?.email ?? p.email ?? null,
    nome: p.full_name ?? null,
    papel: diretor ? 'diretor' : (p.role === 'supervisor' ? 'supervisor' : 'user'),
    permissoes,
    escopos: {
      redes: diretor || p.acesso_todas_redes ? { todos: true } : { todos: false, ids: redesIds },
      postos: p.empresa_codigos?.length ? { todos: false, ids: p.empresa_codigos.map(String) } : { todos: true },
    },
    ativo: p.ativo !== false,
    aprovado: p.approved === true,
    ultimo_acesso: au?.last_sign_in_at ?? null,
    criado_em: p.created_at ?? au?.created_at ?? null,
    somente_leitura: diretor,
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return recusa(405, 'invalido', 'Use POST.')
  const segredo = Deno.env.get('CENTRAL_CCI_SEGREDO_SAIDA')
  if (!segredo) return recusa(500, 'erro_interno', 'O Visor ainda não tem o segredo da Central configurado.')

  // ── assinatura ──────────────────────────────────────────────────────────
  const corpo = await req.text()
  const ts = req.headers.get('x-cci-timestamp') ?? ''
  const op = req.headers.get('x-cci-operacao') ?? ''
  const ass = (req.headers.get('x-cci-assinatura') ?? '').toLowerCase()
  const diretorEmail = (req.headers.get('x-cci-diretor') ?? '').slice(0, 320) || null
  const agora = Math.floor(Date.now() / 1000)
  if (!/^\d+$/.test(ts) || Math.abs(agora - Number(ts)) > TOLERANCIA_S || !op) {
    return recusa(401, 'assinatura', 'Pedido da Central fora do prazo ou incompleto.')
  }
  if (!iguais(ass, await assinar(segredo, `${ts}.${op}.${corpo}`))) {
    return recusa(401, 'assinatura', 'Assinatura da Central inválida.')
  }

  let pedido: { acao?: string; dados?: Record<string, unknown> } = {}
  try { pedido = JSON.parse(corpo) } catch { return recusa(400, 'invalido', 'Corpo inválido.') }
  const dados = ehObjeto(pedido.dados) ? pedido.dados : {}

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  // ── helpers que dependem do banco ────────────────────────────────────────
  const redesExistentes = async (ids: string[]) => {
    const { data, error } = await admin.from('redes').select('id').in('id', ids)
    if (error) throw error
    return new Set((data ?? []).map((r) => r.id))
  }

  /**
   * Traduz papel/permissões/escopos do contrato num patch de `profiles`.
   * Só mexe no que veio. Valida tudo (ids de rede, módulos, chaves).
   */
  const montarPatch = async (d: Record<string, unknown>, existentes: Set<string>, criando: boolean) => {
    const patch: Record<string, unknown> = {}
    if (d.nome !== undefined) {
      const nome = typeof d.nome === 'string' ? d.nome.trim() : ''
      if (!nome || nome.length > 120) throw new Recusa(400, 'invalido', 'Informe o nome (até 120 letras).', 'nome')
      patch.full_name = nome
    }
    if (d.papel !== undefined) {
      if (d.papel === 'diretor') throw new Recusa(403, 'proibido', 'A Central não cria nem promove diretores. Isso só se faz no próprio Visor.', 'papel')
      if (!PAPEIS_EDITAVEIS.has(String(d.papel))) throw new Recusa(400, 'invalido', 'Papel inválido.', 'papel')
      patch.role = d.papel
    }
    if (d.permissoes !== undefined) {
      if (!ehObjeto(d.permissoes)) throw new Recusa(400, 'invalido', 'Permissões inválidas.', 'permissoes')
      for (const [k, v] of Object.entries(d.permissoes)) {
        if (k === 'modulos') {
          if (!Array.isArray(v) || v.some((m) => !MODULOS_IDS.has(String(m)))) throw new Recusa(400, 'invalido', 'Módulo desconhecido.', 'modulos')
          patch.modulos_permitidos = v.length ? [...new Set(v.map(String))] : null
        } else if (PERMISSOES_IDS.has(k)) {
          if (typeof v !== 'boolean') throw new Recusa(400, 'invalido', `"${k}" deve ser liga/desliga.`, k)
          if (!existentes.has(k)) throw new Recusa(400, 'invalido', `A permissão "${k}" ainda não existe no banco do Visor.`, k)
          patch[k] = v
        } else {
          throw new Recusa(400, 'invalido', `Permissão desconhecida: ${k}.`, k)
        }
      }
    }
    if (d.escopos !== undefined) {
      if (!ehObjeto(d.escopos)) throw new Recusa(400, 'invalido', 'Escopos inválidos.', 'escopos')
      const redes = d.escopos.redes as { todos?: boolean; ids?: unknown[] } | undefined
      if (redes !== undefined) {
        if (!ehObjeto(redes)) throw new Recusa(400, 'invalido', 'Redes inválidas.', 'redes')
        if (redes.todos === true) {
          patch.acesso_todas_redes = true
          patch.redes_permitidas = []
        } else {
          const ids = [...new Set((redes.ids ?? []).map(String))]
          if (!ids.length) throw new Recusa(400, 'invalido', 'Escolha pelo menos uma rede (ou "todas").', 'redes')
          if (ids.some((i) => !ehUuid(i))) throw new Recusa(400, 'invalido', 'Rede inválida.', 'redes')
          const ok = await redesExistentes(ids)
          if (ids.some((i) => !ok.has(i))) throw new Recusa(404, 'nao_encontrado', 'Uma das redes escolhidas não existe no Visor.', 'redes')
          patch.acesso_todas_redes = false
          patch.redes_permitidas = ids
          patch.rede_id = ids[0]
        }
      } else if (criando) {
        throw new Recusa(400, 'invalido', 'Escolha as redes que a pessoa vai ver.', 'redes')
      }
      const postos = d.escopos.postos as { todos?: boolean; ids?: unknown[] } | undefined
      if (postos !== undefined) {
        if (!ehObjeto(postos)) throw new Recusa(400, 'invalido', 'Postos inválidos.', 'postos')
        if (postos.todos === true) patch.empresa_codigos = null
        else {
          const cods = [...new Set((postos.ids ?? []).map((v) => Number(v)))]
          if (!cods.length) throw new Recusa(400, 'invalido', 'Escolha pelo menos um posto (ou "todos").', 'postos')
          if (cods.some((c) => !Number.isInteger(c) || c <= 0)) throw new Recusa(400, 'invalido', 'Posto inválido.', 'postos')
          patch.empresa_codigos = cods
        }
      }
    } else if (criando) {
      throw new Recusa(400, 'invalido', 'Escolha as redes que a pessoa vai ver.', 'redes')
    }
    return patch
  }

  /** Colunas que existem em profiles (para não quebrar se uma migration faltar). */
  const colunasPerfil = async () => {
    const { data } = await admin.from('profiles').select('*').limit(1)
    return new Set(Object.keys(data?.[0] ?? {}))
  }

  const lerAuth = async (id: string) => {
    const { data } = await admin.auth.admin.getUserById(id)
    const u = data?.user
    return u ? { email: u.email ?? null, last_sign_in_at: u.last_sign_in_at ?? null, created_at: u.created_at } : undefined
  }

  /** Perfil alvo; recusa diretor (a Central nunca altera diretor). */
  const perfilEditavel = async (id: unknown) => {
    if (!ehUuid(id)) throw new Recusa(400, 'invalido', 'Usuário inválido.', 'id')
    const { data: p, error } = await admin.from('profiles').select('*').eq('user_id', id).maybeSingle()
    if (error) throw error
    if (!p) throw new Recusa(404, 'nao_encontrado', 'Esta pessoa não existe mais no Visor.')
    if (p.is_master) throw new Recusa(403, 'proibido', 'Diretores só se alteram no próprio Visor.')
    return p
  }

  const gerarLink = async (email: string) => {
    const base = (Deno.env.get('VISOR_URL') || 'https://visor360.cci.app.br').replace(/\/$/, '')
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${base}/redefinir-senha` },
    })
    if (error || !data?.properties?.action_link) throw new Error(error?.message ?? 'link não gerado')
    return { link: data.properties.action_link, expira_em: new Date(Date.now() + LINK_VALIDADE_S * 1000).toISOString() }
  }

  // ── anti-repetição (só escrita) ──────────────────────────────────────────
  const fecharOperacao = async (resultado: 'ok' | 'erro', extra: Record<string, unknown> = {}) => {
    await admin.from('central_operacoes').update({ resultado, ...extra }).eq('operacao', op)
  }
  if (pedido.acao && ESCRITA.has(pedido.acao)) {
    if (!ehUuid(op)) return recusa(400, 'invalido', 'Pedido sem identificador de operação.')
    const { error } = await admin.from('central_operacoes').insert({
      operacao: op,
      acao: pedido.acao,
      diretor: diretorEmail,
      alvo_id: ehUuid(dados.id) ? dados.id : null,
      alvo_email: typeof dados.email === 'string' ? dados.email.trim().toLowerCase().slice(0, 320) : null,
    })
    if (error) {
      if (error.code === '23505') return recusa(409, 'repetido', 'Este pedido já foi feito. Recarregue a tela e confira.')
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return recusa(500, 'erro_interno', 'Falta rodar docs/supabase-central-operacoes.sql no Supabase do Visor.')
      }
      throw error
    }
    // Limpeza leve do registro antigo (90 dias).
    void admin.from('central_operacoes').delete().lt('criado_em', new Date(Date.now() - 90 * 86400_000).toISOString())
  }

  try {
    switch (pedido.acao) {
      case 'catalogo': {
        const { data: redes, error } = await admin.from('redes').select('id, nome').order('nome')
        if (error) throw error
        return json(200, {
          ok: true,
          dados: {
            versao_contrato: 1,
            app: 'visor360',
            papeis: [
              { id: 'user', nome: 'Usuário', descricao: 'Vê os módulos liberados da rede dele.' },
              { id: 'supervisor', nome: 'Supervisor', descricao: 'Também gerencia os frentistas da rede.' },
              { id: 'diretor', nome: 'Diretor', descricao: 'Acesso total à plataforma. Só se altera no próprio Visor.', somente_leitura: true },
            ],
            permissoes: [
              ...PERMISSOES.map((p) => ({ ...p, tipo: 'liga_desliga', padrao: false, aplica_a_papeis: ['user', 'supervisor'] })),
              { id: 'modulos', nome: 'Módulos liberados', tipo: 'lista', opcoes: MODULOS, vazio_significa: 'todos', aplica_a_papeis: ['user', 'supervisor'] },
            ],
            escopos: [
              { id: 'redes', nome: 'Redes', tipo: 'lista', aceita_todos: true, obrigatorio_para_papeis: ['user', 'supervisor'], opcoes: redes ?? [] },
              { id: 'postos', nome: 'Postos', tipo: 'lista', depende_de: 'redes', aceita_todos: true, opcoes: 'sob_demanda' },
            ],
            criacao: { modos: ['link_senha'] },
          },
        })
      }

      case 'listar': {
        const usuariosAuth = new Map<string, { email: string | null; last_sign_in_at: string | null; created_at: string }>()
        for (let page = 1; page <= 50; page++) {
          const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
          if (error) throw error
          for (const u of data.users) usuariosAuth.set(u.id, { email: u.email ?? null, last_sign_in_at: u.last_sign_in_at ?? null, created_at: u.created_at })
          if (data.users.length < 1000) break
        }
        const { data: perfis, error } = await admin.from('profiles').select('*')
        if (error) throw error
        const usuarios = (perfis ?? []).map((p) => paraUsuario(p, usuariosAuth.get(p.user_id)))
        return json(200, { ok: true, dados: { usuarios, total: usuarios.length } })
      }

      case 'opcoes': {
        // Postos de uma ou mais redes (lidos da API Quality, só GET).
        if (dados.escopo !== 'postos') throw new Recusa(400, 'invalido', 'Só o escopo "postos" tem opções sob demanda.', 'escopo')
        const pais = (Array.isArray(dados.pai) ? dados.pai : [dados.pai]).map(String).filter(ehUuid).slice(0, 20)
        if (!pais.length) return json(200, { ok: true, dados: { opcoes: [] } })
        const { data: redes, error } = await admin.from('redes').select('id, nome, chave, api_base_url').in('id', pais)
        if (error) throw error
        const opcoes: { id: string; nome: string; pai: string }[] = []
        const falhas: string[] = []
        await Promise.all((redes ?? []).map(async (r) => {
          try {
            const base = String(r.api_base_url || '').replace(/\/$/, '')
            const res = await fetch(`${base}/EMPRESAS?CHAVE=${encodeURIComponent(r.chave)}&limite=200`, { signal: AbortSignal.timeout(12_000) })
            if (!res.ok) throw new Error(String(res.status))
            const body = await res.json()
            for (const e of body.resultados ?? []) {
              const cod = e.codigo ?? e.empresaCodigo
              if (cod > 0) opcoes.push({ id: String(cod), nome: `${(e.fantasia || e.razao || e.razaoSocial || `Posto ${cod}`).trim()}`, pai: r.id })
            }
          } catch {
            falhas.push(r.nome)
          }
        }))
        opcoes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        return json(200, { ok: true, dados: { opcoes, ...(falhas.length ? { aviso: `Não foi possível ler os postos de: ${falhas.join(', ')}.` } : {}) } })
      }

      case 'criar': {
        const email = typeof dados.email === 'string' ? dados.email.trim().toLowerCase() : ''
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) throw new Recusa(400, 'invalido', 'E-mail inválido.', 'email')
        if (dados.nome === undefined) throw new Recusa(400, 'invalido', 'Informe o nome.', 'nome')
        const papel = dados.papel ?? 'user'
        const existentes = await colunasPerfil()
        const patch = await montarPatch({ ...dados, papel }, existentes, true)

        // Conta no Auth com senha aleatória (ninguém conhece): a pessoa cria a
        // dela pelo link. E-mail já confirmado (foi um diretor que cadastrou).
        const senha = hex(crypto.getRandomValues(new Uint8Array(32)).buffer)
        const { data: novo, error: cErr } = await admin.auth.admin.createUser({
          email,
          password: senha,
          email_confirm: true,
          user_metadata: { full_name: patch.full_name },
        })
        if (cErr || !novo?.user) {
          if (/already|registered|exists/i.test(cErr?.message ?? '')) {
            throw new Recusa(409, 'conflito', 'Já existe uma conta no Visor com este e-mail.', 'email')
          }
          throw cErr ?? new Error('conta não criada')
        }
        const uid = novo.user.id
        const perfil = {
          user_id: uid,
          email,
          approved: true,
          ativo: true,
          is_master: false,
          ...patch,
        }
        const { data: salvo, error: pErr } = await admin.from('profiles').upsert(perfil, { onConflict: 'user_id' }).select('*').single()
        if (pErr) {
          await admin.auth.admin.deleteUser(uid).catch(() => undefined) // desfaz: sem perfil, sem conta
          throw pErr
        }
        const link = await gerarLink(email)
        await fecharOperacao('ok', { alvo_id: uid, alvo_email: email })
        return json(200, { ok: true, dados: { usuario: paraUsuario(salvo, await lerAuth(uid)), ...link } })
      }

      case 'alterar': {
        const p = await perfilEditavel(dados.id)
        const existentes = await colunasPerfil()
        const patch = await montarPatch(dados, existentes, false)
        if (!Object.keys(patch).length) throw new Recusa(400, 'invalido', 'Nada para alterar.')
        const antesU = paraUsuario(p)
        const { data: salvo, error } = await admin.from('profiles').update(patch).eq('user_id', p.user_id).select('*').single()
        if (error) throw error
        const au = await lerAuth(p.user_id)
        const depoisU = paraUsuario(salvo, au)
        // Só o que mudou (em termos do contrato).
        const antes: Record<string, unknown> = {}
        const depois: Record<string, unknown> = {}
        for (const k of ['nome', 'papel'] as const) {
          if (JSON.stringify(antesU[k]) !== JSON.stringify(depoisU[k])) { antes[k] = antesU[k]; depois[k] = depoisU[k] }
        }
        for (const k of Object.keys(depoisU.permissoes)) {
          if (JSON.stringify(antesU.permissoes[k]) !== JSON.stringify(depoisU.permissoes[k])) {
            antes[k] = antesU.permissoes[k]; depois[k] = depoisU.permissoes[k]
          }
        }
        for (const k of ['redes', 'postos'] as const) {
          if (JSON.stringify(antesU.escopos[k]) !== JSON.stringify(depoisU.escopos[k])) {
            antes[k] = antesU.escopos[k]; depois[k] = depoisU.escopos[k]
          }
        }
        await fecharOperacao('ok', { alvo_email: au?.email ?? p.email ?? null })
        return json(200, { ok: true, dados: { usuario: depoisU, antes, depois } })
      }

      case 'desativar':
      case 'reativar': {
        const p = await perfilEditavel(dados.id)
        const ativo = pedido.acao === 'reativar'
        // Reativar também aprova (quem a Central reativa já foi conferido por um diretor).
        const patch: Record<string, unknown> = { ativo, ...(ativo ? { approved: true } : {}) }
        const { data: salvo, error } = await admin.from('profiles').update(patch).eq('user_id', p.user_id).select('*').single()
        if (error) throw error
        const au = await lerAuth(p.user_id)
        await fecharOperacao('ok', { alvo_email: au?.email ?? p.email ?? null })
        return json(200, { ok: true, dados: { usuario: paraUsuario(salvo, au) } })
      }

      case 'link_senha': {
        const p = await perfilEditavel(dados.id)
        if (p.ativo === false) throw new Recusa(400, 'invalido', 'Esta pessoa está desativada. Reative antes de gerar o link.')
        const au = await lerAuth(p.user_id)
        const email = au?.email ?? p.email
        if (!email) throw new Recusa(400, 'invalido', 'Esta conta não tem e-mail.')
        const link = await gerarLink(email)
        await fecharOperacao('ok', { alvo_email: email })
        return json(200, { ok: true, dados: link })
      }

      default:
        return recusa(400, 'acao_desconhecida', `O Visor não conhece a ação "${pedido.acao ?? ''}".`)
    }
  } catch (e) {
    if (pedido.acao && ESCRITA.has(pedido.acao)) {
      await fecharOperacao('erro', { erro: (e as Error).message?.slice(0, 500) ?? 'erro' }).catch(() => undefined)
    }
    if (e instanceof Recusa) return recusa(e.status, e.codigo, e.message, e.campo)
    console.error('central-cci:', pedido.acao, (e as Error).message)
    return recusa(500, 'erro_interno', 'O Visor não conseguiu concluir agora. Tente de novo.')
  }
})
