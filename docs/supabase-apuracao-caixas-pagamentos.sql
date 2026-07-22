-- ============================================
-- Visor360 - Cache de caixas + formas de pagamento
-- ============================================
-- Materializa /CAIXA e /VENDA_FORMA_PAGAMENTO em Supabase pra que /operacao
-- (especialmente a tab Caixa & Turnos) e ResumoOperacao deixem de fetchar
-- da Quality em meses já apurados.
--
-- Populadas pelo mesmo "Apurar mês" em /admin/apuracao, junto com
-- apuracao_diaria e apuracao_abastecimentos.
-- ============================================

-- ─── CAIXAS ────────────────────────────────────────────────
create table if not exists public.apuracao_caixas (
  rede_id uuid not null references public.redes(id) on delete cascade,
  empresa_codigo int not null,
  caixa_codigo int not null,
  turno_codigo int not null,
  data_movimento date not null,
  -- Identidade do turno
  turno text,
  pdv_codigo int,
  funcionario_codigo int,
  centro_custo int,
  -- Janela de tempo
  abertura timestamptz,
  fechamento timestamptz,
  -- Estado
  fechado boolean not null default false,
  consolidado boolean not null default false,
  bloqueado boolean not null default false,
  tipo_bloqueio text,
  tipo_inclusao text,
  -- Valores
  apurado numeric(14,2) not null default 0,
  diferenca numeric(14,2) not null default 0,
  -- Meta
  computed_at timestamptz not null default now(),
  primary key (rede_id, empresa_codigo, caixa_codigo, turno_codigo, data_movimento)
);

create index if not exists idx_apuracao_caixas_rede_data
  on public.apuracao_caixas (rede_id, data_movimento);

create index if not exists idx_apuracao_caixas_rede_empresa_data
  on public.apuracao_caixas (rede_id, empresa_codigo, data_movimento);

-- ─── FORMAS DE PAGAMENTO ───────────────────────────────────
-- VENDA_FORMA_PAGAMENTO retorna 1 row por (empresa, venda, vendaPrazoCodigo).
-- PK composta usando esses 3 campos + rede.
create table if not exists public.apuracao_formas_pagamento (
  rede_id uuid not null references public.redes(id) on delete cascade,
  empresa_codigo int not null,
  -- bigint: alguns códigos de venda (ex.: tenant de demonstração sintético)
  -- passam do teto de int4 (~2,1 bi). Reais cabem em int, mas bigint é seguro.
  venda_codigo bigint not null,
  venda_prazo_codigo bigint not null,
  data_movimento date,
  vencimento date,
  -- Forma
  forma_pagamento_codigo int,
  tipo_forma_pagamento text,
  nome_forma_pagamento text,
  administradora_codigo int,
  turno_codigo int,
  -- Valor
  valor_pagamento numeric(14,2) not null default 0,
  taxa_percentual numeric(8,4) not null default 0,
  -- Meta
  computed_at timestamptz not null default now(),
  primary key (rede_id, empresa_codigo, venda_codigo, venda_prazo_codigo)
);

create index if not exists idx_apuracao_formas_rede_data
  on public.apuracao_formas_pagamento (rede_id, data_movimento);

create index if not exists idx_apuracao_formas_rede_empresa_data
  on public.apuracao_formas_pagamento (rede_id, empresa_codigo, data_movimento);

-- ============================================
-- RLS
-- ============================================
alter table public.apuracao_caixas enable row level security;
alter table public.apuracao_formas_pagamento enable row level security;

-- ── CAIXAS ──
drop policy if exists "apuracao_caixas read" on public.apuracao_caixas;
create policy "apuracao_caixas read"
on public.apuracao_caixas for select
to authenticated
using (
  public.is_current_user_master()
  or rede_id in (
    select rede_id from public.profiles where user_id = auth.uid()
    union
    select rede_id from public.frentistas where user_id = auth.uid()
  )
);

drop policy if exists "apuracao_caixas insert" on public.apuracao_caixas;
create policy "apuracao_caixas insert"
on public.apuracao_caixas for insert
to authenticated
with check (
  public.is_current_user_master()
  or rede_id in (select rede_id from public.profiles where user_id = auth.uid())
);

drop policy if exists "apuracao_caixas update" on public.apuracao_caixas;
create policy "apuracao_caixas update"
on public.apuracao_caixas for update
to authenticated
using (
  public.is_current_user_master()
  or rede_id in (select rede_id from public.profiles where user_id = auth.uid())
);

-- ── FORMAS DE PAGAMENTO ──
drop policy if exists "apuracao_formas read" on public.apuracao_formas_pagamento;
create policy "apuracao_formas read"
on public.apuracao_formas_pagamento for select
to authenticated
using (
  public.is_current_user_master()
  or rede_id in (
    select rede_id from public.profiles where user_id = auth.uid()
    union
    select rede_id from public.frentistas where user_id = auth.uid()
  )
);

drop policy if exists "apuracao_formas insert" on public.apuracao_formas_pagamento;
create policy "apuracao_formas insert"
on public.apuracao_formas_pagamento for insert
to authenticated
with check (
  public.is_current_user_master()
  or rede_id in (select rede_id from public.profiles where user_id = auth.uid())
);

drop policy if exists "apuracao_formas update" on public.apuracao_formas_pagamento;
create policy "apuracao_formas update"
on public.apuracao_formas_pagamento for update
to authenticated
using (
  public.is_current_user_master()
  or rede_id in (select rede_id from public.profiles where user_id = auth.uid())
);
