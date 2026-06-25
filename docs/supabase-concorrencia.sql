-- ============================================
-- CONCORRÊNCIA — preço de praça observado (manual, do gestor)
-- ============================================
-- NÃO é a IA agindo: é entrada de dado do gestor (preço PÚBLICO de placa/bomba).
-- APPEND-ONLY: cada cadastro = 1 linha datada. NUNCA sobrescreve — "editar" no
-- front = INSERIR nova observação (observado_em = hoje). Assim o histórico 30d
-- sai de graça e vira a fundação da elasticidade futura (regressão preço×volume).
--
-- Compliance (CADE): só preço PÚBLICO observado (placa/bomba/app/ANP), jamais
-- preço combinado entre concorrentes. O CHECK em `fonte` e os comments fixam isso.
-- ============================================

create table if not exists public.concorrencia_precos (
  id                  uuid primary key default gen_random_uuid(),
  rede_id             uuid not null references public.redes(id) on delete cascade,
  -- MEU posto cuja "praça" esta observação descreve (seletor "Meu posto").
  empresa_codigo      int  not null,
  -- Combustível como SLUG (desacoplado do produtoCodigo interno; o concorrente
  -- não compartilha meus códigos). Mapeado pra produtoCodigo no app.
  combustivel         text not null
                        check (combustivel in (
                          'gasolina_comum','gasolina_aditivada',
                          'diesel_s10','diesel_s500','etanol','gnv'
                        )),
  concorrente_nome    text not null,
  -- nº de postos do concorrente — peso da média ponderada da praça.
  concorrente_postos  int  not null default 1 check (concorrente_postos >= 1),
  preco               numeric(6,3) not null check (preco > 0),         -- R$/L, 3 casas
  -- DATA da observação (placa/bomba) — dirige o histórico 30d e o selo de frescor.
  observado_em        date not null default current_date,
  -- COMPLIANCE (CADE): só preço PÚBLICO. Nenhum valor implica preço combinado.
  fonte               text not null default 'observado'
                        check (fonte in ('observado','app_publico','anp')),
  observacao          text,
  -- Auditoria
  created_by          uuid not null default auth.uid() references auth.users(id),
  created_at          timestamptz not null default now()
);

comment on table public.concorrencia_precos is
  'Preço de praça PÚBLICO observado (placa/bomba), cadastro manual do gestor. Append-only (nunca sobrescrever; editar = nova linha). Compliance CADE: jamais preço combinado entre concorrentes.';
comment on column public.concorrencia_precos.fonte is
  'Origem do preço PÚBLICO: observado (placa/bomba) | app_publico | anp. Nunca preço acordado entre concorrentes.';
comment on column public.concorrencia_precos.observado_em is
  'Data da observação na rua. Dirige o histórico 30d e o selo "alterado há X dias". Preço ATUAL = última linha por (concorrente, combustivel): max(observado_em), desempate max(created_at).';

-- Histórico 30d + "preço atual" (última observação por concorrente/combustível).
create index if not exists idx_concorrencia_praca
  on public.concorrencia_precos (rede_id, empresa_codigo, combustivel, observado_em desc);
create index if not exists idx_concorrencia_concorrente
  on public.concorrencia_precos (rede_id, empresa_codigo, concorrente_nome);

-- ============================================
-- Permissão de cadastro (espelha pode_ver_reabastecimento). Default sem acesso.
-- ============================================
alter table public.profiles
  add column if not exists pode_cadastrar_concorrencia boolean not null default false;

-- ============================================
-- RLS — leitura rede-wide; escrita gateada + escopo por empresa
-- ============================================
alter table public.concorrencia_precos enable row level security;

-- READ: qualquer membro da rede (preço de praça é dado público de referência).
drop policy if exists "concorrencia read" on public.concorrencia_precos;
create policy "concorrencia read"
on public.concorrencia_precos for select to authenticated
using (
  public.is_current_user_master()
  or rede_id in (
    select rede_id from public.profiles  where user_id = auth.uid()
    union
    select rede_id from public.frentistas where user_id = auth.uid()
  )
);

-- INSERT: só quem tem permissão de cadastro (ou master), na PRÓPRIA rede, e
-- SÓ pra empresa dentro do escopo do gestor (profiles.empresa_codigos).
drop policy if exists "concorrencia insert" on public.concorrencia_precos;
create policy "concorrencia insert"
on public.concorrencia_precos for insert to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.rede_id = concorrencia_precos.rede_id
      and (p.is_master or p.pode_cadastrar_concorrencia)
      and (
        p.empresa_codigos is null
        or array_length(p.empresa_codigos, 1) is null   -- sem restrição = toda a rede
        or concorrencia_precos.empresa_codigo = any (p.empresa_codigos)
      )
  )
);

-- SEM update: o log é IMUTÁVEL (editar = inserir nova linha).
-- DELETE: só master — válvula de correção de digitação (linha errada do mesmo
-- dia não tem valor histórico). Soft-invalidate fica pra quando a elasticidade
-- virar peça central (roadmap).
drop policy if exists "concorrencia delete master" on public.concorrencia_precos;
create policy "concorrencia delete master"
on public.concorrencia_precos for delete to authenticated
using ( public.is_current_user_master() );
