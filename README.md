# Meu Financeiro

Autor do projeto: **DeldMi**. Licença: **proprietária — todos os direitos reservados**.

Aplicação web para organizar finanças familiares e empresariais em um painel
único. Registre ganhos e gastos por perfil, acompanhe o saldo e simule listas de
compras antes de assumir uma nova despesa.

## Recursos

- Acesso com e-mail e senha, criação de conta e senhas armazenadas com hash.
- Painel privado com entradas, saídas e saldo do perfil selecionado.
- Perfis independentes para família (PF) e empresa (PJ).
- Registro de transações com descrição, categoria, data, valor e tipo.
- Simulador de compras com quantidade, preço unitário, custo total e saldo
  projetado; a lista é temporária e não altera o extrato.
- Banco de dados SQLite via Prisma ORM.
- Interface responsiva e acessível em português brasileiro.

## Tecnologias

- Next.js 14 (App Router), React 18 e TypeScript em modo estrito.
- NextAuth.js com provedor de credenciais.
- Prisma ORM e SQLite.
- Docker Compose para executar em container.

## Começar

Requisitos: Node.js 20+, npm e PowerShell no Windows.

```powershell
npm ci
Copy-Item .env.example .env
```

Defina `NEXTAUTH_SECRET` em `.env` (use um valor aleatório privado) e execute:

```powershell
npm run db:generate
npm run db:migrate
npm run dev
```

Acesse <http://localhost:3000>, crie sua conta e comece a lançar movimentações.

## Comandos

```powershell
npm run dev          # desenvolver
npm run typecheck    # verificar tipos
npm run build        # compilar para produção
npm run start        # executar o build
npm run db:migrate   # aplicar migrações locais
npm run db:studio    # abrir Prisma Studio
```

Admin pelo terminal: npm run admin:grant -- email@exemplo.com

Detalhes de ambiente e produção estão em [Modo_Dev.md](./Modo_Dev.md) e
[docs/DEPLOY.md](./docs/DEPLOY.md). O guia de uso está em
[docs/GUIA_DO_USUARIO.md](./docs/GUIA_DO_USUARIO.md), a arquitetura em
[docs/ARQUITETURA.md](./docs/ARQUITETURA.md), e as instruções para agentes de
código em [AGENTS.md](./AGENTS.md).

## Docker

Configure `.env` usando `.env.example`, então:

```powershell
docker compose up --build -d
docker compose logs -f app
```

O SQLite fica em volume persistente do Docker; faça backups regulares do volume
antes de atualizações ou manutenção.

## Privacidade e limites

As transações são privadas por usuário autenticado. Os perfis PF/PJ são
classificações dentro da conta e não substituem contas de usuário empresariais
separadas. O simulador calcula apenas uma estimativa em memória e não efetua
compras nem grava os itens no banco. Esta aplicação não substitui orientação
financeira, contábil ou fiscal.

## Repositório

`.gitignore` exclui dependências, builds, bancos SQLite e arquivos `.env`. Nunca
adicione segredos, dados financeiros reais ou bancos de produção ao Git.
