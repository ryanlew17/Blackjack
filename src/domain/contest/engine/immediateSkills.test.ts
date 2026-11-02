// @req REQ-2026-027: P2 uses real commands and original instance ledgers, never patched authority.
import { describe, expect, it, vi } from "vitest";
import type { SkillId } from "../skills/catalog";
import type { NumberValue, PlayerId } from "../types";
import { NUMBER_TRUMP_DEFINITIONS } from "../trumps/numberDefinitions";
import { INTERACTION_TRUMP_DEFINITIONS } from "../trumps/interactionDefinitions";
import {
  createMatch,
  transitionMatch,
  observeMatch,
  projectMatchTransition,
  legalSkillCommands,
  legalTrumpCommands,
} from "./index";
import type { MatchState, MatchTransition, RoundRules } from "./index";
import { fixedRandom } from "./testHelpers";

const definitions = {
  ...NUMBER_TRUMP_DEFINITIONS,
  ...INTERACTION_TRUMP_DEFINITIONS,
  filler: { onPlay: [] },
  gen6: { onPlay: [{ type: "generate-number" as const, value: 6 as const }] },
  gen7: { onPlay: [{ type: "generate-number" as const, value: 7 as const }] },
  gen8: { onPlay: [{ type: "generate-number" as const, value: 8 as const }] },
  gen11: { onPlay: [{ type: "generate-number" as const, value: 11 as const }] },
  eraser: {
    onPlay: [{ type: "delete-last-number" as const, target: "self" as const }],
  },
  maker: {
    onPlay: [{ type: "generate-trump" as const, definitionId: "filler" }],
  },
  feeder: {
    onPlay: [
      { type: "grant-trumps" as const, target: "self" as const, count: 6 },
    ],
  },
};
function fixture(
  skill: SkillId,
  options: {
    human?: readonly string[];
    ai?: readonly string[];
    owner?: PlayerId;
    stock?: Record<string, number>;
    prefix?: readonly NumberValue[];
    sample?: number;
    pointTarget?: number;
  } = {},
) {
  const owner = options.owner ?? "human",
    difficulty = skill === "self-renewal" ? "challenge" : "standard";
  const shuffle = fixedRandom(options.prefix ?? [10, 8, 11, 9]);
  let coin = true;
  const random = {
    numbers: vi.fn(() => (coin ? ((coin = false), 0.25) : shuffle())),
    trumpGate: vi.fn(() => {
      throw new Error("Skill used Hit gate");
    }),
    trumpSelection: vi.fn(() => 0),
    skillEffects: vi.fn(() => options.sample ?? 0),
    skillSelection: vi.fn(() => {
      throw new Error("Skill sampled pre-match selection");
    }),
  };
  const rules: RoundRules = {
    version: 1,
    pointTarget: options.pointTarget ?? 21,
    skills: {
      difficulty,
      playableDifficulties: [difficulty],
      selected: {
        human: owner === "human" ? skill : "spirit-sight",
        ai: owner === "ai" ? skill : "spirit-sight",
      },
    },
    trumps: {
      tableCapacity: 5,
      definitions,
      ...(options.stock
        ? {
            resources: {
              difficulty,
              handLimit: 8,
              gameGrant: 2,
              roundGrant: 1,
              hitProbability: difficulty === "challenge" ? 0.4 : 0.3,
              stock: options.stock,
            },
          }
        : {}),
    },
  };
  const setup = options.stock
    ? undefined
    : {
        human: (options.human ?? []).map((id, n) => ({
          definitionId: id,
          instanceId: "h-" + n,
        })),
        ai: (options.ai ?? []).map((id, n) => ({
          definitionId: id,
          instanceId: "a-" + n,
        })),
      };
  let state = createMatch(random, rules, setup).state;
  if (owner === "ai") state = act(state, "Hit", random).state;
  clear(random);
  return { state, random };
}
type Ports = ReturnType<typeof fixture>["random"];
function clear(random: Ports) {
  for (const stream of Object.values(random)) stream.mockClear();
}
function act(state: MatchState, type: "Hit" | "Stay", random: Ports) {
  return transitionMatch(
    state,
    { type, player: state.round.turn!.player, roundNumber: state.roundNumber },
    random,
  );
}
function play(state: MatchState, id: string, random: Ports, targetId?: string) {
  const player = state.round.turn!.player;
  const instance = state.round.trumps!.hands[player].find(
    (c) => c.definitionId === id,
  )!;
  const command = legalTrumpCommands(observeMatch(state, player).round).find(
    (c) =>
      c.instanceId === instance.instanceId &&
      (targetId === undefined || c.targetId === targetId),
  );
  if (!command) throw new Error("No legal fixture command: " + id);
  return transitionMatch(
    state,
    { ...command, roundNumber: state.roundNumber },
    random,
  ).state;
}
function activate(state: MatchState, random: Ports): MatchTransition {
  const player = state.round.turn!.player;
  const command = legalSkillCommands(observeMatch(state, player).round)[0];
  if (!command) throw new Error("No legal skill command");
  return transitionMatch(
    state,
    { ...command, roundNumber: state.roundNumber },
    random,
  );
}
function rejected(state: MatchState, skillId: SkillId, random: Ports) {
  clear(random);
  const result = transitionMatch(
    state,
    {
      type: "ActivateSkill",
      skillId,
      player: state.round.turn!.player,
      turnNumber: state.round.turn!.number,
      roundNumber: state.roundNumber,
    },
    random,
  );
  expect(result.state).toBe(state);
  expect(result.events).toEqual([]);
  for (const stream of Object.values(random))
    expect(stream).not.toHaveBeenCalled();
}
function spent(
  before: MatchState,
  result: MatchTransition,
  status = "succeeded",
) {
  const player = before.round.turn!.player;
  expect(result.state.round.skills!.players[player]).toMatchObject({
    remainingUses: before.round.skills!.players[player].remainingUses - 1,
    publicRemainingUses:
      before.round.skills!.players[player].publicRemainingUses - 1,
    gameActivationsRemaining: 0,
    activations: [{ status }],
  });
  expect(result.state.round.turn).toEqual({
    ...before.round.turn!,
    usedSkill: true,
  });
  expect(result.state.round.quietStays).toBe(0);
  expect(
    result.events.some((e) => e.type === "round" && e.event.type === "hit"),
  ).toBe(false);
  expect(legalSkillCommands(observeMatch(result.state, player).round)).toEqual(
    [],
  );
}
function ledger(state: MatchState) {
  const t = state.round.trumps!;
  const instances = [
    ...t.hands.human,
    ...t.hands.ai,
    ...t.stock.human,
    ...t.stock.ai,
    ...t.destroyed.map((d) => d.instance),
  ];
  expect(new Set(instances.map((c) => c.instanceId)).size).toBe(
    instances.length,
  );
  return instances.map((c) => c.instanceId).sort();
}

describe("Pickpocket", () => {
  it.each([0, 1 / 3, 2 / 3, 0.999999])(
    "selects a uniform index at %s and preserves identity and source",
    (sample) => {
      const { state, random } = fixture("pickpocket", {
        human: Array(6).fill("filler"),
        ai: ["filler", "pressure", "shield"],
        sample,
      });
      const chosen = state.round.trumps!.hands.ai[Math.floor(sample * 3)];
      const result = activate(state, random);
      spent(state, result);
      expect(result.state.round.trumps!.hands.human.at(-1)).toBe(chosen);
      expect(result.state.round.trumps!.hands.human).toHaveLength(7);
      expect(result.state.round.trumps!.stock).toBe(state.round.trumps!.stock);
      expect(result.state.round.trumps!.destroyed).toBe(
        state.round.trumps!.destroyed,
      );
      expect(ledger(result.state)).toEqual(ledger(state));
      expect(random.skillEffects).toHaveBeenCalledTimes(1);
      expect(random.trumpSelection).not.toHaveBeenCalled();
      expect(random.trumpGate).not.toHaveBeenCalled();
      for (const player of ["human", "ai"] as const) {
        const view = projectMatchTransition(result, player);
        const event = view.events.find(
          (e) => e.type === "round" && e.event.type === "resource",
        );
        expect(
          event?.type === "round" &&
            event.event.type === "resource" &&
            event.event.instance,
        ).toEqual(chosen);
      }
      projectMatchTransition(result, "human");
      expect(random.skillEffects).toHaveBeenCalledTimes(1);
    },
  );
  it.each([7, 8])(
    "rejects %s held trumps without spending or sampling",
    (count) => {
      const { state, random } = fixture("pickpocket", {
        human: Array(count).fill("filler"),
        ai: ["filler"],
      });
      rejected(state, "pickpocket", random);
    },
  );
  it("rejects an empty opposing hand", () => {
    const { state, random } = fixture("pickpocket");
    rejected(state, "pickpocket", random);
  });
  it("works on the AI side and keeps a generated source intact", () => {
    let { state, random } = fixture("pickpocket", {
      owner: "ai",
      human: ["maker"],
      ai: [],
    });
    state = act(state, "Hit", random).state;
    state = play(state, "maker", random);
    const generated = state.round.trumps!.hands.human[0];
    expect(generated.origin.type).toBe("generated");
    state = act(state, "Hit", random).state;
    clear(random);
    const result = activate(state, random);
    expect(result.state.round.trumps!.hands.ai.at(-1)).toBe(generated);
    expect(result.state.round.trumps!.hands.ai.at(-1)!.origin).toBe(
      generated.origin,
    );
    spent(state, result);
  });
});

describe("Resourcefulness", () => {
  it.each([0, 1, 2, 4])(
    "draws up to two from %s remaining copies, including a spent no-effect use",
    (remaining) => {
      let { state, random } = fixture("craft-gift", {
        stock: { filler: remaining + 3 },
      });
      while (state.round.trumps!.hands.human.length)
        state = play(state, "filler", random);
      clear(random);
      const result = activate(state, random),
        count = Math.min(2, remaining);
      spent(state, result, count ? "succeeded" : "ineffective");
      expect(result.state.round.trumps!.hands.human).toHaveLength(count);
      expect(result.state.round.trumps!.stock.human).toHaveLength(
        remaining - count,
      );
      expect(random.trumpSelection).toHaveBeenCalledTimes(count);
      expect(random.skillEffects).not.toHaveBeenCalled();
      expect(random.trumpGate).not.toHaveBeenCalled();
      expect(ledger(result.state)).toEqual(ledger(state));
      for (const event of projectMatchTransition(result, "ai").events)
        if (event.type === "round" && event.event.type === "resource")
          expect(event.event.instance).toBeNull();
      const repeated = transitionMatch(
        result.state,
        {
          type: "ActivateSkill",
          player: "human",
          skillId: "craft-gift",
          turnNumber: state.round.turn!.number,
          roundNumber: state.roundNumber,
        },
        random,
      );
      expect(repeated.state).toBe(result.state);
      expect(repeated.events).toEqual([]);
    },
  );
  it("rejects even one held trump", () => {
    const { state, random } = fixture("craft-gift", { human: ["filler"] });
    rejected(state, "craft-gift", random);
  });
});

describe("Fortune", () => {
  it.each([true, false])(
    "does not query stock in legality and resolves presence=%s without randomness",
    (present) => {
      const { state, random } = fixture("fortune", {
        stock: { filler: 4, "best-draw": present ? 1 : 0 },
      });
      expect(
        legalSkillCommands(observeMatch(state, "human").round),
      ).toHaveLength(1);
      const result = activate(state, random);
      spent(state, result, present ? "succeeded" : "ineffective");
      expect(
        result.state.round.trumps!.hands.human.filter(
          (c) => c.definitionId === "best-draw",
        ),
      ).toHaveLength(present ? 1 : 0);
      for (const stream of Object.values(random))
        expect(stream).not.toHaveBeenCalled();
      expect(ledger(result.state)).toEqual(ledger(state));
    },
  );
  it("spends a full-hand attempt without consuming the available Best Draw or randomness", () => {
    let { state, random } = fixture("fortune", {
      stock: { feeder: 1, filler: 10, "best-draw": 1 },
    });
    state = play(state, "feeder", random);
    expect(state.round.trumps!.hands.human).toHaveLength(8);
    expect(
      state.round.trumps!.stock.human.some(
        (c) => c.definitionId === "best-draw",
      ),
    ).toBe(true);
    clear(random);
    const result = activate(state, random);
    spent(state, result, "ineffective");
    expect(result.state.round.trumps!.stock.human).toBe(
      state.round.trumps!.stock.human,
    );
    for (const stream of Object.values(random))
      expect(stream).not.toHaveBeenCalled();
  });
});

it.each(["craft-gift", "fortune"] as const)(
  "%s respects the existing stock interception before granting",
  (skill) => {
    let { state, random } = fixture(skill, {
      stock: { embargo: 1, filler: 5, "best-draw": 1 },
    });
    state = play(state, "embargo", random);
    while (state.round.trumps!.hands.human.length)
      state = play(state, "filler", random);
    state = act(state, "Stay", random).state;
    state = play(state, "embargo", random);
    state = act(state, "Stay", random).state;
    const stock = state.round.trumps!.stock.human;
    clear(random);
    const result = activate(state, random);
    spent(state, result, skill === "craft-gift" ? "succeeded" : "ineffective");
    expect(
      result.events.some(
        (e) =>
          e.type === "round" &&
          e.event.type === "resource" &&
          e.event.operation === "blocked",
      ),
    ).toBe(true);
    expect(result.state.round.trumps!.hands.human).toHaveLength(
      skill === "craft-gift" ? 1 : 0,
    );
    expect(random.trumpSelection).toHaveBeenCalledTimes(
      skill === "craft-gift" ? 1 : 0,
    );
    expect(random.skillEffects).not.toHaveBeenCalled();
    if (skill === "fortune")
      expect(result.state.round.trumps!.stock.human).toBe(stock);
    expect(ledger(result.state)).toEqual(ledger(state));
  },
);

describe("Self Renewal", () => {
  it("deletes the latest equal-valued face-up instance, preserving the original hidden slot and deck", () => {
    let { state, random } = fixture("self-renewal", {
      human: ["gen8"],
      prefix: [11, 2, 8, 3],
    });
    state = play(state, "gen8", random);
    const hidden = state.round.hands.human[0],
      chosen = state.round.hands.human.at(-1)!;
    const result = activate(state, random);
    spent(state, result);
    expect(result.state.round.deletedNumbers.at(-1)).toBe(chosen);
    expect(result.state.round.hands.human[0]).toBe(hidden);
    expect(result.state.round.hiddenCards).toBe(state.round.hiddenCards);
    expect(result.state.round.deck).toBe(state.round.deck);
    expect(result.state.round.nextNumberId).toBe(state.round.nextNumberId);
    const numberIds = (value: MatchState) =>
      [
        ...value.round.hands.human,
        ...value.round.hands.ai,
        ...value.round.deck,
        ...value.round.deletedNumbers,
      ]
        .map((c) => c.instanceId)
        .sort();
    expect(numberIds(result.state)).toEqual(numberIds(state));
    expect(new Set(numberIds(result.state)).size).toBe(numberIds(state).length);
    expect(
      observeMatch(result.state, "human").round.faceUpCardIds.human,
    ).toEqual([state.round.hands.human[1].instanceId]);
    expect(
      observeMatch(result.state, "ai").round.hands.human.cards[0].value,
    ).toBeNull();
    expect(projectMatchTransition(result, "ai").events.at(-1)).toMatchObject({
      type: "round",
      event: { type: "skill", card: 8, targetId: chosen.instanceId },
    });
    for (const stream of Object.values(random))
      expect(stream).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    "uses effective contributions and cleans bindings and dependents, suppressed=%s",
    (suppressed) => {
      let { state, random } = fixture("self-renewal", {
        human: [suppressed ? "gen7" : "gen6", "face-lighten"],
        ai: [suppressed ? "suppress" : "face-burden"],
        prefix: [11, 2, 8, 3],
      });
      state = play(state, suppressed ? "gen7" : "gen6", random);
      const rawEight = state.round.hands.human[1],
        generated = state.round.hands.human[2];
      state = play(state, "face-lighten", random, rawEight.instanceId);
      state = act(state, "Stay", random).state;
      state = play(
        state,
        suppressed ? "suppress" : "face-burden",
        random,
        suppressed
          ? state.round.trumps!.table[0].effectId
          : generated.instanceId,
      );
      state = act(state, "Hit", random).state;
      clear(random);
      const chosen = suppressed ? rawEight : generated;
      const result = activate(state, random);
      expect(result.state.round.deletedNumbers.at(-1)).toBe(chosen);
      expect(
        result.state.round.trumps!.table.some(
          (t) => t.cardId === chosen.instanceId || t.kind === "suppress",
        ),
      ).toBe(false);
      expect(
        result.events.filter(
          (e) => e.type === "round" && e.event.type === "table-effect",
        ),
      ).toHaveLength(suppressed ? 2 : 1);
      spent(state, result);
    },
  );
  it("rejects a non-bust hand", () => {
    const { state, random } = fixture("self-renewal");
    rejected(state, "self-renewal", random);
  });
  it("protects a publicly revealed hidden slot even when it alone exceeds the current target", () => {
    let { state, random } = fixture("self-renewal", {
      human: ["eraser", "reveal-opponent"],
      ai: ["reveal-opponent"],
      prefix: [11, 2, 8, 3],
      pointTarget: 5,
    });
    state = play(state, "eraser", random);
    state = act(state, "Stay", random).state;
    state = play(state, "reveal-opponent", random);
    state = act(state, "Hit", random).state;
    expect(state.round.revealed).toContain("human");
    expect(observeMatch(state, "human").round.hands.human.total).toBe(11);
    expect(observeMatch(state, "human").round.faceUpCardIds.human).toEqual([]);
    rejected(state, "self-renewal", random);
  });
});
