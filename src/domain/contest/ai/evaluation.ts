// @req REQ-2026-028: P4 v1 weights, preregistered in the requirement; five difficulties share them.
import { ordinaryHitAvailable } from "../engine/legalActions";
import { completeSteps } from "./steps";
import { freezeData } from "../immutable";
import type { MatchObservation, MatchCommand } from "../engine/types";
import type { PlayerId } from "../types";
import type { Simulation } from "../simulation";

export const EVALUATION = Object.freeze({
  match: 100,
  game: 12,
  matchPoint: 4,
  point: 1,
  progress: 2,
  hand: 0.12,
  removal: 0.2,
  recovery: 0.3,
  stock: 0.02,
  skillUse: 0.6,
  permission: 0.2,
  generator: 0.12,
  counterRisk: 0.35,
  samples: 4,
  equivalent: 0.05,
});
const other = (p: PlayerId): PlayerId => (p === "human" ? "ai" : "human");

/** Estimate future resources from this player's projection of a hypothesis, not real hidden state. */
function reserve(view: MatchObservation): number {
  const p = view.round.viewer,
    skill = view.round.skills?.[p],
    trumps = view.round.trumps;
  const uses = skill?.remainingUses ?? 0;
  let value = EVALUATION.skillUse * uses;
  if (view.game.winner) return value;
  const rounds = Math.max(
    1,
    view.game.target - Math.max(view.game.points.human, view.game.points.ai),
  );
  const sealed = Math.max(
    0,
    (view.round.skillSeal?.throughRound ?? view.roundNumber) - view.roundNumber,
  );
  const available = Math.max(0, rounds - sealed);
  if (skill && !skill.disabled && available > 0)
    value +=
      EVALUATION.permission *
      Math.min(uses, skill.gameActivationsRemaining ?? 0);
  if (
    skill?.activations.some(
      (a) =>
        a.effect?.type === "endless-life" &&
        (a.status === "prepared" || a.status === "succeeded"),
    )
  )
    value += EVALUATION.generator * rounds;
  for (const card of trumps?.ownHand ?? []) {
    const effects =
      view.round.rules.trumps!.definitions[card.definitionId].onPlay;
    value += EVALUATION.hand;
    if (
      effects.some((e) =>
        ["remove-table", "remove-latest", "remove-all"].includes(e.type),
      )
    )
      value += EVALUATION.removal;
    if (effects.some((e) => e.type === "recover-skill-use"))
      value += EVALUATION.recovery;
  }
  const rules = view.round.rules.trumps?.resources;
  if (rules && trumps)
    value +=
      EVALUATION.stock *
      Math.min(trumps.stockCounts[p], available * rules.roundGrant);
  return value;
}

/** Utility of an engine-settled hypothesis. Score bookkeeping is read, never recalculated. */
export function settledValue(simulation: Simulation, viewer: PlayerId) {
  const view = simulation.observe(viewer),
    opponent = other(viewer);
  if (view.phase === "playing" || view.phase === "resolving")
    throw new RangeError("Evaluation requires an engine-settled Round");
  if (view.winner)
    return freezeData({
      total: view.winner === viewer ? EVALUATION.match : -EVALUATION.match,
      match: view.winner === viewer ? EVALUATION.match : -EVALUATION.match,
      game: 0,
      points: 0,
      resources: 0,
    });
  const wins = view.wins;
  const game =
    EVALUATION.game * (wins[viewer] - wins[opponent]) +
    EVALUATION.matchPoint *
      (Number(wins[viewer] === view.rules.gamesToWin - 1) -
        Number(wins[opponent] === view.rules.gamesToWin - 1));
  const points = view.game.winner
    ? 0
    : EVALUATION.point *
        Math.max(
          -4,
          Math.min(4, view.game.points[viewer] - view.game.points[opponent]),
        ) +
      EVALUATION.progress *
        ((view.game.points[viewer] / view.game.target) ** 2 -
          (view.game.points[opponent] / view.game.target) ** 2);
  const resources = reserve(view) - reserve(simulation.observe(opponent));
  return freezeData({
    total: game + points + resources,
    match: 0,
    game,
    points,
    resources,
  });
}

function passiveCommand(view: MatchObservation): MatchCommand {
  const reaction = view.round.reaction,
    turn = view.round.turn!;
  const scope = {
    player: reaction?.player ?? turn.player,
    roundNumber: view.roundNumber,
  };
  if (reaction)
    return {
      type: "PassReaction",
      ...scope,
      turnNumber: reaction.turnNumber,
      reactionBoundary: reaction.boundary,
    };
  if (turn.controlledBy)
    return { type: "ResolveForcedTurn", ...scope, turnNumber: turn.number };
  return { type: "Stay", ...scope };
}

/** No voluntary card/skill chain: closing Stays and finite forced turns settle this Round. */
function* closeRound(
  root: Simulation,
  viewer: PlayerId,
  seed: number,
  counterHit: boolean,
): Generator<void, Simulation, void> {
  let simulation = root,
    step = 0,
    probed = false;
  while (simulation.observe(viewer).phase === "playing") {
    const view = simulation.observe(viewer);
    let command = passiveCommand(view);
    if (
      counterHit &&
      !probed &&
      !view.round.reaction &&
      view.round.turn?.player === other(viewer) &&
      !view.round.turn.controlledBy
    ) {
      probed = true;
      if (ordinaryHitAvailable(view.round))
        command = {
          type: "Hit",
          player: other(viewer),
          roundNumber: view.roundNumber,
        };
    }
    yield;
    const result = simulation.step(command, seed + step++);
    if (!result.accepted)
      throw new RangeError("Passive simulation command was rejected");
    simulation = result.simulation;
  }
  return simulation;
}

/** A leaf estimate with a single Hit vulnerability probe, not a combination search. */
export function* evaluateSimulationSteps(
  simulation: Simulation,
  viewer: PlayerId,
  seed: number,
) {
  const standing = settledValue(
    yield* closeRound(simulation, viewer, seed, false),
    viewer,
  );
  const counter = settledValue(
    yield* closeRound(simulation, viewer, seed, true),
    viewer,
  );
  const risk = Math.max(0, standing.total - counter.total);
  return freezeData({
    score: standing.total - EVALUATION.counterRisk * risk,
    standing,
    counter,
    risk,
  });
}

export function evaluateSimulation(
  simulation: Simulation,
  viewer: PlayerId,
  seed: number,
) {
  return completeSteps(evaluateSimulationSteps(simulation, viewer, seed));
}
