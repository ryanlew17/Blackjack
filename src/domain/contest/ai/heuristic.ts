// @req REQ-2026-028: one-step dynamic evaluation; no production wiring or multi-card search.
import { freezeData } from "../immutable";
import { ordinaryHitAvailable } from "../engine/legalActions";
import { seededRandom } from "../random";
import { createSimulation } from "../simulation";
import type { MatchObservation, MatchCommand } from "../engine/types";
import { decisionCandidates, type DecisionCommand } from "./candidates";
import type { BeliefMemory } from "./memory";
import { EVALUATION, evaluateSimulation } from "./evaluation";

/** Stable semantic ordering makes tie-breaking independent of enumeration order. */
export function commandKey(command: MatchCommand): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(command).sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
}

/** Cheap legal starting choice for a future bounded search; never consumes resources. */
export function fallbackDecision(
  view: MatchObservation,
): DecisionCommand | null {
  const round = view.round,
    turn = round.turn;
  if (view.phase !== "playing" || round.phase !== "acting" || !turn)
    return null;
  const scope = { player: round.viewer, roundNumber: view.roundNumber };
  if (round.reaction)
    return round.reaction.player === round.viewer
      ? {
          type: "PassReaction",
          ...scope,
          turnNumber: round.reaction.turnNumber,
          reactionBoundary: round.reaction.boundary,
        }
      : null;
  if (turn.player !== round.viewer || turn.controlledBy !== undefined)
    return null;
  return {
    type:
      round.hands[round.viewer].total! < round.pointTarget - 4 &&
      ordinaryHitAvailable(round)
        ? "Hit"
        : "Stay",
    ...scope,
  };
}

export interface CandidateValue {
  readonly command: DecisionCommand;
  readonly score: number;
  readonly risk: number;
}

/** Complete current candidates on common sampled worlds, so sample noise is shared. */
export function rankDecisions(
  memory: BeliefMemory,
  seed: number,
): readonly CandidateValue[] {
  const candidates = decisionCandidates(memory.observation);
  if (!candidates.length) return Object.freeze([]);
  const values = candidates.map((command) => ({ command, score: 0, risk: 0 }));
  const random = seededRandom(seed);
  for (let i = 0; i < EVALUATION.samples; i++) {
    const worldSeed = Math.floor(random() * 0x100000000),
      stepSeed = Math.floor(random() * 0x100000000);
    const simulation = createSimulation(memory, worldSeed);
    for (const value of values) {
      const next = simulation.step(value.command, stepSeed);
      if (!next.accepted)
        throw new RangeError("Authorized candidate rejected by its hypothesis");
      const leaf = evaluateSimulation(
        next.simulation,
        memory.observation.round.viewer,
        stepSeed + 8,
      );
      value.score += leaf.score / EVALUATION.samples;
      value.risk += leaf.risk / EVALUATION.samples;
    }
  }
  return freezeData(
    values.sort(
      (a, b) =>
        b.score - a.score ||
        commandKey(a.command).localeCompare(commandKey(b.command)),
    ),
  );
}

export function chooseHeuristic(
  memory: BeliefMemory,
  seed: number,
): DecisionCommand | null {
  const ranked = rankDecisions(memory, seed);
  if (!ranked.length) return null;
  const ties = ranked
    .filter((c) => ranked[0].score - c.score <= EVALUATION.equivalent)
    .sort((a, b) => commandKey(a.command).localeCompare(commandKey(b.command)));
  const passive = ties.find(
    (c) => c.command.type === "Stay" || c.command.type === "PassReaction",
  );
  if (passive) return passive.command;
  return ties[Math.floor(seededRandom(seed)() * ties.length)].command;
}
