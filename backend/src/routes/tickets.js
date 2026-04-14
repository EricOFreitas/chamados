const express = require('express');
const { body, query } = require('express-validator');
const prisma = require('../lib/prisma');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { notifyTicketOpened, notifyTicketResolved } = require('../services/email');
const { notifyTicketOpenedWA, notifyTicketResolvedWA } = require('../services/whatsapp');

const router = express.Router();
router.use(authMiddleware);

const TICKET_INCLUDE = {
  machine: true,
  openedBy: { select: { id: true, name: true, email: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
  _count: { select: { comments: true, timeEntries: true } },
};

// GET /api/tickets
router.get(
  '/',
  [
    query('status').optional().isIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
    query('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    query('machineId').optional().isString(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validate,
  ],
  async (req, res) => {
    const { status, priority, machineId, from, to, page = 1, limit = 20 } = req.query;
    const where = {};

    // Usuários comuns só veem os próprios chamados
    if (req.user.role === 'USER') {
      where.openedById = req.user.id;
    }

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (machineId) where.machineId = machineId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: TICKET_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.ticket.count({ where }),
    ]);

    res.json({ data: tickets, total, page: Number(page), limit: Number(limit) });
  }
);

// GET /api/tickets/:id
router.get('/:id', async (req, res) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    include: {
      ...TICKET_INCLUDE,
      comments: {
        include: { author: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      },
      timeEntries: {
        include: { technician: { select: { id: true, name: true } } },
        orderBy: { startedAt: 'asc' },
      },
    },
  });

  if (!ticket) return res.status(404).json({ error: 'Chamado não encontrado.' });

  // Usuário comum só vê o próprio chamado
  if (req.user.role === 'USER' && ticket.openedById !== req.user.id) {
    return res.status(403).json({ error: 'Acesso negado.' });
  }

  res.json(ticket);
});

// POST /api/tickets
router.post(
  '/',
  [
    body('title').trim().notEmpty(),
    body('description').trim().notEmpty(),
    body('machineId').notEmpty(),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    validate,
  ],
  async (req, res) => {
    const { title, description, machineId, priority } = req.body;

    const machine = await prisma.machine.findUnique({ where: { id: machineId } });
    if (!machine || !machine.active) {
      return res.status(400).json({ error: 'Máquina não encontrada ou inativa.' });
    }

    const ticket = await prisma.ticket.create({
      data: {
        title,
        description,
        machineId,
        priority: priority || 'MEDIUM',
        openedById: req.user.id,
      },
      include: {
        machine: true,
        openedBy: { select: { id: true, name: true, email: true } },
      },
    });

    // Notificações assíncronas (não bloqueiam a resposta)
    notifyTicketOpened(ticket, ticket.openedBy).catch(() => {});
    notifyTicketOpenedWA(ticket, ticket.openedBy).catch(() => {});

    res.status(201).json(ticket);
  }
);

// PATCH /api/tickets/:id
router.patch(
  '/:id',
  [
    body('status').optional().isIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    body('assignedToId').optional().isString(),
    body('title').optional().trim().notEmpty(),
    body('description').optional().trim().notEmpty(),
    validate,
  ],
  async (req, res) => {
    const existing = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Chamado não encontrado.' });

    // Usuário comum só pode fechar o próprio chamado
    if (req.user.role === 'USER') {
      if (existing.openedById !== req.user.id) {
        return res.status(403).json({ error: 'Acesso negado.' });
      }
      // Usuário só pode cancelar (CLOSED) chamado aberto
      if (req.body.status && req.body.status !== 'CLOSED') {
        return res.status(403).json({ error: 'Acesso negado.' });
      }
    }

    const data = {};
    const { status, priority, assignedToId, title, description } = req.body;

    if (status !== undefined) {
      data.status = status;
      if (status === 'RESOLVED' || status === 'CLOSED') {
        data.resolvedAt = new Date();
      }
    }
    if (priority !== undefined) data.priority = priority;
    if (assignedToId !== undefined) data.assignedToId = assignedToId;
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;

    const ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data,
      include: {
        machine: true,
        openedBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });

    // Notificar ao resolver/fechar
    if (status === 'RESOLVED' || status === 'CLOSED') {
      notifyTicketResolved(ticket, ticket.openedBy).catch(() => {});
      notifyTicketResolvedWA(ticket, ticket.assignedTo || ticket.openedBy).catch(() => {});
    }

    res.json(ticket);
  }
);

module.exports = router;
