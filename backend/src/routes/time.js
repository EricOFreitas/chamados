const express = require('express');
const prisma = require('../lib/prisma');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);
router.use(requireRole('TECHNICIAN'));

// POST /api/tickets/:id/time/start
router.post('/:id/time/start', async (req, res) => {
  const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
  if (!ticket) return res.status(404).json({ error: 'Chamado não encontrado.' });

  // Verifica se já há um timer aberto para este chamado
  const open = await prisma.timeEntry.findFirst({
    where: { ticketId: req.params.id, endedAt: null },
  });
  if (open) {
    return res.status(409).json({ error: 'Já existe um atendimento em andamento para este chamado.' });
  }

  const [entry] = await prisma.$transaction([
    prisma.timeEntry.create({
      data: {
        ticketId: req.params.id,
        technicianId: req.user.id,
        startedAt: new Date(),
      },
    }),
    prisma.ticket.update({
      where: { id: req.params.id },
      data: { status: 'IN_PROGRESS', assignedToId: req.user.id },
    }),
  ]);

  res.status(201).json(entry);
});

// PATCH /api/tickets/:id/time/stop
router.patch('/:id/time/stop', async (req, res) => {
  const entry = await prisma.timeEntry.findFirst({
    where: { ticketId: req.params.id, technicianId: req.user.id, endedAt: null },
    orderBy: { startedAt: 'desc' },
  });

  if (!entry) {
    return res.status(404).json({ error: 'Nenhum atendimento em andamento encontrado.' });
  }

  const endedAt = new Date();
  const durationMinutes = Math.round((endedAt - entry.startedAt) / 60000);
  const notes = req.body?.notes || null;

  const updated = await prisma.timeEntry.update({
    where: { id: entry.id },
    data: { endedAt, durationMinutes, notes },
  });

  res.json(updated);
});

module.exports = router;
