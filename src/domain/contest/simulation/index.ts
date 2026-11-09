// @req REQ-2026-028: opaque immutable hypotheses, advanced only by the existing engine.
import { freezeData } from "../immutable";
import { seededRandom } from "../random";
import { decisionCandidates } from "../ai/candidates";
import type { BeliefMemory } from "../ai/memory";
import { transitionMatch, legalMatchActions } from "../engine/match";
import {
  observeMatch,
  projectMatchTransition,
} from "../engine/matchObservation";
import type {
  MatchState,
  MatchCommand,
  MatchObservation,
  MatchTransitionView,
} from "../engine/types";
import type { PlayerId } from "../types";
import { hydrate } from "./hydrate";
import { undoWitness } from "./undo";

export interface Simulation {
  readonly observe: (viewer: PlayerId) => MatchObservation;
  readonly candidates: (viewer: PlayerId) => readonly MatchCommand[];
  readonly step: (
    command: MatchCommand,
    seed: number,
  ) => {
    readonly accepted: boolean;
    readonly simulation: Simulation;
    readonly transition: MatchTransitionView;
  };
}
function wrap(state: MatchState, viewer: PlayerId): Simulation {
  // Immutable nodes can reuse their projections; search often reads a node several times.
  const observations: Partial<Record<PlayerId, MatchObservation>> = {};
  const observe = (who: PlayerId) =>
    (observations[who] ??= observeMatch(state, who));
  const simulation: Simulation = Object.freeze({
    observe,
    candidates: (who: PlayerId) => {
      const view = observe(who),
        actions = legalMatchActions(view);
      if (actions.includes("NextRound"))
        return [{ type: "NextRound" as const, roundNumber: state.roundNumber }];
      if (actions.includes("ResolveForcedTurn"))
        return [
          {
            type: "ResolveForcedTurn" as const,
            player: who,
            roundNumber: state.roundNumber,
            turnNumber: state.round.turn!.number,
          },
        ];
      return decisionCandidates(view);
    },
    step: (command: MatchCommand, seed: number) => {
      const result = transitionMatch(state, command, {
        numbers: seededRandom(seed),
        trumpGate: seededRandom(seed + 1),
        trumpSelection: seededRandom(seed + 2),
        skillSelection: seededRandom(seed + 3),
        skillEffects: seededRandom(seed + 4),
      });
      let projected: MatchTransitionView | undefined;
      return Object.freeze({
        accepted: result.state !== state,
        simulation:
          result.state === state ? simulation : wrap(result.state, viewer),
        // Search consumes the successor only; do not build an unused replay projection.
        get transition() {
          return (projected ??= projectMatchTransition(result, viewer));
        },
      });
    },
  });
  return simulation;
}

/** The only external constructor accepts projected memory, never a live MatchState or RNG. */
export function createSimulation(
  memory: BeliefMemory,
  seed: number,
): Simulation {
  const model = hydrate(memory, seed);
  const state = freezeData({
    ...model,
    round: { ...model.round, lastPlay: undoWitness(memory, model) },
  });
  const observed = observeMatch(state, memory.observation.round.viewer);
  if (JSON.stringify(observed) !== JSON.stringify(memory.observation))
    throw new RangeError(
      "Hypothesis does not reproduce its authorized observation",
    );
  return wrap(state, memory.observation.round.viewer);
}
