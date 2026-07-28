import axios from 'axios'
import { supabase } from '../lib/supabase'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = `${error.config?.method?.toUpperCase() ?? ''} ${error.config?.url ?? ''}`.trim()
    if (error.code === 'ECONNABORTED') {
      console.error(`[api] timeout after 30s: ${url}`)
    } else if (error.response) {
      console.error(`[api] ${error.response.status} on ${url}`, error.response.data)
    } else {
      console.error(`[api] network error on ${url}`, error.message)
    }
    return Promise.reject(error)
  }
)

export default api
