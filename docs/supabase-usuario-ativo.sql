-- ============================================================================
-- USUÁRIOS — flag `ativo` (inativar sem excluir)
-- ============================================================================
-- Estado distinto de "Pendente" (approved=false, aguardando 1ª aprovação) e de
-- "Excluir" (remove de auth.users). `ativo=false` = usuário INATIVADO pelo
-- Gerente Geral: bloqueia o login, mas preserva o registro/histórico.
--
-- O gate de login (useAuth) exige approved=true E ativo!=false. O gate é
-- TOLERANTE: enquanto esta coluna não existir, cai no fallback só-approved
-- (não trava ninguém). Rode a SQL pra ativar o bloqueio por inatividade.
--
-- A atualização usa a MESMA policy de UPDATE que já cobre approved (master
-- atualiza profiles). Idempotente.
-- ============================================================================

alter table public.profiles
  add column if not exists ativo boolean not null default true;

comment on column public.profiles.ativo is
  'Usuário ativo. false = inativado pelo Gerente Geral (bloqueia login, preserva o registro). Distinto de approved=false (pendente) e de excluir (remove de auth.users).';
