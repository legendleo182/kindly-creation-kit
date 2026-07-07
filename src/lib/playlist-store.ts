import { useCallback, useEffect, useState } from "react";
import type { Track } from "@/lib/gaana.functions";

const KEY = "dhun:playlist:v1";
const EVENT = "dhun:playlist:changed";

function read(): Track[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Track[]) : [];
  } catch {
    return [];
  }
}

function write(list: Track[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore */
  }
}

export function usePlaylist() {
  const [list, setList] = useState<Track[]>([]);

  useEffect(() => {
    setList(read());
    const onChange = () => setList(read());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const has = useCallback(
    (seokey: string) => list.some((t) => t.seokey === seokey),
    [list],
  );

  const add = useCallback((t: Track) => {
    const current = read();
    if (current.some((x) => x.seokey === t.seokey)) return;
    write([t, ...current]);
  }, []);

  const remove = useCallback((seokey: string) => {
    write(read().filter((t) => t.seokey !== seokey));
  }, []);

  const toggle = useCallback(
    (t: Track) => {
      if (has(t.seokey)) remove(t.seokey);
      else add(t);
    },
    [has, add, remove],
  );

  const clear = useCallback(() => write([]), []);

  return { list, has, add, remove, toggle, clear };
}
