-- ============================================================================
-- Otimização de Performance — índice ausente de apuracao_formas_pagamento
-- ============================================================================
--
-- SINTOMA
-- A leitura `fetchFormasPagamentoCache` (src/api/supabase/apuracao.ts) está
-- dando 500 "canceling statement due to statement timeout" no Supabase, mesmo
-- na 1ª página (offset 0). O front cai pro fallback "live" (lento, ~20k linhas),
-- mas a chamada do cache desperdiça o timeout antes.
--
-- A query filtra `data_movimento` (range) + `empresa_codigo` e ORDENA por
-- (data_movimento, empresa_codigo, venda_codigo, venda_prazo_codigo). Sem um
-- índice que cubra o range + essa ordem, o Postgres faz seq scan + Sort da
-- tabela inteira → timeout.
--
-- O QUE ESTE ÍNDICE FAZ
-- (rede_id, data_movimento, empresa_codigo, venda_codigo, venda_prazo_codigo)
-- — rede_id (igualdade via RLS) + data_movimento (range) lideram, e as demais
-- colunas seguem EXATAMENTE o ORDER BY. O scan sai do índice já ordenado e
-- limitado ao range (sem Sort, sem seq scan). NÃO muda dados nem resultados.
--
-- COMO APLICAR (Supabase → SQL Editor)
-- Rode o bloco abaixo. CONCURRENTLY não bloqueia a tabela (a apuração/cron
-- continua rodando). NÃO rode dentro de uma transação.
--
-- COMO REVERTER
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_apuracao_formas_rede_data_pk;
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_apuracao_formas_rede_data_pk
  ON public.apuracao_formas_pagamento
  (rede_id, data_movimento, empresa_codigo, venda_codigo, venda_prazo_codigo);

-- Verificação (deve listar o índice acima):
--   SELECT indexname FROM pg_indexes WHERE tablename = 'apuracao_formas_pagamento';
