// @req REQ-2026-026: choose among complete application commands, never invent targets/costs.
import { useRef, useState } from "react";
import type { ContestTrumpAction } from "../../../application/contest/types";
import type {
  MatchObservation,
  TrumpInstance,
} from "../../../domain/contest/engine";
import type { Copy } from "../../i18n";
import { Modal } from "../../shared/Modal";
import {
  selectedCommand,
  targetLabel,
  text,
  trumpDescription,
  trumpName,
} from "./trumpView";

export function TrumpChooser({
  instance,
  commands,
  match,
  t,
  close,
  send,
  unavailableReason,
}: {
  instance: TrumpInstance;
  commands: readonly ContestTrumpAction[];
  match: MatchObservation;
  t: Copy;
  close: () => void;
  unavailableReason?: string;
  send: (action: ContestTrumpAction) => boolean;
}) {
  const values = (field: "targetId" | "ownTargetId" | "definitionId") => [
    ...new Set(commands.flatMap((c) => (c[field] ? [c[field]!] : []))),
  ];
  const targets = values("targetId"),
    ownTargets = values("ownTargetId"),
    definitions = values("definitionId");
  const costs = [...new Set(commands.flatMap((c) => c.costIds ?? []))];
  const required = commands[0]?.costIds?.length ?? 0;
  const [targetId, setTarget] = useState(
    targets.length === 1 ? targets[0] : "",
  );
  const [ownTargetId, setOwnTarget] = useState(
    ownTargets.length === 1 ? ownTargets[0] : "",
  );
  const [definitionId, setDefinition] = useState(
    definitions.length === 1 ? definitions[0] : "",
  );
  const [costIds, setCosts] = useState<readonly string[]>(
    costs.length === required ? costs : [],
  );
  const submitted = useRef(false);
  const command = selectedCommand(commands, {
    targetId,
    ownTargetId,
    definitionId,
    costIds,
  });
  const radios = (
    ids: string[],
    title: string,
    value: string,
    change: (id: string) => void,
    name: string,
  ) =>
    ids.length > 0 && (
      <fieldset className="trump-choices">
        <legend>{title}</legend>
        {ids.map((id) => (
          <label key={id}>
            <input
              type="radio"
              name={name}
              value={id}
              checked={value === id}
              onChange={() => change(id)}
            />
            <span>{targetLabel(id, match, t)}</span>
          </label>
        ))}
      </fieldset>
    );
  return (
    <Modal
      title={trumpName(instance.definitionId, t)}
      close={close}
      closeLabel={t.close}
    >
      <form
        className="trump-chooser"
        onSubmit={(event) => {
          event.preventDefault();
          if (!command || submitted.current) return;
          submitted.current = true;
          send(command);
          close();
        }}
      >
        <p className="modal-intro">
          {trumpDescription(instance.definitionId, t)}
        </p>
        <p className="small-note">
          {commands.length
            ? t.trumpUseHint
            : (unavailableReason ?? t.trumpUnavailable)}
        </p>
        {radios(
          ownTargets,
          t.trumpOwnTarget,
          ownTargetId,
          setOwnTarget,
          "own-target",
        )}
        {radios(targets, t.trumpTarget, targetId, setTarget, "target")}
        {definitions.length > 0 && (
          <label className="trump-declaration">
            <span>{t.trumpDeclaration}</span>
            <select
              value={definitionId}
              onChange={(e) => setDefinition(e.target.value)}
            >
              <option value="">{t.trumpChoose}</option>
              {definitions.map((id) => (
                <option key={id} value={id}>
                  {trumpName(id, t)}
                </option>
              ))}
            </select>
            <small>{t.trumpDeclarationHint}</small>
          </label>
        )}
        {costs.length > 0 && (
          <fieldset className="trump-choices">
            <legend>
              {text(t.trumpCost, { count: required, selected: costIds.length })}
            </legend>
            <p className="small-note">{t.trumpCostHint}</p>
            {costs.map((id) => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={costIds.includes(id)}
                  onChange={() =>
                    setCosts((current) =>
                      current.includes(id)
                        ? current.filter((c) => c !== id)
                        : [...current, id],
                    )
                  }
                />
                <span>
                  {trumpName(
                    match.round.trumps!.ownHand.find(
                      (c) => c.instanceId === id,
                    )!.definitionId,
                    t,
                  )}
                </span>
              </label>
            ))}
          </fieldset>
        )}
        <div className="trump-dialog-actions">
          <button type="button" className="secondary" onClick={close}>
            {t.cancel}
          </button>
          <button type="submit" className="primary" disabled={!command}>
            {t.trumpUse}
          </button>
        </div>
      </form>
    </Modal>
  );
}
