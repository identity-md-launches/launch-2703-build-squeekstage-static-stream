import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useFeed } from "./data";
import { useSettings } from "./settings";
import { fetchTips, rpc, type Tip } from "./rpc";
import { validRecipient } from "./format";

interface TipFeed {
  tips: Tip[];
  fresh: Tip[];
  loading: boolean;
  error: string;
  head?: number;
  retry: () => void;
}
const Context = createContext<TipFeed>({
  tips: [],
  fresh: [],
  loading: false,
  error: "",
  retry: () => {},
});
export function TipsProvider({ children }: { children: ReactNode }) {
  const { economy } = useFeed();
  const { settings } = useSettings();
  const [tips, setTips] = useState<Tip[]>([]);
  const [fresh, setFresh] = useState<Tip[]>([]);
  const [head, setHead] = useState<number>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setTips([]);
    setFresh([]);
    setHead(undefined);
    setError("");
    if (!economy || settings.demo || !validRecipient(settings.streamer)) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    let running = false;
    let lastHead: number | undefined;
    let previous: Tip[] = [];
    const seen = new Set<string>();
    async function poll() {
      if (running) return;
      running = true;
      if (lastHead === undefined) setLoading(true);
      try {
        const latest = Number(BigInt(await rpc<string>("eth_blockNumber")));
        const start =
          lastHead === undefined
            ? Math.max(0, latest - 5999)
            : Math.max(latest - 5999, Math.min(lastHead - 12, latest - 12), 0);
        const logs = await fetchTips(
          economy!.asset.address,
          settings.streamer,
          start,
          latest,
        );
        if (cancelled) return;
        const incoming =
          lastHead === undefined ? [] : logs.filter((tip) => !seen.has(tip.id));
        logs.forEach((tip) => seen.add(tip.id));
        previous = [
          ...previous.filter(
            (tip) => tip.block >= latest - 5999 && tip.block < start,
          ),
          ...logs,
        ].sort((a, b) => b.block - a.block);
        setTips(previous);
        setFresh(incoming);
        setHead(latest);
        setError("");
        lastHead = latest;
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        running = false;
        if (!cancelled) setLoading(false);
      }
    }
    void poll();
    const timer = setInterval(poll, 7000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [economy?.asset.address, settings.streamer, settings.demo, attempt]);
  return (
    <Context
      value={{
        tips,
        fresh,
        loading,
        error,
        head,
        retry: () => setAttempt((n) => n + 1),
      }}
    >
      {children}
    </Context>
  );
}
export const useTips = () => useContext(Context);
