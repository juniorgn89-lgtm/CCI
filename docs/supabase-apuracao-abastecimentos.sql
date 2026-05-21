-- ============================================
-- Visor360 - Cache RAW de abastecimentos
-- ============================================
-- Diferente de apuracao_diaria (que cacheia agregados), esta tabela guarda
-- 1 row por abastecimento real. Permite que /operacao mostre lista row-level,
-- agregações per-bomba, per-frentista, per-hora etc. sem refetchar da Quality.
--
-- Populada pelo mesmo "Apurar mês" em /admin/apuracao. Idempotente via
-- chave (rede, empresa, abastecimento_codigo).
-- ============================================

create table if not exists public.apuracao_abastecimentos (
  rede_id uuid not null references public.redes(id) on delete cascade,
  empresa_codigo int not null,
  abastecimento_codigo int not null,
  -- Timing
  data_fiscal date,
  data_hora_abastecimento timestamptz,
  -- Relations
  codigo_produto int,
  codigo_frentista int,
  codigo_bico int,
  -- Values
  quantidade numeric(14,3) not null default 0,
  valor_unitario numeric(14,4) not null default 0,
  valor_total numeric(14,2) not null default 0,
  placa text,
  -- Meta
  computed_at timestamptz not null default now(),
  primary key (rede_id, empresa_codigo, abastecimento_codigo)
);

-- Índice principal: range queries por período da rede (mais comum)
create index if not exists idx_apuracao_abast_rede_data
  on public.apuracao_abastecimentos (rede_id, data_fiscal);

-- Índice secundário: filtros por empresa específica
create index if not exists idx_apuracao_abast_rede_empresa_data
  on public.apuracao_abastecimentos (rede_id, empresa_codigo, data_fiscal);

-- ============================================
-- RLS
-- ============================================
alter table public.apuracao_abastecimentos enable row level security;

drop policy if exists "apuracao_abast read" on public.apuracao_abastecimentos;
create policy "apuracao_abast read"
on public.apuracao_abastecimentos for select
to authenticated
using (
  public.is_current_user_master()
  or rede_id in (
    select rede_id from public.profiles where user_id = auth.uid()
    union
    select rede_id from public.frentistas where user_id = auth.uid()
  )
);

drop policy if exists "apuracao_abast insert" on public.apuracao_abastecimentos;
create policy "apuracao_abast insert"
on public.apuracao_abastecimentos for insert
to authenticated
with check (
  public.is_current_user_master()
  or rede_id in (
    select rede_id from public.profiles where user_id = auth.uid()
  )
);

drop policy if exists "apuracao_abast update" on public.apuracao_abastecimentos;
create policy "apuracao_abast update"
on public.apuracao_abastecimentos for update
to authenticated
using (
  public.is_current_user_master()
  or rede_id in (
    select rede_id from public.profiles where user_id = auth.uid()
  )
);
