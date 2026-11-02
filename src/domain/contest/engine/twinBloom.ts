// @req REQ-2026-027: copy raw faces and hand definitions at the actual receiving Turn boundary.
import { freezeData } from "../immutable";
import type { PlayerId } from "../types";
import { detachBindings } from "./effectOperations";
import { deleteNumber, generateNumber } from "./numberCards";
import { deleteTrump, generateTrump } from "./resources";
import { updateSkillActivation } from "./skills";
import { opponentOf } from "./turn";
import type { RoundState, RoundTransition, RoundEvent } from "./types";

export function resolveTwinBloom(
  original: RoundState,
  player: PlayerId,
  sequence: number,
): RoundTransition {
  const other = opponentOf(player);
  // Snapshot before deleting anything; bindings, original identities and source privileges are not copied.
  const faces = original.hands[other]
    .filter((c) => c.instanceId !== original.hiddenCards[other])
    .map((c) => c.value);
  const trumps = (original.trumps?.hands[other] ?? []).map(
    (c) => c.definitionId,
  );
  const ownFaces = original.hands[player].filter(
    (c) => c.instanceId !== original.hiddenCards[player],
  );
  const ownTrumps = original.trumps?.hands[player] ?? [];
  const changed = !!(
    faces.length ||
    trumps.length ||
    ownFaces.length ||
    ownTrumps.length
  );
  const status = changed ? "succeeded" : "ineffective";
  let state = updateSkillActivation(original, player, sequence, {
    public: true,
  });
  const events: RoundEvent[] = [
    {
      type: "skill",
      player,
      skillId: "twin-bloom",
      public: true,
      status: "prepared",
      state,
    },
  ];
  const sourceId = "skill:twin-bloom:" + player + ":round-" + state.numberScope;
  for (const card of ownFaces) {
    const detached = detachBindings(state, card.instanceId);
    state = deleteNumber(detached.state, player, card.instanceId);
    for (const delta of detached.deltas)
      if (delta.type === "effect-removed")
        events.push({
          type: "table-effect",
          operation: "removed",
          effectId: delta.effectId,
          state,
        });
  }
  for (const value of faces)
    state = generateNumber(state, player, value, sourceId);
  for (const instance of ownTrumps) {
    state = freezeData({
      ...state,
      trumps: deleteTrump(state.trumps!, player, instance.instanceId),
    });
    events.push({
      type: "resource",
      operation: "delete",
      cause: "effect",
      player,
      instance,
      public: false,
      state,
    });
  }
  for (const definitionId of trumps) {
    const generated = generateTrump(
      state.trumps!,
      player,
      definitionId,
      sourceId,
      state.rules.trumps!,
    );
    state = freezeData({ ...state, trumps: generated.state });
    events.push({
      type: "resource",
      operation: "generate",
      cause: "effect",
      player,
      instance: generated.instance,
      public: false,
      state,
    });
  }
  state = updateSkillActivation(state, player, sequence, { status });
  events.push({
    type: "skill",
    player,
    skillId: "twin-bloom",
    public: true,
    status,
    state,
  });
  return freezeData({ state, events });
}
