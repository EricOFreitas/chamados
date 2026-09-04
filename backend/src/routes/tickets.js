const express = require('express');
const { body, query } = require('express-validator');
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { notifyTicketOpened, notifyTicketResolved } = require('../services/email');
const { dateRangeFilter } = require('../lib/dates');

const router = express.Router();
router.use(authMiddleware);

const CLOSING_STATUSES = ['RESOLVED', 'CLOSED'];
const SORTABLE = ['createdAt', 'updatedAt', 'number', 'priority', 'status'];

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
    query('q').optional().isString().trim(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('sort').optional().isIn(SORTABLE),
    query('order').optional().isIn(['asc', 'desc']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validate,
  ],
  async (req, res) => {
    const {
      status, priority, machineId, q, from, to,
      sort = 'createdAt', order = 'desc', page = 1, limit = 20,
    } = req.query;
    const where = {};

    // Usuários comuns só veem os próprios chamados
    if (req.user.role === 'USER') {
      where.openedById = req.user.id;
    }

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (machineId) where.machineId = machineId;
    const createdAt = dateRangeFilter(from, to);
    if (createdAt) where.createdAt = createdAt;

    // Busca livre: título, descrição, resolução e número do chamado ("412" ou "#412")
    if (q) {
      const term = q.trim();
      if (term) {
        where.OR = [
          { title: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { resolution: { contains: term, mode: 'insensitive' } },
        ];
        const asNumber = Number(term.replace(/^#/, ''));
        if (Number.isInteger(asNumber) && asNumber > 0) {
          where.OR.push({ number: asNumber });
        }
      }
    }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: TICKET_INCLUDE,
        orderBy: { [sort]: order },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.ticket.count({ where }),
    ]);

    res.json({
      data: tickets,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.max(1, Math.ceil(total / Number(limit))),
    });
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

    // Notificação assíncrona (não bloqueia a resposta)
    notifyTicketOpened(ticket, ticket.openedBy).catch((err) =>
      console.error('[tickets] erro inesperado ao notificar abertura:', err)
    );

    res.status(201).json(ticket);
  }
);

// PATCH /api/tickets/:id
router.patch(
  '/:id',
  [
    body('status').optional().isIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    body('assignedToId').optional({ nullable: true }).isString(),
    body('title').optional().trim().notEmpty(),
    body('description').optional().trim().notEmpty(),
    body('resolution').optional().isString().trim(),
    validate,
  ],
  async (req, res) => {
    const existing = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Chamado não encontrado.' });

    const isTech = req.user.role === 'TECHNICIAN';

    // Usuário comum só pode cancelar (CLOSED) o próprio chamado, sem editar mais nada
    if (!isTech) {
      if (existing.openedById !== req.user.id) {
        return res.status(403).json({ error: 'Acesso negado.' });
      }
      const allowed = ['status'];
      if (Object.keys(req.body).some((k) => !allowed.includes(k))) {
        return res.status(403).json({ error: 'Você só pode cancelar o próprio chamado.' });
      }
      if (req.body.status && req.body.status !== 'CLOSED') {
        return res.status(403).json({ error: 'Acesso negado.' });
      }
    }

    const data = {};
    const { status, priority, assignedToId, title, description } = req.body;
    const resolution = req.body.resolution?.trim() || null;

    const wasClosed = CLOSING_STATUSES.includes(existing.status);
    const willClose = status !== undefined && CLOSING_STATUSES.includes(status);
    const isClosingNow = willClose && !wasClosed;

    // Encerrar exige o texto da resolução no mesmo request — nada de deduzir
    // a resolução a partir de comentários antigos.
    if (isTech && willClose && !resolution && !existing.resolution) {
      return res.status(400).json({
        error: 'Informe o texto da resolução ao encerrar o chamado.',
      });
    }

    if (assignedToId) {
      const technician = await prisma.user.findUnique({ where: { id: assignedToId } });
      if (!technician || technician.role !== 'TECHNICIAN' || !technician.active) {
        return res.status(400).json({ error: 'Técnico inválido.' });
      }
    }

    if (status !== undefined) {
      data.status = status;
      if (isClosingNow) data.resolvedAt = new Date();
      // Reabertura: zera o encerramento para não distorcer os relatórios
      if (wasClosed && !willClose) {
        data.resolvedAt = null;
        data.resolution = null;
      }
    }
    if (priority !== undefined) data.priority = priority;
    if (assignedToId !== undefined) data.assignedToId = assignedToId || null;
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (resolution && willClose) data.resolution = resolution;

    // Tudo num único commit: status + resolução + comentário no histórico +
    // fechamento do timer que tenha ficado aberto.
    const ticket = await prisma.$transaction(async (tx) => {
      if (resolution && willClose) {
        await tx.ticketComment.create({
          data: {
            content: resolution,
            ticketId: existing.id,
            authorId: req.user.id,
          },
        });
      }

      if (isClosingNow) {
        const openEntry = await tx.timeEntry.findFirst({
          where: { ticketId: existing.id, endedAt: null },
          orderBy: { startedAt: 'desc' },
        });
        if (openEntry) {
          const endedAt = new Date();
          await tx.timeEntry.update({
            where: { id: openEntry.id },
            data: {
              endedAt,
              durationMinutes: Math.round((endedAt - openEntry.startedAt) / 60000),
              notes: openEntry.notes || 'Encerrado junto com o chamado.',
            },
          });
        }
      }

      return tx.ticket.update({
        where: { id: existing.id },
        data,
        include: {
          machine: true,
          openedBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      });
    });

    if (isClosingNow) {
      // O JWT carrega só id e role; o nome de quem encerrou vem do banco.
      const author = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { name: true },
      });
      notifyTicketResolved(
        ticket,
        ticket.openedBy,
        ticket.resolution ? { content: ticket.resolution, authorName: author?.name } : null
      ).catch((err) => console.error('[tickets] erro inesperado ao notificar encerramento:', err));
    }

    res.json(ticket);
  }
);

module.exports = router;
