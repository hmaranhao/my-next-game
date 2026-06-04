/** Remove all embedding catalogs (frees Neon storage). */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  const { count } = await prisma.embeddingCatalog.deleteMany({});
  console.log(`Removed ${count} catalog(s) and all game_catalog_entries.`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
