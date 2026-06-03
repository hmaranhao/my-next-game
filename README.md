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
