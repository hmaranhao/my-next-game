#!/usr/bin/env bash
# Configura Postgres de produção + Hyperdrive para deploy na Cloudflare.
#
# Uso:
#   export DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
#   ./scripts/setup-cloud-db.sh
#
# Requer: Node 22+ para wrangler (nvm use 22)

set -euo pipefail
cd "$(dirname "$0")/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "=== My Next Game — banco na nuvem ==="
echo ""

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo -e "${RED}DATABASE_URL não definida.${NC}"
  echo ""
  echo "1. Crie um Postgres com pgvector (recomendado: https://neon.tech — plano free)"
  echo "2. Copie a connection string (postgresql://...)"
  echo "3. Rode:"
  echo ""
  echo "   export DATABASE_URL=\"postgresql://...\""
  echo "   ./scripts/setup-cloud-db.sh"
  echo ""
  exit 1
fi

NODE_MAJOR=$(node -p "process.version.slice(1).split('.')[0]" 2>/dev/null || echo "0")
if [[ "$NODE_MAJOR" -lt 22 ]]; then
  echo -e "${YELLOW}Aviso: Wrangler 4 pede Node 22+. Você está em $(node -v).${NC}"
  echo "  nvm install 22 && nvm use 22"
  echo ""
fi

echo "→ Aplicando migrations Prisma (pgvector + tabelas)..."
npm run db:migrate

echo ""
echo -e "${GREEN}✓ Migrations aplicadas.${NC}"
echo ""

if command -v npx >/dev/null 2>&1; then
  echo "→ Criando config Hyperdrive na Cloudflare (proxy até o Postgres)..."
  echo "  (Se não estiver logado: npx wrangler login)"
  echo ""

  if HYPERDRIVE_OUTPUT=$(npx wrangler hyperdrive create my-next-game-db --connection-string="$DATABASE_URL" 2>&1); then
    echo "$HYPERDRIVE_OUTPUT"
    HYPERDRIVE_ID=$(echo "$HYPERDRIVE_OUTPUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1 || true)
    if [[ -n "$HYPERDRIVE_ID" ]]; then
      echo ""
      echo -e "${GREEN}Hyperdrive ID:${NC} $HYPERDRIVE_ID"
      echo ""
      echo "Cole no wrangler.jsonc (descomente o bloco hyperdrive):"
      echo ""
      echo "  \"hyperdrive\": ["
      echo "    {"
      echo "      \"binding\": \"HYPERDRIVE\","
      echo "      \"id\": \"$HYPERDRIVE_ID\""
      echo "    }"
      echo "  ],"
      echo ""
    fi
  else
    echo -e "${YELLOW}Não foi possível criar Hyperdrive agora.${NC}"
    echo "$HYPERDRIVE_OUTPUT"
    echo ""
    echo "Crie manualmente quando tiver Node 22 + wrangler login:"
    echo "  npx wrangler hyperdrive create my-next-game-db --connection-string=\"\$DATABASE_URL\""
  fi
fi

echo ""
echo "Próximos passos:"
echo "  1. wrangler.jsonc → descomente hyperdrive com o id acima"
echo "  2. npx wrangler secret put STEAM_API_KEY"
echo "  3. cp .dev.vars.example .dev.vars  (preview local)"
echo "  4. npm run deploy:cf"
echo ""
