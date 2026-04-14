import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ticketsApi } from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import { StatusBadge, PriorityBadge } from '../components/Badges'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function StatCard({ label, value, color }) {
  return (
    <div className="card">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchTickets = useCallback(async () => {
    try {
      const { data } = await ticketsApi.list({ limit: 50 })
      setTickets(data.data)
    } catch {
      // silencia
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTickets()
    // Polling a cada 5 segundos
    const interval = setInterval(fetchTickets, 5000)
    return () => clearInterval(interval)
  }, [fetchTickets])

  const open = tickets.filter((t) => t.status === 'OPEN').length
  const inProgress = tickets.filter((t) => t.status === 'IN_PROGRESS').length
  const resolved = tickets.filter((t) => t.status === 'RESOLVED').length
  const critical = tickets.filter((t) => t.priority === 'CRITICAL' && t.status === 'OPEN').length

  const recent = tickets.slice(0, 10)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Olá, {user?.name?.split(' ')[0]} 👋</h2>
          <p className="text-sm text-gray-500">Aqui está o resumo dos chamados</p>
        </div>
        <Link to="/tickets/new" className="btn-primary">
          + Novo Chamado
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Abertos" value={open} color="text-yellow-600" />
        <StatCard label="Em Atendimento" value={inProgress} color="text-blue-600" />
        <StatCard label="Resolvidos" value={resolved} color="text-green-600" />
        <StatCard label="Críticos" value={critical} color="text-red-600" />
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-700 mb-4">Chamados Recentes</h3>
        {loading ? (
          <p className="text-sm text-gray-400">Carregando...</p>
        ) : recent.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum chamado encontrado.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {recent.map((ticket) => (
              <Link
                key={ticket.id}
                to={`/tickets/${ticket.id}`}
                className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{ticket.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {ticket.machine?.name} ·{' '}
                    {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <PriorityBadge priority={ticket.priority} />
                  <StatusBadge status={ticket.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
