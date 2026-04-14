import { useEffect, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ticketsApi } from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import { StatusBadge, PriorityBadge } from '../components/Badges'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
const STATUS_LABELS = { OPEN: 'Aberto', IN_PROGRESS: 'Em Atendimento', RESOLVED: 'Resolvido', CLOSED: 'Fechado' }

export default function TicketsList() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tickets, setTickets] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const page = Number(searchParams.get('page') || 1)
  const status = searchParams.get('status') || ''
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 20 }
      if (status) params.status = status
      if (from) params.from = from
      if (to) params.to = to
      const { data } = await ticketsApi.list(params)
      setTickets(data.data)
      setTotal(data.total)
    } finally {
      setLoading(false)
    }
  }, [page, status, from, to])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  function setParam(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    setSearchParams(next)
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Chamados</h2>
        <Link to="/tickets/new" className="btn-primary">+ Novo</Link>
      </div>

      {/* Filtros */}
      <div className="card mb-4 flex flex-wrap gap-3 p-4">
        <select
          className="input w-auto"
          value={status}
          onChange={(e) => setParam('status', e.target.value)}
        >
          <option value="">Todos os status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>

        {user?.role === 'TECHNICIAN' && (
          <>
            <input type="date" className="input w-auto" value={from} onChange={(e) => setParam('from', e.target.value)} />
            <input type="date" className="input w-auto" value={to} onChange={(e) => setParam('to', e.target.value)} />
          </>
        )}
      </div>

      {/* Lista */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <p className="text-sm text-gray-400 p-6">Carregando...</p>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-gray-400 p-6">Nenhum chamado encontrado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Chamado</th>
                <th className="text-left px-4 py-3">Máquina</th>
                <th className="text-left px-4 py-3">Prioridade</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/tickets/${ticket.id}`} className="font-medium text-blue-600 hover:underline">
                      {ticket.title}
                    </Link>
                    <p className="text-xs text-gray-400 mt-0.5">por {ticket.openedBy?.name}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{ticket.machine?.name}</td>
                  <td className="px-4 py-3"><PriorityBadge priority={ticket.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
                  <td className="px-4 py-3 text-gray-500">
                    {format(new Date(ticket.createdAt), 'dd/MM/yy HH:mm', { locale: ptBR })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>{total} chamados</span>
          <div className="flex gap-2">
            <button
              className="btn-secondary px-3 py-1"
              disabled={page <= 1}
              onClick={() => setParam('page', page - 1)}
            >Anterior</button>
            <span className="px-3 py-1">{page} / {totalPages}</span>
            <button
              className="btn-secondary px-3 py-1"
              disabled={page >= totalPages}
              onClick={() => setParam('page', page + 1)}
            >Próxima</button>
          </div>
        </div>
      )}
    </div>
  )
}
