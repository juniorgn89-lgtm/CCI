import axios from 'axios'
import { useTenantStore } from '@/store/tenant'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
})

// --- Request interceptor: READ-ONLY enforcement ---
// Rejects any method that is not GET.
client.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toLowerCase()

  if (method !== 'get') {
    return Promise.reject(
      new Error(`READ-ONLY: método ${method.toUpperCase()} bloqueado. Apenas GET é permitido.`)
    )
  }

  return config
})

// --- Request interceptor: injeta CHAVE + baseURL da rede atual (tenant) ---
// Tenant é populado pelo bootstrap no App.tsx após login. Enquanto não houver
// rede carregada (ex: pré-login, ou migração antes do SQL de redes rodar),
// cai no fallback do env VITE_API_KEY / VITE_API_BASE_URL.
client.interceptors.request.use((config) => {
  const rede = useTenantStore.getState().rede
  const chave = rede?.chave ?? (import.meta.env.VITE_API_KEY as string | undefined)
  const baseURL = rede?.api_base_url ?? (import.meta.env.VITE_API_BASE_URL as string | undefined)

  if (chave) {
    config.params = { ...config.params, CHAVE: chave }
  }
  if (baseURL) {
    config.baseURL = baseURL
  }

  return config
})

// --- Response interceptor: 401 → redirect to login ---
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      window.location.href = '/login'
    }

    return Promise.reject(error)
  }
)

export { client }
