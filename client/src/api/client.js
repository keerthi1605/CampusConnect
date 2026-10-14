import axios from 'axios'
import { tokenStorage } from './tokenStorage'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const api = axios.create({ baseURL: API_URL, timeout: 15000 })

// Sign-in and sign-up answer 401/409 for ordinary reasons (wrong password...), which is
// not a "session expired" signal
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register']

let onUnauthorized = () => {}

/** AuthProvider registers what should happen when the API rejects the current token. */
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler
}

api.interceptors.request.use((config) => {
  const token = tokenStorage.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const url = error.config?.url ?? ''
    if (status === 401 && !AUTH_ENDPOINTS.some((p) => url.endsWith(p))) onUnauthorized()
    return Promise.reject(error)
  },
)

export default api
