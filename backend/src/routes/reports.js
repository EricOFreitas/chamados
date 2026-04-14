const express = require('express');
const { query } = require('express-validator');
const prisma = require('../lib/prisma');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
router.use(authMiddleware);
router.use(requireRole('TECHNICIAN'));

// GET /api/reports?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get(
  '/',
  [
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    validate,
  ],
  async (req, res) => {
    const { from, to } = req.query;

    const dateFilter = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) dateFilter.createdAt.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        dateFilter.createdAt.lte = toDate;
      }
    }

    const [
      totalTickets,
      byStatus,
      byPriority,
      byMachine,
      timeEntriesAgg,
      dailyCounts,
    ] = await Promise.all([
      prisma.ticket.count({ where: dateFilter }),

      prisma.ticket.groupBy({
        by: ['status'],
        where: dateFilter,
        _count: { _all: true },
      }),

      prisma.ticket.groupBy({
        by: ['priority'],
        where: dateFilter,
        _count: { _all: true },
      }),

      prisma.ticket.groupBy({
        by: ['machineId'],
        where: dateFilter,
        _count: { _all: true },
        orderBy: { _count: { machineId: 'desc' } },
        take: 10,
      }),

      prisma.timeEntry.aggregate({
        where: {
          ...(dateFilter.createdAt ? { startedAt: dateFilter.createdAt } : {}),
          endedAt: { not: null },
        },
        _sum: { durationMinutes: true },
        _avg: { durationMinutes: true },
        _count: { _all: true },
      }),

      // Chamados por dia (intervalo solicitado)
      (async () => {
        if (from && to) {
          return prisma.$queryRaw`
            SELECT DATE("createdAt") as date, COUNT(*)::int as count
            FROM tickets
            WHERE "createdAt" >= ${new Date(from)} AND "createdAt" <= ${new Date(to + 'T23:59:59')}
            GROUP BY DATE("createdAt")
            ORDER BY date ASC
          `
        } else if (from) {
          return prisma.$queryRaw`
            SELECT DATE("createdAt") as date, COUNT(*)::int as count
            FROM tickets
            WHERE "createdAt" >= ${new Date(from)}
            GROUP BY DATE("createdAt")
            ORDER BY date ASC
          `
        } else if (to) {
          return prisma.$queryRaw`
            SELECT DATE("createdAt") as date, COUNT(*)::int as count
            FROM tickets
            WHERE "createdAt" <= ${new Date(to + 'T23:59:59')}
            GROUP BY DATE("createdAt")
            ORDER BY date ASC
          `
        } else {
          return prisma.$queryRaw`
            SELECT DATE("createdAt") as date, COUNT(*)::int as count
            FROM tickets
            GROUP BY DATE("createdAt")
            ORDER BY date ASC
          `
        }
      })(),
    ]);

    // Enriquecer máquinas com nome
    const machineIds = byMachine.map((m) => m.machineId);
    const machines = await prisma.machine.findMany({
      where: { id: { in: machineIds } },
      select: { id: true, name: true },
    });
    const machineMap = Object.fromEntries(machines.map((m) => [m.id, m.name]));

    res.json({
      period: { from: from || null, to: to || null },
      totalTickets,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
      byPriority: byPriority.map((p) => ({ priority: p.priority, count: p._count._all })),
      byMachine: byMachine.map((m) => ({
        machineId: m.machineId,
        machineName: machineMap[m.machineId] || m.machineId,
        count: m._count._all,
      })),
      timeEntries: {
        totalSessions: timeEntriesAgg._count._all,
        totalMinutes: timeEntriesAgg._sum.durationMinutes || 0,
        avgMinutes: Math.round(timeEntriesAgg._avg.durationMinutes || 0),
      },
      dailyCounts,
    });
  }
);

module.exports = router;
