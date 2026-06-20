# Spec — Padronização dos tooltips de ajuda ("?")

**Status:** aprovado, em execução · **Data:** 2026-06-21

## Problema
Os tooltips de "?" do sistema não têm padrão. Há **dois mecanismos incompatíveis** porque não existe um componente compartilhado:
- **`title=` nativo do browser** (~20 arquivos: TanqueCard, NivelTanquesCard, DataFilterModeSelect…) → fundo **claro** do SO, sem dark mode, ~1s de atraso, sem estilo, varia por SO/navegador.
- **Tooltip CSS custom** (`group-hover` + `bg-gray-900`, ~6 arquivos: ThWithHelp/Combustível, Pista, ProjeçõesPainel, Sidebar) → **escuro**, mas com larguras avulsas.

Sintomas: (1) cor de fundo inconsistente (claro vs escuro); (2) largura/quebra inconsistente — `whitespace-nowrap` (estoura na horizontal) vs `max-w-[140/180/220px]` (vira coluna de uma-palavra-por-linha, espremida pelo `overflow-hidden` dos cards).

## Decisões
- **Fundo canônico: ESCURO** (`bg-gray-900` / `dark:bg-gray-700`, texto branco).
- **Primitiva: Radix** (`@radix-ui/react-tooltip`, portal) — idiomático (projeto já usa shadcn/Radix). Portal escapa do `overflow-hidden` dos cards e posiciona collision-aware.
- **Largura única confortável** (~`w-64`/256px, `whitespace-normal leading-snug`) → texto longo lê em 2–4 linhas.
- **Escopo:** migrar todos os "?" de ajuda (~26 arquivos). `title=` que NÃO são "?" (texto truncado) ficam por ora.

## Componente
- `src/components/ui/tooltip.tsx` — wrapper shadcn do Radix Tooltip (Provider/Root/Trigger/Content) com o estilo canônico.
- `<InfoHint text="…" side? align? />` — o "?" (HelpCircle h-3 w-3) + tooltip. Abre no hover/focus **e no tap** (mobile). Uso inline (cards, rótulos).
- `<HeaderHint label help align groupStart />` — `<th>` pra cabeçalho de tabela; usa o InfoHint por dentro; preserva alinhamento e divisor de grupo. Substitui os `ThWithHelp` locais.
- **1 `TooltipProvider`** no root (`AppLayout`).

## Fases (build verde entre cada uma)
- **Fase 0:** dependência + `tooltip.tsx` + `InfoHint`/`HeaderHint` + Provider no AppLayout.
- **Fase 1:** cabeçalhos de tabela (consolida `ThWithHelp` locais — inclui "Var. semanal").
- **Fase 2:** cards (inclui "Litros Vendidos"/Combustível e cards de Tanque do Dashboard).
- **Fase 3:** demais `title=` nativos de "?" (~20 lugares).

## Riscos
- **Mobile/touch:** Radix Tooltip não abre no toque → InfoHint precisa abrir no tap (estado controlado) ou cair pra Popover no touch.
- `TooltipProvider` obrigatório no root.
- Preservar layout dos cabeçalhos na troca pro HeaderHint.
- ~26 arquivos → migrar em fases, revalidando.

## Validação
Build verde + conferência visual: Combustível (Var. semanal escuro; card Litros sem coluna fininha) e Dashboard/Tanque (sai do claro nativo pro escuro padrão).
