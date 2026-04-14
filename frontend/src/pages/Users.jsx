import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { usersApi } from '../api/endpoints'

function UserModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    phone: user?.phone || '',
    role: user?.role || 'USER',
  })
  const [loading, setLoading] = useState(false)

  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = { name: form.name, email: form.email, phone: form.phone, role: form.role }
      if (form.password) payload.password = form.password
      if (user) {
        await usersApi.update(user.id, payload)
        toast.success('Usuário atualizado.')
      } else {
        if (!form.password) return toast.error('Informe a senha.')
        await usersApi.create({ ...payload, password: form.password })
        toast.success('Usuário criado.')
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
        <h3 className="font-semibold text-lg mb-4">{user ? 'Editar Usuário' : 'Novo Usuário'}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Nome *</label>
            <input className="input" value={form.name} onChange={(e) => setField('name', e.target.value)} required />
          </div>
          <div>
            <label className="label">E-mail *</label>
            <input className="input" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} required />
          </div>
          <div>
            <label className="label">Senha {user ? '(deixe em branco para não alterar)' : '*'}</label>
            <input className="input" type="password" value={form.password} onChange={(e) => setField('password', e.target.value)} />
          </div>
          <div>
            <label className="label">Telefone/WhatsApp</label>
            <input className="input" value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="5511999999999" />
          </div>
          <div>
            <label className="label">Perfil</label>
            <select className="input" value={form.role} onChange={(e) => setField('role', e.target.value)}>
              <option value="USER">Usuário</option>
              <option value="TECHNICIAN">Técnico</option>
            </select>
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

export default function Users() {
  const [users, setUsers] = useState([])
  const [modal, setModal] = useState(null) // null | 'new' | user object

  async function fetchUsers() {
    const { data } = await usersApi.list()
    setUsers(data)
  }

  useEffect(() => { fetchUsers() }, [])

  async function handleDeactivate(id) {
    if (!confirm('Desativar este usuário?')) return
    await usersApi.deactivate(id)
    toast.success('Usuário desativado.')
    fetchUsers()
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Usuários</h2>
        <button onClick={() => setModal('new')} className="btn-primary">+ Novo Usuário</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Nome</th>
              <th className="text-left px-4 py-3">E-mail</th>
              <th className="text-left px-4 py-3">Perfil</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === 'TECHNICIAN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                    {u.role === 'TECHNICIAN' ? 'Técnico' : 'Usuário'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {u.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setModal(u)} className="text-blue-600 hover:underline text-xs mr-3">Editar</button>
                  {u.active && (
                    <button onClick={() => handleDeactivate(u.id)} className="text-red-600 hover:underline text-xs">Desativar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <UserModal
          user={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchUsers() }}
        />
      )}
    </div>
  )
}
