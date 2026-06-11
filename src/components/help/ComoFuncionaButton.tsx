import { useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { HelpCircle, Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'

/**
 * Botão "Como funciona?" + modal explicativo por tela E POR ABA. A ideia é
 * apresentar a tela usando DADOS INVENTADOS (exemplos fictícios), pra servir de
 * print/guia sem expor números reais do cliente.
 *
 * O conteúdo é indexado por rota + aba ativa (lida do `?tab=`). Trocou de aba →
 * o "Como funciona?" troca junto. Rotas/abas sem conteúdo cadastrado não
 * mostram o botão.
 *
 * Teste inicial: só a Central da Rede (/dashboard) e suas 3 abas. Depois as demais.
 */

interface HelpSection {
  /** Número da etapa (badge). */
  n: number
  title: string
  /** Linha de exemplo com dados FICTÍCIOS (não usar números reais). */
  exemplo: string
  /** Frase curta de "como ler" esse bloco. */
  comoLer: string
}

interface HelpContent {
  tela: string
  intro: string
  sections: HelpSection[]
}

interface RouteHelp {
  /** Aba assumida quando não há `?tab=` na URL. */
  defaultTab: string
  /** Conteúdo por aba (chave = valor do `?tab=`). */
  tabs: Record<string, HelpContent>
}

// Registry por rota → aba. Acrescentar uma entrada habilita o botão naquela
// rota/aba. As chaves de aba batem com os valores de `?tab=` da tela.
const HELP_CONTENT: Record<string, RouteHelp> = {
  '/dashboard': {
    defaultTab: 'setor',
    tabs: {
      // Aba "Visão Geral" (?tab ausente → 'setor')
      setor: {
        tela: 'Central da Rede · Visão Geral',
        intro: 'Visão consolidada de TODOS os postos no período filtrado. Os números abaixo são exemplos fictícios, só pra ilustrar como ler cada bloco.',
        sections: [
          {
            n: 1,
            title: 'Filtros do topo',
            exemplo: 'Junho · 01/06 a 30/06 · Completo · vs mês ant.',
            comoLer: 'Período, escopo (Completo = apurado + dia de hoje ao vivo) e comparativo (vs mês ou ano anterior). Tudo na tela reage a esses filtros.',
          },
          {
            n: 2,
            title: 'Cards por setor',
            exemplo: 'Combustível R$ 180.000 · margem 12% · Conveniência R$ 64.000 · margem 49%',
            comoLer: 'Lucro bruto, faturamento e margem de cada setor (Combustível, Automotivos, Conveniência) e o Global da rede.',
          },
          {
            n: 3,
            title: 'Projeção — fim do mês',
            exemplo: 'Faturamento projetado R$ 4.500.000 · lucro R$ 720.000',
            comoLer: 'Estima o fechamento do mês pelo ritmo dos dias já apurados (linear por dias decorridos).',
          },
          {
            n: 4,
            title: 'Detalhamento por setor',
            exemplo: 'Posto Exemplo · 60.000 L · margem 12% · −5% vs período ant.',
            comoLer: 'Cada posto em 4 grupos — Operação, Financeiro, Comparativo (vs período anterior) e Eficiência. Clique no posto pra abrir grupos e produtos.',
          },
        ],
      },
      // Aba "Ao Vivo Rede"
      aovivo: {
        tela: 'Central da Rede · Ao Vivo Rede',
        intro: 'Acompanhamento dos caixas ABERTOS agora, posto a posto, em tempo real. Os números abaixo são fictícios.',
        sections: [
          {
            n: 1,
            title: 'Cards por setor',
            exemplo: 'Global R$ 368.464 · margem 15%',
            comoLer: 'Mesma leitura da Visão Geral — lucro, faturamento e margem do período por setor.',
          },
          {
            n: 2,
            title: 'Resumo "Ao vivo na rede"',
            exemplo: '9 caixas abertos em 5 postos',
            comoLer: 'Quantos caixas estão abertos neste momento e em quantos postos. Atualiza sozinho conforme os turnos abrem/fecham.',
          },
          {
            n: 3,
            title: 'Card de posto ao vivo',
            exemplo: 'Posto Exemplo · 2 caixas abertos · R$ 18.000 PARCIAL',
            comoLer: 'Faturamento PARCIAL do dia em curso, com os turnos abertos e o frentista de cada um. Clique pra ver o detalhe do turno.',
          },
        ],
      },
      // Aba "Reabastecimento"
      reabastecimento: {
        tela: 'Central da Rede · Reabastecimento',
        intro: 'Nível dos tanques de combustível e quanto comprar até o fim do mês. Os valores abaixo são fictícios.',
        sections: [
          {
            n: 1,
            title: 'Nível do tanque',
            exemplo: 'Tanque Exemplo · 13% · 1.900 L de 15.000 L',
            comoLer: 'Quanto resta no tanque (% e litros). A cor indica a criticidade: vermelho = crítico, âmbar = alerta, verde = ok.',
          },
          {
            n: 2,
            title: 'Última compra',
            exemplo: 'Última compra: 2.000 L em 08/06 · R$ 11.000',
            comoLer: 'Volume, data e valor estimado da última entrada de combustível (nota fiscal) daquele tanque.',
          },
          {
            n: 3,
            title: 'Comprar até fim do mês',
            exemplo: 'Comprar 3.300 L · (estoque atual cobre ~6 dias)',
            comoLer: 'Sugestão de compra até o fim do mês (consumo médio × dias restantes − estoque), e por quantos dias o estoque atual ainda cobre.',
          },
        ],
      },
    },
  },
}

const ComoFuncionaButton = () => {
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const routeHelp = HELP_CONTENT[pathname]
  const tabKey = searchParams.get('tab') ?? routeHelp?.defaultTab ?? ''
  const content = routeHelp?.tabs[tabKey]
  if (!content) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Como funciona esta tela"
        title="Como funciona esta tela"
        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 transition-colors hover:bg-blue-100 hover:border-blue-300 dark:border-blue-800/50 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Como funciona?</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
          {/* Cabeçalho */}
          <div className="flex items-start gap-3 border-b border-gray-100 px-6 pb-4 pt-6 dark:border-gray-800">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 shadow-sm">
              <Sparkles className="h-5 w-5 text-white" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold text-gray-900 dark:text-gray-100">
                Como funciona: {content.tela}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {content.intro}
              </DialogDescription>
            </div>
          </div>

          {/* Seções */}
          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
            {content.sections.map((s) => (
              <div key={s.n} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1e3a5f] text-[11px] font-bold text-white">
                  {s.n}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{s.title}</p>
                  <p className="mt-1 rounded-md bg-gray-50 px-2.5 py-1.5 font-mono text-[11px] tabular-nums text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
                    {s.exemplo}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{s.comoLer}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Rodapé */}
          <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-800">
            <span className="text-[10px] text-gray-400 dark:text-gray-500">Valores ilustrativos — não refletem dados reais.</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:bg-[#1e3a5f]/90 active:scale-95"
            >
              Entendi
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default ComoFuncionaButton
