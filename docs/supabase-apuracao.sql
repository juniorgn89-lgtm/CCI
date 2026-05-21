-- ============================================
-- Visor360 - Cache de apuração diária
-- ============================================
-- Materializa o resumo de combustível + total de vendas por (rede, empresa, dia)
-- pra meses fechados. Mês corrente continua live na API Quality.
--
-- Workflow:
--   1. User abre Central da Rede pra um mês fechado
--   2. Frontend tenta SELECT * FROM apuracao_diaria WHERE rede + empresa + data
--   3. Se cobertura completa → renderiza do cache (~200ms)
--   4. Senão → faz fetch live e UPSERT em background (próxima visita é instantânea)
-- ============================================

create table if not exists public.apuracao_diaria (
  rede_id uuid not null references public.redes(id) on delete cascade,
  empresa_codigo int not null,
  data date not null,
  -- Combustível: vem de ABASTECIMENTO + LMC (preço de custo)
  fuel_litros numeric(14,3) not null default 0,
  fuel_faturamento numeric(14,2) not null default 0,
  fuel_custo numeric(14,2) not null default 0,
  fuel_lucro_bruto numeric(14,2) not null default 0,
  fuel_abast_count int not null default 0,
  -- Vendas totais (VENDA_RESUMO) — usado pra derivar conveniência/automotivos
  vendas_total numeric(14,2) not null default 0,
  vendas_qtd int not null default 0,
  -- Auditoria
  computed_at timestamptz not null default now(),
  computed_by uuid references auth.users(id),
  primary key (rede_id, empresa_codigo, data)
);

create index if not exists idx_apuracao_diaria_periodo
  on public.apuracao_diaria (rede_id, data);

-- ============================================
-- RLS
-- ============================================
alter table public.apuracao_diaria enable row level security;

-- READ: user da rede vê seu próprio cache. Master vê tudo.
drop policy if exists "apuracao_diaria read" on public.apuracao_diaria;
create policy "apuracao_diaria read"
on public.apuracao_diaria for select
to authenticated
using (
  public.is_current_user_master()
  or rede_id in (
    select rede_id from public.profiles where user_id = auth.uid()
    union
    select rede_id from public.frentistas where user_id = auth.uid()
  )
);

-- INSERT: qualquer user autenticado da rede pode popular.
drop policy if exists "apuracao_diaria insert" on public.apuracao_diaria;
create policy "apuracao_diaria insert"
on public.apuracao_diaria for insert
to authenticated
with check (
  public.is_current_user_master()
  or rede_id in (
    select rede_id from public.profiles where user_id = auth.uid()
  )
);

-- UPDATE: idem (pra suportar UPSERT).
drop policy if exists "apuracao_diaria update" on public.apuracao_diaria;
create policy "apuracao_diaria update"
on public.apuracao_diaria for update
to authenticated
using (
  public.is_current_user_master()
  or rede_id in (
    select rede_id from public.profiles where user_id = auth.uid()
  )
);
