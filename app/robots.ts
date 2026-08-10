import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The agent endpoints cost model budget — keep crawlers out of them.
        disallow: ["/api/"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
