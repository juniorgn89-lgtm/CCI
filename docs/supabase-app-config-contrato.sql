-- ============================================================================
-- app_config · parâmetros do contrato com o WebPosto (Painel → Contrato WebPosto)
--
-- Valor por posto ativo/mês, alíquota efetiva do Simples (%) e data de início.
-- Lidos só pelo master na tela de contrato; a tabela já tem leitura pública,
-- então NADA sigiloso entra aqui (valor de contrato é dado comercial interno,
-- mas não é credencial). Idempotente.
-- ============================================================================

alter table public.app_config
  add column if not exists contrato_valor_posto   numeric(12,2) not null default 165.33,
  add column if not exists contrato_aliquota_pct  numeric(6,3)  not null default 0,
  add column if not exists contrato_inicio        date,
  add column if not exists contrato_observacoes   text not null default '';

comment on column public.app_config.contrato_valor_posto  is 'Valor líquido por posto ativo ao mês (R$) acordado com o WebPosto.';
comment on column public.app_config.contrato_aliquota_pct is 'Alíquota efetiva do Simples (%) usada para o gross-up: faturado = líquido / (1 - aliq).';
comment on column public.app_config.contrato_inicio       is 'Início da vigência do contrato com o WebPosto.';

notify pgrst, 'reload schema';
