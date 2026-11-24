import { useState } from 'react'
import { createPortal } from 'react-dom'
import { LockKeyhole, X, Eye, EyeOff, Loader2, Copy, Check, MessageCircle } from 'lucide-react'
import { definirSenhaInicial } from '@/api/supabase/profiles'

/** "Lara Souza" → "Lara123" (padrão de primeiro acesso: primeiro nome com inicial maiúscula + 123). */
const sugerirSenha = (nome: string, email: string): string => {
  const base = (nome.trim().split(/\s+/)[0] || email.split('@')[0] || 'Visor')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z]/g, '')
  const primeiro = base ? base.charAt(0).toUpperCase() + base.slice(1).toLowerCase() : 'Visor'
  let senha = `${primeiro}123`
  if (senha.length < 6) senha = `${primeiro}1234`.padEnd(6, '5')
  return senha
}

interface Props {
  usuario: { user_id: string; full_name: string | null; email: string | null }
  onClose: () => void
}

/**
 * Painel › Usuários › "Senha inicial": a CCI define a senha de primeiro acesso
 * e já recebe o texto pronto para mandar ao cliente. A senha só vai para o
 * Auth (Edge Function definir-senha-inicial); não fica salva em lugar nenhum.
 */
const SenhaInicialModal = ({ usuario, onClose }: Props) => {
  const nome = usuario.full_name || usuario.email || 'usuário'
  const [senha, setSenha] = useState(() => sugerirSenha(usuario.full_name ?? '', usuario.email ?? ''))
  const [ver, setVer] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pronta, setPronta] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const mensagem = `Seu acesso ao Visor360 está liberado.\nEndereço: ${window.location.origin}\nE-mail: ${usuario.email ?? ''}\nSenha: ${senha}\nNo primeiro acesso, troque a senha em Parâmetros.`

  const definir = async () => {
    if (senha.length < 6) { setErro('A senha precisa ter pelo menos 6 caracteres.'); return }
    setSalvando(true); setErro(null)
    try { await definirSenhaInicial(usuario.user_id, senha); setPronta(true) } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }
  const copiar = async () => {
    try { await navigator.clipboard.writeText(mensagem); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch { /* sem clipboard */ }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Senha inicial de ${nome}`}
        className="w-full max-w-md overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-gray-100"><LockKeyhole className="h-4 w-4 shrink-0" /> Senha inicial</h2>
            <p className="mt-0.5 truncate text-[12px] text-gray-500 dark:text-gray-400">{nome}{usuario.email && usuario.full_name ? ` · ${usuario.email}` : ''}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3 px-5 py-4">
          {!pronta ? (
            <>
              <p className="text-[12.5px] text-gray-600 dark:text-gray-300">Para o primeiro acesso, sem link de redefinição. A sugestão segue o padrão nome + 123; pode trocar antes de confirmar.</p>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">Senha</span>
                <span className="relative block">
                  <input value={senha} onChange={(e) => setSenha(e.target.value)} type={ver ? 'text' : 'password'} autoComplete="new-password" spellCheck={false}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 pr-10 font-mono text-[15px] text-gray-900 outline-none focus:border-[#1e3a5f] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                  <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Esconder senha' : 'Mostrar senha'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600">
                    {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </span>
                <span className="mt-1 block text-[11px] text-gray-400">Mínimo 6 caracteres. A senha anterior deixa de valer.</span>
              </label>
              {erro && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{erro}</p>}
            </>
          ) : (
            <>
              <p className="flex items-center gap-2 text-[13px] font-semibold text-emerald-700 dark:text-emerald-400"><Check className="h-4 w-4" /> Senha definida. Já dá para entrar.</p>
              <pre className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-[12.5px] leading-relaxed text-gray-800 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">{mensagem}</pre>
              <p className="text-[11px] text-gray-400">A senha não fica salva no Visor: copie agora e mande para o cliente.</p>
            </>
          )}
        </div>

        <div className="flex gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
          {!pronta ? (
            <>
              <button type="button" onClick={onClose} className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">Cancelar</button>
              <button type="button" onClick={() => void definir()} disabled={salvando || senha.length < 6}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#1e3a5f] px-3 py-2 text-sm font-semibold text-white hover:bg-[#16293f] disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700">
                {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LockKeyhole className="h-3.5 w-3.5" />} Definir senha
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => void copiar()} className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                {copiado ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />} {copiado ? 'Copiado' : 'Copiar acesso'}
              </button>
              <a href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                <MessageCircle className="h-3.5 w-3.5" /> Mandar no WhatsApp
              </a>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default SenhaInicialModal
