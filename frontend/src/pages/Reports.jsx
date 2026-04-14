import { useEffect, useState } from 'react'
import { reportsApi } from '../api/endpoints'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { format, subDays } from 'date-fns'

const STATUS_LABELS = { OPEN: 'Aberto', IN_PROGRESS: 'Em Atendimento', RESOLVED: 'Resolvido', CLOSED: 'Fechado' }
const PRIORITY_LABELS = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', CRITICAL: 'Crítica' }
const BAR_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function Reports() {
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  async function fetchReport() {
    setLoading(true)
    try {
      const { data: res } = await reportsApi.get(from, to)
      setData(res)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReport() }, []) // eslint-disable-line

  return (
    <div className="max-w-4xl space-y-6">
      <h2 className="text-xl font-semibold">Relatórios</h2>

      {/* Filtro de período */}
      <div className="card flex flex-wrap items-end gap-4">
        <div>
          <label className="label">De</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">Até</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button onClick={fetchReport} disabled={loading} className="btn-primary">
          {loading ? 'Carregando...' : 'Gerar Relatório'}
        </button>
      </div>

      {data && (
        <>
          {/* Cards resumo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card text-center">
              <p className="text-3xl font-bold text-blue-600">{data.totalTickets}</p>
              <p className="text-sm text-gray-500 mt-1">Total de Chamados</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-green-600">{data.timeEntries.totalSessions}</p>
              <p className="text-sm text-gray-500 mt-1">Atendimentos</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-purple-600">{data.timeEntries.totalMinutes}</p>
              <p className="text-sm text-gray-500 mt-1">Minutos Totais</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-orange-600">{data.timeEntries.avgMinutes}</p>
              <p className="text-sm text-gray-500 mt-1">Média (min)</p>
            </div>
          </div>

          {/* Chamados por dia */}
          {data.dailyCounts?.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-700 mb-4">Chamados por Dia</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.dailyCounts}>
                  <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), 'dd/MM')} tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip labelFormatter={(d) => format(new Date(d), 'dd/MM/yyyy')} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Por status */}
            <div className="card">
              <h3 className="font-semibold text-gray-700 mb-3">Por Status</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.byStatus} layout="vertical">
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="status" tickFormatter={(s) => STATUS_LABELS[s] || s} tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={(v, _n, p) => [v, STATUS_LABELS[p.payload.status] || p.payload.status]} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {data.byStatus.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Por prioridade */}
            <div className="card">
              <h3 className="font-semibold text-gray-700 mb-3">Por Prioridade</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.byPriority} layout="vertical">
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="priority" tickFormatter={(p) => PRIORITY_LABELS[p] || p} tick={{ fontSize: 11 }} width={60} />
                  <Tooltip formatter={(v, _n, p) => [v, PRIORITY_LABELS[p.payload.priority] || p.payload.priority]} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {data.byPriority.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Por máquina */}
          {data.byMachine?.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-700 mb-3">Máquinas com Mais Chamados</h3>
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2">Máquina</th>
                    <th className="text-right px-3 py-2">Chamados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.byMachine.map((m) => (
                    <tr key={m.machineId}>
                      <td className="px-3 py-2">{m.machineName}</td>
                      <td className="px-3 py-2 text-right font-medium">{m.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
