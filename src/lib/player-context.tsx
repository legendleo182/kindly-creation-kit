import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "@tanstack/react-router";
import { Play, Pause, Music2, SkipBack, SkipForward, Heart } from "lucide-react";
import type { Track } from "@/lib/gaana.functions";
import { usePlaylist } from "@/lib/playlist-store";
import noxtuneLogo from "@/assets/noxtune-logo.png.asset.json";

export type Quality = "very_high" | "high" | "medium" | "low";

export function pickUrl(t: Track, quality: Quality): string | undefined {
  return t.music[quality] ?? t.music.high ?? t.music.medium ?? t.music.low;
}

type PlayerCtx = {
  current: Track | null;
  playing: boolean;
  quality: Quality;
  queue: Track[];
  setQuality: (q: Quality) => void;
  play: (track: Track, queue?: Track[]) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
};

const Ctx = createContext<PlayerCtx | null>(null);

export function usePlayer() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePlayer must be used inside PlayerProvider");
  return c;
}

const QUALITY_KEY = "dhun:quality";

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [playing, setPlaying] = useState(false);
  const [quality, setQualityState] = useState<Quality>("high");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    try {
      const q = localStorage.getItem(QUALITY_KEY) as Quality | null;
      if (q) setQualityState(q);
    } catch {
      /* ignore */
    }
  }, []);

  const setQuality = useCallback((q: Quality) => {
    setQualityState(q);
    try {
      localStorage.setItem(QUALITY_KEY, q);
    } catch {
      /* ignore */
    }
  }, []);

  const play = useCallback(
    (track: Track, q?: Track[]) => {
      const url = pickUrl(track, quality);
      if (!url) return;
      setCurrent(track);
      if (q && q.length) setQueue(q);
      requestAnimationFrame(() => {
        const a = audioRef.current;
        if (!a) return;
        a.src = url;
        a.play()
          .then(() => setPlaying(true))
          .catch(() => setPlaying(false));
      });
    },
    [quality],
  );

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a || !current) return;
    if (a.paused) {
      a.play()
        .then(() => setPlaying(true))
        .catch(() => {});
    } else {
      a.pause();
      setPlaying(false);
    }
  }, [current]);

  const goRelative = useCallback(
    (delta: number) => {
      if (!current || queue.length === 0) return;
      const idx = queue.findIndex((t) => t.seokey === current.seokey);
      if (idx === -1) return;
      const nextIdx = (idx + delta + queue.length) % queue.length;
      play(queue[nextIdx], queue);
    },
    [current, queue, play],
  );

  const next = useCallback(() => goRelative(1), [goRelative]);
  const prev = useCallback(() => goRelative(-1), [goRelative]);

  const value = useMemo<PlayerCtx>(
    () => ({ current, playing, quality, queue, setQuality, play, toggle, next, prev }),
    [current, playing, quality, queue, setQuality, play, toggle, next, prev],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <PlayerBar
        current={current}
        playing={playing}
        onToggle={toggle}
        onNext={next}
        onPrev={prev}
        hasQueue={queue.length > 1}
        audioRef={audioRef}
        onEnded={next}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
    </Ctx.Provider>
  );
}

function PlayerBar({
  current,
  playing,
  onToggle,
  onNext,
  onPrev,
  hasQueue,
  audioRef,
  onEnded,
  onPlay,
  onPause,
}: {
  current: Track | null;
  playing: boolean;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  hasQueue: boolean;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  onEnded: () => void;
  onPlay: () => void;
  onPause: () => void;
}) {
  return (
    <div
      className={`fixed bottom-0 inset-x-0 border-t border-border bg-card/95 backdrop-blur z-20 transition-transform ${
        current ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
        {current ? (
          <>
            <img
              src={current.thumbnail.medium || current.thumbnail.small}
              alt={current.title}
              className="size-12 rounded-lg object-cover bg-muted"
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate text-sm">{current.title}</p>
              <p className="text-xs text-muted-foreground truncate">{current.artists}</p>
            </div>
            <SaveButton track={current} />
            <div className="flex items-center gap-1">
              <button
                onClick={onPrev}
                disabled={!hasQueue}
                className="size-9 rounded-full grid place-items-center hover:bg-accent disabled:opacity-30 transition"
                aria-label="Previous"
              >
                <SkipBack className="size-4" />
              </button>
              <button
                onClick={onToggle}
                className="size-11 rounded-full bg-primary text-primary-foreground grid place-items-center hover:scale-105 transition"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause className="size-5" /> : <Play className="size-5 ml-0.5" />}
              </button>
              <button
                onClick={onNext}
                disabled={!hasQueue}
                className="size-9 rounded-full grid place-items-center hover:bg-accent disabled:opacity-30 transition"
                aria-label="Next"
              >
                <SkipForward className="size-4" />
              </button>
            </div>
            <audio
              ref={audioRef}
              onPlay={onPlay}
              onPause={onPause}
              onEnded={onEnded}
              controls
              className="hidden md:block w-64"
            />
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Music2 className="size-4" /> Nothing playing
          </div>
        )}
      </div>
    </div>
  );
}

function SaveButton({ track }: { track: Track }) {
  const playlist = usePlaylist();
  const saved = playlist.has(track.seokey);
  return (
    <button
      onClick={() => playlist.toggle(track)}
      className={`size-9 rounded-full grid place-items-center transition ${
        saved
          ? "text-primary bg-primary/10 hover:bg-primary/20"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
      aria-label={saved ? "Remove from playlist" : "Add to playlist"}
      title={saved ? "Remove from playlist" : "Add to playlist"}
    >
      <Heart className={`size-4 ${saved ? "fill-current" : ""}`} />
    </button>
  );
}

/* ---------------- Nav header used across routes ---------------- */

export function AppHeader({ active }: { active: "search" | "playlist" }) {
  return (
    <header className="border-b border-border/60 backdrop-blur sticky top-0 z-30 bg-background/80">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-9 rounded-xl overflow-hidden bg-black grid place-items-center">
            <img src={noxtuneLogo.url} alt="Noxtune" className="size-full object-cover" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Noxtune</h1>
            <p className="text-xs text-muted-foreground">Feel the music</p>
          </div>
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          <Link
            to="/"
            className={`px-3 py-1.5 rounded-lg transition ${
              active === "search"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Search
          </Link>
          <Link
            to="/playlist"
            className={`px-3 py-1.5 rounded-lg transition ${
              active === "playlist"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Playlist
          </Link>
        </nav>
      </div>
    </header>
  );
}
