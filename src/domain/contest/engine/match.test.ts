// @req REQ-2026-016: all match scenarios progress through actual commands.
import { describe, expect, it, vi } from "vitest";
import type { NumberValue, PlayerId } from "../types";
import {
  createMatch,
  legalMatchActions,
  observeMatch,
  projectMatchTransition,
  transitionMatch,
} from "./index";
import type { MatchState, MatchTransition } from "./types";
import { fixedRandom } from "./testHelpers";
import { opponentOf } from "./turn";

function scriptedRandom(
  winners: readonly (PlayerId | null)[],
  firstPlayer: PlayerId = "human",
) {
  const samples = [firstPlayer === "human" ? 0.25 : 0.75];
  let first = firstPlayer;
  for (const winner of winners) {
    const hands: Record<PlayerId, NumberValue[]> =
      winner === null
        ? { human: [10, 5], ai: [9, 6] }
        : winner === "human"
          ? { human: [10, 11], ai: [8, 9] }
          : { human: [8, 9], ai: [10, 11] };
    const other = opponentOf(first);
    const shuffle = fixedRandom([
      hands[first][0],
      hands[other][0],
      hands[first][1],
      hands[other][1],
    ]);
    for (let i = 0; i < 10; i++) samples.push(shuffle());
    first = other;
  }
  let index = 0;
  return vi.fn(() => {
    if (index === samples.length)
      throw new Error("Unexpected match randomness");
    return samples[index++];
  });
}

type MatchRandom = ReturnType<typeof scriptedRandom>;
function stay(state: MatchState, random: MatchRandom) {
  return transitionMatch(
    state,
    {
      type: "Stay",
      player: state.round.turn!.player,
      roundNumber: state.roundNumber,
    },
    random,
  );
}
const finishRound = (state: MatchState, random: MatchRandom) =>
  stay(stay(state, random).state, random);
const next = (state: MatchState, random: MatchRandom) =>
  transitionMatch(
    state,
    { type: "NextRound", roundNumber: state.roundNumber },
    random,
  );
const eventNames = (result: MatchTransition) =>
  result.events.map((event) =>
    event.type === "round" ? event.event.type : event.type,
  );

function playRounds(
  winners: readonly (PlayerId | null)[],
  firstPlayer: PlayerId = "human",
) {
  const random = scriptedRandom(winners, firstPlayer);
  const initial = createMatch(random);
  let state = initial.state;
  const results: MatchTransition[] = [];
  for (let i = 0; i < winners.length; i++) {
    const result = finishRound(state, random);
    expect(result.state.round.result?.winner).toBe(winners[i]);
    results.push(result);
    state =
      i < winners.length - 1 ? next(result.state, random).state : result.state;
  }
  return { initial, state, results, random };
}

function assertNoDeck(value: unknown) {
  if (value !== null && typeof value === "object") {
    expect(Object.keys(value)).not.toContain("deck");
    for (const child of Object.values(value)) assertNoDeck(child);
  }
}

describe("fixed standard match setup and round progression", () => {
  it.each(["human", "ai"] as const)(
    "uses one opening coin flip for %s, then only ten shuffle samples per round",
    (firstPlayer) => {
      const { initial, state, results, random } = playRounds(
        [null, "human", null],
        firstPlayer,
      );
      expect(initial.state.rules).toMatchObject({
        version: 1,
        difficulty: "standard",
        bestOf: 5,
        gamesToWin: 3,
        initialGameTarget: 5,
        targetIncrement: 2,
        trumpDealing: false,
      });
      expect(initial.state.round.firstPlayer).toBe(firstPlayer);
      expect(results.map((result) => result.state.round.firstPlayer)).toEqual([
        firstPlayer,
        opponentOf(firstPlayer),
        firstPlayer,
      ]);
      expect(random).toHaveBeenCalledTimes(31);
      expect(state.roundNumber).toBe(3);
      expect(state.game.roundsPlayed).toBe(3);
      expect(state.game.points).toEqual({ human: 1, ai: 0 });
      expect(initial.state.game.points).toEqual({ human: 0, ai: 0 });
      expect(initial.state.game.target).toBe(5);
      expect(initial.state.wins).toEqual({ human: 0, ai: 0 });
      expect(eventNames(initial)).toEqual(["deal", "deal", "deal", "deal"]);
    },
  );
  it("awards no points for a tie, but counts and alternates every completed round", () => {
    const { results, state } = playRounds([null, "human", null, "ai"]);
    expect(results.map((result) => result.state.game.points)).toEqual([
      { human: 0, ai: 0 },
      { human: 1, ai: 0 },
      { human: 1, ai: 0 },
      { human: 1, ai: 1 },
    ]);
    expect(results.map((result) => result.state.roundNumber)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(results.map((result) => result.state.game.roundsPlayed)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(state.phase).toBe("round-complete");
    expect(state.winner).toBeNull();
  });
  it("waits for the fifth point before awarding a game", () => {
    const { results, state } = playRounds(Array<PlayerId>(5).fill("human"));
    expect(results[3].state.game.points.human).toBe(4);
    expect(results[3].state.phase).toBe("round-complete");
    expect(results[3].state.wins.human).toBe(0);
    expect(state.game.winner).toBe("human");
    expect(state.wins).toEqual({ human: 1, ai: 0 });
    expect(state.phase).toBe("game-complete");
    expect(state.game.number).toBe(1);
    expect(state.game.points).toEqual({ human: 5, ai: 0 });
  });
  it("resets the next game's points and target without resetting the round sequence or rules", () => {
    const random = scriptedRandom([...Array<PlayerId>(5).fill("human"), "ai"]);
    let state = createMatch(random).state;
    const rules = state.rules;
    for (let i = 0; i < 5; i++) {
      state = finishRound(state, random).state;
      if (i < 4) state = next(state, random).state;
    }
    const previous = state;
    const started = next(previous, random);
    state = started.state;
    expect(state.game).toEqual({
      number: 2,
      points: { human: 0, ai: 0 },
      target: 5,
      roundsPlayed: 0,
      winner: null,
    });
    expect(state.wins).toEqual({ human: 1, ai: 0 });
    expect(state.roundNumber).toBe(6);
    expect(state.round.firstPlayer).toBe("ai");
    expect(state.round.hands).toEqual({ human: [8, 9], ai: [10, 11] });
    expect(state.round.revealed).toEqual([]);
    expect(state.round.result).toBeNull();
    expect(state.rules).toBe(rules);
    expect(state.round.rules).toBe(rules.round);
    expect(previous.game.points.human).toBe(5);
    expect(random).toHaveBeenCalledTimes(61);
    expect(
      started.events.every(
        (event) =>
          event.state.game.number === 2 && event.state.game.points.human === 0,
      ),
    ).toBe(true);
  });
  it("freezes one rules snapshot for every game, round, observation and event", () => {
    const rules = { version: 1 as const, pointTarget: 24 };
    const random = scriptedRandom(["human", "ai"]);
    const initial = createMatch(random, rules);
    rules.pointTarget = 17;
    const finished = finishRound(initial.state, random);
    const started = next(finished.state, random);
    expect(initial.state.rules.round.pointTarget).toBe(24);
    expect(started.state.round.pointTarget).toBe(24);
    expect(started.state.rules).toBe(initial.state.rules);
    expect(started.state.round.rules).toBe(initial.state.rules.round);
    expect(observeMatch(started.state, "human").rules).toBe(
      initial.state.rules,
    );
    for (const event of [
      ...initial.events,
      ...finished.events,
      ...started.events,
    ]) {
      expect(event.state.rules).toBe(initial.state.rules);
      expect(event.state.round.rules).toBe(initial.state.rules.round);
    }
    expect(Object.isFrozen(initial.state.rules)).toBe(true);
    expect(() =>
      Object.assign(initial.state.rules, { trumpDealing: true }),
    ).toThrow();
    expect(() =>
      Object.assign(initial.state.game.points, { human: 99 }),
    ).toThrow();
  });
});

describe("game targets and match wins", () => {
  it("extends 4:4 to seven and 6:6 to nine, then requires nine even with a two-point lead", () => {
    const winners: PlayerId[] = [
      "human",
      "human",
      "human",
      "ai",
      "ai",
      "ai",
      "ai",
      "human",
      "human",
      "ai",
      "ai",
      "human",
      "human",
      "human",
      "human",
    ];
    const random = scriptedRandom([...winners, "ai"]);
    let state = createMatch(random).state;
    const extensions: MatchTransition[] = [];
    for (let i = 0; i < winners.length; i++) {
      const result = finishRound(state, random);
      state = result.state;
      if (i === 6) expect(state.game.points).toEqual({ human: 3, ai: 4 });
      if (i === 7 || i === 11) extensions.push(result);
      if (i === 13) {
        expect(state.game.points).toEqual({ human: 8, ai: 6 });
        expect(state.game.target).toBe(9);
        expect(state.phase).toBe("round-complete");
        expect(state.wins.human).toBe(0);
      }
      if (i < winners.length - 1) state = next(state, random).state;
    }
    expect(extensions.map((result) => result.state.game.target)).toEqual([
      7, 9,
    ]);
    expect(extensions.map((result) => result.state.game.points)).toEqual([
      { human: 4, ai: 4 },
      { human: 6, ai: 6 },
    ]);
    expect(
      extensions.flatMap((result) =>
        result.events
          .filter((event) => event.type === "target-extended")
          .map((event) => [event.from, event.to]),
      ),
    ).toEqual([
      [5, 7],
      [7, 9],
    ]);
    expect(state.game.points).toEqual({ human: 9, ai: 6 });
    expect(state.game.roundsPlayed).toBe(15);
    expect(state.phase).toBe("game-complete");
    expect(state.wins).toEqual({ human: 1, ai: 0 });
    const started = next(state, random);
    expect(started.state.game.target).toBe(5);
    expect(started.state.roundNumber).toBe(16);
    expect(started.state.round.firstPlayer).toBe("ai");
    expect(extensions.map(eventNames)).toEqual([
      [
        "stay",
        "reveal",
        "reveal",
        "settled",
        "round-scored",
        "target-extended",
        "round-cleanup",
      ],
      [
        "stay",
        "reveal",
        "reveal",
        "settled",
        "round-scored",
        "target-extended",
        "round-cleanup",
      ],
    ]);
  });
  it.each([
    { champion: "human" as const, losses: 0 },
    { champion: "ai" as const, losses: 0 },
    { champion: "human" as const, losses: 1 },
    { champion: "ai" as const, losses: 1 },
    { champion: "human" as const, losses: 2 },
    { champion: "ai" as const, losses: 2 },
  ])(
    "ends BO5 at 3:$losses for $champion without forcing five games",
    ({ champion, losses }) => {
      const other = opponentOf(champion);
      const gameWinners =
        losses === 0
          ? [champion, champion, champion]
          : losses === 1
            ? [other, champion, champion, champion]
            : [champion, other, champion, other, champion];
      const winners = gameWinners.flatMap((winner) =>
        Array<PlayerId>(5).fill(winner),
      );
      const { initial, state, results, random } = playRounds(winners, "ai");
      expect(state.phase).toBe("complete");
      expect(state.winner).toBe(champion);
      expect(state.wins).toEqual({ [champion]: 3, [other]: losses });
      expect(state.game.number).toBe(3 + losses);
      expect(state.roundNumber).toBe((3 + losses) * 5);
      expect(state.game.points[champion]).toBe(5);
      expect(
        results
          .flatMap((result) => result.events)
          .filter((event) => event.type === "game-won"),
      ).toHaveLength(3 + losses);
      expect(
        results
          .flatMap((result) => result.events)
          .filter((event) => event.type === "match-won"),
      ).toHaveLength(1);
      expect(
        results.slice(0, -1).every((result) => result.state.winner === null),
      ).toBe(true);
      expect(random).toHaveBeenCalledTimes(1 + winners.length * 10);
      expect(initial.state.wins).toEqual({ human: 0, ai: 0 });
      expect(legalMatchActions(observeMatch(state, "human"))).toEqual([]);
      expect(legalMatchActions(observeMatch(state, "ai"))).toEqual([]);
      const calls = random.mock.calls.length;
      for (const command of [
        { type: "NextRound", roundNumber: state.roundNumber },
        { type: "Stay", player: champion, roundNumber: state.roundNumber },
        { type: "Hit", player: other, roundNumber: 1 },
      ] as const) {
        const denied = transitionMatch(state, command, random);
        expect(denied.state).toBe(state);
        expect(denied.events).toEqual([]);
      }
      expect(random).toHaveBeenCalledTimes(calls);
    },
  );
});

describe("single result consumption and cleanup boundaries", () => {
  it("rejects repeated settlement and stale round commands without scoring or randomness", () => {
    const random = scriptedRandom(["human", "ai"]);
    const initial = createMatch(random).state;
    expect(
      transitionMatch(initial, { type: "NextRound", roundNumber: 1 }, random)
        .state,
    ).toBe(initial);
    const wrongPlayer = opponentOf(initial.round.turn!.player);
    expect(
      transitionMatch(
        initial,
        { type: "Stay", player: wrongPlayer, roundNumber: 1 },
        random,
      ),
    ).toEqual({ state: initial, events: [] });
    expect(
      transitionMatch(
        initial,
        { type: "Stay", player: initial.round.turn!.player, roundNumber: 0 },
        random,
      ).state,
    ).toBe(initial);
    const first = stay(initial, random).state;
    const command = {
      type: "Stay" as const,
      player: first.round.turn!.player,
      roundNumber: 1,
    };
    const finished = transitionMatch(first, command, random);
    expect(finished.state.game.points.human).toBe(1);
    expect(finished.state.game.roundsPlayed).toBe(1);
    expect(transitionMatch(finished.state, command, random)).toEqual({
      state: finished.state,
      events: [],
    });
    expect(random).toHaveBeenCalledTimes(11);
    const started = next(finished.state, random).state;
    const calls = random.mock.calls.length;
    expect(transitionMatch(started, command, random).state).toBe(started);
    expect(
      transitionMatch(started, { type: "NextRound", roundNumber: 1 }, random),
    ).toEqual({ state: started, events: [] });
    expect(random).toHaveBeenCalledTimes(calls);
    expect(started.game.points.human).toBe(1);
    expect(initial.game.points.human).toBe(0);
  });
  it("keeps commands unavailable throughout resolving snapshots", () => {
    const { results, random } = playRounds(Array<PlayerId>(5).fill("human"));
    const final = results.at(-1)!;
    expect(eventNames(final)).toEqual([
      "stay",
      "reveal",
      "reveal",
      "settled",
      "round-scored",
      "round-cleanup",
      "game-won",
      "game-cleanup",
    ]);
    const calls = random.mock.calls.length;
    for (const event of final.events.filter(
      (event) => event.state.phase === "resolving",
    )) {
      expect(legalMatchActions(observeMatch(event.state, "human"))).toEqual([]);
      expect(
        transitionMatch(
          event.state,
          { type: "NextRound", roundNumber: event.state.roundNumber },
          random,
        ).state,
      ).toBe(event.state);
    }
    expect(random).toHaveBeenCalledTimes(calls);
    expect(final.state.phase).toBe("game-complete");
    expect(legalMatchActions(observeMatch(final.state, "human"))).toEqual([
      "NextRound",
    ]);
  });
  it("cleans each completed round before game cleanup and emits the match win last", () => {
    const { results, state } = playRounds(Array<PlayerId>(15).fill("human"));
    const events = results.flatMap((result) => result.events);
    expect(
      events.filter((event) => event.type === "round-cleanup"),
    ).toHaveLength(15);
    expect(
      events.filter((event) => event.type === "game-cleanup"),
    ).toHaveLength(3);
    expect(eventNames(results.at(-1)!)).toEqual([
      "stay",
      "reveal",
      "reveal",
      "settled",
      "round-scored",
      "round-cleanup",
      "game-won",
      "game-cleanup",
      "match-won",
    ]);
    for (const result of results) {
      expect(result.state.round.pointTarget).toBe(
        result.state.rules.round.pointTarget,
      );
      expect(result.state.round.quietStays).toBe(0);
      expect(result.state.round.turn).toBeNull();
      expect(result.state.round.revealed).toHaveLength(2);
      expect(result.state.round.result).not.toBeNull();
      expect(result.events.at(-1)?.state).toBe(result.state);
    }
    expect(state.rules.trumpDealing).toBe(false);
    expect(state).not.toHaveProperty("history");
    expect(state).not.toHaveProperty("codex");
    expect(state).not.toHaveProperty("highestClearedDifficulty");
  });
  it("ordinary Hit stays within the current game and never awards points early", () => {
    const random = scriptedRandom(["human"]);
    const initial = createMatch(random).state;
    const before = JSON.stringify(initial);
    const hit = transitionMatch(
      initial,
      { type: "Hit", player: "human", roundNumber: 1 },
      random,
    );
    expect(hit.state.game).toBe(initial.game);
    expect(hit.state.wins).toBe(initial.wins);
    expect(hit.state.round.hands.human).toHaveLength(3);
    expect(hit.state.round.turn?.player).toBe("ai");
    expect(hit.state.phase).toBe("playing");
    expect(hit.state.roundNumber).toBe(1);
    expect(eventNames(hit)).toEqual(["hit"]);
    expect(random).toHaveBeenCalledTimes(11);
    expect(JSON.stringify(initial)).toBe(before);
  });
});

describe("match observations and event projection", () => {
  it.each(["human", "ai"] as const)(
    "projects nested round events and every match snapshot for %s",
    (viewer) => {
      const random = scriptedRandom(["human", null]);
      const initial = createMatch(random);
      const projected = projectMatchTransition(initial, viewer);
      const other = opponentOf(viewer);
      expect(projected.state.round.hands[other].cards[0].value).toBeNull();
      expect(projected.state.round.hands[other].total).toBeNull();
      for (const event of projected.events) {
        expect(event.type).toBe("round");
        if (event.type !== "round") throw new Error("Unexpected fixture event");
        expect(event.event.state).toEqual(event.state.round);
        if (
          event.event.type === "deal" &&
          event.event.player === other &&
          event.event.index === 0
        )
          expect(event.event.card.value).toBeNull();
        if (event.state.round.hands[other].cards.length)
          expect(event.state.round.hands[other].cards[0].value).toBeNull();
      }
      assertNoDeck(projected);
      const authority = finishRound(initial.state, random);
      const finished = projectMatchTransition(authority, viewer);
      expect(finished.state.round.hands[other].total).not.toBeNull();
      expect(finished.state.game.points).toEqual({ human: 1, ai: 0 });
      assertNoDeck(finished);
      const nextRound = projectMatchTransition(
        next(authority.state, random),
        viewer,
      );
      expect(nextRound.state.round.hands[other].cards[0].value).toBeNull();
      expect(nextRound.state.roundNumber).toBe(2);
      assertNoDeck(nextRound);
    },
  );
  it("equivalent hidden states have identical public scores, actions and pre-reveal events", () => {
    function start(prefix: NumberValue[]) {
      const samples = [0.25];
      const shuffle = fixedRandom(prefix);
      for (let i = 0; i < 10; i++) samples.push(shuffle());
      let index = 0;
      const random = vi.fn(() => samples[index++]);
      return { result: createMatch(random), random };
    }
    const a = start([10, 9, 11, 8]);
    const b = start([10, 6, 11, 8]);
    expect(observeMatch(a.result.state, "human")).toEqual(
      observeMatch(b.result.state, "human"),
    );
    expect(projectMatchTransition(a.result, "human")).toEqual(
      projectMatchTransition(b.result, "human"),
    );
    expect(legalMatchActions(observeMatch(a.result.state, "human"))).toEqual([
      "Hit",
      "Stay",
    ]);
    expect(
      projectMatchTransition(stay(a.result.state, a.random), "human"),
    ).toEqual(projectMatchTransition(stay(b.result.state, b.random), "human"));
  });
  it("keeps projected game and match wins in the same authoritative order", () => {
    const { results } = playRounds(Array<PlayerId>(15).fill("human"));
    const result = projectMatchTransition(results.at(-1)!, "ai");
    expect(result.events.map((event) => event.type)).toEqual([
      "round",
      "round",
      "round",
      "round",
      "round-scored",
      "round-cleanup",
      "game-won",
      "game-cleanup",
      "match-won",
    ]);
    expect(result.events.at(-1)?.state).toEqual(result.state);
    expect(result.state.winner).toBe("human");
    expect(result.state.wins).toEqual({ human: 3, ai: 0 });
    assertNoDeck(result);
  });
});
