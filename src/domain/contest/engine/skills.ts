// @req REQ-2026-027: admitted skills share spending, authority and authorized effect replay.
import { freezeData } from "../immutable";
import {
  availableSkillIds,
  isSkillId,
  SKILL_CATALOG,
  type SkillId,
} from "../skills/catalog";
import type { PlayerId } from "../types";
import { resolveNullify } from "./skillBarriers";
import { contribution } from "./contributions";
import { deleteNumber, transferNumber } from "./numberCards";
import { detachBindings } from "./effectOperations";
import { grantTrumps, transferTrump } from "./resources";
import { randomUnit } from "./numbers";
import type {
  ResourceRandomSources,
  SkillRandomSources,
} from "./resourceTypes";
import type { NumberValue } from "../types";
import { opponentOf } from "./turn";
import type {
  ActivateSkillCommand,
  SkillRules,
  SkillState,
  SkillObservation,
  SkillView,
  SkillActivation,
  SkillPendingEffect,
} from "./skillTypes";
import type {
  RoundState,
  RoundObservation,
  RoundTransition,
  RoundEvent,
} from "./types";

export const EXECUTABLE_SKILL_IDS: readonly SkillId[] = Object.freeze([
  "spirit-sight",
  "pickpocket",
  "craft-gift",
  "fortune",
  "self-renewal",
  "tempt-fate",
  "frame",
  "scapegoat",
  "metamorphosis",
  "provoke",
  "mind-grip",
  "soul-transfer",
  "twin-bloom",
  "nullify",
  "endless-life",
]);

export function snapshotSkillRules(rules: SkillRules): SkillRules {
  const available = availableSkillIds(
    rules.difficulty,
    rules.playableDifficulties,
  );
  if (
    !rules.selected ||
    ["human", "ai"].some((p) => {
      const id = rules.selected[p as PlayerId];
      return (
        !isSkillId(id) ||
        !available.includes(id) ||
        !EXECUTABLE_SKILL_IDS.includes(id)
      );
    })
  )
    throw new RangeError("Selected skill is unavailable or not executable");
  if (
    Object.isFrozen(rules) &&
    Object.isFrozen(rules.selected) &&
    Object.isFrozen(rules.playableDifficulties)
  )
    return rules;
  return freezeData({
    difficulty: rules.difficulty,
    playableDifficulties: [...rules.playableDifficulties],
    selected: { human: rules.selected.human, ai: rules.selected.ai },
  });
}
export function startSkillRound(
  rules: SkillRules,
  previous?: SkillState,
  newGame = false,
): SkillState {
  const player = (id: PlayerId) =>
    previous && !newGame
      ? previous.players[id]
      : {
          remainingUses:
            previous?.players[id].remainingUses ??
            SKILL_CATALOG[rules.selected[id]].usesPerMatch[rules.difficulty],
          publicRemainingUses:
            previous?.players[id].publicRemainingUses ??
            SKILL_CATALOG[rules.selected[id]].usesPerMatch[rules.difficulty],
          ...(previous?.players[id].hasSucceeded
            ? { hasSucceeded: true as const }
            : {}),
          gameActivationsRemaining: 1,
          activations: [],
        };
  return freezeData({
    players: { human: player("human"), ai: player("ai") },
    ...(!newGame && previous?.seal ? { seal: previous.seal } : {}),
    nextActivationSequence: previous?.nextActivationSequence ?? 1,
    knownHiddenCards: { human: null, ai: null },
  });
}
export function expireRoundSkills(
  skills: SkillState,
  roundNumber: number,
): SkillState {
  const player = (id: PlayerId) => ({
    ...skills.players[id],
    activations: skills.players[id].activations.map((a) =>
      a.status === "prepared" &&
      a.roundNumber === roundNumber &&
      a.effect?.type !== "endless-life"
        ? { ...a, status: "expired" as const }
        : a,
    ),
  });
  const { seal, ...continuing } = skills;
  return freezeData({
    ...continuing,
    ...(seal && seal.throughRound > roundNumber ? { seal } : {}),
    players: { human: player("human"), ai: player("ai") },
    knownHiddenCards: { human: null, ai: null },
  });
}
export function observeSkills(
  state: RoundState,
  viewer: PlayerId,
): SkillObservation {
  const rules = state.rules.skills!,
    skills = state.skills!;
  const player = (id: PlayerId): SkillView => {
    const definition = SKILL_CATALOG[rules.selected[id]],
      own = id === viewer;
    const runtime = skills.players[id];
    const initialUses = definition.usesPerMatch[rules.difficulty];
    const exact = own || definition.visibility === "public";
    return {
      id: definition.id,
      ...(runtime.disabled ? { disabled: true as const } : {}),
      ...(definition.id === "nullify" &&
      runtime.activations.some(
        (a) => a.status === "prepared" || a.status === "succeeded",
      ) &&
      (skills.seal || skills.players[opponentOf(id)].disabled)
        ? { effectActive: true as const }
        : {}),
      ...(own && runtime.hasSucceeded && runtime.remainingUses < initialUses
        ? { canRecover: true as const }
        : {}),
      initialUses,
      publicRemainingUses: runtime.publicRemainingUses,
      remainingUses: exact ? runtime.remainingUses : null,
      knownRemainingUses: exact
        ? { min: runtime.remainingUses, max: runtime.remainingUses }
        : { min: 0, max: runtime.publicRemainingUses },
      gameActivationsRemaining: exact ? runtime.gameActivationsRemaining : null,
      activations: runtime.activations
        .filter((a) => own || a.public)
        .map((a) => ({
          roundNumber: a.roundNumber,
          turnNumber: a.turnNumber,
          status: a.status,
          ...(a.effect ? { effect: a.effect } : {}),
        })),
    };
  };
  return freezeData({ human: player("human"), ai: player("ai") });
}
export function legalSkillCommands(
  view: RoundObservation,
): readonly ActivateSkillCommand[] {
  const own = view.skills?.[view.viewer],
    other = opponentOf(view.viewer);
  if (
    view.phase !== "acting" ||
    !view.turn ||
    !own ||
    own.remainingUses === null ||
    own.remainingUses <= 0 ||
    own.gameActivationsRemaining === null ||
    own.gameActivationsRemaining <= 0
  )
    return [];
  if (own.id !== "endless-life" && (own.disabled || view.skillSeal)) return [];
  const reacting = own.id === "twin-bloom";
  if (
    reacting
      ? view.reaction?.player !== view.viewer ||
        view.turn.player === view.viewer
      : !!view.reaction ||
        view.turn.player !== view.viewer ||
        view.turn.controlledBy !== undefined
  )
    return [];
  let legal = false;
  switch (own.id) {
    case "nullify":
    case "endless-life":
    case "twin-bloom":
      legal = true;
      break;
    case "spirit-sight":
      legal = view.hands[other].cards.some((c) => c.faceDown);
      break;
    case "tempt-fate":
    case "frame":
    case "metamorphosis":
    case "provoke":
    case "mind-grip":
      legal = true;
      break;
    // @req REQ-2026-029: Scapegoat needs an opposing face-up card, not a bust.
    case "scapegoat":
      legal = view.faceUpCardIds[other].length > 0;
      break;
    case "pickpocket":
      legal =
        !!view.trumps &&
        view.trumps.opponentHandCount > 0 &&
        view.trumps.ownHand.length <
          (view.rules.trumps?.resources?.handLimit ?? 8) - 1;
      break;
    case "soul-transfer":
      legal =
        !!view.trumps &&
        view.trumps.ownHand.length <
          (view.rules.trumps?.resources?.handLimit ?? 8) - 1;
      break;
    case "craft-gift":
      legal = !!view.trumps && view.trumps.ownHand.length === 0;
      break;
    case "fortune":
      // Capacity is public, but neither capacity nor hidden stock prevents spending on a miss.
      legal = true;
      break;
    case "self-renewal":
      legal =
        view.hands[view.viewer].total !== null &&
        view.hands[view.viewer].total! > view.pointTarget &&
        view.faceUpCardIds[view.viewer].length > 0;
      break;
  }
  if (!legal) return [];
  return freezeData([
    {
      type: "ActivateSkill",
      player: view.viewer,
      skillId: own.id,
      turnNumber: view.turn.number,
      ...(reacting ? { reactionBoundary: view.reaction!.boundary } : {}),
    },
  ]);
}
export function activateSkill(
  original: RoundState,
  command: ActivateSkillCommand,
  view: RoundObservation,
  random?: ResourceRandomSources & Partial<SkillRandomSources>,
): RoundTransition {
  if (
    !legalSkillCommands(view).some(
      (c) =>
        c.skillId === command.skillId &&
        c.player === command.player &&
        c.turnNumber === command.turnNumber &&
        c.reactionBoundary === command.reactionBoundary,
    )
  )
    return { state: original, events: [] };
  const skills = original.skills!,
    runtime = skills.players[command.player];
  const visible = SKILL_CATALOG[command.skillId].visibility === "public";
  const delayed = [
    "tempt-fate",
    "frame",
    "metamorphosis",
    "provoke",
    "mind-grip",
    "soul-transfer",
    "twin-bloom",
    "endless-life",
  ].includes(command.skillId);
  const taken =
    command.skillId === "scapegoat"
      ? original.hands[opponentOf(command.player)]
          .filter(
            (c) =>
              c.instanceId !== original.hiddenCards[opponentOf(command.player)],
          )
          .at(-1)!
      : undefined;
  const effect: SkillPendingEffect | undefined =
    command.skillId === "endless-life"
      ? { type: "endless-life", targetTurn: original.turn!.number + 2 }
      : command.skillId === "provoke"
        ? {
            type: "provoke",
            targetTurn: original.turn!.number + 1,
            phase: "waiting",
          }
        : command.skillId === "mind-grip"
          ? { type: "mind-grip", targetTurn: original.turn!.number + 1 }
          : command.skillId === "twin-bloom"
            ? { type: "twin-bloom", targetTurn: original.turn!.number + 1 }
            : command.skillId === "tempt-fate" ||
                command.skillId === "frame" ||
                command.skillId === "metamorphosis" ||
                command.skillId === "soul-transfer"
              ? { type: command.skillId }
              : undefined;
  const activation: SkillActivation = {
    sequence: skills.nextActivationSequence,
    roundNumber: original.numberScope,
    turnNumber: original.turn!.number,
    status: "prepared" as const,
    public: visible,
    ...(effect ? { effect } : {}),
  };
  const prepared: RoundState = freezeData({
    ...original,
    quietStays: visible ? 0 : original.quietStays,
    turn: visible ? { ...original.turn!, usedSkill: true } : original.turn,
    skills: {
      ...skills,
      nextActivationSequence: skills.nextActivationSequence + 1,
      players: {
        ...skills.players,
        [command.player]: {
          ...runtime,
          remainingUses: runtime.remainingUses - 1,
          publicRemainingUses: runtime.publicRemainingUses - (visible ? 1 : 0),
          gameActivationsRemaining: runtime.gameActivationsRemaining - 1,
          activations: [...runtime.activations, activation],
        },
      },
    },
  });
  let state = prepared;
  const effects: RoundEvent[] = [];
  let succeeded = false;
  let detail: { card?: NumberValue; targetId?: string } = {};
  switch (command.skillId) {
    case "tempt-fate":
    case "frame":
    case "metamorphosis":
    case "provoke":
    case "mind-grip":
    case "soul-transfer":
    case "twin-bloom":
    case "endless-life":
      break;
    case "nullify": {
      const resolved = resolveNullify(state, command.player);
      state = resolved.state;
      effects.push(...resolved.events);
      succeeded = true;
      break;
    }
    case "scapegoat":
      state = transferNumber(
        state,
        opponentOf(command.player),
        command.player,
        taken!.instanceId,
      );
      detail = { card: taken!.value, targetId: taken!.instanceId };
      succeeded = true;
      break;
    case "spirit-sight":
      state = freezeData({
        ...state,
        skills: {
          ...state.skills!,
          knownHiddenCards: {
            ...state.skills!.knownHiddenCards,
            [command.player]: original.hiddenCards[opponentOf(command.player)],
          },
        },
      });
      succeeded = true;
      break;
    case "pickpocket": {
      const fromPlayer = opponentOf(command.player);
      const hand = state.trumps!.hands[fromPlayer];
      const instance =
        hand[Math.floor(randomUnit(random?.skillEffects!) * hand.length)];
      state = freezeData({
        ...state,
        trumps: transferTrump(
          state.trumps!,
          fromPlayer,
          command.player,
          instance.instanceId,
        ),
      });
      effects.push({
        type: "resource",
        operation: "transfer",
        cause: "effect",
        player: command.player,
        fromPlayer,
        instance,
        public: false,
        state,
      });
      succeeded = true;
      break;
    }
    case "craft-gift":
    case "fortune": {
      const grant = grantTrumps(
        state,
        command.player,
        command.skillId === "craft-gift" ? 2 : 1,
        "effect",
        random?.trumpSelection,
        command.skillId === "fortune" ? "best-draw" : undefined,
      );
      state = grant.state;
      effects.push(...grant.events);
      succeeded = grant.deltas.some((d) => d.type === "trump-granted");
      break;
    }
    case "self-renewal": {
      const cards = state.hands[command.player].filter(
        (c) => c.instanceId !== state.hiddenCards[command.player],
      );
      // Hand order records acquisition; >= makes the latest acquisition win an effective-value tie.
      const card = cards.reduce((best, candidate) =>
        contribution(state, command.player, candidate) >=
        contribution(state, command.player, best)
          ? candidate
          : best,
      );
      const bindings = detachBindings(state, card.instanceId);
      state = deleteNumber(bindings.state, command.player, card.instanceId);
      for (const delta of bindings.deltas)
        if (delta.type === "effect-removed")
          effects.push({
            type: "table-effect",
            operation: "removed",
            effectId: delta.effectId,
            state,
          });
      detail = { card: card.value, targetId: card.instanceId };
      succeeded = true;
      break;
    }
  }
  const consumed = state.skills!.players[command.player];
  const status = delayed ? "prepared" : succeeded ? "succeeded" : "ineffective";
  state = freezeData({
    ...state,
    skills: {
      ...state.skills!,
      players: {
        ...state.skills!.players,
        [command.player]: {
          ...consumed,
          ...(succeeded ? { hasSucceeded: true as const } : {}),
          activations: [
            ...consumed.activations.slice(0, -1),
            { ...activation, status },
          ],
        },
      },
    },
  });
  // Spirit Sight has no value payload; transfer/deletion details describe public face-up cards only.
  const payload = {
    type: "skill" as const,
    player: command.player,
    skillId: command.skillId,
    public: visible,
  };
  const events: RoundEvent[] = [
    // Nullify supplies its first frame after the public barrier and lock are committed.
    ...(command.skillId === "nullify"
      ? []
      : [{ ...payload, status: "prepared" as const, state: prepared }]),
    ...effects,
  ];
  if (!delayed || taken) events.push({ ...payload, status, ...detail, state });
  return freezeData({ state, events });
}

/** One private committed order for all currently prepared skill effects. */
export function pendingSkills(state: RoundState) {
  return (["human", "ai"] as const)
    .flatMap((player) =>
      (state.skills?.players[player].activations ?? [])
        .filter(
          (a) =>
            a.effect &&
            ((a.roundNumber === state.numberScope && a.status === "prepared") ||
              (a.effect.type === "endless-life" &&
                (a.status === "prepared" || a.status === "succeeded"))),
        )
        .map((activation) => ({ player, activation })),
    )
    .sort(
      (a, b) =>
        a.activation.sequence - b.activation.sequence ||
        (a.player === b.player ? 0 : a.player === "human" ? -1 : 1),
    );
}
/** Reveal accounting and status changes share one immutable operation. */
export function updateSkillActivation(
  original: RoundState,
  player: PlayerId,
  sequence: number,
  changes: Partial<Pick<SkillActivation, "status" | "public" | "effect">>,
): RoundState {
  const skill = original.skills!.players[player];
  const current = skill.activations.find((a) => a.sequence === sequence)!;
  return freezeData({
    ...original,
    skills: {
      ...original.skills!,
      players: {
        ...original.skills!.players,
        [player]: {
          ...skill,
          ...(changes.status === "succeeded"
            ? { hasSucceeded: true as const }
            : {}),
          publicRemainingUses:
            skill.publicRemainingUses -
            (changes.public && !current.public ? 1 : 0),
          activations: skill.activations.map((a) =>
            a.sequence === sequence ? { ...a, ...changes } : a,
          ),
        },
      },
    },
  });
}
