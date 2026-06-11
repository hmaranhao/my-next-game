# My Next Game

PWA que recomenda o **próximo jogo** com base no perfil **Steam** (público) ou formulário manual, usando TensorFlow.js no browser, pgvector e dataset Kaggle [Steam Games](https://www.kaggle.com/datasets/fronkongames/steam-games-dataset).

**Nome exibido:** Meu próximo game · **Locales:** pt-BR, en-US

**Demo:** [my-next-game.herculeslima-maranhao.workers.dev](https://my-next-game.herculeslima-maranhao.workers.dev) · **Código:** [github.com/hmaranhao/my-next-game](https://github.com/hmaranhao/my-next-game)

## Sobre o projeto

Biblioteca Steam cheia de títulos que você **já tem**, catálogo infinito de jogos que **ainda não tem**… e zero clareza sobre qual **novo** jogo vale a pena. O **My Next Game** resolve isso: analisa seu perfil Steam (ou um formulário manual, se o perfil for privado) e recomenda **um único jogo fora da sua biblioteca** — com explicação do porquê e **% de match**.

### Como funciona

1. **Perfil** — integração com a Steam Web API (biblioteca, tempo jogado, gêneros) ou formulário manual com consentimento LGPD
2. **Dados** — pipeline com dataset Kaggle (~122k jogos normalizados)
3. **Busca vetorial** — PostgreSQL + pgvector (HNSW) filtra candidatos por similaridade
4. **Ranking no browser** — TensorFlow.js escolhe o jogo final no dispositivo do usuário
5. **Co-ocorrência** — score “quem gostou de X também curtiu Y”
6. **Catálogo curado** — ~128 títulos mainstream; **exclui tudo que já está na sua biblioteca Steam**

### Destaques

- PWA instalável (manifest + service worker)
- i18n pt-BR e en-US (`next-intl`)
- Infra em produção: Cloudflare Workers + Hyperdrive + Neon Postgres + R2
- Testes E2E com Playwright + CI no GitHub Actions
- Desenvolvido com metodologia **Spec-Driven FIRE** (8 entregas incrementais, do scaffold ao deploy)

Projeto da pós-graduação em **Engenharia de Software com IA Aplicada**.

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind CSS 4 · shadcn/ui · next-intl
- PostgreSQL 16 + **pgvector** (Docker) · Prisma
- TensorFlow.js (CDN + Web Worker no browser)

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
| `npm run test:e2e` | Playwright E2E (APIs mockadas, sem Steam live) |

## Testes E2E (Playwright)

Não dependem de Steam ao vivo nem de Postgres — as rotas `/api/*` são **mockadas** no browser.

```bash
npm install
npx playwright install chromium   # primeira vez
npm run test:e2e
```

Variáveis opcionais:

| Variável | Uso |
|---------|-----|
| `PLAYWRIGHT_PORT` | Porta do dev server (default `3000`) |
| `USE_SAMPLE_GAME_DATA` | Catálogo amostra no servidor (default `true` no Playwright) |
| `CI` | Setado no GitHub Actions — sobe servidor automaticamente |

Com `npm run dev` já rodando na mesma porta, o Playwright **reutiliza** o servidor local.

Para fluxo completo com pgvector real: `docker compose up -d` + `npm run db:reindex-curated` (opcional; E2E não exige).

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

## Post LinkedIn

<details>
<summary>Texto pronto para copiar e publicar</summary>

Acabei de finalizar um projeto que mistura duas paixões: jogos e IA aplicada à engenharia de software.

O problema é familiar: você conhece bem o que já joga, mas entre milhares de títulos na Steam fica difícil escolher **o próximo jogo que ainda não está na sua biblioteca**.

A solução foi o **My Next Game** — uma PWA que analisa seu perfil Steam (ou um formulário manual, se o perfil for privado) e recomenda **um único jogo fora da sua biblioteca**, com explicação do porquê e **% de match**.

**Como funciona por baixo do capô:**

→ Integração com a **Steam Web API** (biblioteca, tempo jogado, gêneros)  
→ Pipeline de dados com dataset **Kaggle** (~122k jogos normalizados)  
→ Busca vetorial com **PostgreSQL + pgvector** (HNSW) para filtrar candidatos  
→ **TensorFlow.js no browser** para o ranking final — ML rodando no dispositivo do usuário  
→ Score de co-ocorrência (“quem gostou de X também curtiu Y”)  
→ Catálogo curado de ~128 títulos mainstream — **nunca sugere jogos que você já possui**

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind · shadcn/ui · Prisma · next-intl (pt-BR/en-US)

**Infra em produção:** Cloudflare Workers + Hyperdrive + Neon Postgres + R2

**Qualidade:** PWA instalável · fluxo LGPD para perfis privados · testes E2E com Playwright · CI no GitHub Actions

Desenvolvido com metodologia **Spec-Driven FIRE** — 8 entregas incrementais, do scaffold ao deploy, com checkpoints de arquitetura, ML e UX.

Projeto da pós-graduação em **Engenharia de Software com IA Aplicada**.

Experimente: https://my-next-game.herculeslima-maranhao.workers.dev  
Código: https://github.com/hmaranhao/my-next-game

Se você também fica perdido escolhendo o próximo título para **descobrir** — testa aí e me conta se acertou. 🎮

#InteligenciaArtificial #MachineLearning #NextJS #EngenhariaDeSoftware #Steam #PWA #DesenvolvimentoWeb #Portfolio #PosGraduacao

</details>
