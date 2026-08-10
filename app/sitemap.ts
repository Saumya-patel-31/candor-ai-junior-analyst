import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
import { MEMO_LIST } from "@/lib/demo/mockMemos";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();

  const pages: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/track-record`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/methodology`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/dashboard`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
  ];

  // Curated memos are stable, shareable URLs worth indexing.
  const memos: MetadataRoute.Sitemap = MEMO_LIST.map((m) => ({
    url: `${base}/memo/${m.id}`,
    lastModified: new Date(m.asOf),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [...pages, ...memos];
}
