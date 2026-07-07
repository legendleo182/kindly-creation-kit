import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Search, Play, Pause, Music2, Loader2 } from "lucide-react";
import {
  searchSongs,
  suggestSongs,
  getTrack,
  type Track,
  type Suggestion,
} from "@/lib/gaana.functions";

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

function useDebounced<T>(value: T, delay = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

function Home() {
  const searchFn = useServerFn(searchSongs);
  const suggestFn = useServerFn(suggestSongs);
  const getTrackFn = useServerFn(getTrack);

  const [query, setQuery] = useState("");
  const [quality, setQuality] = useState<Quality>("high");
  const [current, setCurrent] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const debounced = useDebounced(query, 220);

  const search = useMutation({
    mutationFn: (q: string) => searchFn({ data: { query: q, limit: 15 } }),
  });

  const suggestions = useQuery({
    queryKey: ["suggest", debounced],
    queryFn: () => suggestFn({ data: { query: debounced } }),
    enabled: focused && debounced.trim().length >= 2,
    staleTime: 60_000,
  });

  const sugList: Suggestion[] = suggestions.data ?? [];
  const showDropdown = focused && debounced.trim().length >= 2 && sugList.length > 0;

  const results = search.data ?? [];

  // Close dropdown on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setFocused(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setFocused(false);
    setActiveIdx(-1);
    search.mutate(query.trim());
  }

  function playTrack(t: Track) {
    const url = pickUrl(t, quality);
    if (!url) return;
    setCurrent(t);
    requestAnimationFrame(() => {
      const a = audioRef.current;
      if (!a) return;
      a.src = url;
      a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    });
  }

  async function playSuggestion(s: Suggestion) {
    setFocused(false);
    setActiveIdx(-1);
    setQuery(s.title);
    const t = await getTrackFn({ data: { seokey: s.seokey } });
    if (t) playTrack(t);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, sugList.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      playSuggestion(sugList[activeIdx]);
    } else if (e.key === "Escape") {
      setFocused(false);
    }
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
      <header className="border-b border-border/60 backdrop-blur sticky top-0 z-20 bg-background/80">
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
          <div ref={wrapRef} className="flex-1 relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIdx(-1);
                setFocused(true);
              }}
              onFocus={() => setFocused(true)}
              onKeyDown={onKeyDown}
              placeholder="Search songs, artists, albums..."
              className="w-full h-12 pl-10 pr-4 rounded-xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-ring transition"
              autoComplete="off"
            />
            {suggestions.isFetching && focused && debounced.trim().length >= 2 && (
              <Loader2 className="size-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
            )}

            {showDropdown && (
              <ul className="absolute z-30 left-0 right-0 mt-2 rounded-xl bg-popover border border-border shadow-lg overflow-hidden">
                {sugList.map((s, i) => (
                  <li key={s.seokey}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => playSuggestion(s)}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition ${
                        i === activeIdx ? "bg-accent" : "hover:bg-accent/60"
                      }`}
                    >
                      {s.thumbnail ? (
                        <img
                          src={s.thumbnail}
                          alt=""
                          className="size-9 rounded-md object-cover bg-muted"
                          loading="lazy"
                        />
                      ) : (
                        <div className="size-9 rounded-md bg-muted grid place-items-center">
                          <Music2 className="size-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{s.title}</p>
                        {s.subtitle && (
                          <p className="text-xs text-muted-foreground truncate">{s.subtitle}</p>
                        )}
                      </div>
                      <Play className="size-4 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
            <p>Type a song name — suggestions appear as you type.</p>
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
        <div className="fixed bottom-0 inset-x-0 border-t border-border bg-card/95 backdrop-blur z-20">
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
