-- ============================================================================
-- pode_demonstrar — permissão de usar o Modo Demonstração (mascara o nome da
-- rede e dos postos pra apresentar o sistema a um prospect). Master sempre pode.
-- Concedida em Painel → Usuários (switch "Demo"). Idempotente.
-- ============================================================================

alter table public.profiles
  add column if not exists pode_demonstrar boolean not null default false;
