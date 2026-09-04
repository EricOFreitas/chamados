# Chamados

Sistema web de suporte técnico para abertura e gestão de chamados, com controle de tempo de atendimento, notificação por e-mail e relatórios de produtividade.

> **Estado:** em produção, atendendo um cliente.

## Stack

- **Frontend:** React + Vite + TailwindCSS
- **Backend:** Node.js + Express + Prisma ORM
- **Banco de dados:** PostgreSQL
- **Notificações:** Nodemailer (SMTP)
- **Deploy:** Coolify (self-hosted)

## Funcionalidades

- Abertura de chamados por funcionários com seleção de máquina e prioridade
- Número sequencial por chamado (`#1`, `#2`, ...) usado na tela, na busca e nos e-mails
- Painel do técnico com fila de chamados e dashboard de resumo (atualização automática a cada 5s)
- Listagem com busca livre (número, título, descrição, resolução), filtros de status,
  prioridade, máquina e período, ordenação por coluna e paginação
- Timer de atendimento com registro de sessões e duração calculada
- Encerramento com texto de resolução obrigatório, gravado no chamado, publicado como
  comentário e enviado por e-mail — tudo numa única ação, que também fecha o timer aberto
- Comentários internos por chamado
- Notificação por e-mail: ao técnico quando um chamado é aberto, ao solicitante quando é encerrado (incluindo o texto de resolução)
- Tela de Configurações com diagnóstico do SMTP e envio de e-mail de teste
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
      routes/         → auth, users, machines, tickets, comments, time, reports, health
      services/       → email (nodemailer)
      lib/            → instância Prisma, helpers de data
    scripts/          → test-email.js (diagnóstico de SMTP por linha de comando)
    Dockerfile
  frontend/
    src/
      api/            → axios + endpoints
      context/        → AuthContext
      components/     → Layout, Badges
      pages/          → Login, Dashboard, Tickets, Reports, Users, Machines, Settings
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
TZ=America/Sao_Paulo             # define o que é "o dia" nos filtros e relatórios
SMTP_HOST=smtp.exemplo.com
SMTP_PORT=587                    # 465 exige SMTP_SECURE=true
SMTP_SECURE=false
SMTP_USER=email@exemplo.com
SMTP_PASS=senha
SMTP_FROM="Chamados <email@exemplo.com>"   # obrigatório: sem remetente o SMTP recusa
TECHNICIAN_EMAIL=tecnico@exemplo.com
FRONTEND_URL=https://chamados.exemplo.com
```

### Diagnóstico de e-mail

O backend registra o estado do SMTP no log já no boot (`[email] SMTP OK ...` ou
`[email] SMTP FALHOU ...`) e loga cada envio com destinatário e erro do servidor.

Para testar sem abrir um chamado:

- **Pela interface:** *Configurações* → mostra as variáveis em uso, testa a conexão e
  envia um e-mail de teste.
- **Pelo console do container:**

  ```bash
  npm run test:email                    # só verifica conexão e configuração
  npm run test:email -- voce@exemplo.com  # verifica e envia um e-mail de teste
  ```

> Ao alterar variáveis de ambiente no Coolify é preciso **Redeploy** — um Restart
> não recarrega o ambiente do container.

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

As migrations posteriores são aplicadas com `npm run db:migrate` (`prisma migrate deploy`).
A migration `20260903000000_ticket_number_and_resolution` numera os chamados já existentes
em ordem de abertura e preserva os dados.

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
