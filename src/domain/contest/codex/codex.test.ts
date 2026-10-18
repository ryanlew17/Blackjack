// @req REQ-2026-013
import { describe, expect, it } from "vitest";
import {
  createCodexProgress,
  recordEncounter,
  markViewed,
  parseCodexProgress,
  listCodexItems,
  listUnlockedIds,
  firstUnviewedId,
  codexSummary,
} from "./index";
import type { CodexUpdate } from "./types";
function success(result: CodexUpdate) {
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe("codex progress and observations", () => {
  it("starts with metadata-free locked entries and no discoveries", () => {
    const progress = createCodexProgress();
    expect(codexSummary(progress)).toEqual({
      total: 21,
      unlocked: 0,
      unviewed: 0,
    });
    expect(firstUnviewedId(progress)).toBeUndefined();
    expect(listUnlockedIds(progress)).toEqual([]);
    for (const item of listCodexItems(progress))
      expect(Object.keys(item)).toEqual(["id", "status"]);
  });
  it.each(["self-received", "opponent-revealed"] as const)(
    "unlocks on %s once, without mutating the old progress",
    (kind) => {
      const original = createCodexProgress();
      const first = success(
        recordEncounter(original, "standard", { kind, cardId: "return" }),
      );
      expect(first.newlyUnlocked).toEqual(["return"]);
      expect(original).toEqual({});
      expect(first.progress.return).toEqual({ unlocked: true, viewed: false });
      const viewed = success(markViewed(first.progress, "return"));
      expect(viewed.progress.return?.viewed).toBe(true);
      const again = success(
        recordEncounter(viewed.progress, "standard", {
          kind,
          cardId: "return",
        }),
      );
      expect(again.progress).toBe(viewed.progress);
      expect(again.newlyUnlocked).toEqual([]);
      expect(first.progress.return?.viewed).toBe(false);
    },
  );
  it("ignores hidden encounters and all custom-mode discoveries", () => {
    const original = createCodexProgress();
    expect(
      success(
        recordEncounter(original, "standard", { kind: "opponent-hidden" }),
      ).progress,
    ).toBe(original);
    for (const kind of ["self-received", "opponent-revealed"] as const) {
      const update = success(
        recordEncounter(original, "custom", { kind, cardId: "harvest" }),
      );
      expect(update.progress).toBe(original);
      expect(update.newlyUnlocked).toEqual([]);
    }
  });
  it("does not unlock when viewing a locked entry; rejects unknown identities", () => {
    const original = createCodexProgress();
    expect(success(markViewed(original, "draw-2")).progress).toBe(original);
    expect(markViewed(original, "__proto__")).toEqual({
      ok: false,
      error: "unknown-card",
    });
    expect(
      recordEncounter(original, "standard", {
        kind: "self-received",
        cardId: "new-card",
      }),
    ).toEqual({ ok: false, error: "unknown-card" });
  });
  it("uses catalog order rather than discovery order for badges and next unread", () => {
    const a = success(
      recordEncounter(createCodexProgress(), "standard", {
        kind: "self-received",
        cardId: "harvest",
      }),
    ).progress;
    const b = success(
      recordEncounter(a, "standard", {
        kind: "opponent-revealed",
        cardId: "draw-2",
      }),
    ).progress;
    expect(firstUnviewedId(b)).toBe("draw-2");
    expect(listUnlockedIds(b)).toEqual(["draw-2", "harvest"]);
    const c = success(markViewed(b, "draw-2")).progress;
    expect(firstUnviewedId(c)).toBe("harvest");
    expect(codexSummary(c)).toEqual({ total: 21, unlocked: 2, unviewed: 1 });
    const visible = listCodexItems(c);
    expect(visible[0]).toMatchObject({
      status: "viewed",
      definition: { id: "draw-2" },
    });
    expect(visible.at(-1)).toMatchObject({
      status: "new",
      definition: { id: "harvest" },
    });
  });
  it("treats an explicit locked entry like an absent entry", () => {
    const parsed = parseCodexProgress({
      return: { unlocked: false, viewed: false },
    });
    if (!parsed.ok) throw new Error(parsed.error);
    expect(success(markViewed(parsed.progress, "return")).progress).toBe(
      parsed.progress,
    );
    const next = success(
      recordEncounter(parsed.progress, "standard", {
        kind: "self-received",
        cardId: "return",
      }),
    );
    expect(next.progress.return).toEqual({ unlocked: true, viewed: false });
  });
});

describe("codex payload boundary", () => {
  it("round-trips all three states without sharing mutable input objects", () => {
    const input = {
      "draw-2": { unlocked: false, viewed: false },
      return: { unlocked: true, viewed: false },
      harvest: { unlocked: true, viewed: true },
    };
    const parsed = parseCodexProgress(JSON.parse(JSON.stringify(input)));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.progress).toEqual(input);
    expect(Object.isFrozen(parsed.progress)).toBe(true);
    expect(Object.isFrozen(parsed.progress.harvest)).toBe(true);
    input.harvest.viewed = false;
    expect(parsed.progress.harvest?.viewed).toBe(true);
  });
  it.each([null, [], 3, "{}", new Date()])(
    "rejects non-record payload %s",
    (input) => {
      expect(parseCodexProgress(input)).toEqual({
        ok: false,
        error: "invalid-object",
      });
    },
  );
  it.each([
    { return: { unlocked: false, viewed: true } },
    { return: { unlocked: 1, viewed: false } },
    { return: { unlocked: true } },
    { return: { unlocked: true, viewed: "false" } },
    { return: { unlocked: true, viewed: false, instanceId: "leak" } },
    { return: null },
    { return: [] },
  ])("rejects malformed entries %j", (input) => {
    expect(parseCodexProgress(input)).toEqual({
      ok: false,
      error: "invalid-entry",
    });
  });
  it("rejects unknown/prototype keys atomically and never repairs corrupt progress", () => {
    for (const key of ["unreleased", "constructor", "__proto__"]) {
      const input = JSON.parse(
        `{"return":{"unlocked":true,"viewed":true},"${key}":{"unlocked":true,"viewed":false}}`,
      );
      const before = JSON.stringify(input);
      expect(parseCodexProgress(input)).toEqual({
        ok: false,
        error: "unknown-card",
      });
      expect(JSON.stringify(input)).toBe(before);
    }
  });
});
