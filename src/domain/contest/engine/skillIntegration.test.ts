// @req REQ-2026-027: every admitted skill carries one spent use through actual Game cleanup.
import { expect, it } from "vitest";
import { SKILL_IDS, SKILL_CATALOG } from "../skills/catalog";
import { transitionMatch, legalSkillCommands, observeMatch } from "./index";
import { opponentOf } from "./turn";
import {
  fixture,
  skill,
  play,
  act,
  pass,
  assertBarrierLedger,
} from "./skillBarrierTestHelpers";
import type { MatchTransition } from "./index";

it.each(SKILL_IDS)(
  "preserves %s spending, hidden-slot identities and frozen rules into the next Game",
  (id) => {
    const initialHand =
      id === "self-renewal"
        ? ["draw-7", "noop", "noop"]
        : ["noop", "noop", "noop"];
    const f = fixture({
      human: id,
      ai: "spirit-sight",
      first: "ai",
      humanTrumps: initialHand,
      aiTrumps: ["draw-7", "draw-6", "noop"],
      prefix: id === "metamorphosis" ? [1, 8, 11, 9] : [10, 8, 11, 9],
      stock: { noop: 10, "draw-7": 2, "draw-6": 2, regret: 1, "best-draw": 1 },
    });
    let state = f.state;
    const rules = state.rules,
      cap = SKILL_CATALOG[id].usesPerMatch.nightmare;
    const checked = (result: MatchTransition) => {
      assertBarrierLedger(result);
      state = result.state;
    };
    if (id !== "twin-bloom") {
      if (id === "scapegoat") {
        checked(play(state, "draw-7", f.random));
        checked(play(state, "draw-6", f.random));
      }
      checked(act(state, "Stay", f.random));
      if (id === "craft-gift")
        for (let n = 0; n < 3; n++) checked(play(state, "noop", f.random));
      if (id === "self-renewal") checked(play(state, "draw-7", f.random));
    }
    const hidden = { ...state.round.hiddenCards };
    const command = legalSkillCommands(observeMatch(state, "human").round)[0];
    const activated = skill(state, "human", f.random);
    checked(activated);
    const spent = state.round.skills!.players.human;
    expect(spent.remainingUses).toBe(cap - 1);
    expect(spent.gameActivationsRemaining).toBe(0);
    expect(state.round.hiddenCards).toEqual(hidden);
    expect(
      transitionMatch(
        state,
        { ...command, roundNumber: state.roundNumber },
        f.random,
      ).state,
    ).toBe(state);
    expect(legalSkillCommands(observeMatch(state, "human").round)).toEqual([]);
    let boundaries = 0;
    while (state.phase === "playing" || state.phase === "round-complete") {
      if (++boundaries > 40) throw new Error("Game did not finish");
      if (state.phase === "playing") {
        state = pass(state, f.random);
        const turn = state.round.turn!;
        checked(
          turn.controlledBy
            ? transitionMatch(
                state,
                {
                  type: "ResolveForcedTurn",
                  player: turn.player,
                  turnNumber: turn.number,
                  roundNumber: state.roundNumber,
                },
                f.random,
              )
            : act(state, "Stay", f.random),
        );
      } else {
        const first =
          state.nextFirstPlayer ?? opponentOf(state.round.firstPlayer);
        f.addRound(first === "ai" ? [10, 8, 11, 9] : [8, 10, 9, 11]);
        checked(
          transitionMatch(
            state,
            { type: "NextRound", roundNumber: state.roundNumber },
            f.random,
          ),
        );
      }
      expect(state.rules).toBe(rules);
      expect(state.round.skills!.players.human.remainingUses).toBe(cap - 1);
    }
    expect(state.phase).toBe("game-complete");
    expect(state.round.skills!.seal).toBeUndefined();
    expect(state.round.skills!.knownHiddenCards).toEqual({
      human: null,
      ai: null,
    });
    for (const player of ["human", "ai"] as const) {
      expect(state.round.skills!.players[player].disabled).toBeUndefined();
      expect(
        state.round.skills!.players[player].activations.some(
          (a) => a.status === "prepared",
        ),
      ).toBe(false);
    }
    const succeeded = state.round.skills!.players.human.hasSucceeded;
    const first = state.nextFirstPlayer ?? opponentOf(state.round.firstPlayer);
    f.addRound(first === "ai" ? [10, 8, 11, 9] : [8, 10, 9, 11]);
    checked(
      transitionMatch(
        state,
        { type: "NextRound", roundNumber: state.roundNumber },
        f.random,
      ),
    );
    expect(state.game.number).toBe(2);
    expect(state.rules).toBe(rules);
    expect(state.round.skills!.players.human).toMatchObject({
      remainingUses: cap - 1,
      gameActivationsRemaining: 1,
      activations: [],
    });
    expect(state.round.skills!.players.human.hasSucceeded).toBe(succeeded);
    expect(state.round.trumps!.destroyed).toEqual([]);
    expect(state.round.trumps!.hands.human).toHaveLength(3);
    expect(f.calls.skillSelection).toBe(0);
  },
);
