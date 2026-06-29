// @ts-nocheck — Deno (Supabase Edge Runtime).
// ============================================================================
// mock-quality — API fictícia que IMITA os endpoints da Quality, pra a rede de
// demonstração "Aurora". O front não muda: a rede demo só aponta o
// `api_base_url` pra esta Function. Dados determinísticos (ver generator.ts) →
// reconciliam entre telas e os filtros de período funcionam ao vivo.
//
// Rede demo (Admin·Redes):
//   nome         = "Rede Aurora"
//   chave        = "DEMO-AURORA"  (ignorada aqui; é só rótulo)
//   api_base_url = https://<PROJECT_REF>.supabase.co/functions/v1/mock-quality
//
// Deploy:  supabase functions deploy mock-quality --no-verify-jwt
//          (--no-verify-jwt é OBRIGATÓRIO: o front manda só ?CHAVE=, sem JWT
//           do Supabase. A Function é pública + CORS.)
//
// FASE 0: catálogos (/EMPRESAS, /PRODUTO, /FUNCIONARIO, /ADMINISTRADORA,
//         /CLIENTE). Endpoints transacionais entram nas próximas fases.
// ============================================================================
import { POSTOS, PRODUTOS, FRENTISTAS, ADMINISTRADORAS, CLIENTES } from './catalogs.ts'
import { cors, json, num, paginate } from './shape.ts'

Deno.serve((req: Request): Response => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = new URL(req.url)
  // Último segmento do path = nome do endpoint (ex.: .../mock-quality/EMPRESAS).
  const endpoint = (url.pathname.split('/').filter(Boolean).pop() ?? '').toUpperCase()
  const sp = url.searchParams
  const limite = num(sp, 'limite') ?? 1000
  const ultimo = num(sp, 'ultimoCodigo')
  const empresaCodigo = num(sp, 'empresaCodigo')

  switch (endpoint) {
    case 'EMPRESAS':
      return json(paginate(POSTOS, (e) => e.empresaCodigo, ultimo, limite))

    case 'PRODUTO':
      return json(paginate(PRODUTOS, (p) => p.produtoCodigo, ultimo, limite))

    case 'FUNCIONARIO': {
      const list = empresaCodigo ? FRENTISTAS.filter((f) => f.empresaCodigo === empresaCodigo) : FRENTISTAS
      return json(paginate(list, (f) => f.funcionarioCodigo, ultimo, limite))
    }

    case 'ADMINISTRADORA':
      return json(paginate(ADMINISTRADORAS, (a) => a.administradoraCodigo, ultimo, limite))

    case 'CLIENTE':
      return json(paginate(CLIENTES, (c) => c.codigo, ultimo, limite))

    // Endpoints transacionais ainda não implementados (Fase 1+): devolve vazio
    // no formato Quality pra não quebrar o front (telas mostram "sem dados").
    default:
      return json({ ultimoCodigo: ultimo ?? 0, resultados: [] })
  }
})
