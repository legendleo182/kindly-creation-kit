import { createFileRoute } from "@tanstack/react-router";
import { Music2, Trash2, ListMusic } from "lucide-react";
import { AppHeader, pickUrl, usePlayer } from "@/lib/player-context";
import { usePlaylist } from "@/lib/playlist-store";
import { TrackRow } from "./index";

export const Route = createFileRoute("/playlist")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Your Playlist — Dhun" },
      { name: "description", content: "Songs you saved for later." },
      { property: "og:title", content: "Your Playlist — Dhun" },
      { property: "og:description", content: "Songs you saved for later." },
    ],
  }),
  component: PlaylistPage,
});

function PlaylistPage() {
  const { current, playing, quality, play, toggle } = usePlayer();
  const playlist = usePlaylist();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader active="playlist" />

      <main className="max-w-4xl mx-auto px-4 pt-8 pb-40">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
              <ListMusic className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Your Playlist</h2>
              <p className="text-sm text-muted-foreground">
                {playlist.list.length}{" "}
                {playlist.list.length === 1 ? "song" : "songs"} saved
              </p>
            </div>
          </div>
          {playlist.list.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Clear entire playlist?")) playlist.clear();
              }}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
            >
              <Trash2 className="size-4" /> Clear all
            </button>
          )}
        </div>

        {playlist.list.length === 0 ? (
          <div className="mt-20 text-center text-muted-foreground">
            <Music2 className="size-10 mx-auto mb-3 opacity-50" />
            <p>Your playlist is empty.</p>
            <p className="text-sm mt-1">
              Tap the heart on any song to save it here.
            </p>
          </div>
        ) : (
          <ul className="grid gap-2">
            {playlist.list.map((t) => (
              <TrackRow
                key={t.seokey}
                track={t}
                queue={playlist.list}
                isCurrent={current?.seokey === t.seokey}
                playing={playing}
                onPlay={() => play(t, playlist.list)}
                onToggle={toggle}
                saved
                onToggleSave={() => playlist.remove(t.seokey)}
                disabled={!pickUrl(t, quality)}
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
