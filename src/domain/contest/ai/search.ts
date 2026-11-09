// @req REQ-2026-028: bounded iterative-deepening search on authorized hypotheses only.
import { completeSteps } from "./steps";
import { freezeData } from "../immutable";
import { seededRandom } from "../random";
import { createSimulation, type Simulation } from "../simulation";
import type { MatchCommand } from "../engine/types";
import { decisionCandidates, type DecisionCommand } from "./candidates";
import type { BeliefMemory } from "./memory";
import {
  EVALUATION,
  evaluateSimulationSteps,
  settledValue,
} from "./evaluation";
import { commandKey, fallbackDecision } from "./heuristic";

export const SEARCH_BUDGET = Object.freeze({
  maxNodes: 1_200,
  maxDepth: 6,
  samples: 4,
});
export interface SearchBudget {
  readonly maxNodes: number;
  readonly maxDepth: number;
  readonly samples: number;
}
export interface SearchValue {
  readonly command: DecisionCommand;
  readonly score: number;
}
const passive = (c: MatchCommand) =>
  c.type === "Stay" || c.type === "PassReaction";
function choose(values: readonly SearchValue[], seed: number): DecisionCommand {
  const best = Math.max(...values.map((v) => v.score));
  const ties = values
    .filter((v) => best - v.score <= EVALUATION.equivalent)
    .sort((a, b) => commandKey(a.command).localeCompare(commandKey(b.command)));
  return (
    ties.find((v) => passive(v.command)) ??
    ties[Math.floor(seededRandom(seed)() * ties.length)]
  ).command;
}

/** No clocks, live state, real RNG, future plan or production scheduling crosses this port. */
export function* searchDecisionSteps(
  memory: BeliefMemory,
  seed: number,
  limits: SearchBudget = SEARCH_BUDGET,
) {
  if (
    !Number.isSafeInteger(limits.maxNodes) ||
    limits.maxNodes < 0 ||
    !Number.isSafeInteger(limits.maxDepth) ||
    limits.maxDepth < 0 ||
    !Number.isSafeInteger(limits.samples) ||
    limits.samples < 1
  )
    throw new RangeError("Invalid search budget");
  const stats = {
    nodes: 0,
    cacheHits: 0,
    treeNodes: 0,
    leaves: 0,
    alphaBetaCuts: 0,
    depthCuts: 0,
    budgetCuts: 0,
    completedDepth: 0,
    samples: 0,
    fallbacks: 0,
    skillNodes: 0,
    reactionNodes: 0,
    forcedNodes: 0,
  };
  let command = fallbackDecision(memory.observation);
  let values: readonly SearchValue[] = [];
  const finish = () => freezeData({ command, values, stats });
  if (!command) return finish();
  if (limits.maxNodes === 0 || limits.maxDepth === 0) {
    stats.budgetCuts = 1;
    stats.fallbacks = 1;
    return finish();
  }
  const keys = new WeakMap<MatchCommand, string>();
  const keyOf = (command: MatchCommand) => {
    let key = keys.get(command);
    if (key === undefined) {
      key = commandKey(command);
      keys.set(command, key);
    }
    return key;
  };
  const viewer = memory.observation.round.viewer;
  const candidates = [...decisionCandidates(memory.observation)].sort(
    (a, b) =>
      Number(!passive(a)) - Number(!passive(b)) ||
      keyOf(a).localeCompare(keyOf(b)),
  );
  const exhausted = Symbol("search-budget");
  // Every simulated command, including evaluation rollouts, consumes the same budget.
  const metered = (model: Simulation): Simulation => {
    const successors = new Map<string, ReturnType<Simulation["step"]>>();
    const candidates: Partial<Record<"human" | "ai", readonly MatchCommand[]>> =
      {};
    return {
      observe: model.observe,
      candidates: (viewer) => (candidates[viewer] ??= model.candidates(viewer)),
      step: (next, randomSeed) => {
        if (stats.nodes >= limits.maxNodes) throw exhausted;
        stats.nodes++;
        const key = randomSeed + ":" + keyOf(next);
        const cached = successors.get(key);
        if (cached) {
          stats.cacheHits++;
          return cached;
        }
        const result = model.step(next, randomSeed);
        const successor = {
          accepted: result.accepted,
          simulation: metered(result.simulation),
          get transition() {
            return result.transition;
          },
        };
        successors.set(key, successor);
        return successor;
      },
    };
  };
  const random = seededRandom(seed);
  const worlds: { model: Simulation; seed: number }[] = [];
  for (let i = 0; i < limits.samples; i++) {
    yield;
    const worldSeed = Math.floor(random() * 0x100000000),
      stepSeed = Math.floor(random() * 0x100000000);
    worlds.push({
      model: metered(createSimulation(memory, worldSeed)),
      seed: stepSeed,
    });
  }
  stats.samples = worlds.length;

  const visit = function* (
    model: Simulation,
    depth: number,
    ply: number,
    worldSeed: number,
    alpha: number,
    beta: number,
  ): Generator<void, number, void> {
    stats.treeNodes++;
    const view = model.observe(viewer);
    if (view.phase !== "playing") {
      stats.leaves++;
      return settledValue(model, viewer).total;
    }
    if (depth === 0) {
      stats.depthCuts++;
      stats.leaves++;
      return (yield* evaluateSimulationSteps(
        model,
        viewer,
        worldSeed + 8 + (ply - 1) * 97,
      )).score;
    }
    const actor = view.round.reaction?.player ?? view.round.turn!.player;
    const maximizing = actor === viewer;
    const commands = [...model.candidates(actor)].sort(
      (a, b) =>
        Number(!passive(a)) - Number(!passive(b)) ||
        keyOf(a).localeCompare(keyOf(b)),
    );
    let best = maximizing ? -Infinity : Infinity;
    for (const next of commands) {
      if (next.type === "ActivateSkill") stats.skillNodes++;
      if (view.round.reaction) stats.reactionNodes++;
      if (next.type === "ResolveForcedTurn") stats.forcedNodes++;
      yield;
      const result = model.step(next, worldSeed + ply * 97);
      if (!result.accepted)
        throw new RangeError("Search generated an illegal simulated command");
      const score = yield* visit(
        result.simulation,
        depth - 1,
        ply + 1,
        worldSeed,
        alpha,
        beta,
      );
      best = maximizing ? Math.max(best, score) : Math.min(best, score);
      if (maximizing) alpha = Math.max(alpha, best);
      else beta = Math.min(beta, best);
      if (alpha >= beta) {
        stats.alphaBetaCuts++;
        break;
      }
    }
    if (!Number.isFinite(best))
      throw new RangeError("No search continuation at a playing boundary");
    return best;
  };
  try {
    for (let depth = 1; depth <= limits.maxDepth; depth++) {
      const iteration: SearchValue[] = [];
      for (const candidate of candidates) {
        let sum = 0;
        for (const world of worlds) {
          yield;
          const next = world.model.step(candidate, world.seed);
          if (!next.accepted)
            throw new RangeError(
              "Authorized search root rejected by hypothesis",
            );
          sum += yield* visit(
            next.simulation,
            depth - 1,
            1,
            world.seed,
            -Infinity,
            Infinity,
          );
        }
        iteration.push({ command: candidate, score: sum / worlds.length });
      }
      values = iteration.sort(
        (a, b) =>
          b.score - a.score || keyOf(a.command).localeCompare(keyOf(b.command)),
      );
      command = choose(values, seed);
      stats.completedDepth = depth;
      // Reuse last completed root order; scores still replace atomically, never candidate by candidate.
      candidates.sort(
        (a, b) =>
          values.findIndex((v) => v.command === a) -
          values.findIndex((v) => v.command === b),
      );
    }
  } catch (error) {
    if (error !== exhausted) throw error;
    stats.budgetCuts++;
  }
  if (!stats.completedDepth) stats.fallbacks++;
  return finish();
}

/** Existing synchronous benchmark API; application scheduling drives the same iterator in slices. */
export function searchDecision(
  memory: BeliefMemory,
  seed: number,
  limits: SearchBudget = SEARCH_BUDGET,
) {
  return completeSteps(searchDecisionSteps(memory, seed, limits));
}
