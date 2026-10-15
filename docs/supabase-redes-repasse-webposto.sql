-- ============================================================================
-- redes.repasse_webposto — a rede veio pelo canal WebPosto (entra no repasse)
-- ou é cliente próprio da CCI (fora da conta do contrato). Default false:
-- as redes já existentes antes do contrato são da CCI; o master marca as novas.
-- Idempotente. Tela: Painel → Contrato WebPosto.
-- ============================================================================
alter table public.redes
  add column if not exists repasse_webposto boolean not null default false;

comment on column public.redes.repasse_webposto is 'true = cliente trazido pelo WebPosto (entra no repasse do contrato); false = cliente próprio da CCI.';

notify pgrst, 'reload schema';
