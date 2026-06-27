-- ============================================================================
-- GESTÃO DE PREÇOS — Fase 1.0 (cache estendido)
-- ============================================================================
-- A tela Gestão de Preços (Central da Rede) mede o "ajuste de bomba abaixo da
-- tabela" como FATO: desvio = preco_cadastro − valor_unitario, carimbado no
-- próprio abastecimento. O /ABASTECIMENTO live traz esses campos, mas é pesado
-- demais pra tela — então o cache `apuracao_abastecimentos` passa a gravá-los
-- na apuração (cron), e a tela lê do cache.
--
-- Nullable de propósito: linhas pré-migration ficam NULL → a tela cai no
-- fallback live OU exclui da conta, sempre com badge de cobertura ("X% dos
-- abastecimentos com preço de tabela"). NUNCA mostrar número sem cobertura.
--
-- Rode no SQL Editor do Supabase. Idempotente. Sem backfill aqui (o re-apurar
-- do histórico recente preenche; o resto fica no fallback live).
-- ============================================================================

alter table public.apuracao_abastecimentos
  add column if not exists preco_cadastro numeric,
  add column if not exists tabela_preco_a numeric,
  add column if not exists tabela_preco_b numeric,
  add column if not exists tabela_preco_c numeric;

comment on column public.apuracao_abastecimentos.preco_cadastro is
  'Preço de TABELA registrado no momento do abastecimento. Base do desvio de Gestão de Preços (desvio = preco_cadastro − valor_unitario). NULL = pré-migration / sem tabela → não entra na conta (cobertura visível na tela).';
comment on column public.apuracao_abastecimentos.tabela_preco_a is
  'Tabela de preço A no momento do abastecimento (semântica A/B/C definida no WebPosto — ver Phase 0 probe da Fase 2). Guardado pra atribuição futura; a Fase 1 ancora em preco_cadastro.';
