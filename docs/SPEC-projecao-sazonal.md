# SPEC — Projeção Sazonal (fator month-end ponderado por dia-da-semana)

Status: **aprovada** (14/07/2026) · substitui gradualmente o `esperado` do `projecaoAvancada`.

## Objetivo

Projeção de fechamento do mês mais **estável e explicável** que a atual, com:
- Ramo **linear** para postos novos (`dias_operação < 90`).
- Ramo **ponderado por dia-da-semana** (índice histórico de 6 meses) para postos estabelecidos.
- **Sem descontinuidade** dentro do mês (decisão de ramo fixada no dia 1).

## Fórmula (reescrita)

A projeção é um **month-end factor ponderado**:

```
esperado = acumulado_mês × ( Σ índice[dias do mês] / Σ índice[dias já fechados] )
```

- Ramo **linear** (`dias_operação < 90`): `índice[wd] = 1 ∀ wd` → o fator vira `dias_do_mês / dias_corridos` (= o `monthEndFactor` atual).
- Ramo **ponderado** (`≥ 90`): `índice[wd]` = média histórica da venda naquele dia-da-semana ÷ média histórica de todos os dias (6 meses).

`acumulado_mês` = Σ dias FECHADOS (`< hoje`); o dia corrente entra como restante (projetado).

## Decisões travadas

| Item | Decisão |
|---|---|
| `dias_operação` | **Híbrido**: proxy por 1ª venda no cache + override manual (tabela Supabase). Guarda: histórico ≥90 dias ⇒ estabelecido. |
| Escopo do índice | **Por posto**; projeção da rede = soma das projeções por posto. |
| Janela do índice | **6 meses** rolling, excluindo o mês parcial corrente. |
| Índice por métrica | Sim (litros/faturamento/lucro/qtd calculam índice sobre a série daquela métrica). |
| Fallback do índice | `índice[wd] = 1` quando <2 amostras no dia-da-semana. |
| Corte 90 dias | Avaliado **no dia 1** do mês de análise, fixo o mês inteiro (sem salto intra-mês). |
| Recálculo | On-the-fly do cache (barato ~180 linhas/posto); sem materialização na v1. |

## Núcleo (`src/lib/projection.ts`)

Funções puras:

```ts
// Índice de dia-da-semana a partir de uma série histórica diária (6m).
weekdayIndices(dailySeries, { minSamples = 2 }): Record<number /*0=Dom..6=Sáb*/, number>

// dias_operação por proxy de 1ª venda, com guarda anti-cache-raso.
diasOperacaoProxy(primeiraVendaISO, hojeISO, { estabelecidoSeHistoricoDias = 90 }): number

// Projeção sazonal — mesmo contrato de retorno do projecaoAvancada
// (realizado/esperado/conservador/otimista/cenários/confiabilidade/sparkline),
// só muda como o `esperado` é calculado.
projecaoSazonal({ dailySeries, today, dataFinal, indices }): ProjecaoAvancadaResult
```

- O ramo (linear × ponderado) é decidido pelo **caller** (no dia 1, via `dias_operação`) e materializado passando `indices` reais ou todos `= 1`.
- `esperado = realizado × (Σíndice_todos / Σíndice_fechados)`, somando índice por **dia de calendário** (não por dia com dado).
- Cenários (banda por coef. de variação) e confiabilidade preservados **em volta** do novo `esperado` → contrato da UI intacto.

## `dias_operação` (híbrido)

- **Proxy**: `hoje − primeira_venda_do_posto` (menor `data` no cache do posto).
- **Guarda**: se o histórico do posto abrange ≥ 90 dias → estabelecido (ignora proxy raso).
- **Override**: tabela `posto_inauguracao(rede_id, empresa_codigo, data_inauguracao)` — prevalece quando existe. (Pode entrar em fase posterior; v1 pode rodar só no proxy.)

## Agregação da rede (por posto, soma)

A Central projeta **cada posto** com seu índice + ramo próprios e **soma**. Reaproveita o dado por-posto do `useRedeSetores`, adicionando os índices históricos por posto.

## Plumbing por superfície

Cada tela passa a fornecer, além da série do mês corrente (já tem):
- série **histórica 6m por posto/métrica** (cache);
- `dias_operação` por posto (proxy + override).

Utilitários novos: `usePostoIndices(scope, métrica)`, `usePostoDiasOperacao(scope)`.

## Rollout (faseado, com flag de comparação)

1. **Engine + utilitários puros** em `projection.ts`. ← Fase 1
2. **Piloto no Combustível** atrás de flag, comparando número novo × atual.
3. Rollout: Central (soma por posto) → Pista/Conveniência → Comercial·Projeção de LB → mobile.
4. Aposentar o cálculo antigo de `esperado` (mantendo cenários/confiabilidade).

## Riscos

- **Blast radius**: `projecaoAvancada` alimenta todas as superfícies de projeção → flag + piloto obrigatórios.
- **Override table**: exige migration Supabase — adiável (proxy puro na v1).
- Posto novo tem <90d **e** pouco histórico → linear é a escolha certa (índice seria ruído).
- Sem framework de teste no projeto hoje — funções puras validadas por `tsc` + probes; adicionar vitest é decisão à parte.
