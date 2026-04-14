import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItem = ({ isActive }) =>
  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
  }`

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-4 py-5 border-b border-gray-200">
          <h1 className="text-base font-bold text-blue-600">Chamados</h1>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{user?.name}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavLink to="/" end className={navItem}>
            Dashboard
          </NavLink>
          <NavLink to="/tickets" className={navItem}>
            Chamados
          </NavLink>
          <NavLink to="/tickets/new" className={navItem}>
            + Abrir Chamado
          </NavLink>
          {user?.role === 'TECHNICIAN' && (
            <>
              <div className="pt-3 pb-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3">Gestão</p>
              </div>
              <NavLink to="/reports" className={navItem}>
                Relatórios
              </NavLink>
              <NavLink to="/users" className={navItem}>
                Usuários
              </NavLink>
              <NavLink to="/machines" className={navItem}>
                Máquinas
              </NavLink>
            </>
          )}
        </nav>
        <div className="p-3 border-t border-gray-200">
          <button onClick={handleLogout} className="btn-secondary w-full text-xs">
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
