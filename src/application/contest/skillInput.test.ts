// @req REQ-2026-027: the production public gateway authorizes only current human skill/reaction inputs.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createContestController } from "./controller";
import { createContestCoordinator } from "./coordinator";
import { sendContestInput } from "./input";
import { fixturePorts } from "../../domain/contest/engine/skillBarrierTestHelpers";
import { ADMITTED_TRUMP_DEFINITIONS } from "../../domain/contest/trumps/admitted";
import type { ContestInput } from "./types";

function standard() {
  const random = {
    numbers: vi.fn(() => 0.25),
    trumpSelection: vi.fn(() => 0),
    trumpGate: vi.fn(() => 0.99),
    skillSelection: vi.fn(() => 0),
    skillEffects: vi.fn(() => 0),
  };
  const api = createContestController({ prepareSkills: true, random });
  const begin = () => {
    api.start();
    api.selectSkill("spirit-sight", api.getPreparationSnapshot()!.inputId);
    api.confirmSkill(api.getPreparationSnapshot()!.inputId);
    api.skipAnimations();
  };
  begin();
  return { api, random, begin };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("publishes canonical human commands, commits once before replay, and rejects repeat/forced inputs", () => {
  const { api, random } = standard();
  const command = api.getSnapshot().skillCommands[0];
  expect(command).toMatchObject({
    type: "ActivateSkill",
    skillId: "spirit-sight",
    turnNumber: 1,
  });
  expect(command).not.toHaveProperty("player");
  expect(Object.isFrozen(command)).toBe(true);
  expect(api.send(command)).toBe(true);
  expect(api.snapshot()!.round.skills!.human.remainingUses).toBe(1);
  expect(api.snapshot()!.round.hands.ai.cards[0].value).not.toBeNull();
  expect(api.getSnapshot().busy).toBe(true);
  expect(api.getSnapshot().skillCommands).toEqual([]);
  expect(api.send(command)).toBe(false);
  expect(
    api.send({
      type: "ResolveForcedTurn",
      player: "human",
      turnNumber: 1,
    } as never),
  ).toBe(false);
  api.skipAnimations();
  expect(api.getSnapshot().skillCommands).toEqual([]);
  expect(random.skillEffects).not.toHaveBeenCalled();
  expect(random.skillSelection).toHaveBeenCalledTimes(1);
  api.exit();
});
it("rejects wrong skill/turn/boundary, stale generation and opposing ownership without spending", () => {
  const { api } = standard(),
    command = api.getSnapshot().skillCommands[0];
  for (const invalid of [
    { ...command, skillId: "fortune" },
    { ...command, turnNumber: 9 },
    { ...command, inputId: command.inputId - 1 },
    { ...command, reactionBoundary: 99 },
    { ...command, player: "ai" },
  ])
    expect(api.send(invalid as ContestInput)).toBe(false);
  expect(api.snapshot()!.round.skills!.human.remainingUses).toBe(2);
  expect(api.send(command)).toBe(true);
  api.exit();
});
it.each(["pause", "skip", "exit", "restart"] as const)(
  "expires a public skill input after %s",
  (operation) => {
    const { api } = standard(),
      old = api.getSnapshot().skillCommands[0];
    if (operation === "pause") {
      api.pause();
      expect(api.send(old)).toBe(false);
      api.resume();
    } else if (operation === "skip") api.skipAnimations();
    else if (operation === "exit") api.exit();
    else {
      api.restart();
      api.selectSkill("spirit-sight", api.getPreparationSnapshot()!.inputId);
      api.confirmSkill(api.getPreparationSnapshot()!.inputId);
      api.skipAnimations();
    }
    expect(api.send(old)).toBe(false);
    if (api.snapshot())
      expect(api.snapshot()!.round.skills!.human.remainingUses).toBe(2);
    api.exit();
  },
);
it("keeps the reaction open until a current public pass and rejects an older complete-command boundary", () => {
  const ports = fixturePorts({ human: "twin-bloom", first: "ai" });
  const api = createContestCoordinator({
    ...ports,
    controlledPlayers: ["human", "ai"],
  });
  const send = (action: ContestInput) =>
    sendContestInput(action, api.getSnapshot(), api.sendCommand);
  api.start();
  api.skipAnimations();
  const first = api.getSnapshot().reaction!;
  vi.advanceTimersByTime(10000);
  expect(api.getSnapshot().reaction).toBe(first);
  expect(send({ ...first.pass, player: "ai" } as never)).toBe(false);
  expect(send(first.pass)).toBe(true);
  expect(send(first.activate)).toBe(false);
  expect(api.getSnapshot().reaction).toBeNull();
  expect(api.sendCommand({ type: "Hit", player: "ai" })).toBe(true);
  api.skipAnimations();
  // AI Hit hands the Turn to human; human Stay creates the next opposing Turn.
  expect(api.sendCommand({ type: "Stay", player: "human" })).toBe(true);
  api.skipAnimations();
  const next = api.getSnapshot().reaction!;
  expect(next.pass.inputId).not.toBe(first.pass.inputId);
  expect(send(first.pass)).toBe(false);
  expect(send(first.activate)).toBe(false);
  expect(
    send({
      ...next.activate,
      reactionBoundary: first.activate.reactionBoundary,
    }),
  ).toBe(false);
  expect(send(next.activate)).toBe(true);
  expect(api.snapshot()!.round.skills!.human.activations[0].status).toBe(
    "prepared",
  );
  expect(api.getSnapshot().reaction).toBeNull();
  expect(api.snapshot()!.round.turn!.player).toBe("ai");
  expect(ports.calls.skillEffects).toBe(0);
  api.exit();
});
it("reissues an undecided reaction after pause/skip, without letting the old token pass", () => {
  const ports = fixturePorts({ human: "twin-bloom", first: "ai" });
  const api = createContestCoordinator({
    ...ports,
    controlledPlayers: ["human", "ai"],
  });
  const send = (action: ContestInput) =>
    sendContestInput(action, api.getSnapshot(), api.sendCommand);
  api.start();
  api.skipAnimations();
  const old = api.getSnapshot().reaction!;
  api.pause();
  expect(send(old.activate)).toBe(false);
  api.resume();
  api.skipAnimations();
  expect(send(old.pass)).toBe(false);
  const next = api.getSnapshot().reaction!;
  expect(next.pass.reactionBoundary).toBe(old.pass.reactionBoundary);
  expect(send(next.pass)).toBe(true);
  expect(send(next.pass)).toBe(false);
  api.exit();
});
it("activates again through the same public gateway after admitted Skill Revival restores the Game permission", () => {
  const ports = fixturePorts({
    human: "spirit-sight",
    humanTrumps: ["skill-revival"],
  });
  expect(ports.rules.trumps!.definitions["skill-revival"]).toBe(
    ADMITTED_TRUMP_DEFINITIONS["skill-revival"],
  );
  const api = createContestCoordinator({
    ...ports,
    controlledPlayers: ["human", "ai"],
  });
  const send = (action: ContestInput) =>
    sendContestInput(action, api.getSnapshot(), api.sendCommand);
  api.start();
  api.skipAnimations();
  expect(send(api.getSnapshot().skillCommands[0])).toBe(true);
  api.skipAnimations();
  expect(api.getSnapshot().skillCommands).toEqual([]);
  const revive = api
    .getSnapshot()
    .trumpCommands.find((c) => c.instanceId === "h-0")!;
  expect(send(revive)).toBe(true);
  expect(api.snapshot()!.round.skills!.human).toMatchObject({
    remainingUses: 4,
    gameActivationsRemaining: 1,
  });
  api.skipAnimations();
  expect(send(api.getSnapshot().skillCommands[0])).toBe(true);
  expect(api.snapshot()!.round.skills!.human).toMatchObject({
    remainingUses: 3,
    gameActivationsRemaining: 0,
  });
  expect(ports.calls.skillEffects).toBe(0);
  api.exit();
});
