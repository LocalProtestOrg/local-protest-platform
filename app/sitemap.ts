import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";

const SITE_URL = "https://www.localassembly.org";

// Google supports up to 50,000 URLs per sitemap file.
const MAX_URLS = 50000;

// Tune this if you expect huge volumes.
const PAGE_SIZE = 1000;

type ProtestRow = {
  id: string;
  updated_at?: string | null;
  created_at?: string | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Static routes you want indexed
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/events`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/know-your-rights`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/email-your-congressperson`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    // Keep these out of the sitemap if they are noindex:
    // { url: `${SITE_URL}/create`, lastModified: now },
    // { url: `${SITE_URL}/login`, lastModified: now },
  ];

  try {
    const all: ProtestRow[] = [];
    let from = 0;

    while (all.length < MAX_URLS) {
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from("protests")
        .select("id,updated_at,created_at")
        .eq("status", "active")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const rows = (data ?? []) as ProtestRow[];
      if (rows.length === 0) break;

      all.push(...rows);

      // If we got less than a full page, we are done.
      if (rows.length < PAGE_SIZE) break;

      from += PAGE_SIZE;
    }

    // Cap to MAX_URLS in case the last page pushed us over.
    const capped = all.slice(0, MAX_URLS);

    const listingEntries: MetadataRoute.Sitemap = capped.map((p) => {
      const lastValue = p.updated_at ?? p.created_at;
      const last = lastValue ? new Date(lastValue) : now;

      return {
        url: `${SITE_URL}/protest/${p.id}`,
        lastModified: last,
        changeFrequency: "daily",
        priority: 0.7,
      };
    });

    return [...staticEntries, ...listingEntries];
  } catch {
    // If Supabase fails for any reason, still serve a valid sitemap
    return staticEntries;
  }
}
