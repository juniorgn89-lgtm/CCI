-- ============================================================================
-- USUÁRIOS — acesso a VÁRIAS redes (ou todas)
-- ============================================================================
-- Estende o modelo de 1 rede por usuário (`rede_id`) pra permitir uma LISTA de
-- redes ou "todas", sem virar master (que é admin total).
--
-- Semântica de acesso de um usuário:
--   acesso_todas_redes = true        -> todas as redes (vivo, não snapshot)
--   senão redes_permitidas não-vazia -> essas redes
--   senão                            -> cai no rede_id (legado intacto)
--   is_master                        -> acima de tudo (admin total)
--
-- Aditivo e idempotente. O gate (Selecionar rede / login) passa a respeitar
-- isso na Fase 2 — enquanto não rodar a Fase 2, o comportamento de acesso não
-- muda; só a ATRIBUIÇÃO na tela de Usuários (Fase 1).
-- ============================================================================

alter table public.profiles
  add column if not exists redes_permitidas uuid[],
  add column if not exists acesso_todas_redes boolean not null default false;

comment on column public.profiles.redes_permitidas is
  'Redes que o usuário pode acessar. NULL/vazio = cai no rede_id (legado). Ignorado quando acesso_todas_redes=true ou is_master.';
comment on column public.profiles.acesso_todas_redes is
  'true = acessa TODAS as redes (vivo, não snapshot). Distinto de is_master (admin total).';
