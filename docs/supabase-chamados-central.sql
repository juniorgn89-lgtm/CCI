-- ============================================================================
-- Chamados → Central CCI: marca no chamado do Visor se ele já chegou na Central.
-- Gravado pela Edge Function enviar-chamado-central (service role).
-- Rodar no SQL Editor do Supabase DO VISOR (yzmorbfadoxowchkwspl).
-- ============================================================================
alter table public.chamados add column if not exists central_id uuid;          -- id do chamado na Central
alter table public.chamados add column if not exists central_enviado_em timestamptz;
alter table public.chamados add column if not exists central_erro text;         -- último erro ao enviar (null = ok)
