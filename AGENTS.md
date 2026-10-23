# AGENTS.md — Blackjack · The Green Room

Local-first, single-player Blackjack web game (React 19 + TypeScript strict + Vite 6). This file routes you to current guidance and states the hard rules; start a design-area visit from `docs/design/README.md`. Product scope authority is `docs/prd.md`; requirement implementation and acceptance evidence belong in `docs/requirements/`.

## Context Loading Order

Always read this file first, then route by task type — read ONLY the listed docs plus the related code/tests:

| Task type                                              | Read                                                                                                                                                           |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement work                                       | `docs/requirements/index.md` → locate the REQ/Issue → that requirement file + its linked design docs + related code/tests                                      |
| Architecture / module boundaries / build / CI          | `docs/architecture.md` (+ related ADRs in `docs/adr/`)                                                                                                         |
| Rules / payouts / commands / rule variants             | `docs/design/game-rules.md` + `src/domain/`                                                                                                                    |
| Contest mode design / implementation                   | `docs/design/contest-rules.md` + `docs/adr/ADR-004-contest-turns-and-shared-boundaries.md` + `docs/contracts/contest-save-format.md` (+ `src/domain/contest/`) |
| State, animation queue, refresh recovery, tab conflict | `docs/design/state-and-animation.md` + `src/application/classic/useGame.ts`                                                                                    |
| Save validation / import-export / migration            | `docs/design/persistence.md` + `docs/contracts/save-format.md` + `src/infrastructure/classic/save.ts`                                                          |
| UI / visuals / copy / i18n                             | `docs/design/ui.md` + `src/presentation/`                                                                                                                      |
| Testing cadence / release gates                        | `docs/testing.md`                                                                                                                                              |
| Roadmap / "is X planned?"                              | `docs/roadmap.md`                                                                                                                                              |

Do NOT read all of `docs/` by default. Product scope conflicts resolve to `docs/prd.md`.

## Requirement Workflow

- Source priority: GitHub Issue > `docs/requirements/active/*.md` > design docs. Register every new requirement first (Issue or `docs/requirements/`); never write requirement bodies into the PRD. Implemented behavior is described by design docs; tag related code/tests with `@req REQ-YYYY-NNN` or `@issue #123`.
- Since REQ-016, self-review plus the applicable task-level checks in `docs/testing.md` completes acceptance: record the evidence in that requirement, mark done, and archive it. Each requirement ends as exactly one document; intermediate artifacts (acceptance reports, handoffs, plans) are distilled into it and deleted.
- Root READMEs cover product, usage, setup and the high-level roadmap. Keep implementation summaries, acceptance evidence and release verification in the corresponding requirement; do not place progress or branch/commit logs in guidance.

## Hard Constraints

1. **`src/domain/` stays pure TypeScript** — no React, no browser APIs; randomness is injected → `docs/design/game-rules.md`
2. **Commit authoritative state before animations** — `transition` computes everything, `useGame` persists first, the queue only replays event snapshots; animation callbacks never determine payouts → `docs/design/state-and-animation.md`
3. **Money is integer hundredths of a chip** (100 = one chip); main wagers are positive multiples of 100; insurance is half the wager, multiples of 50 → `docs/design/game-rules.md` §4
4. **Validate imported saves before replacing progress**; unsupported versions are rejected, never guessed — format changes bump versions and update `docs/contracts/save-format.md`
5. **Every user-visible string goes into BOTH dictionaries** in `src/presentation/i18n.ts` (en + zh-CN); no hardcoded copy → `docs/design/ui.md`
6. **Rule variants only via the `rules` parameter** of classic `transition`; pinned `RuleSet` fields mean "not implemented" — implementing one = bump `rulesVersion` → `docs/adr/ADR-001-ruleset-parameterization.md`. Contest has independent `transition`/`legalActions` with one frozen rules snapshot per Match → `docs/adr/ADR-004-contest-turns-and-shared-boundaries.md`
7. **Keep both READMEs (en + zh-CN) in sync** when behavior or setup commands change; check cadence follows `docs/testing.md` (task-level once per task, full gate before release)
8. **Keep the READMEs and this file lean** — root READMEs stay user-facing and AGENTS.md stays routing + hard rules; current process, directory/stack detail and other specifics belong in the relevant `docs/` guidance
9. **Maintain all guidance in place** — every document under `docs/` except `docs/requirements/`, plus module guidance, describes current rules, explicit plans or their rationale. Consolidate existing topics; never append progress or acceptance logs. Keep task evidence in requirements and decision rationale in ADRs with explicit validity. Put REQ-bound cleanup in that REQ and milestone triggers in the owning document; agents follow those triggers, rewrite changed topics, and add a topic only for a new responsibility.

## Commands

```bash
npm ci               # install from lockfile (Node.js 24.x ≥24.22.1 or 26.x ≥26.12.1)
npm run dev          # Vite dev server, http://127.0.0.1:5173
npm test             # Vitest: domain rules + save validation (colocated *.test.ts)
npm run typecheck    # strict TypeScript
npm run format       # Prettier: src, docs, both READMEs, AGENTS.md, configs
npm run format:check # check only
npm run build        # tsc -b + vite build → dist/
npm run preview      # serve dist/, http://127.0.0.1:4173
```

No lint script — Prettier is the style gate. `start-game.bat` / `start-game.command` / `LICENSE` are intentionally excluded from Prettier (the `.bat` must stay pure ASCII with CRLF).

## CI (GitHub Actions)

`.github/workflows/ci.yml` gates pushes to `main` / `codex/**` and PRs: dependency audit (fails on high/critical), `npm test`, `npm run build`. Dependabot opens weekly dependency and Actions PRs. Keep the audit clean by upgrading dependencies — never suppress advisories; workflow actions stay pinned by commit SHA. Details → `docs/architecture.md` §4.

## Boundaries and Known Quirks

- **Four layers**: `domain/` (pure rules) ← `application/` (`useGame` coordination) ← `presentation/` (React UI); `infrastructure/` (save, audio) used by application/presentation. The UI never bypasses `transition` and never touches localStorage directly → `docs/architecture.md` §2. Tests are colocated `*.test.ts` with injected fixed card sequences (`src/domain/classic/testHelpers.ts`).
- `vite.config.ts` pins `base: "./"` and the single-file dist so the release works over `file://` → [ADR-002](docs/adr/ADR-002-singlefile-release-build.md). Don't change either.
- Intentional quirks are documented in their design docs — do not "clean up" what looks odd: `.table-meta` `z-index: 1` (`docs/design/ui.md`), the `effectId` monotonic counter (`docs/design/state-and-animation.md`), the absent balance cap and the transient `dealer` phase (`docs/contracts/save-format.md`).
