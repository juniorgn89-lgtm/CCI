-- ============================================
-- Visor360 - Supabase Schema
-- Cartões · Conciliação — carimbo "tratado" (Fase 1)
-- ============================================
--
-- Tabela: cartoes_conciliacao_tratada
-- Registra que o gestor JÁ TRATOU um item que não conciliou automaticamente
-- (ex.: "já lancei no ERP") — some da lista de pendências, com rastro de quem
-- carimbou e quem desfez. NÃO edita valor nem concilia: é só um reconhecimento
-- manual. A conciliação determinística (/CARTAO × /CARTAO_REMESSA) continua sendo
-- a verdade — se o repasse chegar depois, o automático prevalece e o carimbo
-- perde a função (a UI mostra "tratado · repasse chegou depois").
--
-- Identidade lógica: (rede_id, empresa_codigo, venda_codigo). vendaCodigo é único
-- por venda no tenant (as parcelas do /CARTAO compartilham o mesmo vendaCodigo),
-- então o carimbo é por VENDA. Só UMA linha ATIVA (não desfeita) por combinação
-- — soft-delete (desfeito_em) mantém o histórico e libera re-carimbar depois.
--
-- Obs.: usamos `id` surrogate + unique index parcial (em vez de PK composta
-- literal) justamente pra o soft-delete auditável funcionar — a PK composta
-- impediria re-carimbar um item que foi desfeito. A unicidade pedida
-- (rede+empresa+venda) é garantida entre os ATIVOS pelo índice parcial abaixo.

create table if not exists cartoes_conciliacao_tratada (
  id uuid default gen_random_uuid() primary key,
  rede_id uuid not null references redes(id) on delete cascade,
  empresa_codigo int not null,
  -- vendaCodigo do /CARTAO (identifica a venda; parcelas compartilham). bigint
  -- por segurança (códigos na casa das centenas de milhões).
  venda_codigo bigint not null,
  -- Snapshots pra exibir/auditar sem refazer query na Quality no momento do carimbo.
  bandeira text not null,
  dia date not null,               -- dia de liquidação (dataPagamento) do item
  valor numeric(14,2) not null,    -- valor do recebível carimbado
  motivo text not null,            -- motivo canônico no momento do carimbo
  observacao text,                 -- nota livre opcional do gestor
  -- Autoria (denormalizada — sobrevive ao delete do usuário via ON DELETE SET NULL).
  tratado_por uuid references auth.users(id) on delete set null,
  tratado_por_nome text not null,
  tratado_em timestamptz not null default now(),
  -- Soft-delete auditável: "desfazer" preenche estes campos em vez de apagar a linha.
  desfeito_por uuid references auth.users(id) on delete set null,
  desfeito_por_nome text,
  desfeito_em timestamptz
);

-- Só UMA linha ATIVA (não desfeita) por (rede, empresa, venda).
create unique index if not exists uniq_cartoes_tratada_ativo
  on cartoes_conciliacao_tratada (rede_id, empresa_codigo, venda_codigo)
  where desfeito_em is null;

-- Listagem por rede + empresa (caso de uso principal).
create index if not exists idx_cartoes_tratada_rede_empresa
  on cartoes_conciliacao_tratada (rede_id, empresa_codigo, tratado_em desc);

-- ============================================
-- RLS — toda a rede vê o que a rede carimbou (master vê tudo).
-- Analista de uma rede NÃO trata pendência de outra.
-- ============================================

alter table cartoes_conciliacao_tratada enable row level security;

drop policy if exists "cartoes_tratada_select_own_rede" on cartoes_conciliacao_tratada;
create policy "cartoes_tratada_select_own_rede" on cartoes_conciliacao_tratada
  for select using (
    rede_id in (select rede_id from profiles where user_id = auth.uid())
    or (select is_master from profiles where user_id = auth.uid())
  );

drop policy if exists "cartoes_tratada_insert_own_rede" on cartoes_conciliacao_tratada;
create policy "cartoes_tratada_insert_own_rede" on cartoes_conciliacao_tratada
  for insert with check (
    rede_id in (select rede_id from profiles where user_id = auth.uid())
    or (select is_master from profiles where user_id = auth.uid())
  );

-- Update só pra preencher o soft-delete (desfeito_*). Mesma regra de visibilidade.
drop policy if exists "cartoes_tratada_update_own_rede" on cartoes_conciliacao_tratada;
create policy "cartoes_tratada_update_own_rede" on cartoes_conciliacao_tratada
  for update using (
    rede_id in (select rede_id from profiles where user_id = auth.uid())
    or (select is_master from profiles where user_id = auth.uid())
  );

-- ============================================
-- Sem policy de DELETE: o "desfazer" é soft (desfeito_em) — auditoria não se apaga.
-- ============================================
