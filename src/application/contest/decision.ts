// @req REQ-2026-028: yield to the browser between pure search slices; cancellation releases the iterator.
import { searchDecisionSteps } from "../../domain/contest/ai/search";
import type { ContestDecisionTask } from "./types";

export const SEARCH_SLICE = Object.freeze({ milliseconds: 8, steps: 64 });
export const runSearchDecision: ContestDecisionTask = (
  memory,
  seed,
  deliver,
) => {
  let work: ReturnType<typeof searchDecisionSteps> | null = searchDecisionSteps(
    memory,
    seed,
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const slice = () => {
    timer = undefined;
    if (!work) return;
    const started = performance.now();
    for (let n = 0; n < SEARCH_SLICE.steps; n++) {
      const result = work.next();
      if (result.done) {
        work = null;
        deliver(result.value.command);
        return;
      }
      if (performance.now() - started >= SEARCH_SLICE.milliseconds) break;
    }
    timer = setTimeout(slice, 0);
  };
  timer = setTimeout(slice, 0);
  return () => {
    work = null;
    clearTimeout(timer);
    timer = undefined;
  };
};
