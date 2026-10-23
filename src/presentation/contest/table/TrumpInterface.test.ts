// @req REQ-2026-026: real engine observations rendered through the production interface.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  legalMatchActions,
  legalTrumpCommands,
  observeMatch,
  projectMatchTransition,
  transitionMatch,
} from "../../../domain/contest/engine";
import type {
  MatchState,
  MatchTransition,
} from "../../../domain/contest/engine";
import {
  act,
  fixture,
  finish,
  play,
  table,
} from "../../../domain/contest/engine/interactionTestHelpers";
import type { ContestView } from "../../../application/contest/types";
import { en, zh } from "../../i18n";
import { ContestTrumps } from "./ContestTrumps";
import { ContestFeedback, feedbackMessage } from "./ContestFeedback";
import { TrumpChooser } from "./TrumpChooser";
import { selectedCommand, targetLabel, text, trumpName } from "./trumpView";

function viewFor(state: MatchState, result?: MatchTransition): ContestView {
  const match = observeMatch(state, "human");
  return {
    match,
    busy: false,
    paused: false,
    thinking: false,
    event: null,
    effectId: 1,
    inputId: 7,
    recentEvents: result ? projectMatchTransition(result, "human").events : [],
    actions: legalMatchActions(match),
    trumpCommands: legalTrumpCommands(match.round).map(
      ({ player: _player, ...c }) => ({ ...c, inputId: 7 }),
    ),
  };
}
const render = (view: ContestView, t = en) =>
  renderToStaticMarkup(
    createElement(
      "div",
      null,
      createElement(ContestTrumps, { view, t, send: () => true }),
      createElement(ContestFeedback, { view, t }),
    ),
  );

describe("S2 trump interface information and command boundary", () => {
  it.each([en, zh])(
    "does not reveal different unpublished opponent hands in either dictionary",
    (t) => {
      const a = render(viewFor(fixture(["draw-2"], ["shield", "scry"])), t);
      const b = render(viewFor(fixture(["draw-2"], ["pressure", "return"])), t);
      expect(a).toBe(b);
      expect(a).toContain(trumpName("draw-2", t));
      expect(a).not.toContain(trumpName("scry", t));
      expect(a).not.toContain("stock-shield");
    },
  );
  it.each([en, zh])(
    "hides an opponent's paid identity in the complete feedback DOM",
    (t) => {
      function paid(cost: string) {
        let state = fixture(["draw-2"], ["resource-swap", cost]);
        state = act(state, "Stay").state;
        const result = play(state, "resource-swap");
        return render(viewFor(result.state, result), t);
      }
      expect(paid("shield")).toBe(paid("return"));
    },
  );
  it("does not call an opponent privacy mask a failed supply attempt", () => {
    let state = fixture(["shared-supply"], []);
    const result = play(state, "shared-supply");
    const projected = projectMatchTransition(result, "human");
    const grant = projected.events.find(
      (e) =>
        e.type === "round" &&
        e.event.type === "resource" &&
        e.event.player === "ai",
    )!;
    expect(feedbackMessage(grant, en)).toBe(
      text(en.trumpOpponentSupply, { player: en.contestOpponent }),
    );
    expect(feedbackMessage(grant, en)).not.toContain("no trump");
  });
  it("submits only the selected real legal payment and consumes it once", () => {
    const state = fixture(["resource-swap", "shield", "pressure"]);
    const view = viewFor(state);
    const instance = view.match!.round.trumps!.ownHand.find(
      (c) => c.definitionId === "resource-swap",
    )!;
    const commands = view.trumpCommands.filter(
      (c) => c.instanceId === instance.instanceId,
    );
    const cost = state.round.trumps!.hands.human.find(
      (c) => c.definitionId === "shield",
    )!.instanceId;
    const command = selectedCommand(commands, {
      targetId: "",
      ownTargetId: "",
      definitionId: "",
      costIds: [cost],
    })!;
    expect(command).toBeDefined();
    expect(
      selectedCommand(commands, {
        targetId: "",
        ownTargetId: "",
        definitionId: "",
        costIds: [cost, cost],
      }),
    ).toBeUndefined();
    const result = transitionMatch(
      state,
      { ...command, player: "human", roundNumber: 1 },
      { numbers: () => 0, trumpGate: () => 0, trumpSelection: () => 0 },
    );
    expect(
      result.state.round.trumps!.destroyed.filter((d) => d.reason === "cost"),
    ).toHaveLength(1);
    expect(
      result.state.round.trumps!.destroyed.some(
        (d) => d.reason === "cost" && d.instance.instanceId === cost,
      ),
    ).toBe(true);
    expect(result.state.round.turn?.player).toBe("human");
  });
  it("targets face-up instance IDs even after the logical hidden card was revealed", () => {
    let state = fixture(["reveal-self", "face-lighten"]);
    state = play(state, "reveal-self").state;
    const view = viewFor(state),
      match = view.match!;
    const card = match.round.trumps!.ownHand.find(
      (c) => c.definitionId === "face-lighten",
    )!;
    const commands = view.trumpCommands.filter(
      (c) => c.instanceId === card.instanceId,
    );
    expect(commands.map((c) => c.targetId)).toEqual(
      match.round.faceUpCardIds.human,
    );
    expect(targetLabel(commands[0].targetId!, match, en)).toContain(
      "Number 11",
    );
    const html = renderToStaticMarkup(
      createElement(TrumpChooser, {
        instance: card,
        commands,
        match,
        t: en,
        close: () => {},
        send: () => true,
      }),
    );
    expect(html).toContain("Number 11");
    expect(html).not.toContain('value="' + state.round.hiddenCards.human + '"');
  });
  it.each([en, zh])(
    "keeps transferred effects suppressed until their original Turn expires",
    (t) => {
      let state = fixture(
        ["suppress", "shield", "table-exchange", "regret"],
        ["pressure"],
      );
      state = play(state, "shield").state;
      state = act(state, "Stay").state;
      state = play(state, "pressure").state;
      state = act(state, "Stay").state;
      const target = table(state, "pressure")[0].effectId;
      state = play(state, "suppress", { targetId: target }).state;
      const expiry = table(state, "suppress")[0].expiresAfterTurn!;
      state = play(state, "table-exchange", {
        ownTargetId: table(state, "shield")[0].effectId,
        targetId: target,
      }).state;
      expect(table(state, "pressure")[0].owner).toBe("human");
      const html = render(viewFor(state), t);
      expect(html).toContain(t.trumpSuppressed);
      expect(html).toContain(
        text(t.trumpExpiry, { player: t.contestOpponent, turn: expiry }),
      );
      expect(
        observeMatch(state, "human").round.trumps!.table.find(
          (e) => e.effectId === target,
        )!.suppressed,
      ).toBe(true);
      state = act(state, "Stay").state;
      const result = act(state, "Stay");
      expect(
        observeMatch(result.state, "human").round.trumps!.table.find(
          (e) => e.effectId === target,
        )!.suppressed,
      ).not.toBe(true);
      expect(render(viewFor(result.state, result), t)).toContain(
        t.trumpUndoBoundary,
      );
      expect(render(viewFor(result.state, result), t)).not.toContain(
        t.trumpSuppressed,
      );
    },
  );
  it("reports unrelated expired locks and pending records without any inverse delta", () => {
    let state = fixture(["hush", "regret"], ["pressure"]);
    state = play(state, "hush").state;
    state = act(state, "Stay").state;
    state = play(state, "pressure").state;
    const result = act(state, "Stay");
    const projected = projectMatchTransition(result, "human");
    const closed = projected.events.filter(
      (e) => e.type === "round" && e.event.type === "undo-window-closed",
    );
    expect(closed).toHaveLength(1);
    expect(JSON.stringify(closed)).not.toContain('"deltas"');
    expect(result.state.round.lastPlay).toBeNull();
    expect(
      viewFor(result.state).trumpCommands.some(
        (c) =>
          c.instanceId ===
          result.state.round.trumps!.hands.human.find(
            (c) => c.definitionId === "regret",
          )!.instanceId,
      ),
    ).toBe(false);
  });
  it.each([en, zh])(
    "renders authoritative scoring sources after the effects have been cleaned",
    (t) => {
      let state = fixture(["pressure", "pressure"], ["shield"], [10, 8, 11, 9]);
      state = play(state, "pressure").state;
      state = play(state, "pressure").state;
      state = act(state, "Stay").state;
      state = play(state, "shield").state;
      const result = finish(state);
      const html = render(viewFor(result.state, result), t);
      expect(result.state.round.trumps!.table).toEqual([]);
      expect(html).toContain(
        text(t.trumpScoreAward, { player: t.contestYou, points: 2 }),
      );
      expect(html).toContain(trumpName("pressure", t));
      expect(html).toContain(trumpName("shield", t));
      expect(html).toContain(t.trumpScoreDefense);
    },
  );
  it("shows a complete zero-point guarded round and the real failed-number consumption", () => {
    let state = fixture(["draw-2"], ["full-shield"], [10, 2, 11, 9]);
    const missed = play(state, "draw-2");
    expect(render(viewFor(missed.state, missed))).toContain(
      "requested number unavailable",
    );
    state = act(missed.state, "Stay").state;
    state = play(state, "full-shield").state;
    const result = finish(state);
    const html = render(viewFor(result.state, result));
    expect(html).toContain(en.trumpScoreGuarded);
    expect(html).toContain("round points +0");
    expect(result.state.phase).toBe("round-complete");
  });
});
