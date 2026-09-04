import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { healthApi } from '../api/endpoints'

function Row({ label, value, mono }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2 py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 w-44 shrink-0">{label}</span>
      <span className={`text-sm text-gray-800 break-all ${mono ? 'font-mono text-xs' : ''}`}>
        {value || <em className="text-red-500 not-italic">não definido</em>}
      </span>
    </div>
  )
}

export default function Settings() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [testTo, setTestTo] = useState('')

  const check = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await healthApi.email()
      setStatus(data)
      if (!testTo && data.config?.technicianEmail) setTestTo(data.config.technicianEmail)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao consultar o SMTP.')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { check() }, [check])

  async function handleTest(e) {
    e.preventDefault()
    setSending(true)
    try {
      const { data } = await healthApi.testEmail(testTo)
      toast.success(`E-mail de teste enviado para ${data.to}. Confira também o spam.`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Falha ao enviar o e-mail de teste.')
    } finally {
      setSending(false)
    }
  }

  const cfg = status?.config || {}

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-xl font-semibold">Configurações</h2>

      <div className="card space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-gray-600">Envio de e-mail (SMTP)</h3>
          <button className="btn-secondary text-xs" onClick={check} disabled={loading}>
            {loading ? 'Verificando...' : 'Verificar novamente'}
          </button>
        </div>

        {loading && !status ? (
          <p className="text-sm text-gray-400">Verificando conexão...</p>
        ) : (
          <>
            <div
              className={`rounded-lg px-4 py-3 text-sm ${
                status?.ok
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {status?.ok ? (
                <strong>Conectado e autenticado no servidor SMTP.</strong>
              ) : (
                <>
                  <strong>Não foi possível usar o SMTP.</strong>
                  {status?.error && <p className="mt-1 font-mono text-xs">{status.error}</p>}
                  {status?.response && <p className="mt-1 font-mono text-xs">{status.response}</p>}
                  {status?.hint && <p className="mt-2">{status.hint}</p>}
                </>
              )}
            </div>

            {status?.problems?.length > 0 && (
              <ul className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 space-y-1">
                {status.problems.map((p) => <li key={p}>• {p}</li>)}
              </ul>
            )}

            <div>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">
                Variáveis de ambiente em uso
              </p>
              <Row label="SMTP_HOST" value={cfg.host} mono />
              <Row label="SMTP_PORT" value={String(cfg.port ?? '')} mono />
              <Row label="SMTP_SECURE" value={String(cfg.secure)} mono />
              <Row label="SMTP_USER" value={cfg.user} mono />
              <Row label="SMTP_FROM" value={cfg.from} mono />
              <Row label="TECHNICIAN_EMAIL" value={cfg.technicianEmail} mono />
              <p className="text-xs text-gray-400 mt-2">
                A senha (SMTP_PASS) nunca é exibida. Para alterar qualquer um desses valores,
                edite as variáveis no Coolify e faça um <strong>Redeploy</strong> do backend —
                um Restart não recarrega o ambiente.
              </p>
            </div>

            <form onSubmit={handleTest} className="pt-2 border-t border-gray-100 space-y-2">
              <label className="label">Enviar e-mail de teste para</label>
              <div className="flex flex-wrap gap-2">
                <input
                  type="email"
                  className="input flex-1 min-w-[220px]"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  placeholder="voce@exemplo.com"
                  required
                />
                <button type="submit" className="btn-primary" disabled={sending}>
                  {sending ? 'Enviando...' : 'Enviar teste'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
