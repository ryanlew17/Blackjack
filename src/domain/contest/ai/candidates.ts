// @req REQ-2026-028: enumerate decisions from authorized information, never hidden success.
import { freezeData } from "../immutable";
import { legalActions } from "../engine/legalActions";
import { legalTrumpCommands } from "../engine/trumpLegality";
import { legalSkillCommands } from "../engine/skills";
import type { MatchCommand, MatchObservation } from "../engine/types";

/** One decision only; lifecycle advancement and forced continuations belong to coordination. */
export type DecisionCommand = Exclude<
  MatchCommand,
  { readonly type: "NextRound" | "ResolveForcedTurn" }
>;

/** Order is stable enumeration, not a preference or a policy. No candidate limit is imposed. */
export function decisionCandidates(
  observation: MatchObservation,
): readonly DecisionCommand[] {
  if (observation.phase !== "playing") return Object.freeze([]);
  const round = observation.round;
  const actions = legalActions(round);
  const commands: DecisionCommand[] = [];
  const scope = {
    player: round.viewer,
    roundNumber: observation.roundNumber,
  };
  for (const type of actions) {
    switch (type) {
      case "Hit":
      case "Stay":
        commands.push({ type, ...scope });
        break;
      case "PlayTrump":
        commands.push(
          ...legalTrumpCommands(round).map((command) => ({
            ...command,
            roundNumber: observation.roundNumber,
          })),
        );
        break;
      case "ActivateSkill":
        commands.push(
          ...legalSkillCommands(round).map((command) => ({
            ...command,
            roundNumber: observation.roundNumber,
          })),
        );
        break;
      case "PassReaction": {
        const reaction = round.reaction!;
        commands.push({
          type,
          ...scope,
          turnNumber: reaction.turnNumber,
          reactionBoundary: reaction.boundary,
        });
        break;
      }
    }
  }
  return freezeData(commands);
}
