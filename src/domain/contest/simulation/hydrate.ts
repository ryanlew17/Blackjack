// @req REQ-2026-028: hypothetical engine state constructed only from authorized memory.
import { freezeData } from "../immutable";
import { seededRandom } from "../random";
import { rawTable } from "./undo";
import { buildBelief, sampleBelief, sampleStock } from "../ai/belief";
import type { BeliefMemory } from "../ai/memory";
import type { MatchState, RoundState } from "../engine/types";
import type { NumberInstance } from "../engine/numberCards";
import type { TrumpInstance, TrumpState } from "../engine/effectTypes";
import type {
  SkillState,
  SkillActivation,
  PlayerSkillState,
} from "../engine/skillTypes";
import type { NumberValue, PlayerId } from "../types";

const players = ["human", "ai"] as const;
const other = (p: PlayerId): PlayerId => (p === "human" ? "ai" : "human");
const ordinal = (ids: readonly string[], pattern: RegExp) =>
  Math.max(0, ...ids.map((id) => Number(pattern.exec(id)?.[1] ?? 0))) + 1;

function trumps(memory: BeliefMemory, seed: number): TrumpState | undefined {
  const observation = memory.observation;
  const round = observation.round;
  const view = round.trumps;
  if (!view) return undefined;
  const viewer = round.viewer,
    opponent = other(viewer);
  const random = seededRandom(seed);
  let serial = 0;
  const make = (
    definitionId: string,
    owner: PlayerId,
    generated = false,
    sourceId = "simulation",
    immune = false,
  ): TrumpInstance => ({
    definitionId,
    instanceId: `simulation:trump:${serial++}`,
    origin: generated
      ? {
          type: "generated",
          sourceId,
          ...(immune ? { skillId: "endless-life" as const } : {}),
        }
      : round.rules.trumps?.resources
        ? { type: "stock", owner, game: observation.game.number }
        : { type: "fixture", owner, game: observation.game.number },
  });
  const belief = buildBelief(memory);
  const stockNames = {
    human: [...sampleStock(memory, "human", seed)],
    ai: [...sampleStock(memory, "ai", seed + 1)],
  };
  const pools = {
    human: [...belief.stock.human.initialUnaccounted],
    ai: [...belief.stock.ai.initialUnaccounted],
  };
  const stock = { human: [] as TrumpInstance[], ai: [] as TrumpInstance[] };
  for (const p of players) {
    const generated = [...belief.stock[p].knownGenerated];
    for (const id of stockNames[p]) {
      const restored = generated.indexOf(id);
      const index = restored >= 0 ? -1 : pools[p].indexOf(id);
      const source =
        restored >= 0
          ? memory.stockAdditions.find(
              (c) => c.player === p && c.definitionId === id,
            )?.sourceId
          : undefined;
      stock[p].push(make(id, p, index < 0, source));
      if (restored >= 0) generated.splice(restored, 1);
      if (index >= 0) pools[p].splice(index, 1);
    }
  }
  const used = new Set(
    [
      ...view.ownHand,
      ...view.destroyed.flatMap((d) => (d.instance ? [d.instance] : [])),
    ].map((c) => c.instanceId),
  );
  const opponentHand: TrumpInstance[] = [];
  for (const c of memory.transferredToOpponent) {
    if (
      opponentHand.length < view.opponentHandCount &&
      !used.has(c.instanceId)
    ) {
      opponentHand.push(c);
      used.add(c.instanceId);
    }
  }
  const generation = [...memory.hiddenGenerations[opponent]];
  // A later revealed generated instance already occupies its own authorized slot.
  for (const c of Object.values(memory.trumps)) {
    if (c.origin.type !== "generated") continue;
    const source = c.origin.sourceId;
    const at = generation.findIndex(
      (g) => g.sourceId === source && g.definitions.includes(c.definitionId),
    );
    if (at >= 0) generation.splice(at, 1);
  }
  const definitions = Object.keys(round.rules.trumps!.definitions);
  const unknown = (forbidImmune = false) => {
    const available = generation.filter(
      (g) => !forbidImmune || g.skillId !== "endless-life",
    );
    const pool = pools[opponent];
    const generated =
      available.length > 0 &&
      (pool.length === 0 ||
        random() < available.length / (available.length + pool.length));
    if (!generated && pool.length)
      return make(
        pool.splice(Math.floor(random() * pool.length), 1)[0],
        opponent,
      );
    if (generated) {
      const channel = generation.splice(
        generation.indexOf(available[Math.floor(random() * available.length)]),
        1,
      )[0];
      const choices = channel.definitions.length
        ? channel.definitions
        : definitions;
      return make(
        choices[Math.floor(random() * choices.length)],
        opponent,
        true,
        channel.sourceId,
        channel.skillId === "endless-life",
      );
    }
    if (round.rules.trumps?.resources)
      throw new RangeError(
        "No joint hand/stock assignment for this hypothesis",
      );
    return make(
      definitions[Math.floor(random() * definitions.length)],
      opponent,
    );
  };
  const destroyed = view.destroyed.map((d, index) => ({
    ...d,
    instance: d.instance ?? unknown(memory.nonImmuneDestroyed.includes(index)),
    public:
      d.reason === "played" || (d.owner !== viewer && d.instance !== null),
  }));
  while (opponentHand.length < view.opponentHandCount)
    opponentHand.push(unknown());
  const allIds = [
    ...Object.keys(memory.trumps),
    ...view.table.map((t) => t.sourceInstanceId),
  ];
  return {
    game: observation.game.number,
    hands:
      viewer === "human"
        ? { human: [...view.ownHand], ai: opponentHand }
        : { human: opponentHand, ai: [...view.ownHand] },
    stock,
    destroyed,
    table: view.table.map((t) => rawTable(t, memory)),
    nextGeneratedId: ordinal(allIds, /:generated-(\d+)$/),
    nextEffectId: ordinal(
      memory.abilityOrder.filter((key) => key.startsWith("table:")),
      /effect-(\d+)$/,
    ),
  };
}

/** Internal only. This state is a model, not a read port to the live coordinator. */
export function hydrate(memory: BeliefMemory, seed: number): MatchState {
  const observation = memory.observation,
    view = observation.round;
  if (observation.phase !== "playing" || view.phase !== "acting")
    throw new RangeError(
      "Simulation roots require a stable playing observation",
    );
  const sample = sampleBelief(memory, seed);
  const hiddenCards = {
    human: `simulation:hidden:human`,
    ai: `simulation:hidden:ai`,
  };
  const number = (
    id: string,
    value: NumberValue,
    generated: boolean,
  ): NumberInstance => ({
    instanceId: id,
    value,
    origin: generated
      ? { type: "generated", sourceId: "simulation" }
      : { type: "initial" },
  });
  const hands = { human: [] as NumberInstance[], ai: [] as NumberInstance[] };
  for (const p of players) {
    hands[p] = view.hands[p].cards.map((c, index) =>
      index === 0
        ? number(hiddenCards[p], c.value ?? sample.hidden, false)
        : number(
            view.faceUpCardIds[p][index - 1],
            c.value!,
            view.faceUpOrigins[view.faceUpCardIds[p][index - 1]] ===
              "generated",
          ),
    );
  }
  const used = new Set([...hands.human, ...hands.ai].map((c) => c.instanceId));
  const deck = sample.deck.map((value, index) => {
    const known = Object.entries(memory.numbers).find(
      ([id, c]) =>
        !used.has(id) &&
        c.value === value &&
        (c.location === "deck" || c.location === "unlocated"),
    );
    const card = known
      ? number(known[0], value, known[1].origin === "generated")
      : number(`simulation:deck:${index}`, value, false);
    used.add(card.instanceId);
    return card;
  });
  const deletedNumbers = Object.entries(memory.numbers)
    .filter(([id]) => !used.has(id))
    .map(([id, c]) => number(id, c.value, c.origin === "generated"));
  const runtime = (p: PlayerId): PlayerSkillState => {
    const v = view.skills![p],
      hypothesis = sample.skills[p]!;
    const activations: SkillActivation[] = v.activations.map((a, i) => ({
      ...a,
      sequence: memory.abilityOrder.indexOf(`skill:${p}:${i}`) + 1,
      public:
        !["metamorphosis", "soul-transfer", "twin-bloom"].includes(v.id) ||
        a.status === "succeeded" ||
        a.status === "ineffective",
    }));
    if (
      hypothesis.secretPrepared &&
      p !== view.viewer &&
      !activations.some(
        (a) =>
          a.status === "prepared" && a.roundNumber === observation.roundNumber,
      )
    ) {
      const id = v.id;
      if (
        id === "metamorphosis" ||
        id === "soul-transfer" ||
        id === "twin-bloom"
      )
        activations.push({
          sequence: memory.abilityOrder.length + 1,
          roundNumber: observation.roundNumber,
          turnNumber: Math.max(1, (view.turn?.number ?? 1) - 1),
          status: "prepared",
          public: false,
          effect:
            id === "twin-bloom"
              ? { type: id, targetTurn: (view.turn?.number ?? 1) + 1 }
              : { type: id },
        });
    }
    return {
      remainingUses: hypothesis.remainingUses,
      publicRemainingUses: v.publicRemainingUses,
      gameActivationsRemaining: hypothesis.gameActivationsRemaining,
      activations,
      ...(v.disabled ? { disabled: true as const } : {}),
      ...(v.canRecover || memory.succeededSkills[p]
        ? { hasSucceeded: true as const }
        : {}),
    };
  };
  const skills: SkillState | undefined = view.skills
    ? {
        players: { human: runtime("human"), ai: runtime("ai") },
        nextActivationSequence: memory.abilityOrder.length + 3,
        knownHiddenCards: {
          human: null,
          ai: null,
          [view.viewer]:
            view.hands[other(view.viewer)].cards[0].value !== null
              ? hiddenCards[other(view.viewer)]
              : null,
        },
        ...(view.skillSeal ? { seal: view.skillSeal } : {}),
      }
    : undefined;
  const round: RoundState = {
    rules: view.rules,
    firstPlayer: view.firstPlayer,
    phase: "acting",
    hands,
    deck,
    numberScope: observation.roundNumber,
    nextNumberId: ordinal(Object.keys(memory.numbers), /:generated-(\d+)$/),
    deletedNumbers,
    hiddenCards,
    lastPlay:
      view.lastPlay?.type === "number"
        ? { ...view.lastPlay, type: "number" }
        : null,
    hiddenMultipliers: view.hiddenMultipliers,
    deckRevision: 0,
    scry: {
      human: null,
      ai: null,
      [view.viewer]: view.peek
        ? { revision: 0, cards: deck.slice(0, view.peek.length) }
        : null,
    },
    pointTarget: view.pointTarget,
    hitDrawCounts: { human: 1, ai: 1 },
    turn: view.turn,
    startedTurnNumber: view.turn?.number,
    quietStays: view.quietStays,
    reactionState: {
      turnNumber: view.turn?.number ?? 0,
      boundary: view.reaction?.boundary ?? 0,
      passed: !view.reaction,
    },
    revealed: players.filter((p) => !view.hands[p].cards[0].faceDown),
    result: null,
    ...(view.trumps ? { trumps: trumps(memory, seed) } : {}),
    ...(skills ? { skills } : {}),
    ...(view.suddenDeath ? { suddenDeath: view.suddenDeath } : {}),
  };
  return freezeData({
    rules: observation.rules,
    phase: observation.phase,
    wins: observation.wins,
    game: observation.game,
    roundNumber: observation.roundNumber,
    round,
    winner: observation.winner,
    ...(observation.nextFirstPlayer
      ? { nextFirstPlayer: observation.nextFirstPlayer }
      : {}),
  });
}
