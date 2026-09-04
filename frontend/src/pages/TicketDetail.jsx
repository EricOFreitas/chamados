import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ticketsApi } from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import { StatusBadge, PriorityBadge } from '../components/Badges'

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Aberto' },
  { value: 'IN_PROGRESS', label: 'Em Atendimento' },
  { value: 'RESOLVED', label: 'Resolvido' },
  { value: 'CLOSED', label: 'Fechado' },
]

const CLOSING_STATUSES = ['RESOLVED', 'CLOSED']
const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.value, s.label]))

export default function TicketDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [timerNote, setTimerNote] = useState('')
  const [activeEntry, setActiveEntry] = useState(null)
  const [elapsed, setElapsed] = useState(0)

  // Encerramento: status pretendido + texto da resolução, enviados juntos
  const [closing, setClosing] = useState(null)
  const [resolutionText, setResolutionText] = useState('')

  const fetchTicket = useCallback(async () => {
    try {
      const { data } = await ticketsApi.get(id)
      setTicket(data)
      const open = data.timeEntries?.find((e) => !e.endedAt)
      setActiveEntry(open || null)
    } catch {
      toast.error('Chamado não encontrado.')
      navigate('/tickets')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => { fetchTicket() }, [fetchTicket])

  // Cronômetro
  useEffect(() => {
    if (!activeEntry) { setElapsed(0); return }
    const tick = () => setElapsed(Math.round((Date.now() - new Date(activeEntry.startedAt)) / 1000))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [activeEntry])

  function handleStatusClick(status) {
    // Resolver/fechar pede a resolução na hora; o resto muda direto
    if (CLOSING_STATUSES.includes(status) && !CLOSING_STATUSES.includes(ticket.status)) {
      setResolutionText(ticket.resolution || '')
      setClosing(status)
      return
    }
    updateStatus(status)
  }

  async function updateStatus(status, resolution) {
    setSubmitting(true)
    try {
      await ticketsApi.update(id, resolution ? { status, resolution } : { status })
      toast.success(
        resolution
          ? 'Chamado encerrado e solicitante notificado por e-mail.'
          : 'Status atualizado.'
      )
      setClosing(null)
      setResolutionText('')
      fetchTicket()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao atualizar.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleConfirmClosing(e) {
    e.preventDefault()
    if (!resolutionText.trim()) {
      toast.error('Descreva o que foi feito para resolver o chamado.')
      return
    }
    updateStatus(closing, resolutionText.trim())
  }

  async function handleComment(e) {
    e.preventDefault()
    if (!comment.trim()) return
    setSubmitting(true)
    try {
      await ticketsApi.addComment(id, comment)
      setComment('')
      fetchTicket()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao comentar.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStartTime() {
    try {
      await ticketsApi.startTime(id)
      toast.success('Atendimento iniciado.')
      fetchTicket()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao iniciar.')
    }
  }

  async function handleStopTime() {
    try {
      await ticketsApi.stopTime(id, timerNote)
      setTimerNote('')
      toast.success('Atendimento encerrado.')
      fetchTicket()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao encerrar.')
    }
  }

  function formatElapsed(secs) {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
  }

  if (loading) return <p className="text-gray-400">Carregando...</p>
  if (!ticket) return null

  const isTech = user?.role === 'TECHNICIAN'
  const totalTime = ticket.timeEntries
    ?.filter((e) => e.durationMinutes)
    .reduce((acc, e) => acc + e.durationMinutes, 0) || 0

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={() => navigate(-1)} className="text-sm text-blue-600 hover:underline mb-2">← Voltar</button>
          <h2 className="text-xl font-semibold">
            <span className="text-gray-400 font-mono mr-2">#{ticket.number}</span>
            {ticket.title}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {ticket.machine?.name} · aberto por {ticket.openedBy?.name} em{' '}
            {format(new Date(ticket.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PriorityBadge priority={ticket.priority} />
          <StatusBadge status={ticket.status} />
        </div>
      </div>

      {/* Descrição */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-600 mb-2">Descrição</h3>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
      </div>

      {/* Resolução */}
      {ticket.resolution && (
        <div className="card border-green-200 bg-green-50">
          <h3 className="text-sm font-semibold text-green-800 mb-2">
            Resolução
            {ticket.resolvedAt && (
              <span className="font-normal text-green-700">
                {' '}· {format(new Date(ticket.resolvedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
          </h3>
          <p className="text-sm text-green-900 whitespace-pre-wrap">{ticket.resolution}</p>
        </div>
      )}

      {/* Timer (somente técnico) */}
      {isTech && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Timer de Atendimento</h3>
          {activeEntry ? (
            <div className="space-y-3">
              <div className="text-3xl font-mono font-bold text-blue-600">{formatElapsed(elapsed)}</div>
              <div>
                <label className="label">Observações (opcional)</label>
                <input className="input" value={timerNote} onChange={(e) => setTimerNote(e.target.value)} placeholder="O que foi feito..." />
              </div>
              <button onClick={handleStopTime} className="btn-danger">Encerrar Atendimento</button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">
                Tempo total registrado: <strong>{totalTime} min</strong>
              </p>
              {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
                <button onClick={handleStartTime} className="btn-primary">▶ Iniciar Atendimento</button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Alterar status (somente técnico) */}
      {isTech && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Alterar Status</h3>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.filter((s) => s.value !== ticket.status).map((s) => (
              <button
                key={s.value}
                onClick={() => handleStatusClick(s.value)}
                disabled={submitting}
                className="btn-secondary text-xs"
              >
                {s.label}
              </button>
            ))}
          </div>
          {activeEntry && (
            <p className="text-xs text-gray-400 mt-2">
              Há um atendimento em andamento — ele será encerrado junto com o chamado.
            </p>
          )}
        </div>
      )}

      {/* Histórico de tempo */}
      {isTech && ticket.timeEntries?.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Histórico de Atendimentos</h3>
          <div className="space-y-2">
            {ticket.timeEntries.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                <div>
                  <p className="text-gray-700">{e.technician?.name}</p>
                  <p className="text-xs text-gray-400">
                    {format(new Date(e.startedAt), 'dd/MM HH:mm', { locale: ptBR })}
                    {e.endedAt && ` → ${format(new Date(e.endedAt), 'HH:mm')}`}
                    {e.notes && ` · ${e.notes}`}
                  </p>
                </div>
                <span className="font-medium">{e.durationMinutes ?? '...'} min</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comentários */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-600 mb-3">
          Comentários ({ticket.comments?.length || 0})
        </h3>
        <div className="space-y-3 mb-4">
          {ticket.comments?.map((c) => (
            <div key={c.id} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-semibold shrink-0">
                {c.author?.name?.[0]}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700">{c.author?.name} · {format(new Date(c.createdAt), 'dd/MM HH:mm', { locale: ptBR })}</p>
                <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-wrap">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
        {ticket.status !== 'CLOSED' && (
          <form onSubmit={handleComment} className="flex gap-2">
            <input
              className="input flex-1"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Adicionar comentário..."
            />
            <button type="submit" disabled={submitting} className="btn-primary">Enviar</button>
          </form>
        )}
      </div>

      {/* Modal de encerramento */}
      {closing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={handleConfirmClosing} className="card w-full max-w-lg space-y-4">
            <div>
              <h3 className="text-base font-semibold">
                Marcar como {STATUS_LABEL[closing]}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                O texto abaixo é gravado no chamado, entra no histórico de comentários e é
                enviado por e-mail para {ticket.openedBy?.name}.
              </p>
            </div>

            <div>
              <label className="label">O que foi feito para resolver?</label>
              <textarea
                className="input min-h-[120px] resize-y"
                autoFocus
                value={resolutionText}
                onChange={(e) => setResolutionText(e.target.value)}
                placeholder="Ex.: Substituída a fonte da máquina e testada a impressão."
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setClosing(null); setResolutionText('') }}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Encerrando...' : `Encerrar e notificar`}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
