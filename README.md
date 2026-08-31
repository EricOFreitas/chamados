# Chamados

Sistema web de suporte técnico para abertura e gestão de chamados, com controle de tempo de atendimento, notificação por e-mail e relatórios de produtividade.

> **Estado:** em produção, atendendo um cliente. A notificação por WhatsApp (Evolution API) foi escrita mas **nunca chegou a ser ligada** — veja *Não implementado* no fim deste README.

## Stack

- **Frontend:** React + Vite + TailwindCSS
- **Backend:** Node.js + Express + Prisma ORM
- **Banco de dados:** PostgreSQL
- **Notificações:** Nodemailer (SMTP)
- **Deploy:** Coolify (self-hosted)

## Funcionalidades

- Abertura de chamados por funcionários com seleção de máquina e prioridade
- Painel do técnico com fila de chamados e dashboard de resumo (atualização automática a cada 5s)
- Timer de atendimento com registro de sessões e duração calculada
- Comentários internos por chamado
- Notificação por e-mail: ao técnico quando um chamado é aberto, ao solicitante quando é encerrado (incluindo o texto de resolução)
- Relatórios por período: total de chamados, tempo médio, gráficos por status, prioridade e máquina
- Gerenciamento de usuários e máquinas (somente técnico)
- Autenticação JWT com refresh token

## Estrutura

```
chamados/
  backend/
    prisma/           → schema, migrations, seed
    src/
      middleware/     → auth JWT, role guard, validação
      routes/         → auth, users, machines, tickets, comments, time, reports
      services/       → email (nodemailer)
      lib/            → instância Prisma
    Dockerfile
  frontend/
    src/
      api/            → axios + endpoints
      context/        → AuthContext
      components/     → Layout, Badges
      pages/          → Login, Dashboard, Tickets, Reports, Users, Machines
    Dockerfile
    nginx.conf
```

## Configuração

### Backend — variáveis de ambiente

Copie `backend/.env.example` para `backend/.env` e preencha:

```env
DATABASE_URL="postgresql://USER:PASS@HOST:5432/chamados"
JWT_SECRET=segredo_forte
JWT_REFRESH_SECRET=outro_segredo_forte
SMTP_HOST=smtp.exemplo.com
SMTP_USER=email@exemplo.com
SMTP_PASS=senha
TECHNICIAN_EMAIL=tecnico@exemplo.com
TECHNICIAN_PHONE=5511999999999   # formato DDI + DDD + número
FRONTEND_URL=https://chamados.exemplo.com
```

### Frontend — variáveis de ambiente

Copie `frontend/.env.example` para `frontend/.env`:

```env
VITE_API_URL=https://chamados-api.exemplo.com/api
```

## Banco de dados

Crie o database no seu PostgreSQL e execute:

```bash
# Dentro da pasta backend/
npm run db:migrate   # aplica as migrations
npm run db:seed      # cria o técnico e as 13 máquinas iniciais
```

**Acesso inicial após o seed:**
- E-mail: `tecnico@suporte.local`
- Senha: `Admin@123456`
- ⚠️ Troque a senha no primeiro login em **Usuários → Editar**.

## Deploy no Coolify

1. Criar o database `chamados` no PostgreSQL centralizado do Coolify
2. Criar serviço apontando para `/backend` (Dockerfile detectado automaticamente)
3. Criar serviço apontando para `/frontend` (Dockerfile multi-stage com Nginx)
4. Configurar as variáveis de ambiente em cada serviço
5. Após o primeiro deploy do backend, executar via console: `npm run db:migrate && npm run db:seed`

## Desenvolvimento local

```bash
# Backend
cd backend
cp .env.example .env   # preencha o .env
npm install
npm run db:migrate
npm run db:seed
npm run dev            # porta 3001

# Frontend (outro terminal)
cd frontend
cp .env.example .env
npm install
npm run dev            # porta 5173 (proxy /api → localhost:3001)
```

---

## Não implementado

O arquivo `backend/src/services/whatsapp.js` implementa envio via **Evolution API**, mas
**nenhum módulo o importa** — é código inativo. O recurso nunca entrou em produção e o
container da Evolution API está desligado.

Para ativar seria preciso: subir uma instância da Evolution API, definir
`EVOLUTION_API_URL`, `EVOLUTION_API_TOKEN` e `EVOLUTION_INSTANCE`, e chamar
`notifyTicketOpenedWA` / `notifyTicketResolvedWA` a partir de `backend/src/routes/tickets.js`,
ao lado das notificações por e-mail.
