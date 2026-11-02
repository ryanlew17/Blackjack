// @req REQ-2026-027: real authorized snapshots rendered through production spheres, status and feedback.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import {
  observeMatch,
  projectMatchTransition,
  legalMatchActions,
  legalSkillCommands,
  legalTrumpCommands,
} from "../../../domain/contest/engine";
import type {
  MatchState,
  MatchTransition,
  MatchObservation,
  MatchEventView,
} from "../../../domain/contest/engine";
import type { ContestView } from "../../../application/contest/types";
import { createContestCoordinator } from "../../../application/contest/coordinator";
import { sendContestInput } from "../../../application/contest/input";
import {
  fixture,
  fixturePorts,
  skill,
  act,
  finish,
  pass,
  play,
} from "../../../domain/contest/engine/skillBarrierTestHelpers";
import { en, zh, type Copy } from "../../i18n";
import { ContestSkills } from "./ContestSkills";
import { ContestTable } from "./ContestTable";
import { ContestControls } from "./ContestControls";
import { ContestFeedback } from "./ContestFeedback";
import { text } from "./trumpView";

function observed(
  match: MatchObservation,
  recentEvents: readonly MatchEventView[] = [],
): ContestView {
  const inputId = 7;
  const commands = legalSkillCommands(match.round);
  const reaction = match.round.reaction;
  return {
    match,
    recentEvents,
    busy: false,
    thinking: false,
    paused: false,
    event: null,
    inputId,
    effectId: 1,
    actions: legalMatchActions(match).filter((a) => a !== "ResolveForcedTurn"),
    skillCommands: commands.map(({ player: _player, ...c }) => ({
      ...c,
      inputId,
    })),
    trumpCommands: legalTrumpCommands(match.round).map(
      ({ player: _player, ...c }) => ({ ...c, inputId }),
    ),
    reaction:
      reaction?.player === "human" && commands[0]
        ? {
            activate: { ...commands[0], inputId },
            pass: {
              type: "PassReaction",
              player: "human",
              inputId,
              turnNumber: reaction.turnNumber,
              reactionBoundary: reaction.boundary,
            },
          }
        : null,
  };
}
function viewFor(state: MatchState, result?: MatchTransition) {
  return observed(
    observeMatch(state, "human"),
    result ? projectMatchTransition(result, "human").events : [],
  );
}
function render(
  view: ContestView,
  t: Copy = en,
  choosing = false,
  reduced = false,
) {
  const skills = createElement(ContestSkills, {
    view,
    t,
    choosing,
    reduced,
    send: () => true,
    onInspect: () => {},
  });
  return renderToStaticMarkup(
    createElement(
      "div",
      null,
      createElement(ContestTable, {
        match: view.match!,
        busy: view.busy,
        reduced,
        t,
        skills,
      }),
      createElement(ContestControls, {
        view,
        t,
        send: () => true,
        onRestart: () => {},
      }),
      createElement(ContestFeedback, { view, t }),
    ),
  );
}
it.each([en, zh])(
  "shows public identities, exact own uses and the opponent's authorized unknown range",
  (t) => {
    const f = fixture({ human: "spirit-sight", ai: "soul-transfer" });
    const html = render(viewFor(f.state), t);
    expect(html).toContain(t["contest.skill.spirit-sight.name"]);
    expect(html).toContain(t["contest.skill.soul-transfer.name"]);
    expect(html).toContain(text(t.skillUses, { remaining: 4, initial: 4 }));
    expect(html).toContain(
      text(t.skillUsesUnknown, { min: 0, max: 3, initial: 3 }),
    );
    expect(html).toContain(t.skillStateUnknown);
    expect(html.match(/class="skill-orb"/g)).toHaveLength(2);
    expect(html.match(/aria-label="(?:Activate |发动)/g)).toHaveLength(1);
    expect(html).not.toContain("nextActivationSequence");
    expect(html).not.toContain("hasSucceeded");
  },
);
it.each(["metamorphosis", "soul-transfer", "twin-bloom"] as const)(
  "keeps the complete opponent-side DOM identical after secret %s preparation",
  (id) => {
    for (const t of [en, zh]) {
      const options = {
        human: "spirit-sight" as const,
        ai: id,
        first: id === "twin-bloom" ? ("human" as const) : ("ai" as const),
      };
      const a = fixture(options),
        b = fixture(options);
      let hidden = skill(a.state, "ai", a.random).state,
        plain = b.state;
      if (id === "twin-bloom") {
        hidden = pass(hidden, a.random);
        plain = pass(plain, b.random);
      } else {
        hidden = act(hidden, "Stay", a.random).state;
        plain = act(plain, "Stay", b.random).state;
      }
      expect(render(viewFor(hidden), t)).toBe(render(viewFor(plain), t));
    }
  },
);
it.each([en, zh])(
  "shows private confirmation only to the owner, then the actual revealed result",
  (t) => {
    const f = fixture({ human: "metamorphosis", prefix: [1, 8, 11, 9] });
    const result = skill(f.state, "human", f.random);
    const html = render(viewFor(result.state, result), t);
    expect(html).toContain(
      text(t.skillEventSecretPrepared, {
        player: t.contestYou,
        name: t["contest.skill.metamorphosis.name"],
      }),
    );
    expect(html).toContain(t.skillStatePending);
    const complete = finish(result.state, f.random);
    expect(render(viewFor(complete), t)).toContain(t.skillStateResolved);
    expect(f.calls.skillEffects).toBe(1);
  },
);
it.each([en, zh])(
  "shows active Nullify and the opponent lock in the first public frame without disclosing secret cancellation",
  (t) => {
    const f = fixture({ first: "ai", ai: "metamorphosis" });
    const armed = act(
      skill(f.state, "ai", f.random).state,
      "Stay",
      f.random,
    ).state;
    const result = skill(armed, "human", f.random);
    const projected = projectMatchTransition(result, "human");
    const html = render(
      observed(projected.events[0].state, projected.events.slice(0, 1)),
      t,
    );
    expect(html).toContain('data-player="human" data-state="active"');
    expect(html).toContain('data-player="ai" data-state="locked"');
    expect(html).toContain(t.skillStateActive);
    expect(html).toContain(t.skillStateLocked);
    expect(html).not.toContain(
      text(t.skillEventCancelled, {
        player: t.contestOpponent,
        name: t["contest.skill.metamorphosis.name"],
      }),
    );
    expect(html).not.toContain(
      text(t.skillEventSecretPrepared, {
        player: t.contestOpponent,
        name: t["contest.skill.metamorphosis.name"],
      }),
    );
  },
);
it("keeps Endless Life prepared/active under Nullify without showing a lock", () => {
  const f = fixture({
    first: "ai",
    ai: "endless-life",
    stock: { noop: 5 },
    humanTrumps: ["noop", "noop", "noop"],
    aiTrumps: ["noop", "noop", "noop"],
  });
  const armed = act(
    skill(f.state, "ai", f.random).state,
    "Stay",
    f.random,
  ).state;
  const sealed = skill(armed, "human", f.random).state;
  expect(render(viewFor(sealed))).toContain(
    'data-player="ai" data-state="pending"',
  );
  const active = act(sealed, "Stay", f.random).state;
  const html = render(viewFor(active), en, false, true);
  expect(html).toContain('data-player="ai" data-state="active"');
  expect(html).not.toContain('data-state="locked"');
  expect(html).toContain('data-reduced="true"');
  expect(f.calls.skillEffects).toBe(1);
});
it.each(["busy", "paused", "choosing"] as const)(
  "disables sphere input while %s without replacing the observation",
  (mode) => {
    const f = fixture({ human: "spirit-sight" }),
      view = viewFor(f.state);
    const html = render(
      { ...view, busy: mode === "busy", paused: mode === "paused" },
      en,
      mode === "choosing",
    );
    expect(html).toMatch(/class="skill-orb"[^>]*disabled=""/);
  },
);
it("offers an explicit pass and removes that decision after the production gateway accepts it", () => {
  const ports = fixturePorts({ human: "twin-bloom", first: "ai" });
  const api = createContestCoordinator({
    ...ports,
    controlledPlayers: ["human", "ai"],
  });
  api.start();
  api.skipAnimations();
  const html = render(api.getSnapshot());
  expect(html).toContain(en.skillReactionTitle);
  expect(html).toContain(en.skillPass);
  expect(api.getSnapshot().thinking).toBe(false);
  expect(
    sendContestInput(
      api.getSnapshot().reaction!.pass,
      api.getSnapshot(),
      api.sendCommand,
    ),
  ).toBe(true);
  expect(render(api.getSnapshot())).not.toContain(en.skillPass);
  api.exit();
});
it("shows no-effect and expiry from actual skill records without inventing a recovery success", () => {
  const f = fixture({ human: "fortune" });
  const missed = skill(f.state, "human", f.random);
  expect(render(viewFor(missed.state, missed))).toContain(
    en.skillStateIneffective,
  );
  expect(render(viewFor(missed.state, missed))).toContain(
    text(en.skillEventIneffective, {
      player: en.contestYou,
      name: en["contest.skill.fortune.name"],
    }),
  );
  const s = fixture({ human: "soul-transfer" });
  const expired = finish(skill(s.state, "human", s.random).state, s.random);
  expect(render(viewFor(expired))).toContain(en.skillStateExpired);
  expect(
    observeMatch(expired, "human").round.skills!.human.canRecover,
  ).toBeUndefined();
});
it("enables the sphere again after an actual admitted revival and reports restored counts", () => {
  const f = fixture({ human: "spirit-sight", humanTrumps: ["skill-revival"] });
  const used = skill(f.state, "human", f.random).state;
  const revived = play(used, "skill-revival", f.random);
  const html = render(viewFor(revived.state, revived));
  expect(html).toContain('data-player="human" data-state="ready"');
  expect(html).not.toMatch(/class="skill-orb"[^>]*disabled=""/);
  expect(html).toContain(
    text(en.trumpSkillRecovered, {
      player: en.contestYou,
      name: en["contest.trump.skill-revival.name"],
    }),
  );
});

it("keeps an ongoing Endless Life sphere active while an additional recovered activation is prepared", () => {
  const f = fixture({
    human: "endless-life",
    stock: { noop: 8, "skill-revival": 1 },
    humanTrumps: ["skill-revival", "noop", "noop"],
    aiTrumps: ["noop", "noop", "noop"],
  });
  let state = skill(f.state, "human", f.random).state;
  state = act(state, "Stay", f.random).state;
  state = act(state, "Stay", f.random).state;
  state = play(state, "skill-revival", f.random).state;
  state = skill(state, "human", f.random).state;
  const view = viewFor(state);
  expect(
    view.match!.round.skills!.human.activations.map((a) => a.status),
  ).toEqual(["succeeded", "prepared"]);
  expect(render(view)).toContain('data-player="human" data-state="active"');
});
