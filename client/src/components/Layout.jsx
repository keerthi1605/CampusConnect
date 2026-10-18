import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { homePathFor, useAuth } from '../auth/useAuth'

// Each role's links; student pages live under /student/*, admin pages under /admin/*
const NAV_LINKS = {
  student: [
    { to: '/student', label: 'Dashboard' },
    { to: '/student/jobs', label: 'Jobs' },
    { to: '/student/applications', label: 'Applications' },
    { to: '/student/profile', label: 'Profile' },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard' },
    { to: '/admin/jobs', label: 'Jobs' },
    { to: '/admin/students', label: 'Students' },
  ],
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const links = NAV_LINKS[user.role] ?? []

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <header className="navbar">
        <NavLink to={homePathFor(user.role)} className="brand">
          CampusConnect
        </NavLink>
        <nav className="nav-links" aria-label="Main">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === homePathFor(user.role)}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-user">
          <span className="who">
            {user.name} <span className="badge">{user.role}</span>
          </span>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  )
}
