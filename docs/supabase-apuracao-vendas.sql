-- ============================================
-- apuracao_vendas — cache de vendas da loja (Conveniência)
-- ============================================
-- Materializa as vendas de itens da loja por rede × empresa × dia × produto,
-- pra a tela de Conveniência abrir instantâneo em meses fechados (mesmo
-- padrão de abastecimentos/caixas). Hoje continua sempre live.
--
-- Granularidade: 1 linha por (rede, empresa, data, produto). Guarda quantidade,
-- total de venda, total de custo, o nº de LINHAS de item e o nº de CUPONS
-- (vendaCodigo distinto) de conveniência do dia (pro ticket médio = fat ÷
-- cupons, igual ao BI). `cupons` é valor de DIA, desnormalizado em cada linha
-- de conveniência do mesmo (empresa, data) — o leitor deduplica antes de somar.
--
-- Rode no SQL Editor do Supabase.

create table if not exists apuracao_vendas (
  rede_id        uuid    not null references redes(id) on delete cascade,
  empresa_codigo integer not null,
  data           date    not null,
  produto_codigo integer not null,
  quantidade     numeric not null default 0,  -- soma de item.quantidade
  total_venda    numeric not null default 0,  -- soma de item.totalVenda
  total_custo    numeric not null default 0,  -- soma de item.totalCusto
  acrescimos     numeric not null default 0,  -- soma de item.totalAcrescimo
  descontos      numeric not null default 0,  -- soma de item.totalDesconto
  setor          text,                         -- combustivel/automotivos/conveniencia (congelado na apuração)
  produto_nome   text,                         -- nome do produto no momento da apuração
  linhas         integer not null default 0,  -- nº de itens de venda
  cupons         integer not null default 0,  -- nº de cupons do setor no dia (ticket médio posto/total)
  cupons_grupo   integer not null default 0,  -- cupons distintos do GRUPO no dia (ticket médio por grupo)
  cupons_produto integer not null default 0,  -- cupons distintos do PRODUTO no dia (ticket médio por produto)
  computed_at    timestamptz not null default now(),
  computed_by    uuid,
  primary key (rede_id, empresa_codigo, data, produto_codigo)
);

-- Migração (tabela já existente): adiciona colunas novas.
alter table apuracao_vendas add column if not exists cupons         integer not null default 0;
alter table apuracao_vendas add column if not exists cupons_grupo   integer not null default 0;
alter table apuracao_vendas add column if not exists cupons_produto integer not null default 0;
alter table apuracao_vendas add column if not exists acrescimos     numeric not null default 0;
alter table apuracao_vendas add column if not exists descontos      numeric not null default 0;
alter table apuracao_vendas add column if not exists setor          text;
alter table apuracao_vendas add column if not exists produto_nome   text;

-- Índices pras leituras do front (rede_id sempre primeiro pra isolar tenant).
create index if not exists idx_apuracao_vendas_rede_data
  on apuracao_vendas (rede_id, data, empresa_codigo);

create index if not exists idx_apuracao_vendas_rede_empresa_data
  on apuracao_vendas (rede_id, empresa_codigo, data);

-- ============================================
-- RLS — master vê/grava tudo; demais só a própria rede.
-- ============================================
alter table apuracao_vendas enable row level security;

drop policy if exists "vendas_select_own_rede" on apuracao_vendas;
create policy "vendas_select_own_rede" on apuracao_vendas
  for select using (
    rede_id in (select rede_id from profiles where user_id = auth.uid())
    or (select is_master from profiles where user_id = auth.uid())
  );

drop policy if exists "vendas_insert_own_rede" on apuracao_vendas;
create policy "vendas_insert_own_rede" on apuracao_vendas
  for insert with check (
    rede_id in (select rede_id from profiles where user_id = auth.uid())
    or (select is_master from profiles where user_id = auth.uid())
  );

drop policy if exists "vendas_update_own_rede" on apuracao_vendas;
create policy "vendas_update_own_rede" on apuracao_vendas
  for update using (
    rede_id in (select rede_id from profiles where user_id = auth.uid())
    or (select is_master from profiles where user_id = auth.uid())
  );
