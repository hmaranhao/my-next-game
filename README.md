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
| `npm run db:index-embeddings` | Indexa catálogo no Postgres (pgvector HNSW) |
| `npm run db:migrate:dev` | Cria migration em dev |
| `npm run db:seed` | Seed mínimo |
| `npm run data:download` | Baixa e normaliza dataset Kaggle |
| `npm run lint` | ESLint |

## Modelo de dados (Prisma)

- `UserProfileSnapshot` — perfil Steam/manual (JSON)
- `LgpdConsent` — consentimento LGPD (`policyVersion`)
- `RecommendationSession` — sessão de recomendação
- `RecommendationCandidate` — candidatos com `embedding vector(128)` por sessão
- `EmbeddingCatalog` + `GameCatalogEntry` — catálogo indexado para busca KNN (HNSW)

### Busca vetorial (pgvector)

Por padrão (`VECTOR_SEARCH_BACKEND=auto`), a API usa **pgvector no Postgres** quando o catálogo foi indexado; caso contrário, faz busca em memória sobre o JSON (R2/amostra).

```bash
npm run data:download          # ~122k jogos (Kaggle)
npm run db:migrate
npm run db:index-embeddings    # indexa o catálogo completo no Postgres
```

Por padrão indexa **todos** os jogos em `data/games.normalized.json`. Para testar com subset: `INDEX_GAME_LIMIT=5000 npm run db:index-embeddings`.

Com índice ativo, a busca escala para ~122k jogos via HNSW no Neon (o Worker só envia o vetor do perfil). O JSON no R2 pode continuar menor (~2k) — só afeta o fallback em memória.

| `VECTOR_SEARCH_BACKEND` | Comportamento |
|-------------------------|---------------|
| `auto` | pg se houver catálogo indexado, senão memória |
| `pg` | Sempre pgvector (fallback memória se vazio) |
| `memory` | Loop in-memory sobre JSON (dev/demo) |

## Repositório

Submódulo de [pos-ia-my-projects](https://github.com/hmaranhao/pos-ia-my-projects) em `projects/my-next-game`.

## Deploy na Cloudflare

### O banco fica dentro da Cloudflare?

**Não.** O app roda na Cloudflare (Workers), mas o **PostgreSQL fica em outro serviço** — porque precisamos de **pgvector**, e o banco nativo da Cloudflare (D1) é SQLite, sem essa extensão.

```
┌─────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  Navegador  │────▶│  Cloudflare Workers  │────▶│  Postgres (Neon…)   │
│  TF.js ML   │     │  app my-next-game    │     │  perfis, sessões,   │
└─────────────┘     │         │            │     │  embeddings pgvector│
                    │         ▼            │     └─────────────────────┘
                    │  Hyperdrive (proxy)  │              ▲
                    │  pool de conexões    │──────────────┘
                    └──────────────────────┘
```

| O quê | Onde fica |
|-------|-----------|
| Site + APIs | **Cloudflare Workers** |
| Conexão rápida ao banco | **Hyperdrive** (na Cloudflare, mas *não* é o banco) |
| Dados (tabelas, vetores) | **Neon / Supabase / Railway** (Postgres externo) |
| Catálogo de jogos (JSON) | **R2** ou amostra em memória (opcional) |

**Dev local:** Docker Postgres (`docker compose up -d`).  
**Produção:** Neon (grátis) + Hyperdrive.

---

### Passo a passo (recomendado: Neon)

#### 1. Postgres na Neon (5 min)

1. Crie conta em [neon.tech](https://neon.tech)
2. **New project** → região perto de você (ex.: `aws-us-east-1`)
3. No dashboard, copie a **connection string** (formato `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`)
4. No SQL Editor da Neon, rode uma vez (se a migration não criar sozinha):

   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

#### 2. Migrations + Hyperdrive

```bash
# Node 22+ (Wrangler 4 exige)
nvm use    # usa .nvmrc → 22

export DATABASE_URL="postgresql://..."   # string da Neon

chmod +x scripts/setup-cloud-db.sh
./scripts/setup-cloud-db.sh              # migrations + cria Hyperdrive
```

O script imprime o **Hyperdrive ID**. Cole em `wrangler.jsonc` — descomente:

```jsonc
"hyperdrive": [
  {
    "binding": "HYPERDRIVE",
    "id": "COLE-O-UUID-AQUI"
  }
],
```

> Com Hyperdrive configurado, **não** precisa de `DATABASE_URL` como secret no Worker — o app usa `env.HYPERDRIVE.connectionString`.

#### 3. Login Cloudflare + secrets

```bash
npx wrangler login
npx wrangler secret put STEAM_API_KEY
```

#### 4. Deploy

```bash
npm run deploy:cf
```

URL: `https://my-next-game.<sua-conta>.workers.dev`

#### 5. Preview local (opcional)

```bash
cp .dev.vars.example .dev.vars
# DATABASE_URL = Neon (para preview sem Hyperdrive) ou use wrangler preview
npm run preview:cf
```

---

### Catálogo de jogos na nuvem

O dataset completo (~239 MB) **não cabe** na memória do Worker.

| Modo | Config |
|------|--------|
| Demo rápido | `USE_SAMPLE_GAME_DATA=true` (padrão no `wrangler.jsonc`) |
| ~2k jogos | `npm run data:cloud` + upload R2 + binding `GAME_DATA` + `USE_SAMPLE_GAME_DATA=false` |

```bash
npm run data:download && npm run data:cloud
npx wrangler r2 bucket create my-next-game-data
npx wrangler r2 object put my-next-game-data/games.cloud.json --file=data/games.cloud.json
npx wrangler r2 object put my-next-game-data/co-occurrence.cloud.json --file=data/co-occurrence.cloud.json
# wrangler.jsonc: USE_SAMPLE_GAME_DATA=false + descomente r2_buckets GAME_DATA
```

### Scripts Cloudflare

| Comando | Descrição |
|---------|-----------|
| `./scripts/setup-cloud-db.sh` | Migrations + cria Hyperdrive |
| `npm run preview:cf` | Build + preview no runtime Workers |
| `npm run deploy:cf` | Build + deploy |
| `npm run data:cloud` | Catálogo reduzido para R2 |
| `npm run cf-typegen` | Tipos dos bindings Cloudflare |
