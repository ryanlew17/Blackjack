// @req REQ-2026-028: reconstruct an undo witness from authorized frame changes, not private deltas.
import type { BeliefMemory } from "../ai/memory";
import type { MatchState, RoundObservation } from "../engine/types";
import type {
  EffectDelta,
  NumberInstance,
  CardTransaction,
} from "../engine/numberCards";
import type { TableEffect } from "../engine/effectTypes";
import type { PlayerId } from "../types";

const players = ["human", "ai"] as const;
export function rawTable(
  record: Omit<TableEffect, "activationSequence">,
  memory: BeliefMemory,
): TableEffect {
  // suppressed is derived by observeTrumps, not a stored latch.
  const { suppressed: _derived, ...rest } = record;
  return {
    ...rest,
    activationSequence:
      memory.abilityOrder.indexOf(`table:${record.effectId}`) + 1,
  };
}
function faces(view: RoundObservation) {
  return players.flatMap((player) =>
    view.faceUpCardIds[player].map((id, index) => ({
      id,
      player,
      index: index + 1,
      value: view.hands[player].cards[index + 1].value!,
      origin: view.faceUpOrigins[id],
    })),
  );
}

export function undoWitness(
  memory: BeliefMemory,
  state: MatchState,
): CardTransaction | null {
  const last = memory.observation.round.lastPlay;
  if (!last) return null;
  if (last.type === "number") return { ...last, type: "number" };
  const frames = memory.lastTrumpFrames;
  if (!frames.length) throw new RangeError("Missing authorized undo history");
  const deltas: EffectDelta[] = [];
  const card = (entry: ReturnType<typeof faces>[number]): NumberInstance => ({
    instanceId: entry.id,
    value: entry.value,
    origin:
      entry.origin === "generated"
        ? { type: "generated", sourceId: "simulation" }
        : { type: "initial" },
  });
  let reward = false;
  for (let i = 1; i < frames.length; i++) {
    const event = frames[i],
      before = frames[i - 1].state,
      after = event.state;
    const priorFaces = faces(before),
      nextFaces = faces(after);
    const moved = priorFaces.filter((a) =>
      nextFaces.some((b) => a.id === b.id && a.player !== b.player),
    );
    if (moved.length === 2)
      deltas.push({
        type: "numbers-swapped",
        a: { instanceId: moved[0].id, player: moved[0].player },
        b: { instanceId: moved[1].id, player: moved[1].player },
      });
    for (const a of priorFaces.filter(
      (a) => !nextFaces.some((b) => a.id === b.id),
    )) {
      if (
        event.type === "trump" &&
        (event.effect === "return" ||
          (event.effect === "undone" && after.deckCount > before.deckCount))
      )
        deltas.push({
          type: "number-move",
          instanceId: a.id,
          from: { player: a.player, index: a.index },
          to: { player: null, index: after.deckCount - 1 },
        });
      else
        deltas.push({
          type: "number-deleted",
          player: a.player,
          instance: card(a),
          index: a.index,
        });
    }
    for (const b of nextFaces.filter(
      (b) => !priorFaces.some((a) => a.id === b.id),
    )) {
      if (
        b.origin === "generated" &&
        !(event.type === "trump" && event.effect === "draw")
      )
        deltas.push({
          type: "number-generated",
          player: b.player,
          instance: card(b),
          index: b.index,
        });
      else
        deltas.push({
          type: "number-move",
          instanceId: b.id,
          from: {
            player: null,
            index: Math.max(0, before.peek?.indexOf(b.value) ?? 0),
          },
          to: { player: b.player, index: b.index },
        });
    }
    if (moved.length !== 2)
      for (const a of moved) {
        const b = nextFaces.find((b) => b.id === a.id)!;
        deltas.push({
          type: "number-move",
          instanceId: a.id,
          from: { player: a.player, index: a.index },
          to: { player: b.player, index: b.index },
        });
      }
    const oldTable = before.trumps?.table ?? [],
      newTable = after.trumps?.table ?? [];
    // Dependencies are removed before their targets; undo restores targets first.
    const removed = oldTable
      .filter((a) => !newTable.some((b) => a.effectId === b.effectId))
      .sort((a, b) => Number(!!b.targetEffectId) - Number(!!a.targetEffectId));
    for (const a of removed)
      deltas.push({
        ...rawTable(a, memory),
        type: "effect-removed",
        index: oldTable.indexOf(a),
      });
    for (const b of newTable) {
      const a = oldTable.find((a) => a.effectId === b.effectId);
      if (!a)
        deltas.push({
          ...rawTable(b, memory),
          type: "effect-added",
          index: newTable.indexOf(b),
        });
      else if (
        JSON.stringify(rawTable(a, memory)) !==
        JSON.stringify(rawTable(b, memory))
      )
        deltas.push({
          type: "effect-updated",
          before: rawTable(a, memory),
          after: rawTable(b, memory),
        });
    }
    for (const player of players)
      if (before.hiddenMultipliers[player] !== after.hiddenMultipliers[player])
        deltas.push({
          type: "hidden-multiplier",
          player,
          before: before.hiddenMultipliers[player],
          after: after.hiddenMultipliers[player],
        });
    if (
      JSON.stringify(before.suddenDeath) !== JSON.stringify(after.suddenDeath)
    )
      deltas.push({
        type: "sudden-death",
        before: before.suddenDeath,
        after: after.suddenDeath,
      });
    for (const player of players) {
      const increase =
        (after.trumps?.stockCounts[player] ?? 0) -
        (before.trumps?.stockCounts[player] ?? 0);
      if (increase > 0) {
        const restored = state.round.trumps!.stock[player].filter(
          (c) =>
            c.origin.type === "generated" &&
            c.origin.sourceId === last.instanceId,
        );
        for (let n = 0; n < increase; n++)
          deltas.push({
            type: "trump-stock-generated",
            player,
            instanceId:
              restored[n]?.instanceId ??
              `simulation:spent-restoration:${player}:${n}`,
          });
      }
    }
    if (event.type === "skill" && event.skillId === "soul-transfer")
      reward = true;
    if (event.type === "resource" && event.cause !== "cost") {
      const player = event.player,
        own = player === after.viewer;
      const count = own
        ? after.trumps!.ownHand.length
        : after.trumps!.opponentHandCount;
      const prior = own
        ? before.trumps!.ownHand.length
        : before.trumps!.opponentHandCount;
      if (
        (event.operation === "draw" || event.operation === "generate") &&
        count > prior
      ) {
        if (!(reward && event.operation === "generate")) {
          const instance =
            event.instance ?? state.round.trumps!.hands[player][count - 1];
          // A later skill can transfer a hidden grant out of this hand without
          // closing the trump undo window. Historical positions are not current
          // identities; an absent sampled slot represents a no-longer-held grant.
          deltas.push({
            type:
              event.operation === "draw" ? "trump-granted" : "trump-generated",
            player,
            instanceId:
              instance?.instanceId ??
              `simulation:departed-grant:${player}:${i}`,
          });
        }
        reward = false;
      }
      if (
        event.operation === "delete" &&
        after.trumps!.destroyed.length > before.trumps!.destroyed.length
      ) {
        const stock =
          after.trumps!.stockCounts[player] <
          before.trumps!.stockCounts[player];
        const instance =
          event.instance ??
          state.round.trumps!.destroyed[after.trumps!.destroyed.length - 1]
            ?.instance;
        if (instance)
          deltas.push({
            type: stock ? "trump-stock-deleted" : "trump-deleted",
            player,
            instance,
            index: stock ? 0 : Math.max(0, prior - 1),
          });
      }
    }
    if (event.type === "trump" && event.effect === "skill-recovered") {
      const player = event.effectPlayer ?? event.player,
        a = before.skills![player],
        b = after.skills![player];
      deltas.push({
        type: "skill-recovery",
        player,
        uses:
          a.remainingUses !== null && b.remainingUses !== null
            ? b.remainingUses - a.remainingUses
            : 1,
        permission:
          a.gameActivationsRemaining !== null &&
          b.gameActivationsRemaining !== null
            ? b.gameActivationsRemaining - a.gameActivationsRemaining
            : 1,
        publicUses: b.knownRemainingUses.max - a.knownRemainingUses.max,
      });
    }
  }
  return { ...last, type: "trump", deltas };
}
