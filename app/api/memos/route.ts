import { NextResponse } from "next/server";
import { MEMO_LIST, getMemo } from "@/lib/demo/mockMemos";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const memo = getMemo(id);
    if (!memo) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(memo);
  }
  // Library view — strip heavy fields for the list.
  const list = MEMO_LIST.map((m) => ({
    id: m.id,
    ticker: m.ticker,
    company: m.company,
    sector: m.sector,
    question: m.question,
    asOf: m.asOf,
    stance: m.stance,
    confidenceScore: m.confidenceScore,
    thesis: m.thesis.slice(0, 220) + "…",
  }));
  return NextResponse.json({ memos: list });
}
