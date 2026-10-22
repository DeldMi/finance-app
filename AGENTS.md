# Instruções para agentes de código

## Resumo do projeto

Meu Financeiro é uma aplicação Next.js 14 com App Router, React, TypeScript
estrito, NextAuth.js, Prisma e SQLite. A interface é em português brasileiro.
Ela fornece autenticação de conta, lançamentos financeiros por perfil PF/PJ e
simulação temporária de compras comparada ao saldo.

## Estrutura

- `src/app/`: rotas e layouts App Router.
- `src/app/api/auth/`: endpoints NextAuth.
- `src/app/api/register/`: cadastro de conta com hash bcrypt.
- `src/app/api/transactions/`: API autenticada e isolada por usuário.
- `src/components/`: componentes React compartilhados.
- `src/lib/auth.ts`: opções de autenticação.
- `src/lib/prisma.ts`: cliente Prisma compartilhado.
- `src/lib/types.ts`: tipos e valores do domínio financeiro.
- `src/app/globals.css`: tokens, layout, componentes e breakpoints de estilo.
- `prisma/`: schema SQLite e migrações versionadas.
- `docs/`: arquitetura, uso e deploy.

## Regras importantes

- Todas as consultas e gravações de transações devem ser limitadas ao usuário
  autenticado; nunca confiar em `userId` enviado pelo navegador.
- Não retornar senha nem hash em endpoints.
- Validar e normalizar os dados recebidos pela API; reportar falhas sem
  transformar erros em respostas de sucesso.
- Usar tipos de domínio `EntityType` e `TransactionType` para PF/PJ e entradas/
  saídas.
- Manter a lista do simulador apenas no estado do navegador. Ela é uma
  estimativa e não deve ser somada ao extrato salvo.
- Não registrar segredos, credenciais ou dados financeiros pessoais em logs,
  documentação ou código.
- Usar classes semânticas existentes no CSS, mantendo navegação por teclado,
  rótulos de formulário e estados responsivos.
- Criar migrações Prisma quando alterar o schema e manter o SQLite local fora do
  Git.

## Versionamento

- Atualize a versão em `package.json` e `package-lock.json` em toda alteração entregue.
- Siga versionamento semântico: PATCH para correções e ajustes compatíveis, MINOR para novas funcionalidades compatíveis e MAJOR para mudanças incompatíveis.

## Verificação

Antes de concluir alterações relevantes, execute:

```powershell
npm run typecheck
npm run build
```

Para instruções detalhadas de desenvolvimento e containers, consulte
[Modo_Dev.md](./Modo_Dev.md) e [docs/DEPLOY.md](./docs/DEPLOY.md).
