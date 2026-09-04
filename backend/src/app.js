require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const machineRoutes = require('./routes/machines');
const ticketRoutes = require('./routes/tickets');
const commentRoutes = require('./routes/comments');
const timeRoutes = require('./routes/time');
const reportRoutes = require('./routes/reports');
const healthRoutes = require('./routes/health');

const app = express();

// CORS
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ['http://localhost:5173'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.set('trust proxy', 1);
app.use(express.json());

// Rate limiting global. O teto precisa acomodar o polling do dashboard de
// vários usuários com mais de uma aba aberta, sem deixar de barrar abuso.
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Aguarde alguns minutos.' },
}));

// Rate limiting mais restrito para auth
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
}));

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/machines', machineRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/tickets', commentRoutes);
app.use('/api/tickets', timeRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/health', healthRoutes);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// 404
app.use((_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

module.exports = app;
