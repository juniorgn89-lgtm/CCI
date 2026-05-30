-- ============================================
-- Cache de COMBUSTÍVEL POR PRODUTO (apuracao_fuel_diaria)
-- ============================================
-- 1 row por (rede, empresa, dia, produto). Dá ao gráfico "Últimos 12 meses"
-- (Vendas › Combustível) a quebra por combustível + o CUSTO confiável — o
-- apuracao_diaria agregado não tem custo por produto.
--
-- Custo é gravado igual ao front (useFuelVendaCost / costOf): CMV da venda
-- primeiro, LMC (alias de produto) como fallback. Faturamento = Σ valorTotal
-- (bruto) — mesma base do fuel_faturamento agregado, então os totais por mês
-- batem com o gráfico atual.
--
-- Populado pela apuração (Admin › Apuração e auto-populate do Dashboard).
-- ============================================

create table if not exists public.apuracao_fuel_diaria (
  rede_id uuid not null references public.redes(id) on delete cascade,
  empresa_codigo int not null,
  data date not null,
  produto_codigo int not null,
  produto_nome text,
  litros numeric(14,3) not null default 0,
  faturamento numeric(14,2) not null default 0,
  custo numeric(14,2) not null default 0,
  lucro_bruto numeric(14,2) not null default 0,
  abast_count int not null default 0,
  -- Auditoria
  computed_at timestamptz not null default now(),
  computed_by uuid references auth.users(id),
  primary key (rede_id, empresa_codigo, data, produto_codigo)
);

create index if not exists idx_apuracao_fuel_diaria_periodo
  on public.apuracao_fuel_diaria (rede_id, data);

-- ============================================
-- RLS — espelha apuracao_diaria
-- ============================================
alter table public.apuracao_fuel_diaria enable row level security;

-- READ: user da rede vê seu próprio cache. Master vê tudo.
drop policy if exists "apuracao_fuel_diaria read" on public.apuracao_fuel_diaria;
create policy "apuracao_fuel_diaria read"
on public.apuracao_fuel_diaria for select
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
drop policy if exists "apuracao_fuel_diaria insert" on public.apuracao_fuel_diaria;
create policy "apuracao_fuel_diaria insert"
on public.apuracao_fuel_diaria for insert
to authenticated
with check (
  public.is_current_user_master()
  or rede_id in (
    select rede_id from public.profiles where user_id = auth.uid()
  )
);

-- UPDATE: idem (pra suportar UPSERT).
drop policy if exists "apuracao_fuel_diaria update" on public.apuracao_fuel_diaria;
create policy "apuracao_fuel_diaria update"
on public.apuracao_fuel_diaria for update
to authenticated
using (
  public.is_current_user_master()
  or rede_id in (
    select rede_id from public.profiles where user_id = auth.uid()
  )
);
