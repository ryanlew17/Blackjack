// @req REQ-2026-027: complete normal standard matches via the actual public controller and independent RNGs.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createContestController } from "./controller";
import { createContestRandomSources } from "./random";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
it.each([0.25, 0.75])(
  "finishes a standard BO5 at seed %s without resampling a choice or replaying skill use",
  (seed) => {
    const sources = createContestRandomSources(() => seed);
    const random = {
      numbers: vi.fn(sources.numbers),
      trumpGate: vi.fn(sources.trumpGate),
      trumpSelection: vi.fn(sources.trumpSelection),
      skillSelection: vi.fn(sources.skillSelection),
      skillEffects: vi.fn(sources.skillEffects),
    };
    const api = createContestController({
      prepareSkills: true,
      random,
      reducedMotion: true,
    });
    api.start();
    api.selectSkill("spirit-sight", api.getPreparationSnapshot()!.inputId);
    api.confirmSkill(api.getPreparationSnapshot()!.inputId);
    const rules = api.snapshot()!.rules;
    let inputs = 0,
      activations = 0,
      paused = false;
    vi.runAllTimers();
    while (api.snapshot()!.phase !== "complete") {
      if (++inputs > 1000) throw new Error("Match did not terminate");
      const view = api.getSnapshot(),
        match = api.snapshot()!;
      expect(view.busy).toBe(false);
      expect(match.rules).toBe(rules);
      if (view.skillCommands.length) {
        const c = view.skillCommands[0];
        if (!paused) {
          api.pause();
          api.resume();
          expect(api.send(c)).toBe(false);
          paused = true;
        }
        expect(api.send(api.getSnapshot().skillCommands[0])).toBe(true);
        activations++;
        expect(api.send(c)).toBe(false);
      } else if (view.actions.includes("NextRound"))
        expect(api.send("NextRound")).toBe(true);
      else
        expect(
          api.send(
            view.actions.includes("Hit") && match.round.hands.human.total! < 17
              ? "Hit"
              : "Stay",
          ),
        ).toBe(true);
      vi.runAllTimers();
    }
    const result = api.snapshot()!;
    expect(Math.max(result.wins.human, result.wins.ai)).toBe(3);
    expect(result.game.number).toBeGreaterThanOrEqual(3);
    expect(result.game.number).toBeLessThanOrEqual(5);
    expect(activations).toBe(2);
    expect(result.round.skills!.human.remainingUses).toBe(0);
    expect(random.skillSelection).toHaveBeenCalledTimes(1);
    expect(random.skillEffects).not.toHaveBeenCalled();
    expect(api.send("Stay")).toBe(false);
    expect(api.send("NextRound")).toBe(false);
    api.restart();
    expect(api.snapshot()).toBeNull();
    expect(api.getPreparationSnapshot()!.selected).toBeNull();
    expect(random.skillSelection).toHaveBeenCalledTimes(1);
    api.exit();
  },
);
