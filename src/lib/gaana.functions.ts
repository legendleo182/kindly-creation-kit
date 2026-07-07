import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createDecipheriv } from "crypto";

const KEY = Buffer.from("gy1t#b@jl(b$wtme", "utf8");

const SEARCH_URL =
  "https://gaana.com/apiv2?country=IN&page=0&secType=track&type=search&keyword=";
const DETAIL_URL = "https://gaana.com/apiv2?type=songDetail&seokey=";

function decrypt(data: string): string {
  const offset = parseInt(data[0], 10);
  const iv = Buffer.from(data.slice(offset, offset + 16), "utf8");
  const ct = Buffer.from(data.slice(offset + 16), "base64");
  const decipher = createDecipheriv("aes-128-cbc", KEY, iv);
  decipher.setAutoPadding(true);
  const out = Buffer.concat([decipher.update(ct), decipher.final()]);
  return out.toString("utf8");
}

function formatDuration(seconds: string | number): string {
  const s = typeof seconds === "number" ? seconds : parseInt(seconds, 10);
  if (!Number.isFinite(s)) return "0:00";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export type Track = {
  seokey: string;
  title: string;
  album: string;
  artists: string;
  duration: string;
  language: string;
  music: {
    very_high?: string;
    high?: string;
    medium?: string;
    low?: string;
  };
  thumbnail: { large: string; medium: string; small: string };
};

async function fetchTrack(seokey: string): Promise<Track | null> {
  const res = await fetch(DETAIL_URL + encodeURIComponent(seokey), {
    method: "POST",
  });
  if (!res.ok) return null;
  const json: any = await res.json();
  const t = json?.tracks?.[0];
  if (!t) return null;

  const artists = Array.isArray(t.artist)
    ? t.artist.map((a: any) => a.name).join(", ")
    : "";

  let music: Track["music"] = {};
  try {
    const msg = t?.urls?.medium?.message;
    if (msg) {
      const base = decrypt(msg);
      music = {
        very_high: base.replace("64.mp4", "320.mp4"),
        high: base.replace("64.mp4", "128.mp4"),
        medium: base,
        low: base.replace("64.mp4", "16.mp4"),
      };
    }
  } catch {
    music = {};
  }

  return {
    seokey,
    title: t.track_title,
    album: t.album_title,
    artists,
    duration: formatDuration(t.duration),
    language: t.language,
    music,
    thumbnail: {
      large: String(t.artwork_large ?? "").trim(),
      medium: String(t.artwork_web ?? "").trim(),
      small: String(t.artwork ?? "").trim(),
    },
  };
}

export const searchSongs = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string; limit?: number }) =>
    z
      .object({ query: z.string().trim().min(1), limit: z.number().int().positive().max(30).optional() })
      .parse(input),
  )
  .handler(async ({ data }): Promise<Track[]> => {
    const limit = data.limit ?? 12;
    const res = await fetch(SEARCH_URL + encodeURIComponent(data.query), {
      method: "POST",
    });
    if (!res.ok) return [];
    const json: any = await res.json();
    let ids: string[] = [];
    try {
      ids = json.gr[0].gd.slice(0, limit).map((t: any) => t.seo);
    } catch {
      return [];
    }
    const results = await Promise.all(ids.map((id) => fetchTrack(id)));
    return results.filter((t): t is Track => t !== null);
  });

export type Suggestion = {
  seokey: string;
  title: string;
  subtitle: string;
  thumbnail: string;
};

export const suggestSongs = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string }) =>
    z.object({ query: z.string().trim().min(1) }).parse(input),
  )
  .handler(async ({ data }): Promise<Suggestion[]> => {
    const res = await fetch(SEARCH_URL + encodeURIComponent(data.query), {
      method: "POST",
    });
    if (!res.ok) return [];
    const json: any = await res.json();
    try {
      const gd = json.gr[0].gd.slice(0, 6);
      return gd.map((t: any) => {
        const artists = Array.isArray(t.artist)
          ? t.artist.map((a: any) => (typeof a === "string" ? a : a?.name)).filter(Boolean).join(", ")
          : typeof t.artist === "string"
            ? t.artist
            : "";
        return {
          seokey: t.seo,
          title: String(t.title ?? t.track_title ?? "").trim(),
          subtitle: artists || String(t.album_title ?? t.albumtitle ?? "").trim(),
          thumbnail: String(t.artwork ?? t.artwork_web ?? "").trim(),
        };
      });
    } catch {
      return [];
    }
  });
