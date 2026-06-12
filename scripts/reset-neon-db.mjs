/**
 * Reinicia o Postgres na Neon: drop schema + migrations + catálogo curado indexado.
 *
 * Uso:
 *   NEON_DATABASE_URL=postgresql://... node scripts/reset-neon-db.mjs
 *   # ou defina NEON_DATABASE_URL no .env
 */
import { spawnSync } from "node:child_process";
import { resolveNeonDatabaseUrl } from "./load-env.mjs";

const neonUrl = resolveNeonDatabaseUrl();

if (!neonUrl) {
  console.error(
    [
      "NEON_DATABASE_URL não encontrada.",
      "Adicione no .env:",
      '  NEON_DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require',
    ].join("\n"),
  );
  process.exit(1);
}

if (!neonUrl.includes("neon.tech")) {
  console.error(
    "NEON_DATABASE_URL não parece ser Neon (*.neon.tech). Abortando por segurança.",
  );
  process.exit(1);
}

function run(label, command, args, extraEnv = {}) {
  console.log(`\n→ ${label}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, DATABASE_URL: neonUrl, ...extraEnv },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("=== Reset Neon — my-next-game ===");
console.log(`Target: ${neonUrl.replace(/:[^:@/]+@/, ":****@")}`);

run("Prisma migrate reset (drop + reaplicar migrations)", "npx", [
  "prisma",
  "migrate",
  "reset",
  "--force",
  "--skip-seed",
]);

run("Indexar catálogo curado no pgvector", "npx", ["tsx", "scripts/index-game-embeddings.ts"], {
  INDEX_SOURCE: "curated",
});

console.log("\n✓ Neon reiniciado e catálogo curado indexado.");
