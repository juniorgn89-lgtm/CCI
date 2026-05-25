-- ============================================
-- Visor360 - Supabase Schema
-- Arquivamento de inconsistências da Qualidade de Dados
-- ============================================
--
-- Tabela: qualidade_arquivados
-- Permite "esconder" uma inconsistência detectada pela Qualidade de Dados
-- (ex: abastecimento sem frentista #196907015) com rastreabilidade de quem
-- arquivou e quando. Suporta restauração — soft (mantém histórico).
--
-- Identidade lógica: (rede_id, empresa_codigo, tipo_issue, registro_codigo).
-- Mesma combinação NÃO pode estar arquivada (não-restaurada) duas vezes.
-- Após restaurar, pode-se re-arquivar (cria nova linha).

create table if not exists qualidade_arquivados (
  id uuid default gen_random_uuid() primary key,
  rede_id uuid not null references redes(id) on delete cascade,
  empresa_codigo int not null,
  -- Tipo do detector (ex: 'data-futura', 'sem-frentista', 'preco-anormal',
  -- 'litros-suspeito', 'item-sem-produto', 'caixa-aberto-muito',
  -- 'caixa-diferenca-anormal', 'estoque-negativo', 'titulo-sem-vencimento')
  tipo_issue text not null,
  -- Código do registro no Quality (stringificado pra suportar IDs compostos
  -- como 'receber:123' ou 'venda:45:produto:67' se necessário).
  registro_codigo text not null,
  -- Rótulo curto pra exibir na lista de arquivados sem precisar refazer query
  -- na API Quality. Ex: "Abastecimento #196907015 · POSTO DIVINO".
  rotulo text not null,
  -- arquivado_por: nullable porque ON DELETE SET NULL precisa zerar o FK
  -- quando o usuário for excluído. O autor é preservado em arquivado_por_nome
  -- (text denormalizado) — auditoria sobrevive à exclusão do usuário.
  arquivado_por uuid references auth.users(id) on delete set null,
  arquivado_por_nome text not null, -- email/nome — denormalizado pra preservar histórico mesmo após delete do user
  arquivado_em timestamptz not null default now(),
  -- Soft-restore: quando preenchido, o registro volta a aparecer na lista
  -- ativa. Histórico fica preservado.
  restaurado_por uuid references auth.users(id) on delete set null,
  restaurado_por_nome text,
  restaurado_em timestamptz
);

-- Apenas UMA linha ativa (não-restaurada) por (rede, empresa, tipo, codigo)
create unique index if not exists uniq_qualidade_arquivado_ativo
  on qualidade_arquivados (rede_id, empresa_codigo, tipo_issue, registro_codigo)
  where restaurado_em is null;

-- Index pra listagem por rede + empresa (caso de uso principal)
create index if not exists idx_qualidade_arquivados_rede_empresa
  on qualidade_arquivados (rede_id, empresa_codigo, arquivado_em desc);

-- ============================================
-- RLS — toda a rede vê o que a rede arquivou (master vê tudo)
-- ============================================

alter table qualidade_arquivados enable row level security;

drop policy if exists "qualidade_arquivados_select_own_rede" on qualidade_arquivados;
create policy "qualidade_arquivados_select_own_rede" on qualidade_arquivados
  for select using (
    rede_id in (select rede_id from profiles where user_id = auth.uid())
    or (select is_master from profiles where user_id = auth.uid())
  );

drop policy if exists "qualidade_arquivados_insert_own_rede" on qualidade_arquivados;
create policy "qualidade_arquivados_insert_own_rede" on qualidade_arquivados
  for insert with check (
    rede_id in (select rede_id from profiles where user_id = auth.uid())
    or (select is_master from profiles where user_id = auth.uid())
  );

-- Atualização só pra preencher campos de restauração (não permite editar
-- arquivado_por/em). Mesma regra de visibilidade.
drop policy if exists "qualidade_arquivados_update_restore" on qualidade_arquivados;
create policy "qualidade_arquivados_update_restore" on qualidade_arquivados
  for update using (
    rede_id in (select rede_id from profiles where user_id = auth.uid())
    or (select is_master from profiles where user_id = auth.uid())
  );

-- ============================================
-- Sem policy de DELETE: rastreabilidade exige que não se apague auditoria.
-- ============================================
