import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { getMemo } from "@/lib/demo/mockMemos";
import { getOrBuildMemo } from "@/lib/demo/pipeline";
import { CALIBRATION_RECORDS } from "@/lib/demo/mockCalibration";
import { MemoView } from "@/components/memo/MemoView";
import type { Memo } from "@/lib/types";

function resolveMemo(id: string): Memo | undefined {
  const direct = getMemo(id);
  if (direct) return direct;
  // Fall back to a calibration record so every linked row resolves to a memo.
  const rec = CALIBRATION_RECORDS.find((r) => r.memoId === id);
  if (rec) {
    const memo = getOrBuildMemo(rec.ticker, rec.question);
    memo.id = rec.memoId;
    memo.confidenceScore = rec.confidenceScore;
    memo.stance = rec.stance;
    memo.asOf = rec.asOf;
    return memo;
  }
  return undefined;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const memo = resolveMemo(id);
  return {
    title: memo ? `${memo.ticker} — research memo` : "Memo",
    description: memo?.thesis.slice(0, 150),
  };
}

export default async function MemoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const memo = resolveMemo(id);
  if (!memo) notFound();

  return (
    <div className="mx-auto max-w-4xl px-6 pt-28 pb-12">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/track-record" className="btn-ghost px-4 py-2 text-sm">
          <ArrowLeft className="h-4 w-4" /> Track record
        </Link>
        <Link href="/#terminal" className="btn-primary px-4 py-2 text-sm">
          <Sparkles className="h-4 w-4" /> Run your own
        </Link>
      </div>
      <MemoView memo={memo} />
    </div>
  );
}
