// @req REQ-2026-025: final admitted definitions through real commands, never marker effects.
import { describe, expect, it } from "vitest";
import {
  ADMITTED_TRUMP_DEFINITIONS,
  ADMITTED_TRUMP_IDS,
} from "../trumps/admitted";
import { S2_DEVELOPMENT_PRESET } from "../presets/s2";
import { createResourcePreset } from "../presets/resources";
import { DIFFICULTIES } from "../types";
import type { PlayerId } from "../types";
import {
  createMatch,
  transitionMatch,
  observeMatch,
  legalTrumpCommands,
  projectMatchTransition,
} from "./index";
import type { MatchState, MatchTransition, RoundRules } from "./index";
import {
  createTrumpState,
  drawTrump,
  deleteTrump,
  generateTrump,
  transferTrump,
} from "./resources";
import { fixedRandom } from "./testHelpers";

const rules: RoundRules = {
  ...S2_DEVELOPMENT_PRESET.round,
  trumps: { tableCapacity: 5, definitions: ADMITTED_TRUMP_DEFINITIONS },
};
const noRandom = () => {
  throw new Error("Unexpected number randomness");
};
function fixture(
  human: readonly string[],
  ai: readonly string[] = [],
  first: PlayerId = "human",
) {
  const shuffle = fixedRandom([10, 8, 11, 9]);
  let coin = true;
  return createMatch(
    () =>
      coin ? ((coin = false), first === "human" ? 0.25 : 0.75) : shuffle(),
    rules,
    {
      human: human.map((definitionId, i) => ({
        definitionId,
        instanceId: `human-${i}`,
      })),
      ai: ai.map((definitionId, i) => ({
        definitionId,
        instanceId: `ai-${i}`,
      })),
    },
  ).state;
}
function play(state: MatchState, definitionId: string): MatchTransition {
  const player = state.round.turn!.player;
  const card = state.round.trumps!.hands[player].find(
    (c) => c.definitionId === definitionId,
  )!;
  const command = legalTrumpCommands(observeMatch(state, player).round).find(
    (c) => c.instanceId === card.instanceId,
  );
  expect(command, definitionId).toBeDefined();
  return transitionMatch(
    state,
    { ...command!, roundNumber: state.roundNumber },
    noRandom,
  );
}
function stay(state: MatchState) {
  return transitionMatch(
    state,
    {
      type: "Stay",
      player: state.round.turn!.player,
      roundNumber: state.roundNumber,
    },
    noRandom,
  ).state;
}
function checkFrames(result: MatchTransition) {
  for (const s of [result.state, ...result.events.map((e) => e.state)]) {
    const r = s.round,
      t = r.trumps!;
    const numbers = [
      ...r.deck,
      ...r.hands.human,
      ...r.hands.ai,
      ...r.deletedNumbers,
    ];
    expect(numbers).toHaveLength(11);
    expect(new Set(numbers.map((c) => c.instanceId)).size).toBe(11);
    const bodies = [
      ...t.hands.human,
      ...t.hands.ai,
      ...t.stock.human,
      ...t.stock.ai,
      ...t.destroyed.map((d) => d.instance),
    ];
    expect(new Set(bodies.map((c) => c.instanceId)).size).toBe(bodies.length);
    for (const p of ["human", "ai"] as const) {
      expect(t.hands[p].length).toBeLessThanOrEqual(8);
      expect(t.table.filter((e) => e.owner === p).length).toBeLessThanOrEqual(
        5,
      );
    }
    for (const effect of t.table)
      expect(
        t.destroyed.some(
          (d) =>
            d.reason === "played" &&
            d.instance.instanceId === effect.sourceInstanceId,
        ),
      ).toBe(true);
    for (const p of ["human", "ai"] as const) {
      const text = JSON.stringify(observeMatch(s, p));
      for (const privateKey of [
        '"deck":',
        '"deltas":',
        '"nextGeneratedId":',
        '"trumpSetup":',
      ])
        expect(text).not.toContain(privateKey);
    }
  }
}

describe("final 53-card admission", () => {
  it.each(ADMITTED_TRUMP_IDS)(
    "executes %s, consumes the body once, and keeps the actor through every frame",
    (id) => {
      const opposing = [
        "destroy",
        "destroy-all",
        "suppress",
        "table-exchange",
      ].includes(id);
      const own = ["decommission", "regret", "table-exchange"].includes(id);
      let state = fixture(
        [
          ...(own ? ["shield"] : []),
          id,
          ...(["resource-swap", "purge-hand"].includes(id) ? ["draw-2"] : []),
        ],
        id === "normalize" ? ["double-hidden"] : opposing ? ["pressure"] : [],
        id === "normalize" || opposing ? "ai" : "human",
      );
      if (id === "normalize" || opposing) {
        state = play(
          state,
          id === "normalize" ? "double-hidden" : "pressure",
        ).state;
        state = stay(state);
      }
      if (own) state = play(state, "shield").state;
      const actor = state.round.turn!.player;
      const instance = state.round.trumps!.hands[actor].find(
        (c) => c.definitionId === id,
      )!;
      const result = play(state, id);
      expect(result.state).not.toBe(state);
      expect(result.state.round.turn).toEqual({
        ...state.round.turn,
        usedTrump: true,
      });
      expect(
        result.state.round.trumps!.destroyed.filter(
          (d) => d.instance.instanceId === instance.instanceId,
        ),
      ).toHaveLength(1);
      expect(
        result.state.round.trumps!.hands[actor].some(
          (c) => c.instanceId === instance.instanceId,
        ),
      ).toBe(false);
      if (ADMITTED_TRUMP_DEFINITIONS[id].table)
        expect(
          result.state.round.trumps!.table.some(
            (t) => t.sourceInstanceId === instance.instanceId,
          ),
        ).toBe(true);
      checkFrames(result);
      const repeated = transitionMatch(
        result.state,
        {
          type: "PlayTrump",
          player: actor,
          instanceId: instance.instanceId,
          roundNumber: state.roundNumber,
        },
        noRandom,
      );
      expect(repeated.state).toBe(result.state);
      expect(repeated.events).toEqual([]);
    },
  );
  it.each(
    ADMITTED_TRUMP_IDS.filter((id) => ADMITTED_TRUMP_DEFINITIONS[id].table),
  )(
    "preflights final table capacity for %s without consumption or partial effects",
    (id) => {
      let s = fixture(
        ["pressure", "shield", "last-stand", "risk-pledge", "target-24", id],
        ["pressure"],
        "ai",
      );
      s = stay(play(s, "pressure").state);
      for (const filler of [
        "pressure",
        "shield",
        "last-stand",
        "risk-pledge",
        "target-24",
      ])
        s = play(s, filler).state;
      const c = s.round.trumps!.hands.human.find((c) => c.definitionId === id)!;
      const command = legalTrumpCommands(observeMatch(s, "human").round).find(
        (x) => x.instanceId === c.instanceId,
      );
      const replacesOwn =
        (id.startsWith("target-") && id !== "target-lock") ||
        id === "resonance";
      if (replacesOwn) {
        expect(command).toBeDefined();
        const r = play(s, id);
        expect(
          r.state.round.trumps!.table.filter((t) => t.owner === "human"),
        ).toHaveLength(5);
        checkFrames(r);
      } else {
        expect(command).toBeUndefined();
        const r = transitionMatch(
          s,
          {
            type: "PlayTrump",
            player: "human",
            instanceId: c.instanceId,
            roundNumber: s.roundNumber,
          },
          noRandom,
        );
        expect(r.state).toBe(s);
        expect(r.events).toEqual([]);
      }
    },
  );
  it("does not deduct an opposing target slot from a full own table", () => {
    let s = fixture(
      [
        "pressure",
        "shield",
        "last-stand",
        "risk-pledge",
        "harvest",
        "target-17",
      ],
      ["target-24"],
      "ai",
    );
    s = stay(play(s, "target-24").state);
    for (const id of [
      "pressure",
      "shield",
      "last-stand",
      "risk-pledge",
      "harvest",
    ])
      s = play(s, id).state;
    const c = s.round.trumps!.hands.human.find(
      (c) => c.definitionId === "target-17",
    )!;
    expect(
      legalTrumpCommands(observeMatch(s, "human").round).some(
        (x) => x.instanceId === c.instanceId,
      ),
    ).toBe(false);
  });
  it("consumes a failed hidden draw and installs a mixed effect even with no supply", () => {
    let s = fixture(["draw-2", "pressure-supply"], ["draw-2"]);
    // 2 is publicly absent only after this legal first draw; availability never gates the second actor's card.
    s = play(s, "draw-2").state;
    s = stay(s);
    const miss = play(s, "draw-2");
    expect(
      miss.events.some(
        (e) =>
          e.type === "round" &&
          e.event.type === "trump" &&
          e.event.effect === "draw" &&
          e.event.card === null,
      ),
    ).toBe(true);
    s = stay(miss.state);
    const mixed = play(s, "pressure-supply");
    expect(
      mixed.state.round.trumps!.table.some(
        (t) => t.definitionId === "pressure-supply",
      ),
    ).toBe(true);
    expect(mixed.state.round.trumps!.stock.human).toEqual([]);
    checkFrames(mixed);
  });
  it("preserves full payload privacy and legal commands when private costs differ", () => {
    const a = fixture(["resource-swap", "draw-2"]),
      b = fixture(["resource-swap", "draw-3"]);
    expect(observeMatch(a, "ai")).toEqual(observeMatch(b, "ai"));
    expect(projectMatchTransition(play(a, "resource-swap"), "ai")).toEqual(
      projectMatchTransition(play(b, "resource-swap"), "ai"),
    );
    const left = fixture(["draw-2"], ["draw-3"]),
      right = fixture(["draw-2"], ["draw-4"]);
    expect(legalTrumpCommands(observeMatch(left, "human").round)).toEqual(
      legalTrumpCommands(observeMatch(right, "human").round),
    );
  });
});

describe("admitted stock and generation boundaries", () => {
  it.each(DIFFICULTIES)(
    "exhausts actual %s stock once per instance and excludes Skill Revival",
    (difficulty) => {
      const resources = createResourcePreset(difficulty, ADMITTED_TRUMP_IDS);
      const trumps = {
        tableCapacity: 5 as const,
        definitions: ADMITTED_TRUMP_DEFINITIONS,
        resources,
      };
      let s = createTrumpState(trumps);
      const seen = new Set<string>(),
        quantities: Record<string, number> = {};
      while (s.stock.human.length) {
        const r = drawTrump(s, "human", () => 0.5);
        expect(r.instance).not.toBeNull();
        const c = r.instance!;
        expect(ADMITTED_TRUMP_IDS).toContain(c.definitionId);
        expect(seen.has(c.instanceId)).toBe(false);
        seen.add(c.instanceId);
        quantities[c.definitionId] = (quantities[c.definitionId] ?? 0) + 1;
        s = deleteTrump(r.state, "human", c.instanceId, "played", true);
      }
      for (const [id, count] of Object.entries(resources.stock))
        expect(quantities[id] ?? 0).toBe(count);
      expect(quantities["destroy-all"] ?? 0).toBeLessThanOrEqual(1);
      expect(drawTrump(s, "human", noRandom).instance).toBeNull();
      expect(
        drawTrump(s, "human", undefined, "destroy-all").instance,
      ).toBeNull();
      expect(() =>
        generateTrump(s, "human", "skill-revival", "skill", trumps),
      ).toThrow(RangeError);
      expect(() =>
        generateTrump(s, "human", "test-marker", "skill", trumps),
      ).toThrow(RangeError);
      const generated = generateTrump(
        s,
        "human",
        "destroy-all",
        "skill",
        trumps,
      );
      expect(generated.instance?.origin).toEqual({
        type: "generated",
        sourceId: "skill",
      });
      expect(generated.state.stock.human).toEqual([]);
      const transferred = transferTrump(
        generated.state,
        "human",
        "ai",
        generated.instance!.instanceId,
      );
      expect(transferred.hands.ai.at(-1)).toEqual(generated.instance);
      expect(transferred.stock.human).toEqual([]);
      expect(transferTrump(transferred, "human", "ai", [...seen][0])).toBe(
        transferred,
      );
    },
  );
});
