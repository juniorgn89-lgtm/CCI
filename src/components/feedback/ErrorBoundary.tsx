import { Component, type ReactNode } from 'react'
import ErrorState from '@/components/feedback/ErrorState'
import { ehErroDeVersao, recarregarPorVersao } from '@/lib/chunkReload'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  /** Pedaço do app de uma versão que saiu do ar: a página está recarregando. */
  recarregando: boolean
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, recarregando: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (ehErroDeVersao(error) && recarregarPorVersao()) {
      this.setState({ recarregando: true })
      return
    }
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleRetry = () => {
    // O import que falhou fica em cache: só recarregar a página traz a versão nova.
    if (ehErroDeVersao(this.state.error)) { window.location.reload(); return }
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.recarregando) {
      return <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">Saiu uma versão nova do Visor360. Carregando…</div>
    }
    if (this.state.hasError) {
      const versao = ehErroDeVersao(this.state.error)
      return (
        <div className="p-6">
          <ErrorState
            message={versao ? 'Esta tela é de uma versão anterior do Visor360.' : 'Ocorreu um erro ao renderizar esta página.'}
            detail={versao ? 'Recarregue para abrir a versão nova.' : this.state.error?.message ?? 'Erro desconhecido'}
            onRetry={this.handleRetry}
          />
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
