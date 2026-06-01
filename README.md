# My Next Game

PWA que recomenda o **próximo jogo** com base no perfil **Steam** (público) ou formulário manual, usando TensorFlow.js no browser, pgvector e dataset Kaggle [video-games](https://www.kaggle.com/datasets/mohamedhanyyy/video-games).

**Nome exibido:** Meu próximo game · **Locales:** pt-BR, en-US

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind CSS 4 · shadcn/ui
- next-intl · TensorFlow.js (CDN, próximas entregas)
- PostgreSQL + pgvector (Docker, próximo work item)
- Prisma (próximo work item)

## Setup

```bash
cp .env.example .env
# Preencha STEAM_API_KEY e DATABASE_URL

npm install
npm run dev
```

Abra [http://localhost:3000/pt-BR](http://localhost:3000/pt-BR).

## Docker (Postgres)

Na entrega `infra-docker-prisma`:

```bash
docker compose up -d
```

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Servidor de produção |
| `npm run lint` | ESLint |

## PWA

`src/app/manifest.ts` e ícones em `public/icons/`. Instalação mobile suportada após ícones finais.

## Repositório

Parte do monorepo [pos-ia-my-projects](https://github.com/hmaranhao/pos-ia-my-projects) como submódulo em `projects/my-next-game`.
