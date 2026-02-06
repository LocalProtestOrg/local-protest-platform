import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fetchWithTimeout(url: string, ms: number, init?: RequestInit) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

export async function GET(req: Request) {
  const urlObj = new URL(req.url);
  const target = (urlObj.searchParams.get("url") || "").trim();

  if (!target) {
    return NextResponse.json({ ok: false, error: "Missing ?url=" }, { status: 400 });
  }

  if (!/^https?:\/\//i.test(target)) {
    return NextResponse.json({ ok: false, error: "Invalid url" }, { status: 400 });
  }

  let res: Response;

  try {
    res = await fetchWithTimeout(target, 20000, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
        Accept: "text/calendar, text/plain;q=0.9, */*;q=0.8",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: `fetch failed (network): ${e?.name === "AbortError" ? "timeout" : e?.message || String(e)}` },
      { status: 502 }
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return NextResponse.json(
      {
        ok: false,
        error: `upstream http ${res.status}`,
        contentType: res.headers.get("content-type") || "",
        preview: body.slice(0, 200),
      },
      { status: 502 }
    );
  }

  const text = await res.text();
  const contentType = res.headers.get("content-type") || "text/calendar; charset=utf-8";

  // Return the raw ICS so other systems can fetch it
  return new NextResponse(text, {
    status: 200,
    headers: {
      "content-type": contentType.includes("text/calendar") ? contentType : "text/calendar; charset=utf-8",
      // small cache helps stability if upstream is flaky
      "cache-control": "s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
