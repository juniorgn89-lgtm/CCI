import type { ComponentType, ReactNode } from 'react'
import {
  CreditCard, LayoutDashboard, Eye, HandCoins, Calculator, Filter, ListChecks,
  ShieldCheck, CalendarClock, AlertTriangle, Droplets, Wrench, Store, Tag, Radio, Layers,
  TrendingUp, Gauge, Sparkles, BarChart3, Trophy, Building2, Radar, Wallet, Warehouse,
  Users, SearchCheck, Brain,
  type LucideIcon,
} from 'lucide-react'
import {
  IlRede, IlProjecao, IlConfianca, IlFiscal,
  IlDinheiro, IlLista, IlRanking, IlCalendario, IlCombustivel, IlAutomotivo,
  IlConveniencia, IlPreco, IlCartao, IlTitulos, IlEstoque, IlGiro, IlBarras,
  IlPessoas, IlIA, IlCompliance, IlRadar, IlConcorrencia, IlBomba, IlCaminhao,
  IlAoVivo, IlDetetive,
} from '@/components/potencial/ilustracoes'

/**
 * Registro ÚNICO por rota do "chrome" de módulo: identidade (ícone + nome +
 * subtítulo, exibidos no Header) e o conteúdo do modal "Potencial desta tela"
 * por aba (`?tab=`; '' = aba default). Cobrir uma tela = adicionar uma entrada
 * aqui — nada de editar layout página por página.
 */

/* ─── Helpers de conteúdo do modal ─── */

const Secao = ({ icon: Icon, titulo, children }: { icon: LucideIcon; titulo: string; children: ReactNode }) => (
  <div className="flex gap-3">
    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[#1e3a5f] dark:bg-gray-800 dark:text-gray-300">
      <Icon className="h-4 w-4" />
    </span>
    <div>
      <p className="font-semibold text-gray-900 dark:text-gray-100">{titulo}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  </div>
)

const NotaHonesta = ({ children }: { children: ReactNode }) => (
  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
    <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-amber-800 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <span>{children}</span>
    </p>
  </div>
)

/* ─── Tipos ─── */

/** Slide do carrossel de "Potencial" (quando a tela opta pelo formato paginado
 * ilustrado em vez do `body` rolável). */
export interface PotencialSlide {
  /** Ilustração flat 2-tons (SVG inline theme-aware). */
  Ilustracao: ComponentType<{ className?: string }>
  /** Etiqueta curta acima do título ("O que ela faz", "Projeção"…). */
  tag: string
  titulo: string
  texto: ReactNode
  /** 'nota' pinta o slide como aviso honesto (âmbar). */
  tom?: 'normal' | 'nota'
}

export interface PotencialConteudo {
  title: string
  description: string
  /** Conteúdo rolável clássico (fallback das telas ainda não migradas). */
  body: ReactNode
  /** Quando presente, o botão renderiza o CARROSSEL paginado em vez do `body`. */
  slides?: PotencialSlide[]
}

export interface ModuleMeta {
  Icon: LucideIcon
  nome: string
  subtitle: string
  /** Conteúdo do "Potencial" por aba (`?tab=`); '' = aba default. */
  potencial: Record<string, PotencialConteudo>
}

/* ─── Registro ─── */

export const REGISTRY: Record<string, ModuleMeta> = {
  '/cartoes': {
    Icon: CreditCard,
    nome: 'Cartões · Conciliação',
    subtitle: 'sistema × repasse do adquirente',
    potencial: {
      '': {
        title: 'Resultado — o potencial desta tela',
        description: 'Em segundos, se todo o dinheiro de cartão do período caiu — sem cruzar planilha.',
        slides: [
          { Ilustracao: IlCartao, tag: 'O que ela faz', titulo: 'Todo cartão do período, conferido sozinho', texto: (<>Cruza, por <strong>posto × bandeira × dia</strong>, o recebível do sistema com o repasse real do adquirente (EDI). Cada lote vira <strong>Conciliado</strong>, <strong>A creditar</strong>, <strong>Sem repasse</strong> ou <strong>Aguardando</strong>.</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'Horas de conferência viram segundos', texto: (<>O card mostra <strong>% conciliável</strong> e a <strong>cobertura do EDI</strong>. O que não bateu já sai como lista de ação no Detalhamento — sem planilha.</>) },
          { Ilustracao: IlConfianca, tag: 'Vinculado × Conciliado', titulo: 'Casou não é o mesmo que caiu', texto: (<><strong>Vinculado</strong> = o repasse casou; <strong>conciliado</strong> = casou <em>e</em> o dia do crédito já passou. Enquanto o crédito é futuro, fica “a creditar”.</>) },
          { Ilustracao: IlFiscal, tom: 'nota', tag: 'De onde vêm os números', titulo: 'Conciliação por valor, não transação', texto: (<>É Σ sistema × Σ repasse por bandeira/dia. Centavo de diferença aparece como <strong>“valor divergente”</strong> — ela não inventa divergência onde o dinheiro fecha.</>) },
        ],
        body: (
          <>
            <Secao icon={Eye} titulo="O que ela faz">
              Cruza, por <strong>posto × bandeira × dia de liquidação</strong>, o recebível do sistema com o repasse real do adquirente (EDI). Classifica cada lote: <strong>Conciliado</strong>, <strong>A creditar</strong> (casou, crédito ainda futuro), <strong>Sem repasse</strong> (precisa lançamento) e <strong>Aguardando</strong> (EDI ainda não chegou).
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Substitui horas de conferência manual: o card mostra <strong>% conciliável</strong> e a <strong>cobertura do EDI</strong>. O que não bateu já vira lista de ação no Detalhamento.
            </Secao>
            <Secao icon={ShieldCheck} titulo="Vinculado × Conciliado">
              Espelha o WebPosto: <strong>vinculado</strong> = o repasse casou; <strong>conciliado</strong> (nosso) = casou <em>e</em> o bom-para (dia do crédito) já passou. Enquanto o crédito é futuro, fica “a creditar”.
            </Secao>
            <NotaHonesta>
              A conciliação é por <strong>valor</strong> (Σ sistema × Σ repasse por bandeira/dia). Diferença de centavos aparece como <strong>“valor divergente”</strong>; ela não inventa divergência onde o dinheiro fecha.
            </NotaHonesta>
          </>
        ),
      },
      detalhamento: {
        title: 'Detalhamento — o potencial desta tela',
        description: 'A lista acionável: o que precisa de lançamento e o que divergiu, com responsável.',
        slides: [
          { Ilustracao: IlLista, tag: 'O que ela faz', titulo: 'O vermelho vira tarefa', texto: (<>Abre cada venda <strong>sem repasse</strong> (quem, quanto, qual venda, qual vendedor) e cada <strong>divergência de lote</strong> (bandeira/dia com valor diferente).</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: '“Faltou dinheiro” vira ação', texto: (<>Dá pra lançar o recebível certo ou cobrar o adquirente <strong>com o número na mão</strong>, sem caçar em planilha.</>) },
          { Ilustracao: IlConfianca, tag: 'Marcar como tratado', titulo: 'Resolveu, some da lista', texto: (<>Registra quem resolveu e quando, <strong>sem alterar valor</strong>. Se o repasse chegar depois, o automático prevalece e marca “repasse chegou depois”.</>) },
          { Ilustracao: IlFiscal, tom: 'nota', tag: 'Controle interno', titulo: 'Nada é escrito na Quality', texto: (<>O “tratado” fica só no Visor360, como controle da sua equipe — <strong>não toca</strong> no WebPosto.</>) },
        ],
        body: (
          <>
            <Secao icon={ListChecks} titulo="O que ela faz">
              Abre o vermelho do Resultado em tarefas: cada venda <strong>sem repasse</strong> (quem, quanto, qual venda, qual vendedor) e cada <strong>divergência de lote</strong> (bandeira/dia com valor diferente).
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Transforma “faltou dinheiro” em ação concreta — dá pra lançar o recebível certo ou cobrar o adquirente com o número na mão, sem caçar em planilha.
            </Secao>
            <Secao icon={ShieldCheck} titulo="Marcar como tratado">
              Registra que você já resolveu (com quem e quando) e some das pendências — <strong>sem alterar nenhum valor</strong>. Se o repasse chegar depois, o automático prevalece e marca “repasse chegou depois”.
            </Secao>
            <NotaHonesta>
              Nada é escrito na Quality/WebPosto — o “tratado” fica só no Visor360, como controle interno da sua equipe.
            </NotaHonesta>
          </>
        ),
      },
      taxas: {
        title: 'Detector de taxa — o potencial desta tela',
        description: 'Por que esta tela existe, o que ela encontra e como transformar isso em dinheiro de volta no caixa.',
        slides: [
          { Ilustracao: IlPreco, tag: 'O que ela faz', titulo: 'A taxa que passou do contrato', texto: (<>Compara, por bandeira, a taxa que o adquirente <strong>realmente descontou</strong> (EDI) com a do seu <strong>contrato</strong>. Onde a efetiva passa, mostra em <span className="font-semibold text-red-600 dark:text-red-400">R$</span> quanto você pagou a mais.</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'Centavo em cima de milhões vira milhares', texto: (<>Num único posto, num mês, este cruzamento já apontou <strong>~R$ 900 a mais só no crédito</strong>. Numa rede, no ano, é uma renegociação embasada em número.</>) },
          { Ilustracao: IlLista, tag: 'Como usar', titulo: 'Do que mais sangra pro que menos', texto: (<>Filtre por <strong>Débito</strong> (Δ definitivo) ou ligue <strong>“Só acima do contrato”</strong>. Ordena da maior sobrecobrança pra menor — o topo é onde está o dinheiro.</>) },
          { Ilustracao: IlFiscal, tom: 'nota', tag: 'Antes de acionar', titulo: 'No crédito, confirme o motivo', texto: (<>Um Δ positivo no crédito pode ser antecipação/parcelamento (taxa naturalmente maior). No <strong>débito</strong>, o Δ é praticamente à prova de dúvida.</>) },
        ],
        body: (
          <>
            <Secao icon={Eye} titulo="O que ela faz">
              Compara, por bandeira, a <strong>taxa que o adquirente realmente descontou</strong> (o repasse do EDI) com a <strong>taxa do seu contrato</strong> (cadastro do posto). Onde a efetiva passa do contrato, mostra em <span className="font-semibold text-red-600 dark:text-red-400">R$</span> exatamente quanto você pagou a mais.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa (o potencial)">
              Adquirente cobra em <em>centavos por transação</em> — e centavo em cima de milhões repassados vira <strong>milhares por mês</strong>. Num único posto, num mês, este cruzamento já apontou <strong className="text-gray-900 dark:text-gray-100">~R$ 900 a mais só no crédito</strong>. Numa rede, no ano, é uma renegociação inteira embasada em número.
            </Secao>
            <Secao icon={Calculator} titulo="Como é calculado">
              <span className="block">• <strong>Efetiva</strong> = Σ despesas do repasse ÷ Σ bruto repassado (vem do EDI, é o real).</span>
              <span className="block">• <strong>Contrato</strong> = percentual de comissão do cadastro + tarifa fixa por transação.</span>
              <span className="block">• <strong>Δ</strong> = o que foi pago − o que o contrato previa. Tudo read-only.</span>
            </Secao>
            <Secao icon={Filter} titulo="Como usar">
              Filtre por <strong>Débito</strong> (onde o Δ é definitivo) ou ligue <strong>“Só acima do contrato”</strong> pra ver direto o que sangra. Ordena da maior sobrecobrança pra menor — o topo é onde está o dinheiro.
            </Secao>
            <NotaHonesta>
              No <strong>crédito</strong>, um Δ positivo pode ser antecipação/parcelamento (taxa naturalmente maior) — confirme no extrato da bandeira antes de acionar o adquirente. No <strong>débito</strong>, o Δ é praticamente à prova de dúvida.
            </NotaHonesta>
          </>
        ),
      },
      parametros: {
        title: 'Parâmetros — o potencial desta tela',
        description: 'A cobertura do EDI por posto — pra você confiar no que é pendência de verdade.',
        slides: [
          { Ilustracao: IlCalendario, tag: 'O que ela faz', titulo: 'O relógio da conciliação', texto: (<>Mostra, por posto, <strong>até que dia</strong> o repasse do adquirente (EDI) já foi carregado.</>) },
          { Ilustracao: IlConfianca, tag: 'Por que importa', titulo: 'Não cobre lançamento à toa', texto: (<>Um dia sem EDI ainda é <em>aguardando</em>, não pendência. Você vê qual posto está atrasado no carregamento <strong>antes</strong> de sair cobrando.</>) },
          { Ilustracao: IlLista, tag: 'Como usar', titulo: 'Do panorama ao posto num clique', texto: (<>Clique num posto pra abrir o <strong>Resultado dele</strong> já filtrado.</>) },
        ],
        body: (
          <>
            <Secao icon={CalendarClock} titulo="O que ela faz">
              Mostra, por posto, até que dia o repasse do adquirente (EDI) já foi carregado. É o “relógio” da conciliação.
            </Secao>
            <Secao icon={ShieldCheck} titulo="Por que importa">
              Evita <strong>falso “sem repasse”</strong>: um dia sem EDI ainda é <em>aguardando</em>, não pendência. Aqui você enxerga qual posto está atrasado no carregamento antes de sair cobrando lançamento à toa.
            </Secao>
            <Secao icon={Filter} titulo="Como usar">
              Clique num posto pra abrir o Resultado dele já filtrado — do panorama da rede pro detalhe do posto em um clique.
            </Secao>
          </>
        ),
      },
    },
  },

  '/dashboard': {
    Icon: LayoutDashboard,
    nome: 'Central da Rede',
    subtitle: 'panorama consolidado dos postos',
    potencial: {
      '': {
        title: 'Visão Geral',
        description: 'O potencial desta tela',
        slides: [
          {
            Ilustracao: IlRede,
            tag: 'O que ela faz',
            titulo: 'O raio-x da rede num relance',
            texto: (
              <>
                Junta <strong>todos os postos</strong> por setor — Combustível, Automotivos e Conveniência — mostrando faturamento, lucro bruto e margem em um só painel.
              </>
            ),
          },
          {
            Ilustracao: IlProjecao,
            tag: 'Projeção',
            titulo: 'Onde o mês vai fechar',
            texto: (
              <>
                Projeta o <strong>fechamento do mês</strong> pela engine executiva: ritmo recente + sazonalidade de dia-da-semana + tendência. Você reage antes do fim do mês.
              </>
            ),
          },
          {
            Ilustracao: IlConfianca,
            tag: 'Como ler',
            titulo: 'O quanto confiar no número',
            texto: (
              <>
                A <strong>bolinha de confiança</strong> e o <strong>comparativo</strong> (vs mês/ano anterior) dizem o quanto crer na projeção. Cada card de setor abre o detalhe por posto.
              </>
            ),
          },
          {
            Ilustracao: IlFiscal,
            tom: 'nota',
            tag: 'De onde vêm os números',
            titulo: 'Base fiscal, projeção é estimativa',
            texto: (
              <>
                Os valores vêm do <strong>cache de apuração</strong> (base fiscal carimbada). A projeção é uma estimativa pelo ritmo — <strong>não</strong> o valor fechado do mês.
              </>
            ),
          },
        ],
        body: (
          <>
            <Secao icon={Layers} titulo="O que ela faz">
              Consolida <strong>todos os postos</strong> por setor (Combustível, Automotivos, Conveniência) — faturamento, lucro bruto e margem — e projeta o <strong>fechamento do mês</strong> com a engine executiva (média recente + sazonalidade + tendência).
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              É o painel do dono: em um relance você sabe se a rede está no ritmo da meta, qual setor puxa e qual segura, e quanto deve fechar — sem abrir posto por posto.
            </Secao>
            <Secao icon={ShieldCheck} titulo="Como ler">
              A bolinha de <strong>confiança</strong> e o <strong>comparativo</strong> (vs mês/ano anterior) dizem o quanto confiar na projeção. Cada card de setor abre o detalhe por posto.
            </Secao>
            <NotaHonesta>
              Os números vêm do cache de apuração (base fiscal carimbada). Projeção é estimativa pelo ritmo recente — não é o valor fechado.
            </NotaHonesta>
          </>
        ),
      },
      combustivel: {
        title: 'Combustível — o potencial desta tela',
        description: 'A venda de combustível da rede em base fiscal, com projeção e L.B. por litro.',
        slides: [
          { Ilustracao: IlCombustivel, tag: 'O que ela faz', titulo: 'Litro, faturamento e L.B. por litro', texto: (<>Litros, faturamento, lucro bruto e <strong>L.B. por litro</strong> em base fiscal (bate com o “litros vendidos”), com análise por dia e por combustível.</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'Volume alto, margem fina', texto: (<>É onde se <strong>defende (ou se perde)</strong> o mês: enxergar o L.B./litro e a tendência semanal antes que a margem escorra.</>) },
          { Ilustracao: IlProjecao, tag: 'Como usar', titulo: 'Onde fecha e o ritmo pra manter', texto: (<>Use a <strong>projeção executiva</strong> pra saber onde o mês fecha e o ritmo necessário — e as abas pra ver o padrão dia útil × fim de semana.</>) },
        ],
        body: (
          <>
            <Secao icon={Droplets} titulo="O que ela faz">
              Litros, faturamento, lucro bruto e <strong>L.B. por litro</strong> do combustível, em base fiscal (bate com o “litros vendidos”), com análise por dia e por combustível.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Combustível é volume alto e margem fina: enxergar o L.B./litro e a tendência semanal é onde se defende (ou se perde) o resultado do mês.
            </Secao>
            <Secao icon={Calculator} titulo="Como usar">
              Use a <strong>projeção executiva</strong> pra saber onde fecha e o <strong>ritmo necessário</strong> pra manter — e as abas de análise pra ver o padrão dia útil × fim de semana.
            </Secao>
          </>
        ),
      },
      pista: {
        title: 'Automotivos — o potencial desta tela',
        description: 'Os produtos de pista/automotivos da rede — margem melhor que a do combustível.',
        slides: [
          { Ilustracao: IlAutomotivo, tag: 'O que ela faz', titulo: 'Óleo, aditivo e filtro por posto', texto: (<>Venda, lucro e margem dos produtos automotivos por posto, com <strong>projeção de fechamento</strong>.</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'Onde cada real vale mais', texto: (<>É o setor de <strong>margem alta</strong>: um real vendido aqui vale muito mais em lucro que no combustível. Ver quem vende bem revela onde treinar a pista.</>) },
        ],
        body: (
          <>
            <Secao icon={Wrench} titulo="O que ela faz">
              Venda, lucro e margem dos produtos automotivos (óleos, aditivos, filtros) por posto, com projeção de fechamento.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              É o setor de <strong>margem alta</strong>: cada real vendido aqui vale muito mais em lucro que no combustível. Ver quem vende bem revela oportunidade de treinar a pista.
            </Secao>
          </>
        ),
      },
      conveniencia: {
        title: 'Conveniência — o potencial desta tela',
        description: 'A loja de conveniência da rede: ticket, mix e margem.',
        slides: [
          { Ilustracao: IlConveniencia, tag: 'O que ela faz', titulo: 'A loja em ticket, mix e margem', texto: (<>Faturamento, margem e <strong>ticket médio</strong> da conveniência por posto, com projeção e o mix de produtos que puxa o resultado.</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'O cliente da pista virando lucro', texto: (<>A conveniência é onde o fluxo do combustível vira <strong>lucro adicional</strong>. Ticket e mix mostram se a loja está aproveitando esse fluxo.</>) },
        ],
        body: (
          <>
            <Secao icon={Store} titulo="O que ela faz">
              Faturamento, margem e ticket médio da conveniência por posto, com projeção e o mix de produtos que puxam o resultado.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              A conveniência é onde o cliente do combustível vira <strong>lucro adicional</strong>. Ticket e mix mostram se a loja está aproveitando o fluxo da pista.
            </Secao>
          </>
        ),
      },
      precos: {
        title: 'Gestão de Preços — o potencial desta tela',
        description: 'Quanto de margem foi cedida na bomba e em acréscimos/descontos — o vazamento invisível.',
        slides: [
          { Ilustracao: IlPreco, tag: 'O que ela faz', titulo: 'A margem cedida na bomba', texto: (<>Cruza o <strong>preço de tabela</strong> com o <strong>praticado na bomba</strong> (o ajuste abaixo = margem cedida) e soma os acréscimos e descontos das vendas.</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'O desconto que some da margem', texto: (<>Desconto na bomba não aparece no faturamento — <strong>some silenciosamente</strong>. Aqui fica visível em R$, por produto e posto: dá pra recuperar ajustando a política.</>) },
          { Ilustracao: IlFiscal, tom: 'nota', tag: 'Cobertura', titulo: 'Número parcial até o cron carimbar', texto: (<>A cobertura mostra quantos abastecimentos têm preço de tabela; os <strong>sem cadastro</strong> ficam de fora. O valor é parcial até o preço ser carimbado no cache.</>) },
        ],
        body: (
          <>
            <Secao icon={Tag} titulo="O que ela faz">
              Cruza o <strong>preço de tabela</strong> com o <strong>praticado na bomba</strong> (o ajuste abaixo da tabela = margem cedida) e soma os acréscimos e descontos das vendas.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Desconto na bomba não aparece no faturamento — some da margem silenciosamente. Aqui ele fica visível em R$, por produto e por posto: é dinheiro que dá pra recuperar ajustando política de preço.
            </Secao>
            <NotaHonesta>
              A cobertura mostra quantos abastecimentos têm preço de tabela — os sem cadastro ficam de fora. O número é parcial até o cron carimbar o preço no cache.
            </NotaHonesta>
          </>
        ),
      },
    },
  },

  '/ao-vivo': {
    Icon: Radio,
    nome: 'Ao Vivo Rede',
    subtitle: 'turnos abertos e faturamento de hoje',
    potencial: {
      '': {
        title: 'Ao Vivo Rede — o potencial desta tela',
        description: 'O agora da rede: turnos abertos e faturamento de hoje, sem esperar o fechamento.',
        slides: [
          { Ilustracao: IlAoVivo, tag: 'O que ela faz', titulo: 'A operação acontecendo agora', texto: (<>Mostra os <strong>turnos abertos</strong> e o faturamento fiscal de hoje, posto a posto — em tempo real.</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'Agir no calor, não no dia seguinte', texto: (<>Pega um turno parado, um posto fora da curva ou um <strong>pico de venda</strong> enquanto ainda dá pra reagir.</>) },
          { Ilustracao: IlFiscal, tom: 'nota', tag: 'Como funciona', titulo: 'É sempre o agora, sem filtro', texto: (<>A tela é <strong>hoje, rede inteira</strong>, e se atualiza sozinha a cada 60s.</>) },
        ],
        body: (
          <>
            <Secao icon={Radio} titulo="O que ela faz">
              Mostra a operação <strong>acontecendo agora</strong> — turnos abertos e o faturamento fiscal de hoje, posto a posto.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Pra agir no calor: identificar um turno parado, um posto fora da curva ou um pico de venda enquanto ainda dá pra reagir — não no relatório do dia seguinte.
            </Secao>
            <NotaHonesta>
              É “ao vivo”: sem filtros — a tela é sempre o agora (hoje, rede inteira) e se atualiza sozinha a cada 60s.
            </NotaHonesta>
          </>
        ),
      },
    },
  },

  '/comercial': {
    Icon: TrendingUp,
    nome: 'Comercial',
    subtitle: 'inteligência de preço, margem e concorrência',
    potencial: {
      '': {
        title: 'Oportunidades — o potencial desta tela',
        description: 'A lista curta do que fazer pra ganhar margem, priorizada por impacto.',
        slides: [
          { Ilustracao: IlIA, tag: 'O que ela faz', titulo: 'O que atacar primeiro, já priorizado', texto: (<>Varre a rede e lista <strong>oportunidades de lucro</strong> — produtos e postos onde ajustar preço ou mix rende mais, ordenadas pelo impacto.</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'Foco no que move o resultado', texto: (<>Em vez de encarar mil números, você recebe <strong>o que atacar primeiro</strong>.</>) },
          { Ilustracao: IlLista, tag: 'Como usar', titulo: 'Comece pelo topo e desça', texto: (<>Cada item explica o porquê e <strong>quanto vale</strong>. Ataque o de maior impacto primeiro.</>) },
        ],
        body: (
          <>
            <Secao icon={Sparkles} titulo="O que ela faz">
              Varre a rede e prioriza <strong>oportunidades de lucro</strong> — produtos e postos onde ajustar preço ou mix rende mais, ordenadas pelo impacto.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Em vez de encarar mil números, você recebe <strong>o que atacar primeiro</strong> — foco no que move o resultado.
            </Secao>
            <Secao icon={Filter} titulo="Como usar">
              Comece pelo topo (maior impacto) e desça. Cada item explica o porquê e quanto vale.
            </Secao>
          </>
        ),
      },
      margem: {
        title: 'Margem por posto — o potencial desta tela',
        description: 'O ranking de lucratividade: quem puxa e quem segura a rede.',
        slides: [
          { Ilustracao: IlRanking, tag: 'O que ela faz', titulo: 'Líder e lanterna num relance', texto: (<>Ordena os postos por <strong>lucratividade</strong> (margem e lucro bruto).</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'Margem deixada na mesa', texto: (<>Revela onde <strong>replicar</strong> o que dá certo e onde agir: um posto abaixo da rede é margem parada.</>) },
        ],
        body: (
          <>
            <Secao icon={Trophy} titulo="O que ela faz">
              Ordena os postos por <strong>lucratividade</strong> (margem e lucro bruto) — líder e lanterna num relance.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Revela onde replicar o que dá certo e onde agir: um posto abaixo da rede é margem deixada na mesa.
            </Secao>
          </>
        ),
      },
      concorrencia: {
        title: 'Concorrência — o potencial desta tela',
        description: 'O preço da praça: onde você está caro ou barato demais.',
        slides: [
          { Ilustracao: IlConcorrencia, tag: 'O que ela faz', titulo: 'Seu preço × o da praça', texto: (<>Reúne a <strong>inteligência de preço da praça</strong> — como seus preços se comparam aos concorrentes, por produto e região.</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'Fora da praça custa caro', texto: (<>Alto demais custa <strong>volume</strong>; baixo demais custa <strong>margem</strong>. Aqui você calibra com dado, não achismo.</>) },
        ],
        body: (
          <>
            <Secao icon={Building2} titulo="O que ela faz">
              Reúne a <strong>inteligência de preço da praça</strong> — como seus preços se comparam aos concorrentes, por produto e região.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Preço fora da praça custa volume (caro demais) ou margem (barato demais). Aqui você calibra com dado, não achismo.
            </Secao>
          </>
        ),
      },
      radar: {
        title: 'Radar de Preços — o potencial desta tela',
        description: 'Guerra de preço com margem, elasticidade e simulação até o fechamento.',
        slides: [
          { Ilustracao: IlRadar, tag: 'O que ela faz', titulo: 'Simula o preço antes de aplicar', texto: (<>Simula movimentos de preço e mostra o efeito em <strong>margem, volume (elasticidade) e resultado</strong> projetado até o fim do mês.</>) },
          { Ilustracao: IlLista, tag: 'Como usar', titulo: 'Veja o trade-off e decida', texto: (<>Teste um corte ou aumento e veja o efeito <strong>antes</strong> de aplicar — decide a guerra de preço com número na mão.</>) },
          { Ilustracao: IlFiscal, tom: 'nota', tag: 'Como ler', titulo: 'Elasticidade é bússola, não garantia', texto: (<>A elasticidade é <strong>estimada pelo histórico</strong> — orienta a decisão, não garante o volume.</>) },
        ],
        body: (
          <>
            <Secao icon={Radar} titulo="O que ela faz">
              Simula movimentos de preço e mostra o efeito em <strong>margem, volume (elasticidade) e resultado</strong> projetado até o fim do mês.
            </Secao>
            <Secao icon={Calculator} titulo="Como usar">
              Teste um corte ou aumento e veja o trade-off antes de aplicar — decide a guerra de preço com número na mão.
            </Secao>
            <NotaHonesta>
              A elasticidade é estimada pelo histórico — bússola de decisão, não garantia de volume.
            </NotaHonesta>
          </>
        ),
      },
    },
  },

  '/operacao': {
    Icon: Gauge,
    nome: 'Operação',
    subtitle: 'bombas e reabastecimento',
    potencial: {
      '': {
        title: 'Bombas — o potencial desta tela',
        description: 'O desempenho das bombas por posto — volume e a manutenção que se paga sozinha.',
        slides: [
          { Ilustracao: IlBomba, tag: 'O que ela faz', titulo: 'Volume por bico e manutenção na hora', texto: (<>Acompanha o <strong>volume por bomba/bico</strong> e sinaliza <strong>manutenção</strong> automaticamente — sem marcação manual.</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'Litro perdido é margem perdida', texto: (<>Bomba fora de calibração é <strong>perda invisível de litro</strong>. Ver o desempenho por bico revela o desgaste antes de virar prejuízo.</>) },
        ],
        body: (
          <>
            <Secao icon={Gauge} titulo="O que ela faz">
              Acompanha o <strong>volume por bomba/bico</strong> e sinaliza <strong>manutenção</strong> automaticamente — sem depender de marcação manual.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Bomba fora de calibração é perda invisível de litro (e de margem). Ver o desempenho por bico revela o desgaste antes de virar prejuízo.
            </Secao>
          </>
        ),
      },
      reabastecimento: {
        title: 'Reabastecimento — o potencial desta tela',
        description: 'Quando e quanto repor por setor, pelo giro e pela cobertura.',
        slides: [
          { Ilustracao: IlCaminhao, tag: 'O que ela faz', titulo: 'O que acaba e o que sobra', texto: (<>Mostra <strong>giro e cobertura</strong> por setor (combustível, automotivos, conveniência) pra orientar a reposição.</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'Sem ruptura nem capital parado', texto: (<>Evita a <strong>venda perdida</strong> (faltou) e o <strong>estoque encalhado</strong> (sobrou) — o equilíbrio que protege caixa e faturamento.</>) },
        ],
        body: (
          <>
            <Secao icon={Droplets} titulo="O que ela faz">
              Mostra <strong>giro e cobertura</strong> por setor (combustível, automotivos, conveniência) pra orientar a reposição — o que está acabando e o que está sobrando.
            </Secao>
            <Secao icon={ShieldCheck} titulo="Por que importa">
              Evita ruptura (venda perdida) e capital parado (estoque encalhado) — o equilíbrio que protege caixa e faturamento.
            </Secao>
          </>
        ),
      },
    },
  },

  '/financeiro': {
    Icon: Wallet,
    nome: 'Financeiro',
    subtitle: 'títulos a receber e a pagar',
    potencial: {
      '': {
        title: 'Visão Geral — o potencial desta tela',
        description: 'O dinheiro que já era pra ter entrado ou saído: os títulos em atraso.',
        slides: [
          { Ilustracao: IlTitulos, tag: 'O que ela faz', titulo: 'O que venceu, dos dois lados', texto: (<>Reúne os <strong>títulos a receber e a pagar em atraso</strong> — o que venceu e ainda não foi liquidado.</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'Caixa imediato', texto: (<>Cobrar um recebível vencido e quitar um pagável <strong>antes do juro</strong> são as ações de maior retorno no financeiro.</>) },
          { Ilustracao: IlFiscal, tom: 'nota', tag: 'De onde vêm os números', titulo: 'O foco aqui é o atraso', texto: (<>A integração expõe títulos e movimento de conta por GET; <strong>cartão a vencer, PREMMIA e cheque</strong> não vêm pela API.</>) },
        ],
        body: (
          <>
            <Secao icon={Eye} titulo="O que ela faz">
              Reúne os <strong>títulos a receber e a pagar em atraso</strong> — o que venceu e ainda não foi liquidado, dos dois lados.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              É caixa imediato: cobrar um recebível vencido e quitar um pagável antes do juro são as ações de maior retorno no financeiro.
            </Secao>
            <NotaHonesta>
              A integração expõe títulos e movimento de conta por GET; cartão a vencer, PREMMIA e cheque não vêm pela API — por isso o foco aqui é o <strong>atraso</strong>.
            </NotaHonesta>
          </>
        ),
      },
      receber: {
        title: 'A Receber — o potencial desta tela',
        description: 'O que os clientes/adquirentes ainda devem, com o vencido em destaque.',
        slides: [
          { Ilustracao: IlTitulos, tag: 'O que ela faz', titulo: 'Quem deve, quanto e desde quando', texto: (<>Lista os títulos a receber, com os <strong>vencidos</strong> destacados.</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'Dinheiro seu fora do caixa', texto: (<>Prioriza a cobrança pelo <strong>mais antigo e maior</strong> — é o primeiro a perseguir.</>) },
        ],
        body: (
          <>
            <Secao icon={ListChecks} titulo="O que ela faz">
              Lista os títulos a receber, com os <strong>vencidos</strong> destacados — quem deve, quanto e desde quando.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Prioriza a cobrança pelo mais antigo e maior — dinheiro seu que está fora do caixa é o primeiro a perseguir.
            </Secao>
          </>
        ),
      },
      pagar: {
        title: 'A Pagar — o potencial desta tela',
        description: 'Os compromissos e o que está vencido — pra não pagar juro à toa.',
        slides: [
          { Ilustracao: IlLista, tag: 'O que ela faz', titulo: 'Fornecedor, tributo e compromisso', texto: (<>Lista os títulos a pagar, com os <strong>vencidos</strong> em destaque.</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'Pagar na ordem certa, não no susto', texto: (<>Evita <strong>multa e juro</strong> por atraso e ajuda a planejar o caixa.</>) },
        ],
        body: (
          <>
            <Secao icon={ListChecks} titulo="O que ela faz">
              Lista os títulos a pagar, com os <strong>vencidos</strong> em destaque — fornecedores, tributos e demais compromissos.
            </Secao>
            <Secao icon={ShieldCheck} titulo="Por que importa">
              Evita multa e juro por atraso e ajuda a planejar o caixa: você paga na ordem certa, não no susto.
            </Secao>
          </>
        ),
      },
      cartoes: {
        title: 'Cartões — o potencial desta tela',
        description: 'Os recebíveis de cartão pelo lado financeiro: a vencer e liquidados.',
        slides: [
          { Ilustracao: IlCartao, tag: 'O que ela faz', titulo: 'O que ainda vai cair de cartão', texto: (<>Acompanha os <strong>recebíveis de cartão</strong> — a vencer, em atraso e já liquidado pelo adquirente.</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'A previsão do cartão', texto: (<>É o que ainda entra de cartão. Para a conciliação <strong>transação a transação</strong>, use o módulo Cartões.</>) },
        ],
        body: (
          <>
            <Secao icon={CreditCard} titulo="O que ela faz">
              Acompanha os <strong>recebíveis de cartão</strong> — o que está a vencer, em atraso e já liquidado pelo adquirente.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              É a previsão do que ainda vai cair de cartão. Para a conciliação transação-a-transação, use o módulo <strong>Cartões</strong>.
            </Secao>
          </>
        ),
      },
      agenda: {
        title: 'Agenda — o potencial desta tela',
        description: 'O calendário de vencimentos: o fluxo de caixa dos próximos dias num relance.',
        slides: [
          { Ilustracao: IlCalendario, tag: 'O que ela faz', titulo: 'O mapa do que entra e sai', texto: (<>Distribui receber e pagar no <strong>calendário</strong>, por dia de vencimento.</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'O dia que aperta, antes de chegar', texto: (<>Antecipa apertos de caixa: você vê o aperto vindo e <strong>negocia/adianta a tempo</strong>.</>) },
        ],
        body: (
          <>
            <Secao icon={CalendarClock} titulo="O que ela faz">
              Distribui receber e pagar no <strong>calendário</strong>, por dia de vencimento — o mapa do que entra e sai.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Antecipa apertos de caixa: você vê o dia que aperta antes dele chegar e negocia/adianta a tempo.
            </Secao>
          </>
        ),
      },
    },
  },

  '/estoques': {
    Icon: Warehouse,
    nome: 'Estoques',
    subtitle: 'saldo, giro e necessidade de compra',
    potencial: {
      '': {
        title: 'Visão Geral — o potencial desta tela',
        description: 'O panorama do capital parado em estoque e o que está crítico.',
        slides: [
          { Ilustracao: IlEstoque, tag: 'O que ela faz', titulo: 'O capital parado na prateleira', texto: (<>Panorama do estoque da rede — <strong>valor parado</strong>, itens críticos e cobertura, num só lugar.</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'Nem ruptura, nem encalhe', texto: (<>Ver o todo evita ao mesmo tempo a <strong>venda perdida</strong> (faltou) e o <strong>dinheiro preso</strong> (sobrou).</>) },
          { Ilustracao: IlFiscal, tom: 'nota', tag: 'De onde vêm os números', titulo: 'Saldo é sempre o atual', texto: (<>A API não dá histórico por data. O flag “controle de estoque” ainda não vem por GET, então itens de uso e consumo podem aparecer.</>) },
        ],
        body: (
          <>
            <Secao icon={Eye} titulo="O que ela faz">
              Panorama do estoque da rede — <strong>valor parado</strong>, itens críticos e cobertura, num só lugar.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Estoque é caixa parado na prateleira: ver o todo evita ao mesmo tempo a ruptura (venda perdida) e o encalhe (dinheiro preso).
            </Secao>
            <NotaHonesta>
              O saldo é sempre o ATUAL (a API não dá histórico por data). O flag “controle de estoque” ainda não vem por GET, então itens de uso e consumo podem aparecer.
            </NotaHonesta>
          </>
        ),
      },
      geral: {
        title: 'Estoque geral — o potencial desta tela',
        description: 'O saldo por produto e posto: onde está o capital parado.',
        slides: [
          { Ilustracao: IlEstoque, tag: 'O que ela faz', titulo: 'Saldo por produto e por posto', texto: (<>Detalha <strong>quantidade e valor</strong> em estoque, produto a produto.</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'Onde o dinheiro está imobilizado', texto: (<>Mostra exatamente onde <strong>atacar o excesso</strong> e liberar caixa.</>) },
        ],
        body: (
          <>
            <Secao icon={Layers} titulo="O que ela faz">
              Detalha o <strong>saldo por produto e por posto</strong> — quantidade e valor em estoque.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Mostra exatamente onde o dinheiro está imobilizado, pra você atacar o excesso e liberar caixa.
            </Secao>
          </>
        ),
      },
      giro: {
        title: 'Giro — o potencial desta tela',
        description: 'A velocidade com que cada item vende — o pulso do estoque.',
        slides: [
          { Ilustracao: IlGiro, tag: 'O que ela faz', titulo: 'Quantas vezes o estoque roda', texto: (<>Calcula o <strong>giro</strong> por produto no período.</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'Encalhe × ruptura', texto: (<>Giro baixo = <strong>dinheiro parado</strong> (promoção/corte); giro alto = risco de faltar (aumentar o mínimo).</>) },
        ],
        body: (
          <>
            <Secao icon={Calculator} titulo="O que ela faz">
              Calcula o <strong>giro</strong> por produto — quantas vezes o estoque roda no período.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Giro baixo = dinheiro encalhado (candidato a promoção/corte); giro alto = risco de ruptura (aumentar o mínimo).
            </Secao>
          </>
        ),
      },
      mediaVendas: {
        title: 'Média de venda — o potencial desta tela',
        description: 'A média histórica (6 meses) por produto — a base pra dimensionar a compra.',
        slides: [
          { Ilustracao: IlBarras, tag: 'O que ela faz', titulo: 'O consumo real, sem mês atípico', texto: (<>Mostra a <strong>média de venda dos últimos 6 meses</strong> por produto.</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'A base da reposição certa', texto: (<>Comprar pela média certa <strong>evita faltar e evita sobrar</strong>.</>) },
        ],
        body: (
          <>
            <Secao icon={BarChart3} titulo="O que ela faz">
              Mostra a <strong>média de venda dos últimos 6 meses</strong> por produto — o consumo real, sem o ruído de um mês atípico.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              É o número que sustenta a reposição: comprar pela média certa evita faltar e evita sobrar.
            </Secao>
          </>
        ),
      },
      necessidade: {
        title: 'Necessidade — o potencial desta tela',
        description: 'A lista de compra pronta: o que repor, pelo mínimo e pela cobertura.',
        slides: [
          { Ilustracao: IlLista, tag: 'O que ela faz', titulo: 'A lista de compra já priorizada', texto: (<>Aponta o que está <strong>abaixo do mínimo/cobertura</strong> e precisa de reposição.</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'Compra na hora certa, na medida certa', texto: (<>Em vez de descobrir a falta na venda, você repõe antes — <strong>na quantidade certa</strong>.</>) },
        ],
        body: (
          <>
            <Secao icon={ListChecks} titulo="O que ela faz">
              Aponta o que está <strong>abaixo do mínimo/cobertura</strong> e precisa de reposição — a lista de compra já priorizada.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Transforma o estoque em ação: em vez de descobrir a falta na hora da venda, você compra na hora certa, na quantidade certa.
            </Secao>
          </>
        ),
      },
    },
  },

  '/produtividade': {
    Icon: Users,
    nome: 'Produtividade',
    subtitle: 'desempenho de frentistas e vendedores',
    potencial: {
      '': {
        title: 'Visão Geral — o potencial desta tela',
        description: 'A equipe da pista num painel: quem puxa automotivo e aditivada.',
        slides: [
          { Ilustracao: IlPessoas, tag: 'O que ela faz', titulo: 'A equipe da pista num painel', texto: (<>Por funcionário: <strong>faturamento de automotivos</strong>, litros de aditivada, mix, abastecimentos e ticket — com a <strong>projeção de fim de mês</strong> e os pódios de quem mais vende.</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'O maior custo variável', texto: (<>Ver quem empurra aditivada e automotivo (e quem não) mostra onde <strong>treinar</strong>, quem reconhecer e quanto a equipe deixa na mesa.</>) },
        ],
        body: (
          <>
            <Secao icon={Users} titulo="O que ela faz">
              Mostra, por funcionário, o <strong>faturamento de automotivos</strong>, os <strong>litros de aditivada</strong>, o mix, os abastecimentos e o ticket — com a <strong>projeção de fim de mês</strong> (Tend.) e os pódios de quem mais vende.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Gente é o maior custo variável: ver quem empurra aditivada e automotivo (e quem não) mostra onde treinar, quem reconhecer e quanto a equipe deixa na mesa.
            </Secao>
          </>
        ),
      },
      funcionarios: {
        title: 'Funcionários — o potencial desta tela',
        description: 'O raio-x de cada um: o que vendeu, quanto e em quê.',
        slides: [
          { Ilustracao: IlPessoas, tag: 'O que ela faz', titulo: 'O raio-x de cada funcionário', texto: (<>Clica no funcionário: automotivos e combustíveis vendidos, os <strong>grupos de produto</strong> que ele gira e o <strong>histórico de 12 meses</strong>.</>) },
          { Ilustracao: IlRanking, tag: 'Por que importa', titulo: 'Feedback com número na mão', texto: (<>O que cobrar de cada um, onde está o <strong>topo pra replicar</strong> e quem precisa de apoio.</>) },
        ],
        body: (
          <>
            <Secao icon={Wrench} titulo="O que ela faz">
              Clica no funcionário e abre o detalhe: automotivos e combustíveis vendidos, os <strong>grupos de produto</strong> que ele gira e o <strong>histórico de 12 meses</strong>.
            </Secao>
            <Secao icon={Trophy} titulo="Por que importa">
              É a conversa de feedback com número na mão — o que cobrar de cada um, onde está o topo pra replicar e quem precisa de apoio.
            </Secao>
          </>
        ),
      },
      rede: {
        title: 'Resumo da rede — o potencial desta tela',
        description: 'Todos os postos num quadro só: quem lidera e quem puxa a média.',
        slides: [
          { Ilustracao: IlRede, tag: 'O que ela faz', titulo: 'Todos os postos num quadro', texto: (<>Consolida os postos num ranking — automotivos, aditivada, mix e ticket — com quem está <strong>acima e abaixo</strong> da média ponderada, e os funcionários que precisam de atenção.</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'O dinheiro na mesa', texto: (<>Mostra o posto que puxa o mix pra baixo, <strong>quanto renderia</strong> se chegasse à média, e quem replicar. Comparar postos vira decisão.</>) },
        ],
        body: (
          <>
            <Secao icon={Building2} titulo="O que ela faz">
              Consolida os <strong>postos</strong> num ranking — automotivos, aditivada, mix e ticket — com a leitura de quem está acima e abaixo da média ponderada da rede, e os funcionários que precisam de atenção em qualquer posto.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Mostra onde está o dinheiro na mesa: o posto que puxa o mix pra baixo, quanto renderia se chegasse à média, e quem replicar. Comparar postos vira decisão, não achismo.
            </Secao>
          </>
        ),
      },
    },
  },

  '/qualidade-dados': {
    Icon: SearchCheck,
    nome: 'Qualidade de Dados',
    subtitle: 'inconsistências e sinais de fraude',
    potencial: {
      '': {
        title: 'Qualidade de Dados — o potencial desta tela',
        description: 'O detetive da rede: acha erro de cadastro e sinal de desvio antes de virar prejuízo.',
        slides: [
          { Ilustracao: IlDetetive, tag: 'O que ela faz', titulo: 'O detetive dos lançamentos', texto: (<>Varre os lançamentos atrás de <strong>inconsistências</strong> — abastecimento sem frentista, litros/valores suspeitos e <strong>cupons “montados”</strong> (vários abastecimentos num cupom).</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'Pega cedo, protege o caixa', texto: (<>Erro de cadastro contamina todo relatório; e o cupom montado é a <strong>assinatura clássica</strong> de desvio no cartão.</>) },
          { Ilustracao: IlFiscal, tom: 'nota', tag: 'Como ler', titulo: 'Aponta pra investigar, não acusa', texto: (<>Cada item traz o detalhe (posto, frentista, bomba, valores) pra você <strong>confirmar antes de agir</strong>.</>) },
        ],
        body: (
          <>
            <Secao icon={SearchCheck} titulo="O que ela faz">
              Varre os lançamentos atrás de <strong>inconsistências</strong> — abastecimento sem frentista, litros/valores suspeitos e <strong>cupons “montados”</strong> (vários abastecimentos num cupom).
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Erro de cadastro contamina todo relatório; e o padrão de cupom montado é a assinatura clássica de desvio no cartão. Pegar cedo protege o número e o caixa.
            </Secao>
            <NotaHonesta>
              A tela aponta o que investigar, não acusa: cada item traz o detalhe (posto, frentista, bomba, valores) pra você confirmar antes de agir.
            </NotaHonesta>
          </>
        ),
      },
    },
  },

  '/pessoas': {
    Icon: Users,
    nome: 'Pessoas',
    subtitle: 'quadro de colaboradores da rede',
    potencial: {
      '': {
        title: 'Pessoas — o potencial desta tela',
        description: 'Quem é quem na rede, por cargo e por posto.',
        slides: [
          { Ilustracao: IlPessoas, tag: 'O que ela faz', titulo: 'O quadro da rede, por cargo e posto', texto: (<>Organiza os colaboradores por <strong>cargo</strong> (frentista, gerente, supervisor) e posto, com ativos e inativos.</>) },
          { Ilustracao: IlLista, tag: 'Por que importa', titulo: 'A base pra cruzar gente com resultado', texto: (<>Sustenta a <strong>Produtividade</strong> e mostra quem está ativo em cada unidade — sem planilha paralela.</>) },
        ],
        body: (
          <>
            <Secao icon={Users} titulo="O que ela faz">
              Organiza o <strong>quadro de colaboradores</strong> por cargo (frentista, gerente, supervisor) e posto, com ativos e inativos.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              É a base pra cruzar gente com resultado (Produtividade) e pra saber quem está ativo em cada unidade — sem depender de planilha paralela.
            </Secao>
          </>
        ),
      },
    },
  },

  '/inteligencia': {
    Icon: Brain,
    nome: 'Inteligência',
    subtitle: 'o analista de IA da rede',
    potencial: {
      '': {
        title: 'Inteligência — o potencial desta tela',
        description: 'O analista de IA que lê a rede e diz, em português claro, onde está a perda e quanto ela vale.',
        slides: [
          { Ilustracao: IlIA, tag: 'O que ela faz', titulo: 'Um analista que lê a rede', texto: (<>Lê os dados já apurados e responde em <strong>linguagem de dono</strong>: onde o resultado escapa, qual posto está fora da curva e quanto vale corrigir.</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'Número vira decisão', texto: (<>Em vez de abrir dez telas atrás do problema, você <strong>pergunta</strong> e ele aponta o que atacar primeiro, com o valor em reais do lado.</>) },
          { Ilustracao: IlFiscal, tom: 'nota', tag: 'Como funciona', titulo: 'É só leitura — quem decide é você', texto: (<>A IA analisa e sugere a partir do que já foi apurado — <strong>não altera</strong> preço, nota nem qualquer valor.</>) },
        ],
        body: (
          <>
            <Secao icon={Sparkles} titulo="O que ela faz">
              Um <strong>analista de IA</strong> que lê os dados já apurados da rede e responde em linguagem de dono: onde o resultado está escapando, qual posto está fora da curva e quanto vale corrigir — sem você garimpar planilha.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Vira número em <strong>decisão</strong>: em vez de abrir dez telas atrás do problema, você pergunta e ele aponta o que atacar primeiro, com o valor em reais do lado.
            </Secao>
            <NotaHonesta>
              É <strong>só leitura</strong>: a IA analisa e sugere a partir do que já foi apurado — não altera preço, nota nem qualquer valor no sistema. Quem decide é você.
            </NotaHonesta>
          </>
        ),
      },
    },
  },

  '/compliance': {
    Icon: ShieldCheck,
    nome: 'Compliance ANP',
    subtitle: 'margem regulatória (placa − CMP)',
    potencial: {
      '': {
        title: 'Compliance ANP — o potencial desta tela',
        description: 'A margem regulatória por posto e combustível — placa menos custo — pra enxergar o que a fiscalização enxergaria.',
        slides: [
          { Ilustracao: IlCompliance, tag: 'O que ela faz', titulo: 'A margem que a ANP olharia', texto: (<>Reconstrói, por <strong>posto × combustível</strong>, a margem regulatória = preço de placa − <strong>CMP</strong> (custo médio das compras), com panorama por faixa e histórico de 365 dias.</>) },
          { Ilustracao: IlConfianca, tag: 'Como é calculado', titulo: 'Placa menos custo médio', texto: (<><strong>CMP</strong> = Σ(qtd × custo) ÷ Σ(qtd) das compras — não o último preço. <strong>Margem</strong> = placa vigente − CMP. Tudo de dados GET, read-only.</>) },
          { Ilustracao: IlDinheiro, tag: 'Por que importa', titulo: 'Ver antes de virar questionamento', texto: (<>Enxergar a margem <strong>sem promoção nem desconto</strong>, e ter a trilha pra reconciliar placa e custo contra o ERP.</>) },
          { Ilustracao: IlFiscal, tom: 'nota', tag: 'Como ler', titulo: 'Validação, não veredito da ANP', texto: (<>A margem <strong>regulatória</strong> (placa − CMP) não é a <strong>operacional</strong> do dia a dia, e uma cor aqui não é veredito oficial. A placa é por posto — selecione um.</>) },
        ],
        body: (
          <>
            <Secao icon={Eye} titulo="O que ela faz">
              Reconstrói, por <strong>posto × combustível</strong>, a <strong>margem regulatória</strong> = preço de placa (à vista) − <strong>CMP</strong> (custo médio ponderado das notas de compra), com um panorama por faixa (verde/amarelo/laranja/vermelho) e o detalhe com histórico de 365 dias.
            </Secao>
            <Secao icon={Calculator} titulo="Como é calculado">
              <span className="block">• <strong>CMP</strong> = Σ(quantidade × custo) ÷ Σ(quantidade) das compras do período — não o último preço.</span>
              <span className="block">• <strong>Margem</strong> = placa vigente − CMP. Tudo de dados GET (/COMPRA_ITEM + /TROCA_PRECO), read-only.</span>
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Enxergar a margem que a ANP olharia — <strong>sem promoção nem desconto</strong> — antes de virar questionamento, e ter a trilha pra reconciliar placa e custo contra o ERP.
            </Secao>
            <NotaHonesta>
              É <strong>validação/spike</strong>: a margem <strong>regulatória</strong> (placa − CMP) não é a <strong>operacional</strong> do dia a dia, e uma cor aqui <strong>não</strong> é veredito oficial da ANP. A placa é por posto — selecione um posto pra ver placa e margem.
            </NotaHonesta>
          </>
        ),
      },
    },
  },
}

/* ─── Resolvers ─── */

export const moduleFor = (pathname: string): ModuleMeta | null => REGISTRY[pathname] ?? null

/** Abas (sub-tabs `?tab=`) de um módulo, derivadas das chaves de `potencial`
 * (a chave É o valor de `?tab=`; '' = aba default). Label = título do potencial
 * sem o sufixo " — o potencial desta tela". Usado no seletor de aba do briefing. */
export const abasFor = (pathname: string): { tab: string; label: string }[] => {
  const m = REGISTRY[pathname]
  if (!m) return []
  return Object.entries(m.potencial).map(([tab, c]) => ({ tab, label: c.title.split('—')[0].trim() }))
}

export const potencialFor = (pathname: string, tab: string | null): PotencialConteudo | null => {
  const m = REGISTRY[pathname]
  if (!m) return null
  return m.potencial[tab ?? ''] ?? m.potencial[''] ?? null
}
