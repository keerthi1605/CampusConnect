import { Route, Routes } from 'react-router-dom'
import { GuestRoute, ProtectedRoute, RoleRoute, RootRedirect } from './auth/routeGuards'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import { Forbidden, NotFound } from './pages/StatusPages'
import AdminApplicants from './pages/admin/Applicants'
import AdminDashboard from './pages/admin/Dashboard'
import { JobEdit, JobNew } from './pages/admin/JobForm'
import AdminJobs from './pages/admin/Jobs'
import AdminStudents from './pages/admin/Students'
import StudentApplications from './pages/student/Applications'
import StudentDashboard from './pages/student/Dashboard'
import StudentJobDetail from './pages/student/JobDetail'
import StudentJobs from './pages/student/Jobs'
import StudentProfile from './pages/student/Profile'

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
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/student/profile" element={<StudentProfile />} />
            <Route path="/student/jobs" element={<StudentJobs />} />
            <Route path="/student/jobs/:id" element={<StudentJobDetail />} />
            <Route path="/student/applications" element={<StudentApplications />} />
          </Route>
          <Route element={<RoleRoute roles={['admin']} />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/jobs" element={<AdminJobs />} />
            <Route path="/admin/jobs/new" element={<JobNew />} />
            <Route path="/admin/jobs/:id/edit" element={<JobEdit />} />
            <Route path="/admin/jobs/:id/applicants" element={<AdminApplicants />} />
            <Route path="/admin/students" element={<AdminStudents />} />
          </Route>
        </Route>
      </Route>

      <Route path="/forbidden" element={<Forbidden />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
