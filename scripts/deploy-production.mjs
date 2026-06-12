/**
 * Reset Neon + Hyperdrive (se necessário) + deploy Cloudflare Workers.
 *
 * Pré-requisitos:
 *   - NEON_DATABASE_URL no .env
 *   - npx wrangler login (ou CLOUDFLARE_API_TOKEN)
 *
 * Uso: node scripts/deploy-production.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { resolveNeonDatabaseUrl } from "./load-env.mjs";

const neonUrl = resolveNeonDatabaseUrl();
if (!neonUrl) {
  console.error("Defina NEON_DATABASE_URL no .env antes do deploy.");
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

function wranglerOk() {
  const r = spawnSync("npx", ["wrangler", "whoami"], {
    shell: true,
    encoding: "utf8",
  });
  return r.status === 0 && !r.stdout?.includes("not authenticated");
}

console.log("=== Deploy produção — my-next-game ===\n");

run("Reset + indexação Neon", "node", ["scripts/reset-neon-db.mjs"]);

if (!wranglerOk()) {
  console.error(
    [
      "\nWrangler não autenticado.",
      "Rode no terminal: npx wrangler login",
      "Depois execute novamente: node scripts/deploy-production.mjs",
    ].join("\n"),
  );
  process.exit(1);
}

console.log("\n→ Hyperdrive (criar ou reutilizar my-next-game-db)");
const hd = spawnSync(
  "npx",
  [
    "wrangler",
    "hyperdrive",
    "create",
    "my-next-game-db",
    `--connection-string=${neonUrl}`,
  ],
  { shell: true, encoding: "utf8" },
);

let hyperdriveId = null;
const combined = `${hd.stdout ?? ""}${hd.stderr ?? ""}`;
const match = combined.match(
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
);
if (match) {
  hyperdriveId = match[0];
  console.log(`Hyperdrive ID: ${hyperdriveId}`);
} else if (combined.toLowerCase().includes("already exists")) {
  const list = spawnSync("npx", ["wrangler", "hyperdrive", "list"], {
    shell: true,
    encoding: "utf8",
  });
  const listMatch = `${list.stdout ?? ""}`.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );
  hyperdriveId = listMatch?.[0] ?? null;
  if (hyperdriveId) {
    console.log(`Hyperdrive existente: ${hyperdriveId}`);
    spawnSync(
      "npx",
      [
        "wrangler",
        "hyperdrive",
        "update",
        hyperdriveId,
        `--connection-string=${neonUrl}`,
      ],
      { shell: true, stdio: "inherit" },
    );
  }
}

const wranglerPath = "wrangler.jsonc";
let wrangler = fs.readFileSync(wranglerPath, "utf8");

if (hyperdriveId && !wrangler.includes('"binding": "HYPERDRIVE"')) {
  const block = `\t"hyperdrive": [\n\t\t{\n\t\t\t"binding": "HYPERDRIVE",\n\t\t\t"id": "${hyperdriveId}",\n\t\t\t"localConnectionString": "postgresql://postgres:postgres@localhost:5433/my_next_game"\n\t\t}\n\t],`;
  wrangler = wrangler.replace(
    /"USE_SAMPLE_GAME_DATA": "true"/,
    '"USE_SAMPLE_GAME_DATA": "false"',
  );
  wrangler = wrangler.replace(
    /(\t"vars": \{[\s\S]*?\},\n)/,
    `$1${block}\n`,
  );
  fs.writeFileSync(wranglerPath, wrangler);
  console.log("wrangler.jsonc atualizado (hyperdrive + USE_SAMPLE_GAME_DATA=false).");
} else if (hyperdriveId) {
  wrangler = wrangler.replace(
    /"id": "[0-9a-f-]{36}"/i,
    `"id": "${hyperdriveId}"`,
  );
  wrangler = wrangler.replace(
    /"USE_SAMPLE_GAME_DATA": "true"/,
    '"USE_SAMPLE_GAME_DATA": "false"',
  );
  fs.writeFileSync(wranglerPath, wrangler);
  console.log("wrangler.jsonc: hyperdrive id atualizado.");
}

run("STEAM_API_KEY secret (se já existir, confirme no prompt)", "npx", [
  "wrangler",
  "secret",
  "list",
]);

run("Deploy Cloudflare", "npm", ["run", "deploy:cf"]);

console.log("\n✓ Deploy concluído.");
console.log("URL: https://my-next-game.herculeslima-maranhao.workers.dev");
