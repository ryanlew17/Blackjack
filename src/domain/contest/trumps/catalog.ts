// @req REQ-2026-013: candidate catalog only; no gameplay execution or admission.
import { freezeData } from "../immutable";
import { isTrumpId, type TrumpId } from "./ids";
import type { TrumpDefinition } from "./types";

export const TRUMP_CATALOG = freezeData({
  "draw-2": {
    id: "draw-2",
    nameKey: "contest.trump.draw-2.name",
    descriptionKey: "contest.trump.draw-2.description",
    tags: ["buff", "number"],
    conditions: [],
    cost: null,
    onPlay: [
      {
        kind: "drawNumber",
        value: 2,
      },
    ],
    table: null,
    failedResolution: "consume",
    provenance: {
      referenceName: "2 Card",
      sourceIds: ["W2"],
    },
    admission: "priority-prototype",
    playable: false,
  },
  "draw-3": {
    id: "draw-3",
    nameKey: "contest.trump.draw-3.name",
    descriptionKey: "contest.trump.draw-3.description",
    tags: ["buff", "number"],
    conditions: [],
    cost: null,
    onPlay: [
      {
        kind: "drawNumber",
        value: 3,
      },
    ],
    table: null,
    failedResolution: "consume",
    provenance: {
      referenceName: "3 Card",
      sourceIds: ["W2"],
    },
    admission: "priority-prototype",
    playable: false,
  },
  "draw-4": {
    id: "draw-4",
    nameKey: "contest.trump.draw-4.name",
    descriptionKey: "contest.trump.draw-4.description",
    tags: ["buff", "number"],
    conditions: [],
    cost: null,
    onPlay: [
      {
        kind: "drawNumber",
        value: 4,
      },
    ],
    table: null,
    failedResolution: "consume",
    provenance: {
      referenceName: "4 Card",
      sourceIds: ["W2"],
    },
    admission: "priority-prototype",
    playable: false,
  },
  "draw-5": {
    id: "draw-5",
    nameKey: "contest.trump.draw-5.name",
    descriptionKey: "contest.trump.draw-5.description",
    tags: ["buff", "number"],
    conditions: [],
    cost: null,
    onPlay: [
      {
        kind: "drawNumber",
        value: 5,
      },
    ],
    table: null,
    failedResolution: "consume",
    provenance: {
      referenceName: "5 Card",
      sourceIds: ["W2"],
    },
    admission: "priority-prototype",
    playable: false,
  },
  "draw-6": {
    id: "draw-6",
    nameKey: "contest.trump.draw-6.name",
    descriptionKey: "contest.trump.draw-6.description",
    tags: ["buff", "number"],
    conditions: [],
    cost: null,
    onPlay: [
      {
        kind: "drawNumber",
        value: 6,
      },
    ],
    table: null,
    failedResolution: "consume",
    provenance: {
      referenceName: "6 Card",
      sourceIds: ["W2"],
    },
    admission: "priority-prototype",
    playable: false,
  },
  "draw-7": {
    id: "draw-7",
    nameKey: "contest.trump.draw-7.name",
    descriptionKey: "contest.trump.draw-7.description",
    tags: ["buff", "number"],
    conditions: [],
    cost: null,
    onPlay: [
      {
        kind: "drawNumber",
        value: 7,
      },
    ],
    table: null,
    failedResolution: "consume",
    provenance: {
      referenceName: "7 Card",
      sourceIds: ["W2"],
    },
    admission: "priority-prototype",
    playable: false,
  },
  return: {
    id: "return",
    nameKey: "contest.trump.return.name",
    descriptionKey: "contest.trump.return.description",
    tags: ["buff", "number"],
    conditions: [
      {
        kind: "hasFaceUp",
        target: "self",
      },
    ],
    cost: null,
    onPlay: [
      {
        kind: "returnLastFaceUp",
        target: "self",
      },
    ],
    table: null,
    failedResolution: "consume",
    provenance: {
      referenceName: "Return",
      sourceIds: ["G1"],
    },
    admission: "priority-prototype",
    playable: false,
  },
  remove: {
    id: "remove",
    nameKey: "contest.trump.remove.name",
    descriptionKey: "contest.trump.remove.description",
    tags: ["debuff", "number"],
    conditions: [
      {
        kind: "hasFaceUp",
        target: "opponent",
      },
    ],
    cost: null,
    onPlay: [
      {
        kind: "returnLastFaceUp",
        target: "opponent",
      },
    ],
    table: null,
    failedResolution: "consume",
    provenance: {
      referenceName: "Remove",
      sourceIds: ["G1"],
    },
    admission: "priority-prototype",
    playable: false,
  },
  exchange: {
    id: "exchange",
    nameKey: "contest.trump.exchange.name",
    descriptionKey: "contest.trump.exchange.description",
    tags: ["both", "number"],
    conditions: [
      {
        kind: "hasFaceUp",
        target: "self",
      },
      {
        kind: "hasFaceUp",
        target: "opponent",
      },
    ],
    cost: null,
    onPlay: [
      {
        kind: "swapLastFaceUp",
      },
    ],
    table: null,
    failedResolution: "consume",
    provenance: {
      referenceName: "Exchange",
      sourceIds: ["G1"],
    },
    admission: "priority-prototype",
    playable: false,
  },
  "target-17": {
    id: "target-17",
    nameKey: "contest.trump.target-17.name",
    descriptionKey: "contest.trump.target-17.description",
    tags: ["both", "rule"],
    conditions: [],
    cost: null,
    onPlay: [],
    table: {
      effects: [
        {
          kind: "pointTarget",
          value: 17,
        },
      ],
      expires: "round-end",
      stacking: "replace-global-point-target",
    },
    failedResolution: "consume",
    provenance: {
      referenceName: "Go for 17",
      sourceIds: ["G1"],
    },
    admission: "priority-prototype",
    playable: false,
  },
  "target-24": {
    id: "target-24",
    nameKey: "contest.trump.target-24.name",
    descriptionKey: "contest.trump.target-24.description",
    tags: ["both", "rule"],
    conditions: [],
    cost: null,
    onPlay: [],
    table: {
      effects: [
        {
          kind: "pointTarget",
          value: 24,
        },
      ],
      expires: "round-end",
      stacking: "replace-global-point-target",
    },
    failedResolution: "consume",
    provenance: {
      referenceName: "Go for 24",
      sourceIds: ["G1"],
    },
    admission: "priority-prototype",
    playable: false,
  },
  "target-27": {
    id: "target-27",
    nameKey: "contest.trump.target-27.name",
    descriptionKey: "contest.trump.target-27.description",
    tags: ["both", "rule"],
    conditions: [],
    cost: null,
    onPlay: [],
    table: {
      effects: [
        {
          kind: "pointTarget",
          value: 27,
        },
      ],
      expires: "round-end",
      stacking: "replace-global-point-target",
    },
    failedResolution: "consume",
    provenance: {
      referenceName: "Go for 27",
      sourceIds: ["G1"],
    },
    admission: "extended-experiment",
    playable: false,
  },
  destroy: {
    id: "destroy",
    nameKey: "contest.trump.destroy.name",
    descriptionKey: "contest.trump.destroy.description",
    tags: ["debuff", "counter"],
    conditions: [
      {
        kind: "hasTableCard",
        target: "opponent",
      },
    ],
    cost: null,
    onPlay: [
      {
        kind: "removeTable",
        target: "opponent",
        scope: "latest",
      },
    ],
    table: null,
    failedResolution: "consume",
    provenance: {
      referenceName: "Destroy",
      sourceIds: ["G3"],
    },
    admission: "priority-prototype",
    playable: false,
  },
  "destroy-all": {
    id: "destroy-all",
    nameKey: "contest.trump.destroy-all.name",
    descriptionKey: "contest.trump.destroy-all.description",
    tags: ["debuff", "counter"],
    conditions: [
      {
        kind: "hasTableCard",
        target: "opponent",
      },
    ],
    cost: null,
    onPlay: [
      {
        kind: "removeTable",
        target: "opponent",
        scope: "all",
      },
    ],
    table: null,
    failedResolution: "consume",
    provenance: {
      referenceName: "Destroy+",
      sourceIds: ["G3"],
    },
    admission: "extended-experiment",
    playable: false,
  },
  "best-draw": {
    id: "best-draw",
    nameKey: "contest.trump.best-draw.name",
    descriptionKey: "contest.trump.best-draw.description",
    tags: ["buff", "number"],
    conditions: [],
    cost: null,
    onPlay: [
      {
        kind: "drawBest",
        algorithm: "highest-safe-else-lowest",
      },
    ],
    table: null,
    failedResolution: "consume",
    provenance: {
      referenceName: "Perfect Draw",
      sourceIds: ["G1"],
    },
    admission: "extended-experiment",
    playable: false,
  },
  pressure: {
    id: "pressure",
    nameKey: "contest.trump.pressure.name",
    descriptionKey: "contest.trump.pressure.description",
    tags: ["buff", "score"],
    conditions: [],
    cost: null,
    onPlay: [],
    table: {
      effects: [
        {
          kind: "winBonus",
          amount: 1,
        },
      ],
      expires: "round-end",
      stacking: "additive",
    },
    failedResolution: "consume",
    provenance: {
      referenceName: "One-Up",
      sourceIds: ["W2"],
    },
    admission: "priority-prototype",
    playable: false,
  },
  "pressure-supply": {
    id: "pressure-supply",
    nameKey: "contest.trump.pressure-supply.name",
    descriptionKey: "contest.trump.pressure-supply.description",
    tags: ["buff", "score", "resource"],
    conditions: [],
    cost: null,
    onPlay: [
      {
        kind: "grantTrump",
        target: "self",
        count: 1,
      },
    ],
    table: {
      effects: [
        {
          kind: "winBonus",
          amount: 1,
        },
      ],
      expires: "round-end",
      stacking: "additive",
    },
    failedResolution: "consume",
    provenance: {
      referenceName: "Two-Up",
      sourceIds: ["W2"],
    },
    admission: "priority-prototype",
    playable: false,
  },
  shield: {
    id: "shield",
    nameKey: "contest.trump.shield.name",
    descriptionKey: "contest.trump.shield.description",
    tags: ["buff", "defense", "score"],
    conditions: [],
    cost: null,
    onPlay: [],
    table: {
      effects: [
        {
          kind: "cancelOpponentBonusOnLoss",
          amount: 1,
        },
      ],
      expires: "round-end",
      stacking: "additive",
    },
    failedResolution: "consume",
    provenance: {
      referenceName: "Shield",
      sourceIds: ["G1"],
    },
    admission: "priority-prototype",
    playable: false,
  },
  "shared-supply": {
    id: "shared-supply",
    nameKey: "contest.trump.shared-supply.name",
    descriptionKey: "contest.trump.shared-supply.description",
    tags: ["both", "resource"],
    conditions: [],
    cost: null,
    onPlay: [
      {
        kind: "grantTrump",
        target: "self",
        count: 1,
      },
      {
        kind: "grantTrump",
        target: "opponent",
        count: 1,
      },
    ],
    table: null,
    failedResolution: "consume",
    provenance: {
      referenceName: "Happiness",
      sourceIds: ["G2"],
    },
    admission: "extended-experiment",
    playable: false,
  },
  "resource-swap": {
    id: "resource-swap",
    nameKey: "contest.trump.resource-swap.name",
    descriptionKey: "contest.trump.resource-swap.description",
    tags: ["buff", "resource"],
    conditions: [
      {
        kind: "hasOtherHandCards",
        count: 1,
      },
    ],
    cost: {
      discardOtherHandCards: 1,
      selection: "owner-choice",
    },
    onPlay: [
      {
        kind: "grantTrump",
        target: "self",
        count: 2,
      },
    ],
    table: null,
    failedResolution: "consume",
    provenance: {
      referenceName: "Trump Switch",
      sourceIds: ["G2"],
    },
    admission: "extended-experiment",
    playable: false,
  },
  harvest: {
    id: "harvest",
    nameKey: "contest.trump.harvest.name",
    descriptionKey: "contest.trump.harvest.description",
    tags: ["buff", "resource"],
    conditions: [],
    cost: null,
    onPlay: [],
    table: {
      effects: [
        {
          kind: "grantAfterOtherTrumpConsumed",
          count: 1,
          charges: 2,
          excludeSelf: true,
          grantDoesNotTrigger: true,
          leaveOnExhaustion: true,
        },
      ],
      expires: "round-end",
      stacking: "independent",
    },
    failedResolution: "consume",
    provenance: {
      referenceName: "Harvest",
      sourceIds: ["G2"],
    },
    admission: "extended-experiment",
    playable: false,
  },
} as const satisfies Record<TrumpId, TrumpDefinition>);

export function findTrump(value: unknown): TrumpDefinition | undefined {
  return isTrumpId(value) ? TRUMP_CATALOG[value] : undefined;
}
