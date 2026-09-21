import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  freshGame,
  transition,
  type GameCommand,
  type GameState,
} from "../domain/game";
import {
  envelope,
  readSave,
  writeSave,
  STORAGE_KEY,
  type SaveEnvelope,
  type Settings,
} from "../infrastructure/save";
import { playSound, unlockAudio } from "../infrastructure/audio";
interface View {
  game: GameState;
  busy: boolean;
  effect?: "chip" | "card" | "reveal" | "result";
  effectId?: number;
}
function viewReducer(_: View, next: View): View {
  return next;
}
export function useGame(reduced: boolean) {
  const [initial] = useState(readSave);
  const current = useRef(initial.save);
  const [view, dispatch] = useReducer(viewReducer, {
    game: initial.save.game,
    busy: false,
  });
  const [settings, setSettings] = useState(initial.save.settings);
  const [problem, setProblem] = useState<"corrupt" | "storage" | null>(
    initial.error,
  );
  const [conflict, setConflict] = useState(false);
  const conflictRef = useRef(false),
    busy = useRef(false),
    generation = useRef(0),
    effectSeq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const baseline = useRef<string | null>(null);
  const cancel = useCallback(() => {
    generation.current++;
    clearTimeout(timer.current);
    busy.current = false;
  }, []);
  useEffect(() => {
    try {
      baseline.current = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* Reported by readSave. */
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY && e.key !== null) return;
      cancel();
      conflictRef.current = true;
      setConflict(true);
      dispatch({ game: current.current.game, busy: false });
    };
    // A background tab can throttle timers. Resume at the committed state.
    const onVisible = () => {
      if (document.visibilityState === "visible" && busy.current) {
        cancel();
        dispatch({ game: current.current.game, busy: false });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("storage", onStorage);
    return () => {
      cancel();
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [cancel]);
  const persist = (save: SaveEnvelope, overwrite = false): boolean => {
    if (!overwrite && conflictRef.current) return false;
    try {
      const actual = localStorage.getItem(STORAGE_KEY);
      if (!overwrite && actual !== baseline.current) {
        conflictRef.current = true;
        setConflict(true);
        cancel();
        dispatch({ game: current.current.game, busy: false });
        return false;
      }
    } catch {
      setProblem("storage");
    }
    if (writeSave(save)) {
      baseline.current = JSON.stringify(save);
      setProblem(null);
    } else setProblem("storage");
    current.current = save;
    return true;
  };
  const send = (command: GameCommand) => {
    unlockAudio();
    if (busy.current || conflictRef.current || problem === "corrupt") return;
    const result = transition(current.current.game, command);
    if (result.state === current.current.game) return;
    if (!persist(envelope(result.state, current.current.settings))) return;
    if (!result.events.length) {
      dispatch({ game: result.state, busy: false });
      return;
    }
    busy.current = true;
    const id = ++generation.current;
    let index = 0;
    const step = () => {
      if (id !== generation.current) return;
      const event = result.events[index++];
      if (!event) {
        busy.current = false;
        dispatch({ game: result.state, busy: false });
        return;
      }
      dispatch({
        game: event.state,
        busy: true,
        effect: event.type,
        effectId: ++effectSeq.current,
      });
      const pref = current.current.settings;
      if (!pref.muted)
        playSound(
          event.type === "result" && event.state.outcome === "lose"
            ? "card"
            : event.type,
          pref.volume,
        );
      timer.current = setTimeout(
        step,
        current.current.settings.motion === "reduce" ||
          (current.current.settings.motion === "system" && reduced)
          ? 35
          : event.type === "card"
            ? 220
            : 300,
      );
    };
    step();
  };
  const updateSettings = (patch: Partial<Settings>) => {
    unlockAudio();
    const next = { ...current.current.settings, ...patch };
    if (problem === "corrupt" || conflictRef.current) {
      setSettings(next);
      return;
    }
    if (persist(envelope(current.current.game, next))) setSettings(next);
  };
  const replace = (save: SaveEnvelope) => {
    if (conflictRef.current) return;
    cancel();
    const next = envelope(save.game, save.settings);
    if (!persist(next, problem === "corrupt")) return;
    setSettings(next.settings);
    dispatch({ game: next.game, busy: false });
  };
  const reset = () => replace(envelope(freshGame(), settings));
  const reloadLatest = () => {
    cancel();
    const loaded = readSave();
    current.current = loaded.save;
    try {
      baseline.current = localStorage.getItem(STORAGE_KEY);
    } catch {
      baseline.current = null;
    }
    conflictRef.current = false;
    setConflict(false);
    setProblem(loaded.error);
    setSettings(loaded.save.settings);
    dispatch({ game: loaded.save.game, busy: false });
  };
  return {
    ...view,
    settings,
    send,
    updateSettings,
    reset,
    replace,
    problem,
    conflict,
    reloadLatest,
    snapshot: () => current.current,
  };
}
