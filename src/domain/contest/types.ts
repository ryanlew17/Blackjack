// @req REQ-2026-012: contest-only vocabulary; no classic card or money types.
export const DIFFICULTIES = [
  "easy",
  "standard",
  "challenge",
  "danger",
  "nightmare",
] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export type PlayerId = "human" | "ai";
export type NumberValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
