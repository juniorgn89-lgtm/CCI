-- ============================================
-- CCISGA - Supabase Schema
-- Histórico de alterações de caixa
-- ============================================

-- Snapshots do estado do caixa (para comparação)
create table if not exists caixa_snapshots (
  id uuid default gen_random_uuid() primary key,
  empresa_codigo int not null,
  caixa_codigo int not null,
  turno_codigo int not null,
  funcionario_codigo int not null,
  funcionario_nome text not null,
  data_movimento date not null,
  apurado numeric(14,2) not null default 0,
  diferenca numeric(14,2) not null default 0,
  fechado boolean not null default false,
  snapshot_at timestamptz not null default now(),

  -- Unique constraint: one snapshot per caixa session
  unique (empresa_codigo, caixa_codigo, turno_codigo, data_movimento)
);

-- Histórico de alterações detectadas
create table if not exists caixa_alteracoes (
  id uuid default gen_random_uuid() primary key,
  empresa_codigo int not null,
  caixa_codigo int not null,
  turno_codigo int not null,
  funcionario_nome text not null,
  data_movimento date not null,
  campo text not null,           -- ex: 'apurado', 'diferenca', 'fechado'
  valor_anterior text,
  valor_novo text,
  descricao text not null,       -- ex: 'Apurado alterado de R$ 200,00 para R$ 182,71'
  detectado_em timestamptz not null default now()
);

-- Índices para consultas rápidas
create index if not exists idx_caixa_snapshots_empresa
  on caixa_snapshots (empresa_codigo, data_movimento desc);

create index if not exists idx_caixa_alteracoes_empresa
  on caixa_alteracoes (empresa_codigo, data_movimento desc);

create index if not exists idx_caixa_alteracoes_caixa
  on caixa_alteracoes (caixa_codigo, turno_codigo, data_movimento desc);

-- RLS (Row Level Security) - habilitar depois de configurar auth
-- alter table caixa_snapshots enable row level security;
-- alter table caixa_alteracoes enable row level security;
