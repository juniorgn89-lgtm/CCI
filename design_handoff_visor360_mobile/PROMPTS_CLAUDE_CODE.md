# Prompts para o Claude Code — Visor360 Mobile

Cole estes prompts **em sequência** no chat do Claude Code, com o repositório **`CCI`** aberto no VSCode e a pasta `design_handoff_visor360_mobile/` copiada para a raiz.

**Regras gerais (valem para todos os prompts):**
- Faça **uma fase/tela por vez**. Revise o diff, rode `lint` + `build`, teste no navegador e só então avance.
- O protótipo (`Visor360 Mobile.html` + `app/*.jsx`) é **referência** — reimplemente no stack real (React + Tailwind + shadcn/ui + lucide-react + Recharts), reaproveitando componentes e dark mode existentes.
- **Read-only: nunca** crie ações de CRUD, formulários de cadastro, FAB ou swipe-to-delete.

---

## 0 · Contexto inicial (mande primeiro, uma vez)

```
Estou implementando a versão mobile do Visor360 neste repositório.

Leia primeiro:
- design_handoff_visor360_mobile/README.md  (especificação completa do design)
- design_handoff_visor360_mobile/IMPLEMENTACAO.md  (roteiro faseado + checklist)

O protótipo em design_handoff_visor360_mobile/Visor360 Mobile.html e app/*.jsx é
APENAS referência (HTML + Babel no navegador + dados mock). Reimplemente no nosso
stack real: React + TailwindCSS + shadcn/ui + lucide-react + Recharts, reaproveitando
nossos componentes e o dark mode já existentes no repo.

Produto READ-ONLY: nada de CRUD, formulários de cadastro, FAB ou swipe-to-delete.

Não escreva código ainda. Me devolva:
1. Um resumo de como vai estruturar pastas/arquivos no nosso projeto.
2. Quais componentes do nosso codebase você vai reaproveitar e quais vai criar.
3. O plano da Fase 0 (Fundação) em passos pequenos e revisáveis.
```

---

## 1 · Fase 0 — Fundação

```
Vamos implementar a Fase 0 (Fundação) do IMPLEMENTACAO.md. Faça em passos pequenos,
um commit lógico por item, e me mostre o diff antes de seguir para o próximo:

1. Tokens & tema: mapear cores/tipografia/espaçamento do README para nossos tokens
   (Tailwind/shadcn), garantindo light e dark (dark = VSCode Dark Modern).
2. Shell mobile: header navy (≤56px) com pill "Tempo real", sino e botão de tema +
   <main> rolável com safe areas.
3. Bottom-nav (4 itens) + drawer "Mais" com módulos agrupados (Geral/Posto/Gestão/Análise);
   personalização: fixar até 4, persistir em localStorage 'visor360.bar', toque-longo
   no "Mais" abre em modo edição.
4. Painel de Filtros como bottom-sheet que DESCE DO TOPO: Posto / Período (mês + datas) /
   Escopo (segmented) / Comparativo (segmented) + botão "Visualizar"; o resumo na barra
   reflete o período real; conecte ao nosso filter store. Não exibir "vs mês ant." na barra.
5. Roteamento dos ~12 módulos no React Router + transição de tela (fade-up).

Critério de pronto: navegar entre telas vazias com header, filtros e nav funcionando,
em light e dark.
```

---

## 2 · Fase 1 — Biblioteca de componentes

```
Agora a Fase 1 (Biblioteca de componentes). Crie componentes reutilizáveis, com
light/dark, e adicione ao nosso Storybook/catálogo se houver:

- KpiCard + DeltaBadge (chip de ícone, valor grande, delta ▲/▼ "vs <ref>", variantes big/span)
- Section (Card com header de chip + título + slot direito; modo "flush" para tabelas)
- Badge / MarginPill (heatmap de margem verde/âmbar/vermelho por limiar)
- Segmented e ScrollTabs (roláveis)
- ProjecaoSection (cards "total" com barra cumulativa e cards "razão/tendência" sem barra;
  header com badge "Dia 30/31" + barra de período decorrido)
- Gráficos em Recharts: AreaChart (área + linha tracejada secundária), BarChart (último
  destacado), ranking de barras horizontais, Donut (total no centro + legenda). Crie um
  wrapper com a sequência de cores do README e suporte a tema.
- Estados: LoadingScreen (skeleton com etapas), EmptyCard (âmbar "sem dados"),
  NoCostNote ("sem custo apurado"), Skel (shimmer).

Me mostre cada componente isolado (props + exemplo) antes de usá-los nas telas.
```

---

## 3 · Fase 2 — Telas prioritárias

> Mande **um prompt por tela**, na ordem. Em todas: ligar dados reais via React Query
> respeitando o filtro global, cobrir loading/vazio, números em pt-BR.

**3.1 Central da Rede**
```
Implemente a tela "Central da Rede" conforme o README (seção Geral). KPIs consolidados,
evolução mensal (área faturamento + linha de margem com toggle), ranking de postos
(barra de share + pílula de margem heatmap + faturamento + projeção inline + delta),
donut de formas de pagamento, e a seção "Projeção do mês" (6 métricas). Esta tela NÃO
tem barra de filtro (é a visão consolidada da rede). Dados reais via React Query.
```

**3.2 Vendas › Combustível**
```
Implemente "Vendas" com abas roláveis (Visão Geral · Combustível · Pista · Conveniência)
e construa a aba "Combustível": KPIs 2×2 (Litros, Lucro Bruto, Margem, L.B./litro), nota
"sem custo apurado", seção de Projeção (Litros, Faturamento, Lucro Bruto + Margem e
L.B./litro como razão/tendência), volume mensal (barras) e margem mensal (área), e a
TABELA "Por combustível" com colunas priorizadas (nome+litros, L.Bruto, Margem heatmap),
projeção inline âmbar em cada coluna, e linha que expande ao tocar.
```

**3.3 Caixas & Turnos**
```
Implemente "Caixas & Turnos": KPIs (Total em caixa, Projeção do dia, Diferença, Turnos
abertos), tabela "Turnos de hoje" (operador/período, valor, diferença; turno ABERTO
mostra projeção de fechamento; linha expande para Informado/Sistema/Diferença) e
"Conferência de caixa" (barras +/−).
```

**3.4 Fechamentos**
```
Implemente "Fechamentos": card de status do mês, KPIs (dias apurados/pendentes, valor
conferido, diferença acumulada), CALENDÁRIO de apuração (grade 7 colunas, dias coloridos
por status apurado/hoje/pendente/futuro + legenda), Pendências (dias sem custo), Últimos
fechamentos (tabela) e Apuração por posto (barras de progresso).
```

**3.5 Inteligência › Radar de Preços**
```
Implemente "Inteligência" com abas (Análise & Comparação · Radar de Preços · Cadu IA) e
construa a aba "Radar de Preços": KPIs (posição média, atualizado), placeholder de mapa
(a integração do provedor fica para depois), "Meus preços vs mercado" (por produto: preço,
posição, barra de range min/máx com marcadores meu/mercado) e "Concorrentes próximos" (tabela).
```

---

## 4 · Fase 3 — Demais abas e módulos

```
Vamos completar a Fase 3. Implemente, uma de cada vez (me mostrando o diff entre cada):
Vendas › Visão Geral, Vendas › Pista, Vendas › Conveniência, Inteligência › Análise &
Comparação, Financeiro, Estoques, Bombas, Produtividade, Qualidade de Dados, Pessoas.
Para cada uma, siga a especificação do README e o checklist por tela do IMPLEMENTACAO.md.
A aba "Cadu IA" depende da integração com nosso serviço de IA — deixe um placeholder
funcional e me avise o que precisa para integrar.
```

---

## 5 · Fase 4 — Polimento e produção

```
Fase 4 (polimento). Faça em itens separados:
1. Microinterações: transições de tela/aba (fade-up), press nos botões, indicador
   deslizante e "pop" do ícone no bottom-nav.
2. Acessibilidade: alvos ≥44px, contraste, foco visível, rótulos para leitor de tela.
3. Responsividade 320→430px (1 col → 2 col) e ajustes para aparelhos reais.
4. Desempenho: memoizar gráficos e listas; lazy-load dos módulos menos usados.
5. Rode lint + build + testes e gere um resumo do que falta para subir no nosso pipeline.
```

---

## Dicas de uso
- Se o Claude divergir do design, aponte a seção específica do `README.md`.
- Peça sempre o **diff** e rode o app antes de aceitar.
- Faça **commits pequenos** por tela/componente — facilita revisar e reverter.
- As **decisões de negócio** (fórmula das projeções, origem do Radar/mapa, Cadu IA,
  escopo da personalização, estratégia de "tempo real") estão no fim do `IMPLEMENTACAO.md`
  — alinhe com seu time antes das fases que dependem delas.
```
