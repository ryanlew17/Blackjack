// @req REQ-2026-027: lazy, independently advancing skill selection and true-effect streams.
// @req REQ-2026-025: default resource activity cannot advance the number stream.
import type {
  ContestRandomSources,
  RandomSource,
  SkillRandomSources,
} from "../../domain/contest/engine";

function stream(seed: number): RandomSource {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

/** Lazy seeds preserve idle/invalid-initialization zero-random behavior. */
export function createContestRandomSources(
  seed: RandomSource = Math.random,
): ContestRandomSources & SkillRandomSources {
  let sources: (ContestRandomSources & SkillRandomSources) | undefined;
  const sample = (key: keyof (ContestRandomSources & SkillRandomSources)) => {
    sources ??= {
      numbers: stream(Math.floor(seed() * 0x100000000)),
      trumpGate: stream(Math.floor(seed() * 0x100000000)),
      trumpSelection: stream(Math.floor(seed() * 0x100000000)),
      skillSelection: stream(Math.floor(seed() * 0x100000000)),
      skillEffects: stream(Math.floor(seed() * 0x100000000)),
    };
    return sources[key]();
  };
  return {
    numbers: () => sample("numbers"),
    trumpGate: () => sample("trumpGate"),
    trumpSelection: () => sample("trumpSelection"),
    skillSelection: () => sample("skillSelection"),
    skillEffects: () => sample("skillEffects"),
  };
}
