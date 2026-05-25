-- ============================================
-- Visor360 - Migration fix-up
-- Preservar histórico ao excluir usuário
-- ============================================
--
-- Padrão canônico em TODAS as tabelas de histórico que referenciam usuário:
--
--   actor_user_id uuid references auth.users(id) on delete set null,
--   actor_nome    text not null,  -- denormalizado, preservado pra sempre
--
-- Assim a exclusão de usuário:
--   1. NÃO falha (FK fica nullable + set null automaticamente)
--   2. Preserva o NOME do autor em texto (auditoria intacta)
--   3. UI mostra "(conta excluída)" quando user_id é null mas nome existe
--
-- ============================================
-- 1) qualidade_arquivados: corrige NOT NULL bug em arquivado_por
-- ============================================
--
-- Estado original (com bug): arquivado_por uuid NOT NULL + on delete set null
-- — a contradição impede a exclusão do usuário (FK violation).
-- Aqui dropamos o NOT NULL pra permitir a auto-clearança do FK.

alter table qualidade_arquivados
  alter column arquivado_por drop not null;

-- restaurado_por já é nullable, não precisa mexer.

-- ============================================
-- 2) caixa_alteracoes: garante colunas + FK + denormalização do nome
-- ============================================
--
-- O código (src/api/supabase/caixaHistory.ts) escreve `detectado_por_user_id`
-- e `detectado_por_nome` em cada insert. Esse bloco GARANTE que essas colunas
-- existem, com FK certo e padrão de preservação.

alter table caixa_alteracoes
  add column if not exists detectado_por_user_id uuid references auth.users(id) on delete set null;

alter table caixa_alteracoes
  add column if not exists detectado_por_nome text;

-- Drop e recria a FK no caso de já existir mas SEM `on delete set null`
-- (defensivo — só executa se a FK existir; ignora erro caso não exista).
do $$
begin
  if exists (
    select 1 from information_schema.referential_constraints
    where constraint_name = 'caixa_alteracoes_detectado_por_user_id_fkey'
  ) then
    alter table caixa_alteracoes
      drop constraint caixa_alteracoes_detectado_por_user_id_fkey;
    alter table caixa_alteracoes
      add constraint caixa_alteracoes_detectado_por_user_id_fkey
      foreign key (detectado_por_user_id) references auth.users(id) on delete set null;
  end if;
end $$;

-- ============================================
-- 3) Verificação — opcional, roda no SQL Editor pra confirmar
-- ============================================
--
-- select column_name, is_nullable, data_type
-- from information_schema.columns
-- where table_name in ('qualidade_arquivados', 'caixa_alteracoes')
--   and column_name like '%_por%'
-- order by table_name, ordinal_position;
--
-- Resultado esperado:
--   qualidade_arquivados.arquivado_por        | YES | uuid
--   qualidade_arquivados.arquivado_por_nome   | NO  | text
--   qualidade_arquivados.restaurado_por       | YES | uuid
--   qualidade_arquivados.restaurado_por_nome  | YES | text
--   caixa_alteracoes.detectado_por_user_id    | YES | uuid
--   caixa_alteracoes.detectado_por_nome       | YES | text
