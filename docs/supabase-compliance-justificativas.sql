-- ============================================
-- Visor360 · Compliance ANP — Justificativas de reajuste (Fase 2, MVP)
-- ============================================
-- A "defesa ativa": cada reajuste de preço (troca de preço vinda da Quality)
-- pode receber uma JUSTIFICATIVA documentada (ex.: "custo subiu R$0,18/L, NF
-- 4523"). Append-only = trilha de AUDITORIA — nunca edita nem apaga; cada linha
-- é um registro imutável de quem justificou o quê e quando. É o que o posto
-- apresenta numa fiscalização da ANP.
--
-- O app é READ-ONLY só na API Quality; gravar no Supabase é permitido (igual
-- apuração/conciliação/qualidade-arquivados). NUNCA envolver em useMutation.
--
-- Vínculo com o reajuste: (empresa_codigo, produto_codigo, troca_data) — o
-- combustível daquele posto naquele dia. troca_preco_novo desambigua se houver
-- mais de uma troca no dia.
-- ============================================

create table if not exists public.compliance_justificativas (
  id uuid primary key default gen_random_uuid(),
  rede_id uuid not null references public.redes(id) on delete cascade,
  empresa_codigo int not null,
  produto_codigo int not null,
  -- O reajuste que esta justificativa cobre
  troca_data date not null,
  troca_preco_novo numeric(14,4),
  preco_antigo numeric(14,4),
  custo_referencia numeric(14,4),
  -- A defesa
  justificativa text not null,
  -- Auditoria
  criado_por uuid,
  criado_por_nome text,
  criado_em timestamptz not null default now()
);

-- Busca por posto/combustível/dia do reajuste (o lookup do log de troca).
create index if not exists idx_compliance_just_rede_empresa
  on public.compliance_justificativas (rede_id, empresa_codigo, produto_codigo, troca_data);

-- ============================================
-- RLS — SELECT + INSERT apenas (append-only). SEM update/delete = imutável.
-- ============================================
alter table public.compliance_justificativas enable row level security;

drop policy if exists "compliance_just read" on public.compliance_justificativas;
create policy "compliance_just read"
on public.compliance_justificativas for select
to authenticated
using (
  public.is_current_user_master()
  or rede_id in (
    select rede_id from public.profiles where user_id = auth.uid()
    union
    select rede_id from public.frentistas where user_id = auth.uid()
  )
);

drop policy if exists "compliance_just insert" on public.compliance_justificativas;
create policy "compliance_just insert"
on public.compliance_justificativas for insert
to authenticated
with check (
  public.is_current_user_master()
  or rede_id in (
    select rede_id from public.profiles where user_id = auth.uid()
  )
);

-- Sem policy de UPDATE nem DELETE: a trilha é append-only (auditoria).
