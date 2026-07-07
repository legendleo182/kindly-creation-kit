import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Search, Play, Pause, Music2, Loader2 } from "lucide-react";
import { searchSongs, type Track } from "@/lib/gaana.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dhun — Search & Play Songs" },
      {
        name: "description",
        content:
          "Search any song and stream it instantly. A minimal music player built for fast discovery.",
      },
      { property: "og:title", content: "Dhun — Search & Play Songs" },
      {
        property: "og:description",
        content: "Search any song and stream it instantly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

type Quality = "very_high" | "high" | "medium" | "low";

function pickUrl(t: Track, quality: Quality): string | undefined {
  return t.music[quality] ?? t.music.high ?? t.music.medium ?? t.music.low;
}

function Home() {
  const searchFn = useServerFn(searchSongs);
  const [query, setQuery] = useState("");
  const [quality, setQuality] = useState<Quality>("high");
  const [current, setCurrent] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const search = useMutation({
    mutationFn: (q: string) => searchFn({ data: { query: q, limit: 15 } }),
  });

  const results = search.data ?? [];

  const currentUrl = useMemo(
    () => (current ? pickUrl(current, quality) : undefined),
    [current, quality],
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    search.mutate(query.trim());
  }

  function playTrack(t: Track) {
    const url = pickUrl(t, quality);
    if (!url) return;
    setCurrent(t);
    // Let the effect below set src via key change
    requestAnimationFrame(() => {
      const a = audioRef.current;
      if (!a) return;
      a.src = url;
      a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    });
  }

  function toggle() {
    const a = audioRef.current;
    if (!a || !current) return;
    if (a.paused) {
      a.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      a.pause();
      setPlaying(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 backdrop-blur sticky top-0 z-10 bg-background/80">
        <div className="max-w-4xl mx-auto px-4 py-5 flex items-center gap-3">
          <div className="size-9 rounded-xl bg-primary text-primary-foreground grid place-items-center">
            <Music2 className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Dhun</h1>
            <p className="text-xs text-muted-foreground">Search & play any song</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-8 pb-40">
        <form onSubmit={onSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search songs, artists, albums..."
              className="w-full h-12 pl-10 pr-4 rounded-xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-ring transition"
            />
          </div>
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as Quality)}
            className="h-12 px-3 rounded-xl bg-card border border-border text-sm"
            aria-label="Quality"
          >
            <option value="very_high">320 kbps</option>
            <option value="high">128 kbps</option>
            <option value="medium">64 kbps</option>
            <option value="low">16 kbps</option>
          </select>
          <button
            type="submit"
            disabled={search.isPending}
            className="h-12 px-5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-60 transition"
          >
            {search.isPending ? <Loader2 className="size-4 animate-spin" /> : "Search"}
          </button>
        </form>

        {search.isError && (
          <p className="mt-6 text-sm text-destructive">Something went wrong. Try again.</p>
        )}

        {!search.data && !search.isPending && (
          <div className="mt-20 text-center text-muted-foreground">
            <Music2 className="size-10 mx-auto mb-3 opacity-50" />
            <p>Type a song name above and hit Search.</p>
          </div>
        )}

        {search.isPending && (
          <div className="mt-10 grid gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-card animate-pulse" />
            ))}
          </div>
        )}

        {results.length > 0 && (
          <ul className="mt-8 grid gap-2">
            {results.map((t) => {
              const isCurrent = current?.seokey === t.seokey;
              return (
                <li
                  key={t.seokey}
                  className={`group flex items-center gap-4 p-3 rounded-xl border transition ${
                    isCurrent
                      ? "bg-accent border-primary/40"
                      : "bg-card border-border hover:bg-accent/50"
                  }`}
                >
                  <img
                    src={t.thumbnail.medium || t.thumbnail.small}
                    alt={t.title}
                    className="size-14 rounded-lg object-cover bg-muted"
                    loading="lazy"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{t.title}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {t.artists} • {t.album}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
                    {t.duration}
                  </span>
                  <button
                    onClick={() => (isCurrent ? toggle() : playTrack(t))}
                    disabled={!pickUrl(t, quality)}
                    className="size-10 rounded-full bg-primary text-primary-foreground grid place-items-center hover:scale-105 disabled:opacity-40 transition"
                    aria-label={isCurrent && playing ? "Pause" : "Play"}
                  >
                    {isCurrent && playing ? (
                      <Pause className="size-4" />
                    ) : (
                      <Play className="size-4 ml-0.5" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {search.data && search.data.length === 0 && !search.isPending && (
          <p className="mt-10 text-center text-muted-foreground">No results found.</p>
        )}
      </main>

      {current && (
        <div className="fixed bottom-0 inset-x-0 border-t border-border bg-card/95 backdrop-blur">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
            <img
              src={current.thumbnail.medium || current.thumbnail.small}
              alt={current.title}
              className="size-12 rounded-lg object-cover bg-muted"
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate text-sm">{current.title}</p>
              <p className="text-xs text-muted-foreground truncate">{current.artists}</p>
            </div>
            <button
              onClick={toggle}
              className="size-11 rounded-full bg-primary text-primary-foreground grid place-items-center"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="size-5" /> : <Play className="size-5 ml-0.5" />}
            </button>
            <audio
              ref={audioRef}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              controls
              className="hidden md:block w-72"
            />
          </div>
        </div>
      )}
    </div>
  );
}
