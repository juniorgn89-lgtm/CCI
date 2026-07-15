import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, Clock, Layers, CalendarRange, Radio } from 'lucide-react'
import { useTabelasPrazo, type TabelaPrazoVM } from '@/pages/Dashboard/hooks/useTabelasPrazo'
import { todayLocal } from '@/lib/period'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchProdutoEstoqueExtrato } from '@/api/endpoints/estoques'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import HeaderHint from '@/components/tables/HeaderHint'

const DIAS7 = ['', 'Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] // índice 1..7
const dataBR = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')
const diasLabel = (d: number[] | null) => (!d || d.length === 0 || d.length === 7 ? 'Todos os dias' : d.slice().sort().map((i) => DIAS7[i]).join(', '))
const r3 = (v: number) => `R$ ${v.toFixed(3).replace('.', ',')}`
const vigenteDe = (t: TabelaPrazoVM, today: string) =>
  (!t.validadeInicial || t.validadeInicial <= today) && (!t.validadeFinal || t.validadeFinal >= today)

const Selo = ({ vig }: { vig: boolean }) =>
  vig ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"><ShieldCheck className="h-3 w-3" />Vigente</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300"><Clock className="h-3 w-3" />Expirada</span>
  )

const GestaoPrecosTabelas = () => {
  const today = todayLocal()
  const { data: tabelas = [], isLoading } = useTabelasPrazo()
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas({ limite: 200 }), staleTime: 30 * 60 * 1000 })
  const nomePosto = useMemo(
    () => new Map((empresasData?.resultados ?? []).map((e) => [e.empresaCodigo, e.fantasia || e.razao || `Posto ${e.empresaCodigo}`])),
    [empresasData],
  )

  // Catálogo de produtos — resolve produtoCodigo → nome (a tabela traz só o código).
  const { data: produtosData } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages((p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    staleTime: 30 * 60 * 1000,
  })
  const produtoNome = useMemo(() => {
    const m = new Map<number, string>()
    for (const p of produtosData ?? []) if (!m.has(p.produtoCodigo)) m.set(p.produtoCodigo, p.nome)
    return m
  }, [produtosData])

  // Catálogo de grupos — pras linhas em nível de grupo (produtoCodigo null).
  const { data: gruposData } = useQuery({
    queryKey: ['grupos'],
    queryFn: () => fetchAllPages((p) => fetchGrupos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 50),
    staleTime: 30 * 60 * 1000,
  })
  const grupoNome = useMemo(() => {
    const m = new Map<number, string>()
    for (const g of gruposData ?? []) if (!m.has(g.grupoCodigo)) m.set(g.grupoCodigo, g.nome)
    return m
  }, [gruposData])

  // Preço de VENDA de CADASTRO (campo "Preço de Venda A" do ERP), por posto e
  // produto — /PRODUTO_ESTOQUE_EXTRATO. É o "praticado" que a tela compara com o
  // valor da tabela. Indexado pelo empresaCodigo que vem em cada linha.
  const scopeCodes = useMemo(
    () => (empresasData?.resultados ?? []).map((e) => e.empresaCodigo),
    [empresasData],
  )
  // UMA chamada REDE-WIDE (sem empresaCodigo → todos os postos), paginada. Antes
  // era 1 requisição POR posto (fan-out estrangulado no teto de conexões do
  // navegador → aba lenta em rede grande). `scopeCodes` fica na chave só pra
  // isolar o cache por rede (a troca de posto não refaz o fetch).
  const { data: extratoRows = [] } = useQuery({
    queryKey: ['gp-preco-cadastro-rede', scopeCodes.join(',')],
    queryFn: () => fetchAllPages(
      (p) => fetchProdutoEstoqueExtrato({ exibeHistoricoCompra: false, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      2000, 20,
    ),
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

  if (isLoading) return <Skeleton className="h-72 rounded-2xl" />

  if (tabelas.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/60 p-10 text-center dark:border-gray-700 dark:bg-gray-900/40">
        <Layers className="mx-auto mb-2 h-5 w-5 text-gray-300 dark:text-gray-600" />
        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Nenhuma tabela de preço de prazo</p>
        <p className="mt-1 text-[12px] text-gray-400">O WebPosto não retornou nenhuma "Tabela de Preço de Prazos" para esta rede.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Fonte: live da API (antes era importação XLSX). */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-[11.5px] text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
        <Radio className="h-3.5 w-3.5 shrink-0" />
        <span><strong>Live da API</strong> — a "Tabela de Preço de Prazos" (BARATAO, TABACARIA, …) vem direto do WebPosto via <code className="rounded bg-emerald-100 px-1 dark:bg-emerald-900/40">GET /TABELA_PRECO_PRAZO</code>. Sem importação manual.</span>
        <span className="ml-auto whitespace-nowrap text-emerald-700/80 dark:text-emerald-400/80">{tabelas.length} tabela{tabelas.length === 1 ? '' : 's'}</span>
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
              <p className="mt-0.5 text-[10.5px] text-gray-400">{t.itens.length} itens · início {dataBR(t.validadeInicial)}</p>
            </button>
          )
        })}
      </div>

      {/* Detalhe */}
      {sel && (
        <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-semibold text-gray-400">{sel.ref}</span>
              <Selo vig={vigenteDe(sel, today)} />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{sel.descricao}</h3>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-gray-100 bg-gray-50/60 px-4 py-2 text-[11px] text-gray-500 dark:border-gray-800 dark:bg-gray-800/30 dark:text-gray-400">
            <span className="inline-flex items-center gap-1"><CalendarRange className="h-3 w-3" />Validade: <strong className="text-gray-700 dark:text-gray-300">{dataBR(sel.validadeInicial)}</strong> → <strong className="text-gray-700 dark:text-gray-300">{sel.validadeFinal ? dataBR(sel.validadeFinal) : 'aberta'}</strong></span>
            <span>Dias: <strong className="text-gray-700 dark:text-gray-300">{diasLabel(sel.diasSemana)}</strong></span>
          </div>

          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-[12.5px]">
              <thead className="sticky top-0 bg-white dark:bg-gray-900">
                <tr className="border-b border-gray-100 text-left text-[10px] uppercase tracking-wide text-gray-400 dark:border-gray-800">
                  <HeaderHint label="Filial" align="left" className="px-3 font-semibold" help="Posto (unidade) da rede a que esta linha da tabela de preço se aplica. 'Todas' = vale para a rede inteira." />
                  <HeaderHint label="Produto" align="left" className="px-2 font-semibold" help="Descrição do produto conforme o cadastro do ERP. Linhas em nível de grupo mostram o nome do grupo." />
                  <HeaderHint label="Código" align="right" className="px-2 font-semibold" help="Código do produto no ERP (mesmo do /PRODUTO). '—' = regra em nível de grupo, sem produto específico." />
                  <HeaderHint label="Tipo" align="center" className="px-2 font-semibold" help="Como o preço foi definido. 'Específico' = valor fixo em R$; 'Desconto' = percentual sobre o preço de venda." />
                  <HeaderHint label="Valor tabela" align="right" className="px-2 font-semibold" help="Preço cadastrado na tabela — o valor que deveria ser cobrado neste produto (ou o % de desconto)." />
                  <HeaderHint label="Praticado" align="right" className="px-2 font-semibold" help="Preço de venda cadastrado do produto no ERP (Preço de Venda A), da filial desta linha. '—' = produto sem preço de venda cadastrado no posto." />
                  <HeaderHint label="Diferença" align="right" className="px-3 font-semibold" help="Valor de tabela − preço de venda cadastrado. Negativo (vermelho) = a tabela está abaixo do preço de venda (desconto concedido); positivo = tabela acima." />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
                {sel.itens.map((it) => {
                  const codigo = it.produtoCodigo
                  const nome = codigo != null
                    ? (produtoNome.get(codigo) ?? `Produto ${codigo}`)
                    : it.grupoCodigo != null
                      ? (grupoNome.get(it.grupoCodigo) ?? `Grupo ${it.grupoCodigo}`)
                      : '—'
                  const filialLabel = it.empresaCodigo != null ? (nomePosto.get(it.empresaCodigo) ?? `Posto ${it.empresaCodigo}`) : 'Todas'
                  // Preço de venda de cadastro DA FILIAL da linha; cai pro da rede
                  // se a filial for "Todas" ou o posto não tiver o produto cadastrado.
                  const praticado = codigo != null
                    ? (it.empresaCodigo != null ? precoCadastro.get(`${it.empresaCodigo}|${codigo}`) : undefined) ?? precoCadastro.get(`all|${codigo}`) ?? null
                    : null
                  const dif = praticado != null && it.tipo === 'especifico' ? it.valor - praticado : null
                  return (
                    <tr key={it.id}>
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{filialLabel}</td>
                      <td className="px-2 py-2 font-medium text-gray-800 dark:text-gray-200">{nome}</td>
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
    </div>
  )
}

export default GestaoPrecosTabelas
