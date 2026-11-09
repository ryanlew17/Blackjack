// @req REQ-2026-028: real search slices, independent seeds and stale-result rejection.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createContestCoordinator } from "./coordinator";
import { runSearchDecision } from "./decision";
import { createSearchSeedSource } from "./random";
import type { ContestDecisionTask } from "./types";
import { fixturePorts } from "../../domain/contest/engine/skillBarrierTestHelpers";
import { decisionCandidates } from "../../domain/contest/ai/candidates";
import {
  searchDecision,
  searchDecisionSteps,
} from "../../domain/contest/ai/search";
import { createBeliefMemory } from "../../domain/contest/ai/memory";
import {
  createMatch,
  projectMatchTransition,
} from "../../domain/contest/engine";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

function setup(ai: "spirit-sight" | "twin-bloom" = "spirit-sight") {
  const ports = fixturePorts({
    first: ai === "twin-bloom" ? "human" : "ai",
    ai,
    prefix: [8, 10, 9, 11],
    aiTrumps: ["draw-2"],
  });
  const jobs: {
    memory: Parameters<ContestDecisionTask>[0];
    seed: number;
    deliver: Parameters<ContestDecisionTask>[2];
    cancel: ReturnType<typeof vi.fn>;
  }[] = [];
  const decision: ContestDecisionTask = (memory, seed, deliver) => {
    const cancel = vi.fn();
    jobs.push({ memory, seed, deliver, cancel });
    return cancel;
  };
  const coordinator = createContestCoordinator({
    random: ports.random,
    roundRules: ports.rules,
    trumpSetup: ports.trumpSetup,
    decision,
    searchSeed: () => 71,
    reducedMotion: true,
  });
  coordinator.start();
  vi.runAllTimers();
  return { coordinator, jobs, ports };
}
function pick(job: ReturnType<typeof setup>["jobs"][number], type = "Stay") {
  return decisionCandidates(job.memory.observation).find(
    (c) => c.type === type,
  )!;
}
it("feeds projected memory, submits one action once and re-observes after replay", () => {
  const { coordinator: c, jobs, ports } = setup();
  expect(jobs).toHaveLength(1);
  expect(jobs[0].memory.observation.round.viewer).toBe("ai");
  expect(jobs[0].seed).toBe(71);
  expect(JSON.stringify(jobs[0].memory)).not.toContain('"deck":');
  const calls = { ...ports.calls };
  const command = pick(jobs[0], "ActivateSkill");
  jobs[0].deliver(command);
  const committed = c.snapshot();
  jobs[0].deliver(command);
  expect(c.snapshot()).toEqual(committed);
  vi.runAllTimers();
  expect(jobs).toHaveLength(2);
  expect(jobs[1].memory).not.toBe(jobs[0].memory);
  expect(jobs[1].memory.succeededSkills.ai).toBe(true);
  expect(ports.calls.numbers).toBe(calls.numbers);
  jobs[1].deliver(pick(jobs[1]));
  vi.runAllTimers();
  expect(c.snapshot()?.round.turn?.player).toBe("human");
});
it.each(["pause", "skip", "hidden", "exit", "restart"] as const)(
  "cancels %s and ignores forced stale delivery without consuming real RNG",
  (action) => {
    const { coordinator: c, jobs, ports } = setup();
    const old = jobs[0],
      command = pick(old);
    if (action === "pause") c.pause();
    if (action === "skip") c.skipAnimations();
    if (action === "hidden") c.setVisible(false);
    if (action === "exit") c.exit();
    if (action === "restart") {
      ports.addMatch();
      c.restart();
    }
    const state = c.snapshot(),
      calls = { ...ports.calls };
    expect(old.cancel).toHaveBeenCalledOnce();
    old.deliver(command);
    expect(c.snapshot()).toEqual(state);
    expect(ports.calls).toEqual(calls);
    if (action === "pause") c.resume();
    if (action === "hidden") c.setVisible(true);
    vi.runAllTimers();
    if (action === "exit") expect(jobs).toHaveLength(1);
    else {
      expect(jobs).toHaveLength(2);
      if (action !== "restart") expect(jobs[1].memory).toBe(old.memory);
      else expect(jobs[1].memory).not.toBe(old.memory);
    }
  },
);
it("keeps manual pause across visibility changes", () => {
  const { coordinator: c, jobs } = setup();
  c.pause();
  c.setVisible(false);
  c.setVisible(true);
  vi.runAllTimers();
  expect(jobs).toHaveLength(1);
  expect(c.getSnapshot().paused).toBe(true);
  c.resume();
  vi.runAllTimers();
  expect(jobs).toHaveLength(2);
});
it("uses the same async port for secret activation and batches pass before exposing authority", () => {
  const { coordinator: c, jobs } = setup("twin-bloom");
  expect(jobs[0].memory.observation.round.reaction?.player).toBe("ai");
  const visible: unknown[] = [];
  c.subscribe(() => visible.push(c.snapshot()?.round.reaction));
  jobs[0].deliver(pick(jobs[0], "ActivateSkill"));
  expect(c.snapshot()?.round.reaction).toBeUndefined();
  expect(visible.every((reaction) => reaction === undefined)).toBe(true);
  vi.runAllTimers();
  expect(jobs).toHaveLength(1);
  expect(
    c
      .getSnapshot()
      .recentEvents.some(
        (e) =>
          e.type === "round" &&
          e.event.type === "skill" &&
          e.event.skillId === "twin-bloom",
      ),
  ).toBe(false);
  c.sendCommand({ type: "Stay", player: "human" });
  vi.runAllTimers();
  expect(jobs).toHaveLength(2);
  expect(jobs[1].memory.observation.round.reaction).toBeUndefined();
});
it("cancels a task invalidated synchronously during setup", () => {
  const ports = fixturePorts({ first: "ai" });
  const cancel = vi.fn();
  const c = createContestCoordinator({
    random: ports.random,
    roundRules: ports.rules,
    trumpSetup: ports.trumpSetup,
    decision: (_m, _s, deliver) => {
      c.pause();
      deliver(null);
      return cancel;
    },
  });
  c.start();
  vi.runAllTimers();
  expect(cancel).toHaveBeenCalledOnce();
  expect(c.getSnapshot().paused).toBe(true);
});
it("drives the same deterministic generator across actual timer slices and cancels delivery", () => {
  const ports = fixturePorts({ first: "ai", prefix: [8, 10, 9, 11] });
  const memory = createBeliefMemory(
    projectMatchTransition(
      createMatch(ports.random, ports.rules, ports.trumpSetup),
      "ai",
    ),
  );
  const limits = { maxDepth: 2, maxNodes: 1000, samples: 1 };
  const iterator = searchDecisionSteps(memory, 17, limits);
  let next = iterator.next(),
    yields = 0;
  while (!next.done) {
    yields++;
    next = iterator.next();
  }
  expect(yields).toBeGreaterThan(1);
  expect(next.value).toEqual(searchDecision(memory, 17, limits));
  const deliver = vi.fn(),
    heartbeat = vi.fn();
  runSearchDecision(memory, 17, deliver);
  setTimeout(heartbeat, 0);
  vi.advanceTimersToNextTimer();
  expect(heartbeat).toHaveBeenCalledOnce();
  expect(deliver).not.toHaveBeenCalled();
  vi.runAllTimers();
  expect(deliver).toHaveBeenCalledExactlyOnceWith(
    searchDecision(memory, 17).command,
  );
  const stopped = vi.fn(),
    cancel = runSearchDecision(memory, 17, stopped);
  vi.advanceTimersToNextTimer();
  cancel();
  vi.runAllTimers();
  expect(stopped).not.toHaveBeenCalled();
});
it("initializes the independent search seed source lazily and reproducibly", () => {
  const entropy = vi.fn(() => 123);
  const a = createSearchSeedSource(entropy),
    b = createSearchSeedSource(() => 123);
  expect(entropy).not.toHaveBeenCalled();
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  expect(entropy).toHaveBeenCalledOnce();
});

it("keeps real commands and all five real RNG streams identical despite different search seeds/work", () => {
  const run = (seed: number, cancelledWork: boolean) => {
    const ports = fixturePorts({
      first: "ai",
      ai: "spirit-sight",
      prefix: [8, 10, 9, 11],
    });
    const seeds = createSearchSeedSource(() => seed);
    const c = createContestCoordinator({
      random: ports.random,
      roundRules: ports.rules,
      trumpSetup: ports.trumpSetup,
      searchSeed: seeds,
      decision: (memory, s, deliver) => {
        searchDecision(memory, s, { maxDepth: 1, maxNodes: 120, samples: 1 });
        const timer = setTimeout(
          () =>
            deliver(
              decisionCandidates(memory.observation).find(
                (c) => c.type === "Stay",
              )!,
            ),
          0,
        );
        return () => clearTimeout(timer);
      },
    });
    c.start();
    if (cancelledWork) {
      c.skipAnimations();
      c.pause();
      c.resume();
      for (let i = 0; i < 20; i++) seeds();
    }
    vi.runAllTimers();
    c.sendCommand({ type: "Stay", player: "human" });
    vi.runAllTimers();
    return { state: c.snapshot(), calls: ports.calls };
  };
  expect(run(7, false)).toEqual(run(987, true));
});

it("re-observes after a trump before scheduling the next skill or ordinary action", () => {
  const { coordinator: c, jobs } = setup();
  jobs[0].deliver(pick(jobs[0], "PlayTrump"));
  const beforeReplay = c.snapshot();
  expect(beforeReplay?.round.turn?.player).toBe("ai");
  expect(jobs).toHaveLength(1);
  vi.runAllTimers();
  expect(jobs).toHaveLength(2);
  expect(jobs[1].memory.observation.round.trumps!.ownHand).toHaveLength(0);
  expect(jobs[1].memory.observation.round.hands.ai.cards).toHaveLength(3);
  jobs[1].deliver(pick(jobs[1], "ActivateSkill"));
  vi.runAllTimers();
  expect(jobs).toHaveLength(3);
  jobs[2].deliver(pick(jobs[2]));
  vi.runAllTimers();
  expect(c.snapshot()?.round.turn?.player).toBe("human");
});
it("resolves a controlled AI turn atomically without calling the decision task", () => {
  const ports = fixturePorts({
    first: "human",
    human: "mind-grip",
    prefix: [8, 10, 9, 11],
  });
  const decision = vi.fn<ContestDecisionTask>(() => () => {});
  const c = createContestCoordinator({
    random: ports.random,
    roundRules: ports.rules,
    trumpSetup: ports.trumpSetup,
    decision,
  });
  c.start();
  vi.runAllTimers();
  expect(
    c.sendCommand({ ...c.getSnapshot().skillCommands[0], player: "human" }),
  ).toBe(true);
  vi.runAllTimers();
  expect(c.sendCommand({ type: "Stay", player: "human" })).toBe(true);
  expect(c.snapshot()?.round.turn?.controlledBy).toBe("human");
  c.pause();
  vi.runAllTimers();
  expect(c.snapshot()?.round.hands.ai.cards).toHaveLength(2);
  c.resume();
  vi.runAllTimers();
  expect(c.snapshot()?.round.hands.ai.cards).toHaveLength(5);
  expect(decision).not.toHaveBeenCalled();
});
