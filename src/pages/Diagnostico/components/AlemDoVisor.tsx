import { CreditCard, Network, Landmark, GraduationCap, BadgeCheck, Check, BarChart3, type LucideIcon } from 'lucide-react'
import { FONTE_TITULO } from '@/pages/Diagnostico/lib/marca'
import { IconeOuro, SecaoTitulo, Sobrelinha } from '@/pages/Diagnostico/components/Marca'

/** O que a consultoria da CCI avalia no posto, além do que o Visor360 lê (os temas da reunião inicial). */
const FRENTES: { Icon: LucideIcon; titulo: string; texto: string; porque: string }[] = [
  { Icon: CreditCard, titulo: 'Administradoras de cartão', texto: 'Taxa, prazo e EDI certos para cada bandeira e adquirente.', porque: 'Cadastro duplicado ou com taxa zerada esconde o custo do cartão e trava a conciliação.' },
  { Icon: Network, titulo: 'Plano de contas', texto: 'Custos, deduções e despesas separados, na estrutura da DRE do posto.', porque: 'Despesa misturada com custo distorce a margem e impede ver onde o dinheiro está saindo.' },
  { Icon: Landmark, titulo: 'Contas bancárias', texto: 'Uma conta para cada banco, caixa e aplicação, conferida com o extrato.', porque: 'Uma conta "BANCO" para tudo ou um caixa negativo deixam o saldo sem valor.' },
  { Icon: GraduationCap, titulo: 'Treinamento da pista', texto: 'Cada venda baixada na administradora certa, com o nº de autorização.', porque: 'Baixa genérica faz a venda sumir do repasse e virar diferença de caixa.' },
  { Icon: BadgeCheck, titulo: 'Conciliação de caixas e cartões', texto: 'Venda na pista, repasse da adquirente e banco batendo, autorização por autorização.', porque: 'Taxa fora do contrato vira contestação ou pedido de reembolso à adquirente.' },
]

const VISOR = ['Venda e margem por combustível, mês a mês', 'Loja: o que mais dá lucro, o que sumiu', 'Equipe da pista e da loja', 'Títulos a receber e a pagar em aberto', 'Tanques, estoques e preços da concorrência']
const CCI_MAIS = ['Os cadastros por trás dos números (cartões, contas, plano de contas)', 'Conciliação de caixa, cartão e banco', 'DRE e fluxo de caixa do posto', 'Treinamento da equipe e rotina de fechamento', 'Um plano com dono, prazo e meta, acompanhado mês a mês']

const card = 'rounded-2xl border border-[#0F766E]/15 bg-white p-5 shadow-[0_10px_30px_rgba(11,74,68,.06)] dark:border-white/10 dark:bg-[#0b2e2b]'

const AlemDoVisor = ({ n }: { n: number }) => (
  <section>
    <SecaoTitulo n={n} sobre="Com a consultoria da CCI" titulo="Além dos números: o que a CCI avalia no posto"
      sub="Este diagnóstico lê o que já está no sistema. A consultoria vai nos cadastros e na rotina, onde estão os ajustes que os números sozinhos não mostram." />

    {/* O que cada um entrega */}
    <div className="grid gap-4 lg:grid-cols-2">
      <div className={card}>
        <Sobrelinha className="flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> O Visor360 mostra</Sobrelinha>
        <ul className="mt-3 space-y-2">
          {VISOR.map((t) => <li key={t} className="flex gap-2.5 text-[14px] text-gray-700 dark:text-gray-200"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0F766E] dark:text-teal-300" />{t}</li>)}
        </ul>
      </div>
      <div className="rounded-2xl border border-[#FCB619]/50 bg-gradient-to-br from-[#FFF8E6] to-white p-5 shadow-[0_10px_30px_rgba(252,182,25,.12)] dark:from-[#2a2410] dark:to-[#0b2e2b] dark:border-[#FCB619]/30">
        <Sobrelinha className="text-[#8a5a00] dark:text-[#FCD35E]">A consultoria da CCI acrescenta</Sobrelinha>
        <ul className="mt-3 space-y-2">
          {CCI_MAIS.map((t) => <li key={t} className="flex gap-2.5 text-[14px] font-medium text-[#0B4A44] dark:text-white"><span className="mt-1.5 h-2 w-2 shrink-0 rotate-45 bg-[#FCB619]" />{t}</li>)}
        </ul>
      </div>
    </div>

    {/* As frentes de trabalho, como nos slides */}
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {FRENTES.map((f, i) => (
        <div key={f.titulo} className={card}>
          <div className="flex items-start justify-between">
            <IconeOuro><f.Icon className="h-5 w-5" /></IconeOuro>
            <span className="text-[26px] font-extrabold leading-none text-[#0F766E]/25 dark:text-white/20" style={{ fontFamily: FONTE_TITULO }}>{String(i + 1).padStart(2, '0')}</span>
          </div>
          <p className="mt-3 text-[16px] font-extrabold leading-snug text-[#0B4A44] dark:text-white" style={{ fontFamily: FONTE_TITULO }}>{f.titulo}</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-gray-700 dark:text-gray-200">{f.texto}</p>
          <p className="mt-2 border-t border-gray-100 pt-2 text-[12.5px] leading-relaxed text-gray-500 dark:border-white/10 dark:text-gray-400"><b className="font-semibold text-[#0F766E] dark:text-teal-300">Por que importa:</b> {f.porque}</p>
        </div>
      ))}
    </div>
  </section>
)

export default AlemDoVisor
