import ServicosCci from '@/pages/Dashboard/components/ServicosCci'

/**
 * Área de conteúdo sem nenhuma janela aberta (o usuário fechou todas): nada da
 * tela anterior fica à vista, só a vitrine da CCI (dono e diretor; para os
 * demais, a área fica vazia). A próxima tela se escolhe no menu ao lado.
 */
const AreaVazia = () => (
  <div className="mx-auto flex min-h-full max-w-6xl flex-col justify-center pb-10 pt-6">
    <ServicosCci />
  </div>
)

export default AreaVazia
