// @req REQ-2026-017: React adapter, shared preferences are read through props.
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Settings } from "../../infrastructure/classic/save";
import { playSound, unlockAudio } from "../../infrastructure/shared/audio";
import { createContestController } from "./controller";
import type { ContestAction, ContestControllerOptions } from "./types";

export interface UseContestOptions extends Pick<
  ContestControllerOptions,
  "random" | "opponent"
> {
  readonly settings: Pick<Settings, "motion" | "muted" | "volume">;
  readonly systemReduced?: boolean;
}

export function useContest({
  settings,
  systemReduced = false,
  random,
  opponent,
}: UseContestOptions) {
  const preferences = useRef(settings);
  preferences.current = settings;
  const reduced =
    settings.motion === "reduce" ||
    (settings.motion === "system" && systemReduced);
  const [controller] = useState(() =>
    createContestController({
      random,
      opponent,
      reducedMotion: reduced,
      onEvent(event) {
        const pref = preferences.current;
        if (pref.muted || event.type !== "round") return;
        const type = event.event.type;
        if (type === "deal" || type === "hit") playSound("card", pref.volume);
        else if (type === "reveal") playSound("reveal", pref.volume);
        else if (type === "settled")
          playSound(
            event.event.result.winner === "ai" ? "card" : "result",
            pref.volume,
          );
      },
    }),
  );
  const view = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  useEffect(() => {
    controller.setReducedMotion(reduced);
  }, [controller, reduced]);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") controller.skipAnimations();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      controller.exit();
    };
  }, [controller]);
  const start = useCallback(() => {
    unlockAudio();
    return controller.start();
  }, [controller]);
  const restart = useCallback(() => {
    unlockAudio();
    controller.restart();
  }, [controller]);
  const send = useCallback(
    (type: ContestAction) => {
      unlockAudio();
      return controller.send(type);
    },
    [controller],
  );
  return {
    ...view,
    start,
    restart,
    send,
    exit: controller.exit,
    pause: controller.pause,
    resume: controller.resume,
    skipAnimations: controller.skipAnimations,
    snapshot: controller.snapshot,
  };
}
