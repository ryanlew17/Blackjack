// @req REQ-2026-027: lazy, independently advancing skill selection and true-effect streams.
// @req REQ-2026-025: default resource activity cannot advance the number stream.
import type {
  ContestRandomSources,
  RandomSource,
  SkillRandomSources,
} from "../../domain/contest/engine";

import { seededRandom as stream } from "../../domain/contest/random";

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

/** Independent entropy and cursor: search calls cannot initialize or advance any live game stream. */
export function createSearchSeedSource(
  seed: () => number = () => crypto.getRandomValues(new Uint32Array(1))[0],
): () => number {
  let source: (() => number) | undefined;
  return () => {
    source ??= stream(seed());
    return Math.floor(source() * 0x100000000);
  };
}
