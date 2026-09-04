#!/usr/bin/env node
// Diagnóstico de SMTP: mostra a configuração ativa, testa a conexão e,
// se receber um destinatário, envia um e-mail de teste.
//
//   npm run test:email                    -> só verifica a conexão
//   npm run test:email -- eu@exemplo.com  -> verifica e envia
require('dotenv').config();
const { verifyTransport, sendTestEmail, smtpConfig } = require('../src/services/email');

(async () => {
  const cfg = smtpConfig();
  console.log('\n--- Configuração SMTP em uso ---');
  console.log('SMTP_HOST         :', cfg.host || '(vazio)');
  console.log('SMTP_PORT         :', cfg.port);
  console.log('SMTP_SECURE       :', cfg.secure);
  console.log('SMTP_USER         :', cfg.user || '(vazio)');
  console.log('SMTP_PASS         :', process.env.SMTP_PASS ? `definida (${process.env.SMTP_PASS.length} caracteres)` : '(vazio)');
  console.log('SMTP_FROM         :', cfg.from || '(vazio)');
  console.log('TECHNICIAN_EMAIL  :', cfg.technicianEmail || '(vazio)');
  console.log('FRONTEND_URL      :', process.env.FRONTEND_URL || '(vazio)');

  const result = await verifyTransport();

  if (result.problems.length) {
    console.log('\n--- Problemas de configuração ---');
    result.problems.forEach((p) => console.log(' !', p));
  }

  console.log('\n--- Conexão ---');
  if (result.ok) {
    console.log(' OK: conectou e autenticou no servidor SMTP.');
  } else {
    console.log(' FALHOU:', result.error || 'SMTP não configurado.');
    if (result.code) console.log(' Código:', result.code);
    if (result.response) console.log(' Resposta do servidor:', result.response);
    if (result.hint) console.log('\n Provável causa:', result.hint);
    process.exitCode = 1;
    return;
  }

  const to = process.argv[2];
  if (!to) {
    console.log('\nPara enviar um e-mail de teste: npm run test:email -- seu@email.com\n');
    return;
  }

  console.log('\n--- Envio de teste para', to, '---');
  const sent = await sendTestEmail(to);
  if (sent.ok) {
    console.log(' OK: mensagem aceita pelo servidor (id', sent.messageId + ').');
    console.log(' Se não aparecer na caixa de entrada, verifique o spam.\n');
  } else {
    console.log(' FALHOU:', sent.error);
    if (sent.hint) console.log(' Provável causa:', sent.hint);
    console.log();
    process.exitCode = 1;
  }
})();
