// @req REQ-2026-027: explicit reactions gate real AI/forced commands and share cancellation/replay.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createContestCoordinator } from "./coordinator";
import { createContestController } from "./controller";
import { fixedRandom } from "../../domain/contest/engine/testHelpers";
import type { MatchEventView, RoundRules } from "../../domain/contest/engine";
import type { SkillId } from "../../domain/contest/skills/catalog";
import type { PlayerId } from "../../domain/contest/types";

function setup(
  options: {
    human?: SkillId;
    ai?: SkillId;
    first?: PlayerId;
    matches?: number;
  } = {},
) {
  const numbers: number[] = [];
  for (let n = 0; n < (options.matches ?? 1); n++) {
    numbers.push(options.first === "human" ? 0.25 : 0.75);
    const source = fixedRandom([10, 8, 11, 9, 1, 2, 3]);
    for (let k = 0; k < 10; k++) numbers.push(source());
  }
  const unexpected = () => {
    throw new Error("Unexpected random stream");
  };
  const random = {
    numbers: vi.fn(() => (numbers.length ? numbers.shift()! : unexpected())),
    trumpGate: vi.fn(unexpected),
    trumpSelection: vi.fn(unexpected),
    skillSelection: vi.fn(unexpected),
    skillEffects: vi.fn(unexpected),
  };
  const roundRules: RoundRules = {
    version: 1,
    pointTarget: 21,
    skills: {
      difficulty: "danger",
      playableDifficulties: ["danger"],
      selected: {
        human: options.human ?? "twin-bloom",
        ai: options.ai ?? "spirit-sight",
      },
    },
    trumps: { tableCapacity: 5, definitions: { noop: { onPlay: [] } } },
  };
  const trumpSetup = {
    human: [{ instanceId: "h-0", definitionId: "noop" }],
    ai: [{ instanceId: "a-0", definitionId: "noop" }],
  };
  return { random, roundRules, trumpSetup };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("offers a stable explicit human decision after replay and waits indefinitely before AI thinking", () => {
  const ports = setup(),
    opponent = vi.fn(() => "Stay" as const);
  const api = createContestCoordinator({ ...ports, opponent });
  api.start();
  expect(api.getSnapshot().busy).toBe(true);
  expect(api.getSnapshot().reaction).toBeNull();
  api.skipAnimations();
  const decision = api.getSnapshot().reaction!;
  expect(decision.activate).toMatchObject({
    player: "human",
    type: "ActivateSkill",
    skillId: "twin-bloom",
    turnNumber: 1,
    reactionBoundary: 1,
  });
  expect(api.getSnapshot()).toMatchObject({
    busy: false,
    thinking: false,
    actions: ["ActivateSkill", "PassReaction"],
    trumpCommands: [],
  });
  vi.advanceTimersByTime(10000);
  expect(api.getSnapshot().reaction).toBe(decision);
  expect(opponent).not.toHaveBeenCalled();
  expect(api.sendCommand({ type: "Hit", player: "human" })).toBe(false);
  expect(api.sendCommand(decision.pass)).toBe(true);
  expect(api.getSnapshot().reaction).toBeNull();
  expect(api.getSnapshot().thinking).toBe(true);
  vi.advanceTimersByTime(299);
  expect(opponent).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(opponent).toHaveBeenCalledTimes(1);
  api.skipAnimations();
  expect(api.snapshot()!.round.turn!.player).toBe("human");
  expect(api.snapshot()!.round.skills!.human.remainingUses).toBe(2);
  api.exit();
});
it("passes the baseline AI through the same authority boundary without a timer or skill use", () => {
  const ports = setup({
    first: "human",
    human: "spirit-sight",
    ai: "twin-bloom",
  });
  const opponent = vi.fn(() => "Stay" as const);
  const api = createContestCoordinator({ ...ports, opponent });
  api.start();
  api.skipAnimations();
  expect(api.getSnapshot().busy).toBe(false);
  expect(api.getSnapshot().reaction).toBeNull();
  expect(api.snapshot()!.round.reaction).toBeUndefined();
  expect(api.getSnapshot().actions).toContain("Hit");
  expect(
    api.sendCommand({ type: "PlayTrump", player: "human", instanceId: "h-0" }),
  ).toBe(true);
  api.skipAnimations();
  expect(api.getSnapshot().busy).toBe(false);
  expect(api.getSnapshot().actions).toContain("Stay");
  expect(api.snapshot()!.round.skills!.ai.activations).toEqual([]);
  expect(opponent).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
  api.exit();
});
it("never reopens a passed boundary on skip/resume and authorizes a new same-Turn window after a real card command", () => {
  const ports = setup();
  const api = createContestCoordinator({
    ...ports,
    controlledPlayers: ["human", "ai"],
  });
  api.start();
  api.skipAnimations();
  const first = api.getSnapshot().reaction!;
  expect(api.sendCommand(first.pass)).toBe(true);
  api.skipAnimations();
  api.pause();
  api.resume();
  api.skipAnimations();
  expect(api.getSnapshot().reaction).toBeNull();
  expect(api.sendCommand(first.activate)).toBe(false);
  expect(
    api.sendCommand({ type: "PlayTrump", player: "ai", instanceId: "a-0" }),
  ).toBe(true);
  expect(api.getSnapshot().reaction).toBeNull();
  api.skipAnimations();
  const next = api.getSnapshot().reaction!;
  expect(next.activate.turnNumber).toBe(first.activate.turnNumber);
  expect(next.activate.reactionBoundary).toBe(2);
  expect(api.sendCommand(first.pass)).toBe(false);
  expect(
    api.sendCommand({ ...next.activate, inputId: first.activate.inputId }),
  ).toBe(false);
  expect(api.sendCommand(next.activate)).toBe(true);
  api.skipAnimations();
  expect(api.getSnapshot().reaction).toBeNull();
  expect(api.snapshot()!.round.skills!.human.remainingUses).toBe(1);
  expect(api.sendCommand(next.activate)).toBe(false);
  api.exit();
});
it.each(["pause", "skipAnimations"] as const)(
  "%s preserves the opportunity while invalidating its previous application token",
  (cancel) => {
    const ports = setup();
    const api = createContestCoordinator({
      ...ports,
      controlledPlayers: ["human", "ai"],
    });
    api.start();
    api.skipAnimations();
    const old = api.getSnapshot().reaction!;
    api[cancel]();
    expect(api.sendCommand(old.activate)).toBe(false);
    if (cancel === "pause") {
      expect(api.getSnapshot().reaction).toBeNull();
      api.resume();
    }
    const renewed = api.getSnapshot().reaction!;
    expect(renewed.activate.reactionBoundary).toBe(
      old.activate.reactionBoundary,
    );
    expect(renewed.activate.inputId).not.toBe(old.activate.inputId);
    expect(api.sendCommand(old.pass)).toBe(false);
    expect(api.sendCommand(renewed.pass)).toBe(true);
    expect(api.snapshot()!.round.skills!.human.remainingUses).toBe(2);
    api.exit();
  },
);
it.each(["exit", "restart"] as const)(
  "%s invalidates an old window even when a new Match has the same Round/Turn/boundary",
  (cancel) => {
    const ports = setup({ matches: 2 });
    const api = createContestCoordinator({
      ...ports,
      controlledPlayers: ["human", "ai"],
    });
    api.start();
    api.skipAnimations();
    const old = api.getSnapshot().reaction!;
    api[cancel]();
    if (cancel === "exit") api.start();
    api.skipAnimations();
    expect(api.snapshot()!.roundNumber).toBe(1);
    expect(api.getSnapshot().reaction!.activate.reactionBoundary).toBe(
      old.activate.reactionBoundary,
    );
    expect(api.sendCommand(old.activate)).toBe(false);
    expect(api.sendCommand(old.pass)).toBe(false);
    expect(api.sendCommand(api.getSnapshot().reaction!.activate)).toBe(true);
    api.skipAnimations();
    expect(ports.random.numbers).toHaveBeenCalledTimes(22);
    api.exit();
  },
);
it("requires an application token in addition to a valid engine reaction command", () => {
  const ports = setup();
  const api = createContestCoordinator({
    ...ports,
    controlledPlayers: ["human", "ai"],
  });
  api.start();
  api.skipAnimations();
  const decision = api.getSnapshot().reaction!;
  const { inputId: _activate, ...activate } = decision.activate;
  const { inputId: _pass, ...pass } = decision.pass;
  expect(api.sendCommand(activate)).toBe(false);
  expect(api.sendCommand(pass)).toBe(false);
  expect(api.getSnapshot().reaction).toBe(decision);
  api.exit();
});
it("keeps an AI's secret preparation plus pass identical to a pass in the complete human application view", () => {
  const a = setup({ first: "human", human: "spirit-sight", ai: "twin-bloom" });
  const b = setup({ first: "human", human: "spirit-sight", ai: "twin-bloom" });
  const left = createContestCoordinator({
    ...a,
    controlledPlayers: ["human", "ai"],
  });
  const right = createContestCoordinator({
    ...b,
    controlledPlayers: ["human", "ai"],
  });
  left.start();
  right.start();
  left.skipAnimations();
  right.skipAnimations();
  expect(left.getSnapshot().actions).toEqual([]);
  const inputId = left.getSnapshot().inputId;
  const common = {
    player: "ai" as const,
    turnNumber: 1,
    reactionBoundary: 1,
    inputId,
  };
  expect(
    left.sendCommand({
      ...common,
      type: "ActivateSkill",
      skillId: "twin-bloom",
    }),
  ).toBe(true);
  expect(right.sendCommand({ ...common, type: "PassReaction" })).toBe(true);
  expect(left.snapshot()).toEqual(right.snapshot());
  expect(left.getSnapshot()).toEqual(right.getSnapshot());
  expect(left.getSnapshot()).toMatchObject({
    busy: false,
    thinking: false,
    reaction: null,
  });
  expect(a.random.skillEffects).not.toHaveBeenCalled();
  left.exit();
  right.exit();
});
it("commits the copy before its first replay frame and never repeats on pause/resume/skip", () => {
  const ports = setup(),
    opponent = vi.fn(() => "Stay" as const);
  const api = createContestCoordinator({ ...ports, opponent });
  api.start();
  api.skipAnimations();
  const originalHidden = api.snapshot()!.round.hands.human.cards[0];
  expect(api.sendCommand(api.getSnapshot().reaction!.activate)).toBe(true);
  api.skipAnimations();
  expect(api.getSnapshot().thinking).toBe(true);
  vi.advanceTimersByTime(300);
  expect(opponent).toHaveBeenCalledTimes(1);
  expect(api.snapshot()!.round.hands.human.cards.map((c) => c.value)).toEqual([
    8, 11,
  ]);
  expect(
    api.getSnapshot().match!.round.hands.human.cards.map((c) => c.value),
  ).toEqual([8, 9]);
  expect(api.getSnapshot().busy).toBe(true);
  expect(api.getSnapshot().reaction).toBeNull();
  const authoritative = api.snapshot();
  api.pause();
  api.resume();
  api.skipAnimations();
  api.skipAnimations();
  vi.runAllTimers();
  expect(api.snapshot()).toEqual(authoritative);
  expect(api.snapshot()!.round.hands.human.cards[0]).toEqual(originalHidden);
  expect(api.getSnapshot().busy).toBe(false);
  expect(api.getSnapshot().reaction).toBeNull();
  expect(ports.random.numbers).toHaveBeenCalledTimes(11);
  expect(ports.random.skillEffects).not.toHaveBeenCalled();
  expect(ports.random.trumpSelection).not.toHaveBeenCalled();
  api.exit();
});
it("preserves an armed copy while pausing the AI command before submission", () => {
  const ports = setup(),
    opponent = vi.fn(() => "Stay" as const);
  const api = createContestCoordinator({ ...ports, opponent });
  api.start();
  api.skipAnimations();
  api.sendCommand(api.getSnapshot().reaction!.activate);
  api.skipAnimations();
  api.pause();
  vi.runAllTimers();
  expect(opponent).not.toHaveBeenCalled();
  expect(api.snapshot()!.round.skills!.human.activations[0].status).toBe(
    "prepared",
  );
  expect(api.snapshot()!.round.hands.human.cards[1].value).toBe(9);
  api.resume();
  vi.advanceTimersByTime(300);
  api.skipAnimations();
  expect(api.snapshot()!.round.skills!.human.activations[0].status).toBe(
    "succeeded",
  );
  expect(api.snapshot()!.round.hands.human.cards[1].value).toBe(11);
  expect(opponent).toHaveBeenCalledTimes(1);
  api.exit();
});
it("silently passes later cover windows after a secret use without offering a useless human decision", () => {
  const ports = setup();
  const api = createContestCoordinator({
    ...ports,
    controlledPlayers: ["human", "ai"],
  });
  api.start();
  api.skipAnimations();
  api.sendCommand(api.getSnapshot().reaction!.activate);
  api.skipAnimations();
  expect(api.getSnapshot().reaction).toBeNull();
  expect(
    api.sendCommand({ type: "PlayTrump", player: "ai", instanceId: "a-0" }),
  ).toBe(true);
  api.skipAnimations();
  expect(api.getSnapshot().reaction).toBeNull();
  expect(api.snapshot()!.round.reaction).toBeUndefined();
  expect(api.getSnapshot().busy).toBe(false);
  expect(api.sendCommand({ type: "Stay", player: "ai" })).toBe(true);
  api.skipAnimations();
  expect(api.snapshot()!.round.skills!.human.activations[0].status).toBe(
    "succeeded",
  );
  api.exit();
});
it.each(["pause", "exit", "restart", "pass"] as const)(
  "honors synchronous subscriber %s at the reaction publication before scheduling any AI command",
  (cancel) => {
    const ports = setup({ matches: 2 }),
      opponent = vi.fn(() => "Stay" as const);
    const api = createContestCoordinator({ ...ports, opponent });
    let cancelled = false;
    api.subscribe(() => {
      const decision = api.getSnapshot().reaction;
      if (!cancelled && decision) {
        cancelled = true;
        if (cancel === "pass") api.sendCommand(decision.pass);
        else api[cancel]();
      }
    });
    api.start();
    api.skipAnimations();
    vi.advanceTimersByTime(300);
    expect(opponent).toHaveBeenCalledTimes(cancel === "pass" ? 1 : 0);
    if (cancel === "pause") {
      expect(api.getSnapshot().paused).toBe(true);
      api.resume();
      expect(api.getSnapshot().reaction).not.toBeNull();
    }
    if (cancel === "exit") expect(api.snapshot()).toBeNull();
    if (cancel === "restart") {
      api.skipAnimations();
      expect(api.getSnapshot().reaction).not.toBeNull();
      expect(ports.random.numbers).toHaveBeenCalledTimes(22);
    }
    api.exit();
  },
);
it.each(["exit", "restart"] as const)(
  "%s during the copy replay invalidates all remaining old callbacks",
  (cancel) => {
    const ports = setup({ matches: 2 }),
      seen: MatchEventView[] = [];
    let cancelled = false;
    const api = createContestCoordinator({
      ...ports,
      onEvent(event) {
        seen.push(event);
        if (
          !cancelled &&
          event.type === "round" &&
          event.event.type === "skill" &&
          event.event.skillId === "twin-bloom" &&
          event.event.status === "prepared" &&
          event.state.round.turn?.player === "human"
        ) {
          cancelled = true;
          expect(
            api.snapshot()!.round.hands.human.cards.map((c) => c.value),
          ).toEqual([8, 11]);
          api[cancel]();
        }
      },
    });
    api.start();
    api.skipAnimations();
    api.sendCommand(api.getSnapshot().reaction!.activate);
    api.skipAnimations();
    vi.runAllTimers();
    expect(cancelled).toBe(true);
    const copyEvents = seen.filter(
      (e) =>
        e.type === "round" &&
        e.event.type === "skill" &&
        e.event.skillId === "twin-bloom" &&
        e.event.status === "prepared" &&
        e.state.round.turn?.player === "human",
    );
    expect(copyEvents).toHaveLength(1);
    if (cancel === "exit") expect(api.snapshot()).toBeNull();
    else {
      expect(
        api.snapshot()!.round.hands.human.cards.map((c) => c.value),
      ).toEqual([8, 9]);
      expect(api.getSnapshot().reaction).not.toBeNull();
      expect(ports.random.numbers).toHaveBeenCalledTimes(22);
    }
    api.exit();
  },
);
it("handles a copy before Mind Grip takeover and commits three forced Hits only after the whole previous command replay", () => {
  const ports = setup({ ai: "mind-grip" }),
    opponent = vi.fn(() => "Stay" as const);
  const api = createContestCoordinator({
    ...ports,
    opponent,
    controlledPlayers: ["human", "ai"],
  });
  api.start();
  api.skipAnimations();
  api.sendCommand(api.getSnapshot().reaction!.pass);
  expect(
    api.sendCommand({
      type: "ActivateSkill",
      player: "ai",
      skillId: "mind-grip",
      turnNumber: 1,
    }),
  ).toBe(true);
  api.skipAnimations();
  const decision = api.getSnapshot().reaction!;
  expect(api.sendCommand(decision.activate)).toBe(true);
  api.skipAnimations();
  expect(api.sendCommand({ type: "Stay", player: "ai" })).toBe(true);
  expect(api.snapshot()!.round.turn).toMatchObject({
    player: "human",
    controlledBy: "ai",
    number: 2,
  });
  expect(api.snapshot()!.round.hands.human.cards.map((c) => c.value)).toEqual([
    8, 11,
  ]);
  expect(api.getSnapshot().busy).toBe(true);
  api.pause();
  vi.runAllTimers();
  expect(api.snapshot()!.round.hands.human.cards).toHaveLength(2);
  api.resume();
  expect(api.snapshot()!.round.hands.human.cards.map((c) => c.value)).toEqual([
    8, 11, 1, 2, 3,
  ]);
  expect(api.snapshot()!.round.turn!.number).toBe(3);
  expect(api.sendCommand(decision.activate)).toBe(false);
  expect(api.getSnapshot().actions).not.toContain("ResolveForcedTurn");
  api.skipAnimations();
  api.skipAnimations();
  vi.runAllTimers();
  expect(api.snapshot()!.round.hands.human.cards).toHaveLength(5);
  expect(api.getSnapshot().reaction).toBeNull();
  expect(opponent).not.toHaveBeenCalled();
  expect(ports.random.numbers).toHaveBeenCalledTimes(11);
  api.exit();
});
it("keeps unfinished skill and reaction inputs outside the normal controller", () => {
  const ports = setup({ first: "human" });
  const api = createContestController({ random: ports.random });
  api.start();
  api.skipAnimations();
  expect(api.send("PassReaction" as never)).toBe(false);
  expect(
    api.send({
      type: "ActivateSkill",
      player: "human",
      skillId: "twin-bloom",
      turnNumber: 1,
      reactionBoundary: 1,
      inputId: api.getSnapshot().inputId,
    } as never),
  ).toBe(false);
  api.exit();
});
