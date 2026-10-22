// @req REQ-2026-025: real admitted stock, private controller and forced stale callbacks.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createContestController } from "./controller";
import { createContestCoordinator } from "./coordinator";
import { S2_DEVELOPMENT_PRESET } from "../../domain/contest/presets/s2";
import { baselinePolicy } from "../../domain/contest/ai/policy";
import { fixedRandom } from "../../domain/contest/engine/testHelpers";
import type {
  MatchEventView,
  ContestRandomSources,
} from "../../domain/contest/engine";
import type { NumberValue, PlayerId } from "../../domain/contest/types";
import type { ContestControllerOptions } from "./types";

// Select actual finite stock positions for the six initial grants. Later grants stay ordinary.
function randomForHands(
  human = ["harvest", "pressure-supply", "resource-swap"],
  ai = ["shield", "target-24", "pressure-supply"],
): ContestRandomSources {
  const stock = Object.entries(
    S2_DEVELOPMENT_PRESET.round.trumps.resources.stock,
  ).flatMap(([id, n]) => Array<string>(n).fill(id));
  const pools = { human: [...stock], ai: [...stock] };
  const order: PlayerId[] = ["human", "human", "ai", "ai", "human", "ai"];
  const plans = { human: [...human], ai: [...ai] };
  const samples = order.map((player) => {
    const pool = pools[player],
      index = pool.indexOf(plans[player].shift()!);
    if (index < 0) throw new Error("Unstocked fixture request");
    const unit = (index + 0.5) / pool.length;
    pool.splice(index, 1);
    return unit;
  });
  let n = 0,
    selection = 0;
  let shuffle = () => 0;
  return {
    numbers: vi.fn(() => {
      if (n++ === 0) return 0.25;
      const offset = n - 2;
      if (offset % 10 === 0) {
        const firstHuman = Math.floor(offset / 10) % 2 === 0;
        const prefix: NumberValue[] = firstHuman
          ? [10, 8, 11, 9]
          : [8, 10, 9, 11];
        shuffle = fixedRandom(prefix);
      }
      return shuffle();
    }),
    trumpGate: vi.fn(() => 0.99),
    trumpSelection: vi.fn(() => samples[selection++] ?? 0.5),
  };
}
function setup(
  options: Omit<ContestControllerOptions, "random"> & {
    random?: ContestRandomSources;
  } = {},
) {
  const random = options.random ?? randomForHands(),
    events: MatchEventView[] = [];
  const opponent = vi.fn(baselinePolicy);
  const api = createContestController({
    preset: "s2-development",
    random,
    opponent,
    onEvent: (e) => events.push(e),
    ...options,
  });
  api.start();
  vi.runAllTimers();
  return { api, events, random, opponent };
}
function choice(api: ReturnType<typeof createContestController>, id: string) {
  const instance = api
    .snapshot()!
    .round.trumps!.ownHand.find((c) => c.definitionId === id)!;
  const command = api
    .getSnapshot()
    .trumpCommands.find((c) => c.instanceId === instance.instanceId);
  expect(command, id).toBeDefined();
  return command!;
}
const calls = (random: ContestRandomSources) =>
  [random.numbers, random.trumpGate, random.trumpSelection].map(
    (f) => vi.mocked(f).mock.calls.length,
  );
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("S2 production controller", () => {
  it("opts in to a frozen standard BO5, reproducible for both sides, while the page default has no resources", () => {
    const { api } = setup();
    expect(api.snapshot()!.rules).toMatchObject({
      difficulty: "standard",
      bestOf: 5,
      gamesToWin: 3,
      trumpDealing: true,
    });
    expect(
      api.snapshot()!.round.trumps!.ownHand.map((c) => c.definitionId),
    ).toEqual(["harvest", "pressure-supply", "resource-swap"]);
    expect(api.snapshot()!.round.trumps!.opponentHandCount).toBe(3);
    expect(api.snapshot()!.round.trumps!.stockCounts).toEqual({
      human: 58,
      ai: 58,
    });
    expect(
      Object.keys(api.snapshot()!.rules.round.trumps!.definitions),
    ).toHaveLength(53);
    expect(Object.isFrozen(api.snapshot()!.rules.round)).toBe(true);
    expect(api).not.toHaveProperty("sendCommand");
    expect(JSON.stringify(api.snapshot())).not.toContain('"deck":');
    const other = setup().api;
    expect(other.snapshot()).toEqual(api.snapshot());
    const plain = createContestController({ random: () => 0.25 });
    plain.start();
    vi.runAllTimers();
    expect(plain.snapshot()!.rules.trumpDealing).toBe(false);
    expect(plain.snapshot()!.round.trumps).toBeUndefined();
    expect(plain.getSnapshot().trumpCommands).toEqual([]);
  });
  it("starts S2 with lazy independent defaults without an injected resource source", () => {
    const seed = vi.spyOn(Math, "random").mockReturnValue(0.25);
    const api = createContestController({ preset: "s2-development" });
    expect(seed).not.toHaveBeenCalled();
    api.start();
    vi.runAllTimers();
    expect(api.snapshot()!.rules.trumpDealing).toBe(true);
    expect(api.getSnapshot().busy).toBe(false);
    expect(seed).toHaveBeenCalledTimes(3);
    api.restart();
    vi.runAllTimers();
    expect(seed).toHaveBeenCalledTimes(3);
  });
  it.each(["Hit", "Stay"] as const)(
    "commits multiple real trumps and grants before replay, then permits %s",
    (end) => {
      const { api, random, opponent } = setup();
      for (const id of ["harvest", "pressure-supply", "resource-swap"]) {
        const command = choice(api, id),
          before = api.snapshot()!.round.trumps!.destroyed.length;
        expect(api.send(command)).toBe(true);
        const committed = api.snapshot();
        expect(committed!.round.turn).toEqual({
          player: "human",
          number: 1,
          usedTrump: true,
        });
        expect(committed!.round.trumps!.destroyed.length).toBeGreaterThan(
          before,
        );
        expect(api.getSnapshot().busy).toBe(true);
        expect(api.getSnapshot().trumpCommands).toEqual([]);
        expect(api.send(command)).toBe(false);
        expect(api.send("Stay")).toBe(false);
        vi.runAllTimers();
        expect(api.getSnapshot().busy).toBe(false);
        expect(api.getSnapshot().match).toEqual(committed);
      }
      expect(opponent).not.toHaveBeenCalled();
      expect(random.numbers).toHaveBeenCalledTimes(11);
      expect(random.trumpGate).not.toHaveBeenCalled();
      expect(api.send(end)).toBe(true);
      vi.runAllTimers();
      expect(opponent).toHaveBeenCalledTimes(1);
      expect(opponent.mock.results[0].value).toBe("Stay");
      expect(
        api.snapshot()!.round.trumps!.destroyed.filter((d) => d.owner === "ai"),
      ).toEqual([]);
    },
  );
  it("passes selected hidden costs and targets without giving command authority over the opponent", () => {
    const { api, random } = setup();
    const refit = choice(api, "resource-swap"),
      initial = api.snapshot(),
      consumed = calls(random);
    expect(api.send({ ...refit, costIds: [refit.instanceId] })).toBe(false);
    expect(api.send({ ...refit, targetId: "nonexistent" })).toBe(false);
    expect(api.snapshot()).toEqual(initial);
    expect(calls(random)).toEqual(consumed);
    api.pause();
    api.resume();
    expect(api.send(refit)).toBe(false);
    expect(api.send(choice(api, "resource-swap"))).toBe(true);
    vi.runAllTimers();
    api.send("Stay");
    const count = calls(random);
    expect(api.send(refit)).toBe(false);
    expect(calls(random)).toEqual(count);
  });
  it("validates and forwards an explicit number target from the projected command", () => {
    const { api, random } = setup({
      random: randomForHands([
        "face-lighten",
        "pressure-supply",
        "resource-swap",
      ]),
    });
    const command = choice(api, "face-lighten");
    expect(command.targetId).toBe(api.snapshot()!.round.faceUpCardIds.human[0]);
    const before = api.snapshot();
    expect(api.send({ ...command, targetId: "missing-card" })).toBe(false);
    expect(api.snapshot()).toEqual(before);
    expect(api.send(command)).toBe(true);
    expect(api.snapshot()!.round.hands.human.total).toBe(19);
    vi.runAllTimers();
    expect(api.getSnapshot().match).toEqual(api.snapshot());
    expect(random.trumpGate).not.toHaveBeenCalled();
  });
  it("controls both real multi-card actors through the same coordinator and returns to the committed actor", () => {
    const opponent = vi.fn(baselinePolicy),
      random = randomForHands();
    const api = createContestCoordinator({
      roundRules: S2_DEVELOPMENT_PRESET.round,
      random,
      controlledPlayers: ["human", "ai"],
      opponent,
    });
    api.start();
    vi.runAllTimers();
    api.sendCommand({ type: "Stay", player: "human" });
    vi.runAllTimers();
    for (const id of ["shield", "target-24", "pressure-supply"]) {
      expect(
        api.sendCommand({
          type: "PlayTrump",
          player: "ai",
          instanceId: `game-1:ai:stock-${id}-0`,
        }),
      ).toBe(true);
      const state = api.snapshot();
      expect(state!.round.turn!.player).toBe("ai");
      expect(api.sendCommand({ type: "Stay", player: "human" })).toBe(false);
      vi.runAllTimers();
      expect(api.getSnapshot().match).toEqual(state);
      expect(api.getSnapshot().busy).toBe(false);
    }
    expect(opponent).not.toHaveBeenCalled();
    expect(api.sendCommand({ type: "Hit", player: "ai" })).toBe(true);
    vi.runAllTimers();
    expect(api.snapshot()!.round.turn!.player).toBe("human");
    expect(api.sendCommand({ type: "Stay", player: "human" })).toBe(true);
    vi.runAllTimers();
    expect(api.snapshot()!.round.turn!.player).toBe("ai");
  });
  it("invalidates idle choices and a thinking callback when skipping on visibility return", () => {
    const { api, opponent } = setup();
    const old = choice(api, "pressure-supply");
    api.skipAnimations();
    expect(api.send(old)).toBe(false);
    expect(choice(api, "pressure-supply").inputId).not.toBe(old.inputId);
    api.send("Stay");
    api.skipAnimations();
    expect(api.getSnapshot().thinking).toBe(true);
    const scheduled = vi.spyOn(globalThis, "setTimeout");
    api.skipAnimations();
    const stale = scheduled.mock.calls.at(-1)![0] as () => void;
    api.skipAnimations();
    stale();
    expect(opponent).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(opponent).toHaveBeenCalledTimes(1);
    expect(api.getSnapshot().busy).toBe(false);
  });
  it("invalidates a policy result when that policy synchronously pauses the match", () => {
    let api: ReturnType<typeof createContestController>;
    const opponent = vi.fn(() => {
      api.pause();
      return "Stay" as const;
    });
    api = createContestController({
      preset: "s2-development",
      random: randomForHands(),
      opponent,
    });
    api.start();
    vi.runAllTimers();
    api.send("Stay");
    vi.runAllTimers();
    expect(api.getSnapshot().paused).toBe(true);
    expect(api.snapshot()!.round.turn!.player).toBe("ai");
    expect(api.snapshot()!.round.quietStays).toBe(1);
    expect(api.getSnapshot().busy).toBe(false);
    expect(opponent).toHaveBeenCalledTimes(1);
  });
});

const stages = ["played", "grant", "placed", "trigger"] as const;
function atStage(event: MatchEventView | null, stage: (typeof stages)[number]) {
  if (event?.type !== "round") return false;
  const e = event.event;
  return stage === "played" || stage === "placed"
    ? e.type === "trump" && e.effect === stage
    : e.type === "resource" &&
        e.cause === (stage === "grant" ? "effect" : "trigger");
}
describe("cancel each consumption and grant replay stage", () => {
  for (const stage of stages)
    for (const cancel of ["pause", "skip", "exit", "restart"] as const) {
      it(`${cancel} at ${stage} rejects old targets and forced old callbacks without duplicate consumption`, () => {
        const { api, events, random } = setup();
        api.send(choice(api, "harvest"));
        vi.runAllTimers();
        const scheduled = vi.spyOn(globalThis, "setTimeout");
        const command = choice(api, "pressure-supply");
        expect(api.send(command)).toBe(true);
        for (let i = 0; i < 12 && !atStage(api.getSnapshot().event, stage); i++)
          vi.advanceTimersToNextTimer();
        expect(atStage(api.getSnapshot().event, stage)).toBe(true);
        const stale = scheduled.mock.calls.map(
          ([callback]) => callback as () => void,
        );
        const committed = api.snapshot();
        if (cancel === "pause") api.pause();
        else if (cancel === "skip") api.skipAnimations();
        else if (cancel === "exit") api.exit();
        else api.restart();
        const after = api.snapshot(),
          count = events.length,
          randomCalls = calls(random);
        expect(api.send(command)).toBe(false);
        stale.forEach((callback) => callback());
        expect(api.snapshot()).toEqual(after);
        expect(events).toHaveLength(count);
        expect(calls(random)).toEqual(randomCalls);
        if (cancel === "pause") {
          expect(api.snapshot()).toEqual(committed);
          api.resume();
          expect(api.send(command)).toBe(false);
        } else if (cancel === "skip") expect(api.snapshot()).toEqual(committed);
        else if (cancel === "exit") expect(api.snapshot()).toBeNull();
        else expect(api.snapshot()!.round.trumps!.table).toEqual([]);
        vi.runAllTimers();
        expect(api.getSnapshot().busy).toBe(false);
        expect(api.getSnapshot().thinking).toBe(false);
        expect(vi.getTimerCount()).toBe(0);
      });
    }
});

it("finishes a full resource BO5 without any Storage method or length access or classic mutation", () => {
  const stores = Array.from({ length: 2 }, () => {
    const data = new Map([
      ["green-room.blackjack.v1", "untouched classic save"],
    ]);
    const methods = {
        getItem: vi.fn((key: string) => data.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => data.set(key, value)),
        removeItem: vi.fn((key: string) => data.delete(key)),
        clear: vi.fn(() => data.clear()),
        key: vi.fn((index: number) => [...data.keys()][index] ?? null),
      },
      length = vi.fn(() => data.size);
    return {
      methods,
      length,
      data,
      object: {
        ...methods,
        get length() {
          return length();
        },
      },
    };
  });
  vi.stubGlobal("localStorage", stores[0].object);
  vi.stubGlobal("sessionStorage", stores[1].object);
  const { api, opponent } = setup({
    random: randomForHands(["scry", "pressure", "shield"]),
  });
  api.send(choice(api, "scry"));
  vi.runAllTimers();
  let rounds = 0;
  for (
    let steps = 0;
    steps < 80 && api.snapshot()!.phase !== "complete";
    steps++
  ) {
    const s = api.snapshot()!;
    if (s.phase === "playing") expect(api.send("Stay")).toBe(true);
    else {
      rounds++;
      expect(api.send("NextRound")).toBe(true);
    }
    vi.runAllTimers();
  }
  expect(api.snapshot()!.phase).toBe("complete");
  expect(api.snapshot()!.wins).toEqual({ human: 3, ai: 0 });
  expect(api.snapshot()!.roundNumber).toBe(15);
  expect(rounds).toBe(14);
  expect(api.snapshot()!.round.trumps!.ownHand).toEqual([]);
  expect(api.getSnapshot().busy).toBe(false);
  expect(api.getSnapshot().trumpCommands).toEqual([]);
  expect(opponent.mock.results.every((r) => r.value === "Stay")).toBe(true);
  for (const store of stores) {
    Object.values(store.methods).forEach((method) =>
      expect(method).not.toHaveBeenCalled(),
    );
    expect(store.length).not.toHaveBeenCalled();
  }
  for (const store of stores)
    expect([...store.data]).toEqual([
      ["green-room.blackjack.v1", "untouched classic save"],
    ]);
});
