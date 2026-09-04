require('dotenv').config();
const app = require('./app');
const { logTransportStatus } = require('./services/email');

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} [${process.env.NODE_ENV}]`);
  // Registra no log se o SMTP está de pé, em vez de descobrir só quando
  // um chamado é aberto e o e-mail não chega.
  logTransportStatus().catch((err) =>
    console.error('[email] erro ao verificar o SMTP no boot:', err.message)
  );
});
