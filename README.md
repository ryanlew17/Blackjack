# Blackjack — The Green Room

**English** | [简体中文](./README.zh-CN.md)

A local-first, single-player Blackjack game for the browser, built with **React + TypeScript + Vite**. The green-felt **Classic Mode** brings animated cards and chips, optional sound, and virtual-chip wagers to desktop and mobile screens. A second mode, **Contest Mode** — a point-race duel with consecutive item-card combos inspired by _Resident Evil 7_ — is under development and is not playable yet; see the [roadmap](./docs/roadmap.md).

[PRD](./docs/prd.md) · [Architecture](./docs/architecture.md) · [Design snapshots](./docs/design/) · [Save format](./docs/contracts/save-format.md) · [Testing & verification](./docs/testing.md) · [Contributor guide](./AGENTS.md) · [Card research](./docs/contest-research/)

## Features

- **Classic rules**: hit, stand, double down, undo or clear wagers, and all in.
- **Action hints**: when split, double, or surrender is available, a one-line explainer appears under the action buttons — reachable on touch screens, with desktop tooltips kept.
- **Responsive 2D table**: custom SVG cards and chips, Motion animations, keyboard controls, and reduced-motion support.
- **Bilingual interface**: English and Simplified Chinese, with browser-language detection and a saved language preference.
- **Optional sound**: synthesized card and chip sounds, volume control, and mute.
- **Automatic resume**: restore the current decision point or completed result after a refresh, including during animations.
- **Portable saves**: export a JSON backup and validate it before confirming an import on another device.
- **Local safeguards**: pause on cross-tab changes; keep playing with an export reminder when browser storage is unavailable.
- **About**: open Settings → About for the current version, project repository, MIT license, and GitHub Issues feedback.

## Tech Stack

| Area              | Tools                                                           |
| ----------------- | --------------------------------------------------------------- |
| UI                | React 19, TypeScript in strict mode                             |
| Build             | Vite 6, npm lockfile, vite-plugin-singlefile (single-file dist) |
| Presentation      | Motion, CSS, inline SVG, Web Audio                              |
| State and storage | React reducer, pure rules engine, localStorage                  |
| Quality           | Vitest, Prettier, Playwright CLI browser verification           |

## Getting Started

**Just playing?** Grab the latest release build, unzip it, and double-click
`index.html` — no Node.js or server needed (since v0.1.1; the v0.1.0 package
showed a blank page on double-click, see [ADR-002](./docs/adr/ADR-002-singlefile-release-build.md)).

**Running from source** requires **Node.js 22.12+** and npm.

**Windows** — double-click `start-game.bat`.

**macOS** — double-click `start-game.command`
(first time: if Gatekeeper blocks it, right-click → Open; or run
`bash start-game.command` in a terminal).

**Linux** — run `bash start-game.command`
(or make it executable, then double-click "Run in terminal" in your file manager).

The launcher checks for Node.js, installs dependencies on first run, starts the
game server at `http://127.0.0.1:5173`, and opens your browser automatically.
From a terminal you can always do the same by hand:

```bash
npm ci
npm run dev
```

```bash
npm test              # Rule and save-validation tests
npm run typecheck     # Strict TypeScript checks
npm run format        # Format source, documentation, and configuration
npm run format:check  # Check formatting without changing files
npm run build         # Type-check and build dist/
npm run preview       # Serve dist/, normally on port 4173
```

## Project Structure

```text
src/
  domain/
    classic/          # Existing rules and colocated tests
    contest/          # Candidate data and standalone round engine; AI reserved
    shared/           # Reserved until actual reuse
  application/        # classic coordinator; contest/shared responsibilities reserved
  infrastructure/     # classic save, shared audio; contest persistence reserved
  presentation/       # classic/shared components, i18n; contest pages reserved
  main.tsx            # Existing entry
public/               # Static assets
docs/                 # Architecture, design, contracts, requirements, contest-research
```

`node_modules/`, `dist/`, and `output/` are generated and ignored. Tests remain next to their implementation; no separate test runner or duplicated test tree is required.

The engine commits the authoritative state before the presentation queue runs. Animation callbacks never deduct wagers or settle payouts. Money uses integer hundredths of a chip.

## Table Rules (Classic Mode)

- Start with **2,000 virtual chips**. Each hand uses a freshly shuffled 52-card deck.
- Face cards count as 10; aces count as 1 or 11. The computer is always the dealer.
- Initial natural Blackjacks are checked after the insurance choice when the dealer shows an Ace; otherwise immediately. Two naturals push.
- Natural Blackjack pays **3:2 net**; an ordinary win pays **1:1 net**. A push returns the wager.
- An ordinary 21 ends the player's turn but does not guarantee a win. The dealer stands on every 17, including soft 17.
- Double only on the initial two cards with enough remaining funds: match the wager, draw one card, then stand.
- Wagers use whole chips; balances may include half chips. All in preserves any unbettable half chip.

Splitting, insurance, and late surrender are implemented and independently accepted (2026-09-22):

- Split equal-value initial cards into at most two hands, with no re-splitting. Split aces receive one card each and cannot double; other split hands may double. Split 21 is not a natural Blackjack.
- With a dealer Ace showing, choose insurance before the natural check. Insurance costs half the original wager and pays 2:1 net for dealer Blackjack; the main wager settles independently.
- After dealer Blackjack is ruled out, surrender an unsplit initial hand before hitting or doubling to recover half the main wager. Insurance losses are not refunded.
- Save and rules versions are now v2. v1 and unknown versions are rejected without migration; existing automatic saves are not silently overwritten. Explicitly start over or import a valid v2 backup.

## Saves & Privacy

Progress and preferences stay in the current browser. Clearing site data removes the automatic save; export a `.blackjack.json` file for a separate backup. When a rejected legacy or corrupt save is loaded, the export entry is hidden because the in-memory progress is a fresh placeholder — importing a valid v2 backup restores it. Saves are unencrypted, editable single-player data and do not provide anti-cheat protection. No accounts, telemetry, ads, or backend are included.

## Deployment

Run `npm run build` to produce a **single-file `dist/`** (all JavaScript and CSS
inlined into `index.html`). Distribute it as-is: double-clicking `index.html`
works over `file://` in Chrome, Edge, Firefox, and Safari, and the same folder
can be uploaded to any static HTTP/HTTPS host at root or in a subdirectory —
no client-side routing fallback is required.

There is no Service Worker or guaranteed offline relaunch. Browser verification results and outstanding platform checks are documented in [testing & verification](./docs/testing.md).

## Roadmap

Splitting, insurance, and late surrender are implemented and independently accepted (REQ-2026-003–006, archived). See the [technical roadmap](./docs/roadmap.md) and [requirements index](./docs/requirements/index.md).

1. M0: register requirements and align planning documentation.
2. M1: shared rules v2 state, settlement, and save validation.
3. M2: split into at most two hands, with turn sequencing and independent settlement.
4. M3: insurance decisions before checking dealer Blackjack, with independent payouts.
5. M4: late surrender, integration checks, and a single rules/save v2 release.

Milestones have no calendar commitments; M1–M3 are development checkpoints, not separate releases. v2 rejects v1 and unknown saves without migration. Existing automatic saves must not be silently overwritten; starting over requires an explicit user choice.

The local single-player scope was established on 2026-09-23: LAN play, online deployment, and accounts/cloud saves are explicit non-goals. The **Contest Mode** baseline was revised on 2026-10-04 (S0–S5, first shipping as v0.2.0): BO3/BO5/BO7/BO9 matches by difficulty retain first-to-5 games with an extending target (4:4 → first to 7, 6:6 → first to 9). Each round shares one number card of each value 1–11; a coin flip sets the initial first player, then first play alternates each round. A player may use consecutive item cards before drawing or staying to end their turn, and staying allows later decisions. Item acquisition is separate from the number deck; probabilities, card pools, and scoring effects await validation. The difficulty chain and codex remain, only meta-progress is saved, and refreshing abandons the match. Contest Mode remains under development and is not available in the playable interface. Classic rules and saves remain v2.

See [AGENTS.md](./AGENTS.md) before contributing. Keep documentation in both languages aligned when changing behavior or setup commands.

## License

Released under the [MIT License](./LICENSE).
