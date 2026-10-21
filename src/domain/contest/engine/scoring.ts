// @req REQ-2026-024: authoritative score modifiers and Sudden Death share one settlement.
// @req REQ-2026-016/024: one public breakdown and one score commit, before effect cleanup.
import type { PlayerId } from "../types";
import type {
  ContestGameState,
  MatchRules,
  RoundState,
  RoundScore,
} from "./types";
import { isEffectActive } from "./tableEffects";
import { opponentOf } from "./turn";
export function roundScore(round: RoundState): RoundScore {
  const result = round.result!;
  const winner = result.winner;
  if (!winner)
    return {
      base: 0,
      attack: 0,
      defense: 0,
      bonus: 0,
      ceasefire: false,
      guarded: false,
      increment: 0,
      modifiers: [],
    };
  const loser = opponentOf(winner),
    table = round.trumps?.table ?? [];
  const bothBusted =
    result.totals.human > result.pointTarget &&
    result.totals.ai > result.pointTarget;
  let attack = 0,
    defense = 0,
    ceasefire = false,
    guarded = false;
  const modifiers: { effectId: string; owner: PlayerId; amount: number }[] = [];
  for (const t of table) {
    if (!isEffectActive(t, table)) continue;
    let amount = 0;
    if (t.kind === "pressure" && t.owner === winner) amount = 1;
    if (t.kind === "last-stand" && t.owner === winner && bothBusted) amount = 2;
    if (t.kind === "risk-pledge") amount = t.owner === winner ? 2 : 1;
    if (amount) attack += amount;
    if (t.kind === "shield" && t.owner === loser) {
      defense++;
      amount = -1;
    }
    if (t.kind === "ceasefire") ceasefire = true;
    if (t.kind === "full-shield" && t.owner === loser) guarded = true;
    if (amount)
      modifiers.push({ effectId: t.effectId, owner: t.owner, amount });
  }
  const bonus = ceasefire ? 0 : Math.min(2, Math.max(0, attack - defense));
  return {
    base: 1,
    attack,
    defense,
    bonus,
    ceasefire,
    guarded,
    increment: guarded ? 0 : 1 + bonus,
    modifiers,
  };
}
export function createContestGame(
  number: number,
  rules: MatchRules,
): ContestGameState {
  return {
    number,
    points: { human: 0, ai: 0 },
    target: rules.initialGameTarget,
    roundsPlayed: 0,
    winner: null,
  };
}
export function scoreContestRound(
  game: ContestGameState,
  winner: PlayerId | null,
  rules: MatchRules,
  increment = winner ? 1 : 0,
): ContestGameState {
  const points = {
    human: game.points.human + (winner === "human" ? increment : 0),
    ai: game.points.ai + (winner === "ai" ? increment : 0),
  };
  const suddenDeathWinner = game.suddenDeath ? winner : null;
  const target =
    !suddenDeathWinner &&
    points.human === game.target - 1 &&
    points.ai === game.target - 1
      ? game.target + rules.targetIncrement
      : game.target;
  return {
    ...game,
    points,
    target,
    roundsPlayed: game.roundsPlayed + 1,
    winner:
      suddenDeathWinner ??
      (points.human >= target ? "human" : points.ai >= target ? "ai" : null),
  };
}
