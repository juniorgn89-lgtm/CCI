-- ============================================================================
-- Apuração automática (cron diário) — agenda a Edge Function `apurar-cron`.
-- ============================================================================
-- A Edge Function reapura, pra cada rede ATIVA, o mês corrente (dias fechados)
-- e — nos dias 1 a 3 — também o mês anterior. Roda no servidor, sem ninguém
-- logado. Este SQL agenda a chamada HTTP via pg_cron + pg_net.
--
-- PRÉ-REQUISITOS (rodar no SQL Editor do projeto Supabase):
--   1. Fazer deploy da função:
--        supabase functions deploy apurar-cron --no-verify-jwt
--   2. Definir o segredo da função (CLI):
--        supabase secrets set CRON_SECRET="<um-segredo-forte-aleatorio>"
--      (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já são injetados pelo runtime.)
--   3. Garantir policies de DELETE/INSERT nas tabelas apuracao_* pro service role
--      (o service role ignora RLS por padrão — só confira que RLS não bloqueia).
--
-- Depois rode o bloco abaixo UMA vez, trocando os placeholders.
-- ============================================================================

-- Extensões necessárias (idempotente).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ⚠️ TROQUE os 2 placeholders abaixo:
--   <PROJECT_REF>  → ref do projeto (ex.: abcdwxyz) — está na URL do dashboard.
--   <CRON_SECRET>  → o MESMO valor passado em `supabase secrets set CRON_SECRET`.

-- Remove agendamento anterior (se reexecutar este script).
select cron.unschedule('apurar-cron-diario')
where exists (select 1 from cron.job where jobname = 'apurar-cron-diario');

-- Agenda: todo dia às 05:10 UTC (= 02:10 em America/Sao_Paulo) — garante que
-- "ontem" já fechou. Ajuste o horário conforme preferir.
select cron.schedule(
  'apurar-cron-diario',
  '10 5 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/apurar-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body    := '{}'::jsonb,  -- scope ausente = "closed" (últimos 3 dias fechados)
    timeout_milliseconds := 600000  -- 10 min (apuração de várias redes é pesada)
  );
  $$
);

-- ── 2º cron: DIA CORRENTE a cada 30 min (scope=today) ─────────────────────
-- Mantém o cache do dia de hoje fresco (apura só hoje, leve). Independente do
-- diário acima. (Hoje ainda é lido AO VIVO pelo front; este cron prepara o
-- cache pra quando o front passar a ler "hoje" do Supabase.)
select cron.unschedule('apurar-cron-hoje')
where exists (select 1 from cron.job where jobname = 'apurar-cron-hoje');

select cron.schedule(
  'apurar-cron-hoje',
  '*/30 * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/apurar-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body    := jsonb_build_object('scope', 'today'),
    timeout_milliseconds := 600000
  );
  $$
);

-- ── Conferência / operação ────────────────────────────────────────────────
-- Ver o job agendado:
--   select jobid, jobname, schedule, active from cron.job where jobname = 'apurar-cron-diario';
-- Ver as últimas execuções (status/retorno do net.http_post):
--   select * from cron.job_run_details where jobname = 'apurar-cron-diario' order by start_time desc limit 10;
-- Ver respostas HTTP da Edge Function (pg_net):
--   select id, status_code, content from net._http_response order by id desc limit 10;
-- Rodar AGORA manualmente (sem esperar o cron) — útil pra testar:
--   select net.http_post(
--     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/apurar-cron',
--     headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'),
--     body := '{}'::jsonb, timeout_milliseconds := 600000);
