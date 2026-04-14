const express = require('express');
const bcrypt = require('bcryptjs');
const { body, param } = require('express-validator');
const prisma = require('../lib/prisma');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// Todos os endpoints exigem autenticação
router.use(authMiddleware);

// GET /api/users
router.get('/', requireRole('TECHNICIAN'), async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, phone: true, active: true, createdAt: true },
    orderBy: { name: 'asc' },
  });
  res.json(users);
});

// GET /api/users/:id
router.get('/:id', requireRole('TECHNICIAN'), async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, name: true, email: true, role: true, phone: true, active: true, createdAt: true },
  });
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
  res.json(user);
});

// POST /api/users
router.post(
  '/',
  requireRole('TECHNICIAN'),
  [
    body('name').trim().notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('role').optional().isIn(['USER', 'TECHNICIAN']),
    body('phone').optional().trim(),
    validate,
  ],
  async (req, res) => {
    const { name, email, password, role, phone } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email já cadastrado.' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, password: hashed, role: role || 'USER', phone },
      select: { id: true, name: true, email: true, role: true, phone: true, active: true, createdAt: true },
    });
    res.status(201).json(user);
  }
);

// PATCH /api/users/:id
router.patch(
  '/:id',
  requireRole('TECHNICIAN'),
  [
    param('id').notEmpty(),
    body('name').optional().trim().notEmpty(),
    body('email').optional().isEmail().normalizeEmail(),
    body('password').optional().isLength({ min: 8 }),
    body('phone').optional().trim(),
    body('active').optional().isBoolean(),
    validate,
  ],
  async (req, res) => {
    const { name, email, password, phone, active } = req.body;
    const data = {};

    if (name !== undefined) data.name = name;
    if (email !== undefined) {
      const existing = await prisma.user.findFirst({
        where: { email, NOT: { id: req.params.id } },
      });
      if (existing) return res.status(409).json({ error: 'Email já em uso.' });
      data.email = email;
    }
    if (password !== undefined) data.password = await bcrypt.hash(password, 12);
    if (phone !== undefined) data.phone = phone;
    if (active !== undefined) data.active = active;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, name: true, email: true, role: true, phone: true, active: true },
    });
    res.json(user);
  }
);

// DELETE /api/users/:id (desativa, não remove)
router.delete('/:id', requireRole('TECHNICIAN'), async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Não é possível desativar a própria conta.' });
  }
  await prisma.user.update({ where: { id: req.params.id }, data: { active: false } });
  res.status(204).send();
});

module.exports = router;
