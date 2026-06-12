/**
 * Install Python deps for data:download (kagglehub, pandas).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const requirements = path.join(__dirname, "requirements-data.txt");

const attempts = [
  { label: "uv pip", cmd: "uv", args: ["pip", "install", "-r", requirements] },
  { label: "pip3", cmd: "pip3", args: ["install", "-r", requirements] },
  { label: "pip", cmd: "pip", args: ["install", "-r", requirements] },
  { label: "py -m pip", cmd: "py", args: ["-3", "-m", "pip", "install", "-r", requirements] },
];

for (const attempt of attempts) {
  const check = spawnSync(attempt.cmd, ["--version"], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  if (check.error || check.status !== 0) continue;

  console.log(`Using ${attempt.label}…`);
  const result = spawnSync(attempt.cmd, attempt.args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  process.exit(result.status ?? 1);
}

console.error(
  "Nenhum gerenciador Python encontrado. Instale uv ou Python 3 + pip.",
);
process.exit(1);
