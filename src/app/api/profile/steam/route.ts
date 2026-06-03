import { NextResponse } from "next/server";
import { buildSteamProfile, SteamApiError } from "@/lib/steam/profile-service";
import { persistProfile, ProfilePersistError } from "@/lib/profile/persist";
import type { ProfileApiError, ProfileApiSuccess } from "@/types/profile";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      steamInput?: string;
      consentId?: string;
    };

    if (!body.consentId) {
      return jsonError("CONSENT_REQUIRED", "Accept LGPD consent before fetching profile", 400);
    }
    if (!body.steamInput?.trim()) {
      return jsonError("INVALID_INPUT", "Steam ID or profile URL is required", 400);
    }

    const profile = await buildSteamProfile(body.steamInput);
    const snapshotId = await persistProfile(profile, body.consentId);

    return NextResponse.json({
      ok: true,
      snapshotId,
      profile,
    } satisfies ProfileApiSuccess);
  } catch (error) {
    if (error instanceof SteamApiError) {
      const status =
        error.code === "PROFILE_PRIVATE" ? 403 :
        error.code === "STEAM_NOT_FOUND" ? 404 :
        error.code === "MISSING_STEAM_API_KEY" ? 503 : 400;
      return jsonError(error.code, error.message, status);
    }
    if (error instanceof ProfilePersistError) {
      return jsonError("CONSENT_INVALID", error.message, 400);
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonError("STEAM_API_ERROR", message, 500);
  }
}

function jsonError(
  code: ProfileApiError["code"],
  message: string,
  status: number,
) {
  return NextResponse.json({ ok: false, code, message } satisfies ProfileApiError, {
    status,
  });
}
