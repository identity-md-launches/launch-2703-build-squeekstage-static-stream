import { useState } from "react";
import { useFeed, eventName } from "../lib/data";
import { explorer, number, relativeTime, tokenNumber } from "../lib/format";
import { Icon, Wheel } from "./Art";

export function StatusPill() {
  const { status } = useFeed();
  return (
    <span className={`status-pill ${status}`}>
      <span className="status-dot" />
      {
        {
          loading: "Connecting",
          live: "Live",
          stale: "Stale",
          offline: "Offline",
          demo: "Demo feed",
        }[status]
      }
    </span>
  );
}
export function FeedNotice() {
  const { status, failures, retry } = useFeed();
  if (!["stale", "offline", "demo"].includes(status)) return null;
  return (
    <div className={`feed-notice ${status}`} role="status">
      <Icon name="info" size={18} />
      <span>
        {status === "demo"
          ? "Demo feed is on. The wheel and activity are simulated; tipping is disabled."
          : `${status === "offline" ? "Feed offline." : "Some readings are stale."} ${failures.length ? "Keeping the last valid numbers." : "Waiting for fresh readings."}`}
      </span>
      {status !== "demo" && (
        <button className="text-button" onClick={retry}>
          Retry
        </button>
      )}
    </div>
  );
}
export function Metrics({ overlay = false }: { overlay?: boolean }) {
  const { stats, economy, status } = useFeed();
  const metrics = [
    {
      label: "Wheel distance",
      icon: "wheel",
      value: stats ? number(Number(stats.observedDistanceMm) / 1e6, 2) : "—",
      unit: "km",
      note: "Lifetime distance",
    },
    {
      label: "Accepted work",
      icon: "activity",
      value: number(stats?.acceptedWorkUnits),
      unit: "",
      note: "Verified work units",
    },
    {
      label: "Settlements",
      icon: "blocks",
      value: number(stats?.settlementCount),
      unit: "",
      note: "On-chain batches",
    },
    {
      label: "Active days",
      icon: "calendar",
      value: number(stats?.activeDayCount),
      unit: "",
      note: "Days with activity",
    },
    {
      label: "Total staked",
      icon: "stake",
      value:
        status === "demo"
          ? "12,450"
          : tokenNumber(economy?.totalStaked, economy?.asset.decimals, 0),
      unit: "SQK",
      note: status === "demo" ? "Simulated stake" : "Across Squeekchain",
    },
  ];
  return (
    <dl className={`metrics ${overlay ? "overlay-metrics" : ""}`}>
      {metrics.map((m) => (
        <div className="metric" key={m.label}>
          <dt>
            <Icon name={m.icon} size={18} />
            {m.label}
          </dt>
          <dd>
            <span className="metric-value">
              {m.value}
              {m.unit && <small>{m.unit}</small>}
            </span>
            {!overlay && <span className="metric-note">{m.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function Progress({
  value,
  label,
  detail,
}: {
  value: number;
  label: string;
  detail: string;
}) {
  const safe = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="progress-group">
      <div className="progress-label">
        <span>{label}</span>
        <span className="mono">{detail}</span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(safe)}
      >
        <div style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}
export function WheelPanel() {
  const { core, economy, now, status } = useFeed();
  const progress = core
    ? (Number(core.blockProgress) / Number(core.blockUnitsPerBlock)) * 100
    : 0;
  const roundProgress = core?.genesisTimestamp
    ? (((now / 1000 - core.genesisTimestamp) % core.roundDuration) /
        core.roundDuration) *
      100
    : 0;
  const currentRound =
    status === "demo" && core
      ? Number(core.settledThroughRound) + 1
      : (economy?.currentRound ??
        (core ? Number(core.settledThroughRound) + 1 : undefined));
  const secondsLeft = core?.genesisTimestamp
    ? Math.ceil(core.roundDuration * (1 - roundProgress / 100))
    : 0;
  return (
    <section className="panel wheel-panel" aria-labelledby="wheel-heading">
      <div className="panel-top">
        <h2 id="wheel-heading">
          <Icon name="wheel" />
          The wheel, right now
        </h2>
        <StatusPill />
      </div>
      <div className="wheel-main">
        <div className="block-readout">
          <span className="mono muted">Squeekchain block</span>
          <div className="block-number">{number(core?.blockHeight)}</div>
          <span className="block-caption">
            <span className="gold-dash" />
            Powered by little paws
          </span>
          <div className="round-readout">
            <div>
              <span className="mono muted">Current round</span>
              <strong>{number(currentRound)}</strong>
            </div>
            <div>
              <span className="mono muted">Settled through</span>
              <strong>{number(core?.settledThroughRound)}</strong>
            </div>
          </div>
        </div>
        <Wheel progress={progress} settlement={core?.settledThroughRound} />
      </div>
      <div className="progress-pair">
        <Progress
          value={progress}
          label="Block progress"
          detail={core ? `${progress.toFixed(2)}%` : "Awaiting data"}
        />
        <Progress
          value={roundProgress}
          label="Round progress"
          detail={
            core
              ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")} left`
              : "Awaiting data"
          }
        />
      </div>
      <div className="panel-foot">
        <span>
          <span className={`tiny-dot ${status}`} />
          {status === "demo"
            ? "Simulated readings"
            : "Public data · Refreshes every 7s"}
        </span>
        <span className="mono">
          11155111 <span className="muted">/ Sepolia</span>
        </span>
      </div>
    </section>
  );
}
export function EventFeed({ compact = false }: { compact?: boolean }) {
  const { events, now, status } = useFeed();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? events : events?.slice(0, compact ? 4 : 5);
  return (
    <section className="panel event-panel" aria-labelledby="activity-heading">
      <div className="panel-top">
        <h2 id="activity-heading">
          <Icon name="activity" />
          On-chain activity
        </h2>
        <span className="mono muted">Latest {events?.length ?? 10}</span>
      </div>
      {!events ? (
        <div className="empty-state">
          {status === "offline"
            ? "Activity unavailable. The feed retries automatically."
            : "Reading activity from Squeekchain…"}
        </div>
      ) : !events.length ? (
        <div className="empty-state">
          No recent events. New activity appears here automatically.
        </div>
      ) : (
        <ul className="event-list">
          {shown?.map((e) => {
            const isSettlement = /settle/i.test(e.type);
            const content = (
              <>
                <span
                  className={`event-icon ${isSettlement ? "settlement" : ""}`}
                >
                  <Icon
                    name={
                      isSettlement
                        ? "blocks"
                        : /claim/i.test(e.type)
                          ? "stake"
                          : /merge/i.test(e.type)
                            ? "wheel"
                            : "activity"
                    }
                    size={18}
                  />
                </span>
                <span className="event-copy">
                  <strong>{eventName(e.type)}</strong>
                  <span className="mono muted">
                    {e.round
                      ? `Through round ${number(e.round)}`
                      : e.amount
                        ? `${tokenNumber(e.amount)} SQK`
                        : "Squeekchain event"}
                  </span>
                </span>
                <span className="event-time">
                  {relativeTime(e.occurredAt, now)}
                  {e.hash && <Icon name="arrow" size={14} />}
                </span>
              </>
            );
            return (
              <li key={e.id}>
                {e.hash ? (
                  <a
                    href={explorer(e.hash)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${eventName(e.type)}, view transaction on Sepolia Etherscan`}
                  >
                    {content}
                  </a>
                ) : (
                  <div className="event-row">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {events && events.length > 5 && (
        <button className="event-more" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Show fewer events" : `Show all ${events.length} events`}
          <Icon name="right" size={16} />
        </button>
      )}
    </section>
  );
}
