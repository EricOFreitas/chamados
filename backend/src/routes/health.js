const express = require('express');
const { body } = require('express-validator');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { verifyTransport, sendTestEmail } = require('../services/email');

const router = express.Router();
router.use(authMiddleware);
router.use(requireRole('TECHNICIAN'));

// GET /api/health/email — mostra a configuração ativa e testa a conexão SMTP
router.get('/email', async (_req, res) => {
  const result = await verifyTransport();
  res.json(result);
});

// POST /api/health/email/test — envia um e-mail de teste de verdade
router.post(
  '/email/test',
  [body('to').optional().isEmail(), validate],
  async (req, res) => {
    const to = req.body.to || process.env.TECHNICIAN_EMAIL;
    if (!to) {
      return res.status(400).json({ error: 'Informe um destinatário ou defina TECHNICIAN_EMAIL.' });
    }
    const result = await sendTestEmail(to);
    res.status(result.ok ? 200 : 502).json({ ...result, to });
  }
);

module.exports = router;
