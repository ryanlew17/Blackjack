// @req REQ-2026-028: beliefs consume only actual projected command results.
import { describe, expect, it, vi } from "vitest";
import {
  createMatch,
  observeMatch,
  projectMatchTransition,
  transitionMatch,
  legalTrumpCommands,
  legalSkillCommands,
} from "../engine";
import type {
  RoundCommand,
  MatchTransition,
  RoundRules,
  TrumpSetup,
} from "../engine";
import type { SkillId } from "../skills/catalog";
import type { NumberValue, PlayerId } from "../types";
import { fixedRandom } from "../engine/testHelpers";
import { NUMERIC_RULES } from "../engine/numberEffectTestHelpers";
import { S2_DEVELOPMENT_PRESET } from "../presets/s2";
import { prototypeSetup } from "../engine/prototype";
import { seededRandom } from "../random";
import { createBeliefMemory, advanceBeliefMemory } from "./memory";
import { buildBelief, sampleBelief, sampleStock } from "./belief";

function fixture(
  rules: RoundRules = NUMERIC_RULES,
  setup: TrumpSetup | undefined = prototypeSetup([]),
  prefix: readonly NumberValue[] = [10, 8, 11, 9],
  viewer: PlayerId = "human",
) {
  const shuffle = fixedRandom(prefix),
    later = seededRandom(91);
  let calls = 0;
  const random = {
    numbers: vi.fn(() =>
      calls++ === 0 ? 0.25 : calls <= 11 ? shuffle() : later(),
    ),
    trumpGate: vi.fn(seededRandom(2)),
    trumpSelection: vi.fn(() => 0),
    skillSelection: vi.fn(seededRandom(4)),
    skillEffects: vi.fn(seededRandom(5)),
  };
  let result = createMatch(
    random,
    rules,
    rules.trumps?.resources ? undefined : setup,
  );
  let memory = createBeliefMemory(projectMatchTransition(result, viewer));
  const accept = (next: MatchTransition) => {
    result = next;
    memory = advanceBeliefMemory(memory, projectMatchTransition(next, viewer));
    return next;
  };
  const send = (command: RoundCommand | { readonly type: "NextRound" }) =>
    accept(
      transitionMatch(
        result.state,
        { ...command, roundNumber: result.state.roundNumber },
        random,
      ),
    );
  return {
    random,
    get state() {
      return result.state;
    },
    get memory() {
      return memory;
    },
    send,
    act(type: "Hit" | "Stay") {
      return send({ type, player: result.state.round.turn!.player });
    },
    play(id: string) {
      const round = observeMatch(
        result.state,
        result.state.round.turn!.player,
      ).round;
      const instance = round.trumps!.ownHand.find(
        (c) => c.definitionId === id,
      )!;
      const command = legalTrumpCommands(round).find(
        (c) => c.instanceId === instance.instanceId,
      )!;
      expect(command).toBeDefined();
      return send(command);
    },
    skill() {
      const round = observeMatch(
        result.state,
        result.state.round.turn!.player,
      ).round;
      return send(legalSkillCommands(round)[0]);
    },
  };
}
const skillRules = (
  human: SkillId,
  ai: SkillId = "spirit-sight",
): RoundRules => ({
  ...NUMERIC_RULES,
  skills: {
    difficulty: "nightmare",
    playableDifficulties: ["nightmare"],
    selected: { human, ai },
  },
});

describe("authorized number memory", () => {
  it("excludes known initial values, samples a consistent no-replacement deck and never exposes the true hidden value", () => {
    const f = fixture();
    expect(buildBelief(f.memory).hidden.map((x) => x.value)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    for (let seed = 0; seed < 30; seed++) {
      const sample = sampleBelief(f.memory, seed);
      expect(sample.deck).toHaveLength(7);
      expect(new Set([10, 11, 9, sample.hidden, ...sample.deck]).size).toBe(11);
    }
    expect(Object.isFrozen(f.memory.numbers)).toBe(true);
  });

  it("does not mistake a generated duplicate for evidence about the original hidden card", () => {
    const a = fixture(
      NUMERIC_RULES,
      prototypeSetup(["creator"]),
      [10, 1, 11, 9],
    );
    const b = fixture(
      NUMERIC_RULES,
      prototypeSetup(["creator"]),
      [10, 8, 11, 9],
    );
    a.play("creator");
    b.play("creator");
    expect(a.memory).toEqual(b.memory);
    expect(buildBelief(a.memory).hidden.map((x) => x.value)).toContain(1);
    const generated = Object.values(a.memory.numbers).find(
      (c) => c.origin === "generated",
    );
    expect(generated).toMatchObject({ value: 1, location: "human" });
    expect(sampleBelief(a.memory, 17)).toEqual(sampleBelief(b.memory, 17));
  });

  it("tracks returns, deletion and transfer by instance without counting the same original twice", () => {
    const f = fixture(
      NUMERIC_RULES,
      prototypeSetup(["creator", "return", "eraser", "exchange"]),
    );
    f.play("creator");
    f.play("return");
    expect(
      Object.values(f.memory.numbers).find((c) => c.origin === "generated")
        ?.location,
    ).toBe("deck");
    f.play("exchange");
    expect(
      Object.values(f.memory.numbers).find((c) => c.value === 9)?.location,
    ).toBe("human");
    f.play("eraser");
    expect(
      Object.values(f.memory.numbers).find((c) => c.value === 9)?.location,
    ).toBe("deleted");
    const sample = sampleBelief(f.memory, 7);
    expect(sample.deck).toHaveLength(f.state.round.deck.length);
    expect(sample.deck).not.toContain(9);
    expect(f.memory.initialSeen).toEqual([9, 10, 11]);
  });

  it("honors a private peek only while current; remembers old knowledge without retaining old positions", () => {
    const f = fixture(NUMERIC_RULES, prototypeSetup(["scry", "deck-rotate"]));
    f.play("scry");
    const peek = f.memory.observation.round.peek!;
    expect(peek).toHaveLength(2);
    expect(sampleBelief(f.memory, 8).deck.slice(0, 2)).toEqual(peek);
    f.play("deck-rotate");
    expect(buildBelief(f.memory).peek).toBeNull();
    expect(f.memory.seenDeckValues).toEqual([...peek].sort((a, b) => a - b));
    expect(sampleBelief(f.memory, 8).deck).toHaveLength(7);
  });

  it("uses Spirit Sight authorization and clears number knowledge on the next Round", () => {
    const f = fixture(skillRules("spirit-sight"));
    f.skill();
    expect(buildBelief(f.memory).hidden).toEqual([{ value: 8, weight: 1 }]);
    const oldIds = Object.keys(f.memory.numbers);
    while (f.state.phase === "playing") f.act("Stay");
    f.send({ type: "NextRound" });
    expect(
      Object.keys(f.memory.numbers).some((id) => oldIds.includes(id)),
    ).toBe(false);
    expect(f.memory.observation.round.hands.ai.cards[0].value).toBeNull();
  });
});

describe("resource channels and hidden skill hypotheses", () => {
  it("models stock per copy and does not use unseen hand identity or stock order", () => {
    const f = fixture(S2_DEVELOPMENT_PRESET.round, undefined);
    const stock = buildBelief(f.memory).stock;
    expect(stock.human.count).toBe(f.state.round.trumps!.stock.human.length);
    expect(f.memory.acquisitions.human.stock).toBe(3);
    expect(f.memory.acquisitions.ai.stock).toBe(3);
    for (const player of ["human", "ai"] as const) {
      const sample = sampleStock(f.memory, player, 12);
      expect(sample).toHaveLength(stock[player].count);
      for (const [id, bounds] of Object.entries(stock[player].definitions)) {
        const count = sample.filter((x) => x === id).length;
        expect(count).toBeGreaterThanOrEqual(bounds.min);
        expect(count).toBeLessThanOrEqual(bounds.max);
      }
    }
  });

  it("remembers known transferred cards without charging the receiving stock", () => {
    const f = fixture(
      skillRules("pickpocket"),
      prototypeSetup([], ["return", "draw-2"]),
      [10, 8, 11, 9],
      "ai",
    );
    f.skill();
    expect(f.memory.acquisitions.human.transferred).toBe(1);
    expect(f.memory.transferredToOpponent).toHaveLength(1);
    expect(buildBelief(f.memory).stock.human.count).toBe(0);
    expect(
      buildBelief(f.memory).opponentHand.transferredCandidates[0].definitionId,
    ).toBe(f.state.round.trumps!.hands.human[0].definitionId);
  });

  it("treats secret spending as branches and cannot distinguish prepared and unprepared states", () => {
    const a = fixture(
      skillRules("metamorphosis"),
      undefined,
      [10, 8, 11, 9],
      "ai",
    );
    const b = fixture(
      skillRules("metamorphosis"),
      undefined,
      [10, 8, 11, 9],
      "ai",
    );
    expect(buildBelief(a.memory).skills.human).toEqual([
      { remainingUses: 5, gameActivationsRemaining: 1, secretPrepared: false },
    ]);
    a.skill();
    // A hidden command, including an empty projected event list, cannot create evidence.
    expect(a.memory).toEqual(b.memory);
    a.act("Stay");
    b.act("Stay");
    expect(a.memory).toEqual(b.memory);
    const branches = buildBelief(a.memory).skills.human;
    expect(branches.some((s) => s.secretPrepared)).toBe(true);
    expect(
      branches.some((s) => !s.secretPrepared && s.remainingUses === 5),
    ).toBe(true);
    expect(sampleBelief(a.memory, 99)).toEqual(sampleBelief(b.memory, 99));
  });

  it("clears Game resource history but preserves uncertainty in Match skill spending", () => {
    const f = fixture(
      skillRules("metamorphosis"),
      prototypeSetup(["creator"]),
      [10, 8, 11, 9],
      "ai",
    );
    f.skill();
    f.act("Stay");
    const game = f.state.game.number;
    let commands = 0;
    while (f.state.game.number === game) {
      expect(commands++).toBeLessThan(150);
      if (f.state.phase === "playing") f.act("Stay");
      else f.send({ type: "NextRound" });
    }
    expect(f.memory.roundOpportunity).toEqual({ human: false, ai: false });
    expect(f.memory.gameOpportunity).toEqual({ human: false, ai: false });
    expect(f.memory.generatedDefinitions).toEqual({ human: [], ai: [] });
    expect(
      buildBelief(f.memory).skills.human.some((s) => s.remainingUses < 5),
    ).toBe(true);
    expect(
      buildBelief(f.memory).skills.human.every(
        (s) => s.gameActivationsRemaining === 1 && !s.secretPrepared,
      ),
    ).toBe(true);
  });
});

it("reproduces seeded hypotheses without touching any true random stream or changing subsequent real commands", () => {
  const a = fixture(S2_DEVELOPMENT_PRESET.round, undefined);
  const b = fixture(S2_DEVELOPMENT_PRESET.round, undefined);
  const counts = Object.values(a.random).map((f) => f.mock.calls.length);
  const ambient = vi.spyOn(Math, "random").mockImplementation(() => {
    throw new Error("ambient random");
  });
  try {
    expect(sampleBelief(a.memory, 123)).toEqual(sampleBelief(a.memory, 123));
    for (let i = 0; i < 40; i++) {
      sampleBelief(a.memory, i);
      sampleStock(a.memory, "ai", i);
    }
  } finally {
    ambient.mockRestore();
  }
  expect(Object.values(a.random).map((f) => f.mock.calls.length)).toEqual(
    counts,
  );
  a.act("Hit");
  b.act("Hit");
  expect(a.state).toEqual(b.state);
});

it("learns a publicly failed specific draw without removing that value from hidden-card hypotheses", () => {
  const f = fixture(NUMERIC_RULES, prototypeSetup(["draw-2"]), [10, 2, 11, 9]);
  f.play("draw-2");
  expect(f.memory.absentDeckValues).toContain(2);
  expect(buildBelief(f.memory).hidden.map((x) => x.value)).toContain(2);
  for (let i = 0; i < 12; i++) {
    const sample = sampleBelief(f.memory, i);
    expect(sample.hidden).toBe(2);
    expect(sample.deck).not.toContain(2);
  }
});

it("models Twin Bloom copies from authorized own identities, even with zero stock copies", () => {
  const f = fixture(
    skillRules("spirit-sight", "twin-bloom"),
    prototypeSetup(["return", "draw-2"], ["fee"]),
  );
  const reaction = observeMatch(f.state, "ai").round.reaction!;
  const activate = legalSkillCommands(observeMatch(f.state, "ai").round)[0];
  f.send(activate);
  f.send({
    type: "PassReaction",
    player: "ai",
    turnNumber: reaction.turnNumber,
    reactionBoundary: reaction.boundary,
  });
  f.act("Stay");
  expect(f.memory.acquisitions.ai.generated).toBe(2);
  expect(new Set(f.memory.generatedDefinitions.ai)).toEqual(
    new Set(["return", "draw-2"]),
  );
  expect(buildBelief(f.memory).stock.ai.count).toBe(0);
  expect(
    Object.values(f.memory.numbers)
      .filter((c) => c.origin === "generated" && c.location === "ai")
      .map((c) => c.value),
  ).toEqual([11]);
});

it("accounts for publicly restored stock as generation instead of resurrecting the original quota", () => {
  const base = S2_DEVELOPMENT_PRESET.round;
  const f = fixture({
    ...base,
    trumps: {
      ...base.trumps,
      resources: {
        ...base.trumps.resources,
        stock: { "banish-copy": 1, regret: 1, return: 4 },
      },
    },
  });
  const view = observeMatch(f.state, "human").round;
  const instance = view.trumps!.ownHand.find(
    (c) => c.definitionId === "banish-copy",
  )!;
  f.send(
    legalTrumpCommands(view).find(
      (c) =>
        c.instanceId === instance.instanceId && c.definitionId === "return",
    )!,
  );
  const count = f.state.round.trumps!.stock.ai.length;
  f.play("regret");
  expect(f.memory.stockAdded.ai).toBe(1);
  expect(buildBelief(f.memory).stock.ai.count).toBe(count + 1);
  expect(sampleStock(f.memory, "ai", 1)).toHaveLength(count + 1);
  expect(buildBelief(f.memory).stock.ai.knownGenerated).toEqual(["return"]);
  expect(sampleStock(f.memory, "ai", 1)).toContain("return");
});

it("keeps paired hidden hand identities and deck permutations out of memory and samples", () => {
  const a = fixture(
    NUMERIC_RULES,
    prototypeSetup(["return"], ["draw-2"]),
    [10, 8, 11, 9, 7, 6],
  );
  const b = fixture(
    NUMERIC_RULES,
    prototypeSetup(["return"], ["draw-3"]),
    [10, 8, 11, 9, 6, 7],
  );
  expect(a.state).not.toEqual(b.state);
  expect(a.memory).toEqual(b.memory);
  expect(buildBelief(a.memory)).toEqual(buildBelief(b.memory));
  expect(sampleBelief(a.memory, 73)).toEqual(sampleBelief(b.memory, 73));
  const ids = Object.keys(a.memory.observation.round.faceUpOrigins);
  expect(ids).toEqual(
    Object.values(a.memory.observation.round.faceUpCardIds).flat(),
  );
  expect(ids).not.toContain(a.state.round.hiddenCards.ai);
  expect(ids).not.toContain(a.state.round.hiddenCards.human);
});

it("keeps recurring Endless Life generation uniform over eligible definitions after intervening card plays", () => {
  const base = S2_DEVELOPMENT_PRESET.round;
  const f = fixture(
    {
      ...base,
      skills: {
        difficulty: "nightmare",
        playableDifficulties: ["nightmare"],
        selected: { human: "endless-life", ai: "spirit-sight" },
      },
      trumps: {
        ...base.trumps,
        resources: {
          ...base.trumps.resources,
          difficulty: "nightmare",
          hitProbability: 0.6,
          stock: { return: 9, "skill-revival": 0 },
        },
      },
    },
    undefined,
    [10, 8, 11, 9],
    "ai",
  );
  f.skill();
  f.act("Stay");
  f.act("Stay");
  f.play("return");
  f.act("Stay");
  f.act("Stay");
  expect(f.memory.acquisitions.human.generated).toBe(2);
  expect(f.memory.generatedDefinitions.human).toEqual(["return", "return"]);
  expect(buildBelief(f.memory).opponentHand.proposal).toEqual([
    { value: "return", weight: 5 },
  ]);
});
