# Agentes de IA — CCISGA

Time de agentes especializados para o desenvolvimento do CCISGA.

> **Regra de Ouro:** Todos os agentes devem respeitar que o sistema é **READ-ONLY**. Apenas GET (exceção: POST para login).

## Agentes

| Agente | Arquivo | Quando Usar |
|---|---|---|
| **Frontend Developer** | [frontend.md](frontend.md) | Implementar páginas, componentes, hooks, layout, roteamento, design system |
| **API Integration** | [api-integration.md](api-integration.md) | Criar client HTTP, funções de endpoint, tipos TypeScript, store Zustand |
| **QA Tester** | [qa-tester.md](qa-tester.md) | Testar no navegador: fluxos, design, responsividade, auditoria READ-ONLY |

## Como Escolher o Agente

```
Preciso criar/editar um componente React, página ou layout?
  → Frontend Developer

Preciso criar/editar endpoint, tipo da API, client HTTP ou store?
  → API Integration

Preciso verificar se algo funciona no navegador?
  → QA Tester
```

## MCP Servers

| Server | Usado por | Função |
|---|---|---|
| **Context7** | Frontend, API Integration | Consultar docs atualizadas das libs (React, shadcn/ui, TailwindCSS, Recharts, Axios, TanStack Query, Zustand, React Router, Lucide) |
| **Playwright** | QA Tester | Interagir com o sistema no navegador (navegar, clicar, preencher, screenshot, monitorar rede) |

## Fluxo de Trabalho

1. **API Integration** cria os tipos e endpoints para o módulo
2. **Frontend Developer** implementa a página e componentes usando os endpoints
3. **QA Tester** verifica no navegador se tudo funciona e segue o design

## Referências

- Documentação do projeto: [docs/README.md](../docs/README.md)
- PRD completo: [docs/PRD.md](../docs/PRD.md)
- Tarefas por sprint: [docs/TASKS.md](../docs/TASKS.md)