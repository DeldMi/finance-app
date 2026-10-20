# Desenvolvimento

Este documento reúne os comandos de desenvolvimento, validação e execução do
Meu Financeiro. Para visão geral e arquitetura, consulte o [README](./README.md)
e os guias em [`docs/`](./docs/).

## Requisitos

- Node.js 20 ou superior e npm.
- Docker Desktop e Docker Compose (opcional, para execução em container).

## Preparar o ambiente local

No PowerShell:

```powershell
npm ci
Copy-Item .env.example .env
```

Edite `.env` e defina um segredo privado para `NEXTAUTH_SECRET`. No PowerShell,
um segredo pode ser gerado com:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Em seguida, prepare o SQLite e inicie o servidor:

```powershell
npm run db:generate
npm run db:migrate
npm run dev
```

Abra <http://localhost:3000>. O primeiro acesso permite criar a conta; depois,
use o e-mail e a senha cadastrados.

## Validar e compilar

```powershell
npm run typecheck
npm run build
npm run start
```

O comando `npm run build` gera o cliente Prisma e compila o Next.js para
produção. `npm run start` inicia o build de produção local.

## Banco de dados

```powershell
npm run db:migrate
npm run db:studio
```

`db:migrate` cria/aplica migrações de desenvolvimento; `db:studio` abre uma
interface local para inspecionar o banco. Não publique o arquivo SQLite nem
credenciais.

## Docker

Configure `.env` antes de subir os containers:

```powershell
docker compose up --build -d
docker compose logs -f app
docker compose down
```

O volume nomeado `sqlite_data` preserva o banco entre reinicializações. Para
atualizar o app, execute `docker compose up --build -d` novamente. Não remova o
volume de dados ao fazer manutenção de rotina.

## Scripts npm

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento Next.js |
| `npm run typecheck` | Verificação estática TypeScript |
| `npm run build` | Cliente Prisma e build otimizado |
| `npm run start` | Servidor de produção |
| `npm run db:generate` | Gera os tipos do Prisma |
| `npm run db:migrate` | Aplica migrações de desenvolvimento |
| `npm run db:deploy` | Aplica migrações existentes para produção |
| `npm run db:studio` | Abre o Prisma Studio |
