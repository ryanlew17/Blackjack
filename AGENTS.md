# AGENTS.md — Blackjack · The Green Room

Local-first, single-player Blackjack web game (React 19 + TypeScript strict + Vite 6). Product positioning, scope and non-goals live in `docs/prd.md`.

## Context Loading Order

Always read this file first, then route by task type — read ONLY the listed docs plus the related code/tests:

| Task type                                              | Read                                                                                                                                                                                                |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement work                                       | `docs/requirements/index.md` → locate the REQ/Issue → that requirement file + its linked design docs + related code/tests                                                                           |
| Architecture / module boundaries / build               | `docs/architecture.md` (+ related ADRs in `docs/adr/`)                                                                                                                                              |
| Rules / payouts / commands / rule variants             | `docs/design/game-rules.md` + `src/domain/`                                                                                                                                                         |
| Contest mode design / implementation                   | `docs/design/contest-rules.md` + `docs/adr/ADR-004-contest-turns-and-shared-boundaries.md` + `docs/contracts/contest-save-format.md` (+ `src/domain/contest/` for data; ADR-003 is partial history) |
| State, animation queue, refresh recovery, tab conflict | `docs/design/state-and-animation.md` + `src/application/classic/useGame.ts`                                                                                                                         |
| Save validation / import-export / migration            | `docs/design/persistence.md` + `docs/contracts/save-format.md` + `src/infrastructure/classic/save.ts`                                                                                               |
| UI / visuals / copy / i18n                             | `docs/design/ui.md` + `src/presentation/`                                                                                                                                                           |
| Testing cadence / release gates                        | `docs/testing.md`                                                                                                                                                                                   |
| Roadmap / "is X planned?"                              | `docs/roadmap.md`                                                                                                                                                                                   |

Do NOT read all of `docs/` by default. Product scope conflicts resolve to `docs/prd.md`.

## Requirement Source Priority

GitHub Issue > `docs/requirements/active/*.md` > design docs. Register every new requirement first (Issue or `docs/requirements/`); never write requirement bodies into the PRD. Implemented behavior is described by design docs; tag related code/test comments with `@req REQ-YYYY-NNN` or `@issue #123`.

## Acceptance and Documentation Workflow

- From REQ-016 onward, self-review plus the applicable task-level checks in `docs/testing.md` completes requirement acceptance. Record the evidence, mark done, and archive the requirement; do not wait for a separate per-requirement review. S1's overall external review and final user acceptance completed on 2026-10-21; the cycle is closed. Evidence is archived in REQ-2026-020.
- READMEs describe the product, usage, setup, and high-level roadmap. Keep development progress, acceptance records, branch/commit status, and release verification in the appropriate `docs/` files, not in README appendices.

## Hard Constraints

1. **`src/domain/` stays pure TypeScript** — no React, no browser APIs; randomness is injected → `docs/design/game-rules.md`
2. **Commit authoritative state before animations; animation callbacks never determine payouts** — `transition` computes everything, `useGame` persists first, the queue only replays event snapshots → `docs/design/state-and-animation.md`
3. **Money is integer hundredths of a chip** (100 = one chip); main wagers are positive multiples of 100; insurance is half the original wager and may be a multiple of 50 → `docs/design/game-rules.md` §4
4. **Validate imported saves before replacing progress**; unsupported versions are rejected, never guessed — format changes bump versions and update `docs/contracts/save-format.md`
5. **Every user-visible string goes into BOTH dictionaries** in `src/presentation/i18n.ts` (en + zh-CN); no hardcoded copy → `docs/design/ui.md`
6. **Classic rule variants only via the `rules` parameter** of classic `transition`; pinned `RuleSet` literal fields mean "not implemented" — changing one = implement the rule + bump `rulesVersion` → `docs/adr/ADR-001-ruleset-parameterization.md`. Contest has independent `transition`/`legalActions` with one frozen rules snapshot per Match → `docs/adr/ADR-004-contest-turns-and-shared-boundaries.md`
7. Keep both READMEs (en + zh-CN) in sync when behavior or setup commands change; follow the check cadence in `docs/testing.md` — task-level checks run once when finishing a task, and the full gate (build + browser acceptance) applies only before a release.

## Commands

```bash
npm ci               # install from lockfile (Node.js ≥ 22.12)
npm run dev          # Vite dev server, http://127.0.0.1:5173
npm test             # Vitest: domain rules + save validation (colocated *.test.ts)
npm run typecheck    # strict TypeScript
npm run format       # Prettier: src, docs, both READMEs, AGENTS.md, configs
npm run format:check # check only
npm run build        # tsc -b + vite build → dist/
npm run preview      # serve dist/, http://127.0.0.1:4173
```

No lint script — Prettier is the style gate. `start-game.bat` / `start-game.command` / `LICENSE` are intentionally excluded from Prettier (the `.bat` must stay pure ASCII with CRLF).

## Architecture Boundaries (strict)

- **Four layers**: `domain/` (pure rules) ← `application/` (`useGame` coordination) ← `presentation/` (React UI); `infrastructure/` (save, audio) is used by application/presentation. The UI never bypasses `transition` to compute results, and never touches localStorage directly — only through the `useGame` API → `docs/architecture.md` §2
- Tests live beside implementation as `*.test.ts` with injected fixed card sequences (`src/domain/classic/testHelpers.ts`); no separate test tree.
- `vite.config.ts` pins relative asset paths (`base: "./"`) and builds a **single-file dist** via `vite-plugin-singlefile`, so the release works when opened directly over `file://` — subdirectory static hosting still works. Don't change either; the rationale is [ADR-002](docs/adr/ADR-002-singlefile-release-build.md).

## Docs Pointers

- `docs/prd.md` — positioning / users / non-goals (authoritative for scope).
- `docs/architecture.md` — stack, layers, directory layout, build & deploy.
- `docs/design/` — per-module behavior snapshots (start from its README index).
- `docs/contracts/save-format.md` — classic save format v2 fields and validation rules; `docs/contracts/contest-save-format.md` — contest save (unlocks + codex, S0 draft).
- `docs/requirements/` — incremental requirements (`index.md` + `active/` + `archive/`); each requirement ends as exactly one document (background / approach / acceptance criteria / acceptance record / change log) — intermediate artifacts (acceptance reports, handoffs, implementation plans) are distilled into the requirement document and then deleted; template included.
- `docs/adr/` — decision records; ADR-004 partially supersedes ADR-003 for Contest turns, shared boundaries, and AI information. `docs/roadmap.md` — rules v2 history, the Contest Mode program (S0–S5, v0.2.0 line; S0 revised 2026-10-04; S1 complete, S2–S5 pending), and retired candidates (LAN/online/cloud are non-goals; multi-deck stays dropped).
- `docs/testing.md` — check cadence (during work / task finish / release), browser acceptance, known boundaries, past verification records.

## Deliberate Quirks — do not "clean up"

- `.table-meta` keeps `z-index: 1`: the absolutely-positioned `.dealer-zone` overlaps it and would swallow clicks on the history button (browser-verified 2026-09-22, zero visual change).
- `effectId` is a monotonically increasing counter, not an event index — identical consecutive events must still retrigger animations.
- Saves have **no fixed balance cap** (only non-negative safe integers): any reachable game state must round-trip through export/import.
- The `dealer` phase is a synchronous internal transient — never persisted, rejected on import; this is intentional, not a missing state.

## 前置模块开发（REQ-012/013）

图鉴数据任务读取 `docs/design/codex-data.md` 与对应需求；完整竞赛玩法仍按上表读取。REQ-012、REQ-013 已分别验收归档。该前置批次按用户要求未构建、未版本迭代、未 release，已执行测试、类型、格式与静态导入/迁移自审；后续任务仍按各自要求及测试门槛执行。目录迁移后的职责见 `docs/architecture.md`，新目录只有 README 时代表预留而非实现。
