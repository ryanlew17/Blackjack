// @req REQ-2026-028: synchronous callers and cooperative scheduling consume the same pure computation.
export function completeSteps<T>(steps: Generator<void, T, void>): T {
  let result = steps.next();
  while (!result.done) result = steps.next();
  return result.value;
}
