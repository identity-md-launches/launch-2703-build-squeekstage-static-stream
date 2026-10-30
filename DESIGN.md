# SqueekStage design

## Overview

SqueekStage is a broadcast desk for the Squeekchain hamster stream: a compact live dashboard, a camera overlay, and a direct tipping form. A gold hamster inside a calibrated wheel is the single illustrative idea. Large stable numbers lead, monospace labels explain their units, and rounded prose keeps the interface approachable. Public readings, uncertain freshness, and simulated data have distinct written states.

The implementation lives in `src/style.css`, `src/components/`, `src/pages.tsx`, and `src/stage.tsx`. The finished export is `dist/`. This document describes the implemented source, including the final responsive overrides.

## Colours

Hex tokens in `src/style.css` are canonical.

| Token             | Value                | Role                                                                 |
| ----------------- | -------------------- | -------------------------------------------------------------------- |
| `--bench`         | `#0b0b0d`            | Page background, dark text on gold actions                           |
| `--panel`         | `#0f0f12`            | Flat data/form surfaces and opaque OBS panels                        |
| `--raised`        | `#18181d`            | Neutral controls and inline state surfaces                           |
| `--line`          | `#26262f`            | Panel boundaries, grid separators, inactive progress tracks          |
| `--ink`           | `#f2f2f4`            | Main text and 2px keyboard focus perimeter                           |
| `--muted`         | `#a1a1ae`            | Supporting copy, units, labels, timestamps                           |
| `--gold`          | `#f2c230`            | Brand, primary action fill, demo/stale state                         |
| `--blue`          | `#5b7cfa`            | Round progress and secondary event graphics                          |
| `--green`         | `#35d07f`            | Live/confirmed state                                                 |
| `--error`         | `#ff9a91`            | Offline, validation, and transaction errors                          |
| `--control-line`  | `#62626e`            | Visible editable-field and neutral-control boundaries                |
| `--control-hover` | `#7d7d89`            | Brighter control boundary on hover                                   |
| `--accent`        | Defaults to `--gold` | Owner-set wheel segments, highlighted heading words, and alert edges |

Primary actions keep the fixed brand gold. Setup can change the overlay/illustration accent. `accentIsReadable()` in `src/lib/format.ts` requires a custom accent to meet 4.5:1 against the panel; Setup explains rejected colours, and imported invalid/dark values fall back to gold. If the panel token changes, update that contrast check too.

Measured default solid pairs against the rendered panel token: ink **17.12:1**, muted **7.49:1**, gold **11.42:1**, blue **5.20:1**, green **9.55:1**, error **9.37:1**. The control boundary is **3.18:1** against the panel. These calculated token pairs accompany the probe’s rendered contrast checks and the route-level Axe scans. Transparent camera regions are not treated as text backgrounds: overlay text sits on opaque panels. Native colour-picker internals and arbitrary future camera images were not audited.

## Typography

All required faces are local WOFF2 files in `public/fonts/`, use `font-display: swap`, and are carried into the export with their OFL notices.

| Family                       | Loaded weight    | Use                                                                           |
| ---------------------------- | ---------------- | ----------------------------------------------------------------------------- |
| Barlow Condensed, sans-serif | 600              | Block height, metric values, round readouts, wheel percentages, alert amounts |
| IBM Plex Mono, monospace     | 400              | Data labels, units, chain identifiers, addresses, timestamps                  |
| Quicksand, sans-serif        | Variable 400–600 | Prose, navigation, headings, controls                                         |

Six application size tokens: `--sm` **12px**, `--body` **16px**, `--sub` **24px**, `--heading` **32px**, `--display` **48px**, `--number` **80px** at the default root size. Only weights 400 and 600 are used. Headings use balanced wrapping, 1.08 desktop line height, and tracking down to −0.04em. Paragraphs use 1.6 line height; long About copy is capped around 66ch. Live values use tabular numerals.

Mobile page titles become 32px and the block readout 48px. Editable fields remain at least 16px. Addresses wrap instead of clipping; intentionally short sender addresses link to the full address. OBS uses proportional `cqw` type so the composition scales as a scene, with readable minima of 14px for key labels and 12px for secondary labels on the actual overlay. The duplicate “of next block” annotation is omitted in the broadcast dial because its progress bar already labels it. The small noninteractive preview scales the scene without those viewport minima.

## Layout

The application shell has a **1384px** maximum width with **48px** desktop side padding, shared between header and content. The footer aligns to the resulting **1288px** content width. A 4px spacing base is supplemented by 26px panel and 30px form insets; gaps usually use 12, 20, 24, or 32px.

The overview places the wheel panel and activity panel in an approximately **1.9:1** grid with a 24px gap, followed by five metrics and a stream-setup action. Controls appear immediately below the compact title on phones. The Tip page uses a 1.3:1 form/leaderboard grid capped at 1100px. Setup uses a 1.2:1 form/links grid. About pairs bounded prose with public data links.

Implemented content breakpoints in `src/style.css`:

- **1150px:** reduce outer padding to 32px and tighten the desktop grid.
- **850px:** move navigation to a second header row, stack major page columns, use a temporary two-column activity arrangement, and three metrics across.
- **520px:** 20px side padding; single-column activity; two-column metrics, with total stake spanning both; two first-screen overview actions; smaller readout/dial; full-width form action; wallet picker becomes a bottom sheet.
- **350px:** 16px side padding, smaller brand, stacked colour/threshold fields.
- **1600px and above:** an additional stage utility/wheel-size refinement; the final `.stage-block` rule remains authoritative at **top 6.5cqw / width 19cqw**.

The stage preview has a **16:9** aspect ratio and a checkerboard camera area. The actual overlay occupies the viewport: wordmark and freshness at the top, block/dial at the left, clear camera space through the middle, five statistics and activity ticker at the bottom, and tip alerts at bottom-right above the statistics. Alerts sit **17cqw** above the bottom. The stage wheel uses **94%** of its available width, refined to **90%** on large scenes, to leave space above the statistics at 720p. The actual overlay has a transparent page/canvas; panels preserve contrast. `obs=1` removes the application shell and normalizes the browser colour scheme to preserve transparency.

Browser validation covered every route at **320, 390, 740, and 1440px**, plus the overlay at **1920×1080 and 1280×720**. No horizontal overflow remained. The 390px first screen contains the product, live block reading, and both main actions. Native 200% zoom and WebKit reflow were not verified.

## Elevation & depth

Panels are flat tonal surfaces with 1px structural borders. There are no card shadows, gradient text, or nested dashboard cards. The wallet picker uses the native dialog top layer, a translucent dark backdrop, and 4px backdrop blur; its background becomes inert. Status callouts use a coloured leading edge and written explanation. The checkerboard is confined to the preview and never becomes an OBS background.

## Shapes

The panel radius token is **12px**. Buttons and wallet rows use **7px**, inputs **6px**, the dialog **16px**, and mobile sheet upper corners **18px**. Broadcast block panels use **10px**; alert and metric-strip corners use **8px**. Status pills and toggles are round. A single 1.5px rounded SVG stroke style carries interface icons; the hamster and favicon are original local SVG artwork. Official wallet marks keep their own colours.

## Components

| Component / source                                                      | Use and behavior                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.button`, `.primary`, `.icon-button`, `.text-button` / `src/style.css` | Neutral, one gold primary, icon, and inline action patterns; explicit hover, pressed, focus-visible, and disabled states. Most targets are 44–46px; sparse inline/header targets may be smaller with space.                                                        |
| `Wheel` / `src/components/Art.tsx`                                      | SVG calibrated ring, bounded percentage, hamster. A 700ms motion runs only when a previously observed settlement changes; no loading entrance is used.                                                                                                             |
| `Progress`, `WheelPanel` / `src/components/Dashboard.tsx`               | Labelled progressbar semantics, gold block progress and blue estimated round progress, stable numeric readouts, source status.                                                                                                                                     |
| `Metrics` / `src/components/Dashboard.tsx`                              | A semantic `dl` with label/value pairs and notes inside the value group; `overlay` removes notes and adapts geometry.                                                                                                                                              |
| `StatusPill`, `FeedNotice` / `src/components/Dashboard.tsx`             | Connecting/live/stale/offline/demo text plus redundant colour/dot. Failed sources retain readings and offer Retry.                                                                                                                                                 |
| `EventFeed` / `src/components/Dashboard.tsx`                            | Five newest events initially, expand to ten, timestamps and explorer destinations; loading and empty states remain meaningful.                                                                                                                                     |
| `WalletUIProvider`, `ConnectButton` / `src/components/Connect.tsx`      | EIP-6963 names/icons, mobile app entry points, Coinbase, pending row, missing-provider/rejection messages, switch network, connected address/disconnect. Native dialog plus explicit Tab boundary handling, Escape, backdrop, close button, and focus restoration. |
| `TipPage` / `src/pages.tsx`                                             | Full recipient before signing, labelled custom amount and presets, balance, exact transfer, pending/confirmed/reverted state, same-log rankings/history.                                                                                                           |
| `CopyField`, `SetupPage` / `src/pages.tsx`                              | Labelled inputs and toggles, field-focused validation, saved-status feedback, copy confirmation and select-to-copy fallback, public shareable settings.                                                                                                            |
| `Stage` / `src/stage.tsx`                                               | `preview` variant is inert and carries no tiny focusable controls. Actual stage exposes pause/next, up to four alert messages, stale/error states, and optional gesture-enabled audio.                                                                             |

Animations are opt-in under `prefers-reduced-motion: no-preference`. Reduced motion disables staged movement, width transitions, and ticker autoplay while retaining written status and manual controls. Hover rules only apply on devices with hover. Native buttons, links, labels, and inputs provide the primary keyboard behavior. Form errors use stable status regions; errors point at fields where applicable.

## Reuse rules

Start a normal page in the existing `page-container` and `page-heading`; reuse flat panels, source-status patterns, and the six type tokens. Put the working control near its explanation. Use gold for the single primary action and a written label alongside state colour. Keep addresses and consequential amounts recoverable and preserve the `dl` relationships in metrics.

For a new route, add the hash mapping in `src/App.tsx`, reuse existing form/list patterns, and verify 320px and 390px before widening the layout. Do not add another font, a second card-elevation system, invented live data, or relay credentials. See `artifacts/validation.md` for the consolidated six-domain review and known verification limits.

Design guidance was adapted from Jakub Krehel’s Better Interface (MIT); the documentation method was adapted from Paul Bakaus’s Impeccable (Apache-2.0). Sources, retained notices, and licences are in `THIRD_PARTY.md` and `LICENSES/interface-guidance.txt`.
