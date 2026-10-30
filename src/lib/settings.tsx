import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { accentIsReadable } from "./format";

export interface Settings {
  streamer: string;
  accent: string;
  threshold: string;
  sound: boolean;
  demo: boolean;
}
export const defaults: Settings = {
  streamer: "",
  accent: "#f2c230",
  threshold: "1",
  sound: false,
  demo: false,
};
const key = "squeekstage:settings:v1";
export function readSettings(): Settings {
  let saved: Partial<Settings> = {};
  try {
    saved = JSON.parse(localStorage.getItem(key) ?? "{}");
  } catch {
    /* Storage may be unavailable. */
  }
  const query = new URLSearchParams(location.search);
  const hashQuery = new URLSearchParams(location.hash.split("?")[1] ?? "");
  hashQuery.forEach((v, k) => query.set(k, v));
  const setting = (name: string) => query.get(name);
  const accent = setting("accent") ?? saved.accent ?? defaults.accent;
  const threshold =
    setting("threshold") ?? saved.threshold ?? defaults.threshold;
  return {
    streamer: setting("streamer") ?? saved.streamer ?? "",
    accent: accentIsReadable(accent) ? accent : defaults.accent,
    threshold:
      /^\d+(\.\d{1,18})?$/.test(threshold) && Number.isFinite(Number(threshold))
        ? threshold
        : defaults.threshold,
    sound: query.has("sound") ? setting("sound") === "1" : Boolean(saved.sound),
    demo: query.has("demo") ? setting("demo") === "1" : Boolean(saved.demo),
  };
}
export function siteUrl(route: string, settings: Settings, obs = false) {
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  const q = new URLSearchParams({
    streamer: settings.streamer,
    accent: settings.accent,
    threshold: settings.threshold,
    sound: settings.sound ? "1" : "0",
    demo: settings.demo ? "1" : "0",
  });
  if (!settings.streamer) q.delete("streamer");
  if (obs) q.set("obs", "1");
  url.search = q.toString();
  url.hash = `/${route}`;
  return url.toString();
}
const SettingsContext = createContext<{
  settings: Settings;
  setSettings: (value: Settings) => void;
}>({ settings: defaults, setSettings: () => {} });
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(readSettings);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(settings));
    } catch {
      /* URL settings still work. */
    }
    document.documentElement.style.setProperty("--accent", settings.accent);
  }, [settings]);
  return (
    <SettingsContext value={{ settings, setSettings }}>
      {children}
    </SettingsContext>
  );
}
export const useSettings = () => useContext(SettingsContext);
