/**
 * Cross-platform launcher for download-kaggle-data.py.
 * Tries uv (preferred), then python3 / python / py on Windows.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(__dirname, "download-kaggle-data.py");

const attempts = [
  {
    label: "uv run",
    cmd: "uv",
    args: [
      "run",
      "--with",
      "kagglehub",
      "--with",
      "pandas",
      script,
    ],
  },
  { label: "python3", cmd: "python3", args: [script] },
  { label: "python", cmd: "python", args: [script] },
  { label: "py -3", cmd: "py", args: ["-3", script] },
];

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return result.status ?? 1;
}

for (const attempt of attempts) {
  const check = spawnSync(
    attempt.cmd,
    attempt.cmd === "uv" ? ["--version"] : ["--version"],
    { stdio: "ignore", shell: process.platform === "win32" },
  );
  if (check.error || check.status !== 0) continue;

  console.log(`Using ${attempt.label}…`);
  const code = run(attempt.cmd, attempt.args);
  if (code === 0) process.exit(0);

  console.error(`${attempt.label} failed (exit ${code}).`);
  process.exit(code);
}

console.error(
  [
    "Python não encontrado para rodar data:download.",
    "",
    "Opções:",
    "  1. Instalar uv: https://docs.astral.sh/uv/getting-started/installation/",
    "  2. Instalar Python 3 e deps: pip install -r scripts/requirements-data.txt",
    "  3. Credenciais Kaggle: ~/.kaggle/kaggle.json ou KAGGLE_USERNAME + KAGGLE_KEY no .env",
  ].join("\n"),
);
process.exit(1);
