# TopBar — Padrão de cabeçalho consolidado

Padrão definitivo do cabeçalho de tela do Visor360. Maximiza a área útil dos
dashboards reunindo **título + filtros globais** numa única barra densa e fixa.

## Anatomia (telas padrão)

```
┌───────────────────────────────────────────────────────────────────────┐
│ Header (chrome, h-12)   tenant ······················ tray  ↻  🔔        │  ← não rola
├───────────────────────────────────────────────────────────────────────┤
│ TopBar (≤70px)   [título] ········ [posto][período][escopo][comparativo]│  ← fixa, sombra ao rolar
├───────────────────────────────────────────────────────────────────────┤
│ <main> (rola)    KPIs · cards · gráficos · tabelas                      │
└───────────────────────────────────────────────────────────────────────┘
```

Duas barras fixas (irmãs do `<main>`, que é o único elemento com scroll):

- **Header** (`components/layout/Header.tsx`, `h-12`) — chrome puro: seletor de
  rede, bandeja de ações por módulo (`HEADER_TRAY_SLOT_ID`), refresh e sino.
- **TopBar** (`components/layout/TopBar.tsx`) — título + filtros. Altura ≤70px;
  total do topo ~96px.

## Componentes

| Componente | Papel |
|---|---|
| `components/layout/TopBar.tsx` | Barra presentacional (props: `title`, `actions`, `scrolled`). Fonte única do layout — sem estado, evita forks. |
| `components/filters/GlobalFilterControls.tsx` | Cluster único de filtros: **posto → período → escopo → comparativo**. Esconde o posto quando há só 1 empresa permitida. |
| `components/filters/DateRangeToolbar.tsx` | Período (mês + datas + Visualizar). Compacto, sem labels empilhados — contexto via `title`/tooltip. |
| `components/layout/PageHeaderTitle.tsx` | Portal: a página injeta o bloco de título no slot da TopBar. |
| `components/layout/PageHeaderActions.tsx` | Portal: a página injeta o `DateRangeToolbar` no slot de período. |

## Como uma tela usa o padrão

A montagem é central no `AppLayout` — a página **não** desenha a barra, só
preenche os slots via portal:

```tsx
// Dentro da página (ex.: Dashboard, Combustível, Conveniências…)
<PageHeaderTitle>
  <div className="flex items-center gap-2">
    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1e3a5f]">
      <Icon className="h-4 w-4 text-white" />
    </div>
    <div className="min-w-0">
      <h1 className="truncate text-sm font-bold …">Título da tela</h1>
      <p className="truncate text-[11px] …">Subtítulo</p>
    </div>
  </div>
</PageHeaderTitle>

<PageHeaderActions>
  <DateRangeToolbar />
</PageHeaderActions>
```

O `AppLayout` faz o resto:

```tsx
{showFilters && (
  <TopBar
    scrolled={scrolled}
    title={<div id={PAGE_HEADER_TITLE_SLOT_ID} className="flex min-w-0 flex-1 items-center" />}
    actions={<GlobalFilterControls dateSlot={<div id={PAGE_HEADER_ACTIONS_SLOT_ID} … />} />}
  />
)}
```

`showFilters` vem de `lib/globalFilters.ts` (`showsGlobalFilters`). Telas de
nível de rede (Admin, Configurações, Selecionar rede) e a Inteligência ficam de
fora — elas têm controles próprios.

## Exceção documentada: Inteligência da Rede

A Inteligência tem abas no topo (Análise · Radar · Cadu IA) e filtros só na aba
Radar, então monta a própria barra sticky. Mas **reusa `GlobalFilterControls`**
(`dateSlot={<DateRangeToolbar />}`), garantindo o mesmo cluster/ordem/larguras —
sem duplicar a lógica. É o único fork de layout, e é intencional.

## Regras de responsividade

- **≥1366px**: tudo numa linha. O título é `flex-1 min-w-0` e trunca pra ceder
  espaço aos filtros.
- **<1366px**: `flex-wrap` desce os filtros pra 2ª linha (quebra controlada).
- Larguras fixas dos controles (posto `w-[200px] xl:w-[240px]`, mês
  `min-w-[124px]`, datas `w-[118px]`) são **deliberadas e wrap-safe** — em telas
  estreitas o cluster inteiro quebra de linha, nunca espreme os campos.

## Sticky e scroll

A TopBar **não** usa `position: sticky` — é irmã do `<main>` num flex column com
`overflow-hidden` no pai, então fica naturalmente fixa e **nunca sobrepõe** o
conteúdo. O `AppLayout` escuta o scroll do `<main>` e alterna
`shadow-sm → shadow-md` (com `transition-shadow`) pra dar feedback de barra fixa.

## Ao criar uma tela nova

1. Renderize `<PageHeaderTitle>` com ícone + `h1` + subtítulo (padrão compacto:
   ícone `h-7 w-7`, título `text-sm`, subtítulo `text-[11px]`).
2. Renderize `<PageHeaderActions><DateRangeToolbar /></PageHeaderActions>` se a
   tela usa período.
3. Não desenhe barra própria nem reinstancie os filtros — o `AppLayout` cuida.
4. Se a rota não deve ter filtros globais, adicione-a em `ROTAS_SEM_FILTROS`
   (`lib/globalFilters.ts`).
