import axios from 'axios'

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

// --- Request interceptor: inject CHAVE query parameter from env ---
client.interceptors.request.use((config) => {
  const chave = import.meta.env.VITE_API_KEY

  if (chave) {
    config.params = {
      ...config.params,
      CHAVE: chave,
    }
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
