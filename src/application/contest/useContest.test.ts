// @req REQ-2026-017: real React server initialization, not a browser acceptance.
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { useContest } from "./useContest";

it("initializes the hook idle without restoring a match or changing shared preferences", () => {
  const random = vi.fn(() => 0);
  const settings = Object.freeze({
    muted: true,
    volume: 0.2,
    motion: "reduce" as const,
  });
  let api: ReturnType<typeof useContest> | undefined;
  function Probe() {
    api = useContest({ settings, random });
    return createElement("div", null, api.match === null ? "idle" : "active");
  }
  expect(renderToString(createElement(Probe))).toBe("<div>idle</div>");
  expect(api?.snapshot()).toBeNull();
  expect(api?.busy).toBe(false);
  expect(api?.actions).toEqual([]);
  expect(random).not.toHaveBeenCalled();
  expect(settings).toEqual({ muted: true, volume: 0.2, motion: "reduce" });
});
