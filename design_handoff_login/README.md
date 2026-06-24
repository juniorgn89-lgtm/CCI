# Handoff: Redesign da tela de Login + correção do tema padrão

> **Duas entregas num pacote:** (1) **bug do tema** — o sistema abre sempre no escuro porque o default é `'dark'`; deve ser `'system'`; (2) **redesign visual** da tela de login (corporativo sóbrio em navy). O bug é correção de 1 linha e independe do redesign — pode ir primeiro.
>
> **Prompt pronto pro Claude Code** em [▶ Prompt](#-prompt-para-o-claude-code). Anexe as 2 imagens de `screenshots/`.

---

## ▶ Prompt para o Claude Code

> Duas tarefas no Visor360 (React + TS + Tailwind + Zustand):
>
> **1) Corrigir o tema padrão (bug):** em `src/store/theme.ts`, a função `getStoredMode()` retorna `'dark'` como fallback pra quem nunca escolheu tema — por isso o sistema "abre sempre escuro" e parece não respeitar o usuário. Troque o fallback de `return 'dark'` para **`return 'system'`** (segue o tema do SO). Os modos `light`/`dark`/`system` e a escolha manual persistida continuam iguais. Só o default muda.
>
> **2) Redesenhar a tela de login** (`src/pages/Login/index.tsx`): trocar o visual atual (teal escuro + amarelo, datado) por um **split corporativo sóbrio em navy**, conforme o protótipo `Login v4 Premium.dc.html` e as 2 imagens anexas. Estrutura: **painel esquerdo** (navy, marca + headline + prévia do dashboard + sinais de confiança) e **painel direito** (formulário em fundo claro, abas Gerente/Frentista). Mantém toda a lógica existente (`useAuth`, `useFrentistaAuth`, `EsqueciSenhaModal`, `LoginQrCode`, prefetch) — **só muda a apresentação**.
>
> **Imagens/HTML são REFERÊNCIA de design** — recrie com os componentes do projeto (`Input`, `Button`, `cn`, ícones Lucide). Responsivo: em telas `< lg`, esconder o painel esquerdo e mostrar só o formulário (full width), como o login atual já faz.

---

## 1) O bug do tema (prioritário, independente)

**Sintoma:** o sistema abre no modo escuro mesmo pra quem não escolheu — "não obedece a configuração do usuário".

**Causa:** `src/store/theme.ts`, em `getStoredMode()`:
```ts
// Default: tema escuro (identidade CCI) pra quem nunca escolheu.
return 'dark'
```
Não existe config pra quem nunca tocou no tema — e o fallback está cravado em `'dark'`. O store já suporta 3 modos (`light` / `dark` / `system`) e já tem `computeDark()` + listener de `prefers-color-scheme`. Só o default está errado.

**Correção (1 linha):**
```ts
// Default: segue o tema do sistema operacional do usuário.
return 'system'
```
Efeito: quem usa o SO claro vê claro; quem usa escuro vê escuro; quem escolheu manualmente continua mandando (a escolha é persistida em `localStorage`). Nada mais muda.

> O **fundo navy da tela de login** é decorativo e intencional — não depende do tema. O que vazava pro resto do app era só o default acima.

---

## 2) Redesign da tela de login

### Direção
**Corporativo sóbrio em navy** — abandona o teal datado + amarelo. Usa o navy/azul do próprio sistema (`#1e3a5f` / `#2563eb`). Layout **split**: marca à esquerda (vende o produto), formulário à direita (foco na ação).

### Onde implementar
| Arquivo | Mudança |
|---|---|
| `src/pages/Login/index.tsx` | Reescrever o markup/visual. **Manter** todos os hooks, handlers, estados e subcomponentes existentes (`useAuth`, `useFrentistaAuth`, `EsqueciSenhaModal`, `SecurityBadge`, `LoginQrCode`, `FrentistaCarScene` — esta última pode ser aposentada, ver abaixo). |
| `src/pages/Login/components/*` | `SecurityBadge` reaproveitado. `FrentistaCarScene` (caricatura) **sai** — o painel esquerdo agora mostra a prévia do dashboard. `LoginQrCode` segue no form do frentista. |

### Anatomia (spec visual)

**Painel esquerdo (navy, ~52%, escondido em `< lg`):**
- Fundo: `radial-gradient(125% 120% at 75% 0%, #27496f, #1a3050 40%, #0e1d30)` + grid sutil (linhas `rgba(255,255,255,.035)`, 44px) + 1 halo radial azul (`rgba(37,99,235,.3)`).
- **Topo:** logo (quadrado `#2563eb` radius 11 + ícone bar-chart) + "Visor360" (360 em `#60a5fa`).
- **Centro:** pill "● Plataforma de gestão de postos" (verde `#4ade80` + borda azul) · headline 36px/800 "Toda a sua rede, sob controle." · parágrafo de apoio · **card de prévia do dashboard** (3 KPIs: Faturamento R$ 9,66 mi ▲4,8% · Margem bruta 18,4% ▲0,6 p.p. · Caixas a revisar 6 de 47 · exceção; + mini-gráfico de barras "Faturamento · 7 dias +12%"). O card usa `rgba(255,255,255,.08)` translúcido com borda clara.
- **Rodapé:** sinais de confiança ("Dados criptografados", "Atualização em tempo real") + "© ano CCI".

**Painel direito (claro, fundo `#fbfcfe`):**
- Bloco centralizado `max-width:380px`.
- Título "Bem-vindo de volta" (25px/800) + subtítulo.
- **Abas Gerente/Frentista** (segmented, ativo branco com sombra; Gerente texto navy, Frentista texto verde).
- **Form Gerente:** E-mail (ícone envelope) · Senha (ícone cadeado + "Esqueci" inline + olho de mostrar) · botão gradiente azul "Entrar no portal". Inputs `h:46px`, radius 11, sombra sutil, foco azul (`ring rgba(37,99,235,.12)`).
- **Form Frentista:** Código · PIN · botão gradiente **verde** "Entrar" · divisor "ou use o QR code no totem" (+ `LoginQrCode`).
- Rodapé: "Problemas para acessar? **Fale com o suporte**".

Veja `screenshots/01-gerente.png` e `02-frentista.png`.

### Comportamento
- Abas trocam o formulário (estado `mode`, já existe).
- Botão "acende" quando os campos estão preenchidos (a lógica `canSubmitGerente`/`canSubmitFrentista` já existe — manter).
- Estados de erro, loading ("Acessando..."), mostrar/ocultar senha — todos preservados.
- **Responsivo:** `< lg` esconde o painel esquerdo, formulário ocupa 100% (como hoje).

### Design Tokens
Navy `#1e3a5f`/`#27496f`/`#0e1d30` · accent `#2563eb` (hover `#1d4ed8`) · azul claro `#60a5fa` · verde frentista `#16a34a`/`#15803d` · sucesso `#4ade80`. Form claro: fundo `#fbfcfe`, card `#fff`, borda `#e2e8f0`, texto `#0f172a`/`#64748b`/`#334155`, placeholder/ícone `#94a3b8`. 
Inter; headline 36px/800 · título form 25px/800 · KPI mock 16px/800 · labels 12px/600 · inputs 14px. Radius: card 16, input/botão 11, pill 999. Sombra botão `0 10px 24px rgba(37,99,235,.34)`.
Ícones Lucide: `bar-chart-3` (marca), `mail`, `lock`, `eye`, `user`, `arrow-right`, `shield-check`, `clock`.

> **Nota de animação:** o protótipo tinha animações de entrada (fade-up) que foram **removidas** por deixarem o conteúdo instável na 1ª pintura. Mantenha as decorativas (halo flutuante, shimmer no card, barras subindo) se quiser, mas **não** anime opacity do conteúdo essencial (marca, headline, formulário) — ele deve pintar visível imediatamente.

### Escopo
As **duas abas** (Gerente + Frentista) entram no redesign. Mock do dashboard e KPIs são placeholders ilustrativos — não precisam de dado real (é tela de login, pré-autenticação).

## Assets
Nenhum asset proprietário. Ícones Lucide + Inter já no projeto. `FrentistaCarScene` aposentada (ou mantida para outro uso). `SecurityBadge`/`LoginQrCode`/`EsqueciSenhaModal` reaproveitados.

## Arquivos neste bundle
- `Login v4 Premium.dc.html` — protótipo interativo (trocar abas Gerente/Frentista).
- `screenshots/01-gerente.png` — login Gerente (split + prévia do dashboard).
- `screenshots/02-frentista.png` — aba Frentista (Código/PIN + QR no totem).
