import { kv } from "@vercel/kv";

const API_KEY = process.env.YOUTUBE_API_KEY;
const CACHE_TTL_SECONDS = 60 * 60 * 24; // 1 day — search.list costs quota, so reuse results.

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!API_KEY) {
    res.status(500).json({ error: "Server is missing YOUTUBE_API_KEY. Set it in the project's environment variables." });
    return;
  }

  const topic = String(req.query.q || "").trim();
  if (!topic) {
    res.status(400).json({ error: "Missing search query." });
    return;
  }
  // Bias toward actual courses/tutorials rather than any video that
  // mentions the topic — full-course content tends to run long, so filter
  // out short clips too.
  const q = `${topic} full course`;

  // Caching is an optimization, not a hard dependency — if the KV store
  // isn't reachable (e.g. not provisioned yet), fall through to a live
  // search instead of crashing the whole request.
  const cacheKey = `yt:${q.toLowerCase()}`;
  try {
    const cached = await kv.get(cacheKey);
    if (cached) {
      res.status(200).json({ items: cached, cached: true });
      return;
    }
  } catch (err) {
    console.error("YouTube cache read failed, continuing without cache:", err);
  }

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("maxResults", "6");
    url.searchParams.set("safeSearch", "strict");
    url.searchParams.set("relevanceLanguage", "en");
    url.searchParams.set("videoDuration", "long");
    url.searchParams.set("q", q);
    url.searchParams.set("key", API_KEY);

    const ytRes = await fetch(url);
    const data = await ytRes.json();

    if (!ytRes.ok) {
      console.error("YouTube search error:", JSON.stringify(data));
      res.status(502).json({ error: data?.error?.message || "YouTube declined the search." });
      return;
    }

    const items = (data.items || [])
      .filter((item) => item.id?.videoId)
      .map((item) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || "",
      }));

    try {
      await kv.set(cacheKey, items, { ex: CACHE_TTL_SECONDS });
    } catch (err) {
      console.error("YouTube cache write failed, returning results uncached:", err);
    }
    res.status(200).json({ items, cached: false });
  } catch (err) {
    console.error("YouTube search network error:", err);
    res.status(500).json({ error: "Couldn't reach YouTube. Try again in a moment." });
  }
}
