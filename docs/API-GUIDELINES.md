# API Guidelines

## Regra READ-ONLY

O Visor360 usa **apenas GET** para consumir dados da API Quality Automação.

**Proibido:**
- `client.post()`, `.put()`, `.delete()`, `.patch()` (exceto login)
- `useMutation` do TanStack Query
- Tipos para request bodies de escrita
- Formulários de envio de dados na UI

**Única exceção:** `POST` em `src/api/endpoints/auth.ts` para login.

## API Externa

- **Base URL:** `https://web.qualityautomacao.com.br/INTEGRACAO/`
- **Autenticação:** Query parameter `CHAVE` em todas as requisições (chave de integração por unidade de negócio)
- **Formato:** JSON (OpenAPI 3.1.0)

## Client HTTP (`src/api/client.ts`)

Instância Axios com:

1. **Interceptor GET-only:** rejeita qualquer método que não seja GET (exceto POST em rota `/auth` ou `/login`)
2. **Interceptor de auth:** injeta query parameter `CHAVE` com token armazenado em todas as requisições
3. **Interceptor de 401:** redireciona para login quando token expira

## Padrão de Endpoint (`src/api/endpoints/*.ts`)

Um arquivo por domínio. Cada arquivo exporta funções que chamam `client.get()`.

```ts
// src/api/endpoints/vendas.ts
import { client } from '@/api/client'
import { PaginatedResponse } from '@/api/types/common'
import { VendaResumo } from '@/api/types/venda'

interface FetchVendaResumoParams {
  empresaCodigo?: number
  dataInicial?: string
  dataFinal?: string
  situacao?: 'A' | 'C' | 'T'
}

export const fetchVendaResumo = (params: FetchVendaResumoParams) =>
  client.get<VendaResumo[]>('/VENDA_RESUMO', { params })
```

## Padrão de Tipo (`src/api/types/*.ts`)

Um arquivo por entidade. Apenas tipos de resposta GET. Sem request bodies de escrita.

```ts
// src/api/types/common.ts
export interface PaginatedResponse<T> {
  resultados: T[]
  ultimoCodigo: number
}
```

## Paginação

A API usa cursor-based pagination:

- `ultimoCodigo`: último código retornado (cursor)
- `limite`: quantidade de registros por página

Para buscar a próxima página, envie o `ultimoCodigo` da resposta anterior.

## Parâmetros Comuns

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `empresaCodigo` | int32 | Filtro por empresa |
| `dataInicial` | date (yyyy-MM-dd) | Início do período |
| `dataFinal` | date (yyyy-MM-dd) | Fim do período |
| `ultimoCodigo` | int32 | Cursor de paginação |
| `limite` | int32 | Registros por página |
| `tipoData` | enum | EMISSAO, ENTRADA, FISCAL, MOVIMENTO |
| `situacao` | enum | A=Autorizada, C=Cancelada, T=Todas |

## Endpoints por Módulo

| Módulo | Endpoints |
|---|---|
| Filtros Globais | `GET /EMPRESAS` |
| Dashboard | `GET /VENDA_RESUMO`, `GET /VENDA` |
| Combustíveis | `GET /ABASTECIMENTO`, `GET /TANQUE`, `GET /BICO`, `GET /BOMBA`, `GET /LMC`, `GET /TROCA_PRECO` |
| Produtos | `GET /VENDA_ITEM`, `GET /PRODUTO`, `GET /GRUPO`, `GET /PRODUTO_META`, `GET /GRUPO_META` |
| Conveniências | `GET /VENDA_ITEM`, `GET /PRODUTO`, `GET /GRUPO` |
| Estoques | `GET /PRODUTO_ESTOQUE`, `GET /ESTOQUE`, `GET /ESTOQUE_PERIODO`, `GET /CONTAGEM_ESTOQUE` |
| Produtividade | `GET /RELATORIO/PRODUTIVIDADE_FUNCIONARIO`, `GET /FUNCIONARIO`, `GET /FUNCIONARIO_META`, `GET /PLACARES` |
| Financeiro | `GET /TITULO_RECEBER`, `GET /TITULO_PAGAR`, `GET /DUPLICATA`, `GET /MOVIMENTO_CONTA`, `GET /DRE`, `GET /CAIXA`, `GET /CONTA` |
| Relatórios | `GET /RELATORIO/MAPA_DESEMPENHO`, `GET /RELATORIO/VENDA_PERIODO`, `GET /RELATORIO/RELATORIO_PERSONALIZADO/{codigo}`, `GET /RELATORIO_PERSONALIZADO` |