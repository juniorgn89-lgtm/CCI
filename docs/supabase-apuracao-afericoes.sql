-- ============================================
-- Visor360 - Cache RAW de aferições de bomba
-- ============================================
-- Aferição (afericao=true no /ABASTECIMENTO) é saída física de teste de bomba
-- (INMETRO) — NÃO é venda. O cron já recebe essas linhas da Quality e as
-- descarta ao montar o cache de venda (apuracao_abastecimentos filtra
-- `!afericao`). Esta tabela guarda o subconjunto descartado, 1 row por aferição,
-- pra que a Operação mostre "quando e quanto" sai de teste — inclusive rede-wide,
-- sem depender do /ABASTECIMENTO live (que fica 500 em alguns períodos).
--
-- Tabela SEPARADA (não uma coluna no cache de abast) de propósito: assim nenhum
-- consumidor de apuracao_abastecimentos passa a ver aferição por engano (contar
-- teste como venda). É pequena (aferição é rara) → leitura rede-wide é barata.
--
-- Populada pelo mesmo cron/`Apurar mês`. Idempotente via
-- chave (rede, empresa, abastecimento_codigo). Aferições só aparecem em
-- períodos re-apurados após esta migration.
-- ============================================

create table if not exists public.apuracao_afericoes (
  rede_id uuid not null references public.redes(id) on delete cascade,
  empresa_codigo int not null,
  abastecimento_codigo int not null,
  -- Timing
  data_fiscal date,
  data_hora_abastecimento timestamptz,
  -- Relations (nomes de posto/bomba/frentista/combustível são resolvidos no
  -- front pelos catálogos; aqui guardamos só os códigos).
  codigo_produto int,
  codigo_frentista int,
  codigo_bico int,
  -- Values (R$ da aferição é NOTIONAL — o combustível volta pro tanque; o que
  -- importa é o volume).
  quantidade numeric(14,3) not null default 0,
  valor_unitario numeric(14,4) not null default 0,
  -- Meta
  computed_at timestamptz not null default now(),
  primary key (rede_id, empresa_codigo, abastecimento_codigo)
);

-- Índice principal: range queries por período da rede (resumo rede-wide)
create index if not exists idx_apuracao_afer_rede_data
  on public.apuracao_afericoes (rede_id, data_fiscal);

-- Índice secundário: filtros por empresa específica (drill no modal do posto)
create index if not exists idx_apuracao_afer_rede_empresa_data
  on public.apuracao_afericoes (rede_id, empresa_codigo, data_fiscal);

-- ============================================
-- RLS (idêntico ao apuracao_abastecimentos)
-- ============================================
alter table public.apuracao_afericoes enable row level security;

drop policy if exists "apuracao_afer read" on public.apuracao_afericoes;
create policy "apuracao_afer read"
on public.apuracao_afericoes for select
to authenticated
using (
  public.is_current_user_master()
  or rede_id in (
    select rede_id from public.profiles where user_id = auth.uid()
    union
    select rede_id from public.frentistas where user_id = auth.uid()
  )
);

drop policy if exists "apuracao_afer insert" on public.apuracao_afericoes;
create policy "apuracao_afer insert"
on public.apuracao_afericoes for insert
to authenticated
with check (
  public.is_current_user_master()
  or rede_id in (
    select rede_id from public.profiles where user_id = auth.uid()
  )
);

drop policy if exists "apuracao_afer update" on public.apuracao_afericoes;
create policy "apuracao_afer update"
on public.apuracao_afericoes for update
to authenticated
using (
  public.is_current_user_master()
  or rede_id in (
    select rede_id from public.profiles where user_id = auth.uid()
  )
);
