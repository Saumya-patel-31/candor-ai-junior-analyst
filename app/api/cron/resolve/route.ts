import { NextRequest, NextResponse } from "next/server";
import { resolveDueMemos } from "@/lib/calibration/store";
import { getServiceClient } from "@/lib/db/supabase";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Outcome-resolution job. Hit on a schedule (Vercel Cron, GitHub Action, Supabase
 * scheduled function). Resolves every prediction whose horizon has elapsed.
 *
 *   GET/POST /api/cron/resolve
 *   Authorization: Bearer <CRON_SECRET>      (or ?secret=<CRON_SECRET>)
 *
 * If CRON_SECRET is unset the endpoint is open (fine for local/demo).
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    const qs = new URL(req.url).searchParams.get("secret");
    if (auth !== secret && qs !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await resolveDueMemos();

    // Best-effort ops log.
    if (config.supabase.enabled) {
      try {
        await getServiceClient().from("calibration_runs").insert({
          scanned: result.scanned,
          resolved: result.resolved,
          market_ready: result.marketReady,
          note: result.message ?? null,
        });
      } catch {
        /* non-fatal */
      }
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
