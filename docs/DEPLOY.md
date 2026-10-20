# Desenvolvimento e deploy

## Ambiente local

Requisitos: Node.js 20+, npm e PowerShell.

```powershell
npm ci
Copy-Item .env.example .env
```

Configure `NEXTAUTH_SECRET` com um segredo aleatório e privado. Gere um exemplo
no PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Inicialize o banco e rode a aplicação:

```powershell
npm run db:generate
npm run db:migrate
npm run dev
```

## Verificação e build

```powershell
npm run typecheck
npm run build
npm run start
```

O build deve ser executado após configurar as dependências e o cliente Prisma.
`npm run start` exige um build válido anterior.

## Docker Compose

Copie `.env.example` para `.env`, ajuste o segredo e execute:

```powershell
docker compose up --build -d
docker compose logs -f app
```

O container executa `prisma migrate deploy` na inicialização. A aplicação é
servida na porta 3000 e o arquivo de produção fica no volume Docker
`sqlite_data`. Para parar sem remover dados:

```powershell
docker compose down
```

`docker compose down -v` remove permanentemente o volume do banco; use apenas
quando tiver certeza de que quer apagar os dados.

## Segredos, backups e operação

- Mantenha `.env` fora do Git e defina `NEXTAUTH_SECRET` forte e exclusivo.
- Configure `NEXTAUTH_URL` com o endereço HTTPS público do deploy.
- Use HTTPS no proxy de produção e proteja o acesso ao host e aos volumes.
- Faça backups consistentes do volume SQLite e teste a restauração.
- Para aplicar novas migrações, publique a imagem nova e monitore os logs.
- O SQLite persiste no volume, mas não deve ser compartilhado entre múltiplos
  servidores sem uma estratégia explícita de armazenamento e concorrência.

## GitHub

O `.gitignore` evita publicar `.env`, dependências, builds e banco local.
Verifique `git status` antes de enviar alterações e nunca faça commit de
credenciais, bases de produção ou dados pessoais.
