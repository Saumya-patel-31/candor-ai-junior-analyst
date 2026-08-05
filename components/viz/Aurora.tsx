/** Ambient aurora mesh — CSS-only, no JS. Sits behind all content. */
export function Aurora() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-void" />
      <div
        className="absolute -top-1/3 left-1/2 h-[70vh] w-[70vw] -translate-x-1/2 rounded-full opacity-60 blur-[120px] animate-aurora-drift"
        style={{ background: "radial-gradient(circle, rgba(91,140,255,0.35), transparent 62%)" }}
      />
      <div
        className="absolute top-[10%] -left-[10%] h-[46vh] w-[46vw] rounded-full opacity-40 blur-[120px] animate-float"
        style={{ background: "radial-gradient(circle, rgba(154,107,255,0.32), transparent 60%)" }}
      />
      <div
        className="absolute bottom-[-15%] right-[-8%] h-[52vh] w-[50vw] rounded-full opacity-35 blur-[130px] animate-aurora-drift"
        style={{ background: "radial-gradient(circle, rgba(61,224,230,0.22), transparent 60%)", animationDelay: "-8s" }}
      />
      <div className="absolute inset-0 bg-hud-grid mask-radial opacity-[0.55]" />
      <div className="absolute inset-0 grain" />
    </div>
  );
}
