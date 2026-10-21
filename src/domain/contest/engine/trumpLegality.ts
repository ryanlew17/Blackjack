// @req REQ-2026-023: command generation reads authorized observations only.
import type { PlayerId } from "../types";
import type { PlayTrumpCommand } from "./effectTypes";
import type { RoundObservation } from "./types";
import { opponentOf } from "./turn";
import { sameGlobalGroup, transferable } from "./contributions";
function combinations(ids: readonly string[], count: number): string[][] {
  if (count === 0) return [[]];
  if (count > ids.length) return [];
  return ids.flatMap((id, i) =>
    combinations(ids.slice(i + 1), count - 1).map((rest) => [id, ...rest]),
  );
}
export function legalTrumpCommands(
  view: RoundObservation,
): readonly PlayTrumpCommand[] {
  if (
    view.phase !== "acting" ||
    view.turn?.player !== view.viewer ||
    !view.trumps ||
    !view.rules.trumps
  )
    return [];
  const { trumps, viewer } = view,
    other = opponentOf(viewer);
  const side = (target: "self" | "opponent" | undefined): PlayerId =>
    target === "opponent" ? other : viewer;
  return trumps.ownHand.flatMap((instance) => {
    const definition = view.rules.trumps!.definitions[instance.definitionId];
    if (!definition) return [];
    const table = definition.table;
    const ownSlots = trumps.table.filter((t) => t.owner === viewer).length;
    const replacesOwn = table
      ? trumps.table.filter(
          (t) => t.owner === viewer && sameGlobalGroup(table, t),
        ).length
      : 0;
    if (table && ownSlots - replacesOwn >= view.rules.trumps!.tableCapacity)
      return [];
    const faces = {
      human: view.hands.human.cards.length - 1,
      ai: view.hands.ai.cards.length - 1,
    };
    let deck = view.deckCount;
    let selectors =
      table?.kind === "face-lighten" || table?.kind === "face-burden" ? 1 : 0;
    let valid = true;
    for (const effect of definition.onPlay) {
      if (
        effect.type === "return-last" ||
        effect.type === "delete-last-number"
      ) {
        const player = side(effect.target);
        if (faces[player] < 1) {
          valid = false;
          break;
        }
        faces[player]--;
        if (effect.type === "return-last") deck++;
      } else if (effect.type === "draw-top") {
        if (deck < 1) {
          valid = false;
          break;
        }
        const count = Math.min(effect.count, deck);
        deck -= count;
        faces[side(effect.target)] += count;
      } else if (effect.type === "generate-number") faces[viewer]++;
      else if (effect.type === "swap-last") {
        if (faces[viewer] < 1 || faces[other] < 1) valid = false;
      } else if (effect.type === "remove-table") selectors++;
      else if (
        effect.type === "remove-latest" ||
        effect.type === "remove-all"
      ) {
        if (!trumps.table.some((t) => t.owner === side(effect.target)))
          valid = false;
      } else if (effect.type === "rotate-deck") {
        if (deck < 2) valid = false;
      } else if (effect.type === "trim") {
        const count = view.hands[viewer].cards
          .slice(1)
          .filter((c) => c.value !== null && c.value >= 8).length;
        if (count === 0) valid = false;
        deck += count;
        faces[viewer] -= count;
      } else if (effect.type === "hidden-multiplier" && effect.value === 1) {
        if (view.hiddenMultipliers[side(effect.target)] !== 2) valid = false;
      } else if (effect.type === "reveal-hidden") {
        if (!view.hands[side(effect.target)].cards[0]?.faceDown) valid = false;
      } else if (effect.type === "exchange-table") selectors++;
      else if (effect.type === "undo-last") {
        if (
          !view.lastPlay ||
          (view.lastPlay.type === "number" &&
            !view.faceUpCardIds[view.lastPlay.player].includes(
              view.lastPlay.instanceId,
            ))
        )
          valid = false;
      }
    }
    if (!valid || selectors > 1) return [];
    let targets: { targetId?: string; ownTargetId?: string }[] = [{}];
    const explicit = definition.onPlay.find((e) => e.type === "remove-table");
    if (explicit?.type === "remove-table")
      targets = trumps.table
        .filter((t) => t.owner === side(explicit.target))
        .map((t) => ({ targetId: t.effectId }));
    if (table?.kind === "face-lighten" || table?.kind === "face-burden") {
      const player = table.kind === "face-lighten" ? viewer : other;
      targets = view.faceUpCardIds[player]
        .filter(
          (id) =>
            !trumps.table.some((t) => t.kind === table.kind && t.cardId === id),
        )
        .map((targetId) => ({ targetId }));
    }
    if (definition.onPlay.some((e) => e.type === "exchange-table")) {
      targets = trumps.table
        .filter((t) => t.owner === viewer && transferable(t))
        .flatMap((own) =>
          trumps.table
            .filter((t) => t.owner === other && transferable(t))
            .map((opposing) => ({
              ownTargetId: own.effectId,
              targetId: opposing.effectId,
            })),
        );
    }
    const costs = combinations(
      trumps.ownHand
        .filter((c) => c.instanceId !== instance.instanceId)
        .map((c) => c.instanceId),
      definition.cost ?? 0,
    );
    return targets.flatMap((target) =>
      costs.map((costIds) => ({
        type: "PlayTrump" as const,
        player: viewer,
        instanceId: instance.instanceId,
        ...target,
        ...(costIds.length ? { costIds } : {}),
      })),
    );
  });
}
