import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { isAddress } from "viem";
import { useSettings } from "./settings";

export interface Core {
  blockHeight: string;
  blockProgress: string;
  settledThroughRound: string;
  blockUnitsPerBlock: string;
  genesisTimestamp: number;
  roundDuration: number;
}
export interface Economy {
  asset: { address: `0x${string}`; symbol: string; decimals: number };
  totalStaked: string;
  liveSupply: string;
  currentRound: string;
}
export interface Stats {
  observedDistanceMm: string;
  acceptedWorkUnits: string;
  settlementCount: string;
  activeDayCount: number;
}
export interface ChainEvent {
  id: string;
  type: string;
  occurredAt: string;
  hash?: string;
  round?: string;
  amount?: string;
  account?: string;
}
export interface Feed {
  core?: Core;
  economy?: Economy;
  stats?: Stats;
  events?: ChainEvent[];
  freshness?: string;
  receivedAt?: number;
  failures: string[];
  status: "loading" | "live" | "stale" | "offline" | "demo";
  now: number;
  retry: () => void;
}
type Json = Record<string, any>;
export const API = "https://api.squeekchain.com/v1/";
export const ENDPOINTS = {
  core: "core",
  economy: "economy/state",
  events: "events?category=all&limit=24",
  stats: "measurement/stats?range=7d",
  freshness: "status",
} as const;
const cachePrefix = "squeekstage:api:v2:";
const memory = new Map<string, { at: number; data: Json }>();
export async function fetchCached(path: string, force = false): Promise<Json> {
  let entry = memory.get(path);
  if (!entry) {
    try {
      entry =
        JSON.parse(localStorage.getItem(cachePrefix + path) ?? "null") ??
        undefined;
    } catch {
      /* Optional cache. */
    }
  }
  if (!force && entry && Date.now() - entry.at < 5000) return entry.data;
  const response = await fetch(API + path, {
    signal: AbortSignal.timeout(6500),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = (await response.json()) as Json;
  if (data.status === "unavailable" || data.status === "error")
    throw new Error("Source unavailable");
  normalize(path, data); // Reject malformed responses before replacing a useful snapshot.
  entry = { at: Date.now(), data };
  memory.set(path, entry);
  try {
    localStorage.setItem(cachePrefix + path, JSON.stringify(entry));
  } catch {
    /* In-memory cache remains. */
  }
  return data;
}
const integer = (x: unknown): string => {
  if (!/^[0-9]+$/.test(String(x))) throw new Error("Invalid numeric data");
  return String(x);
};
export function normalize(path: string, data: Json): Partial<Feed> {
  if (path === ENDPOINTS.core) {
    if (data.chain?.chainId && String(data.chain.chainId) !== "11155111")
      throw new Error("Unexpected chain");
    const c = data.core ?? data;
    return {
      core: {
        blockHeight: integer(c.blockHeight),
        blockProgress: integer(c.blockProgress),
        settledThroughRound: integer(c.settledThroughRound),
        blockUnitsPerBlock: integer(
          data.configuration?.blockUnitsPerBlock ?? data.blockUnitsPerBlock,
        ),
        genesisTimestamp: Number(data.configuration?.genesisTimestamp ?? 0),
        roundDuration: Number(data.configuration?.roundDuration ?? 600),
      },
    };
  }
  if (path === ENDPOINTS.economy) {
    if (data.chain?.chainId && String(data.chain.chainId) !== "11155111")
      throw new Error("Unexpected chain");
    if (
      !data.asset ||
      !isAddress(data.asset.address) ||
      !Number.isInteger(data.asset.decimals) ||
      data.asset.decimals < 0 ||
      data.asset.decimals > 36 ||
      data.asset.symbol !== "SQK"
    )
      throw new Error("Invalid SQK asset");
    return {
      economy: {
        asset: data.asset,
        totalStaked: integer(data.staking.totalStakedBaseUnits),
        liveSupply: integer(
          data.supply?.liveSupplyBaseUnits ?? data.liveSupplyBaseUnits,
        ),
        currentRound: integer(
          data.lifecycle?.currentRound ??
            data.currentRound ??
            data.core?.settledThroughRound ??
            0,
        ),
      },
    };
  }
  if (path === ENDPOINTS.stats) {
    const s = data.lifetime ?? data;
    return {
      stats: {
        observedDistanceMm: integer(s.observedDistanceMm),
        acceptedWorkUnits: integer(s.acceptedWorkUnits),
        settlementCount: integer(s.settlementCount),
        activeDayCount: Number(integer(s.activeDayCount)),
      },
    };
  }
  if (path === ENDPOINTS.events) {
    if (!Array.isArray(data.events)) throw new Error("Invalid events");
    return {
      events: data.events
        .slice(0, 10)
        .map((e: Json) => ({
          id: e.id,
          type: e.type ?? e.eventName,
          occurredAt:
            e.occurredAt ??
            new Date(Number(e.blockTimestamp) * 1000).toISOString(),
          hash: e.source?.transactionHash ?? e.transactionHash,
          round: e.payload?.throughRound ?? e.payload?.settledThroughRound,
          amount: e.payload?.amountBaseUnits,
          account: e.payload?.account,
        })),
    };
  }
  if (!data.measurement?.freshness) throw new Error("Invalid freshness");
  return { freshness: data.measurement.freshness };
}
function cachedFeed(): Partial<Feed> {
  let state: Partial<Feed> = {};
  for (const path of Object.values(ENDPOINTS)) {
    try {
      const entry = JSON.parse(
        localStorage.getItem(cachePrefix + path) ?? "null",
      );
      if (entry) state = { ...state, ...normalize(path, entry.data) };
    } catch {
      /* Ignore corrupt cache entries. */
    }
  }
  return state;
}
const demoStart = Date.now();
export function demoFeed(now: number): Partial<Feed> {
  const tick = Math.floor((now - demoStart) / 8000);
  return {
    core: {
      blockHeight: String(4200 + tick),
      blockProgress: String(((tick * 17 + 64) % 100) * 10000000),
      settledThroughRound: String(550 + tick),
      blockUnitsPerBlock: "1000000000",
      genesisTimestamp: Math.floor(demoStart / 1000) - 180,
      roundDuration: 600,
    },
    stats: {
      observedDistanceMm: String(42300000 + tick * 7500),
      acceptedWorkUnits: String(48000 + tick * 12),
      settlementCount: String(510 + tick),
      activeDayCount: 5,
    },
    events: Array.from({ length: 10 }, (_, i) => ({
      id: `demo-${tick - i}`,
      type: i % 3 ? "system.settlement_completed" : "account.rewards_claimed",
      occurredAt: new Date(now - i * 60000).toISOString(),
      round: String(550 + tick - i),
    })),
  };
}
const FeedContext = createContext<Feed>({
  failures: [],
  status: "loading",
  now: Date.now(),
  retry: () => {},
});
export function FeedProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [data, setData] = useState<Partial<Feed>>(cachedFeed);
  const [failures, setFailures] = useState<string[]>([]);
  const [updated, setUpdated] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now());
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (settings.demo) return;
    let stopped = false;
    let running = false;
    async function poll() {
      if (running) return;
      running = true;
      await Promise.allSettled(
        Object.entries(ENDPOINTS).map(async ([name, path]) => {
          try {
            const result = await fetchCached(path, attempt > 0);
            if (stopped) return;
            setData((previous) => ({
              ...previous,
              ...normalize(path, result),
              receivedAt: Date.now(),
            }));
            setUpdated((previous) => ({ ...previous, [name]: Date.now() }));
            setFailures((previous) => previous.filter((x) => x !== name));
          } catch {
            if (!stopped)
              setFailures((previous) => [...new Set([...previous, name])]);
          }
        }),
      );
      running = false;
    }
    void poll();
    const timer = setInterval(poll, 7000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [settings.demo, attempt]);
  const latest = Math.max(0, ...Object.values(updated));
  const allReady = Object.keys(updated).length === 5;
  const offline = !latest ? failures.length === 5 : now - latest > 60000;
  const status: Feed["status"] = settings.demo
    ? "demo"
    : offline || data.freshness === "offline"
      ? "offline"
      : !allReady && !failures.length
        ? "loading"
        : failures.length ||
            now - latest > 20000 ||
            !["online", "live", "fresh"].includes(data.freshness ?? "")
          ? "stale"
          : "live";
  const value = {
    ...data,
    ...(settings.demo ? demoFeed(now) : {}),
    failures,
    now,
    status,
    retry: () => setAttempt((x) => x + 1),
  } as Feed;
  return <FeedContext value={value}>{children}</FeedContext>;
}
export const useFeed = () => useContext(FeedContext);

export const eventName = (type: string) =>
  ({
    "system.settlement_completed": "Round settled",
    "system.mining_checkpointed": "Mining checkpoint",
    "account.rewards_claimed": "Rewards claimed",
    "account.stake_created": "SQK staked",
    "account.sqk_staked": "SQK staked",
    "account.nft_merged": "NFTs merged",
    "account.nfts_merged": "NFTs merged",
    BatchSettled: "Round settled",
  })[type] ?? type.replace(/^[^.]+\./, "").replaceAll("_", " ");
