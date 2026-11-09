// @req REQ-2026-028: explicit constraints and reproducible hypotheses, not hidden truth.
import { freezeData } from "../immutable";
import { seededRandom } from "../random";
import type { NumberValue, PlayerId } from "../types";
import type { BeliefMemory } from "./memory";

const values: readonly NumberValue[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const other = (p: PlayerId): PlayerId => (p === "human" ? "ai" : "human");
export interface SkillHypothesis {
  readonly remainingUses: number;
  readonly gameActivationsRemaining: number;
  /** Only the unobserved secret preparation; public/own activations stay in the observation. */
  readonly secretPrepared: boolean;
}
export interface StockConstraint {
  readonly count: number;
  readonly definitions: Readonly<
    Record<string, { readonly min: number; readonly max: number }>
  >;
  readonly initialUnaccounted: readonly string[];
  readonly generatedCopies: number;
  readonly knownGenerated: readonly string[];
  readonly requiredGenerated: readonly string[];
}

function skillHypotheses(
  memory: BeliefMemory,
  player: PlayerId,
): readonly SkillHypothesis[] {
  const view = memory.observation.round.skills?.[player];
  if (!view) return [];
  if (view.remainingUses !== null && view.gameActivationsRemaining !== null)
    return [
      {
        remainingUses: view.remainingUses,
        gameActivationsRemaining: view.gameActivationsRemaining,
        secretPrepared: false,
      },
    ];
  const result: SkillHypothesis[] = [];
  const { min, max } = view.knownRemainingUses;
  const possibleSpends =
    memory.observation.game.number -
    1 +
    (memory.gameOpportunity[player] ? 1 : 0) +
    memory.recoveries[player];
  const priorUses = memory.matchOpportunity[player]
    ? Math.max(min, max - possibleSpends)
    : max;
  for (let uses = priorUses; uses <= max; uses++) {
    const permissions = memory.gameOpportunity[player] ? [0, 1] : [1];
    for (const permission of permissions) {
      if (
        permission === 1 &&
        max - uses >
          memory.observation.game.number - 1 + memory.recoveries[player]
      )
        continue;
      // With no publicly hidden spending, a secret preparation cannot have consumed a use.
      if (permission === 0 && uses === max && !view.activations.length)
        continue;
      result.push({
        remainingUses: uses,
        gameActivationsRemaining: permission,
        secretPrepared: false,
      });
      if (
        permission === 0 &&
        uses < max &&
        memory.roundOpportunity[player] &&
        ["metamorphosis", "soul-transfer", "twin-bloom"].includes(view.id)
      )
        result.push({
          remainingUses: uses,
          gameActivationsRemaining: permission,
          secretPrepared: true,
        });
    }
  }
  return result;
}

function stockConstraint(
  memory: BeliefMemory,
  player: PlayerId,
): StockConstraint {
  const round = memory.observation.round;
  const stock = round.rules.trumps?.resources?.stock ?? {};
  const remaining = { ...stock };
  for (const card of Object.values(memory.trumps))
    if (
      card.origin.type === "stock" &&
      card.origin.owner === player &&
      card.origin.game === memory.observation.game.number
    )
      remaining[card.definitionId] = Math.max(
        0,
        (remaining[card.definitionId] ?? 0) - 1,
      );
  for (const id of memory.stockAbsent[player]) remaining[id] = 0;
  const initialUnaccounted = Object.entries(remaining).flatMap(([id, count]) =>
    Array<string>(count).fill(id),
  );
  const count = round.trumps?.stockCounts[player] ?? 0;
  const generatedCopies = memory.stockAdded[player];
  const restored = memory.stockAdditions.filter(
    (change) => change.player === player,
  );
  const available = [...restored];
  for (const id of memory.knownGeneratedStockRemovals) {
    const card = memory.trumps[id];
    if (card?.origin.type !== "generated") continue;
    const source = card.origin.sourceId;
    const index = available.findIndex(
      (change) =>
        change.sourceId === source && change.definitionId === card.definitionId,
    );
    if (index >= 0) available.splice(index, 1);
  }
  const knownGenerated = available
    .map((change) => change.definitionId)
    .filter((id) => !memory.stockAbsent[player].includes(id));
  const requiredGenerated = available
    .filter((change) => change.certain)
    .map((change) => change.definitionId)
    .filter((id) => !memory.stockAbsent[player].includes(id));
  const unknownGenerated = generatedCopies - restored.length;
  const total =
    initialUnaccounted.length + knownGenerated.length + unknownGenerated;
  const definitions = Object.fromEntries(
    Object.keys(round.rules.trumps?.definitions ?? {})
      .sort()
      .map((id) => [
        id,
        {
          min: Math.max(
            requiredGenerated.filter((value) => value === id).length,
            count -
              (total -
                (remaining[id] ?? 0) -
                knownGenerated.filter((value) => value === id).length),
          ),
          max: memory.stockAbsent[player].includes(id)
            ? 0
            : Math.min(
                count,
                (remaining[id] ?? 0) +
                  knownGenerated.filter((value) => value === id).length +
                  unknownGenerated,
              ),
        },
      ]),
  );
  return {
    count,
    definitions,
    initialUnaccounted,
    generatedCopies: unknownGenerated,
    knownGenerated,
    requiredGenerated,
  };
}

/** Uniform unresolved numbers/skill branches; stock is per-copy, generation is per-definition. */
export function buildBelief(memory: BeliefMemory) {
  const round = memory.observation.round;
  const opponent = other(round.viewer);
  const knownHidden = round.hands[opponent].cards[0]?.value;
  const hidden =
    knownHidden !== null && knownHidden !== undefined
      ? [knownHidden]
      : values.filter((value) => !memory.initialSeen.includes(value));
  const stock = {
    human: stockConstraint(memory, "human"),
    ai: stockConstraint(memory, "ai"),
  };
  const generationIds = memory.generatedDefinitions[opponent];
  const acquisitions = memory.acquisitions[opponent];
  const handWeights = new Map<string, number>();
  // These are marginal proposal weights. P3 must condition a joint assignment on stock/hand counts.
  const add = (ids: readonly string[], weight: number) => {
    if (!ids.length || weight === 0) return;
    for (const id of ids)
      handWeights.set(id, (handWeights.get(id) ?? 0) + weight / ids.length);
  };
  add(stock[opponent].initialUnaccounted, acquisitions.stock);
  add(generationIds, acquisitions.generated);
  add(
    memory.transferredToOpponent.map((c) => c.definitionId),
    acquisitions.transferred,
  );
  // Explicit fixture hands have no public stock model: every frozen definition is a hypothesis.
  if (
    !round.rules.trumps?.resources &&
    (round.trumps?.opponentHandCount ?? 0) > 0
  )
    add(Object.keys(round.rules.trumps?.definitions ?? {}).sort(), 1);
  return freezeData({
    opponent,
    hidden: hidden.map((value) => ({ value, weight: 1 })),
    peek: round.peek,
    deckCount: round.deckCount,
    stock,
    opponentHand: {
      count: round.trumps?.opponentHandCount ?? 0,
      proposal: [...handWeights]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([value, weight]) => ({ value, weight })),
      transferredCandidates: memory.transferredToOpponent,
      acquisitions,
    },
    skills: {
      human: skillHypotheses(memory, "human"),
      ai: skillHypotheses(memory, "ai"),
    },
  });
}

function take<T>(items: T[], random: () => number): T {
  if (!items.length)
    throw new RangeError("Authorized history has no consistent sample");
  return items.splice(Math.floor(random() * items.length), 1)[0];
}

function numberPool(memory: BeliefMemory, hidden: NumberValue): NumberValue[] {
  const round = memory.observation.round;
  const ownHidden = round.hands[round.viewer].cards[0]?.value;
  const cards = Object.values(memory.numbers);
  return [
    ...values.filter(
      (value) =>
        !memory.absentDeckValues.includes(value) &&
        value !== hidden &&
        value !== ownHidden &&
        !cards.some(
          (c) =>
            c.origin === "initial" &&
            c.value === value &&
            (c.location === "human" ||
              c.location === "ai" ||
              c.location === "deleted"),
        ),
    ),
    ...cards
      .filter(
        (c) =>
          !memory.absentDeckValues.includes(c.value) &&
          c.origin === "generated" &&
          (c.location === "deck" || c.location === "unlocated"),
      )
      .map((c) => c.value),
  ];
}

/** Samples only hidden numbers and skill branches; this is not a simulated MatchState. */
export function sampleBelief(memory: BeliefMemory, seed: number) {
  const belief = buildBelief(memory);
  const random = seededRandom(seed);
  const possibilities = belief.hidden
    .map((h) => h.value)
    .filter((hidden) => {
      const pool = numberPool(memory, hidden);
      for (const value of belief.peek ?? []) {
        const index = pool.indexOf(value);
        if (index < 0) return false;
        pool.splice(index, 1);
      }
      return pool.length >= belief.deckCount - (belief.peek?.length ?? 0);
    });
  const hidden = take(possibilities, random);
  const pool = numberPool(memory, hidden);
  const deck = [...(belief.peek ?? [])];
  for (const value of deck) pool.splice(pool.indexOf(value), 1);
  while (deck.length < belief.deckCount) deck.push(take(pool, random));
  const skill = (player: PlayerId) =>
    belief.skills[player].length
      ? take([...belief.skills[player]], random)
      : null;
  return freezeData({
    hidden,
    deck,
    skills: { human: skill("human"), ai: skill("ai") },
  });
}

/** Stock samples respect public totals and known original removals, never real inventory order. */
export function sampleStock(
  memory: BeliefMemory,
  player: PlayerId,
  seed: number,
): readonly string[] {
  const constraint = stockConstraint(memory, player);
  const random = seededRandom(seed);
  const pool = [...constraint.initialUnaccounted, ...constraint.knownGenerated];
  const definitions = Object.keys(
    memory.observation.round.rules.trumps?.definitions ?? {},
  )
    .filter((id) => !memory.stockAbsent[player].includes(id))
    .sort();
  for (let i = 0; i < constraint.generatedCopies; i++)
    pool.push(take([...definitions], random));
  const stock: string[] = [...constraint.requiredGenerated];
  for (const id of stock) pool.splice(pool.indexOf(id), 1);
  while (stock.length < constraint.count) stock.push(take(pool, random));
  return Object.freeze(stock);
}
