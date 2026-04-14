import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import TicketsList from './pages/TicketsList'
import TicketNew from './pages/TicketNew'
import TicketDetail from './pages/TicketDetail'
import Reports from './pages/Reports'
import Users from './pages/Users'
import Machines from './pages/Machines'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex h-screen items-center justify-center text-gray-500">Carregando...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function TechnicianRoute({ children }) {
  const { user } = useAuth()
  if (user?.role !== 'TECHNICIAN') return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="tickets" element={<TicketsList />} />
        <Route path="tickets/new" element={<TicketNew />} />
        <Route path="tickets/:id" element={<TicketDetail />} />
        <Route
          path="reports"
          element={
            <TechnicianRoute>
              <Reports />
            </TechnicianRoute>
          }
        />
        <Route
          path="users"
          element={
            <TechnicianRoute>
              <Users />
            </TechnicianRoute>
          }
        />
        <Route
          path="machines"
          element={
            <TechnicianRoute>
              <Machines />
            </TechnicianRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
