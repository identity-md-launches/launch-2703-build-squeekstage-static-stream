import { useEffect, useRef, useState, type FormEvent } from "react";
import { useConnection } from "wagmi";
import type { Hex } from "viem";
import { useFeed } from "./lib/data";
import { useSettings, siteUrl } from "./lib/settings";
import {
  accentIsReadable,
  amountUnits,
  checksum,
  explorer,
  friendlyError,
  number,
  short,
  tokenNumber,
  validRecipient,
} from "./lib/format";
import { leaderboard, readBalance, rpc, transferRequest } from "./lib/rpc";
import { useTips } from "./lib/tips";
import { Icon } from "./components/Art";
import { useWalletUI } from "./components/Connect";
import {
  EventFeed,
  FeedNotice,
  Metrics,
  WheelPanel,
} from "./components/Dashboard";
import { Stage } from "./stage";

export function Home() {
  const { settings } = useSettings();
  return (
    <>
      <div className="page-heading home-heading">
        <div>
          <h1>
            Small paws. <span>Real blocks.</span>
          </h1>
          <p>A live stream companion for the Squeekchain hamster wheel.</p>
        </div>
        <div className="page-actions">
          <a className="button" href="#/stage">
            <Icon name="screen" />
            Open stage
          </a>
          <a className="button primary" href="#/tip">
            <Icon name="heart" />
            Send a tip
            <Icon name="arrow" size={16} />
          </a>
        </div>
      </div>
      <FeedNotice />
      <div className="dashboard-grid">
        <WheelPanel />
        <EventFeed />
      </div>
      <Metrics />
      <section className="broadcast-banner">
        <div className="broadcast-graphic" aria-hidden="true">
          <span />
          <span />
          <span />
          <Icon name="screen" size={26} />
        </div>
        <div>
          <h2>A little wheel. A bigger stage.</h2>
          <p>
            Bring the live numbers into OBS. Your camera takes center stage.
          </p>
        </div>
        <a className="button" href="#/setup">
          {settings.streamer ? "Edit stream setup" : "Set up your stream"}
          <Icon name="right" size={18} />
        </a>
      </section>
    </>
  );
}

export function TipPage() {
  const { economy, status } = useFeed();
  const { settings } = useSettings();
  const { address, chainId, connector } = useConnection();
  const { openWallet, switchNetwork } = useWalletUI();
  const { tips, head, error: logsError, loading, retry } = useTips();
  const [amount, setAmount] = useState("1");
  const [balance, setBalance] = useState<bigint>();
  const [balanceError, setBalanceError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [hash, setHash] = useState<Hex>();
  const [outcome, setOutcome] = useState<
    "pending" | "confirmed" | "reverted"
  >();
  const input = useRef<HTMLInputElement>(null);
  const recipient = validRecipient(settings.streamer);
  const ranking = leaderboard(tips);
  useEffect(() => {
    setBalance(undefined);
    setBalanceError(false);
    if (!address || !economy || chainId !== 11155111) return;
    let cancelled = false;
    async function load() {
      try {
        const value = await readBalance(economy!.asset.address, address!);
        if (!cancelled) {
          setBalance(value);
          setBalanceError(false);
        }
      } catch {
        if (!cancelled) setBalanceError(true);
      }
    }
    void load();
    const timer = setInterval(load, 7000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [address, economy?.asset.address, chainId, refresh]);
  useEffect(() => {
    if (!hash || outcome !== "pending") return;
    let cancelled = false;
    let running = false;
    const check = async () => {
      if (running) return;
      running = true;
      try {
        const receipt = await rpc<{ status: string } | null>(
          "eth_getTransactionReceipt",
          [hash],
        );
        if (receipt && !cancelled) {
          setOutcome(receipt.status === "0x1" ? "confirmed" : "reverted");
          setRefresh((n) => n + 1);
        }
      } catch {
        /* Keep the hash visible while receipt reads recover. */
      } finally {
        running = false;
      }
    };
    void check();
    const timer = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [hash, outcome]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (settings.demo) {
      setMessage("Turn off Demo feed in Setup to send a real tip.");
      return;
    }
    if (!recipient) {
      setMessage(
        "The streamer needs to add a receiving wallet in Setup before tipping.",
      );
      return;
    }
    if (!address || !connector) {
      openWallet();
      return;
    }
    if (chainId !== 11155111) {
      try {
        await switchNetwork();
      } catch {
        /* Wallet picker shows the error. */
      }
      return;
    }
    if (!economy || status !== "live") {
      setMessage(
        "Wait for live token data before sending. Use Retry if the feed is stale.",
      );
      return;
    }
    let units: bigint;
    try {
      units = amountUnits(amount, economy.asset.decimals);
    } catch (e) {
      setMessage((e as Error).message);
      input.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const currentBalance = await readBalance(economy.asset.address, address);
      setBalance(currentBalance);
      if (currentBalance < units) {
        setMessage(
          `Not enough SQK. Your balance is ${tokenNumber(currentBalance, economy.asset.decimals)} SQK. Choose a smaller amount.`,
        );
        return;
      }
      const provider = (await connector.getProvider()) as {
        request: (args: { method: string; params?: unknown[] }) => Promise<any>;
      };
      const actualChain = await provider.request({ method: "eth_chainId" });
      if (Number(BigInt(actualChain)) !== 11155111) {
        setMessage("Switch your wallet to Ethereum Sepolia, then try again.");
        return;
      }
      const accounts = (await provider.request({
        method: "eth_accounts",
      })) as string[];
      if (
        !accounts.some(
          (account) => account.toLowerCase() === address.toLowerCase(),
        )
      ) {
        setMessage("Your wallet account changed. Reconnect and try again.");
        return;
      }
      const request = transferRequest(
        economy.asset.address,
        settings.streamer,
        amount,
        economy.asset.decimals,
        address,
      );
      // The only write: ERC-20 transfer(address,uint256), sent directly through the wallet.
      const sent = await provider.request({
        method: "eth_sendTransaction",
        params: [request],
      });
      if (!/^0x[0-9a-f]{64}$/i.test(sent))
        throw new Error("Invalid transaction response");
      setHash(sent);
      setOutcome("pending");
    } catch (e) {
      setMessage(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            Give the wheel <span>a little love.</span>
          </h1>
          <p>Send SQK straight to the streamer on Ethereum Sepolia.</p>
        </div>
        <span className="network-tag">
          <span className="diamond" />
          Sepolia testnet
        </span>
      </div>
      <FeedNotice />
      <div className="tip-grid">
        <section className="panel tip-form-panel">
          <div className="panel-top">
            <h2>
              <Icon name="heart" />
              Send a tip
            </h2>
            <span className="mono muted">SQK</span>
          </div>
          <form onSubmit={submit} noValidate>
            <div className="recipient-line">
              <span className="mono muted">To streamer</span>
              {recipient ? (
                <a
                  className="address-text"
                  href={`https://sepolia.etherscan.io/address/${checksum(settings.streamer)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {checksum(settings.streamer)}
                  <Icon name="arrow" size={16} />
                </a>
              ) : (
                <span className="recipient-unset">
                  Receiving wallet not set.{" "}
                  <a href="#/setup">
                    Set up a stream
                    <Icon name="arrow" size={14} />
                  </a>
                </span>
              )}
            </div>
            <div className="amount-title">
              <label htmlFor="tip-amount">Tip amount</label>
              <span className="mono muted">
                Balance:{" "}
                {address
                  ? balance === undefined
                    ? balanceError
                      ? "Unavailable"
                      : "Loading…"
                    : `${tokenNumber(balance, economy?.asset.decimals)} SQK`
                  : "Connect to view"}
              </span>
            </div>
            <div className="amount-input">
              <input
                ref={input}
                id="tip-amount"
                name="amount"
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                aria-invalid={Boolean(
                  message && /amount|decimal/.test(message),
                )}
                aria-describedby="amount-help tip-message"
                onChange={(e) => {
                  setAmount(e.target.value);
                  setMessage("");
                }}
              />
              <span>SQK</span>
            </div>
            <div className="amount-options" aria-label="Choose a tip amount">
              {[1, 5, 10, 25, 100].map((n) => (
                <button
                  type="button"
                  key={n}
                  aria-pressed={amount === String(n)}
                  className={amount === String(n) ? "selected" : ""}
                  onClick={() => {
                    setAmount(String(n));
                    setMessage("");
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            <p id="amount-help" className="muted">
              Choose an amount or enter your own. You’ll also need Sepolia ETH
              for gas.
            </p>
            {balanceError && (
              <div className="inline-notice">
                Unable to read your balance.{" "}
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setRefresh((n) => n + 1)}
                >
                  Retry balance
                </button>
              </div>
            )}
            <button
              className="button primary send-button"
              type="submit"
              disabled={
                busy ||
                outcome === "pending" ||
                settings.demo ||
                Boolean(address && chainId !== 11155111)
              }
            >
              <Icon name={busy ? "refresh" : "heart"} />
              {busy
                ? "Confirm in your wallet…"
                : outcome === "pending"
                  ? "Waiting for confirmation…"
                  : `Send ${amount || "0"} SQK`}
              <Icon name="right" size={18} />
            </button>
            {address && chainId !== 11155111 && (
              <button
                className="button full-width"
                type="button"
                onClick={() => void switchNetwork().catch(() => {})}
              >
                Switch to Sepolia
              </button>
            )}
            <div id="tip-message" className="form-message error" role="status">
              {message}
            </div>
            {hash && (
              <div className={`transaction-state ${outcome}`} role="status">
                <Icon name={outcome === "confirmed" ? "check" : "info"} />
                <div>
                  <strong>
                    {outcome === "confirmed"
                      ? "Tip confirmed. Thank you!"
                      : outcome === "reverted"
                        ? "Transaction reverted. No SQK was transferred."
                        : "Tip submitted. Waiting for Sepolia."}
                  </strong>
                  <p>
                    {outcome === "confirmed"
                      ? "The overlay checks for new tips every 7 seconds."
                      : outcome === "pending"
                        ? "You can follow confirmation on the explorer."
                        : "Check the transaction on the explorer before trying again."}
                  </p>
                  <a href={explorer(hash)} target="_blank" rel="noreferrer">
                    View transaction
                    <Icon name="arrow" size={14} />
                  </a>
                </div>
              </div>
            )}
            <p className="transfer-note">
              <Icon name="shield" size={16} />
              One token transfer. No approval. No platform fee.
            </p>
          </form>
        </section>
        <aside className="tip-aside">
          <div className="panel leaderboard-panel">
            <div className="panel-top">
              <h2>
                <Icon name="stake" />
                Top tippers
              </h2>
              <span className="mono muted">6k blocks</span>
            </div>
            {ranking.length ? (
              <ol className="leaderboard">
                {ranking.slice(0, 10).map((r, i) => (
                  <li key={r.sender}>
                    <span className="rank">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <a
                      href={`https://sepolia.etherscan.io/address/${r.sender}`}
                      target="_blank"
                      rel="noreferrer"
                      title={r.sender}
                    >
                      {short(r.sender)}
                    </a>
                    <strong>
                      {tokenNumber(r.total, economy?.asset.decimals)}{" "}
                      <small>SQK</small>
                    </strong>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="empty-state">
                <Icon name="heart" size={28} />
                <strong>
                  {!recipient
                    ? "A stream starts with a wallet."
                    : settings.demo
                      ? "Demo mode is a preview."
                      : loading
                        ? "Reading tip history…"
                        : logsError
                          ? "Tip history is unavailable."
                          : "Be the first to tip."}
                </strong>
                <p>
                  {!recipient
                    ? "Add the streamer’s receiving address in Setup to see tips here."
                    : settings.demo
                      ? "Turn off Demo feed to read on-chain tips."
                      : "Rankings use confirmed transfers from the same recent log window."}
                </p>
              </div>
            )}
          </div>
          <p className="aside-note">
            <Icon name="info" size={16} />
            SQK and gas are Sepolia testnet assets. Verify the receiving address
            before sending.
          </p>
        </aside>
      </div>
      <section className="panel recent-panel">
        <div className="panel-top">
          <h2>
            <Icon name="activity" />
            Recent tips
          </h2>
          <span className="mono muted">
            {head ? `Through #${number(head)}` : "Ethereum Sepolia"}
          </span>
        </div>
        {logsError && (
          <div className="feed-notice" role="status">
            <span>
              {logsError}{" "}
              {tips.length ? "Showing the last successful log scan." : ""}
            </span>
            <button className="text-button" onClick={retry}>
              Retry tips
            </button>
          </div>
        )}
        {tips.length ? (
          <ul className="recent-tips">
            {tips.slice(0, 20).map((tip) => (
              <li key={tip.id}>
                <span className="tip-heart">
                  <Icon name="heart" size={18} />
                </span>
                <a
                  href={`https://sepolia.etherscan.io/address/${tip.sender}`}
                  target="_blank"
                  rel="noreferrer"
                  title={tip.sender}
                >
                  {short(tip.sender)}
                </a>
                <span className="mono muted">Block {number(tip.block)}</span>
                <strong>
                  +{tokenNumber(tip.amount, economy?.asset.decimals)} SQK
                </strong>
                <a
                  className="icon-button"
                  href={explorer(tip.hash)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`View ${short(tip.hash)} on Sepolia Etherscan`}
                >
                  <Icon name="arrow" />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">
            {loading
              ? "Scanning the last 6,000 Sepolia blocks…"
              : "Confirmed tips will appear here with a link to the transaction."}
          </p>
        )}
      </section>
    </>
  );
}

export function CopyField({
  label,
  value,
  enabled = true,
}: {
  label: string;
  value: string;
  enabled?: boolean;
}) {
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copied");
    } catch {
      input.current?.select();
      setMessage("Link selected. Press Ctrl+C or copy from the field.");
    }
  }
  return (
    <div className="copy-field">
      <label>
        {label}
        <div className="copy-row">
          <input
            ref={input}
            readOnly
            value={value}
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            className="button"
            type="button"
            onClick={copy}
            disabled={!enabled}
          >
            <Icon name={message === "Copied" ? "check" : "copy"} size={18} />
            {message === "Copied" ? "Copied" : "Copy"}
          </button>
        </div>
      </label>
      <span className="copy-message" role="status">
        {message}
      </span>
    </div>
  );
}
export function SetupPage() {
  const { settings, setSettings } = useSettings();
  const [streamer, setStreamer] = useState(settings.streamer);
  const [accent, setAccent] = useState(settings.accent);
  const [threshold, setThreshold] = useState(settings.threshold);
  const [sound, setSound] = useState(settings.sound);
  const [demo, setDemo] = useState(settings.demo);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const recipientInput = useRef<HTMLInputElement>(null);
  const thresholdInput = useRef<HTMLInputElement>(null);
  const accentInput = useRef<HTMLInputElement>(null);
  const ready = validRecipient(settings.streamer);
  function save(e: FormEvent) {
    e.preventDefault();
    setSaved("");
    setError("");
    if (streamer && !validRecipient(streamer.trim())) {
      setError(
        "Enter a valid Ethereum receiving address, or leave it blank to preview.",
      );
      recipientInput.current?.focus();
      return;
    }
    if (
      !/^\d+(\.\d{1,18})?$/.test(threshold) ||
      !Number.isFinite(Number(threshold))
    ) {
      setError(
        "Enter an alert threshold of 0 or more, with up to 18 decimal places.",
      );
      thresholdInput.current?.focus();
      return;
    }
    if (!accentIsReadable(accent)) {
      setError(
        "Choose a brighter accent colour so text is readable on dark panels.",
      );
      accentInput.current?.focus();
      return;
    }
    const next = {
      streamer: streamer.trim() ? checksum(streamer.trim()) : "",
      accent,
      threshold,
      sound,
      demo,
    };
    setSettings(next);
    setStreamer(next.streamer);
    setSaved("Settings saved. Your links are ready.");
    history.replaceState(null, "", siteUrl("setup", next));
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            Make it <span>your stage.</span>
          </h1>
          <p>Set the receiving wallet. Copy your links. Go live.</p>
        </div>
        <a className="button" href="#/stage">
          <Icon name="screen" />
          Preview stage
        </a>
      </div>
      <div className="setup-grid">
        <section className="panel">
          <div className="panel-top">
            <h2>
              <Icon name="settings" />
              Stream settings
            </h2>
            <span className="mono muted">Saved on this device</span>
          </div>
          <form className="settings-form" onSubmit={save} noValidate>
            <label htmlFor="streamer">
              Streamer wallet
              <span className="field-hint">
                The Ethereum address that receives SQK tips.
              </span>
            </label>
            <input
              ref={recipientInput}
              id="streamer"
              name="streamer"
              autoComplete="off"
              spellCheck={false}
              placeholder="Paste your receiving address"
              value={streamer}
              onChange={(e) => {
                setStreamer(e.target.value);
                setError("");
                setSaved("");
              }}
              aria-invalid={Boolean(error && error.includes("address"))}
              aria-describedby="settings-message"
            />
            <div className="settings-pair">
              <div>
                <label htmlFor="accent">Accent colour</label>
                <div className="color-control">
                  <input
                    ref={accentInput}
                    id="accent"
                    name="accent"
                    type="color"
                    value={accent}
                    onChange={(e) => setAccent(e.target.value)}
                    aria-invalid={Boolean(error && error.includes("colour"))}
                    aria-describedby="settings-message"
                  />
                  <span className="mono">{accent}</span>
                </div>
              </div>
              <div>
                <label htmlFor="threshold">
                  Alert threshold <span className="muted">(SQK)</span>
                </label>
                <input
                  ref={thresholdInput}
                  id="threshold"
                  name="threshold"
                  inputMode="decimal"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  aria-invalid={Boolean(error && error.includes("threshold"))}
                  aria-describedby="settings-message"
                />
              </div>
            </div>
            <div className="toggle-row">
              <label htmlFor="sound">
                <Icon name="volume" />
                <span>
                  Play tip sounds
                  <small>Browser audio permissions may apply.</small>
                </span>
              </label>
              <input
                className="switch"
                id="sound"
                type="checkbox"
                checked={sound}
                onChange={(e) => setSound(e.target.checked)}
              />
            </div>
            <div className="toggle-row">
              <label htmlFor="demo">
                <Icon name="play" />
                <span>
                  Demo feed
                  <small>Simulate the wheel, settlements, and alerts.</small>
                </span>
              </label>
              <input
                className="switch"
                id="demo"
                type="checkbox"
                checked={demo}
                onChange={(e) => setDemo(e.target.checked)}
              />
            </div>
            <div
              id="settings-message"
              className={`form-message ${error ? "error" : "success"}`}
              role="status"
            >
              {error || saved}
            </div>
            <button className="button primary" type="submit">
              Save settings
              <Icon name="check" size={18} />
            </button>
          </form>
        </section>
        <aside className="setup-links">
          <section className="panel">
            <div className="panel-top">
              <h2>
                <Icon name="copy" />
                Your stream links
              </h2>
            </div>
            <div className="links-content">
              <CopyField
                label="OBS overlay URL"
                value={siteUrl("stage", settings, true)}
              />
              <CopyField
                label="Viewer tip URL"
                value={siteUrl("tip", settings)}
              />
              {!ready && (
                <p className="inline-notice">
                  Add a receiving wallet and save to enable tips. Preview links
                  work now.
                </p>
              )}
              <p className="muted">
                Links carry your saved settings so viewers and OBS use the same
                recipient.
              </p>
            </div>
          </section>
          <section className="obs-instructions">
            <h2>In OBS, add a Browser Source.</h2>
            <ol>
              <li>Paste the OBS overlay URL.</li>
              <li>
                Set width to <strong>1920</strong> and height to{" "}
                <strong>1080</strong>.
              </li>
              <li>Place it above your hamster camera.</li>
            </ol>
            <p>
              The OBS URL has a transparent background. The camera is your own
              source.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}

export function StagePage() {
  const { settings } = useSettings();
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            The wheel <span>takes the stage.</span>
          </h1>
          <p>A transparent broadcast overlay. Add your own camera in OBS.</p>
        </div>
        <a
          className="button primary"
          href={siteUrl("stage", settings, true)}
          target="_blank"
          rel="noreferrer"
        >
          Open OBS overlay
          <Icon name="arrow" size={18} />
        </a>
      </div>
      <FeedNotice />
      <div className="stage-preview">
        <Stage preview />
        <div className="camera-guide" aria-hidden="true">
          <Icon name="screen" size={28} />
          <span>Your hamster camera goes here</span>
          <span className="mono">1920 × 1080 · Transparent in OBS</span>
        </div>
      </div>
      <div className="preview-caption">
        <span>
          <span className="tiny-dot live" />
          Overlay preview · Checkerboard shows transparency
        </span>
        <a href="#/setup">
          Configure overlay
          <Icon name="right" size={16} />
        </a>
      </div>
      <CopyField
        label="OBS Browser Source URL"
        value={siteUrl("stage", settings, true)}
      />
    </>
  );
}

export function AboutPage() {
  const { economy } = useFeed();
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            One hamster. <span>Every block.</span>
          </h1>
          <p>SqueekStage brings the Squeekchain wheel to your stream.</p>
        </div>
        <a className="button primary" href="#/stage">
          Open stage
          <Icon name="right" size={18} />
        </a>
      </div>
      <div className="about-grid">
        <article className="about-copy">
          <h2>A companion for the camera.</h2>
          <p>
            The hamster runs. Squeekchain records accepted wheel work and
            settles it on Ethereum Sepolia. SqueekStage turns those public
            readings into a dashboard and an OBS overlay.
          </p>
          <p>
            Add the transparent overlay above your own live camera. Viewers can
            send SQK directly to the receiving wallet you set in Setup. The page
            handles the transfer; your wallet handles the signature.
          </p>
          <h2>Public inputs, visible limits.</h2>
          <p>
            Five public API endpoints refresh every 7 seconds. Lifetime distance
            is converted from millimetres to kilometres. The round clock is
            estimated from the published genesis time and round duration;
            settlement totals remain on-chain readings.
          </p>
          <p>
            Tip history and rankings come from the token’s Transfer logs on
            Sepolia over roughly 6,000 blocks. They cover that window, rather
            than every tip ever sent. Alerts appear after inclusion and the next
            log poll; network and RPC delays can add time.
          </p>
          <h2>Your wallet stays yours.</h2>
          <p>
            The only transaction is an ERC-20 transfer of SQK to the displayed
            streamer address. There are no approvals, application contracts,
            platform fees, private keys, or servers in SqueekStage. Sepolia ETH
            pays network gas.
          </p>
          <p>
            Settings and a short-lived public-data cache are stored in this
            browser. Shareable links include the receiving address and overlay
            settings. Demo mode is clearly labelled and cannot send tips.
          </p>
        </article>
        <aside className="data-sources">
          <h2>Follow the data</h2>
          {[
            ["Core & block progress", "core"],
            ["SQK & staking", "economy/state"],
            ["On-chain activity", "events?category=all&limit=24"],
            ["Lifetime wheel statistics", "measurement/stats?range=7d"],
            ["Measurement freshness", "status"],
          ].map(([title, path]) => (
            <a
              key={path}
              href={`https://api.squeekchain.com/v1/${path}`}
              target="_blank"
              rel="noreferrer"
            >
              <span>
                {title}
                <small className="mono">/v1/{path}</small>
              </span>
              <Icon name="arrow" size={18} />
            </a>
          ))}
          <a
            href="https://sepolia.etherscan.io"
            target="_blank"
            rel="noreferrer"
          >
            <span>
              Ethereum Sepolia explorer
              <small className="mono">Chain ID 11155111</small>
            </span>
            <Icon name="arrow" size={18} />
          </a>
          {economy && (
            <div className="token-details">
              <span className="mono muted">
                SQK token · {economy.asset.decimals} decimals
              </span>
              <a
                className="address-text"
                href={`https://sepolia.etherscan.io/token/${economy.asset.address}`}
                target="_blank"
                rel="noreferrer"
              >
                {economy.asset.address}
                <Icon name="arrow" size={16} />
              </a>
              <span className="muted">
                Live supply:{" "}
                {tokenNumber(economy.liveSupply, economy.asset.decimals, 0)} SQK
              </span>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
