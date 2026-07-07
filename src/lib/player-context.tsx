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
import {
  Play,
  Pause,
  Music2,
  SkipBack,
  SkipForward,
  Heart,
  Volume2,
  VolumeX,
  Volume1,
} from "lucide-react";
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
const VOLUME_KEY = "dhun:volume";

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
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volOpen, setVolOpen] = useState(false);

  // Load persisted volume
  useEffect(() => {
    try {
      const v = localStorage.getItem(VOLUME_KEY);
      if (v !== null) {
        const n = Number(v);
        if (!Number.isNaN(n)) setVolume(Math.max(0, Math.min(1, n)));
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Sync volume/mute to audio element
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = volume;
    a.muted = muted;
    try {
      localStorage.setItem(VOLUME_KEY, String(volume));
    } catch {
      /* ignore */
    }
  }, [volume, muted, audioRef, current]);

  function onTimeUpdate() {
    const a = audioRef.current;
    if (!a) return;
    setProgress(a.currentTime);
    if (a.duration && !Number.isNaN(a.duration)) setDuration(a.duration);
  }

  function onLoadedMeta() {
    const a = audioRef.current;
    if (a && a.duration) setDuration(a.duration);
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const a = audioRef.current;
    if (!a) return;
    const v = Number(e.target.value);
    a.currentTime = v;
    setProgress(v);
  }

  function fmt(sec: number) {
    if (!sec || Number.isNaN(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      className={`fixed bottom-0 inset-x-0 border-t border-border bg-card/95 backdrop-blur z-20 transition-transform ${
        current ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="max-w-4xl mx-auto px-3 sm:px-4 pt-2 pb-3">
        {current ? (
          <>
            {/* Progress bar */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] sm:text-xs text-muted-foreground tabular-nums w-9 text-right shrink-0">
                {fmt(progress)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={progress}
                onChange={seek}
                className="flex-1 accent-primary h-1 cursor-pointer"
                aria-label="Seek"
              />
              <span className="text-[10px] sm:text-xs text-muted-foreground tabular-nums w-9 shrink-0">
                {fmt(duration)}
              </span>
            </div>

            {/* Main controls row */}
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
              <img
                src={current.thumbnail.medium || current.thumbnail.small}
                alt={current.title}
                className="size-11 sm:size-12 rounded-lg object-cover bg-muted shrink-0"
              />
              <div className="min-w-0">
                <p className="font-medium truncate text-sm">{current.title}</p>
                <p className="text-xs text-muted-foreground truncate">{current.artists}</p>
              </div>
              <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                <SaveButton track={current} />

                {/* Volume — inline slider on md+, popover on mobile */}
                <div className="relative">
                  <button
                    onClick={() => {
                      if (window.matchMedia("(min-width: 768px)").matches) {
                        setMuted((m) => !m);
                      } else {
                        setVolOpen((o) => !o);
                      }
                    }}
                    className="size-10 sm:size-9 rounded-full grid place-items-center hover:bg-accent transition text-muted-foreground hover:text-foreground"
                    aria-label={muted ? "Unmute" : "Mute"}
                  >
                    <VolumeIcon className="size-5 sm:size-4" />
                  </button>
                  {volOpen && (
                    <div className="md:hidden absolute bottom-full right-0 mb-2 p-3 rounded-xl bg-popover border border-border shadow-lg flex items-center gap-2 w-48">
                      <button
                        onClick={() => setMuted((m) => !m)}
                        className="shrink-0 text-muted-foreground"
                        aria-label={muted ? "Unmute" : "Mute"}
                      >
                        <VolumeIcon className="size-4" />
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={muted ? 0 : volume}
                        onChange={(e) => {
                          setMuted(false);
                          setVolume(Number(e.target.value));
                        }}
                        className="flex-1 accent-primary"
                        aria-label="Volume"
                      />
                    </div>
                  )}
                </div>

                <button
                  onClick={onPrev}
                  disabled={!hasQueue}
                  className="size-10 sm:size-9 rounded-full grid place-items-center hover:bg-accent disabled:opacity-30 transition"
                  aria-label="Previous"
                >
                  <SkipBack className="size-5 sm:size-4" />
                </button>
                <button
                  onClick={onToggle}
                  className="size-12 sm:size-11 rounded-full bg-primary text-primary-foreground grid place-items-center hover:scale-105 active:scale-95 transition shadow-md"
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? (
                    <Pause className="size-5" />
                  ) : (
                    <Play className="size-5 ml-0.5" />
                  )}
                </button>
                <button
                  onClick={onNext}
                  disabled={!hasQueue}
                  className="size-10 sm:size-9 rounded-full grid place-items-center hover:bg-accent disabled:opacity-30 transition"
                  aria-label="Next"
                >
                  <SkipForward className="size-5 sm:size-4" />
                </button>

                {/* Desktop volume slider */}
                <div className="hidden md:flex items-center gap-2 ml-2 w-28">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={muted ? 0 : volume}
                    onChange={(e) => {
                      setMuted(false);
                      setVolume(Number(e.target.value));
                    }}
                    className="flex-1 accent-primary"
                    aria-label="Volume"
                  />
                </div>
              </div>
            </div>

            <audio
              ref={audioRef}
              onPlay={onPlay}
              onPause={onPause}
              onEnded={onEnded}
              onTimeUpdate={onTimeUpdate}
              onLoadedMetadata={onLoadedMeta}
              className="hidden"
            />
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
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
      className={`size-10 sm:size-9 rounded-full grid place-items-center transition ${
        saved
          ? "text-primary bg-primary/10 hover:bg-primary/20"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
      aria-label={saved ? "Remove from playlist" : "Add to playlist"}
      title={saved ? "Remove from playlist" : "Add to playlist"}
    >
      <Heart className={`size-5 sm:size-4 ${saved ? "fill-current" : ""}`} />
    </button>
  );
}

/* ---------------- Nav header used across routes ---------------- */

export function AppHeader({ active }: { active: "search" | "playlist" }) {
  return (
    <header className="border-b border-border/60 backdrop-blur sticky top-0 z-30 bg-background/80">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <div className="size-10 sm:size-12 rounded-xl overflow-hidden bg-white grid place-items-center shrink-0">
            <img src={noxtuneLogo.url} alt="Noxtune" className="size-full object-contain" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold leading-tight truncate">Noxtune</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Feel the music</p>
          </div>
        </Link>
        <nav className="flex items-center gap-1 text-sm shrink-0">
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
