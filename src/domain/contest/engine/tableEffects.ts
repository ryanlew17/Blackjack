// @req REQ-2026-024: shared, acyclic interpretation of public continuous effects.
import type { TableEffect } from "./effectTypes";
import type { TurnState } from "./types";
export function isEffectActive(
  record: TableEffect,
  table: readonly TableEffect[],
): boolean {
  return (
    !record.suppressed &&
    !table.some(
      (t) =>
        t.kind === "suppress" &&
        !t.suppressed &&
        t.targetEffectId === record.effectId,
    )
  );
}
export function affectsTurn(
  record: TableEffect,
  turn: TurnState | null,
): boolean {
  return (
    !!turn &&
    record.affectedPlayer === turn.player &&
    record.expiresAfterTurn === turn.number
  );
}
export function shortLived(kind: TableEffect["kind"]): boolean {
  return (
    kind !== undefined &&
    ["hush", "embargo", "target-lock", "suppress", "heavy-hit"].includes(kind)
  );
}
