import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [db] = await prisma.$queryRaw<[{ ok: number }]>`
      SELECT 1::int AS ok
    `;
    const [ext] = await prisma.$queryRaw<[{ extname: string }]>`
      SELECT extname FROM pg_extension WHERE extname = 'vector' LIMIT 1
    `;

    return NextResponse.json({
      status: "ok",
      database: db?.ok === 1,
      pgvector: ext?.extname === "vector",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { status: "error", message },
      { status: 503 },
    );
  }
}
