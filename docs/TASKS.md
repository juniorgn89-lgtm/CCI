## 18. Lista de Tarefas (Sprints)

---

### Sprint 1 — Infraestrutura, Autenticação e Layout Base

**Objetivo:** Projeto funcionando com login, layout e filtros globais.

#### 1.1 Setup do Projeto Vite + TypeScript

- [x] 1.1.1 Criar projeto com `npm create vite@latest ccisga -- --template react-ts`
- [x] 1.1.2 Configurar `tsconfig.json` com `strict: true` e path alias `@/*` apontando para `src/*`
- [x] 1.1.3 Configurar `tsconfig.app.json` com `baseUrl: "."` e `paths: { "@/*": ["./src/*"] }`
- [x] 1.1.4 Configurar `vite.config.ts` com resolve alias `@` → `./src`
- [x] 1.1.5 Criar `.env` com `VITE_API_BASE_URL=https://web.qualityautomacao.com.br/INTEGRACAO`
- [x] 1.1.6 Criar `.env.example` com variáveis documentadas (sem valores secretos)
- [x] 1.1.7 Configurar `.gitignore` (node_modules, dist, .env, .env.local)

#### 1.2 Instalar e Configurar Dependências

- [x] 1.2.1 Instalar TailwindCSS v3: `npm install -D tailwindcss postcss autoprefixer` e gerar configs
- [x] 1.2.2 Configurar `tailwind.config.ts` com `content: ['./index.html', './src/**/*.{ts,tsx}']` e tema customizado (cores navy, accent, etc.)
- [x] 1.2.3 Configurar `postcss.config.js` com plugins tailwindcss e autoprefixer
- [x] 1.2.4 Configurar `src/index.css` com diretivas `@tailwind base/components/utilities` e fonte Inter via Google Fonts
- [x] 1.2.5 Inicializar shadcn/ui: `npx shadcn-ui@latest init` — gerar `components.json` com estilo "default" e alias `@/components/ui`
- [x] 1.2.6 Instalar React Router v6: `npm install react-router-dom`
- [x] 1.2.7 Instalar TanStack Query: `npm install @tanstack/react-query`
- [x] 1.2.8 Instalar Zustand: `npm install zustand`
- [x] 1.2.9 Instalar Axios: `npm install axios`
- [x] 1.2.10 Instalar Recharts: `npm install recharts`
- [x] 1.2.11 Instalar Lucide React (ícones): `npm install lucide-react`
- [x] 1.2.12 Instalar componentes shadcn/ui necessários: Button, Input, Select, Card, Table, Tabs, Badge, Skeleton, DropdownMenu, Sheet, Separator

#### 1.3 Client HTTP com Interceptor READ-ONLY

- [x] 1.3.1 Criar `src/api/client.ts` com instância Axios configurada com `baseURL` do `.env`
- [x] 1.3.2 Implementar interceptor de request que **rejeita** qualquer método que não seja GET (lança erro)
- [x] 1.3.3 Adicionar exceção no interceptor apenas para `POST` em rota contendo `/auth` ou `/login`
- [x] 1.3.4 Implementar interceptor de request que injeta query parameter `CHAVE` com token armazenado em todas as requisições
- [x] 1.3.5 Implementar interceptor de response que detecta 401 e redireciona para login
- [x] 1.3.6 Exportar instância tipada do client para uso nos endpoints

#### 1.4 Tipos Base da API

- [x] 1.4.1 Criar `src/api/types/common.ts` com tipo `PaginatedResponse<T>` (`{ resultados: T[]; ultimoCodigo: number }`)
- [x] 1.4.2 Criar `src/api/types/auth.ts` com tipo `LoginResponse` (token, usuario)
- [x] 1.4.3 Criar `src/api/types/empresa.ts` com tipo `Empresa` (codigo, cnpj, razaoSocial, nomeFantasia, etc.)

#### 1.5 Autenticação

- [x] 1.5.1 Criar `src/api/endpoints/auth.ts` com função `login(email, password)` que faz POST (única exceção) e retorna token
- [x] 1.5.2 Criar `src/hooks/useAuth.ts` com estado de autenticação (token em memória, isAuthenticated, login, logout)
- [x] 1.5.3 Criar `src/pages/Login/index.tsx` — formulário com email, senha, botão "Entrar", logo do CCISGA
- [x] 1.5.4 Estilizar tela de login: centralizada, card branco com sombra, fundo gray-50, logo acima
- [x] 1.5.5 Implementar lógica de login: chamada ao endpoint, armazenamento do token, redirect para Dashboard
- [x] 1.5.6 Implementar tratamento de erro de login: mensagem "Credenciais inválidas" em vermelho
- [x] 1.5.7 Criar `src/components/layout/ProtectedRoute.tsx` que verifica isAuthenticated e redireciona para `/login`
- [x] 1.5.8 Implementar logout no hook useAuth: limpar token, limpar cache React Query, redirecionar para login

#### 1.6 Roteamento

- [x] 1.6.1 Criar `src/routes/index.tsx` com definição de todas as rotas (login público, demais protegidas)
- [x] 1.6.2 Configurar `src/App.tsx` com providers: `BrowserRouter`, `QueryClientProvider`, rotas
- [x] 1.6.3 Configurar `QueryClient` com defaults: `staleTime: 5 * 60 * 1000`, `retry: 2`
- [x] 1.6.4 Definir rotas: `/login` (público), `/` redireciona para `/dashboard`, `/dashboard`, `/combustiveis`, `/produtos`, `/conveniencias`, `/estoques`, `/produtividade`, `/financeiro`, `/relatorios`
- [x] 1.6.5 Envolver rotas protegidas com `ProtectedRoute` e `AppLayout`

#### 1.7 Layout Principal

- [x] 1.7.1 Criar `src/components/layout/Sidebar.tsx` — menu lateral com ícones e labels para cada módulo
- [x] 1.7.2 Estilizar Sidebar: `bg-[#1e3a5f]`, largura `w-64` expandida / `w-16` colapsada, transição suave
- [x] 1.7.3 Implementar itens do Sidebar: Dashboard, Combustíveis, Produtos, Conveniências, Estoques, Produtividade, Financeiro, Relatórios — cada um com ícone Lucide
- [x] 1.7.4 Implementar item ativo: `bg-white/10 border-l-4 border-[#2563eb]` baseado na rota atual
- [x] 1.7.5 Implementar toggle de colapsar/expandir com botão no topo do sidebar
- [x] 1.7.6 Criar `src/components/layout/Header.tsx` — barra superior com título do módulo atual, filtros globais e botão de logout
- [x] 1.7.7 Criar `src/components/layout/AppLayout.tsx` — composição de Sidebar + Header + área de conteúdo (`<Outlet />`)
- [x] 1.7.8 Estilizar AppLayout: sidebar à esquerda, header fixo no topo, conteúdo com scroll, fundo gray-50

#### 1.8 Filtros Globais (Zustand)

- [x] 1.8.1 Criar `src/store/filters.ts` com Zustand store: `{ empresaCodigo, dataInicial, dataFinal, setEmpresa, setPeriodo }`
- [x] 1.8.2 Criar `src/hooks/useFilters.ts` como wrapper do store com helpers (período formatado, query params)
- [x] 1.8.3 Criar `src/api/endpoints/empresas.ts` com função `fetchEmpresas()` → `GET /INTEGRACAO/EMPRESAS`
- [x] 1.8.4 Criar `src/components/filters/CompanySelect.tsx` — select populado via `useQuery` de empresas
- [x] 1.8.5 Criar `src/components/filters/PeriodSelect.tsx` — seletores de ano e mês
- [x] 1.8.6 Criar `src/components/filters/DateRangePicker.tsx` — input de intervalo de datas
- [x] 1.8.7 Criar `src/components/filters/GlobalFilterBar.tsx` — composição de CompanySelect + PeriodSelect + DateRangePicker
- [x] 1.8.8 Integrar GlobalFilterBar no Header
- [x] 1.8.9 Implementar invalidação de queries ao alterar filtro: `queryClient.invalidateQueries()` no setter do Zustand

#### 1.9 Componentes Base do Design System

- [x] 1.9.1 Criar `src/components/kpi/KpiCard.tsx` — card com ícone, label, valor formatado, variação (positiva/negativa com cor)
- [x] 1.9.2 Criar `src/components/kpi/KpiGrid.tsx` — grid responsivo de KpiCards (4-5 cols desktop, 2 tablet, 1 mobile)
- [x] 1.9.3 Criar `src/components/tables/DataTable.tsx` — tabela genérica com shadcn/ui Table, cabeçalho estilizado, linhas alternadas, ordenação por coluna
- [x] 1.9.4 Criar `src/components/tables/HeatmapCell.tsx` — célula com fundo gradiente proporcional ao valor (verde para positivo, vermelho para negativo)
- [x] 1.9.5 Criar `src/lib/formatters.ts` — funções: `formatCurrency(value)`, `formatNumber(value)`, `formatPercent(value)`, `formatDate(date)`, `formatLiters(value)`
- [x] 1.9.6 Criar `src/lib/constants.ts` — constantes: cores do design system, breakpoints, staleTime por domínio
- [x] 1.9.7 Criar `src/lib/utils.ts` — helper `cn()` para merge de classes Tailwind (via clsx + tailwind-merge)

---

### Sprint 2 — Dashboard (Visão Geral)

**Objetivo:** Dashboard funcional com KPIs consolidados, cards de setor e tabelas.

#### 2.1 Tipos e Endpoints de Vendas

- [x] 2.1.1 Criar `src/api/types/venda.ts` com tipos: `Venda`, `VendaItem`, `VendaResumo`, `VendaFormaPagamento`
- [x] 2.1.2 Criar `src/api/endpoints/vendas.ts` com funções:
  - `fetchVendas(params)` → `GET /INTEGRACAO/VENDA`
  - `fetchVendaResumo(params)` → `GET /INTEGRACAO/VENDA_RESUMO`
  - `fetchVendaItens(params)` → `GET /INTEGRACAO/VENDA_ITEM`
  - `fetchVendaFormasPagamento(params)` → `GET /INTEGRACAO/VENDA_FORMA_PAGAMENTO`

#### 2.2 Hook do Dashboard

- [x] 2.2.1 Criar `src/pages/Dashboard/hooks/useDashboardData.ts` que:
  - Lê filtros globais do Zustand
  - Usa `useQuery` para buscar `VENDA_RESUMO` com filtros aplicados
  - Usa `useQuery` para buscar `EMPRESAS`
  - Calcula KPIs consolidados (faturamento total, variação vs. período anterior)
  - Retorna: kpis, sectorCards, projectionData, companyDetailData, isLoading

#### 2.3 Componentes do Dashboard

- [x] 2.3.1 Criar `src/pages/Dashboard/components/SectorCards.tsx` — 3 cards (Combustível, Automotivos, Conveniência) com faturamento, variação e projeção mensal
- [x] 2.3.2 Estilizar SectorCards: cards com borda colorida à esquerda (azul para combustível, verde para automotivos, amarelo para conveniência)
- [x] 2.3.3 Criar `src/pages/Dashboard/components/ProjectionTable.tsx` — tabela com colunas: Período, Realizado, Projeção, Meta, % Atingido; células com heatmap de % atingido
- [x] 2.3.4 Criar `src/pages/Dashboard/components/SectorDetailTable.tsx` — tabela por empresa com colunas: Empresa, Faturamento, Volume, Margem, Variação; com heatmap na coluna de variação

#### 2.4 Página do Dashboard

- [x] 2.4.1 Criar `src/pages/Dashboard/index.tsx` compondo: KpiGrid (4 KPIs no topo), SectorCards (3 cards), ProjectionTable, SectorDetailTable
- [x] 2.4.2 Implementar cross-filter: ao clicar em SectorCard, navegar para módulo correspondente com filtro de grupo pré-aplicado
- [x] 2.4.3 Implementar loading states com Skeleton nos cards e tabelas enquanto dados carregam
- [x] 2.4.4 Implementar tratamento de erro: mensagem amigável se API falhar

---

### Sprint 3 — Módulo Combustíveis

**Objetivo:** Módulo de combustíveis completo com todas as visualizações.

#### 3.1 Tipos e Endpoints de Combustíveis

- [x] 3.1.1 Criar `src/api/types/combustivel.ts` (se necessário, ou adicionar em types existentes) com tipos: `Abastecimento`, `Tanque`, `Bico`, `Bomba`, `LMC`, `TrocaPreco`
- [x] 3.1.2 Criar `src/api/endpoints/combustiveis.ts` com funções:
  - `fetchAbastecimentos(params)` → `GET /INTEGRACAO/ABASTECIMENTO`
  - `fetchTanques(params)` → `GET /INTEGRACAO/TANQUE`
  - `fetchBicos(params)` → `GET /INTEGRACAO/BICO`
  - `fetchBombas(params)` → `GET /INTEGRACAO/BOMBA`
  - `fetchLmc(params)` → `GET /INTEGRACAO/LMC`
  - `fetchTrocaPreco(params)` → `GET /INTEGRACAO/TROCA_PRECO`

#### 3.2 Hook de Combustíveis

- [x] 3.2.1 Criar `src/pages/Combustiveis/hooks/useFuelData.ts` que:
  - Lê filtros globais do Zustand
  - Usa `useQuery` para buscar abastecimentos no período
  - Processa dados: agrupa por dia, agrupa por tipo de combustível, calcula KPIs
  - Retorna: kpis, dailyData, fuelTypeData, monthlyEvolution, weeklyAnalysis, isLoading

#### 3.3 Componentes de Combustíveis

- [x] 3.3.1 Criar `src/pages/Combustiveis/components/FuelKpis.tsx` — KpiGrid com: Litros Vendidos, Faturamento, Margem Média, Preço Médio de Venda
- [x] 3.3.2 Criar `src/pages/Combustiveis/components/DailyTable.tsx` — tabela dia a dia com colunas: Data, Litros, Faturamento, Custo, Margem R$, Margem %, com heatmap na margem
- [x] 3.3.3 Criar `src/pages/Combustiveis/components/FuelTypeTable.tsx` — tabela por combustível: Tipo, Litros, Faturamento, Preço Médio, Margem
- [x] 3.3.4 Criar `src/pages/Combustiveis/components/MonthlyChart.tsx` — gráfico de área (Recharts) com evolução mensal de litros e faturamento
- [x] 3.3.5 Criar `src/pages/Combustiveis/components/WeeklyAnalysis.tsx` — tabela/gráfico agrupado por dia da semana (segunda a domingo)

#### 3.4 Página de Combustíveis

- [x] 3.4.1 Criar `src/pages/Combustiveis/index.tsx` com: FuelKpis no topo, Tabs (Dia a Dia | Por Combustível | Evolução | Semanal), conteúdo da aba ativa
- [x] 3.4.2 Implementar navegação por Tabs usando shadcn/ui Tabs
- [x] 3.4.3 Implementar loading states e tratamento de erro

---

### Sprint 4 — Módulos Produtos e Conveniências

**Objetivo:** Módulos de Produtos (Automotivos) e Conveniências funcionais.

#### 4.1 Tipos e Endpoints de Produtos

- [ ] 4.1.1 Criar `src/api/types/produto.ts` com tipos: `Produto`, `ProdutoEstoque`, `Grupo`, `GrupoMeta`, `ProdutoMeta`
- [ ] 4.1.2 Criar `src/api/endpoints/produtos.ts` com funções:
  - `fetchProdutos(params)` → `GET /INTEGRACAO/PRODUTO`
  - `fetchGrupos(params)` → `GET /INTEGRACAO/GRUPO`
  - `fetchProdutoMeta(params)` → `GET /INTEGRACAO/PRODUTO_META`
  - `fetchGrupoMeta(params)` → `GET /INTEGRACAO/GRUPO_META`

#### 4.2 Hook e Componentes de Produtos

- [ ] 4.2.1 Criar `src/pages/Produtos/hooks/useProductData.ts` — busca vendas de itens automotivos, agrupa por grupo, calcula Pareto e Curva ABC
- [ ] 4.2.2 Criar `src/pages/Produtos/components/ProductKpis.tsx` — KPIs: Faturamento, Qtd Vendida, Margem Total, Ticket Médio
- [ ] 4.2.3 Criar `src/pages/Produtos/components/GroupTable.tsx` — tabela por grupo com heatmap de margem
- [ ] 4.2.4 Criar `src/pages/Produtos/components/ParetoChart.tsx` — gráfico de Pareto (barras + linha acumulativa)
- [ ] 4.2.5 Criar `src/pages/Produtos/components/AbcCurve.tsx` — tabela com classificação ABC e indicadores visuais

#### 4.3 Página de Produtos

- [ ] 4.3.1 Criar `src/pages/Produtos/index.tsx` com: ProductKpis, Tabs (Por Grupo | Pareto | Curva ABC)
- [ ] 4.3.2 Implementar loading states e tratamento de erro

#### 4.4 Hook e Componentes de Conveniências

- [ ] 4.4.1 Criar `src/pages/Conveniencias/hooks/useConvenienceData.ts` — busca vendas de itens de conveniência, agrupa por dia e por grupo
- [ ] 4.4.2 Criar `src/pages/Conveniencias/components/ConvenienceKpis.tsx` — KPIs: Faturamento, Margem, Qtd Itens, Ticket Médio
- [ ] 4.4.3 Criar `src/pages/Conveniencias/components/DailyTable.tsx` — tabela dia a dia com heatmap
- [ ] 4.4.4 Criar `src/pages/Conveniencias/components/GroupTable.tsx` — tabela por grupo de conveniência
- [ ] 4.4.5 Criar `src/pages/Conveniencias/components/RevenueChart.tsx` — gráfico de barras/área de faturamento

#### 4.5 Página de Conveniências

- [ ] 4.5.1 Criar `src/pages/Conveniencias/index.tsx` com: ConvenienceKpis, Tabs (Dia a Dia | Por Grupo | Evolução)
- [ ] 4.5.2 Implementar loading states e tratamento de erro

---

### Sprint 5 — Módulos Estoques e Produtividade

**Objetivo:** Módulos de Estoques e Produtividade funcionais.

#### 5.1 Tipos e Endpoints de Estoques

- [ ] 5.1.1 Criar `src/api/types/estoque.ts` com tipos: `Estoque`, `EstoquePeriodo`, `ProdutoEstoque`, `ContagemEstoque`
- [ ] 5.1.2 Criar `src/api/endpoints/estoques.ts` com funções:
  - `fetchProdutoEstoque(params)` → `GET /INTEGRACAO/PRODUTO_ESTOQUE`
  - `fetchEstoque(params)` → `GET /INTEGRACAO/ESTOQUE`
  - `fetchEstoquePeriodo(params)` → `GET /INTEGRACAO/ESTOQUE_PERIODO`
  - `fetchContagemEstoque(params)` → `GET /INTEGRACAO/CONTAGEM_ESTOQUE`

#### 5.2 Hook e Componentes de Estoques

- [ ] 5.2.1 Criar `src/pages/Estoques/hooks/useStockData.ts` — busca posição de estoque, calcula KPIs (valor total, itens abaixo mínimo, giro)
- [ ] 5.2.2 Criar `src/pages/Estoques/components/StockKpis.tsx` — KPIs: Valor Total Estoque, Itens Abaixo Mínimo, Giro Médio
- [ ] 5.2.3 Criar `src/pages/Estoques/components/StockTable.tsx` — tabela de posição de estoque por produto (Produto, Qtd, Valor Custo, Valor Venda, Status)
- [ ] 5.2.4 Criar `src/pages/Estoques/components/StockMovementChart.tsx` — gráfico de barras agrupadas (entradas vs. saídas por período)

#### 5.3 Página de Estoques

- [ ] 5.3.1 Criar `src/pages/Estoques/index.tsx` com: StockKpis, StockTable, StockMovementChart
- [ ] 5.3.2 Implementar loading states e tratamento de erro

#### 5.4 Tipos e Endpoints de Funcionários

- [ ] 5.4.1 Criar `src/api/types/funcionario.ts` com tipos: `Funcionario`, `FuncionarioMeta`, `Funcao`, `Placares`
- [ ] 5.4.2 Criar `src/api/endpoints/funcionarios.ts` com funções:
  - `fetchFuncionarios(params)` → `GET /INTEGRACAO/FUNCIONARIO`
  - `fetchFuncionarioMeta(params)` → `GET /INTEGRACAO/FUNCIONARIO_META`
  - `fetchFuncoes(params)` → `GET /INTEGRACAO/FUNCOES`
  - `fetchPlacares(params)` → `GET /INTEGRACAO/PLACARES`
- [ ] 5.4.3 Criar `src/api/endpoints/relatorios.ts` com função:
  - `fetchProdutividadeFuncionario(params)` → `GET /INTEGRACAO/RELATORIO/PRODUTIVIDADE_FUNCIONARIO`

#### 5.5 Hook e Componentes de Produtividade

- [ ] 5.5.1 Criar `src/pages/Produtividade/hooks/useProductivityData.ts` — busca relatório de produtividade, calcula rankings e campeão
- [ ] 5.5.2 Criar `src/pages/Produtividade/components/ChampionCard.tsx` — card destacado do funcionário campeão com foto/ícone, nome, valor vendido, badge
- [ ] 5.5.3 Criar `src/pages/Produtividade/components/SalesRanking.tsx` — gráfico de barras horizontais dos funcionários ordenados por vendas
- [ ] 5.5.4 Criar `src/pages/Produtividade/components/ConversionRanking.tsx` — ranking por taxa de conversão
- [ ] 5.5.5 Criar `src/pages/Produtividade/components/TicketRanking.tsx` — ranking por ticket médio

#### 5.6 Página de Produtividade

- [ ] 5.6.1 Criar `src/pages/Produtividade/index.tsx` com: ChampionCard, Tabs (Ranking Geral | Conversão | Ticket Médio)
- [ ] 5.6.2 Implementar loading states e tratamento de erro

---

### Sprint 6 — Módulo Financeiro

**Objetivo:** Módulo financeiro completo com recebíveis, pagáveis, fluxo de caixa e DRE.

#### 6.1 Tipos e Endpoints Financeiros

- [ ] 6.1.1 Criar `src/api/types/financeiro.ts` com tipos: `TituloReceber`, `TituloPagar`, `Duplicata`, `MovimentoConta`, `DRE`, `Caixa`, `CaixaApresentado`, `Conta`
- [ ] 6.1.2 Criar `src/api/endpoints/financeiro.ts` com funções:
  - `fetchTitulosReceber(params)` → `GET /INTEGRACAO/TITULO_RECEBER`
  - `fetchTitulosPagar(params)` → `GET /INTEGRACAO/TITULO_PAGAR`
  - `fetchDuplicatas(params)` → `GET /INTEGRACAO/DUPLICATA`
  - `fetchMovimentosConta(params)` → `GET /INTEGRACAO/MOVIMENTO_CONTA`
  - `fetchDre(params)` → `GET /INTEGRACAO/DRE`
  - `fetchCaixas(params)` → `GET /INTEGRACAO/CAIXA`
  - `fetchContas(params)` → `GET /INTEGRACAO/CONTA`

#### 6.2 Hook e Componentes Financeiros

- [ ] 6.2.1 Criar `src/pages/Financeiro/hooks/useFinanceData.ts` — busca títulos, movimentações e DRE; calcula KPIs financeiros
- [ ] 6.2.2 Criar `src/pages/Financeiro/components/FinanceKpis.tsx` — KPIs: Total a Receber, Total a Pagar, Saldo Líquido, Inadimplência
- [ ] 6.2.3 Criar `src/pages/Financeiro/components/ReceivablesTable.tsx` — tabela de títulos a receber: Cliente, Data Vencimento, Valor, Situação; com filtro de situação (aberto/pago/todos)
- [ ] 6.2.4 Criar `src/pages/Financeiro/components/PayablesTable.tsx` — tabela de títulos a pagar: Fornecedor, Data Vencimento, Valor, Situação
- [ ] 6.2.5 Criar `src/pages/Financeiro/components/CashFlowChart.tsx` — gráfico de área com duas séries: entradas (verde) e saídas (vermelho) por período

#### 6.3 Página Financeiro

- [ ] 6.3.1 Criar `src/pages/Financeiro/index.tsx` com: FinanceKpis, Tabs (Receber | Pagar | Fluxo de Caixa | DRE)
- [ ] 6.3.2 Implementar visualização de DRE: tabela hierárquica com grupos contábeis e totalizadores
- [ ] 6.3.3 Implementar loading states e tratamento de erro

---

### Sprint 7 — Módulo Relatórios e Gráficos Reutilizáveis

**Objetivo:** Módulo de relatórios e componentes de gráficos reutilizáveis.

#### 7.1 Componentes de Gráficos Reutilizáveis

- [ ] 7.1.1 Criar `src/components/charts/AreaChart.tsx` — componente Recharts de AreaChart com config padrão (cores, tooltip, responsividade)
- [ ] 7.1.2 Criar `src/components/charts/BarChart.tsx` — componente de barras verticais com tooltips e cores do design system
- [ ] 7.1.3 Criar `src/components/charts/HorizontalBarChart.tsx` — barras horizontais para rankings
- [ ] 7.1.4 Criar `src/components/charts/PieChart.tsx` — gráfico de pizza/donut para distribuições

#### 7.2 Endpoints de Relatórios

- [ ] 7.2.1 Adicionar em `src/api/endpoints/relatorios.ts`:
  - `fetchMapaDesempenho(params)` → `GET /INTEGRACAO/RELATORIO/MAPA_DESEMPENHO`
  - `fetchVendaPeriodo(params)` → `GET /INTEGRACAO/RELATORIO/VENDA_PERIODO`
  - `fetchRelatorioPersonalizado(codigo, params)` → `GET /INTEGRACAO/RELATORIO/RELATORIO_PERSONALIZADO/{codigo}`
  - `fetchRelatoriosDisponiveis(params)` → `GET /INTEGRACAO/RELATORIO_PERSONALIZADO`

#### 7.3 Componentes de Relatórios

- [ ] 7.3.1 Criar `src/pages/Relatorios/components/ReportSelector.tsx` — lista/grid de relatórios disponíveis com nome e descrição, selecionável
- [ ] 7.3.2 Criar `src/pages/Relatorios/components/ReportViewer.tsx` — visualizador do relatório selecionado com parâmetros dinâmicos (data, empresa, produto, etc.) e resultado renderizado

#### 7.4 Página de Relatórios

- [ ] 7.4.1 Criar `src/pages/Relatorios/index.tsx` com: ReportSelector à esquerda/topo, ReportViewer como área principal
- [ ] 7.4.2 Implementar loading states e tratamento de erro

---

### Sprint 8 — Polish, Responsividade e Refinamentos

**Objetivo:** Refinamento visual, responsividade completa, tratamento de edge cases.

#### 8.1 Responsividade

- [ ] 8.1.1 Testar e ajustar Sidebar em tablet (colapsada por padrão) e mobile (oculta com menu hambúrguer via Sheet do shadcn/ui)
- [ ] 8.1.2 Testar e ajustar KpiGrid: 4-5 colunas desktop, 2 tablet, 1 mobile
- [ ] 8.1.3 Testar e ajustar DataTable: scroll horizontal em telas menores
- [ ] 8.1.4 Testar e ajustar gráficos Recharts: `<ResponsiveContainer>` em todos os charts
- [ ] 8.1.5 Testar e ajustar FilterBar: empilhada em mobile

#### 8.2 Loading e Error States

- [ ] 8.2.1 Implementar skeletons (shadcn/ui Skeleton) em todos os KpiCards enquanto dados carregam
- [ ] 8.2.2 Implementar skeletons em todas as tabelas enquanto dados carregam
- [ ] 8.2.3 Implementar componente de erro amigável ("Não foi possível carregar os dados. Tente novamente.") com botão de retry
- [ ] 8.2.4 Implementar empty state quando não há dados para o período/empresa selecionado

#### 8.3 Refinamentos Visuais

- [ ] 8.3.1 Revisar consistência de espaçamentos (padding, margin, gap) em todos os módulos
- [ ] 8.3.2 Revisar consistência de cores (heatmap, variações, ícones) em todos os módulos
- [ ] 8.3.3 Revisar formatação de números (moeda, percentual, litros) em todos os módulos
- [ ] 8.3.4 Adicionar animações sutis de transição entre abas e carregamento de dados
- [ ] 8.3.5 Revisar acessibilidade: contraste de cores, aria-labels em componentes interativos

#### 8.4 Cross-filter e Navegação

- [ ] 8.4.1 Implementar cross-filter do Dashboard para módulo Combustíveis (clique no SectorCard → navega com filtro de grupo)
- [ ] 8.4.2 Implementar cross-filter do Dashboard para módulo Produtos
- [ ] 8.4.3 Implementar cross-filter do Dashboard para módulo Conveniências
- [ ] 8.4.4 Implementar breadcrumb ou indicador visual de filtro pré-aplicado via cross-filter

#### 8.5 Validação Final READ-ONLY

- [ ] 8.5.1 Auditar todo o código para garantir zero `useMutation` imports
- [ ] 8.5.2 Auditar todo o código para garantir zero chamadas `.post()`, `.put()`, `.delete()`, `.patch()` (exceto auth.ts)
- [ ] 8.5.3 Auditar toda a interface para garantir zero botões de criar/editar/excluir
- [ ] 8.5.4 Verificar no DevTools (aba Network) que nenhuma requisição não-GET é disparada durante uso completo do sistema
- [ ] 8.5.5 Verificar que o interceptor HTTP rejeita tentativas manuais de POST/PUT/DELETE

---

## Apêndice A — Endpoints GET Utilizados por Módulo

| Módulo | Endpoints GET |
|---|---|
| **Auth** | POST /auth (única exceção) |
| **Filtros Globais** | `/EMPRESAS` |
| **Dashboard** | `/VENDA_RESUMO`, `/VENDA`, `/EMPRESAS` |
| **Combustíveis** | `/ABASTECIMENTO`, `/TANQUE`, `/BICO`, `/BOMBA`, `/LMC`, `/TROCA_PRECO` |
| **Produtos** | `/VENDA_ITEM`, `/PRODUTO`, `/GRUPO`, `/PRODUTO_META`, `/GRUPO_META` |
| **Conveniências** | `/VENDA_ITEM`, `/PRODUTO`, `/GRUPO` |
| **Estoques** | `/PRODUTO_ESTOQUE`, `/ESTOQUE`, `/ESTOQUE_PERIODO`, `/CONTAGEM_ESTOQUE` |
| **Produtividade** | `/RELATORIO/PRODUTIVIDADE_FUNCIONARIO`, `/FUNCIONARIO`, `/FUNCIONARIO_META`, `/PLACARES` |
| **Financeiro** | `/TITULO_RECEBER`, `/TITULO_PAGAR`, `/DUPLICATA`, `/MOVIMENTO_CONTA`, `/DRE`, `/CAIXA`, `/CONTA` |
| **Relatórios** | `/RELATORIO/MAPA_DESEMPENHO`, `/RELATORIO/VENDA_PERIODO`, `/RELATORIO/RELATORIO_PERSONALIZADO/{codigo}`, `/RELATORIO_PERSONALIZADO` |

## Apêndice B — Parâmetros Comuns da API

| Parâmetro | Tipo | Uso |
|---|---|---|
| `empresaCodigo` | int32 | Filtro por empresa (código da empresa no sistema Quality) |
| `dataInicial` | date (yyyy-MM-dd) | Início do período de consulta |
| `dataFinal` | date (yyyy-MM-dd) | Fim do período de consulta |
| `ultimoCodigo` | int32 | Cursor de paginação (último código retornado) |
| `limite` | int32 | Quantidade de registros por página |
| `tipoData` | enum | Tipo de data para filtro (EMISSAO, ENTRADA, FISCAL, MOVIMENTO) |
| `situacao` | string/enum | Situação do registro (A=Autorizada, C=Cancelada, T=Todas) |
| `dataHoraAtualizacao` | datetime | Filtro por última atualização (para sincronização incremental) |

## Apêndice C — Regra de Ouro READ-ONLY (Checklist de Validação)

- [ ] O `src/api/client.ts` possui interceptor que rejeita métodos não-GET
- [ ] A exceção do interceptor só se aplica a POST em rota de autenticação
- [ ] Nenhum arquivo em `src/api/endpoints/` (exceto `auth.ts`) importa ou usa `.post()`, `.put()`, `.delete()`, `.patch()`
- [ ] Nenhum arquivo em `src/api/types/` define tipos de request body para escrita
- [ ] Nenhum componente usa `useMutation` do TanStack Query
- [ ] Nenhum componente renderiza botões de "Criar", "Novo", "Editar", "Salvar", "Excluir", "Deletar"
- [ ] Nenhum formulário envia dados para a API (formulários existem apenas como filtros de consulta)
- [ ] O DevTools Network mostra apenas requisições GET (e um único POST de login)
