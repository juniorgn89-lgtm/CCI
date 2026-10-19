-- ============================================================================
-- Contrato WebPosto · modelo de INDICAÇÃO (15/10/2026)
-- O WebPosto indica, libera a API e cadastra; a CCI vende, instala, suporta e
-- fatura o cliente a R$ 389,90/posto. A CCI repassa um PERCENTUAL do valor
-- recebido por posto ativo indicado. Idempotente.
-- ============================================================================
alter table public.app_config add column if not exists contrato_pct_repasse numeric(6,2) not null default 35;
alter table public.app_config add column if not exists contrato_pct_apos_12m numeric(6,2);
update public.app_config set contrato_valor_posto = 389.90 where contrato_valor_posto is null or contrato_valor_posto = 165.33;

alter table public.contrato_webposto_fechamentos add column if not exists pct_repasse numeric(6,2);
alter table public.contrato_webposto_fechamentos add column if not exists repasse numeric(14,2);
alter table public.contrato_webposto_fechamentos add column if not exists fica_cci numeric(14,2);
notify pgrst, 'reload schema';
