-- ============================================
-- CCISGA - Supabase Schema
-- Histórico de alterações de caixa
-- ============================================
--
-- Este arquivo descreve o estado FINAL das tabelas. Se já existem versões
-- antigas, use o bloco de MIGRATION no final do arquivo.

-- Snapshots do estado do caixa (para comparação)
create table if not exists caixa_snapshots (
  id uuid default gen_random_uuid() primary key,
  rede_id uuid not null references redes(id) on delete cascade,
  empresa_codigo int not null,
  caixa_codigo int not null,
  turno_codigo int not null,
  funcionario_codigo int not null,
  funcionario_nome text not null,
  data_movimento date not null,
  apurado numeric(14,2) not null default 0,
  diferenca numeric(14,2) not null default 0,
  fechado boolean not null default false,
  snapshot_at timestamptz not null default now(),

  -- Unique constraint: one snapshot per (rede, caixa, turno, data)
  unique (rede_id, empresa_codigo, caixa_codigo, turno_codigo, data_movimento)
);

-- Histórico de alterações detectadas
create table if not exists caixa_alteracoes (
  id uuid default gen_random_uuid() primary key,
  rede_id uuid not null references redes(id) on delete cascade,
  empresa_codigo int not null,
  caixa_codigo int not null,
  turno_codigo int not null,
  funcionario_nome text not null,
  data_movimento date not null,
  campo text not null,           -- ex: 'apurado', 'diferenca', 'fechado'
  valor_anterior text,
  valor_novo text,
  descricao text not null,       -- ex: 'Apurado alterado de R$ 200,00 para R$ 182,71'
  detectado_em timestamptz not null default now()
);

-- Índices para consultas rápidas (rede_id sempre primeiro pra isolar tenants)
create index if not exists idx_caixa_snapshots_rede_empresa
  on caixa_snapshots (rede_id, empresa_codigo, data_movimento desc);

create index if not exists idx_caixa_alteracoes_rede_empresa
  on caixa_alteracoes (rede_id, empresa_codigo, data_movimento desc);

create index if not exists idx_caixa_alteracoes_rede_caixa
  on caixa_alteracoes (rede_id, caixa_codigo, turno_codigo, data_movimento desc);

-- ============================================
-- RLS (Row Level Security)
-- ============================================

alter table caixa_snapshots enable row level security;
alter table caixa_alteracoes enable row level security;

-- caixa_snapshots: master vê tudo, demais só veem da própria rede.
drop policy if exists "snapshots_select_own_rede" on caixa_snapshots;
create policy "snapshots_select_own_rede" on caixa_snapshots
  for select using (
    rede_id in (select rede_id from profiles where user_id = auth.uid())
    or (select is_master from profiles where user_id = auth.uid())
  );

drop policy if exists "snapshots_insert_own_rede" on caixa_snapshots;
create policy "snapshots_insert_own_rede" on caixa_snapshots
  for insert with check (
    rede_id in (select rede_id from profiles where user_id = auth.uid())
    or (select is_master from profiles where user_id = auth.uid())
  );

drop policy if exists "snapshots_update_own_rede" on caixa_snapshots;
create policy "snapshots_update_own_rede" on caixa_snapshots
  for update using (
    rede_id in (select rede_id from profiles where user_id = auth.uid())
    or (select is_master from profiles where user_id = auth.uid())
  );

-- caixa_alteracoes: mesma regra
drop policy if exists "alteracoes_select_own_rede" on caixa_alteracoes;
create policy "alteracoes_select_own_rede" on caixa_alteracoes
  for select using (
    rede_id in (select rede_id from profiles where user_id = auth.uid())
    or (select is_master from profiles where user_id = auth.uid())
  );

drop policy if exists "alteracoes_insert_own_rede" on caixa_alteracoes;
create policy "alteracoes_insert_own_rede" on caixa_alteracoes
  for insert with check (
    rede_id in (select rede_id from profiles where user_id = auth.uid())
    or (select is_master from profiles where user_id = auth.uid())
  );

-- ============================================
-- MIGRATION — rodar UMA VEZ se as tabelas já existem sem rede_id
-- ============================================
-- (Comentado por segurança. Descomente e rode no SQL Editor do Supabase,
-- ajustando o nome da rede default antes de executar.)
--
-- -- 1. Add rede_id como nullable temporariamente
-- alter table caixa_snapshots add column if not exists rede_id uuid references redes(id) on delete cascade;
-- alter table caixa_alteracoes add column if not exists rede_id uuid references redes(id) on delete cascade;
--
-- -- 2. Backfill: associa registros antigos à rede 'Default'.
-- --    AJUSTE o nome da rede se necessário antes de rodar.
-- update caixa_snapshots
--   set rede_id = (select id from redes where nome = 'Default' limit 1)
--   where rede_id is null;
-- update caixa_alteracoes
--   set rede_id = (select id from redes where nome = 'Default' limit 1)
--   where rede_id is null;
--
-- -- 3. Aplica NOT NULL agora que tudo tem rede_id
-- alter table caixa_snapshots alter column rede_id set not null;
-- alter table caixa_alteracoes alter column rede_id set not null;
--
-- -- 4. Substitui o unique constraint antigo (sem rede_id) pelo novo
-- alter table caixa_snapshots
--   drop constraint if exists caixa_snapshots_empresa_codigo_caixa_codigo_turno_codigo_d_key;
-- alter table caixa_snapshots
--   add constraint caixa_snapshots_unique_session
--   unique (rede_id, empresa_codigo, caixa_codigo, turno_codigo, data_movimento);
--
-- -- 5. Os CREATE INDEX / CREATE POLICY / ENABLE RLS no topo do arquivo
-- --    são idempotentes (IF NOT EXISTS / DROP POLICY IF EXISTS) — pode rodar
-- --    a seção inteira em cima do banco já populado.
