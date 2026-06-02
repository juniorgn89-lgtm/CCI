import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import {
  Smartphone,
  Copy,
  Check,
  Share2,
  QrCode,
  Users,
  UserCheck,
  UserX,
  Search,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import TableSummaryStrip from '@/components/tables/TableSummaryStrip'
import QrCodeDialog from '@/pages/Mobile/components/QrCodeDialog'
import { useFilterStore } from '@/store/filters'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import { fetchFuncoes } from '@/api/endpoints/funcionarios'
import { cn } from '@/lib/utils'

const pwaUrl = `${window.location.origin}/frentista`

const Mobile = () => {
  const { empresaCodigos } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null
  const hasEmpresa = empresaCodigos.length > 0

  const [copiedInstall, setCopiedInstall] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedFrentista, setSelectedFrentista] = useState<{
    name: string
    code: string
  } | null>(null)

  const { data: funcionariosData, isLoading: loadingFuncionarios } = useQuery({
    queryKey: ['funcionarios', empresaCodigo],
    queryFn: () => fetchFuncionarios({ empresaCodigo: empresaCodigo!, limite: 1000 }),
    enabled: hasEmpresa,
  })

  const { data: funcoesData } = useQuery({
    queryKey: ['funcoes'],
    queryFn: () => fetchFuncoes({ limite: 1000 }),
    staleTime: 30 * 60 * 1000,
  })

  const funcaoMap = new Map(
    (funcoesData?.resultados ?? []).map((f) => [f.funcaoCodigo, f.descricao])
  )

  const funcionarios = funcionariosData?.resultados ?? []
  const totalAtivos = funcionarios.filter((f) => f.ativo).length
  const totalInativos = funcionarios.filter((f) => !f.ativo).length

  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'ativo' | 'inativo'>('ativo')
  const funcionariosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return funcionarios.filter((f) => {
      if (statusFiltro === 'ativo' && !f.ativo) return false
      if (statusFiltro === 'inativo' && f.ativo) return false
      if (q && !f.nome.toLowerCase().includes(q)) return false
      return true
    })
  }, [funcionarios, busca, statusFiltro])

  const handleCopyInstall = async () => {
    try {
      await navigator.clipboard.writeText(pwaUrl)
      setCopiedInstall(true)
      setTimeout(() => setCopiedInstall(false), 2000)
    } catch {
      // Fallback
    }
  }

  const handleShareInstall = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Visor360 - App Frentista',
        text: 'Instale o app Visor360 para acompanhar seus abastecimentos',
        url: pwaUrl,
      }).catch(() => {
        // User cancelled share
      })
    } else {
      handleCopyInstall()
    }
  }

  const handleOpenQr = (name: string, code: string) => {
    setSelectedFrentista({ name, code })
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm">
          <Smartphone className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">
            Gestao Mobile
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Gerencie o acesso dos frentistas ao aplicativo
          </p>
        </div>
      </div>

      {/* Install link card */}
      <Card className="border-gray-200 bg-gradient-to-r from-blue-50/80 to-white p-5 shadow-sm dark:border-gray-700 dark:from-blue-950/30 dark:to-gray-900">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="shrink-0 rounded-xl border border-gray-200 bg-white p-2.5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <QRCodeSVG value={pwaUrl} size={100} level="M" includeMargin={false} />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Link de Instalacao do App
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Compartilhe este link ou QR Code com os frentistas para instalacao do aplicativo no celular.
              </p>
              <code className="block max-w-[320px] truncate rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {pwaUrl}
              </code>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'gap-2',
                copiedInstall && 'border-green-300 text-green-600'
              )}
              onClick={handleCopyInstall}
            >
              {copiedInstall ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copiar
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleShareInstall}
            >
              <Share2 className="h-3.5 w-3.5" />
              Compartilhar
            </Button>
          </div>
        </div>
      </Card>

      {/* Frentistas table */}
      {!hasEmpresa ? (
        <Card className="flex items-center justify-center border-gray-200 p-12 shadow-sm dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Selecione uma empresa para visualizar os frentistas
          </p>
        </Card>
      ) : loadingFuncionarios ? (
        <div className="space-y-3">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-[400px] w-full rounded-lg" />
        </div>
      ) : (
        <div className="space-y-3">
          <TableSummaryStrip
            icon={Users}
            iconColor="text-blue-600"
            iconBg="bg-blue-100 dark:bg-blue-900/50"
            title="Funcionarios"
            subtitle={`${funcionariosFiltrados.length} de ${funcionarios.length} registros`}
            metrics={[
              {
                label: 'Total',
                value: String(funcionarios.length),
              },
              {
                label: 'Ativos',
                value: String(totalAtivos),
                color: 'text-green-600',
              },
              {
                label: 'Inativos',
                value: String(totalInativos),
                color: 'text-red-500',
              },
            ]}
          />

          {/* Busca + filtro de status */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Pesquisar por nome…"
                className="pl-9"
              />
            </div>
            <div className="flex shrink-0 gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800/50">
              {([
                { v: 'todos', label: 'Todos' },
                { v: 'ativo', label: 'Ativos' },
                { v: 'inativo', label: 'Inativos' },
              ] as const).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setStatusFiltro(opt.v)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    statusFiltro === opt.v
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <Card className="overflow-hidden border-gray-200 shadow-sm dark:border-gray-700">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                    <TableHead className="text-xs font-medium uppercase text-gray-500">
                      Nome
                    </TableHead>
                    <TableHead className="text-xs font-medium uppercase text-gray-500">
                      Codigo
                    </TableHead>
                    <TableHead className="text-xs font-medium uppercase text-gray-500">
                      Funcao
                    </TableHead>
                    <TableHead className="text-xs font-medium uppercase text-gray-500">
                      Status
                    </TableHead>
                    <TableHead className="w-[80px] text-center text-xs font-medium uppercase text-gray-500">
                      QR Code
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {funcionariosFiltrados.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-12 text-center text-sm text-gray-500"
                      >
                        Nenhum funcionario encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    funcionariosFiltrados.map((func, idx) => {
                      const code = func.codigoExterno || String(func.funcionarioCodigo)
                      const funcaoNome = funcaoMap.get(func.funcaoCodigo) ?? `Funcao ${func.funcaoCodigo}`

                      return (
                        <TableRow
                          key={func.funcionarioCodigo}
                          className={cn(
                            idx % 2 === 0
                              ? 'bg-white dark:bg-gray-900'
                              : 'bg-gray-50/50 dark:bg-gray-800/30'
                          )}
                        >
                          <TableCell className="py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {func.nome}
                          </TableCell>
                          <TableCell className="py-2.5 text-sm tabular-nums text-gray-600 dark:text-gray-400">
                            {code}
                          </TableCell>
                          <TableCell className="py-2.5 text-sm text-gray-600 dark:text-gray-400">
                            {funcaoNome}
                          </TableCell>
                          <TableCell className="py-2.5">
                            {func.ativo ? (
                              <Badge
                                variant="outline"
                                className="gap-1 border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
                              >
                                <UserCheck className="h-3 w-3" />
                                Ativo
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="gap-1 border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
                              >
                                <UserX className="h-3 w-3" />
                                Inativo
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                              onClick={() => handleOpenQr(func.nome, code)}
                              aria-label={`QR Code de ${func.nome}`}
                            >
                              <QrCode className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {/* QR Code dialog */}
      {selectedFrentista && (
        <QrCodeDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          frentistaName={selectedFrentista.name}
          frentistaCode={selectedFrentista.code}
        />
      )}
    </div>
  )
}

export default Mobile
