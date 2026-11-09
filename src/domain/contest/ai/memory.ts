// @req REQ-2026-028: reduce authorized transitions, never authoritative state or replay callbacks.
import { freezeData } from "../immutable";
import type { NumberValue, PlayerId } from "../types";
import type { TrumpInstance } from "../engine/effectTypes";
import type {
  MatchObservation,
  MatchTransitionView,
  RoundEventView,
} from "../engine/types";

export interface KnownNumber {
  readonly value: NumberValue;
  readonly origin: "initial" | "generated";
  /** Unlocated preserves ambiguity when an intermediate frame does not explain a removal. */
  readonly location: PlayerId | "deck" | "deleted" | "unlocated";
}
export interface AcquisitionCounts {
  readonly stock: number;
  readonly generated: number;
  readonly transferred: number;
}
export interface StockChange {
  readonly player: PlayerId;
  readonly definitionId: string;
  readonly sourceId: string;
}
export interface HiddenGeneration {
  readonly definitions: readonly string[];
  readonly sourceId: string;
  readonly skillId?: "endless-life";
}
export interface BeliefMemory {
  readonly observation: MatchObservation;
  /** Authorized frames of the current undo window; never an authoritative transaction. */
  /** Hidden destruction slots caused by Nullify cannot contain immune generation. */
  readonly nonImmuneDestroyed: readonly number[];
  readonly lastTrumpFrames: readonly RoundEventView[];
  /** Observed relative ordering, without private sequence-counter gaps. */
  readonly abilityOrder: readonly string[];
  readonly succeededSkills: Readonly<Record<PlayerId, boolean>>;
  readonly numbers: Readonly<Record<string, KnownNumber>>;
  readonly initialSeen: readonly NumberValue[];
  /** Historical private values, with no claim about current positions or remaining copies. */
  readonly seenDeckValues: readonly NumberValue[];
  readonly absentDeckValues: readonly NumberValue[];
  readonly stockAbsent: Readonly<Record<PlayerId, readonly string[]>>;
  readonly recoveries: Readonly<Record<PlayerId, number>>;
  /** Identity-deduplicated authorized instances; origin.owner is not the current holder. */
  readonly trumps: Readonly<Record<string, TrumpInstance>>;
  readonly acquisitions: Readonly<Record<PlayerId, AcquisitionCounts>>;
  /** Public stock increases (undo creates new copies) are separate from initial quotas. */
  readonly stockDeletions: readonly StockChange[];
  readonly stockAdditions: readonly (StockChange & {
    readonly certain: boolean;
  })[];
  readonly knownGeneratedStockRemovals: readonly string[];
  readonly stockAdded: Readonly<Record<PlayerId, number>>;
  readonly transferredToOpponent: readonly TrumpInstance[];
  readonly roundOpportunity: Readonly<Record<PlayerId, boolean>>;
  readonly gameOpportunity: Readonly<Record<PlayerId, boolean>>;
  readonly matchOpportunity: Readonly<Record<PlayerId, boolean>>;
  readonly hiddenGenerations: Readonly<
    Record<PlayerId, readonly HiddenGeneration[]>
  >;
  readonly generatedDefinitions: Readonly<Record<PlayerId, readonly string[]>>;
  readonly generationContext: Readonly<Record<PlayerId, readonly string[]>>;
}
const players = ["human", "ai"] as const;
const emptyCounts = (): AcquisitionCounts => ({
  stock: 0,
  generated: 0,
  transferred: 0,
});

function remember(
  previous: BeliefMemory | null,
  observation: MatchObservation,
  event?: RoundEventView,
  restored: readonly StockChange[] = [],
): BeliefMemory {
  const round = observation.round;
  if (previous && previous.observation.round.viewer !== round.viewer)
    throw new RangeError("Belief memory belongs to one observer");
  const newGame =
    !previous || previous.observation.game.number !== observation.game.number;
  const newRound =
    newGame || previous.observation.roundNumber !== observation.roundNumber;
  const abilityOrder = newGame ? [] : [...previous.abilityOrder];
  const succeededSkills = previous
    ? { ...previous.succeededSkills }
    : { human: false, ai: false };
  for (const player of players) {
    for (const [index, activation] of (
      round.skills?.[player].activations ?? []
    ).entries()) {
      const key = `skill:${player}:${index}`;
      if (!abilityOrder.includes(key)) abilityOrder.push(key);
      if (activation.status === "succeeded") succeededSkills[player] = true;
    }
  }
  for (const effect of round.trumps?.table ?? []) {
    const key = `table:${effect.effectId}`;
    if (!abilityOrder.includes(key)) abilityOrder.push(key);
  }
  const numbers = { ...(newRound ? {} : previous.numbers) };
  const seen = new Set<NumberValue>(newRound ? [] : previous.initialSeen);
  const absentDeck = new Set<NumberValue>(
    newRound ||
      (previous &&
        observation.round.deckCount > previous.observation.round.deckCount)
      ? []
      : previous.absentDeckValues,
  );
  const stockAbsent = newGame
    ? { human: [] as string[], ai: [] as string[] }
    : {
        human: [...previous.stockAbsent.human],
        ai: [...previous.stockAbsent.ai],
      };
  if (
    event?.type === "trump" &&
    event.effect === "draw" &&
    event.card === null
  ) {
    const effects =
      round.rules.trumps?.definitions[event.instance.definitionId]?.onPlay ??
      [];
    // Do not confuse a mixed definition's other failed draw with a specific-number miss.
    if (effects.length === 1 && effects[0].type === "draw-number")
      absentDeck.add(effects[0].value);
  }
  const seenDeck = new Set<NumberValue>(
    newRound ? [] : previous.seenDeckValues,
  );
  const recoveries = previous
    ? { ...previous.recoveries }
    : { human: 0, ai: 0 };
  if (event?.type === "trump" && event.effect === "skill-recovered")
    recoveries[event.effectPlayer ?? event.player]++;
  const trumps = { ...(newGame ? {} : previous.trumps) };
  const acquisitions = newGame
    ? { human: emptyCounts(), ai: emptyCounts() }
    : { ...previous.acquisitions };
  const stockAdded = newGame ? { human: 0, ai: 0 } : { ...previous.stockAdded };
  const stockDeletions = newGame ? [] : [...previous.stockDeletions];
  const stockAdditions = newGame ? [] : [...previous.stockAdditions];
  const knownGeneratedStockRemovals = newGame
    ? []
    : [...previous.knownGeneratedStockRemovals];
  let transferred = newGame ? [] : [...previous.transferredToOpponent];
  const roundOpportunity = newRound
    ? { human: false, ai: false }
    : { ...previous.roundOpportunity };
  const gameOpportunity = newGame
    ? { human: false, ai: false }
    : { ...previous.gameOpportunity };
  const matchOpportunity = previous
    ? { ...previous.matchOpportunity }
    : { human: false, ai: false };
  const hiddenGenerations = newGame
    ? { human: [] as HiddenGeneration[], ai: [] as HiddenGeneration[] }
    : {
        human: [...previous.hiddenGenerations.human],
        ai: [...previous.hiddenGenerations.ai],
      };
  const generatedDefinitions = newGame
    ? { human: [] as string[], ai: [] as string[] }
    : {
        human: [...previous.generatedDefinitions.human],
        ai: [...previous.generatedDefinitions.ai],
      };
  const generationContext = newGame
    ? { human: [] as string[], ai: [] as string[] }
    : {
        human: [...previous.generationContext.human],
        ai: [...previous.generationContext.ai],
      };
  if (event?.type === "skill") {
    const opponent = round.viewer === "human" ? "ai" : "human";
    generationContext[event.player] =
      event.skillId === "twin-bloom" && event.player === opponent
        ? (round.trumps?.ownHand ?? []).map((c) => c.definitionId)
        : event.skillId === "soul-transfer"
          ? ["regret"]
          : Object.entries(round.rules.trumps?.resources?.stock ?? {})
              .filter(([, n]) => n > 0)
              .map(([id]) => id);
  } else if (event?.type === "trump" && event.effect === "played") {
    generationContext[event.effectPlayer ?? event.player] = (
      round.rules.trumps?.definitions[event.instance.definitionId]?.onPlay ?? []
    ).flatMap((effect) =>
      effect.type === "generate-trump" ? [effect.definitionId] : [],
    );
  }
  const currentIds = new Set(Object.values(round.faceUpCardIds).flat());
  for (const [id, card] of Object.entries(numbers)) {
    if (
      (card.location === "human" || card.location === "ai") &&
      !currentIds.has(id)
    ) {
      const removal = event?.type === "trump" ? event.effect : undefined;
      const deleted =
        removal === "deleted-number" ||
        (event?.type === "skill" &&
          (event.skillId === "self-renewal" || event.skillId === "twin-bloom"));
      numbers[id] = {
        ...card,
        location:
          removal === "return" ? "deck" : deleted ? "deleted" : "unlocated",
      };
    }
  }
  for (const player of players) {
    // The logical hidden slot is always an initial card; it is never deleted or replaced.
    const hidden = round.hands[player].cards[0]?.value;
    if (hidden !== null && hidden !== undefined && round.phase !== "settled")
      seen.add(hidden);
    round.faceUpCardIds[player].forEach((id, index) => {
      const value = round.hands[player].cards[index + 1]?.value;
      if (value === null || value === undefined) return;
      const origin = round.faceUpOrigins[id];
      numbers[id] = { value, origin, location: player };
      if (origin === "initial" && round.phase !== "settled") seen.add(value);
    });
    const increase =
      (round.trumps?.stockCounts[player] ?? 0) -
      (newGame
        ? 0
        : (previous.observation.round.trumps?.stockCounts[player] ?? 0));
    if (!newGame && increase < 0) {
      const removed = event?.type === "resource" ? event.instance : null;
      if (!removed) {
        for (let i = 0; i < stockAdditions.length; i++)
          if (stockAdditions[i].player === player)
            stockAdditions[i] = { ...stockAdditions[i], certain: false };
      }
    }
    if (!newGame && increase > 0) {
      stockAdded[player] += increase;
      const restoredForPlayer = restored.filter(
        (change) => change.player === player,
      );
      for (let i = 0; i < increase; i++) {
        const definitionId = restoredForPlayer[i]?.definitionId;
        if (definitionId)
          stockAdditions.push({
            player,
            definitionId,
            sourceId: round.lastPlay?.instanceId ?? "",
            certain: true,
          });
      }
      stockAbsent[player] = [];
    }
  }
  for (const value of round.peek ?? []) {
    seenDeck.add(value);
    // Only an initial instance proves that this value cannot be the opponent's original hidden slot.
    if (
      !Object.values(numbers).some(
        (c) => c.origin === "generated" && c.value === value,
      )
    )
      seen.add(value);
  }
  for (const card of round.trumps?.ownHand ?? [])
    trumps[card.instanceId] = card;
  for (const entry of round.trumps?.destroyed ?? [])
    if (entry.instance) trumps[entry.instance.instanceId] = entry.instance;
  if (event?.type === "resource") {
    const card = event.instance;
    if (event.operation === "delete" && event.definitionId && !card)
      stockAbsent[event.player] = [
        ...new Set([...stockAbsent[event.player], event.definitionId]),
      ];
    if (card) {
      trumps[card.instanceId] = card;
      if (event.operation === "delete" && event.definitionId)
        stockDeletions.push({
          player: event.player,
          definitionId: card.definitionId,
          sourceId: round.lastPlay?.instanceId ?? "",
        });
      if (
        card.origin.type === "generated" &&
        (event.operation === "draw" ||
          (event.operation === "delete" && event.definitionId))
      )
        knownGeneratedStockRemovals.push(card.instanceId);
    }
    // A hidden successful draw is identified by the public stock delta, not by null identity.
    const prior = newGame ? undefined : previous.observation.round.trumps;
    const handDelta =
      event.player === round.viewer
        ? (round.trumps?.ownHand.length ?? 0) - (prior?.ownHand.length ?? 0)
        : (round.trumps?.opponentHandCount ?? 0) -
          (prior?.opponentHandCount ?? 0);
    const stockDelta =
      (prior?.stockCounts[event.player] ?? 0) -
      (round.trumps?.stockCounts[event.player] ?? 0);
    const channel =
      event.operation === "draw"
        ? "stock"
        : event.operation === "generate"
          ? "generated"
          : event.operation === "transfer"
            ? "transferred"
            : null;
    if (
      channel &&
      (card || handDelta > 0 || (channel === "stock" && stockDelta > 0))
    )
      acquisitions[event.player] = {
        ...acquisitions[event.player],
        [channel]: acquisitions[event.player][channel] + 1,
      };
    if (channel === "generated" && (card || handDelta > 0))
      generatedDefinitions[event.player].push(
        ...(card
          ? [card.definitionId]
          : event.cause === "trigger" &&
              round.skills?.[event.player].id === "endless-life"
            ? Object.entries(round.rules.trumps?.resources?.stock ?? {})
                .filter(([, count]) => count > 0)
                .map(([id]) => id)
            : generationContext[event.player].length
              ? generationContext[event.player]
              : Object.keys(round.rules.trumps?.definitions ?? {})),
      );
    if (channel === "generated" && !card && handDelta > 0) {
      const endless =
        event.cause === "trigger" &&
        round.skills?.[event.player].id === "endless-life";
      const soul =
        generationContext[event.player].length === 1 &&
        generationContext[event.player][0] === "regret" &&
        round.skills?.[event.player].id === "soul-transfer";
      hiddenGenerations[event.player].push({
        definitions: endless
          ? Object.entries(round.rules.trumps?.resources?.stock ?? {})
              .filter(([, n]) => n > 0)
              .map(([id]) => id)
          : [...generationContext[event.player]],
        sourceId: endless
          ? `skill:endless-life:${event.player}:game-${observation.game.number}`
          : soul
            ? `skill:soul-transfer:${event.player}:round-${observation.roundNumber}`
            : (round.lastPlay?.instanceId ?? "simulation"),
        ...(endless ? { skillId: "endless-life" as const } : {}),
      });
    }
    if (event.operation === "transfer" && event.player !== round.viewer && card)
      transferred.push(card);
  }
  const destroyed = new Set(
    (round.trumps?.destroyed ?? []).flatMap((d) =>
      d.instance ? [d.instance.instanceId] : [],
    ),
  );
  const own = new Set((round.trumps?.ownHand ?? []).map((c) => c.instanceId));
  transferred = transferred.filter(
    (c) => !destroyed.has(c.instanceId) && !own.has(c.instanceId),
  );
  // An unseen payment/deletion may have removed any previously observed transferred card.
  // Keep these as possible identities, never assert they are still in the opposing hand.
  if (
    !newRound &&
    previous &&
    JSON.stringify(previous.observation) !== JSON.stringify(observation)
  ) {
    const before = previous.observation.round;
    const player = before.reaction?.player ?? before.turn?.player;
    if (player && before.phase === "acting" && !before.turn?.controlledBy) {
      roundOpportunity[player] = true;
      gameOpportunity[player] = true;
      matchOpportunity[player] = true;
    }
  }
  return freezeData({
    observation,
    nonImmuneDestroyed: newGame ? [] : previous.nonImmuneDestroyed,
    lastTrumpFrames:
      newRound || round.lastPlay?.type !== "trump"
        ? []
        : (previous?.lastTrumpFrames ?? []),
    abilityOrder,
    succeededSkills,
    numbers,
    initialSeen: [...seen].sort((a, b) => a - b),
    seenDeckValues: [...seenDeck].sort((a, b) => a - b),
    absentDeckValues: [...absentDeck],
    stockAbsent,
    recoveries,
    trumps,
    acquisitions,
    stockAdded,
    stockDeletions,
    stockAdditions,
    knownGeneratedStockRemovals,
    transferredToOpponent: transferred,
    roundOpportunity,
    gameOpportunity,
    matchOpportunity,
    generatedDefinitions,
    hiddenGenerations,
    generationContext,
  });
}

/** Start from the projected createMatch result. Feed each committed transition once, before replay. */
export function createBeliefMemory(initial: MatchTransitionView): BeliefMemory {
  return advanceBeliefMemory(null, initial);
}

/** No persistent match ID: a new Match must use createBeliefMemory, even with identical rules. */
export function advanceBeliefMemory(
  previous: BeliefMemory | null,
  result: MatchTransitionView,
): BeliefMemory {
  let memory = previous;
  const undone = result.events.some(
    (event) =>
      event.type === "round" &&
      event.event.type === "trump" &&
      event.event.effect === "undone",
  );
  const restored = undone
    ? (previous?.stockDeletions.filter(
        (change) =>
          change.sourceId === previous.observation.round.lastPlay?.instanceId,
      ) ?? [])
    : [];
  for (const event of result.events)
    memory = remember(
      memory,
      event.state,
      event.type === "round" ? event.event : undefined,
      restored,
    );
  let remembered = remember(memory, result.state, undefined, restored);
  if (
    result.events.some(
      (e) =>
        e.type === "round" &&
        e.event.type === "skill" &&
        e.event.skillId === "nullify",
    )
  ) {
    const indices = [...remembered.nonImmuneDestroyed];
    for (const e of result.events)
      if (
        e.type === "round" &&
        e.event.type === "resource" &&
        e.event.operation === "delete" &&
        !e.event.instance
      )
        indices.push(e.event.state.trumps!.destroyed.length - 1);
    remembered = freezeData({ ...remembered, nonImmuneDestroyed: indices });
  }
  const frames = result.events.flatMap((event) =>
    event.type === "round" ? [event.event] : [],
  );
  const start = frames.findIndex(
    (event) =>
      event.type === "trump" &&
      event.effect === "played" &&
      event.instance.instanceId === result.state.round.lastPlay?.instanceId,
  );
  return start >= 0 && result.state.round.lastPlay?.type === "trump"
    ? freezeData({ ...remembered, lastTrumpFrames: frames.slice(start) })
    : remembered;
}
