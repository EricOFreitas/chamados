const nodemailer = require('nodemailer');

// Campos vindos do usuário são interpolados no HTML do e-mail.
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

async function sendEmail({ to, subject, html }) {
  if (!process.env.SMTP_HOST) return;
  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error('[email] Falha ao enviar email:', err.message);
  }
}

async function notifyTicketOpened(ticket, openedBy) {
  const url = `${process.env.FRONTEND_URL}/tickets/${ticket.id}`;
  await sendEmail({
    to: process.env.TECHNICIAN_EMAIL,
    subject: `[Chamado #${ticket.id.slice(-6).toUpperCase()}] Novo chamado: ${ticket.title}`,
    html: `
      <h2>Novo chamado aberto</h2>
      <p><strong>Título:</strong> ${esc(ticket.title)}</p>
      <p><strong>Descrição:</strong> ${esc(ticket.description)}</p>
      <p><strong>Máquina:</strong> ${esc(ticket.machine?.name || '-')}</p>
      <p><strong>Prioridade:</strong> ${esc(ticket.priority)}</p>
      <p><strong>Aberto por:</strong> ${esc(openedBy.name)} (${esc(openedBy.email)})</p>
      <p><a href="${url}">Ver chamado</a></p>
    `,
  });
}

async function notifyTicketResolved(ticket, user, resolution) {
  if (!user?.email) return;
  const url = `${process.env.FRONTEND_URL}/tickets/${ticket.id}`;
  const resolutionHtml = resolution?.content
    ? `<p><strong>Resolução:</strong></p>
       <blockquote style="margin:0 0 12px;padding:10px 14px;border-left:3px solid #ccc;background:#f6f6f6;white-space:pre-wrap;">${esc(
         resolution.content
       )}</blockquote>
       <p style="color:#666;font-size:13px;">— ${esc(resolution.author?.name || 'Suporte')}</p>`
    : `<p><strong>Resolução:</strong> O técnico encerrou o atendimento deste chamado.</p>`;

  await sendEmail({
    to: user.email,
    subject: `[Chamado #${ticket.id.slice(-6).toUpperCase()}] Chamado resolvido: ${ticket.title}`,
    html: `
      <h2>Seu chamado foi resolvido</h2>
      <p><strong>Título:</strong> ${esc(ticket.title)}</p>
      ${resolutionHtml}
      <p><a href="${url}">Ver chamado</a></p>
    `,
  });
}

module.exports = { notifyTicketOpened, notifyTicketResolved };
