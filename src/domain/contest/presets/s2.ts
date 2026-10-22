// @req REQ-2026-025: fixed standard BO5 development input, not S3 difficulty balance.
import { freezeData } from "../immutable";
import type { RoundRules } from "../engine/types";
import {
  ADMITTED_TRUMP_DEFINITIONS,
  ADMITTED_TRUMP_IDS,
} from "../trumps/admitted";
import { createResourcePreset } from "./resources";

export const S2_DEVELOPMENT_PRESET = freezeData({
  id: "s2-standard-development-v1",
  status: "development",
  round: {
    version: 1,
    pointTarget: 21,
    trumps: {
      tableCapacity: 5,
      definitions: ADMITTED_TRUMP_DEFINITIONS,
      resources: createResourcePreset("standard", ADMITTED_TRUMP_IDS),
    },
  } satisfies RoundRules,
});
