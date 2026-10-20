# Arquitetura

## Visão geral

O sistema é um aplicativo Next.js 14 com App Router. A interface React está em
`src/app` e `src/components`; as rotas de servidor usam Route Handlers do Next.
O Prisma acessa um banco SQLite indicado por `DATABASE_URL`.

## Autenticação e autorização

- NextAuth Credentials valida e-mail e senha com bcrypt.
- O cadastro cria usuário e armazena somente o hash da senha.
- A sessão usa JWT, assinada por `NEXTAUTH_SECRET`.
- O middleware protege `/dashboard`.
- A API de transações valida novamente a sessão e deriva o `userId` da sessão,
  nunca do corpo da requisição.
- `GET` retorna apenas os registros do usuário atual e `POST` valida valores,
  tipo e perfil antes de gravar.

## Dados

`User` possui e-mail único e hash da senha. `Transaction` pertence a um usuário
por chave estrangeira e guarda descrição, valor, tipo, perfil, categoria e data.
As movimentações são excluídas em cascata ao excluir a conta.

O schema e as migrações ficam em `prisma/schema.prisma` e `prisma/migrations`.
Alterações devem ser feitas com migração Prisma, nunca editando o banco de
produção manualmente. O cliente Prisma resolve URLs SQLite locais relativas a
partir da pasta `prisma/`, mantendo o mesmo arquivo utilizado pelas migrações;
deploys em container usam o caminho absoluto persistido no volume.

## Interface e cálculo

O CSS global define variáveis de cor, componentes semânticos e breakpoints. O
dashboard soma entradas e subtrai saídas conforme o filtro PF/PJ. A simulação
calcula `preço unitário × quantidade`, compara a soma com o saldo filtrado e
mantém os itens apenas no estado local do navegador.

## Execução e build

`next.config.mjs` ativa a saída standalone para o container. O Docker instala
dependências, gera o cliente Prisma, compila a aplicação e aplica as migrações
antes de iniciar o servidor. O volume Docker mantém o arquivo SQLite durante
recriações do container.

## Limitações atuais

- Ainda não há edição/exclusão de movimentações, recorrências, relatórios por
  período, exportação ou múltiplas contas compartilhadas.
- O simulador não persiste a lista e não cria uma transação automaticamente.
- PF e PJ são filtros dentro da mesma conta; a aplicação não oferece gestão
  multiusuário empresarial nem obrigações fiscais.
- O SQLite atende a uma instalação simples/individual. Antes de escalar para
  múltiplas instâncias, avaliar uma base de dados cliente-servidor e estratégia
  de backup/restore.
