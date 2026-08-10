/** Route-level loading skeleton — keeps layout stable while a page streams in. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-6 pt-32 pb-16" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-6 w-44" />
      <div className="skeleton mt-6 h-12 w-2/3" />
      <div className="skeleton mt-3 h-12 w-1/2" />
      <div className="skeleton mt-6 h-4 w-full max-w-2xl" />
      <div className="skeleton mt-2 h-4 w-full max-w-xl" />

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-2xl" />
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="skeleton h-72 rounded-3xl" />
        <div className="skeleton h-72 rounded-3xl" />
      </div>
    </div>
  );
}
