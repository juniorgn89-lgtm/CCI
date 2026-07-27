---
name: landing_page
description: Detailed measurements behind the Landing page (public "/") floating-phone clipping bug and the uiScale-zoom-on-public-route finding.
metadata:
  type: project
---

QA de 2026-07-27 na Landing institucional (`src/pages/Landing/index.tsx`, rota `/`). Ver
pointer curto em [[MEMORY]] (seção "Landing Page pública"). Detalhe técnico completo abaixo.

## Bug: phone flutuante do hero clipa no mobile

Estrutura (JSX, hero > 2º filho = painel escuro):
```
<div class="v360-hero" style="display:grid">
  <div>...texto/CTA (heropad)...</div>
  <div style="position:relative; overflow:hidden; background:radial-gradient(...)">  <!-- painel -->
    <div style="position:absolute; top:-80; right:-60; ...">          <!-- blob decorativo -->
    <div style="position:relative; padding:52px 44px 60px">           <!-- innerWrap -->
      <div style="border-radius:14px; ...">                          <!-- chrome-card -->
        <img src="/landing/analise-semanal-full.png" style="width:100%">
      </div>
      <div style="position:absolute; bottom:22; left:26; width:168; height:344; ...">  <!-- PHONE -->
    </div>
  </div>
</div>
```

O painel (`overflow:hidden`) só ganha altura do conteúdo EM FLUXO (padding + chrome-card + img).
O phone é `position:absolute` — não contribui pra altura do pai, só depende dela via `bottom:22`.

Em desktop (hero em grid 2 colunas, `align-items:stretch` — ver `.v360-hero` no CSS scoped),
o painel estica pra bater com a altura da coluna de texto (bem mais alta que o próprio conteúdo
do painel) → sobra espaço de graça → phone cabe folgado.

Quando `max-width:980px` empilha o hero em 1 coluna, o painel vira sua própria linha de grid,
sem herdar altura de ninguém — fica raso (só o que o chrome-card+padding pedem). Como o phone
precisa de painel com pelo menos `22 + 344 = 366px` de conteúdo abaixo do padding-top, e a imagem
em 1-coluna ainda não é alta o bastante em telas estreitas, o topo do phone estoura pra CIMA do
painel e o `overflow:hidden` corta esse tanto.

### Medições reais (`getBoundingClientRect`, Chromium headless, height do viewport fixo em 900px)

| largura viewport | panel.height | phone.top vs panel.top | resultado |
|---|---|---|---|
| 375px  | 287px | phone 80px ACIMA do painel | **CLIPA 80px** (corta logo "Visor360" + "LUCRO HOJE") |
| 414px  | 309px | phone 58px ACIMA do painel | **CLIPA 58px** |
| 640px  | 440px | phone 73px DENTRO do painel | OK, sem clip |
| 768px–980px | 555px | phone ~281px dentro | OK, bastante folga |
| 1024px–1440px (hero 2-col) | 556–740px | phone 44–57px dentro (perto do topo, mas dentro) | OK |

Reprodução manual: abrir `/` em 375px de largura, olhar o hero — o phone mockup aparece "cortado"
por cima, só mostra a partir de "R$ 48,9k" pra baixo (falta a mini-barra "Visor360" e o rótulo
"LUCRO HOJE" acima do valor). Confirmado tanto por medição de bounding box quanto por screenshot
recortado do elemento.

Severidade: MÉDIO pelo rubric do projeto (responsividade, quebra num range de larguras — mas é
acima da dobra, no hero, primeira coisa que um visitante mobile vê).

## Achado: uiScale (zoom global) também afeta a Landing pública

`src/lib/uiScale.ts` → `initUiScale()` é chamado incondicionalmente em `src/main.tsx` (linha 8),
antes até do React montar — não checa `window.location.pathname`. Regra (`pickZoom`):
`if (realWidth < 768) return 1` (mobile shell nunca escala) `; if (mode !== 'auto') return mode/100
; if (realWidth >= 1440) return 1 ; return max(0.75, realWidth/1440)`.

Confirmado ao vivo via `getComputedStyle(document.documentElement).zoom`:
- viewport 1280px → `zoom: "0.889"` (= 1280/1440)

Ou seja: qualquer visitante da Landing com tela entre 768px e 1439px de largura lógica (a
MAIORIA dos notebooks reais — 1280, 1366, 1280×800 etc.) recebe a página inteira escalada pra
75–95% do tamanho literal especificado no componente (h1 58px vira ~51px visualmente a 1280px,
etc.). Não quebra layout (zoom reflui, sem scroll horizontal — testado 375 a 1440px, sempre
`scrollWidth === clientWidth`), mas conflita em espírito com o comentário do próprio arquivo:
"NÃO redesenhar: textos, cores e layout são a peça oficial". O mecanismo foi pensado pro
dashboard interno (telas antigas/apertadas), não pra uma landing de marketing pixel-perfect.
Não reportei como "bug" — é uma decisão de produto pra alguém confirmar, não um defeito de
código.

## Checklist do que já foi confirmado OK (não repetir do zero)

- `/` renderiza `<Landing/>` direto (`src/routes/index.tsx` linha 54), fora do `ProtectedRoute` —
  não força login.
- Zero console errors/warnings reais (só ruído de dev: vite HMR + sugestão do React DevTools).
- Zero requests não-GET, zero 404/5xx em toda a sessão de teste (múltiplas navegações).
- `/landing/SIMBOLO.png` e `/landing/analise-semanal-full.png` existem em disco
  (`public/landing/`) com nome exato (case-sensitive OK) e servem 200.
- Fontes Bricolage Grotesque (700/800) e Instrument Sans (400/500/600) carregam de verdade via
  Google Fonts (`document.fonts.check(...)` = true, computed `font-family` do h1 e do body
  batem com o esperado — não caem pro fallback `system-ui`).
- Sem scroll horizontal em 375px nem 1280px.
- "Entrar" (nav) navega pra `/login`.
- Grids responsivos confirmados via `getComputedStyle(...).gridTemplateColumns` em 375px:
  hero, módulos e "dois públicos" todos colapsam pra 1 coluna (335px = largura cheia do
  conteúdo). Menu do topo (`.v360-navmenu`) confirma `display:none` em 375px.
- Os 4 anchors do menu (`#modulos #ia #representantes #contato`) rolam a página (scrollY muda).
  3 de 4 (`#modulos #ia #representantes`) encostam o alvo exatamente no topo do viewport.
  `#contato` não encosta (fica 661px abaixo) só porque é a ÚLTIMA seção — a página bate no fim
  do documento antes de conseguir rolar mais. Seção fica visível mesmo assim; não é bug.
- Nav do topo em 375px quebra em 2 linhas (logo sozinho; "Entrar"+"Agendar demonstração" embaixo,
  alinhados à esquerda) — cosmético, nada corta/sobrepõe, só fica um pouco desequilibrado (BAIXO).
