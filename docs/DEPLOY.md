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

- O banco central guarda contas, permissões e configurações em
  `/app/prisma/prod.db`. O diretório dos bancos individuais é derivado
  automaticamente desse caminho e criado em `/app/prisma/user-finances`.
  Mantenha `/app/prisma` em armazenamento persistente e inclua esses arquivos
  no plano de backup.
- Mantenha `.env` fora do Git e defina `NEXTAUTH_SECRET` forte e exclusivo.
- Configure `NEXTAUTH_URL` com o endereço e protocolo usados para acessar a
  aplicação. Em acesso pela rede local use o IP/porta do TrueNAS; em acesso
  público, prefira HTTPS no domínio do proxy reverso.
- Use HTTPS no proxy de produção e proteja o acesso ao host e aos volumes.
- Faça backups consistentes do volume SQLite e teste a restauração.
- O container grava os logs em `/app/prisma/logs/application.log`, dentro do volume persistente de dados; no host, o arquivo fica em `<data>/logs/application.log`. O arquivo é limitado a 5 MB, mantendo até três arquivos rotacionados. Administradores podem acompanhar as novas linhas em **Configurações → Usuários e permissões → Ver logs do servidor**.
- Para aplicar novas migrações, publique a imagem nova e monitore os logs.
- O SQLite persiste no volume, mas não deve ser compartilhado entre múltiplos
  servidores sem uma estratégia explícita de armazenamento e concorrência.


## Bloqueio de login e recuperação de senha

Após cinco senhas incorretas para uma conta, o login é bloqueado por 1 minuto.
Novas sequências de cinco falhas aumentam o bloqueio progressivamente (2, 4, 8,
16 minutos e assim por diante, até 24 horas). O bloqueio é persistido no SQLite;
a contagem regressiva exibida no navegador é apenas uma indicação visual, não a
proteção de segurança em si.

Para habilitar recuperação de senha por e-mail, configure no ambiente de produção:

- `RESEND_API_KEY`: chave privada do Resend.
- `RESEND_FROM_EMAIL`: remetente de um domínio verificado no Resend.
- `NEXTAUTH_URL`: URL pública completa da aplicação, com HTTPS em produção.
- `TRUST_PROXY_HEADERS=true` somente quando o proxy reverso remove os cabeçalhos
  enviados pelo cliente e escreve os valores corretos de IP. Caso contrário,
  mantenha `false` e configure limites de requisição no proxy/gateway.

O link de recuperação é válido por 30 minutos, pode ser usado uma única vez e
sua informação secreta não é armazenada em texto puro no banco. Não registre
tokens em logs. Depois de configurar o e-mail, teste o fluxo em uma conta de
teste antes de disponibilizar aos usuários.

## GitHub

O `.gitignore` evita publicar `.env`, dependências, builds e banco local.
Verifique `git status` antes de enviar alterações e nunca faça commit de
credenciais, bases de produção ou dados pessoais.
