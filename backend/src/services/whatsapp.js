const axios = require('axios');

const BASE_URL = () => process.env.EVOLUTION_API_URL;
const TOKEN = () => process.env.EVOLUTION_API_TOKEN;
const INSTANCE = () => process.env.EVOLUTION_INSTANCE;
const TECH_PHONE = () => process.env.TECHNICIAN_PHONE;

async function sendWhatsApp(phone, text) {
  if (!BASE_URL() || !TOKEN() || !INSTANCE() || !phone) return;
  try {
    await axios.post(
      `${BASE_URL()}/message/sendText/${INSTANCE()}`,
      {
        number: phone,
        text,
      },
      {
        headers: {
          apikey: TOKEN(),
          'Content-Type': 'application/json',
        },
        timeout: 8000,
      }
    );
  } catch (err) {
    console.error('[whatsapp] Falha ao enviar mensagem:', err.message);
  }
}

async function notifyTicketOpenedWA(ticket, openedBy) {
  const phone = TECH_PHONE();
  const id = ticket.id.slice(-6).toUpperCase();
  const url = `${process.env.FRONTEND_URL}/tickets/${ticket.id}`;
  const text =
    `🆕 *Novo Chamado #${id}*\n` +
    `📝 *Título:* ${ticket.title}\n` +
    `🖥️ *Máquina:* ${ticket.machine?.name || '-'}\n` +
    `⚡ *Prioridade:* ${ticket.priority}\n` +
    `👤 *Aberto por:* ${openedBy.name}\n` +
    `🔗 ${url}`;
  await sendWhatsApp(phone, text);
}

async function notifyTicketResolvedWA(ticket, resolvedBy) {
  const phone = TECH_PHONE();
  const id = ticket.id.slice(-6).toUpperCase();
  const url = `${process.env.FRONTEND_URL}/tickets/${ticket.id}`;
  const text =
    `✅ *Chamado #${id} encerrado*\n` +
    `📝 *Título:* ${ticket.title}\n` +
    `🖥️ *Máquina:* ${ticket.machine?.name || '-'}\n` +
    `👷 *Técnico:* ${resolvedBy?.name || '-'}\n` +
    `🔗 ${url}`;
  await sendWhatsApp(phone, text);
}

module.exports = { notifyTicketOpenedWA, notifyTicketResolvedWA };
