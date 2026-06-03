import { NextResponse } from "next/server";
import { buildManualProfile } from "@/lib/steam/profile-service";
import { persistProfile, ProfilePersistError } from "@/lib/profile/persist";
import type { ManualProfileInput, ProfileApiError, ProfileApiSuccess } from "@/types/profile";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ManualProfileInput & {
      consentId?: string;
    };

    if (!body.consentId) {
      return NextResponse.json(
        { ok: false, code: "CONSENT_REQUIRED", message: "Accept LGPD consent first" } satisfies ProfileApiError,
        { status: 400 },
      );
    }

    if (!body.favoriteGenres?.length && !body.favoriteGames?.length) {
      return NextResponse.json(
        { ok: false, code: "INVALID_INPUT", message: "Add at least one genre or favorite game" } satisfies ProfileApiError,
        { status: 400 },
      );
    }

    const profile = buildManualProfile(body);
    const snapshotId = await persistProfile(profile, body.consentId);

    return NextResponse.json({
      ok: true,
      snapshotId,
      profile,
    } satisfies ProfileApiSuccess);
  } catch (error) {
    if (error instanceof ProfilePersistError) {
      return NextResponse.json(
        { ok: false, code: "CONSENT_INVALID", message: error.message } satisfies ProfileApiError,
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, code: "INVALID_INPUT", message } satisfies ProfileApiError,
      { status: 400 },
    );
  }
}
