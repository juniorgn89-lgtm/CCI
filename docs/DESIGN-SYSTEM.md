# Design System

## Cores

| Token | Hex | Uso |
|---|---|---|
| Primary | `#1e3a5f` (navy) | Sidebar, headers, botões primários |
| Accent | `#2563eb` (blue) | Links, item ativo, focus rings |
| Background | `#ffffff` | Fundo principal |
| Background Secondary | `#f9fafb` (gray-50) | Fundo de cards, área de conteúdo |
| Border | `#e5e7eb` (gray-200) | Bordas de cards, tabelas, inputs |
| Positive | `#22c55e` (green-500) | Variações positivas |
| Negative | `#ef4444` (red-500) | Variações negativas |
| Warning | `#f59e0b` (amber-500) | Alertas |
| Text | `#111827` (gray-900) | Texto principal |
| Text Secondary | `#6b7280` (gray-500) | Labels, texto auxiliar |
| Table Header | `#f3f4f6` (gray-100) | Cabeçalho de tabelas |

Cores de gráficos (sequência): `#1e3a5f`, `#2563eb`, `#3b82f6`, `#60a5fa`, `#93c5fd`.

## Tipografia

Fonte: **Inter** (Google Fonts). Pesos: 400, 500, 600, 700.

| Elemento | Peso | Tamanho |
|---|---|---|
| KPI valor principal | 700 | text-3xl (30px) |
| KPI valor secundário | 600 | text-2xl (24px) |
| Título de seção | 600 | text-lg (18px) |
| Texto de tabela | 400 | text-sm (14px) |
| Labels | 500 | text-xs (12px) |

## Componentes

### Botões

Usados apenas para filtrar, navegar, alternar abas e exportar. Sem botões de CRUD.

| Variante | Classes |
|---|---|
| Primário | `bg-[#1e3a5f] text-white hover:bg-[#2a4a73] rounded-lg` |
| Secundário | `border border-gray-200 bg-transparent hover:bg-gray-50 rounded-lg` |
| Ghost | `bg-transparent hover:bg-gray-100 rounded-lg` |

Tamanhos: `sm` (h-8 px-3), `md` (h-10 px-4), `lg` (h-12 px-6).

### Inputs

Usados exclusivamente em filtros de consulta (selects, date pickers). Sem formulários de envio.

- Border: `border-gray-200 rounded-lg`
- Focus: `ring-2 ring-[#2563eb] ring-offset-1`
- Label: acima do campo, `text-sm font-medium text-gray-700`

### KPI Card

```
┌─────────────────────────────┐
│ Icon  Label         ▲ +12%  │
│                              │
│ R$ 1.234.567                │
│                              │
│ vs. anterior: R$ 1.1M      │
└─────────────────────────────┘
```

Classes: `bg-white rounded-xl border border-gray-200 shadow-sm p-6`

### Tabelas

- Header: `bg-gray-100 text-gray-600 text-xs font-medium uppercase`
- Linhas alternadas: `even:bg-gray-50`
- Hover: `hover:bg-blue-50`
- Divisor: `divide-y divide-gray-200`
- Heatmap positivo: gradiente de `bg-green-50` a `bg-green-200`
- Heatmap negativo: gradiente de `bg-red-50` a `bg-red-200`

### Sidebar

- Expandida: `w-64`, colapsada: `w-16`
- Background: `bg-[#1e3a5f]`
- Texto: `text-white/70 hover:text-white`
- Item ativo: `bg-white/10 border-l-4 border-[#2563eb] text-white`
- Ícones: Lucide React

### Gráficos (Recharts)

| Tipo | Uso |
|---|---|
| Área/Linha | Séries temporais (evolução mensal, fluxo de caixa) |
| Barras verticais | Comparativos por período |
| Barras horizontais | Rankings (funcionários, produtos) |
| Pizza/Donut | Distribuições (formas de pagamento) |

## Grid Responsivo

| Breakpoint | KPI Grid | Sidebar |
|---|---|---|
| Desktop (1280px+) | 4-5 colunas | Expandida (`w-64`) |
| Tablet (768px) | 2 colunas | Colapsada (`w-16`) |
| Mobile (320px) | 1 coluna | Oculta (menu hambúrguer) |