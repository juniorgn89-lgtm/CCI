import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileSpreadsheet, ShieldCheck, Clock, Layers, CalendarRange, Database, Upload } from 'lucide-react'
import {
  fetchGestaoPrecoTabelas, fetchGestaoPrecoTabelaItens, type GestaoPrecoTabela,
} from '@/api/supabase/gestaoPrecosTabelas'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchProdutoEstoqueExtrato } from '@/api/endpoints/estoques'
import type { ProdutoEstoqueExtrato } from '@/api/types/estoque'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { useAuthStore } from '@/store/auth'
import ImportTabelaModal from '@/pages/Dashboard/components/ImportTabelaModal'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import HeaderHint from '@/components/tables/HeaderHint'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const norm = (s: string) => (s || '').toUpperCase().replace(/\s+/g, ' ').trim()
const dataBR = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')
const diasLabel = (d: number[] | null) => (!d || d.length === 0 || d.length === 7 ? 'Todos os dias' : d.slice().sort().map((i) => DIAS[i]).join(', '))
const r3 = (v: number) => `R$ ${v.toFixed(3).replace('.', ',')}`
const vigenteDe = (t: GestaoPrecoTabela, today: string) =>
  (!t.validade_inicial || t.validade_inicial <= today) && (!t.validade_final || t.validade_final >= today)

const Selo = ({ vig }: { vig: boolean }) =>
  vig ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"><ShieldCheck className="h-3 w-3" />Vigente</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300"><Clock className="h-3 w-3" />Expirada</span>
  )

const GestaoPrecosTabelas = () => {
  const today = new Date().toISOString().slice(0, 10)
  const { data: tabelas = [], isLoading } = useQuery({ queryKey: ['gp-tabelas'], queryFn: fetchGestaoPrecoTabelas, staleTime: 5 * 60 * 1000 })
  const { data: allItens = [] } = useQuery({ queryKey: ['gp-tabela-itens'], queryFn: fetchGestaoPrecoTabelaItens, staleTime: 5 * 60 * 1000 })
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas({ limite: 200 }), staleTime: 30 * 60 * 1000 })
  const nomePosto = useMemo(
    () => new Map((empresasData?.resultados ?? []).map((e) => [e.empresaCodigo, e.fantasia || e.razao || `Posto ${e.empresaCodigo}`])),
    [empresasData],
  )
  // Nome da filial → empresaCodigo (o nº de filial do WebPosto ≠ empresaCodigo,
  // então casamos pelo nome, igual ao useGestaoPrecos).
  const empresaPorNome = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of empresasData?.resultados ?? []) {
      const nm = norm(e.fantasia || e.razao || '')
      if (nm) m.set(nm, e.empresaCodigo)
    }
    return m
  }, [empresasData])
  const empDaLinha = useMemo(() => {
    const valido = (c?: number | null): c is number => c != null && nomePosto.has(c)
    return (it: { filial_nome?: string | null; filial_empresa_codigo?: number | null }): number | null =>
      empresaPorNome.get(norm(it.filial_nome ?? '')) ?? (valido(it.filial_empresa_codigo) ? it.filial_empresa_codigo : null)
  }, [empresaPorNome, nomePosto])

  // Catálogo — pra resolver nome do produto → produtoCodigo (itens sem código).
  const { data: produtosData } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages((p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    staleTime: 30 * 60 * 1000,
  })
  const nomeToCodigo = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of produtosData ?? []) { const k = norm(p.nome); if (k && !m.has(k)) m.set(k, p.produtoCodigo) }
    return m
  }, [produtosData])

  // Preço de VENDA de CADASTRO (campo "Preço de Venda A" do ERP), por posto e
  // produto — /PRODUTO_ESTOQUE_EXTRATO. É o "praticado" que a tela mostra: o
  // preço cadastrado, não a média de vendas. Buscado por posto; indexado pelo
  // empresaCodigo que vem em cada linha (robusto a vazamento/duplicata do endpoint).
  const scopeCodes = useMemo(
    () => (empresasData?.resultados ?? []).map((e) => e.empresaCodigo),
    [empresasData],
  )
  const { data: extratoRows = [] } = useQuery({
    queryKey: ['gp-preco-cadastro', scopeCodes.join(',')],
    queryFn: async () => {
      const per = await Promise.all(scopeCodes.map((c) =>
        fetchProdutoEstoqueExtrato({ empresaCodigo: c, exibeHistoricoCompra: false, limite: 2000 })
          .then((r) => r.resultados)
          .catch(() => [] as ProdutoEstoqueExtrato[])))
      return per.flat()
    },
    enabled: scopeCodes.length > 0,
    staleTime: 10 * 60 * 1000,
  })
  const precoCadastro = useMemo(() => {
    // `${empresaCodigo}|${produtoCodigo}` (do posto) + `all|${produtoCodigo}` (rede, fallback).
    const m = new Map<string, number>()
    for (const r of extratoRows) {
      if (!(r.precoVenda > 0)) continue
      const kPosto = `${r.empresaCodigo}|${r.produtoCodigo}`
      if (!m.has(kPosto)) m.set(kPosto, r.precoVenda)
      const kAll = `all|${r.produtoCodigo}`
      if (!m.has(kAll)) m.set(kAll, r.precoVenda)
    }
    return m
  }, [extratoRows])

  const [selId, setSelId] = useState<string | null>(null)

  const sel = useMemo(() => tabelas.find((t) => t.id === selId) ?? tabelas[0] ?? null, [tabelas, selId])
  const countByTabela = useMemo(() => {
    const m = new Map<string, number>()
    for (const it of allItens) m.set(it.tabela_id, (m.get(it.tabela_id) ?? 0) + 1)
    return m
  }, [allItens])
  const itensSel = useMemo(() => (sel ? allItens.filter((it) => it.tabela_id === sel.id) : []), [allItens, sel])
  const ultimaImport = useMemo(() => tabelas.reduce((mx, t) => (t.created_at > mx ? t.created_at : mx), ''), [tabelas])
  const isMaster = useAuthStore((s) => s.isMaster)
  const qc = useQueryClient()
  const [importOpen, setImportOpen] = useState(false)
  const onImported = () => { qc.invalidateQueries({ queryKey: ['gp-tabelas'] }); qc.invalidateQueries({ queryKey: ['gp-tabela-itens'] }) }
  const importModal = isMaster ? <ImportTabelaModal open={importOpen} onClose={() => setImportOpen(false)} onImported={onImported} /> : null
  const importBtn = isMaster ? (
    <button type="button" onClick={() => setImportOpen(true)}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#2563eb] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#1d4ed8]">
      <Upload className="h-3.5 w-3.5" /> Importar
    </button>
  ) : null

  if (isLoading) return <Skeleton className="h-72 rounded-2xl" />

  if (tabelas.length === 0) {
    return (
      <>
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/60 p-10 text-center dark:border-gray-700 dark:bg-gray-900/40">
          <Layers className="mx-auto mb-2 h-5 w-5 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Nenhuma tabela cadastrada</p>
          <p className="mt-1 text-[12px] text-gray-400">Não vem da API — o WebPosto não expõe a "Tabela de Preço de Prazos". Importe (Exportar XLSX → colar aqui).</p>
          {importBtn && <div className="mt-3 flex justify-center">{importBtn}</div>}
        </div>
        {importModal}
      </>
    )
  }

  return (
    <div className="space-y-3">
      {/* Aviso: não vem da API + última importação */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11.5px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
        <Database className="h-3.5 w-3.5 shrink-0" />
        <span><strong>Não vem da API</strong> — o WebPosto não expõe a "Tabela de Preço de Prazos". É preciso <strong>importar</strong> (Exportar XLSX → Visor) pra criar/atualizar.</span>
        <span className="ml-auto whitespace-nowrap text-amber-700/80 dark:text-amber-400/80">Última importação: <strong>{ultimaImport ? dataBR(ultimaImport) : '—'}</strong></span>
        {importBtn}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
      {/* Lista mestre */}
      <div className="w-full shrink-0 space-y-1.5 lg:w-[332px]">
        {tabelas.map((t) => {
          const active = sel?.id === t.id
          return (
            <button key={t.id} type="button" onClick={() => setSelId(t.id)}
              className={cn('w-full rounded-xl border bg-white px-3 py-2.5 text-left transition-colors dark:bg-gray-900',
                active ? 'border-l-4 border-l-[#2563eb] border-gray-200 dark:border-gray-700' : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/40')}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-semibold text-gray-400">{t.ref}</span>
                <Selo vig={vigenteDe(t, today)} />
              </div>
              <p className="mt-0.5 truncate text-[13px] font-semibold text-gray-800 dark:text-gray-100">{t.descricao}</p>
              <p className="mt-0.5 text-[10.5px] text-gray-400">{countByTabela.get(t.id) ?? 0} itens · início {dataBR(t.validade_inicial)}</p>
            </button>
          )
        })}
      </div>

      {/* Detalhe */}
      {sel && (
        <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-semibold text-gray-400">{sel.ref}</span>
              <Selo vig={vigenteDe(sel, today)} />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{sel.descricao}</h3>
            </div>
            <button type="button" disabled title="Exportar é roadmap (read-only)"
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-semibold text-gray-400 dark:border-gray-700">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Exportar XLSX
            </button>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-gray-100 bg-gray-50/60 px-4 py-2 text-[11px] text-gray-500 dark:border-gray-800 dark:bg-gray-800/30 dark:text-gray-400">
            <span className="inline-flex items-center gap-1"><CalendarRange className="h-3 w-3" />Validade: <strong className="text-gray-700 dark:text-gray-300">{dataBR(sel.validade_inicial)}</strong> → <strong className="text-gray-700 dark:text-gray-300">{sel.validade_final ? dataBR(sel.validade_final) : 'aberta'}</strong></span>
            <span>Dias: <strong className="text-gray-700 dark:text-gray-300">{diasLabel(sel.dias_semana)}</strong></span>
          </div>

          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-[12.5px]">
              <thead className="sticky top-0 bg-white dark:bg-gray-900">
                <tr className="border-b border-gray-100 text-left text-[10px] uppercase tracking-wide text-gray-400 dark:border-gray-800">
                  <HeaderHint label="Filial" align="left" className="px-3 font-semibold" help="Posto (unidade) da rede a que esta linha da tabela de preço se aplica." />
                  <HeaderHint label="Cliente" align="left" className="px-2 font-semibold" help="Cliente específico com preço negociado. '—' = o preço vale para todos os clientes." />
                  <HeaderHint label="Grupo" align="left" className="px-2 font-semibold" help="Grupo de clientes com condição comercial própria (ex.: frota, convênio). '—' = sem grupo, preço geral." />
                  <HeaderHint label="Produto" align="left" className="px-2 font-semibold" help="Descrição do produto conforme o cadastro do ERP." />
                  <HeaderHint label="Código" align="right" className="px-2 font-semibold" help="Código interno do produto no ERP. '—' = item da tabela ainda sem vínculo com um código cadastrado." />
                  <HeaderHint label="Tipo" align="center" className="px-2 font-semibold" help="Como o preço foi definido. 'Específico' = valor fixo cadastrado para o item (não calculado por margem/regra)." />
                  <HeaderHint label="Valor tabela" align="right" className="px-2 font-semibold" help="Preço cadastrado na tabela — o valor que deveria ser cobrado neste produto." />
                  <HeaderHint label="Praticado" align="right" className="px-2 font-semibold" help="Preço de venda cadastrado do produto no ERP (Preço de Venda A), da filial desta linha. '—' = produto sem preço de venda cadastrado no posto." />
                  <HeaderHint label="Diferença" align="right" className="px-3 font-semibold" help="Valor de tabela − preço de venda cadastrado. Negativo (vermelho) = a tabela está abaixo do preço de venda (desconto concedido); positivo = tabela acima do preço de venda." />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
                {itensSel.map((it) => {
                  const emp = empDaLinha(it)
                  const codigo = it.produto_codigo ?? nomeToCodigo.get(norm(it.produto_nome)) ?? null
                  // Preço de venda de cadastro DA FILIAL da linha; cai pro da rede
                  // se a filial for "Todas" ou o posto não tiver o produto cadastrado.
                  const praticado = codigo != null
                    ? (emp != null ? precoCadastro.get(`${emp}|${codigo}`) : undefined) ?? precoCadastro.get(`all|${codigo}`) ?? null
                    : null
                  const dif = praticado != null && it.tipo === 'especifico' ? it.valor - praticado : null
                  return (
                    <tr key={it.id}>
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{it.filial_nome || (it.filial_empresa_codigo != null ? (nomePosto.get(it.filial_empresa_codigo) ?? `Posto ${it.filial_empresa_codigo}`) : 'Todas')}</td>
                      <td className="px-2 py-2 text-gray-500 dark:text-gray-400">{it.cliente || '—'}</td>
                      <td className="px-2 py-2 text-gray-500 dark:text-gray-400">{it.grupo_cliente || it.grupo || '—'}</td>
                      <td className="px-2 py-2 font-medium text-gray-800 dark:text-gray-200">{it.produto_nome || '—'}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-gray-400">{codigo ?? '—'}</td>
                      <td className="px-2 py-2 text-center text-[11px] text-gray-500 dark:text-gray-400">{it.tipo === 'desconto' ? 'Desconto %' : 'Específico'}</td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{it.tipo === 'desconto' ? `${it.valor.toFixed(1).replace('.', ',')}%` : r3(it.valor)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{praticado != null ? r3(praticado) : <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                      <td className={cn('px-3 py-2 text-right font-semibold tabular-nums', dif == null ? 'text-gray-300 dark:text-gray-600' : dif < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                        {dif == null ? '—' : `${dif < 0 ? '−' : '+'}R$ ${Math.abs(dif).toFixed(3).replace('.', ',')}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
      {importModal}
    </div>
  )
}

export default GestaoPrecosTabelas
