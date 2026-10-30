# SqueekStage

A static Squeekchain dashboard, transparent OBS overlay, and SQK tipping page for **Ethereum Sepolia, chain ID 11155111**. Public numbers load without a wallet. There is no backend, custody, API key, application contract, or secret configuration.

The ready-to-serve export is **`dist/`**. Source, package manifest, and npm lockfile are included. Serve the directory over HTTP(S); opening the HTML directly as a `file:` URL is not supported.

## Install, run, preview, rebuild

Use Node.js **20.19+ or 22.12+** and npm.

```sh
npm ci
npm run dev
```

For the production export:

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

Open the URL printed by Vite. Upload the **contents of `dist/`**, including `assets/`, `fonts/`, `wallets/`, favicon, and share image, to a static host. Vite uses `base: './'`; assets are relative and navigation uses hashes, so subpath and gateway hosting need no route rewrites. Nothing is published by the build scripts.

Routes: `#/` overview, `#/stage` overlay preview, `#/tip` tipping, `#/setup` stream settings, `#/about` explanation and sources. The title, description, favicon, Open Graph title, and local 1200×630 share image are included. After a production domain is known, a publisher may make `og:image` absolute if its sharing platform requires that.

## Streamer setup and OBS

1. Open **Setup**, paste your Ethereum receiving address, choose an accent and minimum alert amount, and save. The receiving address has no default; the page does not guess who owns this stream.
2. Leave **Demo feed** off for live use. Demo is explicitly labelled, simulates wheel statistics and events, and disables transfers. In demo mode, alerts appear every 14 seconds. The OBS overlay also offers a demo alert control when hovered or focused.
3. Copy **OBS overlay URL**. In OBS, add a Browser Source above your own hamster camera. Set **width 1920** and **height 1080** and paste the copied URL. The overlay also scales to **1280×720**.
4. The generated URL has `obs=1` before `#/stage`. Both `?obs=1#/stage` and `#/stage?obs=1` work. This removes site chrome and makes the page background transparent; the statistic panels remain opaque for readability over video. The stage preview uses a checkerboard to show the camera area.
5. Copy **Viewer tip URL** and share it with viewers. Both links include the same saved receiving wallet and overlay settings. A link is a snapshot: copy fresh links after changing settings, and update the OBS source and viewer link together.

Settings persist in local storage. Query settings override saved values; queries after the hash also work. Supported parameters are `streamer`, `accent` (encoded six-digit hex), `threshold`, `sound=0|1`, and `demo=0|1`. Too-dark accents are rejected in Setup and fall back to gold when imported in a URL. This keeps accent text readable on dark panels.

**Sound:** enable Play tip sounds in Setup, save, and update the OBS URL. The alert tone is synthesized locally with Web Audio. In the OBS source’s Interact window, hover/focus the lower-left controls and select **Enable tip audio** if the browser requires a user gesture. Enable OBS Browser Source audio routing as appropriate for your scene. Browser autoplay restrictions and OBS mixing can prevent sound; the visual alert works independently. In normal use these controls are hidden until hovered or focused.

The companion does not embed or supply a camera feed. Your live camera is a separate OBS source.

## Public data and units

All five sources start fetching in parallel immediately and poll every **7 seconds**. The response cache has a **5-second TTL**; valid snapshots are retained in memory and local storage. Failed or malformed responses do not overwrite the last snapshot. Retry forces a fresh read.

| Source                                                                    | Data used                                                                                                                                |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [Core](https://api.squeekchain.com/v1/core)                               | `core.blockHeight`, `blockProgress`, `settledThroughRound`; configuration block units, genesis timestamp, and round duration             |
| [Economy](https://api.squeekchain.com/v1/economy/state)                   | SQK asset address, symbol, decimals; supply; total staked base units; lifecycle current round                                            |
| [Events](https://api.squeekchain.com/v1/events?category=all&limit=24)     | Latest ten returned public events, with settlement, claim, stake, merge, and checkpoint labels and explorer links where available        |
| [Measurements](https://api.squeekchain.com/v1/measurement/stats?range=7d) | **`lifetime`** distance, accepted work units, settlement count, and active day count, rather than sums from the seven-day activity chart |
| [Status](https://api.squeekchain.com/v1/status)                           | `measurement.freshness`                                                                                                                  |

Distance converts millimetres to kilometres by dividing by **1,000,000**. Block progress divides its units by `blockUnitsPerBlock`. The round clock is an estimate from the published genesis time, duration, and the viewer’s clock; the current round and settled-through values remain API readings and can differ while settlements queue.

**Connecting** means the initial reads are in progress. **Live** requires successful reads from every endpoint and online measurement freshness. **Stale** means a read failed, measurement freshness is stale/unknown, or successful reads have stopped for 20 seconds. **Offline** means explicit offline measurement status, all initial requests failed, or no successful response for 60 seconds. Retained values remain visible and are labelled. Demo has its own status and is never presented as live.

## Wallets and what is sent on chain

The single Connect control opens a native, keyboard-accessible wallet picker. EIP-6963 discovers installed extensions by name and icon; the generic Browser wallet row is hidden when named extensions exist. With no mobile provider, the sheet offers MetaMask, Coinbase Wallet, Rabby, and Phantom app links, plus Coinbase Smart Wallet. There is no WalletConnect relay or project ID. Mobile app handoff still depends on the installed wallet and the browser opening the link.

The token address and decimals come from the economy API; they are not guessed or set to an arbitrary fallback. Unexpected chains or malformed asset data prevent replacement of the snapshot. A viewer can select 1, 5, 10, 25, or 100 SQK, or enter an exact custom decimal amount.

The application makes **one write type only**:

```text
eth_sendTransaction
  from: connected viewer
  to: SQK token address from the Sepolia economy API
  value: 0
  chainId: 11155111
  data: transfer(streamerAddress, amountInBaseUnits)
```

The ERC-20 selector is `0xa9059cbb`. The streamer address and amount appear in the form before signing. There is no `approve`, unlimited allowance, application fee, custody address, or key import. The wallet handles signing and Sepolia ETH pays gas. Wallet providers, including Smart Wallet, may handle their own account infrastructure internally.

The page rechecks the SQK balance, wallet chain, and available account before requesting a transfer. Amounts use bigint with exact decimal validation. Wrong-network transfers are disabled; switching uses `wallet_switchEthereumChain` with an add-Sepolia fallback for error 4902. Rejection 4001, insufficient SQK/gas, RPC failure, pending confirmation, confirmed receipts, and reverted receipts have explicit messages. A submitted hash links to Sepolia Etherscan. Transaction status is held on the current Tip page; if you leave or reload, check your wallet/explorer before sending again.

## Tip history, alerts, and limits

The shared log reader uses public Sepolia RPCs: [PublicNode](https://ethereum-sepolia-rpc.publicnode.com) with [1RPC](https://1rpc.io/sepolia) as a fallback. Each is checked against chain ID 11155111 before reads. Initial history covers approximately **6,000 blocks in three 2,000-block chunks**, filtering the SQK token’s `Transfer(address,address,uint256)` topic and the streamer’s indexed recipient topic.

Subsequent 7-second polls fetch the new head and overlap the previous 12 blocks to refresh recent logs, deduplicate entries, and handle short reorganizations. The current 6,000-block window supplies **both recent tips and the leaderboard**. It is not a lifetime ranking. Any incoming positive SQK transfer to the recipient is counted; logs do not contain a “tip” memo that distinguishes it from another incoming transfer.

Historical tips populate the lists without replaying alerts. New matching transfers at or above the saved threshold show for about **11 seconds**, with at most **four** visible alerts, short senders, and an optional tone. Wheel motion runs once when an observed settlement changes. Reduced motion disables movement and automatic ticker rotation; pause/next controls remain available in the overlay.

Alerts normally appear on the next poll after transaction inclusion. The target is roughly 15 seconds after submission, but Sepolia inclusion, public RPC availability, throttling, deep reorganizations, suspended tabs, and slow networks can add delay. There is no backend push service or server coordination. A very large backlog can exceed the public RPC’s practical response limits; failed reads retain the last successful history and expose retry. Demo feed never sends transactions.

## Validation actually run

Final worker results, screenshots, six-domain review, fixes, and limitations are in [artifacts/validation.md](artifacts/validation.md). Machine-readable observations are alongside it. These are this worker’s checks, not independent certification.

- `npm run typecheck`: passed.
- `npm test`: **7/7** unit tests passed: exact amounts, transfer calldata, chunk boundaries, ranking totals, actual API schema normalization, error messages, and readable custom accents.
- `npm run build`: passed; complete relative static export in `dist/`.
- `npm run test:browser`: **six Chromium interaction groups passed**, including all five routes at 320, 390, 740, and 1440; clipboard and persisted settings; mobile wallet entry points; keyboard dialog; low balance/rejection/network switching/exact transfer and receipt using a simulated provider; log thresholds/max-four alerts; transparency and 720p geometry; stale retention/retry/reduced motion. Axe reported **zero violations across five routes** for its selected WCAG rules.
- `npm run test:live`: real, unmodified public sources showed a first block number in **439 ms**, all sources Live in **571 ms**, and a real 2,000-block token log read; both RPCs returned Sepolia. This is an observation, not a latency guarantee.
- The pinned `taste.mjs --out test/scratch/taste` probe ran: **15/16** checks passed. The remaining heuristic flags required monospace labels above numerical readings; those are retained as data labels, with the exception explained in the review. No observed overflow, text overlap, failed local asset, or script error remained.
- `npm run check:bundle` verifies the explicit per-path budget, total 8 MiB limit, runtime assets, relative export URLs, and absence of dependency directories/archives in the deliverable roots. See [bundle-check.json](artifacts/bundle-check.json) for exact bytes and export hashes.

To repeat browser checks after building:

```sh
npx playwright install chromium
npm run test:browser
npm run test:live
```

The test scripts own and close their temporary preview servers and browsers. Generated evidence goes to `test/scratch/`, which the build does not need. Set Playwright’s documented `PLAYWRIGHT_BROWSERS_PATH` to a writable temporary location if needed. WebKit was downloaded but could not launch because its runtime dependencies were unavailable; **WebKit rendering and interactions were not performed**. No actual wallet signature, Coinbase passkey creation, physical phone handoff, screen-reader session, native 200% zoom, or OBS application session was performed. The signed-transfer/overlay integration was tested with controlled wallet/RPC fixtures, while separate read-only checks used the live services.

## Files and design

`src/lib/` owns settings, API normalization/cache, wallet configuration, ERC-20 encoding, RPC access, and the shared tip reader. `src/components/` owns the wheel, metrics, activity, icons, and wallet sheet. `src/stage.tsx` is the broadcast canvas; `src/pages.tsx` contains the public pages. `tests/` contains repeatable validation, with synthetic identities confined to tests.

[DESIGN.md](DESIGN.md) documents the implemented tokens, type scale, components, and responsive behavior. [THIRD_PARTY.md](THIRD_PARTY.md) records font, wallet mark, design-guide, and documentation-guide attribution. The share image is bundled; `scripts/generate-share.mjs` can recreate it using the built site and Playwright. Dependency trees, caches, screenshots in scratch, and package archives are ignored; `dist/` is deliberately included.
