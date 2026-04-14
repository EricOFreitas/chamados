const express = require('express');
const { body } = require('express-validator');
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
router.use(authMiddleware);

// POST /api/tickets/:id/comments
router.post(
  '/:id/comments',
  [
    body('content').trim().notEmpty(),
    validate,
  ],
  async (req, res) => {
    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!ticket) return res.status(404).json({ error: 'Chamado não encontrado.' });

    // Usuário comum só comenta no próprio chamado
    if (req.user.role === 'USER' && ticket.openedById !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    const comment = await prisma.ticketComment.create({
      data: {
        content: req.body.content,
        ticketId: req.params.id,
        authorId: req.user.id,
      },
      include: { author: { select: { id: true, name: true, role: true } } },
    });

    res.status(201).json(comment);
  }
);

module.exports = router;
