-- ============================================================================
-- Compras · Pedido × Nota fiscal (ligação com o NotaOK) — Fase 1
-- Spec: docs/SPEC-pedido-nota-notaok.md
--
-- O NotaOK (recebimento) vincula as notas que chegam aos pedidos liberados.
-- Quem grava aqui é SÓ a Edge Function `notaok-pedidos` (service role), chamada
-- pelo NotaOK com assinatura HMAC. O app do Visor só LÊ (RLS por rede).
--
-- Rodar no SQL Editor do Visor (yzmorbfadoxowchkwspl). Pode rodar mais de uma vez.
-- ============================================================================

-- ─── Status novo do pedido: Recebido parcial (chegou parte das notas) ───────
alter table public.compras_pedidos drop constraint if exists compras_pedidos_status_check;
alter table public.compras_pedidos add constraint compras_pedidos_status_check
  check (status in ('rascunho', 'aguardando', 'liberado', 'liberado_parcial', 'recusado', 'recebido_parcial', 'recebido', 'cancelado'));

alter table public.compras_eventos drop constraint if exists compras_eventos_tipo_check;
alter table public.compras_eventos add constraint compras_eventos_tipo_check
  check (tipo in ('criado', 'editado', 'enviado', 'liberado', 'liberado_parcial', 'recusado', 'recebido', 'cancelado', 'reaberto', 'comentario',
                  'nota_vinculada', 'nota_desvinculada', 'recebimento_encerrado'));

-- Solicitante também pode encerrar um recebimento parcial (antes só até liberado).
drop policy if exists compras_pedidos_update on public.compras_pedidos;
create policy compras_pedidos_update on public.compras_pedidos for update to authenticated
  using (
    rede_id in (select public.redes_legiveis())
    and (public.pode_liberar_compras() or (solicitante_id = auth.uid() and status in ('rascunho', 'aguardando', 'liberado', 'liberado_parcial', 'recebido_parcial')))
  )
  with check (rede_id in (select public.redes_legiveis()));

-- ─── Quem está ligado: organização do NotaOK ↔ rede do Visor ────────────────
create table if not exists public.notaok_vinculos (
  rede_id                uuid primary key references public.redes(id) on delete cascade,
  notaok_organizacao_id  uuid not null unique,
  ativo                  boolean not null default true,
  criado_em              timestamptz not null default now()
);
alter table public.notaok_vinculos enable row level security;
revoke all on public.notaok_vinculos from anon, authenticated;
comment on table public.notaok_vinculos is 'Rede do Visor ligada a uma organização do NotaOK (pedido × nota). Só service role.';

-- ─── Notas vinculadas aos pedidos (um pedido pode ter várias notas) ─────────
create table if not exists public.compras_pedido_notas (
  id                  uuid primary key default gen_random_uuid(),
  rede_id             uuid not null references public.redes(id) on delete cascade,
  pedido_id           uuid not null references public.compras_pedidos(id) on delete cascade,
  nota_chave          text not null check (nota_chave ~ '^[0-9]{44}$'),
  nota_numero         int,
  nota_serie          int,
  nota_valor          numeric(14,2),
  nota_emissao        date,
  notaok_nota_id      uuid,
  completa            boolean not null default false,   -- "com esta nota o pedido chegou completo"
  situacao            text not null default 'vinculada' check (situacao in ('vinculada', 'conferida', 'lancada', 'devolvida')),
  vinculado_por_nome  text,
  vinculado_em        timestamptz not null default now(),
  conferida_em        timestamptz,
  lancada_em          timestamptz,
  atualizado_em       timestamptz not null default now(),
  unique (pedido_id, nota_chave)
);
create index if not exists compras_pedido_notas_rede_idx on public.compras_pedido_notas (rede_id, nota_chave);
alter table public.compras_pedido_notas enable row level security;
drop policy if exists compras_pedido_notas_select on public.compras_pedido_notas;
create policy compras_pedido_notas_select on public.compras_pedido_notas for select to authenticated
  using (rede_id in (select public.redes_legiveis()));

-- ─── Notas que o recebimento marcou como "sem pedido" (aviso ao dono) ───────
create table if not exists public.compras_notas_sem_pedido (
  id               uuid primary key default gen_random_uuid(),
  rede_id          uuid not null references public.redes(id) on delete cascade,
  empresa_codigo   int,
  nota_chave       text not null check (nota_chave ~ '^[0-9]{44}$'),
  nota_numero      int,
  nota_valor       numeric(14,2),
  nota_emissao     date,
  fornecedor_nome  text,
  fornecedor_cnpj  text,
  notaok_nota_id   uuid,
  motivo           text,
  marcado_por_nome text,
  marcado_em       timestamptz not null default now(),
  unique (rede_id, nota_chave)
);
alter table public.compras_notas_sem_pedido enable row level security;
drop policy if exists compras_notas_sem_pedido_select on public.compras_notas_sem_pedido;
create policy compras_notas_sem_pedido_select on public.compras_notas_sem_pedido for select to authenticated
  using (rede_id in (select public.redes_legiveis()));

-- ─── Anti-repetição dos pedidos do NotaOK (mesmo padrão de central_operacoes) ─
create table if not exists public.notaok_operacoes (
  operacao   uuid primary key,
  acao       text not null,
  rede_id    uuid,
  criado_em  timestamptz not null default now()
);
create index if not exists notaok_operacoes_criado_idx on public.notaok_operacoes (criado_em desc);
alter table public.notaok_operacoes enable row level security;
revoke all on public.notaok_operacoes from anon, authenticated;

-- ─── Ligar a rede piloto (rodar UMA vez, trocando os dois valores) ──────────
-- Rede do Visor:          select id, nome from public.redes order by nome;
-- Organização do NotaOK:  (no SQL Editor do NotaOK) select id, nome from organizacoes order by nome;
--
-- insert into public.notaok_vinculos (rede_id, notaok_organizacao_id)
-- values ('<ID_DA_REDE_NO_VISOR>', '<ID_DA_ORGANIZACAO_NO_NOTAOK>')
-- on conflict (rede_id) do update set notaok_organizacao_id = excluded.notaok_organizacao_id, ativo = true;
