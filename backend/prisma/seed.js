const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...');

  // Técnico principal
  const techPassword = await bcrypt.hash('Admin@123456', 12);
  const technician = await prisma.user.upsert({
    where: { email: 'tecnico@suporte.local' },
    update: {},
    create: {
      name: 'Técnico de Suporte',
      email: 'tecnico@suporte.local',
      password: techPassword,
      role: 'TECHNICIAN',
      phone: '5511999999999',
    },
  });
  console.log(`Técnico criado: ${technician.email}`);

  // 12 micros + 1 servidor
  const machines = [
    { name: 'Servidor', hostname: 'SRV-01', location: 'Sala de Servidores' },
    { name: 'Computador 01', hostname: 'PC-01', location: 'Recepção' },
    { name: 'Computador 02', hostname: 'PC-02', location: 'Administrativo' },
    { name: 'Computador 03', hostname: 'PC-03', location: 'Administrativo' },
    { name: 'Computador 04', hostname: 'PC-04', location: 'Financeiro' },
    { name: 'Computador 05', hostname: 'PC-05', location: 'Financeiro' },
    { name: 'Computador 06', hostname: 'PC-06', location: 'RH' },
    { name: 'Computador 07', hostname: 'PC-07', location: 'RH' },
    { name: 'Computador 08', hostname: 'PC-08', location: 'Diretoria' },
    { name: 'Computador 09', hostname: 'PC-09', location: 'Comercial' },
    { name: 'Computador 10', hostname: 'PC-10', location: 'Comercial' },
    { name: 'Computador 11', hostname: 'PC-11', location: 'Estoque' },
    { name: 'Computador 12', hostname: 'PC-12', location: 'Estoque' },
  ];

  for (const m of machines) {
    await prisma.machine.upsert({
      where: { hostname: m.hostname },
      update: {},
      create: m,
    });
  }
  console.log(`${machines.length} máquinas criadas.`);

  console.log('Seed concluído!');
  console.log('');
  console.log('Acesso inicial:');
  console.log('  Email: tecnico@suporte.local');
  console.log('  Senha: Admin@123456');
  console.log('  ⚠️  Troque a senha após o primeiro login!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
