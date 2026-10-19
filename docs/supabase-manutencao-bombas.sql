-- ============================================================================
-- Manutenção das bombas: registro (histórico) + configuração por posto.
--
-- 1) bomba_manutencoes — log APPEND-ONLY de manutenção feita (bomba, data/hora,
--    responsável, observação, quem registrou). Correção = soft-delete pelo master.
--    O desgaste passa a contar a partir da última manutenção registrada.
-- 2) manutencao_bombas_config — intervalo de litros, % de aviso e responsável
--    POR POSTO. Antes vivia no localStorage (cada navegador via uma coisa).
-- ============================================================================

create table if not exists public.bomba_manutencoes (
  id uuid primary key default gen_random_uuid(),
  rede_id uuid not null references public.redes(id) on delete cascade,
  empresa_codigo integer not null,
  bomba_codigo integer not null,
  feita_em timestamptz not null,
  responsavel text,
  observacao text,
  created_by uuid default auth.uid(),
  created_by_nome text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  deleted_by_nome text,
  -- nunca no futuro (folga de 5 min p/ relógio)
  constraint bomba_manutencoes_nao_futuro check (feita_em <= now() + interval '5 minutes')
);

create index if not exists idx_bomba_manut_posto
  on public.bomba_manutencoes (rede_id, empresa_codigo, bomba_codigo, feita_em desc);

alter table public.bomba_manutencoes enable row level security;

-- Membro da rede (gestor/usuário) ou master.
create or replace function public.membro_da_rede(p_rede uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_current_user_master()
      or exists (select 1 from public.profiles where user_id = auth.uid() and rede_id = p_rede)
$$;

drop policy if exists "bomba manut read" on public.bomba_manutencoes;
create policy "bomba manut read" on public.bomba_manutencoes for select to authenticated
using (public.membro_da_rede(rede_id) or rede_id in (select rede_id from public.frentistas where user_id = auth.uid()));

drop policy if exists "bomba manut insert" on public.bomba_manutencoes;
create policy "bomba manut insert" on public.bomba_manutencoes for insert to authenticated
with check (public.membro_da_rede(rede_id) and deleted_at is null);

-- UPDATE só master (soft-delete/correção); o log não se edita de outra forma.
drop policy if exists "bomba manut update master" on public.bomba_manutencoes;
create policy "bomba manut update master" on public.bomba_manutencoes for update to authenticated
using (public.is_current_user_master());

create or replace function public.bomba_manutencoes_stamp()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_bomba_manutencoes_stamp on public.bomba_manutencoes;
create trigger trg_bomba_manutencoes_stamp before insert on public.bomba_manutencoes
  for each row execute function public.bomba_manutencoes_stamp();

-- ---------------------------------------------------------------------------

create table if not exists public.manutencao_bombas_config (
  rede_id uuid not null references public.redes(id) on delete cascade,
  empresa_codigo integer not null,
  intervalo_litros numeric not null default 100000,
  avisar_pct numeric not null default 80,
  responsavel text,
  updated_by uuid default auth.uid(),
  updated_by_nome text,
  updated_at timestamptz not null default now(),
  primary key (rede_id, empresa_codigo)
);

alter table public.manutencao_bombas_config enable row level security;

drop policy if exists "manut config read" on public.manutencao_bombas_config;
create policy "manut config read" on public.manutencao_bombas_config for select to authenticated
using (public.membro_da_rede(rede_id) or rede_id in (select rede_id from public.frentistas where user_id = auth.uid()));

drop policy if exists "manut config insert" on public.manutencao_bombas_config;
create policy "manut config insert" on public.manutencao_bombas_config for insert to authenticated
with check (public.membro_da_rede(rede_id));

drop policy if exists "manut config update" on public.manutencao_bombas_config;
create policy "manut config update" on public.manutencao_bombas_config for update to authenticated
using (public.membro_da_rede(rede_id));

create or replace function public.manutencao_bombas_config_stamp()
returns trigger language plpgsql as $$
begin
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_manutencao_bombas_config_stamp on public.manutencao_bombas_config;
create trigger trg_manutencao_bombas_config_stamp before insert or update on public.manutencao_bombas_config
  for each row execute function public.manutencao_bombas_config_stamp();
