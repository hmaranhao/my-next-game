import { PrismaClient, ProfileSource } from "@prisma/client";

const prisma = new PrismaClient();

const POLICY_VERSION = "2026-06-01";

async function main() {
  const snapshot = await prisma.userProfileSnapshot.create({
    data: {
      source: ProfileSource.MANUAL,
      profile: {
        note: "Seed profile for local DB smoke test",
        favoriteGenres: ["RPG", "Action"],
      },
      consents: {
        create: {
          policyVersion: POLICY_VERSION,
          locale: "pt-BR",
        },
      },
    },
  });

  const session = await prisma.recommendationSession.create({
    data: {
      profileSnapshotId: snapshot.id,
    },
  });

  console.log("Seed OK:", { snapshotId: snapshot.id, sessionId: session.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
