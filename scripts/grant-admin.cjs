const { PrismaClient } = require('@prisma/client');

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    throw new Error('Informe o e-mail: npm run admin:grant -- usuario@exemplo.com');
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.update({
      where: { email },
      data: {
        role: 'ADMIN',
        permissions: JSON.stringify(['view', 'create', 'edit', 'delete']),
      },
      select: { email: true },
    });
    process.stdout.write(`Administrador habilitado: ${user.email}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
