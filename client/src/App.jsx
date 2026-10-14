import { Route, Routes } from 'react-router-dom'
import { GuestRoute, ProtectedRoute, RoleRoute, RootRedirect } from './auth/routeGuards'
import Layout from './components/Layout'
import { AdminHome, StudentHome } from './pages/Dashboards'
import Login from './pages/Login'
import Register from './pages/Register'
import { Forbidden, NotFound } from './pages/StatusPages'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      <Route element={<GuestRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route element={<RoleRoute roles={['student']} />}>
            <Route path="/student" element={<StudentHome />} />
          </Route>
          <Route element={<RoleRoute roles={['admin']} />}>
            <Route path="/admin" element={<AdminHome />} />
          </Route>
        </Route>
      </Route>

      <Route path="/forbidden" element={<Forbidden />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
