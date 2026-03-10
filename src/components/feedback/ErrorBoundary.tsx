import { Component, type ReactNode } from 'react'
import ErrorState from '@/components/feedback/ErrorState'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <ErrorState
            message="Ocorreu um erro ao renderizar esta página."
            detail={this.state.error?.message ?? 'Erro desconhecido'}
            onRetry={this.handleRetry}
          />
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
