const express = require('express');
const { body } = require('express-validator');
const prisma = require('../lib/prisma');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
router.use(authMiddleware);

// GET /api/machines
router.get('/', async (_req, res) => {
  const machines = await prisma.machine.findMany({
    orderBy: { name: 'asc' },
  });
  res.json(machines);
});

// POST /api/machines
router.post(
  '/',
  requireRole('TECHNICIAN'),
  [
    body('name').trim().notEmpty(),
    body('hostname').optional().trim(),
    body('location').optional().trim(),
    validate,
  ],
  async (req, res) => {
    const { name, hostname, location } = req.body;
    const machine = await prisma.machine.create({ data: { name, hostname, location } });
    res.status(201).json(machine);
  }
);

// PATCH /api/machines/:id
router.patch(
  '/:id',
  requireRole('TECHNICIAN'),
  [
    body('name').optional().trim().notEmpty(),
    body('hostname').optional().trim(),
    body('location').optional().trim(),
    body('active').optional().isBoolean(),
    validate,
  ],
  async (req, res) => {
    const { name, hostname, location, active } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (hostname !== undefined) data.hostname = hostname;
    if (location !== undefined) data.location = location;
    if (active !== undefined) data.active = active;

    const machine = await prisma.machine.update({
      where: { id: req.params.id },
      data,
    });
    res.json(machine);
  }
);

module.exports = router;
