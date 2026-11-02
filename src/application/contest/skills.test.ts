// @req REQ-2026-027: opt-in authority/replay integration without exposing unfinished UI actions.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createContestCoordinator } from "./coordinator";
import { fixedRandom } from "../../domain/contest/engine/testHelpers";
import { legalSkillCommands } from "../../domain/contest/engine/skills";
import type { NumberValue } from "../../domain/contest/types";
import type { MatchEventView, RoundRules } from "../../domain/contest/engine";

const rules: RoundRules = {
  version: 1,
  pointTarget: 21,
  skills: {
    difficulty: "standard",
    playableDifficulties: ["standard"],
    selected: { human: "spirit-sight", ai: "spirit-sight" },
  },
};
function ports(
  prefix: readonly NumberValue[] = [10, 8, 11, 9],
  samples: readonly number[] = [],
) {
  const shuffle = fixedRandom(prefix);
  const effects = [...samples];
  let coin = true;
  const unexpected = vi.fn(() => {
    throw new Error("Unexpected randomness");
  });
  return {
    numbers: vi.fn(() => (coin ? ((coin = false), 0.25) : shuffle())),
    trumpGate: unexpected,
    trumpSelection: unexpected,
    skillSelection: unexpected,
    skillEffects: vi.fn(() =>
      effects.length ? effects.shift()! : unexpected(),
    ),
  };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("commits skill use and private knowledge before replay; pause/resume/skip cannot execute it twice", () => {
  const random = ports(),
    api = createContestCoordinator({
      roundRules: rules,
      random,
      controlledPlayers: ["human", "ai"],
    });
  api.start();
  api.skipAnimations();
  const command = legalSkillCommands(api.snapshot()!.round)[0];
  expect(api.sendCommand(command)).toBe(true);
  expect(api.getSnapshot().busy).toBe(true);
  expect(api.getSnapshot().match!.round.hands.ai.cards[0].value).toBeNull();
  expect(api.snapshot()!.round.hands.ai.cards[0]).toEqual({
    value: 8,
    faceDown: true,
  });
  expect(api.snapshot()!.round.skills!.human.remainingUses).toBe(1);
  expect(api.sendCommand(command)).toBe(false);
  api.pause();
  expect(api.getSnapshot().match!.round.hands.ai.cards[0].value).toBe(8);
  api.resume();
  api.skipAnimations();
  api.skipAnimations();
  vi.runAllTimers();
  expect(api.snapshot()!.round.skills!.human.remainingUses).toBe(1);
  expect(
    api
      .getSnapshot()
      .recentEvents.filter(
        (e) => e.type === "round" && e.event.type === "skill",
      ),
  ).toHaveLength(2);
  expect(api.getSnapshot().busy).toBe(false);
  expect(random.numbers).toHaveBeenCalledTimes(11);
  expect(random.skillEffects).not.toHaveBeenCalled();
  api.exit();
  expect(api.sendCommand(command)).toBe(false);
});
it("supplies lazy five-stream defaults for explicitly configured skill matches without resource rules", () => {
  const seed = vi.spyOn(Math, "random").mockReturnValue(0.25);
  const api = createContestCoordinator({
    roundRules: rules,
    controlledPlayers: ["human", "ai"],
  });
  expect(seed).not.toHaveBeenCalled();
  api.start();
  expect(api.snapshot()!.round.skills!.human.initialUses).toBe(2);
  expect(seed).toHaveBeenCalledTimes(5);
  api.exit();
});
it("invalidates old skill replay callbacks when an event subscriber exits", () => {
  const seen: MatchEventView[] = [];
  const api = createContestCoordinator({
    roundRules: rules,
    random: ports(),
    controlledPlayers: ["human", "ai"],
    onEvent: (event) => {
      seen.push(event);
      if (event.type === "round" && event.event.type === "skill") api.exit();
    },
  });
  api.start();
  api.skipAnimations();
  const command = legalSkillCommands(api.snapshot()!.round)[0];
  expect(api.sendCommand(command)).toBe(true);
  vi.runAllTimers();
  expect(api.snapshot()).toBeNull();
  expect(api.getSnapshot().match).toBeNull();
  expect(
    seen.filter((e) => e.type === "round" && e.event.type === "skill"),
  ).toHaveLength(1);
});

// @req REQ-2026-027: a private opposing preparation is invisible to public replay; settlement is committed once.
it("keeps opposing Metamorphosis out of feedback and busy state, then commits its random result before replay", () => {
  const random = ports([8, 1, 9, 2], [0.999999]);
  const seen: MatchEventView[] = [];
  const api = createContestCoordinator({
    roundRules: {
      ...rules,
      skills: {
        ...rules.skills!,
        selected: { human: "spirit-sight", ai: "metamorphosis" },
      },
    },
    random,
    controlledPlayers: ["human", "ai"],
    onEvent: (event) => seen.push(event),
  });
  api.start();
  api.skipAnimations();
  expect(api.sendCommand({ type: "Stay", player: "human" })).toBe(true);
  api.skipAnimations();
  const before = api.getSnapshot(),
    seenBefore = seen.length;
  const command = {
    type: "ActivateSkill" as const,
    player: "ai" as const,
    skillId: "metamorphosis" as const,
    turnNumber: api.snapshot()!.round.turn!.number,
  };
  expect(api.sendCommand(command)).toBe(true);
  const after = api.getSnapshot();
  expect(after.match).toEqual(before.match);
  expect(api.snapshot()).toEqual(before.match);
  expect(after.busy).toBe(false);
  expect(after.thinking).toBe(false);
  expect(after.effectId).toBe(before.effectId);
  expect(after.event).toBeNull();
  expect(after.recentEvents).toEqual(before.recentEvents);
  expect(after.actions).toEqual(before.actions);
  expect(after.trumpCommands).toEqual(before.trumpCommands);
  expect(seen).toHaveLength(seenBefore);
  expect(api.sendCommand(command)).toBe(false);
  expect(random.skillEffects).not.toHaveBeenCalled();
  expect(api.sendCommand({ type: "Stay", player: "ai" })).toBe(true);
  expect(random.skillEffects).toHaveBeenCalledTimes(1);
  expect(api.snapshot()!.phase).toBe("round-complete");
  expect(api.snapshot()!.round.result!.totals).toEqual({ human: 17, ai: 13 });
  expect(api.snapshot()!.round.hands.ai.cards[0]).toEqual({
    value: 11,
    faceDown: false,
  });
  expect(api.getSnapshot().busy).toBe(true);
  api.pause();
  api.resume();
  api.skipAnimations();
  api.skipAnimations();
  vi.runAllTimers();
  expect(random.skillEffects).toHaveBeenCalledTimes(1);
  expect(random.numbers).toHaveBeenCalledTimes(11);
  expect(random.skillSelection).not.toHaveBeenCalled();
  expect(random.trumpGate).not.toHaveBeenCalled();
  expect(random.trumpSelection).not.toHaveBeenCalled();
  expect(
    api
      .getSnapshot()
      .recentEvents.filter(
        (e) => e.type === "round" && e.event.type === "skill",
      ),
  ).toHaveLength(1);
  expect(api.getSnapshot().busy).toBe(false);
  api.exit();
});
it("invalidates old settlement replay callbacks after exit without rolling the skill result again", () => {
  const random = ports([1, 8, 9, 2], [0]);
  const seen: MatchEventView[] = [];
  const api = createContestCoordinator({
    roundRules: {
      ...rules,
      skills: {
        ...rules.skills!,
        selected: { human: "metamorphosis", ai: "spirit-sight" },
      },
    },
    random,
    controlledPlayers: ["human", "ai"],
    onEvent: (event) => {
      seen.push(event);
      if (
        event.type === "round" &&
        event.event.type === "skill" &&
        event.event.status === "succeeded"
      )
        api.exit();
    },
  });
  api.start();
  api.skipAnimations();
  expect(api.sendCommand(legalSkillCommands(api.snapshot()!.round)[0])).toBe(
    true,
  );
  api.skipAnimations();
  expect(api.snapshot()!.round.skills!.human.remainingUses).toBe(1);
  expect(api.sendCommand({ type: "Stay", player: "human" })).toBe(true);
  api.skipAnimations();
  expect(api.sendCommand({ type: "Stay", player: "ai" })).toBe(true);
  expect(random.skillEffects).toHaveBeenCalledTimes(1);
  vi.runAllTimers();
  expect(api.snapshot()).toBeNull();
  expect(api.getSnapshot().match).toBeNull();
  expect(random.skillEffects).toHaveBeenCalledTimes(1);
  expect(
    seen.filter(
      (e) =>
        e.type === "round" &&
        e.event.type === "skill" &&
        e.event.status === "succeeded",
    ),
  ).toHaveLength(1);
  expect(seen.some((e) => e.type === "round-scored")).toBe(false);
});
