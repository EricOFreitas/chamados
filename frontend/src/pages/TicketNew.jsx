import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ticketsApi, machinesApi } from '../api/endpoints'

const PRIORITIES = [
  { value: 'LOW', label: 'Baixa' },
  { value: 'MEDIUM', label: 'Média' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'CRITICAL', label: 'Crítica' },
]

export default function TicketNew() {
  const navigate = useNavigate()
  const [machines, setMachines] = useState([])
  const [form, setForm] = useState({ title: '', description: '', machineId: '', priority: 'MEDIUM' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    machinesApi.list().then(({ data }) => setMachines(data.filter((m) => m.active)))
  }, [])

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.machineId) return toast.error('Selecione a máquina.')
    setLoading(true)
    try {
      const { data } = await ticketsApi.create(form)
      toast.success('Chamado aberto com sucesso!')
      navigate(`/tickets/${data.id}`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao abrir chamado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold mb-6">Abrir Chamado</h2>
      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="label">Título *</label>
          <input
            className="input"
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            placeholder="Descreva o problema brevemente"
            required
          />
        </div>

        <div>
          <label className="label">Descrição *</label>
          <textarea
            className="input min-h-[100px]"
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="Descreva o problema detalhadamente"
            required
          />
        </div>

        <div>
          <label className="label">Máquina *</label>
          <select
            className="input"
            value={form.machineId}
            onChange={(e) => setField('machineId', e.target.value)}
            required
          >
            <option value="">Selecione...</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}{m.location ? ` — ${m.location}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Prioridade</label>
          <select
            className="input"
            value={form.priority}
            onChange={(e) => setField('priority', e.target.value)}
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Abrindo...' : 'Abrir Chamado'}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
