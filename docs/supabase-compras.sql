-- ============================================================================
-- Compras · pedidos de compra com liberação (módulo "Compras" do Visor360)
--
-- Dados PRÓPRIOS do Visor, por rede. O ERP continua só leitura: o pedido
-- nasce e é liberado aqui; a nota entra no WebPosto pelo fluxo normal.
-- Idempotente; rode no SQL Editor ou via `supabase db query --linked`.
--
-- Papéis (17/10/2026):
--   - Cria pedido (rascunho / envia para liberação): qualquer usuário da rede
--     com o módulo ligado.
--   - Libera, recusa, define tetos: master ou `profiles.pode_liberar_compras`.
--   - Edita/cancela: o solicitante enquanto rascunho ou aguardando; o
--     liberador sempre.
-- ============================================================================

alter table public.redes add column if not exists compras_habilitado boolean not null default false;
comment on column public.redes.compras_habilitado is 'Módulo Compras (pedidos com liberação) ligado para esta rede.';

alter table public.profiles add column if not exists pode_liberar_compras boolean not null default false;
comment on column public.profiles.pode_liberar_compras is 'Libera/recusa pedidos de compra e define tetos. Master sempre pode.';

create or replace function public.pode_liberar_compras()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.is_master or p.pode_liberar_compras from public.profiles p where p.user_id = auth.uid()),
    false
  )
$$;
revoke execute on function public.pode_liberar_compras() from public, anon;
grant execute on function public.pode_liberar_compras() to authenticated;

-- ─── Fornecedores (cadastro próprio; codigo_erp quando veio do ERP) ─────────
create table if not exists public.compras_fornecedores (
  id          uuid primary key default gen_random_uuid(),
  rede_id     uuid not null references public.redes(id) on delete cascade,
  codigo_erp  int,
  nome        text not null,
  cnpj        text,
  telefone    text,
  email       text,
  observacao  text,
  ativo       boolean not null default true,
  criado_por  uuid references auth.users(id) on delete set null default auth.uid(),
  criado_em   timestamptz not null default now()
);
create unique index if not exists compras_fornecedores_erp_key on public.compras_fornecedores (rede_id, codigo_erp) where codigo_erp is not null;
create index if not exists compras_fornecedores_rede_idx on public.compras_fornecedores (rede_id, nome);
alter table public.compras_fornecedores enable row level security;
drop policy if exists compras_fornecedores_select on public.compras_fornecedores;
create policy compras_fornecedores_select on public.compras_fornecedores for select to authenticated
  using (rede_id in (select public.redes_legiveis()));
drop policy if exists compras_fornecedores_write on public.compras_fornecedores;
create policy compras_fornecedores_write on public.compras_fornecedores for all to authenticated
  using (rede_id in (select public.redes_legiveis()))
  with check (rede_id in (select public.redes_legiveis()));

-- ─── Pedidos ────────────────────────────────────────────────────────────────
create table if not exists public.compras_pedidos (
  id                uuid primary key default gen_random_uuid(),
  rede_id           uuid not null references public.redes(id) on delete cascade,
  numero            int not null default 0,
  empresa_codigo    int not null,
  fornecedor_id     uuid references public.compras_fornecedores(id) on delete set null,
  fornecedor_nome   text not null,
  fornecedor_cnpj   text,
  fornecedor_codigo_erp int,
  setor             text not null default 'conveniencia' check (setor in ('conveniencia', 'automotivos', 'combustivel', 'outros')),
  status            text not null default 'rascunho' check (status in ('rascunho', 'aguardando', 'liberado', 'liberado_parcial', 'recusado', 'recebido', 'cancelado')),
  observacoes       text,
  total_solicitado  numeric(14,2) not null default 0,
  total_liberado    numeric(14,2),
  solicitante_id    uuid references auth.users(id) on delete set null default auth.uid(),
  solicitante_nome  text,
  enviado_em        timestamptz,
  liberador_id      uuid references auth.users(id) on delete set null,
  liberador_nome    text,
  liberado_em       timestamptz,
  motivo_recusa     text,
  recebido_em       timestamptz,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);
create index if not exists compras_pedidos_rede_idx on public.compras_pedidos (rede_id, criado_em desc);
create index if not exists compras_pedidos_status_idx on public.compras_pedidos (rede_id, status);
create unique index if not exists compras_pedidos_numero_key on public.compras_pedidos (rede_id, numero);

-- Numeração sequencial por rede (1, 2, 3…), atribuída na inserção.
create or replace function public.compras_numera_pedido()
returns trigger language plpgsql as $$
begin
  if new.numero is null or new.numero = 0 then
    select coalesce(max(numero), 0) + 1 into new.numero from public.compras_pedidos where rede_id = new.rede_id;
  end if;
  return new;
end $$;
drop trigger if exists compras_pedidos_numera on public.compras_pedidos;
create trigger compras_pedidos_numera before insert on public.compras_pedidos for each row execute function public.compras_numera_pedido();

create or replace function public.compras_touch()
returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;
drop trigger if exists compras_pedidos_touch on public.compras_pedidos;
create trigger compras_pedidos_touch before update on public.compras_pedidos for each row execute function public.compras_touch();

alter table public.compras_pedidos enable row level security;
drop policy if exists compras_pedidos_select on public.compras_pedidos;
create policy compras_pedidos_select on public.compras_pedidos for select to authenticated
  using (rede_id in (select public.redes_legiveis()));
drop policy if exists compras_pedidos_insert on public.compras_pedidos;
create policy compras_pedidos_insert on public.compras_pedidos for insert to authenticated
  with check (rede_id in (select public.redes_legiveis()) and solicitante_id = auth.uid());
-- Solicitante mexe no que é dele enquanto não foi decidido; liberador sempre.
drop policy if exists compras_pedidos_update on public.compras_pedidos;
create policy compras_pedidos_update on public.compras_pedidos for update to authenticated
  using (
    rede_id in (select public.redes_legiveis())
    and (public.pode_liberar_compras() or (solicitante_id = auth.uid() and status in ('rascunho', 'aguardando', 'liberado', 'liberado_parcial')))
  )
  with check (rede_id in (select public.redes_legiveis()));
drop policy if exists compras_pedidos_delete on public.compras_pedidos;
create policy compras_pedidos_delete on public.compras_pedidos for delete to authenticated
  using (rede_id in (select public.redes_legiveis()) and (public.pode_liberar_compras() or (solicitante_id = auth.uid() and status = 'rascunho')));

-- ─── Itens ──────────────────────────────────────────────────────────────────
create table if not exists public.compras_itens (
  id              uuid primary key default gen_random_uuid(),
  rede_id         uuid not null references public.redes(id) on delete cascade,
  pedido_id       uuid not null references public.compras_pedidos(id) on delete cascade,
  produto_codigo  int not null,
  produto_nome    text not null,
  unidade         text,
  qtd_solicitada  numeric(14,3) not null default 0,
  qtd_liberada    numeric(14,3),
  custo_unit      numeric(14,4) not null default 0,
  justificativa   text,
  ordem           int not null default 0
);
create index if not exists compras_itens_pedido_idx on public.compras_itens (pedido_id, ordem);
create index if not exists compras_itens_produto_idx on public.compras_itens (rede_id, produto_codigo);
alter table public.compras_itens enable row level security;
drop policy if exists compras_itens_select on public.compras_itens;
create policy compras_itens_select on public.compras_itens for select to authenticated
  using (rede_id in (select public.redes_legiveis()));
drop policy if exists compras_itens_write on public.compras_itens;
create policy compras_itens_write on public.compras_itens for all to authenticated
  using (
    rede_id in (select public.redes_legiveis())
    and exists (select 1 from public.compras_pedidos p where p.id = pedido_id
                and (public.pode_liberar_compras() or (p.solicitante_id = auth.uid() and p.status in ('rascunho', 'aguardando'))))
  )
  with check (rede_id in (select public.redes_legiveis()));

-- ─── Eventos (histórico, append-only) ───────────────────────────────────────
create table if not exists public.compras_eventos (
  id          uuid primary key default gen_random_uuid(),
  rede_id     uuid not null references public.redes(id) on delete cascade,
  pedido_id   uuid not null references public.compras_pedidos(id) on delete cascade,
  tipo        text not null check (tipo in ('criado', 'editado', 'enviado', 'liberado', 'liberado_parcial', 'recusado', 'recebido', 'cancelado', 'reaberto', 'comentario')),
  autor_id    uuid references auth.users(id) on delete set null default auth.uid(),
  autor_nome  text,
  detalhe     text,
  criado_em   timestamptz not null default now()
);
create index if not exists compras_eventos_pedido_idx on public.compras_eventos (pedido_id, criado_em);
alter table public.compras_eventos enable row level security;
drop policy if exists compras_eventos_select on public.compras_eventos;
create policy compras_eventos_select on public.compras_eventos for select to authenticated
  using (rede_id in (select public.redes_legiveis()));
drop policy if exists compras_eventos_insert on public.compras_eventos;
create policy compras_eventos_insert on public.compras_eventos for insert to authenticated
  with check (rede_id in (select public.redes_legiveis()) and autor_id = auth.uid());

-- ─── Tetos mensais por posto × setor (só liberador define) ──────────────────
create table if not exists public.compras_tetos (
  rede_id         uuid not null references public.redes(id) on delete cascade,
  empresa_codigo  int not null,
  setor           text not null check (setor in ('conveniencia', 'automotivos', 'combustivel', 'outros')),
  valor_mensal    numeric(14,2) not null default 0,
  atualizado_por  uuid references auth.users(id) on delete set null default auth.uid(),
  atualizado_em   timestamptz not null default now(),
  primary key (rede_id, empresa_codigo, setor)
);
alter table public.compras_tetos enable row level security;
drop policy if exists compras_tetos_select on public.compras_tetos;
create policy compras_tetos_select on public.compras_tetos for select to authenticated
  using (rede_id in (select public.redes_legiveis()));
drop policy if exists compras_tetos_write on public.compras_tetos;
create policy compras_tetos_write on public.compras_tetos for all to authenticated
  using (rede_id in (select public.redes_legiveis()) and public.pode_liberar_compras())
  with check (rede_id in (select public.redes_legiveis()) and public.pode_liberar_compras());
