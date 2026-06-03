import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

type HyperdriveBinding = { connectionString: string };

function resolveConnectionString(): string {
  const fallback = process.env.DATABASE_URL;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare") as {
      getCloudflareContext: () => { env: Record<string, unknown> };
    };
    const { env } = getCloudflareContext();
    const hyperdrive = env.HYPERDRIVE as HyperdriveBinding | undefined;
    if (hyperdrive?.connectionString) {
      return hyperdrive.connectionString;
    }
  } catch {
    // build / next dev sem bindings
  }

  if (fallback) return fallback;

  throw new Error("DATABASE_URL is not set");
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: resolveConnectionString(),
    maxUses: 1,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

/** Proxy lazy — resolve Hyperdrive/DATABASE_URL no primeiro uso (Workers-safe). */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = client[prop as keyof PrismaClient];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});
