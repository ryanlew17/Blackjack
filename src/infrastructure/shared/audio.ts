let context: AudioContext | undefined;
export function unlockAudio() {
  try {
    context ??= new AudioContext();
    void context.resume().catch(() => {});
  } catch {
    /* Audio is optional. */
  }
}
export function playSound(kind: string, volume: number) {
  if (!context || context.state !== "running" || !volume) return;
  const t = context.currentTime;
  const osc = context.createOscillator(),
    gain = context.createGain();
  osc.connect(gain);
  gain.connect(context.destination);
  osc.type = kind === "card" ? "triangle" : "sine";
  osc.frequency.setValueAtTime(
    kind === "result" ? 660 : kind === "chip" ? 1100 : 260,
    t,
  );
  osc.frequency.exponentialRampToValueAtTime(
    kind === "result" ? 880 : 140,
    t + 0.1,
  );
  gain.gain.setValueAtTime(volume * 0.16, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  osc.start(t);
  osc.stop(t + 0.18);
}
