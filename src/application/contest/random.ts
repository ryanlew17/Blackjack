// @req REQ-2026-025: default resource activity cannot advance the number stream.
import type {
  ContestRandomSources,
  RandomSource,
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
): ContestRandomSources {
  let sources: ContestRandomSources | undefined;
  const sample = (key: keyof ContestRandomSources) => {
    sources ??= {
      numbers: stream(Math.floor(seed() * 0x100000000)),
      trumpGate: stream(Math.floor(seed() * 0x100000000)),
      trumpSelection: stream(Math.floor(seed() * 0x100000000)),
    };
    return sources[key]();
  };
  return {
    numbers: () => sample("numbers"),
    trumpGate: () => sample("trumpGate"),
    trumpSelection: () => sample("trumpSelection"),
  };
}
