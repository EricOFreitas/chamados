import { useEffect, useState, useCallback, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ticketsApi, machinesApi } from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import { StatusBadge, PriorityBadge } from '../components/Badges'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
const STATUS_LABELS = { OPEN: 'Aberto', IN_PROGRESS: 'Em Atendimento', RESOLVED: 'Resolvido', CLOSED: 'Fechado' }
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const PRIORITY_LABELS = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', CRITICAL: 'Crítica' }
const PAGE_SIZES = [20, 50, 100]

// Colunas clicáveis para ordenação
const COLUMNS = [
  { key: 'number', label: '#', sortable: true, className: 'w-16' },
  { key: 'title', label: 'Chamado', sortable: false },
  { key: 'machine', label: 'Máquina', sortable: false },
  { key: 'priority', label: 'Prioridade', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'createdAt', label: 'Abertura', sortable: true },
]

export default function TicketsList() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tickets, setTickets] = useState([])
  const [machines, setMachines] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const page = Number(searchParams.get('page') || 1)
  const limit = Number(searchParams.get('limit') || 20)
  const status = searchParams.get('status') || ''
  const priority = searchParams.get('priority') || ''
  const machineId = searchParams.get('machineId') || ''
  const q = searchParams.get('q') || ''
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const sort = searchParams.get('sort') || 'createdAt'
  const order = searchParams.get('order') || 'desc'

  // Campo de busca controlado localmente para não disparar um request por tecla
  const [searchText, setSearchText] = useState(q)
  const searchRef = useRef(q)

  useEffect(() => {
    // Mantém o input em sincronia quando a URL muda por fora (voltar/limpar)
    if (searchRef.current !== q) {
      searchRef.current = q
      setSearchText(q)
    }
  }, [q])

  useEffect(() => {
    machinesApi.list().then(({ data }) => setMachines(data)).catch(() => {})
  }, [])

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit, sort, order }
      if (status) params.status = status
      if (priority) params.priority = priority
      if (machineId) params.machineId = machineId
      if (q) params.q = q
      if (from) params.from = from
      if (to) params.to = to
      const { data } = await ticketsApi.list(params)
      setTickets(data.data)
      setTotal(data.total)
      setTotalPages(data.totalPages ?? Math.max(1, Math.ceil(data.total / limit)))
    } finally {
      setLoading(false)
    }
  }, [page, limit, status, priority, machineId, q, from, to, sort, order])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  function updateParams(changes, { resetPage = true } = {}) {
    const next = new URLSearchParams(searchParams)
    Object.entries(changes).forEach(([key, value]) => {
      if (value) next.set(key, value)
      else next.delete(key)
    })
    // Trocar um filtro invalida a página atual; trocar de página, não.
    if (resetPage) next.delete('page')
    setSearchParams(next)
  }

  const setFilter = (key, value) => updateParams({ [key]: value })
  const goToPage = (n) => updateParams({ page: String(n) }, { resetPage: false })

  function toggleSort(key) {
    if (sort === key) updateParams({ sort: key, order: order === 'asc' ? 'desc' : 'asc' })
    else updateParams({ sort: key, order: 'desc' })
  }

  // Busca com debounce de 400ms
  useEffect(() => {
    if (searchText === q) return
    const timer = setTimeout(() => {
      searchRef.current = searchText
      setFilter('q', searchText.trim())
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText])

  const hasFilters = Boolean(status || priority || machineId || q || from || to)
  const firstRow = total === 0 ? 0 : (page - 1) * limit + 1
  const lastRow = Math.min(page * limit, total)

  function sortIndicator(key) {
    if (sort !== key) return <span className="text-gray-300 ml-1">↕</span>
    return <span className="ml-1">{order === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Chamados</h2>
        <Link to="/tickets/new" className="btn-primary">+ Novo</Link>
      </div>

      {/* Filtros */}
      <div className="card mb-4 space-y-3 p-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="search"
            className="input flex-1 min-w-[220px]"
            placeholder="Buscar por número, título, descrição ou resolução..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <select className="input w-auto" value={status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">Todos os status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <select className="input w-auto" value={priority} onChange={(e) => setFilter('priority', e.target.value)}>
            <option value="">Todas as prioridades</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select className="input w-auto" value={machineId} onChange={(e) => setFilter('machineId', e.target.value)}>
            <option value="">Todas as máquinas</option>
            {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

          {user?.role === 'TECHNICIAN' && (
            <>
              <label className="text-sm text-gray-500">De</label>
              <input type="date" className="input w-auto" value={from} onChange={(e) => setFilter('from', e.target.value)} />
              <label className="text-sm text-gray-500">até</label>
              <input type="date" className="input w-auto" value={to} onChange={(e) => setFilter('to', e.target.value)} />
            </>
          )}

          {hasFilters && (
            <button
              className="text-sm text-blue-600 hover:underline"
              onClick={() => setSearchParams(new URLSearchParams())}
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <p className="text-sm text-gray-400 p-6">Carregando...</p>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-gray-400 p-6">
            {hasFilters ? 'Nenhum chamado encontrado com esses filtros.' : 'Nenhum chamado encontrado.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  {COLUMNS.map((col) => (
                    <th key={col.key} className={`text-left px-4 py-3 ${col.className || ''}`}>
                      {col.sortable ? (
                        <button
                          className="uppercase font-medium hover:text-gray-900"
                          onClick={() => toggleSort(col.key)}
                        >
                          {col.label}{sortIndicator(col.key)}
                        </button>
                      ) : col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">#{ticket.number}</td>
                    <td className="px-4 py-3">
                      <Link to={`/tickets/${ticket.id}`} className="font-medium text-blue-600 hover:underline">
                        {ticket.title}
                      </Link>
                      <p className="text-xs text-gray-400 mt-0.5">por {ticket.openedBy?.name}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{ticket.machine?.name}</td>
                    <td className="px-4 py-3"><PriorityBadge priority={ticket.priority} /></td>
                    <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {format(new Date(ticket.createdAt), 'dd/MM/yy HH:mm', { locale: ptBR })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginação */}
      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-sm text-gray-500">
          <div className="flex items-center gap-3">
            <span>{firstRow}–{lastRow} de {total} chamados</span>
            <select
              className="input w-auto py-1 text-xs"
              value={limit}
              onChange={(e) => setFilter('limit', e.target.value)}
            >
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} por página</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button className="btn-secondary px-3 py-1" disabled={page <= 1} onClick={() => goToPage(1)}>««</button>
            <button className="btn-secondary px-3 py-1" disabled={page <= 1} onClick={() => goToPage(page - 1)}>Anterior</button>
            <span className="px-3 py-1">{page} / {totalPages}</span>
            <button className="btn-secondary px-3 py-1" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>Próxima</button>
            <button className="btn-secondary px-3 py-1" disabled={page >= totalPages} onClick={() => goToPage(totalPages)}>»»</button>
          </div>
        </div>
      )}
    </div>
  )
}
