import { useCallback, useEffect, useMemo, useState } from 'react'
import api, { setUnauthorizedHandler } from '../api/client'
import { tokenStorage } from '../api/tokenStorage'
import { AuthContext } from './authContext'

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // A stored token has to be checked with the server before we know who (if anyone) is signed in
  const [loading, setLoading] = useState(() => Boolean(tokenStorage.get()))

  const logout = useCallback(() => {
    tokenStorage.clear()
    setUser(null)
  }, [])

  // Any 401 from a protected call means the token expired or the account is gone
  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(() => {})
  }, [logout])

  useEffect(() => {
    if (!tokenStorage.get()) return
    let cancelled = false
    api
      .get('/auth/me')
      .then((res) => {
        if (!cancelled) setUser(res.data.user)
      })
      .catch(() => {
        // 401 is handled by the interceptor; for network errors keep the user signed out
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const authenticate = useCallback(async (path, payload) => {
    const { data } = await api.post(path, payload)
    tokenStorage.set(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const login = useCallback((email, password) => authenticate('/auth/login', { email, password }), [authenticate])
  const register = useCallback((payload) => authenticate('/auth/register', payload), [authenticate])

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
