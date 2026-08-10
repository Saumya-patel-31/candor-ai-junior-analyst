"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, Home, CircleAlert } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the digest so a production failure can be traced in server logs.
    console.error("[candor] render error:", error.digest ?? "", error.message);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
      <span className="chip mb-6 border-bear/25 text-bear">
        <CircleAlert className="h-3.5 w-3.5" />
        something broke
      </span>

      <h1 className="font-display text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
        That didn&apos;t render.
      </h1>

      <p className="mt-5 max-w-md text-base leading-relaxed text-fg-muted">
        An unexpected error interrupted this page. The agent pipeline itself degrades
        gracefully — retrying usually clears it.
      </p>

      {error.digest && (
        <p className="mt-4 font-mono text-2xs text-fg-faint">error digest · {error.digest}</p>
      )}

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <button onClick={reset} className="btn-primary px-6 py-3 text-sm">
          <RotateCcw className="h-4 w-4" /> Try again
        </button>
        <Link href="/" className="btn-ghost px-6 py-3 text-sm">
          <Home className="h-4 w-4" /> Back to the terminal
        </Link>
      </div>
    </div>
  );
}
