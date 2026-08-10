import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Candor — the AI analyst that knows what it doesn't know";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social preview card. Rendered at build/request time by Next's OG runtime. */
export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#05070C",
          backgroundImage:
            "radial-gradient(circle at 22% 0%, rgba(91,140,255,0.30), transparent 55%), radial-gradient(circle at 88% 100%, rgba(154,107,255,0.24), transparent 55%)",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              border: "3px solid #5B8CFF",
              borderRightColor: "#3DE0E6",
              borderBottomColor: "#9A6BFF",
              display: "flex",
            }}
          />
          <div style={{ color: "#E8EDF6", fontSize: 30, fontWeight: 600, letterSpacing: -0.5 }}>Candor</div>
          <div
            style={{
              marginLeft: 10,
              color: "#FBBF24",
              fontSize: 17,
              border: "1px solid rgba(251,191,36,0.35)",
              borderRadius: 999,
              padding: "5px 14px",
            }}
          >
            not investment advice
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ color: "#FFFFFF", fontSize: 74, fontWeight: 700, lineHeight: 1.04, letterSpacing: -2 }}>
            Research that
          </div>
          <div style={{ color: "#8AA7FF", fontSize: 74, fontWeight: 700, lineHeight: 1.04, letterSpacing: -2 }}>
            shows its work.
          </div>
          <div style={{ color: "#A7B2C8", fontSize: 27, marginTop: 10, maxWidth: 900, lineHeight: 1.4 }}>
            An autonomous agent that plans its research, grounds every claim in SEC filings,
            critiques its own draft, and publishes its calibration.
          </div>
        </div>

        <div style={{ display: "flex", gap: 40, color: "#6B7890", fontSize: 21 }}>
          <div style={{ display: "flex" }}>planner → tools → synthesis → self-critique</div>
          <div style={{ display: "flex", color: "#3DE0E6" }}>SEC EDGAR grounded</div>
        </div>
      </div>
    ),
    size,
  );
}
