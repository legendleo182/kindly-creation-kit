import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Search, Play, Music2, Loader2, Heart, X } from "lucide-react";
import {
  searchSongs,
  suggestSongs,
  getTrack,
  type Track,
  type Suggestion,
} from "@/lib/gaana.functions";
import { AppHeader, pickUrl, usePlayer } from "@/lib/player-context";
import { usePlaylist } from "@/lib/playlist-store";

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

  const { current, playing, quality, play, toggle } = usePlayer();
  const playlist = usePlaylist();

  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
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

  async function playSuggestion(s: Suggestion) {
    setFocused(false);
    setActiveIdx(-1);
    setQuery(s.title);
    const t = await getTrackFn({ data: { seokey: s.seokey } });
    if (t) play(t);
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader active="search" />

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
            {results.map((t) => (
              <TrackRow
                key={t.seokey}
                track={t}
                queue={results}
                isCurrent={current?.seokey === t.seokey}
                playing={playing}
                onPlay={() => play(t, results)}
                onToggle={toggle}
                saved={playlist.has(t.seokey)}
                onToggleSave={() => playlist.toggle(t)}
                disabled={!pickUrl(t, quality)}
              />
            ))}
          </ul>
        )}

        {search.data && search.data.length === 0 && !search.isPending && (
          <p className="mt-10 text-center text-muted-foreground">No results found.</p>
        )}
      </main>
    </div>
  );
}

export function TrackRow({
  track,
  queue: _queue,
  isCurrent,
  playing,
  onPlay,
  onToggle,
  saved,
  onToggleSave,
  onRemove,
  disabled,
}: {
  track: Track;
  queue?: Track[];
  isCurrent: boolean;
  playing: boolean;
  onPlay: () => void;
  onToggle: () => void;
  saved: boolean;
  onToggleSave: () => void;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  return (
    <li
      className={`group flex items-center gap-4 p-3 rounded-xl border transition ${
        isCurrent ? "bg-accent border-primary/40" : "bg-card border-border hover:bg-accent/50"
      }`}
    >
      <img
        src={track.thumbnail.medium || track.thumbnail.small}
        alt={track.title}
        className="size-14 rounded-lg object-cover bg-muted"
        loading="lazy"
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{track.title}</p>
        <p className="text-sm text-muted-foreground truncate">
          {track.artists} • {track.album}
        </p>
      </div>
      <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
        {track.duration}
      </span>
      <button
        onClick={onToggleSave}
        className={`size-10 rounded-full grid place-items-center transition ${
          saved
            ? "text-primary bg-primary/10 hover:bg-primary/20"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
        aria-label={saved ? "Remove from playlist" : "Add to playlist"}
        title={saved ? "Remove from playlist" : "Add to playlist"}
      >
        <Heart className={`size-4 ${saved ? "fill-current" : ""}`} />
      </button>
      <button
        onClick={() => (isCurrent ? onToggle() : onPlay())}
        disabled={disabled}
        className="size-10 rounded-full bg-primary text-primary-foreground grid place-items-center hover:scale-105 disabled:opacity-40 transition"
        aria-label={isCurrent && playing ? "Pause" : "Play"}
      >
        {isCurrent && playing ? (
          <span className="block size-2.5 bg-primary-foreground rounded-sm" />
        ) : (
          <Play className="size-4 ml-0.5" />
        )}
      </button>
      {onRemove && (
        <button
          onClick={onRemove}
          className="size-10 rounded-full grid place-items-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
          aria-label="Remove from playlist"
          title="Remove from playlist"
        >
          <X className="size-4" />
        </button>
      )}
    </li>
  );
}
