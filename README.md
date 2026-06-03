# My Next Game

PWA que recomenda o **próximo jogo** com base no perfil **Steam** (público) ou formulário manual, usando TensorFlow.js no browser, pgvector e dataset Kaggle [Steam Games](https://www.kaggle.com/datasets/fronkongames/steam-games-dataset).

**Nome exibido:** Meu próximo game · **Locales:** pt-BR, en-US

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind CSS 4 · shadcn/ui · next-intl
- PostgreSQL 16 + **pgvector** (Docker) · Prisma
- TensorFlow.js (CDN, próximas entregas)

## Setup

```bash
cp .env.example .env
# STEAM_API_KEY, DATABASE_URL=postgresql://postgres:postgres@localhost:5432/my_next_game

npm install
docker compose up -d
npm run db:migrate
npm run db:seed   # opcional — smoke test
npm run dev
```

- App: [http://localhost:3000/pt-BR](http://localhost:3000/pt-BR)
- DB health: [http://localhost:3000/api/health/db](http://localhost:3000/api/health/db)

## Dados Kaggle

```bash
pip install -r scripts/requirements-data.txt
# Credenciais: ~/.kaggle/kaggle.json ou KAGGLE_USERNAME + KAGGLE_KEY
npm run data:download
```

Gera (gitignored):

- `data/games.normalized.json`
- `data/co-occurrence.pairs.json`
- `data/manifest.json`

Sem Kaggle, use amostra: `USE_SAMPLE_GAME_DATA=true npm run dev` ou os arquivos em `data/samples/`.

Tipos: `src/types/game.ts` · loader: `src/lib/game-data.ts`.

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Desenvolvimento |
| `npm run build` | Build produção |
| `docker compose up -d` | Postgres + pgvector |
| `npm run db:migrate` | Aplica migrations Prisma |
| `npm run db:migrate:dev` | Cria migration em dev |
| `npm run db:seed` | Seed mínimo |
| `npm run data:download` | Baixa e normaliza dataset Kaggle |
| `npm run lint` | ESLint |

## Modelo de dados (Prisma)

- `UserProfileSnapshot` — perfil Steam/manual (JSON)
- `LgpdConsent` — consentimento LGPD (`policyVersion`)
- `RecommendationSession` — sessão de recomendação
- `RecommendationCandidate` — candidatos top-50 com `embedding vector(128)`

## Repositório

Submódulo de [pos-ia-my-projects](https://github.com/hmaranhao/pos-ia-my-projects) em `projects/my-next-game`.

## Deploy na Cloudflare

Stack: [OpenNext](https://opennext.js.org/cloudflare) + Workers + Postgres externo (pgvector) via [Hyperdrive](https://developers.cloudflare.com/hyperdrive/).

### Pré-requisitos

1. Conta Cloudflare + `npx wrangler login`
2. Postgres com extensão **pgvector** (ex.: [Neon](https://neon.tech), Supabase, Railway)
3. `STEAM_API_KEY` como secret

### 1. Banco de dados

```bash
# Aplique migrations no Postgres de produção
DATABASE_URL="postgres://..." npm run db:migrate
```

Crie Hyperdrive apontando para o mesmo banco:

```bash
npx wrangler hyperdrive create my-next-game-db \
  --connection-string="postgres://USER:PASS@HOST:5432/DB"

# Copie o id retornado para wrangler.jsonc → hyperdrive[0].id
# Descomente os blocos hyperdrive e r2_buckets em wrangler.jsonc
```

### 2. Variáveis locais (preview)

```bash
cp .dev.vars.example .dev.vars
# Edite DATABASE_URL, STEAM_API_KEY, USE_SAMPLE_GAME_DATA=true
```

Secrets em produção:

```bash
npx wrangler secret put STEAM_API_KEY
npx wrangler secret put DATABASE_URL   # se não usar Hyperdrive
```

### 3. Catálogo de jogos na nuvem

O dataset completo (~239 MB) **não cabe** na memória do Worker. Opções:

| Modo | Config |
|------|--------|
| Demo rápido | `USE_SAMPLE_GAME_DATA=true` (padrão no `wrangler.jsonc`) |
| Catálogo ~8k jogos | `npm run data:cloud` → upload R2 (veja script) + binding `GAME_DATA` |

```bash
npm run data:download
npm run data:cloud
npx wrangler r2 bucket create my-next-game-data
npx wrangler r2 object put my-next-game-data/games.cloud.json --file=data/games.cloud.json
npx wrangler r2 object put my-next-game-data/co-occurrence.cloud.json --file=data/co-occurrence.cloud.json
# wrangler.jsonc: USE_SAMPLE_GAME_DATA=false + r2_buckets GAME_DATA
```

### 4. Build e deploy

```bash
npm run preview:cf   # testa no runtime Workers localmente
npm run deploy:cf      # publica em *.workers.dev
```

**CI (Cloudflare Workers Builds):** build = `npm run deploy:cf` ou `opennextjs-cloudflare build`, deploy = `opennextjs-cloudflare deploy`.

### Scripts Cloudflare

| Comando | Descrição |
|---------|-----------|
| `npm run preview:cf` | Build OpenNext + preview local (Wrangler) |
| `npm run deploy:cf` | Build + deploy para Cloudflare |
| `npm run data:cloud` | Gera `games.cloud.json` (~8k jogos) para R2 |
| `npm run cf-typegen` | Tipos TypeScript dos bindings |
