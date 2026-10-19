-- ============================================================================
-- Serviços da CCI contratados por posto (vindos do Prospecção360).
--
-- O Prospecção é a fonte (tabela lead_servicos, por posto/lead). Uma vez por
-- dia a Edge Function `sincronizar-servicos-cci` lê de lá (RPC protegida por
-- senha: só CNPJ + serviço + datas) e casa com os postos de cada rede pelo
-- CNPJ do /EMPRESAS do ERP. O Visor só lê esta cópia: se o Prospecção cair,
-- fica a última.
-- Idempotente; rode via `supabase db query --linked -f`.
-- ============================================================================

create table if not exists public.cci_servicos_posto (
  rede_id         uuid not null references public.redes(id) on delete cascade,
  empresa_codigo  integer not null,
  cnpj            text not null,
  servico         text not null,          -- id do catálogo do Prospecção (consultoria, bpo-financeiro, relatorios, fleetpass…)
  desde           date not null,
  ate             date,                   -- preenchido = encerrado
  origem          text,                   -- 'venda' | 'manual' (do Prospecção)
  sincronizado_em timestamptz not null default now(),
  primary key (rede_id, empresa_codigo, servico, desde)
);
create index if not exists cci_servicos_posto_rede_idx on public.cci_servicos_posto (rede_id);

alter table public.cci_servicos_posto enable row level security;
drop policy if exists cci_servicos_posto_select on public.cci_servicos_posto;
create policy cci_servicos_posto_select on public.cci_servicos_posto for select to authenticated
  using (rede_id in (select public.redes_legiveis()));
-- Escrita só pela Edge Function (service role); nenhuma policy de insert/update/delete.

comment on table public.cci_servicos_posto is 'Serviços CCI contratados por posto, sincronizados do Prospecção360 (lead_servicos) pelo CNPJ. Somente leitura no app.';

-- Agendamento diário (05:20 UTC), copiando o comando do apurar-cron-diario
-- (mesma senha do cron) e trocando só o endereço da função.
select cron.unschedule('sincronizar-servicos-cci') where exists (select 1 from cron.job where jobname = 'sincronizar-servicos-cci');
select cron.schedule(
  'sincronizar-servicos-cci',
  '20 5 * * *',
  replace(replace((select command from cron.job where jobname = 'apurar-cron-diario'), '/functions/v1/apurar-cron', '/functions/v1/sincronizar-servicos-cci'), 'timeout_milliseconds := 600000', 'timeout_milliseconds := 120000')
);
