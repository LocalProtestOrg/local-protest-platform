import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";

export const revalidate = 3600; // rebuild sitemap at most once per hour

const BASE_URL = "https://localassembly.org";

type ProtestRow = {
  id: string;
  updated_at?: string | null;
  created_at?: string | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/email-your-congressperson`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/create`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.2,
    },
    // Optional: usually NO for SEO (admin pages shouldn’t be indexed)
    // If you want it excluded, leave it out here and we’ll block it in robots.ts
    // {
    //   url: `${BASE_URL}/admin`,
    //   lastModified: new Date(),
    //   changeFrequency: "weekly",
    //   priority: 0.1,
    // },
  ];

  // Dynamic event routes
  const { data, error } = await supabase
    .from("protests")
    .select("id,created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    // Fallback to static routes if DB fails (don’t crash build)
    return staticRoutes;
  }

  const dynamicRoutes: MetadataRoute.Sitemap = (data ?? []).map((p: ProtestRow) => ({
    url: `${BASE_URL}/protest/${p.id}`,
    lastModified: p.created_at ? new Date(p.created_at) : new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...dynamicRoutes];
}
