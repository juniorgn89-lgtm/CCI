-- ============================================
-- apuracao_vendas_funcionario — produtividade de VENDEDORES (loja/conveniência)
-- ============================================
-- Materializa as vendas de itens por rede × empresa × dia × FUNCIONÁRIO × setor,
-- pra a Produtividade analisar os vendedores da conveniência (e pista), do mesmo
-- jeito que os frentistas saem dos abastecimentos. O vendedor é o
-- `funcionarioCodigo` de cada item de venda (/VENDA_ITEM), que o cache de vendas
-- por produto (apuracao_vendas) descarta.
--
-- Granularidade: 1 linha por (rede, empresa, data, funcionario, setor). Guarda
-- faturamento, custo, quantidade, acréscimos/descontos, nº de LINHAS e nº de
-- CUPONS (vendaCodigo distinto daquele funcionário no setor/dia) — pro ticket
-- médio = faturamento ÷ cupons (igual ao BI). Só setores de loja
-- (automotivos/conveniencia); combustível fica de fora (= frentista via
-- abastecimentos). Só vendas autorizadas (situacao='A').
--
-- Rode no SQL Editor do Supabase.

create table if not exists apuracao_vendas_funcionario (
  rede_id            uuid    not null references redes(id) on delete cascade,
  empresa_codigo     integer not null,
  data               date    not null,
  funcionario_codigo integer not null,
  setor              text    not null,             -- automotivos/conveniencia (congelado na apuração)
  faturamento        numeric not null default 0,   -- soma de item.totalVenda
  custo              numeric not null default 0,   -- soma de item.totalCusto
  quantidade         numeric not null default 0,   -- soma de item.quantidade
  acrescimos         numeric not null default 0,   -- soma de item.totalAcrescimo
  descontos          numeric not null default 0,   -- soma de item.totalDesconto
  linhas             integer not null default 0,   -- nº de itens de venda
  cupons             integer not null default 0,   -- vendaCodigo distinto (funcionario/setor/dia)
  computed_at        timestamptz not null default now(),
  computed_by        uuid,
  primary key (rede_id, empresa_codigo, data, funcionario_codigo, setor)
);

-- Índices pras leituras do front (rede_id sempre primeiro pra isolar tenant).
create index if not exists idx_apuracao_vendas_func_rede_data
  on apuracao_vendas_funcionario (rede_id, data, empresa_codigo);

create index if not exists idx_apuracao_vendas_func_rede_empresa_data
  on apuracao_vendas_funcionario (rede_id, empresa_codigo, data);

-- ============================================
-- RLS — master vê/grava tudo; demais só a própria rede.
-- ============================================
alter table apuracao_vendas_funcionario enable row level security;

drop policy if exists "vendas_func_select_own_rede" on apuracao_vendas_funcionario;
create policy "vendas_func_select_own_rede" on apuracao_vendas_funcionario
  for select using (
    rede_id in (select rede_id from profiles where user_id = auth.uid())
    or (select is_master from profiles where user_id = auth.uid())
  );

drop policy if exists "vendas_func_insert_own_rede" on apuracao_vendas_funcionario;
create policy "vendas_func_insert_own_rede" on apuracao_vendas_funcionario
  for insert with check (
    rede_id in (select rede_id from profiles where user_id = auth.uid())
    or (select is_master from profiles where user_id = auth.uid())
  );

drop policy if exists "vendas_func_update_own_rede" on apuracao_vendas_funcionario;
create policy "vendas_func_update_own_rede" on apuracao_vendas_funcionario
  for update using (
    rede_id in (select rede_id from profiles where user_id = auth.uid())
    or (select is_master from profiles where user_id = auth.uid())
  );

-- DELETE — necessária pra remover órfãos antes do upsert (re-apuração). Sem
-- ela, o RLS apaga 0 linhas silenciosamente (ver supabase-cache-delete-policies).
drop policy if exists "vendas_func_delete_own_rede" on apuracao_vendas_funcionario;
create policy "vendas_func_delete_own_rede" on apuracao_vendas_funcionario
  for delete using (
    rede_id in (select rede_id from profiles where user_id = auth.uid())
    or (select is_master from profiles where user_id = auth.uid())
  );
