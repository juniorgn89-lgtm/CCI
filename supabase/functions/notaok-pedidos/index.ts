// @ts-nocheck — roda no Deno (Supabase Edge Runtime), não no Node.
//
// notaok-pedidos — a "porta" do Visor360 para o NotaOK (pedido de compra × nota).
// Spec: docs/SPEC-pedido-nota-notaok.md · SQL: docs/supabase-compras-notas.sql
//
// Quem chama: SÓ a Edge Function `visor-pedidos` do NotaOK, assinada com HMAC:
//   x-cci-operacao   uuid por operação
//   x-cci-timestamp  segundos Unix (tolerância de 5 min)
//   x-cci-assinatura hex(HMAC_SHA256(NOTAOK_SEGREDO, "<timestamp>.<operacao>.<corpo>"))
// Corpo: { acao, organizacao_id, dados }. A organização do NotaOK precisa estar
// ligada a uma rede em `notaok_vinculos`; senão a resposta é { ok: true, ligado: false }.
//
// Uma direção só: o NotaOK avisa, o Visor guarda. Nada é gravado no ERP.
//
// Ações:
//   candidatos   { empresa_codigo, cnpj, data_emissao, chave? } → pedidos que podem ser desta nota
//   vincular     { nota, pedido_id, completa, por_nome }        → liga a nota ao pedido
//   desvincular  { chave, pedido_id, motivo?, por_nome }        → desfaz (recebedor errou o pedido)
//   status_nota  { chave, situacao, quando?, por_nome?, devolucao? } → conferida | lancada | devolvida | vinculada
//                devolucao = { geral?, nf?, boleto?, itens?: [{ codigo, descricao, motivo }] } (só em "devolvida")
//   sem_pedido   { nota, motivo?, por_nome, desfazer? }         → registra (ou tira) "nota sem pedido"
//   notas_espelho { notas: [{ chave, ..., status, desde, por_nome?, motivo?, observacao?, sem_pedido? }] }
//                → espelho das notas AINDA NÃO LANÇADAS (Compras › Notas recebidas); status 'lancada'
//                  (ou removida: true) tira do espelho. SQL: supabase/migrations/20261125000002_notaok_notas.sql
//   Todas as escritas são idempotentes (o NotaOK reenvia o que ficou pendente).
//
// Deploy:  npx supabase@latest functions deploy notaok-pedidos --no-verify-jwt --project-ref yzmorbfadoxowchkwspl
//          (--no-verify-jwt: quem chama é o NotaOK; a proteção é a assinatura)
// Secret:  NOTAOK_SEGREDO (o MESMO valor do VISOR_SEGREDO no NotaOK).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TOLERANCIA_S = 300
const ESCRITA = new Set(['vincular', 'desvincular', 'status_nota', 'sem_pedido', 'notas_espelho'])
const STATUS_ESPELHO = new Set(['pendente', 'em_preenchimento', 'devolvida', 'enviada'])
const ABERTOS_PARA_NOTA = ['liberado', 'liberado_parcial', 'recebido_parcial']
const SITUACOES = new Set(['vinculada', 'conferida', 'lancada', 'devolvida'])
const JANELA_DIAS = 90

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const recusa = (status: number, codigo: string, erro: string) => json(status, { ok: false, codigo, erro })
class Recusa extends Error {
  constructor(public status: number, public codigo: string, message: string) { super(message) }
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
const digitos = (v: unknown) => String(v ?? '').replace(/\D/g, '')
const texto = (v: unknown, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const inteiro = (v: unknown) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.trunc(Number(v)) : null)
const valor = (v: unknown) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.round(Number(v) * 100) / 100 : null)
const dataIso = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null)
const fmtValor = (v: number | null) => (v == null ? '' : ` (R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`)

/** Dados da nota vindos do NotaOK, validados. */
const lerNota = (n: unknown) => {
  if (!ehObjeto(n)) throw new Recusa(400, 'invalido', 'Faltam os dados da nota.')
  const chave = digitos(n.chave)
  if (!/^[0-9]{44}$/.test(chave)) throw new Recusa(400, 'invalido', 'Chave da nota inválida.')
  return {
    chave,
    numero: inteiro(n.numero),
    serie: inteiro(n.serie),
    valor: valor(n.valor),
    emissao: dataIso(n.data_emissao),
    notaok_nota_id: ehUuid(n.notaok_nota_id) ? n.notaok_nota_id : null,
    empresa_codigo: inteiro(n.empresa_codigo),
    cnpj: digitos(n.cnpj) || null,
    fornecedor_nome: texto(n.fornecedor_nome, 200),
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return recusa(405, 'invalido', 'Use POST.')
  const segredo = Deno.env.get('NOTAOK_SEGREDO')
  if (!segredo) return recusa(500, 'erro_interno', 'O Visor ainda não tem o segredo do NotaOK configurado.')

  // ── assinatura ──────────────────────────────────────────────────────────
  const corpo = await req.text()
  const ts = req.headers.get('x-cci-timestamp') ?? ''
  const op = req.headers.get('x-cci-operacao') ?? ''
  const ass = (req.headers.get('x-cci-assinatura') ?? '').toLowerCase()
  const agora = Math.floor(Date.now() / 1000)
  if (!/^\d+$/.test(ts) || Math.abs(agora - Number(ts)) > TOLERANCIA_S || !ehUuid(op)) {
    return recusa(401, 'assinatura', 'Pedido do NotaOK fora do prazo ou incompleto.')
  }
  if (!iguais(ass, await assinar(segredo, `${ts}.${op}.${corpo}`))) {
    return recusa(401, 'assinatura', 'Assinatura do NotaOK inválida.')
  }

  let pedido: { acao?: string; organizacao_id?: string; dados?: Record<string, unknown> } = {}
  try { pedido = JSON.parse(corpo) } catch { return recusa(400, 'invalido', 'Corpo inválido.') }
  const acao = pedido.acao ?? ''
  const dados = ehObjeto(pedido.dados) ? pedido.dados : {}
  if (acao !== 'candidatos' && !ESCRITA.has(acao)) return recusa(400, 'invalido', 'Ação desconhecida.')
  if (!ehUuid(pedido.organizacao_id)) return recusa(400, 'invalido', 'Organização do NotaOK inválida.')

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  // ── organização → rede ───────────────────────────────────────────────────
  const { data: vinc, error: vincErr } = await admin.from('notaok_vinculos')
    .select('rede_id, ativo, redes(nome)').eq('notaok_organizacao_id', pedido.organizacao_id).maybeSingle()
  if (vincErr) {
    console.error('notaok-pedidos: notaok_vinculos', vincErr.message)
    return recusa(500, 'erro_interno', vincErr.code === '42P01'
      ? 'O Visor ainda não tem as tabelas da ligação com o NotaOK (rodar docs/supabase-compras-notas.sql).'
      : 'Erro lendo a ligação com o NotaOK.')
  }
  if (!vinc || !vinc.ativo) return json(200, { ok: true, ligado: false })
  const redeId = vinc.rede_id as string

  // ── anti-repetição (só escrita) ──────────────────────────────────────────
  if (ESCRITA.has(acao)) {
    const { error } = await admin.from('notaok_operacoes').insert({ operacao: op, acao, rede_id: redeId })
    if (error?.code === '23505') return recusa(409, 'repetido', 'Este pedido já foi recebido antes.')
    if (error) { console.error('notaok-pedidos: notaok_operacoes', error.message); return recusa(500, 'erro_interno', 'Erro registrando a operação.') }
    if (Math.random() < 0.02) {
      await admin.from('notaok_operacoes').delete().lt('criado_em', new Date(Date.now() - JANELA_DIAS * 86400_000).toISOString())
    }
  }

  const evento = async (pedidoId: string, tipo: string, porNome: string | null, detalhe: string | null) => {
    const { error } = await admin.from('compras_eventos').insert({
      rede_id: redeId, pedido_id: pedidoId, tipo, autor_id: null,
      autor_nome: porNome ? `${porNome} (NotaOK)` : 'NotaOK', detalhe,
    })
    if (error) console.error('notaok-pedidos: evento', error.message)
  }
  const lerPedido = async (id: unknown) => {
    if (!ehUuid(id)) throw new Recusa(400, 'invalido', 'Pedido inválido.')
    const { data, error } = await admin.from('compras_pedidos').select('*').eq('id', id).eq('rede_id', redeId).maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Recusa(404, 'nao_encontrado', 'Pedido não encontrado nesta rede.')
    return data
  }
  /** Status de liberação (antes de chegar nota): o último evento liberado/liberado_parcial. */
  const statusLiberacao = async (pedidoId: string) => {
    const { data } = await admin.from('compras_eventos').select('tipo').eq('pedido_id', pedidoId)
      .in('tipo', ['liberado', 'liberado_parcial']).order('criado_em', { ascending: false }).limit(1)
    return data?.[0]?.tipo === 'liberado_parcial' ? 'liberado_parcial' : 'liberado'
  }

  try {
    // ── candidatos ─────────────────────────────────────────────────────────
    if (acao === 'candidatos') {
      const empresa = inteiro(dados.empresa_codigo)
      if (empresa == null) throw new Recusa(400, 'invalido', 'Posto da nota sem código do ERP.')
      const cnpj = digitos(dados.cnpj)
      const chave = digitos(dados.chave)
      const desde = new Date(Date.now() - JANELA_DIAS * 86400_000).toISOString()
      const { data: pedidos, error } = await admin.from('compras_pedidos')
        .select('id, numero, fornecedor_nome, fornecedor_cnpj, setor, status, total_solicitado, total_liberado, liberado_em, liberador_nome, solicitante_nome')
        .eq('rede_id', redeId).eq('empresa_codigo', empresa).in('status', ABERTOS_PARA_NOTA)
        .gte('liberado_em', desde).order('liberado_em', { ascending: false }).limit(60)
      if (error) throw new Error(error.message)
      const lista = (pedidos ?? []).filter((p) => !p.fornecedor_cnpj || !cnpj || digitos(p.fornecedor_cnpj) === cnpj)
      const ids = lista.map((p) => p.id)
      const [{ data: itens }, { data: notas }] = ids.length
        ? await Promise.all([
          admin.from('compras_itens').select('pedido_id, produto_codigo, produto_nome, unidade, qtd_solicitada, qtd_liberada, custo_unit, ordem').in('pedido_id', ids).order('ordem'),
          admin.from('compras_pedido_notas').select('pedido_id, nota_chave, nota_numero, nota_valor, situacao').in('pedido_id', ids),
        ])
        : [{ data: [] }, { data: [] }]
      const emissao = dataIso(dados.data_emissao)
      const candidatos = lista.map((p) => ({
        id: p.id,
        numero: p.numero,
        fornecedor_nome: p.fornecedor_nome,
        mesmo_fornecedor: !!p.fornecedor_cnpj && !!cnpj && digitos(p.fornecedor_cnpj) === cnpj,
        setor: p.setor,
        status: p.status,
        valor: Number(p.total_liberado ?? p.total_solicitado ?? 0),
        liberado_em: p.liberado_em,
        liberador_nome: p.liberador_nome,
        solicitante_nome: p.solicitante_nome,
        emitida_antes: !!emissao && !!p.liberado_em && emissao < String(p.liberado_em).slice(0, 10),
        itens: (itens ?? []).filter((i) => i.pedido_id === p.id).map((i) => ({
          produto_codigo: i.produto_codigo, produto_nome: i.produto_nome, unidade: i.unidade,
          qtd: Number(i.qtd_liberada ?? i.qtd_solicitada ?? 0), custo_unit: Number(i.custo_unit ?? 0),
        })),
        notas: (notas ?? []).filter((n) => n.pedido_id === p.id).map((n) => ({
          numero: n.nota_numero, valor: n.nota_valor == null ? null : Number(n.nota_valor), situacao: n.situacao, esta_nota: n.nota_chave === chave,
        })),
      }))
      // Mesmo fornecedor primeiro; depois os sem CNPJ. Dentro do grupo, o mais perto da emissão.
      const ref = emissao ? new Date(emissao).getTime() : Date.now()
      candidatos.sort((a, b) => Number(b.mesmo_fornecedor) - Number(a.mesmo_fornecedor)
        || Math.abs(new Date(a.liberado_em).getTime() - ref) - Math.abs(new Date(b.liberado_em).getTime() - ref))
      return json(200, { ok: true, ligado: true, rede_nome: vinc.redes?.nome ?? null, candidatos })
    }

    // ── vincular ───────────────────────────────────────────────────────────
    if (acao === 'vincular') {
      const nota = lerNota(dados.nota)
      const porNome = texto(dados.por_nome, 120)
      const completa = dados.completa === true
      const p = await lerPedido(dados.pedido_id)
      if (nota.empresa_codigo != null && p.empresa_codigo !== nota.empresa_codigo) {
        throw new Recusa(409, 'posto_diferente', `O pedido nº ${p.numero} é de outro posto.`)
      }
      if (p.fornecedor_cnpj && nota.cnpj && digitos(p.fornecedor_cnpj) !== nota.cnpj) {
        throw new Recusa(409, 'fornecedor_diferente', `O pedido nº ${p.numero} é de outro fornecedor (${p.fornecedor_nome}).`)
      }
      const { data: existente } = await admin.from('compras_pedido_notas').select('id, completa')
        .eq('pedido_id', p.id).eq('nota_chave', nota.chave).maybeSingle()
      if (!existente && !ABERTOS_PARA_NOTA.includes(p.status)) {
        throw new Recusa(409, 'pedido_fechado', `O pedido nº ${p.numero} não está esperando nota (situação: ${p.status}).`)
      }
      const linha = {
        rede_id: redeId, pedido_id: p.id, nota_chave: nota.chave, nota_numero: nota.numero, nota_serie: nota.serie,
        nota_valor: nota.valor, nota_emissao: nota.emissao, notaok_nota_id: nota.notaok_nota_id, completa,
        vinculado_por_nome: porNome, atualizado_em: new Date().toISOString(),
      }
      const { error: upErr } = existente
        ? await admin.from('compras_pedido_notas').update(linha).eq('id', existente.id)
        : await admin.from('compras_pedido_notas').insert(linha)
      if (upErr) throw new Error(upErr.message)
      // A nota deixou de ser "sem pedido", se tinha sido marcada assim.
      await admin.from('compras_notas_sem_pedido').delete().eq('rede_id', redeId).eq('nota_chave', nota.chave)

      const novoStatus = completa ? 'recebido' : (p.status === 'recebido' ? 'recebido' : 'recebido_parcial')
      if (novoStatus !== p.status) {
        const patch: Record<string, unknown> = { status: novoStatus }
        if (novoStatus === 'recebido') patch.recebido_em = new Date().toISOString()
        const { error } = await admin.from('compras_pedidos').update(patch).eq('id', p.id)
        if (error) throw new Error(error.message)
      }
      if (!existente || existente.completa !== completa) {
        await evento(p.id, 'nota_vinculada', porNome,
          `NF ${nota.numero ?? nota.chave.slice(25, 34)}${fmtValor(nota.valor)} · ${completa ? 'pedido chegou completo' : 'ainda falta chegar'}`)
      }
      return json(200, { ok: true, ligado: true, pedido: { id: p.id, numero: p.numero, status: novoStatus } })
    }

    // ── desvincular ────────────────────────────────────────────────────────
    if (acao === 'desvincular') {
      const chave = digitos(dados.chave)
      if (!/^[0-9]{44}$/.test(chave)) throw new Recusa(400, 'invalido', 'Chave da nota inválida.')
      const porNome = texto(dados.por_nome, 120)
      const p = await lerPedido(dados.pedido_id)
      const { data: apagadas, error } = await admin.from('compras_pedido_notas').delete()
        .eq('pedido_id', p.id).eq('nota_chave', chave).select('nota_numero, nota_valor')
      if (error) throw new Error(error.message)
      if (!apagadas?.length) return json(200, { ok: true, ligado: true, pedido: { id: p.id, numero: p.numero, status: p.status } })

      // Sobrou nota? Continua recebido parcial. Não sobrou? Volta para liberado.
      let novoStatus = p.status
      if (p.status === 'recebido' || p.status === 'recebido_parcial') {
        const { count } = await admin.from('compras_pedido_notas').select('id', { count: 'exact', head: true }).eq('pedido_id', p.id)
        novoStatus = (count ?? 0) > 0 ? 'recebido_parcial' : await statusLiberacao(p.id)
        if (novoStatus !== p.status) {
          const { error: e2 } = await admin.from('compras_pedidos').update({ status: novoStatus, ...(novoStatus === 'recebido' ? {} : { recebido_em: null }) }).eq('id', p.id)
          if (e2) throw new Error(e2.message)
        }
      }
      const n = apagadas[0]
      await evento(p.id, 'nota_desvinculada', porNome,
        `NF ${n.nota_numero ?? chave.slice(25, 34)}${fmtValor(n.nota_valor == null ? null : Number(n.nota_valor))}${texto(dados.motivo, 300) ? ` · ${texto(dados.motivo, 300)}` : ''}`)
      return json(200, { ok: true, ligado: true, pedido: { id: p.id, numero: p.numero, status: novoStatus } })
    }

    // ── status_nota ────────────────────────────────────────────────────────
    if (acao === 'status_nota') {
      const chave = digitos(dados.chave)
      if (!/^[0-9]{44}$/.test(chave)) throw new Recusa(400, 'invalido', 'Chave da nota inválida.')
      const situacao = String(dados.situacao ?? '')
      if (!SITUACOES.has(situacao)) throw new Recusa(400, 'invalido', 'Situação da nota inválida.')
      const quando = typeof dados.quando === 'string' && !Number.isNaN(Date.parse(dados.quando)) ? dados.quando : new Date().toISOString()
      const patch: Record<string, unknown> = { situacao, atualizado_em: new Date().toISOString() }
      if (situacao === 'conferida') patch.conferida_em = quando
      if (situacao === 'lancada') patch.lancada_em = quando
      if (situacao === 'vinculada') { patch.conferida_em = null; patch.lancada_em = null }
      // Devolução: o porquê (observação geral, NF, boletos, itens) e quem devolveu.
      let devolucao: { geral: string | null; nf: string | null; boleto: string | null; itens: { codigo: string | null; descricao: string | null; motivo: string }[] } | null = null
      const porNome = texto(dados.por_nome, 120)
      if (situacao === 'devolvida') {
        const d = ehObjeto(dados.devolucao) ? dados.devolucao : {}
        const itens = (Array.isArray(d.itens) ? d.itens : []).filter(ehObjeto).slice(0, 200)
          .map((i) => ({ codigo: texto(i.codigo, 40), descricao: texto(i.descricao, 200), motivo: texto(i.motivo, 500) ?? '' }))
          .filter((i) => i.motivo)
        devolucao = { geral: texto(d.geral, 1000), nf: texto(d.nf, 500), boleto: texto(d.boleto, 500), itens }
        Object.assign(patch, { devolucao, devolvida_em: quando, devolvida_por_nome: porNome })
      }
      // Situação anterior: o histórico só ganha "devolveu" quando ela muda (reenvio não duplica).
      const { data: antes } = await admin.from('compras_pedido_notas').select('pedido_id, situacao, nota_numero')
        .eq('rede_id', redeId).eq('nota_chave', chave)
      let { data, error } = await admin.from('compras_pedido_notas').update(patch)
        .eq('rede_id', redeId).eq('nota_chave', chave).select('pedido_id')
      if (error && situacao === 'devolvida' && /devolucao|devolvida_|column/i.test(error.message)) {
        // SQL da devolução (docs/supabase-compras-notas-devolucao.sql) ainda não rodado: grava só a situação.
        delete patch.devolucao; delete patch.devolvida_em; delete patch.devolvida_por_nome
        ;({ data, error } = await admin.from('compras_pedido_notas').update(patch).eq('rede_id', redeId).eq('nota_chave', chave).select('pedido_id'))
      }
      if (error) throw new Error(error.message)
      if (situacao === 'devolvida' && devolucao) {
        const partes = [
          devolucao.geral,
          devolucao.nf && `NF: ${devolucao.nf}`,
          devolucao.boleto && `Boletos: ${devolucao.boleto}`,
          devolucao.itens.length ? `${devolucao.itens.length} ${devolucao.itens.length === 1 ? 'item apontado' : 'itens apontados'}` : null,
        ].filter(Boolean).join(' · ')
        for (const a of antes ?? []) {
          if (a.situacao === 'devolvida') continue
          await evento(a.pedido_id, 'nota_devolvida', porNome, `NF ${a.nota_numero ?? ''}${partes ? ` · ${partes}` : ''}`.slice(0, 500))
        }
      }
      return json(200, { ok: true, ligado: true, atualizadas: data?.length ?? 0 })
    }

    // ── sem_pedido ─────────────────────────────────────────────────────────
    if (acao === 'sem_pedido') {
      const nota = lerNota(dados.nota)
      if (dados.desfazer === true) {
        const { error } = await admin.from('compras_notas_sem_pedido').delete().eq('rede_id', redeId).eq('nota_chave', nota.chave)
        if (error) throw new Error(error.message)
        return json(200, { ok: true, ligado: true })
      }
      const { error } = await admin.from('compras_notas_sem_pedido').upsert({
        rede_id: redeId, empresa_codigo: nota.empresa_codigo, nota_chave: nota.chave, nota_numero: nota.numero,
        nota_valor: nota.valor, nota_emissao: nota.emissao, fornecedor_nome: nota.fornecedor_nome, fornecedor_cnpj: nota.cnpj,
        notaok_nota_id: nota.notaok_nota_id, motivo: texto(dados.motivo, 500), marcado_por_nome: texto(dados.por_nome, 120),
      }, { onConflict: 'rede_id,nota_chave' })
      if (error) throw new Error(error.message)
      return json(200, { ok: true, ligado: true })
    }

    // ── notas_espelho ──────────────────────────────────────────────────────
    if (acao === 'notas_espelho') {
      const lista = (Array.isArray(dados.notas) ? dados.notas : []).filter(ehObjeto).slice(0, 500)
      const gravar: Record<string, unknown>[] = []
      const tirar: string[] = []
      const agora = new Date().toISOString()
      for (const n of lista) {
        const chave = digitos(n.chave)
        if (!/^[0-9]{44}$/.test(chave)) continue
        const status = String(n.status ?? '')
        if (n.removida === true || status === 'lancada' || !STATUS_ESPELHO.has(status)) { tirar.push(chave); continue }
        const desde = typeof n.desde === 'string' && !Number.isNaN(Date.parse(n.desde)) ? n.desde : null
        gravar.push({
          rede_id: redeId, nota_chave: chave,
          notaok_nota_id: ehUuid(n.notaok_nota_id) ? n.notaok_nota_id : null,
          empresa_codigo: inteiro(n.empresa_codigo), numero: inteiro(n.numero), serie: inteiro(n.serie),
          valor: valor(n.valor), emissao: dataIso(n.data_emissao),
          fornecedor_nome: texto(n.fornecedor_nome, 200), fornecedor_cnpj: digitos(n.cnpj) || null,
          status, desde, por_nome: texto(n.por_nome, 120), motivo: texto(n.motivo, 1000), observacao: texto(n.observacao, 1000),
          sem_pedido: n.sem_pedido === true, sem_pedido_motivo: texto(n.sem_pedido_motivo, 500), atualizado_em: agora,
        })
      }
      if (gravar.length) {
        const { error } = await admin.from('notaok_notas').upsert(gravar, { onConflict: 'rede_id,nota_chave' })
        if (error) {
          if (error.code === '42P01' || error.code === 'PGRST205') throw new Recusa(503, 'sem_tabela', 'O Visor ainda não tem a tabela das notas (rodar 20261125000002_notaok_notas.sql).')
          throw new Error(error.message)
        }
      }
      if (tirar.length) {
        const { error } = await admin.from('notaok_notas').delete().eq('rede_id', redeId).in('nota_chave', tirar)
        if (error) throw new Error(error.message)
      }
      return json(200, { ok: true, ligado: true, gravadas: gravar.length, removidas: tirar.length })
    }

    return recusa(400, 'invalido', 'Ação desconhecida.')
  } catch (e) {
    if (e instanceof Recusa) return recusa(e.status, e.codigo, e.message)
    console.error('notaok-pedidos:', acao, (e as Error).message)
    return recusa(500, 'erro_interno', 'Erro no Visor ao registrar. Tente de novo.')
  }
})
