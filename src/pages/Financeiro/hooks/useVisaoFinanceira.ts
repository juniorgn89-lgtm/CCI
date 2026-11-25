import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { fetchContas, fetchMovimentosConta, fetchTitulosPagar } from '@/api/endpoints/financeiro'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import useScopedEmpresaCodes from '@/pages/Financeiro/hooks/useScopedEmpresaCodes'
import useContasResumo from '@/pages/Dashboard/hooks/useContasResumo'
import type { Conta, MovimentoConta, TituloPagar } from '@/api/types/financeiro'

/*
 * Visão Financeira (aba do Financeiro, no modelo do Atlas): tudo LEITURA do ERP.
 *  - Saldo em contas: /CONTA (saldo ATUAL de cada conta, como está no sistema).
 *  - Fluxo de caixa semanal: 6 semanas realizadas (/MOVIMENTO_CONTA, sem as
 *    transferências internas entre contas) + 6 projetadas (títulos em aberto a
 *    receber/pagar pelo vencimento). Saldo da linha = estimado a partir do saldo de hoje.
 *  - Saídas do mês: títulos pagos no mês por centro de custo (/TITULO_PAGAR).
 */

const SEMANAS = 6
// Movimento que só troca dinheiro de conta (não entra nem sai da empresa).
const INTERNOS = new Set(['TRANSFERENCIA', 'TRANSFERENCIA_SANGRIA', 'CAIXA'])

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const segundaDe = (d: Date) => { const x = new Date(d); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); x.setHours(0, 0, 0, 0); return x }
const somaDias = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

export interface ContaSaldo { chave: string; nome: string; posto: string; saldo: number }
export interface SemanaFluxo { inicio: string; rotulo: string; entradas: number; saidas: number; saldo: number | null; projetada: boolean; atual: boolean }

/** Nome curto e posto a partir de "SANTANDER - POSTO ITAPOA". */
const separarNome = (descricao: string) => {
  const [a, ...b] = descricao.split(' - ')
  return { nome: a.trim(), posto: b.join(' - ').trim() }
}

const useVisaoFinanceira = () => {
  const escopo = useScopedEmpresaCodes()
  const resumo = useContasResumo()
  const noEscopo = (emp: number) => escopo.length === 0 || escopo.includes(emp)

  // ── Contas (/CONTA) ─────────────────────────────────────────────────────────
  const contasQ = useQuery({
    queryKey: ['contas', 'rede'],
    queryFn: () => fetchAllPages((p) => fetchContas({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 20),
    staleTime: 5 * 60_000,
  })
  const contas = useMemo((): ContaSaldo[] => {
    // A mesma conta vem cadastrada em vários postos: conta uma vez só (por contaCodigo).
    const vistas = new Map<string, ContaSaldo>()
    for (const c of (contasQ.data ?? []) as Conta[]) {
      if (!c.ativo || !noEscopo(c.empresaCodigo)) continue
      if (Math.abs(c.saldoAtual ?? 0) < 0.005) continue
      const chave = String(c.contaCodigo ?? c.descricao)
      if (vistas.has(chave)) continue
      const { nome, posto } = separarNome(c.descricao ?? `Conta ${chave}`)
      vistas.set(chave, { chave, nome, posto, saldo: c.saldoAtual })
    }
    return [...vistas.values()].sort((a, b) => b.saldo - a.saldo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contasQ.data, escopo.join(',')])
  const saldoContas = contas.reduce((s, c) => s + c.saldo, 0)

  // ── Semanas ─────────────────────────────────────────────────────────────────
  const hoje = new Date()
  const segAtual = segundaDe(hoje)
  const semanas = useMemo(() => {
    const out: { inicio: Date; fim: Date }[] = []
    for (let i = -(SEMANAS - 1); i <= SEMANAS; i++) { const ini = somaDias(segAtual, i * 7); out.push({ inicio: ini, fim: somaDias(ini, 6) }) }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso(segAtual)])

  // Realizado: uma busca por semana (a semana inteira cabe em poucas páginas).
  const passadas = semanas.slice(0, SEMANAS)
  const movQs = useQueries({
    queries: passadas.map((s) => ({
      queryKey: ['movimentosConta', 'semana', iso(s.inicio)],
      queryFn: () => fetchAllPages((p) => fetchMovimentosConta({ dataInicial: iso(s.inicio), dataFinal: iso(s.fim > hoje ? hoje : s.fim), ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 15),
      staleTime: 10 * 60_000,
    })),
  })

  const fluxo = useMemo((): SemanaFluxo[] => {
    const real = passadas.map((_s, i) => {
      let ent = 0, sai = 0
      for (const m of (movQs[i]?.data ?? []) as MovimentoConta[]) {
        if (!noEscopo(m.empresaCodigo) || INTERNOS.has(m.tipoDocumentoOrigem)) continue
        if (m.tipo === 'Crédito') ent += m.valor; else sai += m.valor
      }
      return { ent, sai }
    })
    // Projetado: títulos em aberto que vencem na semana (vencidos ficam fora: não têm data certa).
    const futuras = semanas.slice(SEMANAS)
    const proj = futuras.map((s) => {
      const a = iso(s.inicio), b = iso(s.fim)
      const ent = resumo.itens.receber.filter((t) => t.venc >= a && t.venc <= b && t.horizonte !== 'vencidas').reduce((acc, t) => acc + t.valor, 0)
      const sai = resumo.itens.pagar.filter((t) => t.venc >= a && t.venc <= b && t.horizonte !== 'vencidas').reduce((acc, t) => acc + t.valor, 0)
      return { ent, sai }
    })
    // Saldo estimado: parte do saldo de hoje e volta/avança semana a semana.
    const saldos: number[] = new Array(semanas.length).fill(0)
    saldos[SEMANAS - 1] = saldoContas
    for (let i = SEMANAS - 2; i >= 0; i--) saldos[i] = saldos[i + 1] - (real[i + 1].ent - real[i + 1].sai)
    for (let j = 0; j < proj.length; j++) saldos[SEMANAS + j] = (j === 0 ? saldoContas : saldos[SEMANAS + j - 1]) + proj[j].ent - proj[j].sai
    return semanas.map((s, i) => {
      const r = i < SEMANAS ? real[i] : proj[i - SEMANAS]
      return {
        inicio: iso(s.inicio),
        rotulo: `${pad(s.inicio.getDate())}/${pad(s.inicio.getMonth() + 1)}`,
        entradas: r.ent,
        saidas: r.sai,
        saldo: contas.length ? saldos[i] : null,
        projetada: i >= SEMANAS,
        atual: i === SEMANAS - 1,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movQs.map((q) => q.dataUpdatedAt).join(','), resumo.itens, saldoContas, contas.length, escopo.join(',')])

  // ── Saídas do mês por centro de custo (títulos pagos) ───────────────────────
  const mesIni = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-01`
  const pagosQ = useQuery({
    queryKey: ['titulosPagar', 'pagos-mes', mesIni, iso(hoje)],
    queryFn: () => fetchAllPages((p) => fetchTitulosPagar({ dataFiltro: 'PAGAMENTO', dataInicial: mesIni, dataFinal: iso(hoje), ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 10),
    staleTime: 10 * 60_000,
  })
  const saidasMes = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of (pagosQ.data ?? []) as TituloPagar[]) {
      if (!noEscopo(t.empresaCodigo) || !(t.valorPago > 0)) continue
      const k = t.centroCustoDescricao?.trim() || t.planoContaGerencialDescricao?.trim() || 'Sem centro de custo'
      m.set(k, (m.get(k) ?? 0) + t.valorPago)
    }
    return [...m.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagosQ.data, escopo.join(',')])

  const receber30 = resumo.receber.buckets.vencidas.total + resumo.receber.buckets.hoje.total + resumo.receber.buckets.d7.total + resumo.receber.buckets.d30.total
  const pagar30 = resumo.pagar.buckets.vencidas.total + resumo.pagar.buckets.hoje.total + resumo.pagar.buckets.d7.total + resumo.pagar.buckets.d30.total
  const cartoesReceber = resumo.receber.categorias.filter((c) => c.id === 'cartoes' || c.id === 'apps').reduce((s, c) => s + c.total, 0)
  // Vencem nesta semana (hoje até domingo).
  const domingo = iso(somaDias(segAtual, 6))
  const pagarSemana = resumo.itens.pagar.filter((t) => t.venc >= iso(hoje) && t.venc <= domingo)

  return {
    resumo,
    contas,
    saldoContas,
    contasCarregando: contasQ.isLoading,
    fluxo,
    fluxoCarregando: movQs.some((q) => q.isLoading) || resumo.carregando.receber || resumo.carregando.pagar,
    saidasMes,
    saidasCarregando: pagosQ.isLoading,
    receber30,
    pagar30,
    pctCartoes: receber30 > 0 ? (cartoesReceber / receber30) * 100 : 0,
    pagarSemanaQtd: pagarSemana.length,
    pagarVencidoQtd: resumo.pagar.buckets.vencidas.count,
  }
}

export default useVisaoFinanceira
