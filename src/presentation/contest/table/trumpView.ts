// @req REQ-2026-026: labels use authorized observations; choices never simulate effects.
import type { ContestTrumpAction } from "../../../application/contest/types";
import type {
  MatchObservation,
  TableEffect,
} from "../../../domain/contest/engine";
import { isTrumpId } from "../../../domain/contest/trumps/ids";
import type { Copy } from "../../i18n";

export function text(
  template: string,
  values: Record<string, string | number>,
) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(values[key] ?? ""),
  );
}
export const trumpName = (id: string, t: Copy) =>
  isTrumpId(id) ? t[`contest.trump.${id}.name`] : t.trumpUnknown;
export const trumpDescription = (id: string, t: Copy) =>
  isTrumpId(id) ? t[`contest.trump.${id}.description`] : t.trumpUnknown;
export const playerName = (player: string, t: Copy) =>
  player === "human" ? t.contestYou : t.contestOpponent;

export function effectLabel(
  effect: TableEffect,
  match: MatchObservation,
  t: Copy,
) {
  const position =
    match.round
      .trumps!.table.filter((e) => e.owner === effect.owner)
      .findIndex((e) => e.effectId === effect.effectId) + 1;
  return text(t.trumpEffectChoice, {
    owner: playerName(effect.owner, t),
    name: trumpName(effect.definitionId, t),
    position,
  });
}
export function targetLabel(
  id: string,
  match: MatchObservation,
  t: Copy,
): string {
  const effect = match.round.trumps?.table.find((e) => e.effectId === id);
  if (effect) return effectLabel(effect, match, t);
  for (const player of ["human", "ai"] as const) {
    const position = match.round.faceUpCardIds[player].indexOf(id);
    if (position >= 0)
      return text(t.trumpNumberChoice, {
        owner: playerName(player, t),
        position: position + 1,
        value: match.round.hands[player].cards[position + 1].value ?? t.hidden,
      });
  }
  return t.trumpUnknown;
}
export interface TrumpChoice {
  readonly targetId: string;
  readonly ownTargetId: string;
  readonly definitionId: string;
  readonly costIds: readonly string[];
}
export function selectedCommand(
  commands: readonly ContestTrumpAction[],
  choice: TrumpChoice,
) {
  return commands.find(
    (c) =>
      (c.targetId ?? "") === choice.targetId &&
      (c.ownTargetId ?? "") === choice.ownTargetId &&
      (c.definitionId ?? "") === choice.definitionId &&
      (c.costIds?.length ?? 0) === choice.costIds.length &&
      new Set(choice.costIds).size === choice.costIds.length &&
      choice.costIds.every((id) => c.costIds?.includes(id)),
  );
}
