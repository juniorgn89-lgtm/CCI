import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, AlertTriangle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal, Erro, ConfirmaAcao } from '@/pages/Gestao/comumUi'
import { fetchCciPostosAdmin, marcarCciServico, NOME_SERVICO_CCI, SERVICOS_MARCAVEIS } from '@/api/supabase/cciServicos'

const fmtData = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

/**
 * Admin › Redes › Serviços: a grade postos × serviços da CCI. Marcar aqui grava
 * no Prospecção360 (a fonte) e atualiza a cópia do Visor na hora. Ligar cria o
 * serviço com a data de hoje; desligar encerra (pede confirmação, o histórico
 * fica lá). Posto que não é lead no Prospecção não dá para marcar.
 */
const ServicosCciModal = ({ redeId, redeNome, onClose }: { redeId: string; redeNome: string; onClose: () => void }) => {
  const qc = useQueryClient()
  const postosQ = useQuery({ queryKey: ['cci-postos-admin', redeId], queryFn: () => fetchCciPostosAdmin(redeId), staleTime: 0 })
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [encerrar, setEncerrar] = useState<{ empresa: number; posto: string; servico: string } | null>(null)

  const marcar = async (empresa: number, servico: string, ligado: boolean) => {
    const k = `${empresa}|${servico}`
    setOcupado(k); setErro(null)
    try {
      await marcarCciServico(redeId, empresa, servico, ligado)
      await postosQ.refetch()
      qc.invalidateQueries({ queryKey: ['cci-servicos'] })
      qc.invalidateQueries({ queryKey: ['cci-servicos-todas'] })
      setEncerrar(null)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setOcupado(null)
    }
  }

  const postos = postosQ.data ?? []
  const semLead = postos.filter((p) => !p.no_prospeccao).length

  return (
    <Modal open onClose={onClose} titulo={`Serviços CCI · ${redeNome}`} descricao="O que cada posto contratou com a CCI. Marcar aqui grava no Prospecção e aparece na hora no Visor." largura="max-w-4xl">
      <div className="space-y-3">
        <Erro msg={erro} />
        {postosQ.isLoading ? (
          <p className="inline-flex items-center gap-2 py-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Lendo os postos da rede e o Prospecção…</p>
        ) : postosQ.error ? (
          <Erro msg={(postosQ.error as Error).message} />
        ) : (
          <>
            {semLead > 0 && (
              <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {semLead === postos.length ? 'Nenhum posto desta rede está cadastrado' : semLead === 1 ? '1 posto não está cadastrado' : `${semLead} postos não estão cadastrados`} como lead no Prospecção (mesmo CNPJ). Para marcar serviço, o vendedor cadastra o posto lá primeiro.
              </p>
            )}
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full min-w-[640px] text-[12.5px]">
                <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-800/40 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Posto</th>
                    {SERVICOS_MARCAVEIS.map((s) => <th key={s} className="px-2 py-2 text-center font-semibold">{NOME_SERVICO_CCI[s]}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {postos.map((p) => (
                    <tr key={p.empresa_codigo} className={cn(!p.no_prospeccao && 'bg-gray-50/60 dark:bg-white/[0.02]')}>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{p.nome}</p>
                        <p className="font-mono text-[10.5px] text-gray-400">{p.cnpj || 'sem CNPJ'}{!p.no_prospeccao && <span className="ml-1.5 font-sans text-amber-600 dark:text-amber-400">· não está no Prospecção</span>}</p>
                      </td>
                      {SERVICOS_MARCAVEIS.map((s) => {
                        const ativo = p.ativos.find((a) => a.servico === s)
                        const k = `${p.empresa_codigo}|${s}`
                        return (
                          <td key={s} className="px-2 py-2 text-center">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={!!ativo}
                              aria-label={`${NOME_SERVICO_CCI[s]} em ${p.nome}`}
                              disabled={!p.no_prospeccao || ocupado != null}
                              onClick={() => (ativo ? setEncerrar({ empresa: p.empresa_codigo, posto: p.nome, servico: s }) : marcar(p.empresa_codigo, s, true))}
                              className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                                ativo ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700')}
                            >
                              {ocupado === k
                                ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin text-white" />
                                : <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', ativo ? 'translate-x-[18px]' : 'translate-x-0.5')} />}
                            </button>
                            {ativo && <p className="mt-0.5 text-[10px] tabular-nums text-gray-400">desde {fmtData(ativo.desde)}</p>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {encerrar && (
              <ConfirmaAcao perigo titulo={`Encerrar ${NOME_SERVICO_CCI[encerrar.servico]} em ${encerrar.posto}?`}
                texto="O serviço fica encerrado com a data de hoje no Prospecção. O histórico continua lá."
                rotulo="Encerrar serviço" ocupado={ocupado != null}
                onVoltar={() => setEncerrar(null)} onConfirmar={() => marcar(encerrar.empresa, encerrar.servico, false)} />
            )}
            <p className="flex items-center gap-1 text-[11px] text-gray-400"><Check className="h-3 w-3" /> Ligar cria o serviço com a data de hoje, origem "manual" e o seu nome na observação do Prospecção.</p>
          </>
        )}
      </div>
    </Modal>
  )
}

export default ServicosCciModal
