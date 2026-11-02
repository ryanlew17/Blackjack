// @req REQ-2026-027: seals, recurring generation and recovery commit before replay and obey cancellation.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createContestCoordinator } from "./coordinator";
import { legalSkillCommands } from "../../domain/contest/engine";
import { fixturePorts } from "../../domain/contest/engine/skillBarrierTestHelpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("commits hand deletion, seal and disable before the first Nullify replay frame and never repeats on pause/skip", () => {
  const ports = fixturePorts({ humanTrumps: ["noop"], aiTrumps: ["noop"] });
  const api = createContestCoordinator({
    ...ports,
    controlledPlayers: ["human", "ai"],
  });
  api.start();
  api.skipAnimations();
  const command = legalSkillCommands(api.snapshot()!.round)[0];
  expect(api.sendCommand(command)).toBe(true);
  expect(api.snapshot()!.round).toMatchObject({
    skillSeal: { throughRound: 3 },
    trumps: { ownHand: [], opponentHandCount: 0 },
  });
  expect(api.snapshot()!.round.skills!.ai.disabled).toBe(true);
  expect(api.getSnapshot().match!.round.skills!.ai.disabled).toBe(true);
  expect(api.getSnapshot().match!.round.skills!.human.effectActive).toBe(true);
  expect(api.getSnapshot().match!.round.trumps!.ownHand).toHaveLength(1);
  expect(api.getSnapshot().busy).toBe(true);
  expect(api.sendCommand(command)).toBe(false);
  const committed = api.snapshot();
  api.pause();
  api.resume();
  api.skipAnimations();
  api.skipAnimations();
  vi.runAllTimers();
  expect(api.snapshot()).toEqual(committed);
  expect(api.getSnapshot().actions).not.toContain("ActivateSkill");
  expect(ports.calls).toEqual({
    numbers: 11,
    trumpSelection: 0,
    trumpGate: 0,
    skillEffects: 0,
    skillSelection: 0,
  });
  api.exit();
});
it("submits an immune generator under the seal once and projects its generated identity only to its owner", () => {
  const ports = fixturePorts({
    first: "ai",
    ai: "endless-life",
    stock: { noop: 5 },
    humanTrumps: ["noop", "noop", "noop"],
    aiTrumps: ["noop", "noop", "noop"],
  });
  const api = createContestCoordinator({
    ...ports,
    controlledPlayers: ["human", "ai"],
  });
  api.start();
  api.skipAnimations();
  expect(
    api.sendCommand({
      type: "ActivateSkill",
      player: "ai",
      skillId: "endless-life",
      turnNumber: 1,
    }),
  ).toBe(true);
  api.skipAnimations();
  api.sendCommand({ type: "Stay", player: "ai" });
  api.skipAnimations();
  api.sendCommand(legalSkillCommands(api.snapshot()!.round)[0]);
  expect(api.getSnapshot().match!.round.skills!.human.effectActive).toBe(true);
  expect(api.getSnapshot().match!.round.skills!.ai.disabled).toBeUndefined();
  api.skipAnimations();
  expect(api.sendCommand({ type: "Stay", player: "human" })).toBe(true);
  expect(api.snapshot()!.round.trumps!.opponentHandCount).toBe(1);
  expect(api.snapshot()!.round.skills!.ai.activations[0].status).toBe(
    "succeeded",
  );
  expect(ports.calls.skillEffects).toBe(1);
  const committed = api.snapshot();
  api.pause();
  api.resume();
  api.skipAnimations();
  vi.runAllTimers();
  expect(api.snapshot()).toEqual(committed);
  expect(ports.calls.skillEffects).toBe(1);
  const events = api
    .getSnapshot()
    .recentEvents.filter(
      (e) =>
        e.type === "round" &&
        e.event.type === "resource" &&
        e.event.operation === "generate",
    );
  expect(events).toHaveLength(1);
  for (const event of events)
    if (event.type === "round" && event.event.type === "resource")
      expect(event.event.instance).toBeNull();
  expect(ports.calls.trumpSelection).toBe(6);
  api.exit();
});
it.each(["exit", "restart"] as const)(
  "%s during generated-card replay cancels all old callbacks and never resamples the generator",
  (cancel) => {
    const ports = fixturePorts({
      first: "ai",
      ai: "endless-life",
      stock: { noop: 5 },
      humanTrumps: ["noop", "noop", "noop"],
      aiTrumps: ["noop", "noop", "noop"],
    });
    ports.addMatch();
    let cancelled = false,
      generated = 0;
    const api = createContestCoordinator({
      ...ports,
      controlledPlayers: ["human", "ai"],
      onEvent(event) {
        if (
          event.type === "round" &&
          event.event.type === "resource" &&
          event.event.operation === "generate"
        ) {
          generated++;
          if (!cancelled) {
            cancelled = true;
            api[cancel]();
          }
        }
      },
    });
    api.start();
    api.skipAnimations();
    api.sendCommand({
      type: "ActivateSkill",
      player: "ai",
      skillId: "endless-life",
      turnNumber: 1,
    });
    api.skipAnimations();
    api.sendCommand({ type: "Stay", player: "ai" });
    api.skipAnimations();
    api.sendCommand({ type: "Hit", player: "human" });
    vi.runAllTimers();
    expect(cancelled).toBe(true);
    expect(generated).toBe(1);
    expect(ports.calls.skillEffects).toBe(1);
    if (cancel === "exit") expect(api.snapshot()).toBeNull();
    else {
      expect(api.snapshot()!.round.skills!.ai.activations).toEqual([]);
      expect(ports.calls.numbers).toBe(22);
    }
    api.exit();
  },
);
it("commits recovered counters once before feedback and does not activate the skill automatically", () => {
  const ports = fixturePorts({
    human: "spirit-sight",
    humanTrumps: ["skill-revival"],
  });
  const api = createContestCoordinator({
    ...ports,
    controlledPlayers: ["human", "ai"],
  });
  api.start();
  api.skipAnimations();
  api.sendCommand(legalSkillCommands(api.snapshot()!.round)[0]);
  api.skipAnimations();
  expect(
    api.sendCommand({ type: "PlayTrump", player: "human", instanceId: "h-0" }),
  ).toBe(true);
  expect(api.snapshot()!.round.skills!.human).toMatchObject({
    remainingUses: 4,
    gameActivationsRemaining: 1,
  });
  expect(api.getSnapshot().match!.round.skills!.human.remainingUses).toBe(3);
  const committed = api.snapshot();
  api.pause();
  api.resume();
  api.skipAnimations();
  vi.runAllTimers();
  expect(api.snapshot()).toEqual(committed);
  expect(api.snapshot()!.round.skills!.human.activations).toHaveLength(1);
  expect(
    api
      .getSnapshot()
      .recentEvents.filter(
        (e) =>
          e.type === "round" &&
          e.event.type === "trump" &&
          e.event.effect === "skill-recovered",
      ),
  ).toHaveLength(1);
  expect(api.sendCommand(legalSkillCommands(api.snapshot()!.round)[0])).toBe(
    true,
  );
  api.skipAnimations();
  expect(api.snapshot()!.round.skills!.human.activations).toHaveLength(2);
  expect(ports.calls.skillEffects).toBe(0);
  api.exit();
});
it("preserves the seal across NextRound submission and does not repeat blocked opening grants on pause/resume", () => {
  const ports = fixturePorts({
    stock: { noop: 5 },
    humanTrumps: ["noop", "noop", "noop"],
    aiTrumps: ["noop", "noop", "noop"],
  });
  const api = createContestCoordinator({
    ...ports,
    controlledPlayers: ["human", "ai"],
  });
  api.start();
  api.skipAnimations();
  api.sendCommand(legalSkillCommands(api.snapshot()!.round)[0]);
  api.skipAnimations();
  for (let n = 0; n < 4 && api.snapshot()!.phase === "playing"; n++) {
    api.sendCommand({
      type: "Stay",
      player: api.snapshot()!.round.turn!.player,
    });
    api.skipAnimations();
  }
  ports.addRound();
  expect(api.sendCommand({ type: "NextRound" })).toBe(true);
  expect(api.snapshot()!.roundNumber).toBe(2);
  expect(api.snapshot()!.round.skillSeal).toEqual({ throughRound: 3 });
  expect(api.snapshot()!.round.trumps!.ownHand).toEqual([]);
  expect(ports.calls.trumpSelection).toBe(6);
  api.pause();
  api.resume();
  api.skipAnimations();
  expect(
    api
      .getSnapshot()
      .recentEvents.filter(
        (e) =>
          e.type === "round" &&
          e.event.type === "resource" &&
          e.event.operation === "blocked",
      ),
  ).toHaveLength(2);
  expect(ports.calls.trumpSelection).toBe(6);
  api.exit();
});
it("keeps the automatic opponent on the same Hit/Stay baseline even with a legal Endless Life", () => {
  const ports = fixturePorts({
    first: "ai",
    ai: "endless-life",
    stock: { noop: 5 },
    humanTrumps: ["noop", "noop", "noop"],
    aiTrumps: ["noop", "noop", "noop"],
  });
  const opponent = vi.fn(() => "Stay" as const);
  const api = createContestCoordinator({ ...ports, opponent });
  api.start();
  api.skipAnimations();
  vi.advanceTimersByTime(300);
  api.skipAnimations();
  expect(opponent).toHaveBeenCalledTimes(1);
  expect(api.snapshot()!.round.skills!.ai.activations).toEqual([]);
  expect(ports.calls.skillEffects).toBe(0);
  api.exit();
});

// @req REQ-2026-027: Nullify locks secret skills in its first public frame, not after deletion replay.
it.each(["metamorphosis", "soul-transfer"] as const)(
  "immediately shows the AI's active Nullify and human's %s lock without replaying secret preparation publicly",
  (id) => {
    const ports = fixturePorts({ human: id, ai: "nullify" });
    const api = createContestCoordinator({
      ...ports,
      controlledPlayers: ["human", "ai"],
    });
    api.start();
    api.skipAnimations();
    expect(api.sendCommand(legalSkillCommands(api.snapshot()!.round)[0])).toBe(
      true,
    );
    api.skipAnimations();
    expect(api.sendCommand({ type: "Stay", player: "human" })).toBe(true);
    api.skipAnimations();
    expect(
      api.sendCommand({
        type: "ActivateSkill",
        player: "ai",
        skillId: "nullify",
        turnNumber: 2,
      }),
    ).toBe(true);
    const frame = api.getSnapshot().match!.round.skills!;
    expect(frame.ai.effectActive).toBe(true);
    expect(frame.human.disabled).toBe(true);
    expect(frame.human.activations[0].status).toBe("cancelled");
    expect(frame.human.canRecover).toBeUndefined();
    const committed = api.snapshot();
    api.pause();
    api.resume();
    api.skipAnimations();
    vi.runAllTimers();
    expect(api.snapshot()).toEqual(committed);
    expect(ports.calls.skillEffects).toBe(0);
    expect(
      api
        .getSnapshot()
        .recentEvents.filter(
          (e) =>
            e.type === "round" &&
            e.event.type === "skill" &&
            e.event.skillId === id &&
            e.event.status === "cancelled",
        ),
    ).toHaveLength(1);
    api.exit();
  },
);
