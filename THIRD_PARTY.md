# Third-party notices

## Design and documentation guidance

This implementation applied the supplied, locally pinned Better Interface guidance, adapted from [Jakub Krehel’s Better Interface](https://github.com/jakubkrehel/skills/tree/267330e1adfc66a718fb65fa6918c1f06d0a689e/skills/better-interface), commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`, MIT, copyright 2026 Jakub Krehel.

The design documentation method was adapted from [Paul Bakaus’s Impeccable document reference](https://github.com/pbakaus/impeccable/blob/9d715cc4f5564a990ca8345abfdd5df6dc9b41c8/skill/reference/document.md), commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`, Apache-2.0, copyright 2025 Paul Bakaus. The adaptation describes SqueekStage’s implemented source and its validation, rather than supplying a general guide.

Both licence texts and notices are preserved in [LICENSES/interface-guidance.txt](LICENSES/interface-guidance.txt). They apply to their respective included works, not as a relicensing of the site or each other.

## Fonts

Barlow Condensed, IBM Plex Mono, and Quicksand are distributed under the SIL Open Font License. Local Latin WOFF2 files are bundled; corresponding original notices are in `public/fonts/*-OFL.txt` and are copied to `dist/fonts/`.

Font sources: [Barlow Condensed](https://github.com/google/fonts/tree/main/ofl/barlowcondensed), [IBM Plex Mono](https://github.com/google/fonts/tree/main/ofl/ibmplexmono), [Quicksand](https://github.com/google/fonts/tree/main/ofl/quicksand). The fonts were fetched from Google Fonts’ public CSS/font distribution and are served locally at runtime.

## Wallet marks and connection references

MetaMask, Rabby, and Phantom SVG marks were taken from [RainbowKit’s wallet connector assets](https://github.com/rainbow-me/rainbowkit/tree/main/packages/rainbowkit/src/wallets/walletConnectors). RainbowKit’s MIT licence is preserved in [LICENSES/rainbowkit.txt](LICENSES/rainbowkit.txt). Wallet brands and marks remain their owners’ trademarks. The local Coinbase mark follows the supplied connector reference.

Provider selection follows the supplied wallet connector guide, implemented using [Wagmi createConfig](https://wagmi.sh/react/api/createConfig) with multi-provider discovery and [Coinbase Wallet](https://wagmi.sh/react/api/connectors/coinbaseWallet). Mobile links follow [MetaMask](https://docs.metamask.io/metamask-connect/evm/guides/metamask-exclusive/use-deeplinks), [Coinbase](https://docs.cdp.coinbase.com/wallet-sdk/docs/deep-link), and [Phantom](https://docs.phantom.com/phantom-deeplinks/other-methods/browse) patterns. Rabby’s current command/query form was verified against its [universal-link handler](https://github.com/RabbyHub/rabby-mobile/blob/develop/apps/mobile/src/hooks/universalLink.ts) and [production path constants](https://github.com/RabbyHub/rabby-mobile/blob/develop/apps/mobile/src/constant/universalLink.ts). Physical app handoff was not performed.

## Application dependencies and artwork

React, Vite, TypeScript, Wagmi, Viem, TanStack Query, Coinbase Wallet SDK, Playwright, Axe, Prettier, and their dependencies retain their respective upstream licences. Exact dependency versions are fixed by `package-lock.json`; dependency trees are not submitted. The Vite production bundles retain generated licence comments where supplied by dependencies.

The hamster drawing, wheel construction, favicon, and share-card composition were authored for SqueekStage. There is no third-party camera footage or stock photograph in the export.
