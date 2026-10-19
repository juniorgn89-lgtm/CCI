-- ============================================================================
-- Compras · Transferências entre postos (Fase 2 do módulo Compras)
--
-- Posto de ORIGEM manda mercadoria para o posto de DESTINO. Dados próprios do
-- Visor; nada toca o ERP (a movimentação de estoque é lançada no WebPosto
-- como sempre). Idempotente.
--
-- Fluxo: rascunho → solicitada (destino pediu / alguém montou) → em_transito
-- (origem separou e despachou) → recebida (destino conferiu, com a quantidade
-- que chegou) · cancelada a qualquer momento antes de recebida.
-- Qualquer usuário da rede com o módulo ligado cria e movimenta.
-- ============================================================================

create table if not exists public.compras_transferencias (
  id               uuid primary key default gen_random_uuid(),
  rede_id          uuid not null references public.redes(id) on delete cascade,
  numero           int not null default 0,
  origem_codigo    int not null,
  destino_codigo   int not null,
  status           text not null default 'rascunho' check (status in ('rascunho', 'solicitada', 'em_transito', 'recebida', 'cancelada')),
  observacoes      text,
  total_ref        numeric(14,2) not null default 0,
  solicitante_id   uuid references auth.users(id) on delete set null default auth.uid(),
  solicitante_nome text,
  solicitada_em    timestamptz,
  enviado_por_id   uuid references auth.users(id) on delete set null,
  enviado_por_nome text,
  enviada_em       timestamptz,
  recebido_por_id  uuid references auth.users(id) on delete set null,
  recebido_por_nome text,
  recebida_em      timestamptz,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  check (origem_codigo <> destino_codigo)
);
create index if not exists compras_transf_rede_idx on public.compras_transferencias (rede_id, criado_em desc);
create unique index if not exists compras_transf_numero_key on public.compras_transferencias (rede_id, numero);

create or replace function public.compras_numera_transferencia()
returns trigger language plpgsql as $$
begin
  if new.numero is null or new.numero = 0 then
    select coalesce(max(numero), 0) + 1 into new.numero from public.compras_transferencias where rede_id = new.rede_id;
  end if;
  return new;
end $$;
drop trigger if exists compras_transf_numera on public.compras_transferencias;
create trigger compras_transf_numera before insert on public.compras_transferencias for each row execute function public.compras_numera_transferencia();
drop trigger if exists compras_transf_touch on public.compras_transferencias;
create trigger compras_transf_touch before update on public.compras_transferencias for each row execute function public.compras_touch();

alter table public.compras_transferencias enable row level security;
drop policy if exists compras_transf_select on public.compras_transferencias;
create policy compras_transf_select on public.compras_transferencias for select to authenticated
  using (rede_id in (select public.redes_legiveis()));
drop policy if exists compras_transf_insert on public.compras_transferencias;
create policy compras_transf_insert on public.compras_transferencias for insert to authenticated
  with check (rede_id in (select public.redes_legiveis()) and solicitante_id = auth.uid());
drop policy if exists compras_transf_update on public.compras_transferencias;
create policy compras_transf_update on public.compras_transferencias for update to authenticated
  using (rede_id in (select public.redes_legiveis()) and status <> 'recebida')
  with check (rede_id in (select public.redes_legiveis()));
drop policy if exists compras_transf_delete on public.compras_transferencias;
create policy compras_transf_delete on public.compras_transferencias for delete to authenticated
  using (rede_id in (select public.redes_legiveis()) and status = 'rascunho' and (solicitante_id = auth.uid() or public.pode_liberar_compras()));

create table if not exists public.compras_transf_itens (
  id                uuid primary key default gen_random_uuid(),
  rede_id           uuid not null references public.redes(id) on delete cascade,
  transferencia_id  uuid not null references public.compras_transferencias(id) on delete cascade,
  produto_codigo    int not null,
  produto_nome      text not null,
  unidade           text,
  qtd               numeric(14,3) not null default 0,
  qtd_recebida      numeric(14,3),
  custo_ref         numeric(14,4) not null default 0,
  justificativa     text,
  ordem             int not null default 0
);
create index if not exists compras_transf_itens_idx on public.compras_transf_itens (transferencia_id, ordem);
alter table public.compras_transf_itens enable row level security;
drop policy if exists compras_transf_itens_select on public.compras_transf_itens;
create policy compras_transf_itens_select on public.compras_transf_itens for select to authenticated
  using (rede_id in (select public.redes_legiveis()));
drop policy if exists compras_transf_itens_write on public.compras_transf_itens;
create policy compras_transf_itens_write on public.compras_transf_itens for all to authenticated
  using (rede_id in (select public.redes_legiveis()))
  with check (rede_id in (select public.redes_legiveis()));

create table if not exists public.compras_transf_eventos (
  id                uuid primary key default gen_random_uuid(),
  rede_id           uuid not null references public.redes(id) on delete cascade,
  transferencia_id  uuid not null references public.compras_transferencias(id) on delete cascade,
  tipo              text not null check (tipo in ('criada', 'editada', 'solicitada', 'enviada', 'recebida', 'cancelada', 'reaberta', 'comentario')),
  autor_id          uuid references auth.users(id) on delete set null default auth.uid(),
  autor_nome        text,
  detalhe           text,
  criado_em         timestamptz not null default now()
);
create index if not exists compras_transf_eventos_idx on public.compras_transf_eventos (transferencia_id, criado_em);
alter table public.compras_transf_eventos enable row level security;
drop policy if exists compras_transf_eventos_select on public.compras_transf_eventos;
create policy compras_transf_eventos_select on public.compras_transf_eventos for select to authenticated
  using (rede_id in (select public.redes_legiveis()));
drop policy if exists compras_transf_eventos_insert on public.compras_transf_eventos;
create policy compras_transf_eventos_insert on public.compras_transf_eventos for insert to authenticated
  with check (rede_id in (select public.redes_legiveis()) and autor_id = auth.uid());
