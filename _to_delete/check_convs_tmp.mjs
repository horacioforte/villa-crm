import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./app/generated/prisma/client.ts";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const convs = await prisma.conversa.findMany({
  where: { instanceName: "taciane-villa", telefone: { contains: "5159223" } },
  select: { id: true, telefone: true, nomeContato: true, createdAt: true, canalWhatsappId: true },
  orderBy: { createdAt: "asc" },
});
console.log(JSON.stringify(convs, null, 2));
await prisma.$disconnect();
