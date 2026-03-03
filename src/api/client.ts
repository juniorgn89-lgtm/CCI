import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
})

// --- Request interceptor: READ-ONLY enforcement ---
// Rejects any method that is not GET, except POST on auth/login routes.
client.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toLowerCase()
  const url = (config.url ?? '').toLowerCase()

  const isGet = method === 'get'
  const isAuthPost = method === 'post' && (/\/auth/i.test(url) || /\/login/i.test(url))

  if (!isGet && !isAuthPost) {
    return Promise.reject(
      new Error(`READ-ONLY: método ${method.toUpperCase()} bloqueado. Apenas GET é permitido.`)
    )
  }

  return config
})

// --- Request interceptor: inject CHAVE query parameter ---
client.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('auth_token')

  if (token) {
    config.params = {
      ...config.params,
      CHAVE: token,
    }
  }

  return config
})

// --- Response interceptor: 401 → redirect to login ---
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      sessionStorage.removeItem('auth_token')
      window.location.href = '/login'
    }

    return Promise.reject(error)
  }
)

export { client }
