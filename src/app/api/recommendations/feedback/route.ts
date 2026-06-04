import { NextResponse } from "next/server";
import { saveRecommendationFeedback } from "@/lib/recommendations/feedback";
import { loadProfileSnapshot } from "@/lib/embedding/persist-candidates";
import type { NormalizedGame } from "@/types/game";
import type { FeedbackRating } from "@/lib/embedding/taste-signals";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      snapshotId?: string;
      gameExternalId?: string;
      rating?: FeedbackRating;
      gameMetadata?: NormalizedGame;
    };

    if (!body.sessionId || !body.snapshotId || !body.gameExternalId || !body.rating) {
      return NextResponse.json(
        { ok: false, message: "sessionId, snapshotId, gameExternalId and rating are required" },
        { status: 400 },
      );
    }

    if (body.rating !== "UP" && body.rating !== "DOWN") {
      return NextResponse.json({ ok: false, message: "Invalid rating" }, { status: 400 });
    }

    const snapshot = await loadProfileSnapshot(body.snapshotId);
    if (!snapshot) {
      return NextResponse.json({ ok: false, message: "Profile not found" }, { status: 404 });
    }

    await saveRecommendationFeedback({
      sessionId: body.sessionId,
      profileSnapshotId: body.snapshotId,
      profile: snapshot.profile,
      gameExternalId: body.gameExternalId,
      rating: body.rating,
      gameMetadata: body.gameMetadata ?? {
        id: body.gameExternalId,
        steamAppId: Number.parseInt(body.gameExternalId, 10) || null,
        name: body.gameExternalId,
        genre: null,
        platform: null,
        year: null,
        rating: null,
        tags: [],
        price: null,
        publisher: null,
        raw: {},
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
