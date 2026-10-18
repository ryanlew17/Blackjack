// @req REQ-2026-013: unbalanced F1/P0 proposal, never an active match default.
import { freezeData } from "../immutable";
import type { TrumpId } from "../trumps/ids";
import type { CandidateAvailability } from "../trumps/types";

export const CANDIDATE_AVAILABILITY = freezeData({
  "draw-2": {
    earliestDifficulty: "easy",
    copiesPerSide: {
      easy: 2,
      standard: 2,
      challenge: 2,
      danger: 2,
      nightmare: 2,
    },
  },
  "draw-3": {
    earliestDifficulty: "easy",
    copiesPerSide: {
      easy: 2,
      standard: 2,
      challenge: 2,
      danger: 2,
      nightmare: 2,
    },
  },
  "draw-4": {
    earliestDifficulty: "easy",
    copiesPerSide: {
      easy: 2,
      standard: 2,
      challenge: 2,
      danger: 2,
      nightmare: 2,
    },
  },
  "draw-5": {
    earliestDifficulty: "easy",
    copiesPerSide: {
      easy: 2,
      standard: 2,
      challenge: 2,
      danger: 2,
      nightmare: 2,
    },
  },
  "draw-6": {
    earliestDifficulty: "easy",
    copiesPerSide: {
      easy: 2,
      standard: 2,
      challenge: 2,
      danger: 2,
      nightmare: 2,
    },
  },
  "draw-7": {
    earliestDifficulty: "easy",
    copiesPerSide: {
      easy: 2,
      standard: 2,
      challenge: 2,
      danger: 2,
      nightmare: 2,
    },
  },
  return: {
    earliestDifficulty: "easy",
    copiesPerSide: {
      easy: 2,
      standard: 2,
      challenge: 2,
      danger: 2,
      nightmare: 2,
    },
  },
  remove: {
    earliestDifficulty: "standard",
    copiesPerSide: {
      easy: 0,
      standard: 2,
      challenge: 2,
      danger: 2,
      nightmare: 2,
    },
  },
  exchange: {
    earliestDifficulty: "standard",
    copiesPerSide: {
      easy: 0,
      standard: 1,
      challenge: 1,
      danger: 1,
      nightmare: 1,
    },
  },
  "target-17": {
    earliestDifficulty: "challenge",
    copiesPerSide: {
      easy: 0,
      standard: 0,
      challenge: 1,
      danger: 1,
      nightmare: 1,
    },
  },
  "target-24": {
    earliestDifficulty: "standard",
    copiesPerSide: {
      easy: 0,
      standard: 1,
      challenge: 1,
      danger: 1,
      nightmare: 1,
    },
  },
  "target-27": {
    earliestDifficulty: "danger",
    copiesPerSide: {
      easy: 0,
      standard: 0,
      challenge: 0,
      danger: 1,
      nightmare: 1,
    },
  },
  destroy: {
    earliestDifficulty: "easy",
    copiesPerSide: {
      easy: 2,
      standard: 2,
      challenge: 2,
      danger: 2,
      nightmare: 2,
    },
  },
  "destroy-all": {
    earliestDifficulty: "danger",
    copiesPerSide: {
      easy: 0,
      standard: 0,
      challenge: 0,
      danger: 1,
      nightmare: 1,
    },
  },
  "best-draw": {
    earliestDifficulty: "challenge",
    copiesPerSide: {
      easy: 0,
      standard: 0,
      challenge: 1,
      danger: 1,
      nightmare: 1,
    },
  },
  pressure: {
    earliestDifficulty: "standard",
    copiesPerSide: {
      easy: 0,
      standard: 1,
      challenge: 1,
      danger: 1,
      nightmare: 1,
    },
  },
  "pressure-supply": {
    earliestDifficulty: "challenge",
    copiesPerSide: {
      easy: 0,
      standard: 0,
      challenge: 1,
      danger: 1,
      nightmare: 1,
    },
  },
  shield: {
    earliestDifficulty: "standard",
    copiesPerSide: {
      easy: 0,
      standard: 1,
      challenge: 1,
      danger: 1,
      nightmare: 1,
    },
  },
  "shared-supply": {
    earliestDifficulty: "challenge",
    copiesPerSide: {
      easy: 0,
      standard: 0,
      challenge: 1,
      danger: 1,
      nightmare: 1,
    },
  },
  "resource-swap": {
    earliestDifficulty: "danger",
    copiesPerSide: {
      easy: 0,
      standard: 0,
      challenge: 0,
      danger: 1,
      nightmare: 1,
    },
  },
  harvest: {
    earliestDifficulty: "nightmare",
    copiesPerSide: {
      easy: 0,
      standard: 0,
      challenge: 0,
      danger: 0,
      nightmare: 1,
    },
  },
} as const satisfies Record<TrumpId, CandidateAvailability>);

export const EXPERIMENTAL_F1_P0 = freezeData({
  id: "research-f1-p0",
  status: "experimental",
  playable: false,
  resource: {
    model: "finite-per-side-no-recycle",
    gameStartGrant: 2,
    roundStartGrant: 1,
    handLimit: 8,
    tableLimit: 5,
    hitGrant: 0,
    effectDrawGrant: 0,
    overflow: "leave-in-pool",
    exhaustion: "grant-zero",
    reset: "game-end",
  },
  scoring: {
    baseWin: 1,
    bonusCap: 2,
    defense: "bonus-only",
    tie: 0,
    order: "cancel-then-cap",
  },
  lifecycle: {
    playTiming: "own-turn",
    endsTurn: false,
    illegalCommand: "reject-without-consumption",
    legalConsumption: "reset-quiet-stays",
    validateTableBeforeEffects: true,
    tableFullReplacement: "reject",
    immediateDestination: "discard",
    tableExitDestination: "discard",
    handRetention: "until-game-end",
    triggerOrder: "placement-sequence",
    numberReturns: "remaining-number-pool",
  },
} as const);
