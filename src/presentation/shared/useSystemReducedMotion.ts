// @req REQ-2026-018: follow device preference changes while the app is open.
import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";
const snapshot = () => window.matchMedia(query).matches;
function subscribe(notify: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}
export function useSystemReducedMotion() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
