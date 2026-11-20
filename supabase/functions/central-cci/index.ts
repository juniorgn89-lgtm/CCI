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
//   x-cci-diretor    e-mail do diretor que pediu (só para log)
//
// Etapa 1 (20/11/2026): SÓ LEITURA — `catalogo` e `listar`. Ações que alteram
// respondem `proibido` até a etapa 2. Diretores (is_master) voltam com
// somente_leitura: true e a Central nunca poderá alterá-los (decisão do dono).
//
// Deploy:  npx supabase functions deploy central-cci --no-verify-jwt --project-ref yzmorbfadoxowchkwspl
//          (--no-verify-jwt: quem chama é a Central, não um usuário do Visor;
//           a proteção é a assinatura HMAC)
// Secrets: CENTRAL_CCI_SEGREDO_SAIDA (o MESMO valor do secret CCI_SAIDA_VISOR360 da Central).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TOLERANCIA_S = 300

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

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const recusa = (status: number, codigo: string, erro: string) => json(status, { ok: false, codigo, erro })

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

Deno.serve(async (req) => {
  if (req.method !== 'POST') return recusa(405, 'invalido', 'Use POST.')
  const segredo = Deno.env.get('CENTRAL_CCI_SEGREDO_SAIDA')
  if (!segredo) return recusa(500, 'erro_interno', 'O Visor ainda não tem o segredo da Central configurado.')

  // ── assinatura ──────────────────────────────────────────────────────────
  const corpo = await req.text()
  const ts = req.headers.get('x-cci-timestamp') ?? ''
  const op = req.headers.get('x-cci-operacao') ?? ''
  const ass = (req.headers.get('x-cci-assinatura') ?? '').toLowerCase()
  const agora = Math.floor(Date.now() / 1000)
  if (!/^\d+$/.test(ts) || Math.abs(agora - Number(ts)) > TOLERANCIA_S || !op) {
    return recusa(401, 'assinatura', 'Pedido da Central fora do prazo ou incompleto.')
  }
  if (!iguais(ass, await assinar(segredo, `${ts}.${op}.${corpo}`))) {
    return recusa(401, 'assinatura', 'Assinatura da Central inválida.')
  }

  let pedido: { acao?: string; dados?: Record<string, unknown> } = {}
  try { pedido = JSON.parse(corpo) } catch { return recusa(400, 'invalido', 'Corpo inválido.') }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

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
              { id: 'diretor', nome: 'Diretor', descricao: 'Acesso total à plataforma. Só se altera no próprio Visor.' },
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
        // Auth (e-mail, último acesso) + profiles (papel, permissões, escopos).
        const usuariosAuth = new Map<string, { email: string | null; last_sign_in_at: string | null; created_at: string }>()
        for (let page = 1; page <= 50; page++) {
          const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
          if (error) throw error
          for (const u of data.users) usuariosAuth.set(u.id, { email: u.email ?? null, last_sign_in_at: u.last_sign_in_at ?? null, created_at: u.created_at })
          if (data.users.length < 1000) break
        }
        const { data: perfis, error } = await admin.from('profiles').select('*')
        if (error) throw error

        const usuarios = (perfis ?? []).map((p) => {
          const au = usuariosAuth.get(p.user_id)
          const diretor = !!p.is_master
          const redesIds = [...new Set([p.rede_id, ...(p.redes_permitidas ?? [])].filter(Boolean))]
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
        })
        return json(200, { ok: true, dados: { usuarios, total: usuarios.length } })
      }

      case 'criar': case 'alterar': case 'desativar': case 'reativar': case 'link_senha':
        return recusa(403, 'proibido', 'Esta ação ainda não foi liberada para a Central (etapa 2).')

      default:
        return recusa(400, 'acao_desconhecida', `O Visor não conhece a ação "${pedido.acao ?? ''}".`)
    }
  } catch (e) {
    console.error('central-cci:', pedido.acao, (e as Error).message)
    return recusa(500, 'erro_interno', 'O Visor não conseguiu responder agora. Tente de novo.')
  }
})
