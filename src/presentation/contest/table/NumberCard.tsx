// @req REQ-2026-018: hidden cards have no value in markup or accessible names.
import { motion } from "motion/react";
import type { NumberCardView } from "../../../domain/contest/engine";
import type { Copy } from "../../i18n";

export function NumberCard({
  card,
  reduced,
  t,
}: {
  card: NumberCardView;
  reduced: boolean;
  t: Copy;
}) {
  const hidden = card.value === null;
  return (
    <motion.div
      className={`number-card${hidden ? " number-card-back" : ""}${card.faceDown && !hidden ? " number-card-private" : ""}`}
      role="img"
      aria-label={
        hidden
          ? t.hidden
          : `${t.numberCard} ${card.value}${card.faceDown ? ` · ${t.privateCard}` : ""}`
      }
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.18 }}
    >
      <div aria-hidden="true">
        {hidden ? (
          <span className="number-back-mark">?</span>
        ) : (
          <>
            <small className="number-corner">{card.value}</small>
            <strong>{card.value}</strong>
            {card.faceDown && (
              <span className="private-mark">{t.privateCard}</span>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
