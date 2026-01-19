import type { MetadataRoute } from "next";

const BASE_URL = "https://localassembly.org";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          // Add other private paths if you ever create them:
          // "/api",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
