# Blackjack — The Green Room

**English** | [简体中文](./README.zh-CN.md)

A local-first, single-player Blackjack game for the browser. Play the classic green-felt table against the dealer, or take on an opponent in **Contest Mode** — a shared-number-deck duel inspired by _Resident Evil 7_. Everything runs locally: no accounts, no telemetry, no backend. Built with React, TypeScript, and Vite.

## Features

- **Two tables**: Classic restores your saved table; Contest starts a standard best-of-five duel with alternating turns, round points, an extending game target, and a deterministic opponent.
- **Full classic rules**: hit, stand, double down, split, insurance, late surrender, undo or clear wagers, and all in.
- **Action hints**: when split, double, or surrender is available, a one-line explainer appears under the action buttons — reachable on touch screens, with desktop tooltips kept.
- **Responsive 2D table**: custom SVG cards and chips, smooth animations, keyboard controls, and reduced-motion support.
- **Bilingual interface**: English and Simplified Chinese, with browser-language detection and a saved language preference.
- **Optional sound**: synthesized card and chip sounds, volume control, and mute.
- **Classic resume**: refresh opens the home screen; entering Classic restores the current decision point or completed result, including after an animation interruption. Contest matches stay in memory and are abandoned on leaving or refresh.
- **Portable saves**: export a JSON backup and validate it before confirming an import on another device.
- **Local safeguards**: pause on cross-tab changes; keep playing with an export reminder when browser storage is unavailable.
- **About panel**: open Settings → About for the current version, project repository, MIT license, and GitHub Issues feedback.

## Play right away

Download the latest release build, unzip it, and double-click `index.html` — no Node.js or server needed. The single-file build runs over `file://` in Chrome, Edge, Firefox, and Safari, and the same folder can be uploaded to any static HTTP/HTTPS host, at the root or in a subdirectory. There is no Service Worker: a hosted copy needs the server reachable while you play.

## Table rules (Classic Mode)

- Start with **2,000 virtual chips**. Each hand uses a freshly shuffled 52-card deck.
- Face cards count as 10; aces count as 1 or 11. The computer is always the dealer.
- Initial natural Blackjacks are checked after the insurance choice when the dealer shows an Ace; otherwise immediately. Two naturals push.
- Natural Blackjack pays **3:2 net**; an ordinary win pays **1:1 net**. A push returns the wager.
- An ordinary 21 ends the player's turn but does not guarantee a win. The dealer stands on every 17, including soft 17.
- Double only on the initial two cards with enough remaining funds: match the wager, draw one card, then stand.
- Split equal-value initial cards into at most two hands, with no re-splitting. Split aces receive one card each and cannot double; other split hands may double. Split 21 is not a natural Blackjack.
- With a dealer Ace showing, choose insurance before the natural check: it costs half the original wager and pays 2:1 net for dealer Blackjack; the main wager settles independently.
- After dealer Blackjack is ruled out, surrender an unsplit initial hand before hitting or doubling to recover half of the main wager. Insurance losses are not refunded.
- Wagers use whole chips; balances may include half chips. All in preserves any unbettable half chip.

## Contest Mode

A duel variant inspired by the 21-point game in _Resident Evil 7_. Each round deals from a shared deck containing the numbers 1–11 exactly once; both players start with two cards, first cards stay hidden, and play alternates between hit and stay until two consecutive stays reveal both hands. The match is a best-of-five: first to 5 game points wins, with ties extending the target at 4:4 and 6:6. The standard no-trump match is playable now — item cards, difficulty selection, the codex, and combination-search AI are on the roadmap. Full rules live in [contest-rules.md](./docs/design/contest-rules.md).

## Saves & privacy

Classic progress and shared preferences stay in your browser; nothing leaves your machine. Export a `.blackjack.json` backup and import it on another device — files are validated before anything is replaced. Very old (v1) or corrupt saves are rejected rather than guessed: import a valid backup or explicitly start over. Clearing site data removes the automatic save. Contest matches are never saved. Saves are unencrypted, editable single-player data without anti-cheat protection. No accounts, telemetry, ads, or backend are included.

## Run from source

Requires **Node.js 24.x ≥24.22.1 or 26.x ≥26.12.1** and npm.

```bash
npm ci
npm run dev        # http://127.0.0.1:5173
```

- **Windows** — double-click `start-game.bat`.
- **macOS** — double-click `start-game.command` (first time: if Gatekeeper blocks it, right-click → Open, or run `bash start-game.command`).
- **Linux** — run `bash start-game.command` (or make it executable, then double-click "Run in terminal").

The launcher checks for Node.js, installs dependencies on first run, starts the dev server, and opens your browser. Run `npm run build` to produce a distributable single-file `dist/`; `npm test`, `npm run typecheck`, and `npm run format` cover quality checks. Read [AGENTS.md](./AGENTS.md) before contributing, and keep both READMEs aligned when behavior or setup commands change.

## Roadmap

Classic rules and saves are complete and stable (v2). The Contest Mode program is in progress: the standard no-trump best-of-five is available, while item cards, difficulty selection, the codex, custom matches, and smarter AI are still planned. LAN/online play, accounts, and cloud saves are explicit non-goals. See the [technical roadmap](./docs/roadmap.md) and [requirements index](./docs/requirements/index.md).

## Documentation

[PRD](./docs/prd.md) · [Architecture](./docs/architecture.md) · [Design snapshots](./docs/design/) · [Save formats](./docs/contracts/) · [Testing & verification](./docs/testing.md) · [Contributor guide](./AGENTS.md)

## License

Released under the [MIT License](./LICENSE).
