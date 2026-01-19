import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 3600;

const BASE_URL = "https://localassembly.org";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
  ];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If env isn't present during build, do NOT crash.
  if (!url || !anon) return staticRoutes;

  const supabase = createClient(url, anon);

  const { data, error } = await supabase
    .from("protests")
    .select("id,created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) return staticRoutes;

  const dynamicRoutes: MetadataRoute.Sitemap = (data ?? []).map((p: any) => ({
    url: `${BASE_URL}/protest/${p.id}`,
    lastModified: p.created_at ? new Date(p.created_at) : new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...dynamicRoutes];
}
