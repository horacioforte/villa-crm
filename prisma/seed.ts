import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../app/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@villaempreendimentos.com.br";
  const password = process.env.ADMIN_PASSWORD ?? "admin123";
  const nome = process.env.ADMIN_NAME ?? "Administrador Villa";

  const senhaHash = await bcrypt.hash(password, 12);

  await prisma.usuario.upsert({
    where: {
      email,
    },
    update: {
      nome,
      senhaHash,
      papel: "ADMIN",
      ativo: true,
    },
    create: {
      nome,
      email,
      senhaHash,
      papel: "ADMIN",
      ativo: true,
    },
  });

  console.log(`Usuario ADMIN pronto: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
