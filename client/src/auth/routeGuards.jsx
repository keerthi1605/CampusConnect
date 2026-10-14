import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { homePathFor, useAuth } from './useAuth'

function FullPageMessage({ children }) {
  return <p className="page-message">{children}</p>
}

/** Everything below requires a signed-in user; others are sent to /login and brought back after. */
export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageMessage>Loading…</FullPageMessage>
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

/** Nested inside ProtectedRoute: only the listed roles get through. */
export function RoleRoute({ roles }) {
  const { user } = useAuth()
  if (!roles.includes(user.role)) return <Navigate to="/forbidden" replace />
  return <Outlet />
}

/** Login / register: a signed-in user is sent where they were headed, or to their home page. */
export function GuestRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageMessage>Loading…</FullPageMessage>
  if (user) {
    const home = homePathFor(user.role)
    const from = location.state?.from?.pathname
    // Role areas live under /student/* and /admin/*; only go back to the requested page if
    // this user may actually open it (a student who tried /admin lands on their own home)
    const target = from && (from === home || from.startsWith(`${home}/`)) ? from : home
    return <Navigate to={target} replace />
  }
  return <Outlet />
}

/** "/" sends people to the right place. */
export function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <FullPageMessage>Loading…</FullPageMessage>
  return <Navigate to={user ? homePathFor(user.role) : '/login'} replace />
}
