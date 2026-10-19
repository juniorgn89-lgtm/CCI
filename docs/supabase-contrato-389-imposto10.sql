-- ============================================================================
-- Contrato WebPosto · conta fechada em 16/10/2026
-- Preço do Visor360 ao posto: R$ 389,00. Impostos: 10% (R$ 38,90), descontados
-- ANTES do repasse → base R$ 350,10; 35% = R$ 122,54 ao WebPosto; R$ 227,57 CCI.
-- Idempotente: só mexe se ainda estiver no valor antigo.
-- ============================================================================
update public.app_config set contrato_valor_posto = 389.00 where contrato_valor_posto in (389.90, 165.33) or contrato_valor_posto is null;
update public.app_config set contrato_aliquota_pct = 10 where contrato_aliquota_pct is null or contrato_aliquota_pct = 0;
notify pgrst, 'reload schema';
