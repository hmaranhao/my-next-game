import { prisma } from "@/lib/prisma";
import { LGPD_POLICY_VERSION } from "@/lib/lgpd/constants";
import type { NormalizedUserProfile } from "@/types/profile";
import { ProfileSource } from "@prisma/client";

export async function assertValidConsent(consentId: string): Promise<void> {
  const consent = await prisma.lgpdConsent.findUnique({
    where: { id: consentId },
  });
  if (!consent) {
    throw new ProfilePersistError("CONSENT_INVALID", "Consent record not found");
  }
  if (consent.policyVersion !== LGPD_POLICY_VERSION) {
    throw new ProfilePersistError(
      "CONSENT_INVALID",
      "Consent policy version outdated. Please accept again.",
    );
  }
}

export class ProfilePersistError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function persistProfile(
  profile: NormalizedUserProfile,
  consentId: string,
): Promise<string> {
  await assertValidConsent(consentId);

  const snapshot = await prisma.userProfileSnapshot.create({
    data: {
      steamId: profile.steamId,
      source: profile.source === "STEAM" ? ProfileSource.STEAM : ProfileSource.MANUAL,
      profile: profile as object,
    },
  });

  await prisma.lgpdConsent.update({
    where: { id: consentId },
    data: { profileSnapshotId: snapshot.id },
  });

  return snapshot.id;
}

export function filterUnplayedAppIds(
  profile: NormalizedUserProfile,
  candidateAppIds: number[],
): number[] {
  const played = new Set(profile.playedAppIds);
  return candidateAppIds.filter((id) => !played.has(id));
}
