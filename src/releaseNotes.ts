/**
 * Notas de versão — a fonte ÚNICA do "o que há de novo".
 *
 * Aparecem (1) na tela de atualização, enquanto a versão nova é instalada,
 * (2) no aviso "Visor360 atualizado" depois do reinício e (3) em Configurações
 * › Sobre › Novidades. O build também publica este arquivo como
 * `/release-notes.json` (ver vite.config.ts): é por ele que o app ANTIGO, na
 * hora de atualizar, lê as novidades da versão NOVA — o bundle velho não as
 * conhece.
 *
 * Regras: linguagem de dono de posto (o que muda pra ele, não o commit);
 * versão mais nova primeiro; cada release = uma entrada com a versão do
 * package.json. Este arquivo é importado pelo vite.config.ts, então fica SEM
 * imports (ícones são chaves, resolvidas em components/feedback/Novidades.tsx).
 */
export type NovidadeIcone = 'apps' | 'demo' | 'ia' | 'mobile' | 'atualizacao' | 'ajuste' | 'seguranca' | 'relatorio'

export interface Novidade {
  icone: NovidadeIcone
  titulo: string
  descricao: string
}

export interface ReleaseNote {
  /** Igual ao `version` do package.json daquele deploy. */
  versao: string
  /** yyyy-MM-dd */
  data: string
  /** Uma frase que resume a versão. */
  resumo: string
  itens: Novidade[]
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    versao: '1.2.1',
    data: '2026-09-28',
    resumo: 'Marque linhas nas tabelas com um clique e abra a aba Combustível da Central bem mais rápido.',
    itens: [
      {
        icone: 'ajuste',
        titulo: 'Marca-texto nas tabelas',
        descricao:
          'Clique numa linha de qualquer tabela para destacá-la em amarelo e acompanhar um posto ou produto na tela. Clique de novo para tirar; Esc limpa tudo. Linhas que abrem detalhes continuam abrindo.',
      },
      {
        icone: 'atualizacao',
        titulo: 'Central da Rede · Combustível mais rápida',
        descricao: 'A aba passou a ler só os dados de combustível, em vez de toda a rede. Os números são os mesmos, só chegam antes.',
      },
    ],
  },
  {
    versao: '1.2.0',
    data: '2026-09-28',
    resumo: 'Os apps da CCI num só lugar, Modo Demonstração e análises prontas no Cadu iA.',
    itens: [
      {
        icone: 'apps',
        titulo: 'Apps da CCI num só botão',
        descricao:
          'O botão de grade no topo abre o Visor360, o Prospecção360 e os portais da CCI. Cada app pode ser instalado no aparelho a partir dali.',
      },
      {
        icone: 'demo',
        titulo: 'Modo Demonstração',
        descricao:
          'Apresente o sistema sem expor o nome da sua rede nem dos postos. Liga e desliga no topo, só para quem tem permissão.',
      },
      {
        icone: 'ia',
        titulo: 'Análises prontas no Cadu iA',
        descricao:
          'Onze perguntas prontas em Inteligência, agrupadas por combustível, financeiro, vendas e estoque. Um clique e a resposta vem.',
      },
      {
        icone: 'mobile',
        titulo: 'Combustível no celular mais fácil de ler',
        descricao: 'O detalhamento por produto virou blocos empilhados, sem tabela apertada na tela pequena.',
      },
      {
        icone: 'atualizacao',
        titulo: 'Esta tela de atualização',
        descricao: 'A cada versão nova você vê o que mudou enquanto ela é instalada, e de novo em Configurações › Sobre.',
      },
    ],
  },
]

/** Compara versões "1.2.0" numericamente (positivo se a > b). */
export const compararVersao = (a: string, b: string): number => {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}
