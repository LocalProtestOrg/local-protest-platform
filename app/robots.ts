import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/login",
          "/create",
          "/account",
        ],
      },
    ],
    sitemap: "https://localassembly.org/sitemap.xml",
    host: "https://localassembly.org",
  };
}