import fs from "node:fs";
import path from "node:path";

/** Parse KEY=VALUE lines from .env (no multiline / quoted values). */
export function loadEnvFile(filePath = ".env") {
  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) return {};

  const env = {};
  for (const line of fs.readFileSync(abs, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

export function resolveNeonDatabaseUrl(filePath = ".env") {
  const fileEnv = loadEnvFile(filePath);
  return (
    process.env.NEON_DATABASE_URL ??
    fileEnv.NEON_DATABASE_URL ??
    process.env.DATABASE_URL ??
    fileEnv.DATABASE_URL
  );
}
