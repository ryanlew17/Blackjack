import { motion } from "motion/react";
import { rank, suit, type CardId } from "../../domain/game";
import type { Copy } from "../i18n";
export function Card({
  card,
  hidden,
  reduced,
  t,
}: {
  card: CardId;
  hidden?: boolean;
  reduced: boolean;
  t: Copy;
}) {
  const red = Math.floor(card / 13) % 2 === 1;
  return (
    <motion.div
      className="card-slot"
      layout
      initial={{ opacity: 0, y: reduced ? 0 : -28, rotate: reduced ? 0 : -7 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: reduced ? 0.08 : 0.22 }}
      role="img"
      aria-label={hidden ? t.hidden : `${rank(card)} ${suit(card)}`}
    >
      <motion.div
        className="card-flipper"
        animate={{ rotateY: hidden ? 180 : 0 }}
        transition={{ duration: reduced ? 0 : 0.3 }}
      >
        <div
          className={`playing-card card-front ${red ? "red" : ""}`}
          aria-hidden="true"
        >
          <span className="card-corner">
            {rank(card)}
            <small>{suit(card)}</small>
          </span>
          <svg className="card-suit" viewBox="0 0 100 110">
            <text
              x="50"
              y="80"
              textAnchor="middle"
              fontSize="80"
              fill="currentColor"
            >
              {suit(card)}
            </text>
          </svg>
          <span className="card-corner bottom">
            {rank(card)}
            <small>{suit(card)}</small>
          </span>
        </div>
        <div className="playing-card card-back" aria-hidden="true">
          <div className="back-border">
            <span>♠</span>
            <small>G R</small>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
