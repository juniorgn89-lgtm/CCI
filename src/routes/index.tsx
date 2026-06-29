import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Users, User, BarChart3, Settings, CalendarDays, Sparkles } from 'lucide-react'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import RouteFallback from '@/components/feedback/RouteFallback'
import EmConstrucao from '@/pages/Painel/EmConstrucao'
import { importDashboard } from '@/routes/prefetch'
import Login from '@/pages/Login'

const RedefinirSenha = lazy(() => import('@/pages/RedefinirSenha'))

const Dashboard = lazy(importDashboard)
const Estoques = lazy(() => import('@/pages/Estoques'))
const Financeiro = lazy(() => import('@/pages/Financeiro'))
const QualidadeDados = lazy(() => import('@/pages/QualidadeDados'))
const Inteligencia = lazy(() => import('@/pages/Inteligencia'))
const Bombas = lazy(() => import('@/pages/Bombas'))
const Reabastecimento = lazy(() => import('@/pages/Reabastecimento'))
const CaixasTurnos = lazy(() => import('@/pages/CaixasTurnos'))
const Produtividade = lazy(() => import('@/pages/Produtividade'))
const Comercial = lazy(() => import('@/pages/Comercial'))
const Mobile = lazy(() => import('@/pages/Mobile'))
const Configuracoes = lazy(() => import('@/pages/Configuracoes'))
const Pessoas = lazy(() => import('@/pages/Pessoas'))
const AdminFrentistas = lazy(() => import('@/pages/Admin/Frentistas'))
const AdminUsuarios = lazy(() => import('@/pages/Admin/Usuarios'))
const AdminRedes = lazy(() => import('@/pages/Admin/Redes'))
const AdminApuracao = lazy(() => import('@/pages/Admin/Apuracao'))
const AdminAssistente = lazy(() => import('@/pages/Admin/AssistenteConfig'))
// Painel de gestão (master) — shell standalone com navegação entre módulos.
const PainelLayout = lazy(() => import('@/pages/Painel/PainelLayout'))
const PainelSelecionarRede = lazy(() => import('@/pages/Painel/SelecionarRede'))

// Frentista pages
const FreentistaLayout = lazy(() => import('@/pages/Frentista/layout/FreentistaLayout'))
const MeusAbastecimentos = lazy(() => import('@/pages/Frentista/MeusAbastecimentos'))
const MeuRanking = lazy(() => import('@/pages/Frentista/MeuRanking'))
const MinhaConta = lazy(() => import('@/pages/Frentista/MinhaConta'))
const FrentistaAutoLogin = lazy(() => import('@/pages/Frentista/AutoLogin'))

// Gerente mobile pages
const GerenteLayout = lazy(() => import('@/pages/Gerente/layout/GerenteLayout'))
const GerenteInicio = lazy(() => import('@/pages/Gerente/Inicio'))
const GerenteFinanceiro = lazy(() => import('@/pages/Gerente/Financeiro'))
const GerenteFrentistas = lazy(() => import('@/pages/Gerente/Frentistas'))
const GerenteCombustiveis = lazy(() => import('@/pages/Gerente/CombustiveisGerente'))

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/redefinir-senha" element={<Suspense fallback={<RouteFallback />}><RedefinirSenha /></Suspense>} />
      <Route path="/frentista/auto" element={<Suspense fallback={<RouteFallback />}><FrentistaAutoLogin /></Suspense>} />

      {/* Gerente routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Suspense fallback={<RouteFallback />}><Dashboard /></Suspense>} />
          <Route path="/estoques" element={<Suspense fallback={<RouteFallback />}><Estoques /></Suspense>} />
          <Route path="/reabastecimento" element={<Suspense fallback={<RouteFallback />}><Reabastecimento /></Suspense>} />
          <Route path="/financeiro" element={<Suspense fallback={<RouteFallback />}><Financeiro /></Suspense>} />
          {/* Fechamentos foi consolidado em Fechamento de Caixa (landing = Fechamento por exceção). */}
          <Route path="/fechamento-caixa" element={<Navigate to="/caixas-turnos?tab=excecao" replace />} />
          <Route path="/qualidade-dados" element={<Suspense fallback={<RouteFallback />}><QualidadeDados /></Suspense>} />
          <Route path="/pessoas" element={<Suspense fallback={<RouteFallback />}><Pessoas /></Suspense>} />
          <Route path="/inteligencia" element={<Suspense fallback={<RouteFallback />}><Inteligencia /></Suspense>} />
          <Route path="/comercial" element={<Suspense fallback={<RouteFallback />}><Comercial /></Suspense>} />
          <Route path="/bombas" element={<Suspense fallback={<RouteFallback />}><Bombas /></Suspense>} />
          <Route path="/caixas-turnos" element={<Suspense fallback={<RouteFallback />}><CaixasTurnos /></Suspense>} />
          <Route path="/produtividade" element={<Suspense fallback={<RouteFallback />}><Produtividade /></Suspense>} />
          {/* /operacao foi quebrado em módulos próprios — só Bombas sobrou como rota. */}
          <Route path="/operacao" element={<Navigate to="/bombas" replace />} />
          <Route path="/mobile" element={<Suspense fallback={<RouteFallback />}><Mobile /></Suspense>} />
          <Route path="/configuracoes" element={<Suspense fallback={<RouteFallback />}><Configuracoes /></Suspense>} />
          <Route path="/admin/frentistas" element={<Suspense fallback={<RouteFallback />}><AdminFrentistas /></Suspense>} />
          <Route path="/admin/usuarios" element={<Suspense fallback={<RouteFallback />}><AdminUsuarios /></Suspense>} />
          <Route path="/admin/redes" element={<Suspense fallback={<RouteFallback />}><AdminRedes /></Suspense>} />
          <Route path="/admin/apuracao" element={<Suspense fallback={<RouteFallback />}><AdminApuracao /></Suspense>} />
          <Route path="/admin/assistente" element={<Suspense fallback={<RouteFallback />}><AdminAssistente /></Suspense>} />
          {/* Selecionar rede agora vive no Painel standalone (com navegação entre módulos). */}
          <Route path="/selecionar-rede" element={<Navigate to="/painel/selecionar-rede" replace />} />
          {/* Rota órfã (ex.: /comercial/vendas removido) pousa no hub. */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>

      {/* Painel de gestão (master) — shell próprio com nav de módulos, sem a sidebar
          do produto. Só "Selecionar rede" é real; demais abas são esqueleto. */}
      <Route element={<ProtectedRoute />}>
        <Route path="/painel" element={<Suspense fallback={<RouteFallback />}><PainelLayout /></Suspense>}>
          <Route index element={<Navigate to="/painel/selecionar-rede" replace />} />
          <Route path="selecionar-rede" element={<Suspense fallback={<RouteFallback />}><PainelSelecionarRede /></Suspense>} />
          <Route path="usuarios" element={<EmConstrucao title="Usuários" subtitle="Gerencie acessos e perfis da conta." Icon={Users} />} />
          <Route path="frentistas" element={<EmConstrucao title="Frentistas" subtitle="Cadastro e PIN dos frentistas." Icon={User} />} />
          <Route path="redes" element={<EmConstrucao title="Gerenciar redes" subtitle="Cadastro de redes e chaves de integração." Icon={BarChart3} />} />
          <Route path="config" element={<EmConstrucao title="Configurações" subtitle="Preferências da conta." Icon={Settings} />} />
          <Route path="apuracao" element={<EmConstrucao title="Apuração" subtitle="Pré-cálculo dos meses fechados." Icon={CalendarDays} />} />
          <Route path="ia" element={<EmConstrucao title="Assistente IA" subtitle="Configuração do assistente por rede." Icon={Sparkles} />} />
        </Route>
      </Route>

      {/* Frentista routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Suspense fallback={<RouteFallback />}><FreentistaLayout /></Suspense>}>
          <Route path="/frentista" element={<Suspense fallback={<RouteFallback />}><MeusAbastecimentos /></Suspense>} />
          <Route path="/frentista/ranking" element={<Suspense fallback={<RouteFallback />}><MeuRanking /></Suspense>} />
          <Route path="/frentista/conta" element={<Suspense fallback={<RouteFallback />}><MinhaConta /></Suspense>} />
        </Route>
      </Route>

      {/* Gerente mobile routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Suspense fallback={<RouteFallback />}><GerenteLayout /></Suspense>}>
          <Route path="/gerente" element={<Suspense fallback={<RouteFallback />}><GerenteInicio /></Suspense>} />
          <Route path="/gerente/financeiro" element={<Suspense fallback={<RouteFallback />}><GerenteFinanceiro /></Suspense>} />
          <Route path="/gerente/frentistas" element={<Suspense fallback={<RouteFallback />}><GerenteFrentistas /></Suspense>} />
          <Route path="/gerente/combustiveis" element={<Suspense fallback={<RouteFallback />}><GerenteCombustiveis /></Suspense>} />
        </Route>
      </Route>
    </Routes>
  )
}

export default AppRoutes
