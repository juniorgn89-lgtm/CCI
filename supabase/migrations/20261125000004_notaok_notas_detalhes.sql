-- ============================================================================
-- Notas recebidas no Visor com o MESMO padrão da tela do NotaOK: itens,
-- anexos, categoria do fornecedor, recebedor, quem lançou e a situação no ERP
-- ("No ERP · compra 1528432").
--
-- Rodar no SQL Editor do Visor DEPOIS de 20261125000003_notaok_notas_lancadas.sql.
-- Pode rodar de novo.
-- ============================================================================
alter table public.notaok_notas add column if not exists itens int;
alter table public.notaok_notas add column if not exists anexos int;
alter table public.notaok_notas add column if not exists categoria text;
alter table public.notaok_notas add column if not exists recebedor_nome text;
alter table public.notaok_notas add column if not exists lancada_erp boolean;      -- true = consta como compra no ERP
alter table public.notaok_notas add column if not exists lancada_erp_ref text;     -- nº da compra no ERP
