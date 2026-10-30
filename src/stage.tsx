import { useEffect, useRef, useState } from "react";
import { parseUnits } from "viem";
import { useFeed, eventName } from "./lib/data";
import { useSettings } from "./lib/settings";
import { useTips } from "./lib/tips";
import { number, short, tokenNumber } from "./lib/format";
import { Icon, Wheel } from "./components/Art";
import { Metrics, Progress, StatusPill } from "./components/Dashboard";

interface Alert {
  id: string;
  sender: string;
  amount: string;
  created: number;
  demo?: boolean;
}
let audio: AudioContext | undefined;
export function playTipSound() {
  try {
    audio ??= new AudioContext();
    void audio.resume();
    for (const [index, frequency] of [659.25, 880].entries()) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime + index * 0.11;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.09, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.31);
    }
  } catch {
    /* OBS/browser audio permission may prevent playback. */
  }
}
export function Stage({ preview = false }: { preview?: boolean }) {
  const { core, economy, events, now, status } = useFeed();
  const { settings } = useSettings();
  const { fresh, error: tipsError } = useTips();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [eventIndex, setEventIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const seen = useRef(new Set<string>());
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
  const event = events?.[eventIndex % (events.length || 1)];
  useEffect(() => {
    const decimals = economy?.asset.decimals ?? 18;
    let minimum = 0n;
    try {
      minimum = parseUnits(settings.threshold, decimals);
    } catch {
      return;
    }
    const added = fresh
      .filter((tip) => tip.amount >= minimum && !seen.current.has(tip.id))
      .map((tip) => ({
        id: tip.id,
        sender: short(tip.sender),
        amount: tokenNumber(tip.amount, decimals),
        created: Date.now(),
      }));
    fresh.forEach((tip) => seen.current.add(tip.id));
    if (added.length) {
      setAlerts((previous) => [...previous, ...added].slice(-4));
      if (settings.sound) playTipSound();
    }
  }, [fresh, settings.threshold, settings.sound, economy?.asset.decimals]);
  useEffect(() => {
    const timer = setInterval(
      () =>
        setAlerts((previous) =>
          previous.filter((a) => Date.now() - a.created < 11000),
        ),
      1000,
    );
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!settings.demo) {
      setAlerts((previous) => previous.filter((a) => !a.demo));
      return;
    }
    const show = () => {
      setAlerts((previous) =>
        [
          ...previous,
          {
            id: `demo-${Date.now()}`,
            sender: "Demo viewer",
            amount: "12.34",
            created: Date.now(),
            demo: true,
          },
        ].slice(-4),
      );
      if (settings.sound) playTipSound();
    };
    const timer = setInterval(show, 14000);
    window.addEventListener("squeekstage:demo-tip", show);
    return () => {
      clearInterval(timer);
      window.removeEventListener("squeekstage:demo-tip", show);
    };
  }, [settings.demo, settings.sound]);
  useEffect(() => {
    if (paused || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const timer = setInterval(() => setEventIndex((index) => index + 1), 5000);
    return () => clearInterval(timer);
  }, [paused]);
  return (
    <section
      className={`stage-canvas ${preview ? "is-preview" : ""}`}
      aria-label="SqueekStage broadcast overlay"
      inert={preview || undefined}
    >
      <div className="stage-top">
        <a
          className="brand stage-brand"
          href="#/"
          aria-label="SqueekStage home"
        >
          <img
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            width="40"
            height="40"
            alt=""
          />
          <span>
            Squeek<span className="brand-light">Stage</span>
          </span>
        </a>
        <div className="stage-status">
          <span className="mono">Ethereum Sepolia</span>
          <StatusPill />
        </div>
      </div>
      <section className="stage-block">
        <span className="mono muted">Squeekchain block</span>
        <h1>{number(core?.blockHeight)}</h1>
        <div className="stage-round">
          <span>
            Round <strong>{number(currentRound)}</strong>
          </span>
          <span>
            Settled <strong>{number(core?.settledThroughRound)}</strong>
          </span>
        </div>
        <Wheel progress={progress} settlement={core?.settledThroughRound} />
        <Progress
          value={progress}
          label="Block progress"
          detail={core ? `${progress.toFixed(2)}%` : "Loading"}
        />
        <Progress
          value={roundProgress}
          label="Round progress"
          detail={core ? `${roundProgress.toFixed(1)}%` : "Loading"}
        />
      </section>
      {(status === "stale" || status === "offline" || status === "demo") && (
        <div className={`stage-feed-label ${status}`}>
          {status === "demo"
            ? "Demo feed · Simulated readings"
            : `${status === "offline" ? "Feed offline" : "Stale data"} · Last readings retained`}
        </div>
      )}
      <div className="tip-alerts" aria-live="polite" aria-relevant="additions">
        {alerts.map((alert) => (
          <div className="tip-alert" key={alert.id}>
            <span className="alert-icon">
              <Icon name="heart" size={28} />
            </span>
            <div>
              <strong>
                +{alert.amount} <small>SQK</small>
              </strong>
              <span>
                {alert.sender}
                <span className="muted">
                  {" "}
                  {alert.demo ? "· Demo tip" : "· Thank you!"}
                </span>
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="stage-bottom">
        <Metrics overlay />
        <div className="stage-ticker">
          <span className="ticker-title">
            <Icon name="activity" size={18} />
            Chain activity
          </span>
          <div className="ticker-event">
            {event ? (
              <>
                <span>{eventName(event.type)}</span>
                {event.round && (
                  <span className="mono muted">
                    Round {number(event.round)}
                  </span>
                )}
                <span className="mono muted">
                  {new Date(event.occurredAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </>
            ) : (
              "Waiting for on-chain activity…"
            )}
          </div>
          <button
            className="icon-button ticker-control"
            aria-label={
              paused ? "Resume activity ticker" : "Pause activity ticker"
            }
            onClick={() => setPaused(!paused)}
          >
            <Icon name={paused ? "play" : "pause"} size={18} />
          </button>
          <button
            className="icon-button ticker-control"
            aria-label="Next on-chain event"
            onClick={() => setEventIndex((index) => index + 1)}
          >
            <Icon name="right" size={18} />
          </button>
        </div>
        {tipsError && (
          <div className="stage-tip-error">
            Tip alerts reconnecting · {tipsError}
          </div>
        )}
      </div>
      {!preview && (
        <div className="stage-utilities">
          {settings.sound && !soundEnabled && (
            <button
              className="button"
              onClick={() => {
                playTipSound();
                setSoundEnabled(true);
              }}
            >
              Enable tip audio
              <Icon name="volume" size={18} />
            </button>
          )}
          {settings.demo && (
            <button
              className="button"
              onClick={() =>
                window.dispatchEvent(new Event("squeekstage:demo-tip"))
              }
            >
              Test demo alert
            </button>
          )}
        </div>
      )}
    </section>
  );
}
