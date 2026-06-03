import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { LGPD_POLICY_VERSION, hashUserAgent } from "@/lib/lgpd/constants";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      accepted?: boolean;
      locale?: string;
    };

    if (!body.accepted) {
      return NextResponse.json(
        { ok: false, code: "CONSENT_REQUIRED", message: "Consent is required" },
        { status: 400 },
      );
    }

    const h = await headers();
    const consent = await prisma.lgpdConsent.create({
      data: {
        policyVersion: LGPD_POLICY_VERSION,
        locale: body.locale ?? null,
        userAgentHash: hashUserAgent(h.get("user-agent")),
      },
    });

    return NextResponse.json({
      ok: true,
      consentId: consent.id,
      policyVersion: LGPD_POLICY_VERSION,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
