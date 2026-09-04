const nodemailer = require('nodemailer');

// Campos vindos do usuário são interpolados no HTML do e-mail.
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

let transporter;

function smtpConfig() {
  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    technicianEmail: process.env.TECHNICIAN_EMAIL,
    // Servidor de e-mail próprio costuma ter certificado que não bate com o
    // hostname. Só desligue a verificação se souber que é esse o caso.
    rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
  };
}

// Aponta erros de configuração antes de tentar enviar — a causa mais comum de
// "o e-mail simplesmente não chega" é uma variável de ambiente faltando.
function configProblems() {
  const cfg = smtpConfig();
  const problems = [];
  if (!cfg.host) problems.push('SMTP_HOST não definido — o envio de e-mail está desligado.');
  if (!cfg.user) problems.push('SMTP_USER não definido.');
  if (!process.env.SMTP_PASS) problems.push('SMTP_PASS não definido.');
  if (!cfg.from) problems.push('SMTP_FROM (e SMTP_USER) não definidos — o SMTP recusa mensagens sem remetente.');
  if (!cfg.technicianEmail) problems.push('TECHNICIAN_EMAIL não definido — ninguém será avisado de chamados novos.');
  if (cfg.port === 465 && !cfg.secure) problems.push('Porta 465 exige SMTP_SECURE=true.');
  if (cfg.port === 587 && cfg.secure) problems.push('Porta 587 exige SMTP_SECURE=false (o TLS sobe via STARTTLS).');
  if (!process.env.FRONTEND_URL) problems.push('FRONTEND_URL não definido — os links dos e-mails ficarão quebrados.');
  if (!cfg.rejectUnauthorized) problems.push('SMTP_TLS_REJECT_UNAUTHORIZED=false: o certificado do servidor não está sendo verificado.');
  return problems;
}

// Traduz os erros de SMTP mais comuns para algo acionável. O nodemailer costuma
// embrulhar o erro real de socket em code=ESOCKET, então a mensagem também é lida.
function explainError(err) {
  const code = err.code || '';
  const msg = err.message || '';
  const is = (re) => re.test(msg);

  if (code === 'ECONNREFUSED' || is(/ECONNREFUSED/)) {
    return 'Conexão recusada pelo servidor SMTP. Porta errada, serviço fora do ar, ou o firewall do servidor de e-mail está bloqueando o IP de onde o sistema roda.';
  }
  if (code === 'ETIMEDOUT' || is(/ETIMEDOUT|timed? ?out/i)) {
    return 'Tempo esgotado ao conectar. Normalmente é firewall no meio do caminho ou saída da porta bloqueada no servidor onde o sistema roda.';
  }
  if (is(/ENOTFOUND|EAI_AGAIN|getaddrinfo/)) {
    return 'O nome do servidor SMTP não resolveu no DNS. Confira o SMTP_HOST.';
  }
  if (code === 'EAUTH' || is(/\b535\b|authentication|invalid login/i)) {
    return 'Usuário ou senha do SMTP recusados. Em provedores como Gmail é preciso usar senha de aplicativo.';
  }
  if (is(/self.signed|unable to verify|altnames|CERT_|certificate/i)) {
    return 'O certificado TLS do servidor não confere com o hostname. Use o hostname exato do certificado, ou defina SMTP_TLS_REJECT_UNAUTHORIZED=false se o servidor é seu.';
  }
  if (is(/wrong version number|SSL routines|ssl3/i)) {
    return 'Incompatibilidade de TLS: a porta 465 exige SMTP_SECURE=true e a 587 exige SMTP_SECURE=false.';
  }
  if (is(/\b(550|553|554)\b|relay|not permitted|sender/i)) {
    return 'O servidor aceitou a conexão mas recusou a mensagem. Normalmente o SMTP_FROM precisa ser exatamente o mesmo endereço do SMTP_USER.';
  }
  return null;
}

function getTransporter() {
  if (!transporter) {
    const cfg = smtpConfig();
    transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: process.env.SMTP_PASS },
      tls: { rejectUnauthorized: cfg.rejectUnauthorized },
      // Falha rápido em vez de deixar a abertura de chamado pendurada
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });
  }
  return transporter;
}

// Testa a conexão/autenticação com o SMTP sem enviar mensagem.
async function verifyTransport() {
  const problems = configProblems();
  if (!smtpConfig().host) {
    return { ok: false, config: smtpConfig(), problems };
  }
  try {
    await getTransporter().verify();
    return { ok: true, config: smtpConfig(), problems };
  } catch (err) {
    return {
      ok: false,
      config: smtpConfig(),
      problems,
      error: err.message,
      hint: explainError(err),
      code: err.code || null,
      response: err.response || null,
    };
  }
}

// Chamado no boot: deixa registrado no log do container se o SMTP está de pé.
async function logTransportStatus() {
  const cfg = smtpConfig();
  const problems = configProblems();
  problems.forEach((p) => console.warn('[email] AVISO:', p));

  if (!cfg.host) return;
  const result = await verifyTransport();
  if (result.ok) {
    console.log(
      `[email] SMTP OK — ${cfg.host}:${cfg.port} (secure=${cfg.secure}) ` +
      `from=${cfg.from} · chamados novos vão para ${cfg.technicianEmail}`
    );
  } else {
    console.error(`[email] SMTP FALHOU — ${cfg.host}:${cfg.port}: ${result.error}`);
    if (result.hint) console.error(`[email] provável causa: ${result.hint}`);
  }
}

async function sendEmail({ to, subject, html }) {
  const cfg = smtpConfig();
  if (!cfg.host) {
    console.warn(`[email] ignorado (SMTP_HOST não definido): "${subject}" para ${to}`);
    return { ok: false, skipped: true, error: 'SMTP_HOST não definido.' };
  }
  if (!to) {
    console.warn(`[email] ignorado (destinatário vazio): "${subject}"`);
    return { ok: false, skipped: true, error: 'Destinatário vazio.' };
  }
  try {
    const info = await getTransporter().sendMail({ from: cfg.from, to, subject, html });
    console.log(`[email] enviado para ${to} — "${subject}" (${info.messageId})`);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    const hint = explainError(err);
    console.error(
      `[email] FALHA ao enviar para ${to} — "${subject}": ${err.message}` +
      (err.code ? ` [${err.code}]` : '') +
      (err.response ? ` resposta do servidor: ${err.response}` : '')
    );
    if (hint) console.error(`[email] provável causa: ${hint}`);
    return { ok: false, error: err.message, hint, code: err.code || null };
  }
}

function ticketRef(ticket) {
  return `#${ticket.number ?? ticket.id.slice(-6).toUpperCase()}`;
}

function ticketUrl(ticket) {
  return `${process.env.FRONTEND_URL || ''}/tickets/${ticket.id}`;
}

async function notifyTicketOpened(ticket, openedBy) {
  return sendEmail({
    to: process.env.TECHNICIAN_EMAIL,
    subject: `[Chamado ${ticketRef(ticket)}] Novo chamado: ${ticket.title}`,
    html: `
      <h2>Novo chamado aberto</h2>
      <p><strong>Título:</strong> ${esc(ticket.title)}</p>
      <p><strong>Descrição:</strong> ${esc(ticket.description)}</p>
      <p><strong>Máquina:</strong> ${esc(ticket.machine?.name || '-')}</p>
      <p><strong>Prioridade:</strong> ${esc(ticket.priority)}</p>
      <p><strong>Aberto por:</strong> ${esc(openedBy.name)} (${esc(openedBy.email)})</p>
      <p><a href="${ticketUrl(ticket)}">Ver chamado</a></p>
    `,
  });
}

// `resolution` é o texto de encerramento gravado no próprio chamado,
// não mais o "último comentário do técnico" adivinhado.
async function notifyTicketResolved(ticket, user, resolution) {
  if (!user?.email) {
    console.warn(`[email] chamado ${ticketRef(ticket)} encerrado, mas o solicitante não tem e-mail.`);
    return { ok: false, skipped: true, error: 'Solicitante sem e-mail.' };
  }

  const resolutionHtml = resolution?.content
    ? `<p><strong>Resolução:</strong></p>
       <blockquote style="margin:0 0 12px;padding:10px 14px;border-left:3px solid #ccc;background:#f6f6f6;white-space:pre-wrap;">${esc(
         resolution.content
       )}</blockquote>
       <p style="color:#666;font-size:13px;">— ${esc(resolution.authorName || 'Suporte')}</p>`
    : `<p><strong>Resolução:</strong> O técnico encerrou o atendimento deste chamado.</p>`;

  return sendEmail({
    to: user.email,
    subject: `[Chamado ${ticketRef(ticket)}] Chamado resolvido: ${ticket.title}`,
    html: `
      <h2>Seu chamado foi resolvido</h2>
      <p><strong>Título:</strong> ${esc(ticket.title)}</p>
      ${resolutionHtml}
      <p><a href="${ticketUrl(ticket)}">Ver chamado</a></p>
    `,
  });
}

async function sendTestEmail(to) {
  const cfg = smtpConfig();
  return sendEmail({
    to,
    subject: '[Chamados] E-mail de teste',
    html: `
      <h2>E-mail de teste</h2>
      <p>Se você está lendo isto, o SMTP do sistema de chamados está funcionando.</p>
      <ul>
        <li><strong>Host:</strong> ${esc(cfg.host)}:${esc(cfg.port)} (secure=${esc(cfg.secure)})</li>
        <li><strong>Remetente:</strong> ${esc(cfg.from)}</li>
        <li><strong>Enviado em:</strong> ${new Date().toLocaleString('pt-BR')}</li>
      </ul>
    `,
  });
}

module.exports = {
  notifyTicketOpened,
  notifyTicketResolved,
  sendTestEmail,
  verifyTransport,
  logTransportStatus,
  smtpConfig,
  configProblems,
};
