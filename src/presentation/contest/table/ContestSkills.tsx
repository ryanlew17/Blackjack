// @req REQ-2026-027: both skill spheres consume only authorized observations and commands.
import { useRef } from "react";
import type {
  ContestInput,
  ContestView,
} from "../../../application/contest/types";
import type { SkillView } from "../../../domain/contest/engine";
import type { PlayerId } from "../../../domain/contest/types";
import { SKILL_CATALOG } from "../../../domain/contest/skills/catalog";
import type { Copy } from "../../i18n";
import { Icon } from "../../shared/Icon";
import { playerName, text } from "./trumpView";

function status(skill: SkillView, view: ContestView, own: boolean, t: Copy) {
  const last = skill.activations.at(-1);
  if (skill.disabled && skill.id !== "endless-life")
    return { state: "locked", label: t.skillStateLocked };
  if (
    skill.effectActive ||
    skill.activations.some(
      (a) => a.effect?.type === "endless-life" && a.status === "succeeded",
    )
  )
    return { state: "active", label: t.skillStateActive };
  if (last?.status === "prepared")
    return { state: "pending", label: t.skillStatePending };
  if (own && view.skillCommands.length)
    return {
      state: "ready",
      label: view.reaction ? t.skillStateReaction : t.skillStateReady,
    };
  if (view.match?.round.skillSeal && skill.id !== "endless-life")
    return { state: "sealed", label: t.skillStateSealed };
  const labels = {
    succeeded: t.skillStateResolved,
    ineffective: t.skillStateIneffective,
    cancelled: t.skillStateCancelled,
    expired: t.skillStateExpired,
  };
  if (last) return { state: "idle", label: labels[last.status] };
  if (skill.remainingUses === 0 || skill.knownRemainingUses.max === 0)
    return { state: "idle", label: t.skillStateExhausted };
  if (!own)
    return {
      state: "idle",
      label:
        skill.gameActivationsRemaining === null
          ? t.skillStateUnknown
          : t.skillStateSelected,
    };
  if (view.paused) return { state: "idle", label: t.contestPaused };
  if (view.busy) return { state: "idle", label: t.contestReplaying };
  if (skill.gameActivationsRemaining === 0)
    return { state: "idle", label: t.skillStateUsed };
  return {
    state: "idle",
    label:
      skill.id === "twin-bloom"
        ? t.skillStateWaitReaction
        : view.match?.round.turn?.player !== "human"
          ? t.skillStateWaiting
          : t.skillStateConditions,
  };
}

export function ContestSkills({
  view,
  t,
  send,
  onInspect,
  choosing = false,
  reduced = false,
}: {
  view: ContestView;
  t: Copy;
  send: (action: ContestInput) => boolean;
  onInspect: (player: PlayerId) => void;
  choosing?: boolean;
  reduced?: boolean;
}) {
  const ownInfo = useRef<HTMLButtonElement>(null);
  const skills = view.match?.round.skills;
  if (!skills) return null;
  const command = view.skillCommands[0];
  return (
    <>
      <section
        className="contest-skills"
        aria-label={t.skillArea}
        data-reduced={reduced}
      >
        {(["human", "ai"] as const).map((player) => {
          const own = player === "human",
            skill = skills[player],
            definition = SKILL_CATALOG[skill.id];
          const name = t[definition.nameKey],
            state = status(skill, view, own, t);
          const reason = choosing
            ? t.skillChoiceBlocked
            : view.paused
              ? t.contestPaused
              : view.busy
                ? t.contestReplaying
                : skill.disabled
                  ? t.skillLockHint
                  : skill.remainingUses === 0
                    ? t.skillStateExhausted
                    : skill.gameActivationsRemaining === 0
                      ? t.skillStateUsed
                      : view.match?.round.skillSeal &&
                          skill.id !== "endless-life"
                        ? t.skillStateSealed
                        : skill.id === "twin-bloom"
                          ? t.skillReactionHint
                          : t.skillConditionHint;
          const glyph =
            state.state === "locked" || state.state === "sealed" ? (
              <Icon name="lock" />
            ) : (
              <span aria-hidden="true">✦</span>
            );
          return (
            <section
              className="skill-card"
              key={player}
              data-player={player}
              data-state={state.state}
              aria-label={`${playerName(player, t)} · ${name}`}
            >
              {own ? (
                <button
                  type="button"
                  className="skill-orb"
                  aria-label={text(t.skillActivate, { name })}
                  aria-describedby={`skill-${player}-count skill-${player}-status`}
                  title={
                    command && !choosing
                      ? text(t.skillActivate, { name })
                      : reason
                  }
                  disabled={!command || view.busy || view.paused || choosing}
                  onClick={() => {
                    if (command) send(command);
                  }}
                >
                  {glyph}
                </button>
              ) : (
                <span
                  className="skill-orb"
                  role="img"
                  aria-label={`${name} · ${state.label}`}
                >
                  {glyph}
                </span>
              )}
              <button
                type="button"
                ref={own ? ownInfo : undefined}
                className="skill-name"
                aria-haspopup="dialog"
                aria-label={text(t.skillDetails, { name })}
                aria-describedby={`skill-${player}-count skill-${player}-status`}
                disabled={choosing}
                onClick={() => onInspect(player)}
              >
                <small className="skill-owner">{playerName(player, t)}</small>
                <strong>{name}</strong>
                <span className="skill-count" id={`skill-${player}-count`}>
                  {skill.remainingUses === null
                    ? text(t.skillUsesUnknown, {
                        min: skill.knownRemainingUses.min,
                        max: skill.knownRemainingUses.max,
                        initial: skill.initialUses,
                      })
                    : text(t.skillUses, {
                        remaining: skill.remainingUses,
                        initial: skill.initialUses,
                      })}
                </span>
                <span className="skill-state" id={`skill-${player}-status`}>
                  {state.label}
                  {skill.gameActivationsRemaining === 0 &&
                  state.label !== t.skillStateUsed
                    ? ` · ${t.skillStateUsed}`
                    : ""}
                </span>
              </button>
            </section>
          );
        })}
      </section>
      {view.reaction && (
        <aside className="skill-reaction" aria-label={t.skillReactionTitle}>
          <button
            type="button"
            className="secondary"
            disabled={choosing || view.busy || view.paused}
            onClick={() => {
              if (send(view.reaction!.pass)) ownInfo.current?.focus();
            }}
          >
            {t.skillPass}
          </button>
        </aside>
      )}
    </>
  );
}
