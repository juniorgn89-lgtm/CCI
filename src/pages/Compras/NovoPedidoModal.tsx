import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Trash2, Loader2, Send, Save, AlertTriangle, Check, Truck, Calendar, Package, ChevronDown, ChevronUp, Sparkles, Fuel, Wrench, Store, Boxes, Layers, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt } from '@/lib/formatters'
import { useFilterStore } from '@/store/filters'
import InfoHint from '@/components/ui/InfoHint'
import { Modal, Erro } from '@/pages/Gestao/comumUi'
import {
  SETOR_LABEL, STATUS_LABEL, criarPedido, editarPedido, garantirFornecedor, fetchItensAbertosDoPosto, fetchItensDoPedido,
  type ItemInput, type PedidoRow, type SetorCompra, type TetoRow,
} from '@/api/supabase/compras'
import { useComprasBase, inputCls, selectCls, labelCls, btnPrimary, btnGhost, nomeProprio, fmtCnpj, qtdFmt } from './comum'
import { usePedidos, liberadoNoMes } from './hooks/usePedidos'
import { useFornecedores, type FornecedorOpcao, type FaixaFornecedor } from './hooks/useFornecedores'
import { useSugestoes, COBERTURA_PADRAO, LEAD_TIME_PADRAO, type Sugestao, type StatusSugestao } from './hooks/useSugestoes'
import { GUIAS } from '@/lib/guiasModais'
import { useCatalogoFornecedor } from './hooks/useCatalogoFornecedor'
import { useUltimoFornecedor } from './hooks/useUltimoFornecedor'

interface FornecedorSel { id: string | null; codigo_erp: number | null; nome: string; cnpj: string | null }
/** Último fornecedor do item (das notas do ERP) — só para separar por fornecedor; não vai pro banco. */
interface FornItem { codigo_erp: number; nome: string; cnpj: string | null }
interface ItemLocal extends ItemInput { key: string; forn?: FornItem | null }

const SETORES: { id: SetorCompra; Icon: typeof Fuel }[] = [
  { id: 'combustivel', Icon: Fuel }, { id: 'automotivos', Icon: Wrench }, { id: 'conveniencia', Icon: Store }, { id: 'outros', Icon: Boxes },
]
type StatusVisual = StatusSugestao | 'ruptura'
/** Ruptura = zerado com venda: é crítico, mas merece o próprio nome. */
const statusVisual = (s: Sugestao): StatusVisual => (s.status === 'critico' && s.saldo <= 0 ? 'ruptura' : s.status)
const STATUS_SUG: Record<StatusVisual, { label: string; cls: string }> = {
  ruptura: { label: 'Ruptura', cls: 'bg-red-600 text-white ring-red-700 dark:bg-red-700 dark:text-white dark:ring-red-800' },
  critico: { label: 'Crítico', cls: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900' },
  baixo: { label: 'Baixo', cls: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900' },
  ok: { label: 'OK', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900' },
  sem_movimento: { label: 'Sem giro', cls: 'bg-gray-100 text-gray-600 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700' },
  negativo: { label: 'Negativo', cls: 'bg-gray-100 text-gray-600 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700' },
}
const fmtDias = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: v < 10 ? 1 : 0 })}d`

/**
 * Novo pedido / edição, no modelo da referência: posto e fornecedor; busca no
 * catálogo completo, lead time e cobertura; sugestões recolhíveis com os cards
 * de categoria e a tabela por status com a quantidade a comprar na linha;
 * itens, teto do mês, observações; salvar rascunho ou enviar.
 */
/** Pedido já começado em outra tela (ex.: Estoques › Comprar): posto e itens. */
const ROTULO_FAIXA: Record<FaixaFornecedor, string> = {
  posto: 'Vendeu para este posto',
  rede: 'Vendeu para outros postos da rede',
  cadastro: 'Outros do cadastro (sem nota no ano)',
}
const fmtDiaCurto = (iso: string) => { const [a, m, d] = iso.split('-'); return `${d}/${m}/${a.slice(2)}` }

export interface PedidoInicial { empresa: number; itens: ItemInput[]; /** Categoria já definida (ex.: Combustível, vindo dos tanques). */ setor?: SetorCompra }

const NovoPedidoModal = ({ open, onClose, pedido, onSalvo, tetos, pedidos, inicial }: { open: boolean; onClose: () => void; pedido: PedidoRow | null; onSalvo: () => void; tetos: TetoRow[]; pedidos: PedidoRow[]; inicial?: PedidoInicial }) => {
  const base = useComprasBase()
  const itensSalvos = useQuery({ queryKey: ['compras-itens', pedido?.id], queryFn: () => fetchItensDoPedido(pedido!.id), enabled: !!pedido })
  if (pedido && itensSalvos.isLoading) {
    return <Modal fundo="" open={open} onClose={onClose} titulo={`Editar pedido nº ${pedido.numero}`} largura="max-w-[1240px]"><p className="inline-flex items-center gap-2 py-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando itens…</p></Modal>
  }
  const iniciais: ItemLocal[] = pedido
    ? (itensSalvos.data ?? []).map((i) => ({ key: i.id, produto_codigo: i.produto_codigo, produto_nome: i.produto_nome, unidade: i.unidade, qtd_solicitada: i.qtd_solicitada, custo_unit: i.custo_unit, justificativa: i.justificativa }))
    : (inicial?.itens ?? []).map((i) => ({ ...i, key: `p${i.produto_codigo}` }))
  return <Formulario key={pedido?.id ?? 'novo'} open={open} onClose={onClose} pedido={pedido} itensIniciais={iniciais} empresaInicial={inicial?.empresa ?? null} setorInicial={inicial?.setor ?? null} onSalvo={onSalvo} tetos={tetos} pedidos={pedidos} base={base} />
}

const Formulario = ({ open, onClose, pedido, itensIniciais, empresaInicial, setorInicial, onSalvo, tetos, pedidos, base }: {
  open: boolean; onClose: () => void; pedido: PedidoRow | null; itensIniciais: ItemLocal[]; empresaInicial: number | null; setorInicial: SetorCompra | null; onSalvo: () => void; tetos: TetoRow[]; pedidos: PedidoRow[]; base: ReturnType<typeof useComprasBase>
}) => {
  const filtroEmpresas = useFilterStore((s) => s.empresaCodigos)
  const { fornecedores: cadastro } = usePedidos(base.redeId)
  const forn = useFornecedores(base.redeId, cadastro)

  const [empresa, setEmpresa] = useState<number | null>(pedido?.empresa_codigo ?? empresaInicial ?? (filtroEmpresas.length === 1 ? filtroEmpresas[0] : null) ?? base.postos[0]?.codigo ?? null)
  const [setorSel, setSetorSel] = useState<SetorCompra | null>(pedido?.setor ?? setorInicial)
  const [fornecedorEscolhido, setFornecedor] = useState<FornecedorSel | null>(pedido ? { id: pedido.fornecedor_id, codigo_erp: pedido.fornecedor_codigo_erp, nome: pedido.fornecedor_nome, cnpj: pedido.fornecedor_cnpj } : null)
  const [buscaF, setBuscaF] = useState('')
  const [listaAberta, setListaAberta] = useState(false)
  const [leadTime, setLeadTime] = useState(LEAD_TIME_PADRAO)
  const [cobertura, setCobertura] = useState(COBERTURA_PADRAO)
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ruptura' | 'critico' | 'baixo'>('todos')
  // Grupos de produto marcados (null = todos). Zerar o conjunto = nenhum.
  const [gruposSel, setGruposSel] = useState<Set<string> | null>(null)
  const [gruposAberto, setGruposAberto] = useState(false)
  const [buscaGrupo, setBuscaGrupo] = useState('')
  const [qtds, setQtds] = useState<Record<number, string>>({})
  const [itens, setItens] = useState<ItemLocal[]>(itensIniciais)
  const [obs, setObs] = useState(pedido?.observacoes ?? '')
  const [buscaProd, setBuscaProd] = useState('')
  const [novoProd, setNovoProd] = useState<{ nome: string; qtd: string; custo: string } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState<'rascunho' | 'enviar' | null>(null)

  const sugBase = useSugestoes(empresa, 'outros', cobertura, leadTime)
  const [separar, setSeparar] = useState(true)
  // Nota lançada em outra unidade (caixa × unidade): o ERP não diz a conversão.
  // Preço da nota a mais de 3x do custo unitário não vira custo — só é avisado.
  const mesmaUnidade = (custoNota: number, custoUnit: number) => custoUnit <= 0 || (custoNota <= custoUnit * 3 && custoNota >= custoUnit / 3)
  // Produto → de quem foi comprado por último (posto primeiro, senão a rede).
  const ultimo = useUltimoFornecedor(base.redeId, empresa)
  const listaForn = useMemo(() => (listaAberta ? forn.buscar(buscaF, empresa) : []),
  // eslint-disable-next-line react-hooks/exhaustive-deps -- buscar deriva de forn.opcoes
  [listaAberta, buscaF, empresa, forn.opcoes])
  const nomePorCodigo = useMemo(() => new Map(forn.opcoes.filter((o) => o.codigo_erp != null).map((o) => [o.codigo_erp as number, o])), [forn.opcoes])
  const fornDe = (produtoCodigo: number): FornItem | null => {
    const u = ultimo.porProduto.get(produtoCodigo)
    if (!u) return null
    const o = nomePorCodigo.get(u.codigo_erp)
    return { codigo_erp: u.codigo_erp, nome: o?.nome ?? `Fornecedor cód ${u.codigo_erp}`, cnpj: o?.cnpj ?? u.cnpj }
  }
  // Sem fornecedor escolhido e com itens (ex.: vindos do Estoques): sugere o mais
  // frequente entre os últimos fornecedores deles. "trocar" desliga a sugestão.
  const [semSugestaoForn, setSemSugestaoForn] = useState(false)
  const sugerido = useMemo<FornecedorSel | null>(() => {
    if (fornecedorEscolhido || semSugestaoForn) return null
    const conta = new Map<number, { f: FornItem; n: number }>()
    for (const i of itens) { const fi = i.forn ?? fornDe(i.produto_codigo); if (!fi) continue; const c = conta.get(fi.codigo_erp) ?? { f: fi, n: 0 }; c.n += 1; conta.set(fi.codigo_erp, c) }
    const top = [...conta.values()].sort((a, b) => b.n - a.n)[0]
    if (!top) return null
    return { id: nomePorCodigo.get(top.f.codigo_erp)?.id ?? null, codigo_erp: top.f.codigo_erp, nome: top.f.nome, cnpj: top.f.cnpj }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fornDe deriva de ultimo/nomePorCodigo
  }, [fornecedorEscolhido, semSugestaoForn, itens, ultimo.porProduto, nomePorCodigo])
  const fornecedor = fornecedorEscolhido ?? sugerido
  // Fornecedor do ERP escolhido → o que ele já entregou nos últimos 12 meses
  // vira o recorte das sugestões (e o último custo pago a ele vira o custo).
  const catalogo = useCatalogoFornecedor(base.redeId, fornecedor?.codigo_erp ?? null)
  const [soFornecedor, setSoFornecedor] = useState(true)
  // Recorte = produtos comprados POR ÚLTIMO deste fornecedor (posto primeiro, senão a rede):
  // a mesma regra que separa os pedidos, então o que aparece aqui fica neste pedido.
  const doFornecedor = useMemo(() => {
    const cod = fornecedor?.codigo_erp
    if (cod == null || ultimo.carregando) return null
    const set = new Set<number>()
    for (const [p, u] of ultimo.porProduto) if (u.codigo_erp === cod) set.add(p)
    return set
  }, [fornecedor?.codigo_erp, ultimo.porProduto, ultimo.carregando])
  const temRecorte = !!doFornecedor && doFornecedor.size > 0
  const recorteAtivo = temRecorte && soFornecedor
  const aplicarFornecedor = (lista: Sugestao[]) => {
    if (!recorteAtivo || !doFornecedor) return lista
    const cat = catalogo.produtos
    return lista.filter((x) => doFornecedor.has(x.produtoCodigo)).map((x) => { const p = cat?.get(x.produtoCodigo); return p && p.ultimoCusto > 0 && mesmaUnidade(p.ultimoCusto, x.custo) ? { ...x, custo: p.ultimoCusto } : x })
  }
  const sug = useMemo(() => {
    const todos = aplicarFornecedor(sugBase.todos)
    const sugestoes = aplicarFornecedor(sugBase.sugestoes)
    const porSetor: Record<SetorCompra, number> = { combustivel: 0, automotivos: 0, conveniencia: 0, outros: 0 }
    for (const t of sugestoes) porSetor[t.setor] += 1
    return { ...sugBase, todos, sugestoes, porSetor, buscar: (termo: string, limite = 30, baseLista: Sugestao[] = todos) => sugBase.buscar(termo, limite, baseLista) }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- aplicarFornecedor deriva de recorteAtivo/catalogo
  }, [sugBase, recorteAtivo, doFornecedor, catalogo.produtos])
  // Categoria do pedido: a escolhida; senão a primeira com sugestão (combustível primeiro).
  const setor: SetorCompra = setorSel ?? (SETORES.find((s) => sug.porSetor[s.id] > 0)?.id ?? 'conveniencia')
  const daCategoria = useMemo(() => sug.sugestoes.filter((s) => setor === 'outros' || s.setor === setor), [sug.sugestoes, setor])
  /** Grupos de produto da categoria, com a contagem de sugestões em cada um. */
  const gruposProduto = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of daCategoria) m.set(s.categoria, (m.get(s.categoria) ?? 0) + 1)
    return [...m.entries()].map(([nome, n]) => ({ nome, n })).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [daCategoria])
  const grupoAtivo = (nome: string) => gruposSel == null || gruposSel.has(nome)
  const sugestoesSetor = useMemo(() => daCategoria
    .filter((s) => grupoAtivo(s.categoria))
    .filter((s) => filtroStatus === 'todos' || statusVisual(s) === filtroStatus),
  // eslint-disable-next-line react-hooks/exhaustive-deps -- grupoAtivo deriva de gruposSel
  [daCategoria, gruposSel, filtroStatus])
  const grupos = useMemo(() => (['ruptura', 'critico', 'baixo'] as StatusVisual[]).map((st) => ({ st, lista: sugestoesSetor.filter((s) => statusVisual(s) === st) })).filter((g) => g.lista.length > 0), [sugestoesSetor])
  const nGruposMarcados = gruposSel == null ? gruposProduto.length : gruposProduto.filter((g) => gruposSel.has(g.nome)).length
  const gruposVisiveis = gruposProduto.filter((g) => !buscaGrupo.trim() || g.nome.toLowerCase().includes(buscaGrupo.trim().toLowerCase()))
  const alternarGrupo = (nome: string) => setGruposSel((prev) => { const n = new Set(prev ?? gruposProduto.map((g) => g.nome)); if (n.has(nome)) n.delete(nome); else n.add(nome); return n })

  const abertos = useQuery({ queryKey: ['compras-itens', 'abertos', base.redeId, empresa], queryFn: () => fetchItensAbertosDoPosto(base.redeId!, empresa!), enabled: !!base.redeId && empresa != null, staleTime: 30_000 })
  const duplicado = (produtoCodigo: number) => (abertos.data ?? []).find((i) => i.produto_codigo === produtoCodigo && i.pedido_id !== pedido?.id)
  const noPedido = useMemo(() => new Set(itens.map((i) => i.produto_codigo)), [itens])
  const total = itens.reduce((s, i) => s + i.qtd_solicitada * i.custo_unit, 0)
  const teto = empresa != null ? tetos.find((t) => t.empresa_codigo === empresa && t.setor === setor)?.valor_mensal ?? 0 : 0
  const usadoMes = empresa != null ? liberadoNoMes(pedidos, empresa, setor, pedido?.id) : 0
  const estoura = teto > 0 && usadoMes + total > teto

  const qtdDe = (s: Sugestao) => { const v = qtds[s.produtoCodigo]; return v != null && v !== '' ? Number(v.replace(',', '.')) || 0 : Math.max(1, s.qtdSugerida) }
  const adicionar = (s: Sugestao, qtd?: number) => {
    const q = qtd ?? qtdDe(s)
    if (noPedido.has(s.produtoCodigo) || q <= 0) return
    const fi = fornDe(s.produtoCodigo)
    const u = ultimo.porProduto.get(s.produtoCodigo)
    // Custo: o preço pago na última compra (mais fiel que o custo médio).
    const custo = u && u.custo > 0 && mesmaUnidade(u.custo, s.custo) ? u.custo : s.custo
    setItens((xs) => [...xs, { key: `p${s.produtoCodigo}`, produto_codigo: s.produtoCodigo, produto_nome: s.nome, unidade: s.unidade, qtd_solicitada: q, custo_unit: Number(custo.toFixed(2)), justificativa: s.justificativa, forn: fi }])
    // Sem fornecedor escolhido: assume o de quem este produto foi comprado por último.
    if (!fornecedor && fi) {
      const o = nomePorCodigo.get(fi.codigo_erp)
      setFornecedor({ id: o?.id ?? null, codigo_erp: fi.codigo_erp, nome: fi.nome, cnpj: fi.cnpj })
      setSoFornecedor(false)
    }
  }
  const adicionarManual = () => {
    if (!novoProd || !novoProd.nome.trim()) return
    const q = Number(novoProd.qtd.replace(',', '.')) || 0
    if (q <= 0) { setErro('Informe a quantidade do produto novo.'); return }
    // Código negativo = item fora do cadastro do ERP (não bate com nenhum produto).
    const codigo = -Math.floor(Date.now() % 1e9)
    setItens((xs) => [...xs, { key: `m${codigo}`, produto_codigo: codigo, produto_nome: novoProd.nome.trim(), unidade: null, qtd_solicitada: q, custo_unit: Number((Number(novoProd.custo.replace(',', '.')) || 0).toFixed(2)), justificativa: 'produto fora do cadastro: conferir no ERP ao lançar a nota' }])
    setNovoProd(null)
  }
  const mudar = (key: string, patch: Partial<ItemLocal>) => setItens((xs) => xs.map((i) => (i.key === key ? { ...i, ...patch } : i)))
  const remover = (key: string) => setItens((xs) => xs.filter((i) => i.key !== key))
  const escolherFornecedor = (o: FornecedorOpcao) => { setFornecedor({ id: o.id, codigo_erp: o.codigo_erp, nome: o.nome, cnpj: o.cnpj }); setBuscaF(''); setListaAberta(false); setSoFornecedor(true); setSetorSel(null) }
  // Trocar = limpar SÓ a escolha anterior do fornecedor e voltar pra busca, já aberta e com foco. Itens, filtros e observações ficam.
  const trocarFornecedor = () => { setFornecedor(null); setSemSugestaoForn(true); setBuscaF(''); setListaAberta(true) }
  const usarNovo = () => { const nome = buscaF.trim(); if (!nome) return; setFornecedor({ id: null, codigo_erp: null, nome, cnpj: null }); setBuscaF(''); setListaAberta(false) }

  const podeSalvar = empresa != null && !!fornecedor && itens.length > 0 && itens.every((i) => i.qtd_solicitada > 0)
  // Itens comprados por último de OUTRO fornecedor (≠ o escolhido): viram pedidos à parte.
  const deOutros = useMemo(() => {
    if (!fornecedor) return [] as { forn: FornItem; itens: ItemLocal[] }[]
    const m = new Map<number, { forn: FornItem; itens: ItemLocal[] }>()
    for (const i of itens) {
      const fi = i.forn ?? fornDe(i.produto_codigo)
      if (!fi || fi.codigo_erp === fornecedor.codigo_erp) continue
      const g = m.get(fi.codigo_erp) ?? { forn: fi, itens: [] }
      g.itens.push(i)
      m.set(fi.codigo_erp, g)
    }
    return [...m.values()]
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fornDe deriva de ultimo/nomePorCodigo
  }, [itens, fornecedor, ultimo.porProduto, nomePorCodigo])
  const vaiSeparar = !pedido && separar && deOutros.length > 0
  const nPedidos = vaiSeparar ? deOutros.length + (itens.length > deOutros.reduce((n, g) => n + g.itens.length, 0) ? 1 : 0) : 1
  const semForn = ({ key: _k, forn: _f, ...i }: ItemLocal): ItemInput => { void _k; void _f; return i }
  const salvar = async (enviar: boolean) => {
    if (!base.redeId || empresa == null || !fornecedor) return
    setErro(null); setSalvando(enviar ? 'enviar' : 'rascunho')
    try {
      let fid = fornecedor.id
      if (!fid) { const f = await garantirFornecedor(base.redeId, { codigo_erp: fornecedor.codigo_erp, nome: fornecedor.nome, cnpj: fornecedor.cnpj }); fid = f.id }
      if (vaiSeparar) {
        // Um pedido por fornecedor: o escolhido leva os itens dele (e os sem
        // fornecedor conhecido); cada outro fornecedor ganha o seu.
        const outrosCods = new Set(deOutros.flatMap((g) => g.itens.map((i) => i.key)))
        const principais = itens.filter((i) => !outrosCods.has(i.key))
        if (principais.length > 0) {
          await criarPedido(base.redeId, { empresa_codigo: empresa, fornecedor_id: fid, fornecedor_nome: fornecedor.nome, fornecedor_cnpj: fornecedor.cnpj, fornecedor_codigo_erp: fornecedor.codigo_erp, setor, observacoes: obs.trim() || null, itens: principais.map(semForn) }, base.autor, enviar)
        }
        for (const g of deOutros) {
          const o = nomePorCodigo.get(g.forn.codigo_erp)
          const gid = o?.id ?? (await garantirFornecedor(base.redeId, { codigo_erp: g.forn.codigo_erp, nome: g.forn.nome, cnpj: g.forn.cnpj })).id
          await criarPedido(base.redeId, { empresa_codigo: empresa, fornecedor_id: gid, fornecedor_nome: g.forn.nome, fornecedor_cnpj: g.forn.cnpj, fornecedor_codigo_erp: g.forn.codigo_erp, setor, observacoes: obs.trim() || null, itens: g.itens.map(semForn) }, base.autor, enviar)
        }
        onSalvo()
        return
      }
      const input = { empresa_codigo: empresa, fornecedor_id: fid, fornecedor_nome: fornecedor.nome, fornecedor_cnpj: fornecedor.cnpj, fornecedor_codigo_erp: fornecedor.codigo_erp, setor, observacoes: obs.trim() || null, itens: itens.map(semForn) }
      if (pedido) await editarPedido(pedido, input, base.autor, enviar)
      else await criarPedido(base.redeId, input, base.autor, enviar)
      onSalvo()
    } catch (e) { setErro((e as Error).message) } finally { setSalvando(null) }
  }

  const resultados = buscaProd.trim() ? sug.buscar(buscaProd, 30, sug.todos) : []
  const totalSugestoes = sug.sugestoes.length
  const campoNum = cn(inputCls, 'h-10 pl-9 tabular-nums')

  const LinhaProduto = ({ s, comStatus }: { s: Sugestao; comStatus?: boolean }) => {
    const ja = noPedido.has(s.produtoCodigo)
    const dup = duplicado(s.produtoCodigo)
    const meta = STATUS_SUG[statusVisual(s)]
    const fi = fornDe(s.produtoCodigo)
    const u = ultimo.porProduto.get(s.produtoCodigo)
    return (
      <tr className="text-[12.5px] text-gray-800 dark:text-gray-200">
        <td className="py-1.5 pl-3 pr-2">
          <p className="font-semibold">{comStatus && <span className={cn('mr-1.5 inline-flex rounded px-1 py-px align-middle text-[9px] font-bold uppercase tracking-wider ring-1', meta.cls)}>{meta.label}</span>}{nomeProprio(s.nome)}</p>
          {fi && u ? (
            <p className="text-[10.5px] text-gray-500 dark:text-gray-400">últ. <b className="font-semibold text-gray-700 dark:text-gray-200">{fi.nome}</b> · {u.data.split('-').reverse().slice(0, 2).join('/')} · {mesmaUnidade(u.custo, s.custo) ? formatCurrency(u.custo) : <span className="text-amber-600 dark:text-amber-400">{formatCurrency(u.custo)} em outra unidade (caixa?)</span>}{u.doPosto ? '' : ' · outro posto'}</p>
          ) : ultimo.carregando ? null : <p className="text-[10.5px] text-gray-400">sem compra nos últimos 12 meses</p>}
          <p className="text-[10.5px] text-gray-400">Cód {s.produtoCodigo}{s.vendaDia > 0 ? ` · vende ${s.vendaDia.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}/dia` : ''}{(s.diasParado ?? 0) >= 30 ? ` · parado ${s.diasParado}d` : ''}{dup ? <span className="ml-1 text-amber-600 dark:text-amber-400">· já no pedido nº {dup.numero} ({STATUS_LABEL[dup.status].toLowerCase()})</span> : null}</p>
        </td>
        <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold tabular-nums">{qtdFmt(s.saldo)}{s.unidade ? <span className="ml-0.5 text-[10px] font-normal text-gray-400">{s.unidade.toLowerCase()}</span> : null}</td>
        <td className={cn('px-2 py-1.5 text-right font-semibold tabular-nums', s.status === 'critico' ? 'text-red-600 dark:text-red-400' : s.status === 'baixo' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500')}>{s.vendaDia > 0 ? fmtDias(s.diasCobertura) : '—'}</td>
        <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatCurrency(s.custo)}</td>
        <td className="px-2 py-1.5 text-right">
          <input inputMode="decimal" aria-label={`Quantidade de ${s.nome}`} value={qtds[s.produtoCodigo] ?? String(Math.max(1, s.qtdSugerida))} onChange={(e) => setQtds({ ...qtds, [s.produtoCodigo]: e.target.value })} disabled={ja} className={cn(inputCls, 'h-8 w-16 px-2 text-right font-semibold tabular-nums', ja && 'opacity-60')} />
        </td>
        <td className="py-1.5 pl-1 pr-3 text-right">
          <button type="button" aria-label={ja ? 'Já está no pedido' : 'Adicionar ao pedido'} onClick={() => adicionar(s)} disabled={ja} className={cn('inline-flex h-7 w-7 items-center justify-center rounded-md', ja ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-[#1e3a5f] text-white hover:bg-[#172d4a] dark:bg-blue-600 dark:hover:bg-blue-500')}>{ja ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}</button>
        </td>
      </tr>
    )
  }
  const Cabecalho = () => (
    <thead className="sticky top-0 z-[1] bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-900 dark:text-gray-400">
      <tr>
        <th className="py-2 pl-3 pr-2 text-left font-semibold">Produto</th>
        <th className="px-2 py-2 text-right font-semibold">Estoque</th>
        <th className="px-2 py-2 text-right font-semibold">Dura</th>
        <th className="px-2 py-2 text-right font-semibold">Custo</th>
        <th className="px-2 py-2 text-right font-semibold">Comprar</th>
        <th className="py-2 pl-1 pr-3" />
      </tr>
    </thead>
  )

  // Itens do pedido agrupados pelo pedido em que vão cair (um por fornecedor quando separa).
  const outrosKeys = new Set(deOutros.flatMap((g) => g.itens.map((i) => i.key)))
  const blocosPedido: { titulo: string | null; itens: ItemLocal[] }[] = vaiSeparar
    ? [{ titulo: fornecedor?.nome ?? null, itens: itens.filter((i) => !outrosKeys.has(i.key)) }, ...deOutros.map((g) => ({ titulo: g.forn.nome, itens: g.itens }))].filter((b) => b.itens.length > 0)
    : [{ titulo: null, itens }]
  const subtotalBloco = (l: ItemLocal[]) => l.reduce((n, i) => n + i.qtd_solicitada * i.custo_unit, 0)

  const ItemPedido = ({ i }: { i: ItemLocal }) => {
    const dup = i.produto_codigo > 0 ? duplicado(i.produto_codigo) : undefined
    return (
      <li className="px-3 py-2">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-[12.5px] font-medium leading-snug text-gray-900 dark:text-gray-100">
            {nomeProprio(i.produto_nome)}
            {i.produto_codigo > 0 && <span className="ml-1 text-[10px] font-normal text-gray-400">cód {i.produto_codigo}</span>}
            {i.justificativa && <span className="ml-1 inline-flex align-middle"><InfoHint text={i.justificativa} /></span>}
          </p>
          <button type="button" onClick={() => remover(i.key)} aria-label="Tirar do pedido" className="-mr-1 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-800"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
        {dup && <p className="mt-0.5 inline-flex items-center gap-1 text-[10.5px] text-amber-600 dark:text-amber-400"><AlertTriangle className="h-3 w-3" /> Já pedido no nº {dup.numero} ({STATUS_LABEL[dup.status].toLowerCase()}): {qtdFmt(dup.qtd_liberada ?? dup.qtd_solicitada)}{i.unidade ? ` ${i.unidade.toLowerCase()}` : ''}.</p>}
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-400">
          <input inputMode="decimal" aria-label="Quantidade" value={String(i.qtd_solicitada)} onChange={(e) => mudar(i.key, { qtd_solicitada: Number(e.target.value.replace(',', '.')) || 0 })} className={cn(inputCls, 'h-7 w-16 px-2 text-right text-[12px] tabular-nums')} />
          <span>×</span>
          <span className="relative"><span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px]">R$</span><input inputMode="decimal" aria-label="Custo unitário" value={String(i.custo_unit)} onChange={(e) => mudar(i.key, { custo_unit: Number(e.target.value.replace(',', '.')) || 0 })} onBlur={() => mudar(i.key, { custo_unit: Number(i.custo_unit.toFixed(2)) })} className={cn(inputCls, 'h-7 w-24 pl-7 pr-2 text-right text-[12px] tabular-nums')} /></span>
          <span className="ml-auto text-[12.5px] font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(i.qtd_solicitada * i.custo_unit)}</span>
        </div>
      </li>
    )
  }

  const nSetor = (id: SetorCompra) => (id === 'outros' ? totalSugestoes : sug.porSetor[id])

  return (
    <Modal guia={GUIAS.novoPedido} fundo="" open={open} onClose={onClose} titulo={pedido ? `Editar pedido nº ${pedido.numero}` : 'Novo pedido de compra'} descricao={pedido ? `Situação atual: ${STATUS_LABEL[pedido.status]}.` : undefined} largura="max-w-[1240px]">
      <div className="space-y-3">
        <Erro msg={erro} />

        {/* Topo numa linha: posto · fornecedor · prazo · cobertura */}
        <div className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_370px]">
         <div className="grid items-end gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
          <label>
            <span className={labelCls}>Posto</span>
            <select value={empresa ?? ''} onChange={(e) => { setEmpresa(Number(e.target.value) || null); setItens([]); setQtds({}) }} className={cn(selectCls, 'h-10')} disabled={!!pedido && pedido.status !== 'rascunho'}>
              {base.postos.map((p) => <option key={p.codigo} value={p.codigo}>{p.fantasia || p.razao}</option>)}
            </select>
          </label>
          <div className="relative">
            <span className={cn(labelCls, 'inline-flex items-center gap-1')}>Fornecedor
              {fornecedor ? <span className="font-normal normal-case text-gray-400">{fornecedor.codigo_erp ? <> · cód <b className="font-semibold text-[#1e3a5f] dark:text-blue-300">{fornecedor.codigo_erp}</b></> : ' · novo'}{fornecedor.cnpj ? ` · CNPJ ${fmtCnpj(fornecedor.cnpj)}` : ''}</span>
                : <InfoHint text="A lista mostra quem emitiu nota de compra para a rede no último ano (primeiro quem vendeu para este posto). Qualquer outro fornecedor cadastrado no ERP aparece ao digitar o nome, razão social, código ou CNPJ. Ao adicionar o primeiro produto, o fornecedor da última compra dele já entra aqui." />}
            </span>
            {fornecedor ? (
              <div className="flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-[#0f0f0f]">
                <Truck className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="min-w-0 flex-1 truncate font-semibold text-gray-900 dark:text-gray-100">{fornecedor.nome}</span>
                {!fornecedorEscolhido && <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-[#2563eb] dark:bg-blue-950/30 dark:text-blue-300">sugerido pela última compra</span>}
                <button type="button" onClick={trocarFornecedor} className="text-[11px] font-semibold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">trocar</button>
              </div>
            ) : (
              <>
                <span className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={buscaF} onFocus={() => setListaAberta(true)} onBlur={() => setTimeout(() => setListaAberta(false), 150)} onChange={(e) => { setBuscaF(e.target.value); setListaAberta(true) }} placeholder={itens.length > 0 && ultimo.carregando ? "Buscando o fornecedor da última compra…" : "Digite para buscar qualquer fornecedor: nome, código ou CNPJ"} autoFocus={listaAberta} className={cn(inputCls, 'h-10 pl-9')} /></span>
                {listaAberta && (
                  <div className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
                    {!buscaF.trim() && (
                      <p className="flex items-start gap-1.5 border-b border-blue-100 bg-blue-50 px-3 py-2 text-[11.5px] text-[#1e3a5f] dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
                        <Search className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>Aqui aparecem só os que emitiram nota no último ano. <b>Não achou? Digite o nome, código ou CNPJ</b>: a busca procura em todos os fornecedores cadastrados no ERP.</span>
                      </p>
                    )}
                    {listaForn.map(({ o, faixa }, i) => (
                      <div key={o.chave}>
                        {faixa !== listaForn[i - 1]?.faixa && (
                          <p className="border-b border-gray-100 bg-gray-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
                            {ROTULO_FAIXA[faixa]} <span className="font-normal normal-case tracking-normal">({listaForn.filter((x) => x.faixa === faixa).length})</span>
                          </p>
                        )}
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => escolherFornecedor(o)} className="grid w-full grid-cols-[56px_1fr_auto] items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-gray-50 dark:hover:bg-gray-800/60">
                          <span className="font-mono text-[10.5px] text-gray-400">{o.codigo_erp ?? '—'}</span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-gray-900 dark:text-gray-100">{o.nome}</span>
                            {(o.razao || o.cidade) && <span className="block truncate text-[10.5px] text-gray-400">{[o.razao, o.cidade].filter(Boolean).join(' · ')}</span>}
                          </span>
                          <span className="text-right text-[10px] leading-tight text-gray-400">
                            <span className="block font-mono">{o.cnpj ? fmtCnpj(o.cnpj) : ''}</span>
                            {o.ultimaCompra && <span className="block">última nota {fmtDiaCurto(o.ultimaCompra)}</span>}
                          </span>
                        </button>
                      </div>
                    ))}
                    {!forn.carregandoErp && listaForn.length === 0 && <p className="px-3 py-2 text-[11px] text-gray-500">{buscaF.trim() ? 'Nenhum fornecedor do cadastro com esse nome, código ou CNPJ.' : 'Nenhuma nota de compra nos últimos 12 meses. Digite para buscar no cadastro.'}</p>}
                    {forn.erroCadastro && <p className="px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">Não deu para ler o cadastro de fornecedores do ERP agora: a lista mostra só quem tem nota no ano, pelo código.</p>}
                    {buscaF.trim() && <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={usarNovo} className="flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2 text-left text-[12px] font-semibold text-[#1e3a5f] hover:bg-gray-50 dark:border-gray-800 dark:text-blue-300 dark:hover:bg-gray-800/60"><Plus className="h-3.5 w-3.5" /> Usar "{buscaF.trim()}" como novo fornecedor</button>}
                    {forn.carregandoErp && <p className="px-3 py-2 text-[11px] text-gray-400">Buscando o cadastro de fornecedores e as notas do ERP…</p>}
                  </div>
                )}
              </>
            )}
          </div>
         </div>
         <div className="grid grid-cols-2 items-end gap-3">
          <label>
            <span className={cn(labelCls, 'inline-flex items-center gap-1')}>Entrega <InfoHint text="Quantos dias o fornecedor leva para entregar. Entra na conta da quantidade: comprar o que cobre a cobertura mais a entrega." /></span>
            <span className="relative block"><Truck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input inputMode="numeric" aria-label="Dias de entrega" value={leadTime} onChange={(e) => setLeadTime(Math.max(0, Math.min(90, Number(e.target.value.replace(/\D/g, '')) || 0)))} className={campoNum} /></span>
          </label>
          <label>
            <span className={cn(labelCls, 'inline-flex items-center gap-1')}>Cobrir <InfoHint text="Por quantos dias de venda o estoque deve durar depois da compra. Abaixo da metade disso o produto fica Crítico; abaixo do total, Baixo." /></span>
            <span className="relative block"><Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input inputMode="numeric" aria-label="Dias de cobertura" value={cobertura} onChange={(e) => setCobertura(Math.max(1, Math.min(180, Number(e.target.value.replace(/\D/g, '')) || 0)))} className={campoNum} /></span>
          </label>
         </div>
        </div>

        {/* Duas colunas: escolher produtos | pedido */}
        <div className="grid gap-4 md:h-[min(720px,calc(92vh-13rem))] md:grid-cols-[minmax(0,1fr)_370px]">
          {/* ── Esquerda: escolher produtos ── */}
          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="space-y-2 border-b border-gray-100 p-3 dark:border-gray-800">
              <div className="flex gap-2">
                <span className="relative block flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={buscaProd} onChange={(e) => setBuscaProd(e.target.value)} placeholder="Buscar no catálogo: nome ou código, ex.: 473 antar" className={cn(inputCls, 'h-9 pl-9')} disabled={empresa == null || sug.carregando} /></span>
                {buscaProd.trim() && <button type="button" onClick={() => setBuscaProd('')} className={cn(btnGhost, 'h-9')}>Limpar</button>}
                <button type="button" onClick={() => setNovoProd(novoProd ? null : { nome: '', qtd: '1', custo: '' })} className={cn(btnGhost, 'h-9')}><Plus className="h-4 w-4" /> Produto novo</button>
              </div>
              {novoProd && (
                <div className="grid items-end gap-2 rounded-lg border border-dashed border-gray-300 p-2.5 md:grid-cols-[1fr_80px_110px_auto_auto] dark:border-gray-700">
                  <label><span className={labelCls}>Produto fora do cadastro</span><input value={novoProd.nome} onChange={(e) => setNovoProd({ ...novoProd, nome: e.target.value })} placeholder="Descrição como vai na nota" className={inputCls} /></label>
                  <label><span className={labelCls}>Qtd</span><input inputMode="decimal" value={novoProd.qtd} onChange={(e) => setNovoProd({ ...novoProd, qtd: e.target.value })} className={cn(inputCls, 'text-right')} /></label>
                  <label><span className={labelCls}>Custo un. (R$)</span><input inputMode="decimal" value={novoProd.custo} onChange={(e) => setNovoProd({ ...novoProd, custo: e.target.value })} placeholder="0,00" className={cn(inputCls, 'text-right')} /></label>
                  <button type="button" onClick={adicionarManual} className={btnPrimary}><Plus className="h-4 w-4" /> Adicionar</button>
                  <button type="button" onClick={() => setNovoProd(null)} className={btnGhost}>Cancelar</button>
                </div>
              )}
              {!buscaProd.trim() && empresa != null && !sug.carregando && (
                <>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-[#1e3a5f] dark:text-blue-300" />
                    <span className="text-[12px] font-semibold text-gray-900 dark:text-gray-100">Sugestões</span>
                    <InfoHint text="Produtos abaixo da cobertura escolhida, pelo saldo atual, mínimo cadastrado e venda dos últimos 30 dias (mesmo motor da aba Estoques). Crítico = menos da metade da cobertura; Baixo = menos que a cobertura. A quantidade proposta leva o estoque a cobertura + entrega dias de venda." />
                    {SETORES.map(({ id, Icon }) => {
                      const ativo = setor === id
                      return (
                        <button key={id} type="button" onClick={() => { setSetorSel(id); setGruposSel(null); setBuscaGrupo('') }} className={cn('inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-semibold transition-colors', ativo ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white dark:border-blue-500 dark:bg-blue-600' : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800/60')}>
                          <Icon className="h-3.5 w-3.5" />{id === 'outros' ? 'Todas' : SETOR_LABEL[id]}<span className={cn('tabular-nums', ativo ? 'text-white/80' : 'text-gray-400')}>{nSetor(id)}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <button type="button" onClick={() => setGruposAberto((v) => !v)} className={cn('inline-flex h-7 items-center gap-1.5 rounded-lg border px-2 text-[11.5px] font-semibold', gruposSel != null && nGruposMarcados < gruposProduto.length ? 'border-[#1e3a5f] bg-[#1e3a5f]/[0.06] text-[#1e3a5f] dark:border-blue-400 dark:bg-blue-400/10 dark:text-blue-200' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-[#0f0f0f] dark:text-gray-200')}>
                        <Layers className="h-3.5 w-3.5" />{gruposSel == null || nGruposMarcados === gruposProduto.length ? 'Todos os grupos' : nGruposMarcados === 0 ? 'Nenhum grupo' : `${nGruposMarcados} de ${gruposProduto.length} grupos`}{gruposAberto ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                      {gruposAberto && (
                        <>
                          <button type="button" aria-label="Fechar" onClick={() => setGruposAberto(false)} className="fixed inset-0 z-10 cursor-default" />
                          <div className="absolute left-0 z-20 mt-1 w-72 rounded-xl border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-900">
                            <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">Grupo de produto</p>
                            <span className="relative block"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" /><input value={buscaGrupo} onChange={(e) => setBuscaGrupo(e.target.value)} placeholder="Buscar grupo…" className={cn(inputCls, 'h-8 pl-8 text-[12px]')} /></span>
                            <div className="mt-1.5 flex items-center justify-between px-1 text-[11.5px] font-semibold">
                              <button type="button" onClick={() => setGruposSel(null)} className="text-[#1e3a5f] hover:underline dark:text-blue-300">Marcar todos <span className="font-normal text-gray-400">{gruposProduto.length}</span></button>
                              <button type="button" onClick={() => setGruposSel(new Set())} className="text-gray-500 hover:underline dark:text-gray-300">Desmarcar todos</button>
                            </div>
                            <ul className="mt-1 max-h-60 overflow-auto">
                              {gruposVisiveis.length === 0 && <li className="px-1 py-2 text-[11.5px] text-gray-400">Nenhum grupo com esse nome.</li>}
                              {gruposVisiveis.map((g) => (
                                <li key={g.nome}>
                                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-[12px] hover:bg-gray-50 dark:hover:bg-gray-800/60">
                                    <input type="checkbox" checked={grupoAtivo(g.nome)} onChange={() => alternarGrupo(g.nome)} className="h-3.5 w-3.5 rounded border-gray-300 text-[#1e3a5f] focus:ring-[#1e3a5f]" />
                                    <span className="flex-1 truncate font-medium text-gray-800 dark:text-gray-200">{g.nome}</span>
                                    <span className="rounded-full bg-gray-100 px-1.5 text-[10px] tabular-nums text-gray-600 dark:bg-gray-800 dark:text-gray-300">{g.n}</span>
                                  </label>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </>
                      )}
                    </div>
                    <span className="relative inline-flex items-center"><SlidersHorizontal className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-gray-400" />
                      <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as typeof filtroStatus)} className={cn(selectCls, 'h-7 w-auto py-0 pl-7 text-[11.5px]')}>
                        <option value="todos">Todos os status</option>
                        <option value="ruptura">Só ruptura</option>
                        <option value="critico">Só crítico</option>
                        <option value="baixo">Só baixo</option>
                      </select>
                    </span>
                    {fornecedor?.codigo_erp && (ultimo.carregando
                      ? <span className="inline-flex items-center gap-1 text-[11px] text-gray-400"><Loader2 className="h-3 w-3 animate-spin" /> lendo notas do fornecedor…</span>
                      : temRecorte
                        ? <button type="button" onClick={() => setSoFornecedor((v) => !v)} className={cn('inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[11.5px] font-semibold', recorteAtivo ? 'border-[#1e3a5f] bg-[#1e3a5f]/[0.06] text-[#1e3a5f] dark:border-blue-400 dark:bg-blue-400/10 dark:text-blue-200' : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200')}><Truck className="h-3.5 w-3.5" />{recorteAtivo ? `Só os comprados dele (${sug.todos.length})` : 'Todos os produtos'}</button>
                        : <span className="text-[11px] text-gray-400">nenhum produto deste posto foi comprado por último dele em 12 meses: mostrando tudo</span>)}
                    {sugestoesSetor.length > 0 && <button type="button" onClick={() => sugestoesSetor.forEach((s) => adicionar(s))} className="ml-auto text-[11.5px] font-semibold text-[#1e3a5f] hover:underline dark:text-blue-300">Adicionar todas ({sugestoesSetor.length})</button>}
                  </div>
                </>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-auto max-md:max-h-[60vh]">
              {empresa == null ? <p className="p-4 text-[12px] text-gray-400">Escolha um posto.</p>
                : sug.carregando ? <p className="inline-flex items-center gap-2 p-4 text-[12px] text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Lendo estoque e vendas do posto…</p>
                : buscaProd.trim() ? (
                  resultados.length === 0 ? <p className="p-4 text-[12px] text-gray-400">Nenhum produto com esses termos neste posto.</p> : (
                    <table className="w-full">
                      <Cabecalho />
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">{resultados.map((s) => <LinhaProduto key={s.produtoCodigo} s={s} comStatus />)}</tbody>
                      {resultados.length === 30 && <tbody><tr><td colSpan={6} className="px-3 py-2 text-[11px] text-gray-400">Mostrando os primeiros 30. Use mais termos para afinar.</td></tr></tbody>}
                    </table>
                  )
                )
                : sugestoesSetor.length === 0 ? <p className="m-3 rounded-lg border border-dashed border-gray-200 px-4 py-4 text-center text-[12px] text-gray-500 dark:border-gray-700">{gruposSel != null && nGruposMarcados === 0 ? 'Nenhum grupo marcado. Marque um grupo ou use "Marcar todos".' : daCategoria.length > 0 ? 'Nada com esses filtros. Troque o grupo ou o status.' : recorteAtivo ? <>Nenhum produto deste fornecedor está abaixo da cobertura de {cobertura} dias. <button type="button" onClick={() => setSoFornecedor(false)} className="font-semibold text-[#1e3a5f] hover:underline dark:text-blue-300">Ver todos os produtos do posto</button></> : `Nada abaixo da cobertura de ${cobertura} dias nesta categoria. Use a busca do catálogo se precisar.`}</p>
                : (
                  <table className="w-full">
                    <Cabecalho />
                    {grupos.map((g) => (
                      <tbody key={g.st} className="divide-y divide-gray-100 dark:divide-gray-800">
                        <tr className="bg-gray-50/70 dark:bg-gray-800/30"><td colSpan={6} className="px-3 py-1.5"><span className={cn('inline-flex rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ring-1', STATUS_SUG[g.st].cls)}>{STATUS_SUG[g.st].label}</span><span className="ml-2 text-[11px] text-gray-500">{g.lista.length} {g.lista.length === 1 ? 'produto' : 'produtos'}</span></td></tr>
                        {g.lista.map((s) => <LinhaProduto key={s.produtoCodigo} s={s} />)}
                      </tbody>
                    ))}
                  </table>
                )}
            </div>
          </section>

          {/* ── Direita: o pedido ── */}
          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#1e3a5f]/25 bg-[#1e3a5f]/[0.02] dark:border-blue-400/25 dark:bg-blue-400/[0.03]">
            <header className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5 dark:border-gray-800">
              <Package className="h-4 w-4 text-[#1e3a5f] dark:text-blue-300" />
              <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Pedido <span className="font-normal text-gray-400">({itens.length} {itens.length === 1 ? 'item' : 'itens'})</span></p>
              {vaiSeparar && <span className="ml-auto rounded-full bg-blue-50 px-2 py-0.5 text-[10.5px] font-semibold text-[#2563eb] dark:bg-blue-950/30 dark:text-blue-300">vira {nPedidos} pedidos</span>}
            </header>
            <div className="min-h-0 flex-1 overflow-auto max-md:max-h-[50vh]">
              {itens.length === 0 ? (
                <p className="px-4 py-8 text-center text-[12px] text-gray-400">Nada no pedido ainda.<br />Clique no <Plus className="inline h-3 w-3" /> de um produto ao lado.</p>
              ) : blocosPedido.map((b, idx) => (
                <div key={b.titulo ?? idx}>
                  {b.titulo && (
                    <p className="flex items-center gap-1.5 border-b border-gray-100 bg-white/60 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:bg-black/30 dark:text-gray-400">
                      <Truck className="h-3 w-3" /><span className="min-w-0 flex-1 truncate">{b.titulo}</span><span className="tabular-nums normal-case tracking-normal">{formatCurrency(subtotalBloco(b.itens))}</span>
                    </p>
                  )}
                  <ul className="divide-y divide-gray-100 dark:divide-gray-800">{b.itens.map((i) => <ItemPedido key={i.key} i={i} />)}</ul>
                </div>
              ))}
            </div>
            <div className="space-y-2.5 border-t border-gray-200 p-3 dark:border-gray-700">
              {!pedido && deOutros.length > 0 && (
                <label className="flex cursor-pointer items-start gap-2 text-[11.5px] text-gray-700 dark:text-gray-200">
                  <input type="checkbox" checked={separar} onChange={(e) => setSeparar(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-[#1e3a5f]" />
                  <span>Separar um pedido por fornecedor{!separar && <span className="block text-[10.5px] text-gray-500 dark:text-gray-400">Tudo vai num pedido só para {fornecedor?.nome}.</span>}</span>
                </label>
              )}
              {teto > 0 && (
                <div>
                  <p className={cn('text-[10.5px]', estoura ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-gray-500 dark:text-gray-400')}>Teto do mês ({SETOR_LABEL[setor].toLowerCase()}): {formatCurrencyInt(teto)} · já liberado {formatCurrencyInt(usadoMes)} · com este, {formatCurrencyInt(usadoMes + total)}{estoura ? ' (passa do teto: quem libera vai ver)' : ''}</p>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className={cn('h-full rounded-full', estoura ? 'bg-amber-500' : 'bg-[#1e3a5f] dark:bg-blue-500')} style={{ width: `${Math.min(100, ((usadoMes + total) / teto) * 100)}%` }} /></div>
                </div>
              )}
              <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} aria-label="Observações" placeholder="Observações: prazo, pagamento, recado para quem libera…" className={cn(inputCls, 'resize-none text-[12px]')} />
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] text-gray-500 dark:text-gray-400">Total</span>
                <span className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">{formatCurrency(total)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => salvar(false)} disabled={!podeSalvar || !!salvando} className={cn(btnGhost, 'justify-center')}>{salvando === 'rascunho' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {vaiSeparar ? `${nPedidos} rascunhos` : 'Rascunho'}</button>
                <button type="button" onClick={() => salvar(true)} disabled={!podeSalvar || !!salvando} className={cn(btnPrimary, 'justify-center')}>{salvando === 'enviar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {vaiSeparar ? `Enviar ${nPedidos}` : 'Enviar'}</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Modal>
  )
}

export default NovoPedidoModal
