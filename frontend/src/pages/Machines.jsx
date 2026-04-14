import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { machinesApi } from '../api/endpoints'

function MachineModal({ machine, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: machine?.name || '',
    hostname: machine?.hostname || '',
    location: machine?.location || '',
  })
  const [loading, setLoading] = useState(false)

  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      if (machine) {
        await machinesApi.update(machine.id, form)
        toast.success('Máquina atualizada.')
      } else {
        await machinesApi.create(form)
        toast.success('Máquina cadastrada.')
      }
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="font-semibold text-lg mb-4">{machine ? 'Editar Máquina' : 'Nova Máquina'}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Nome *</label>
            <input className="input" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Computador 01" required />
          </div>
          <div>
            <label className="label">Hostname</label>
            <input className="input" value={form.hostname} onChange={(e) => setField('hostname', e.target.value)} placeholder="PC-01" />
          </div>
          <div>
            <label className="label">Localização</label>
            <input className="input" value={form.location} onChange={(e) => setField('location', e.target.value)} placeholder="Recepção" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Salvando...' : 'Salvar'}</button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Machines() {
  const [machines, setMachines] = useState([])
  const [modal, setModal] = useState(null)

  async function fetchMachines() {
    const { data } = await machinesApi.list()
    setMachines(data)
  }

  useEffect(() => { fetchMachines() }, [])

  async function handleToggle(m) {
    await machinesApi.update(m.id, { active: !m.active })
    toast.success(`Máquina ${m.active ? 'desativada' : 'ativada'}.`)
    fetchMachines()
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Máquinas</h2>
        <button onClick={() => setModal('new')} className="btn-primary">+ Nova Máquina</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Nome</th>
              <th className="text-left px-4 py-3">Hostname</th>
              <th className="text-left px-4 py-3">Localização</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {machines.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{m.name}</td>
                <td className="px-4 py-3 text-gray-500">{m.hostname || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{m.location || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${m.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {m.active ? 'Ativa' : 'Inativa'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setModal(m)} className="text-blue-600 hover:underline text-xs mr-3">Editar</button>
                  <button onClick={() => handleToggle(m)} className="text-gray-500 hover:underline text-xs">
                    {m.active ? 'Desativar' : 'Ativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <MachineModal
          machine={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchMachines() }}
        />
      )}
    </div>
  )
}
