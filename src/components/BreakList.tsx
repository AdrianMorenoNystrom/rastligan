import { Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import type { BreakSession } from "../lib/domain";
import { dateLabel, player } from "../lib/domain";
import { Empty } from "./ui";
export function BreakList({
  breaks,
  onEdit,
}: {
  breaks: BreakSession[];
  onEdit?: (m: BreakSession) => void;
}) {
  if (!breaks.length) return <Empty title="Inga raster i urvalet" />;
  return (
    <div className="match-list">
      {breaks.map((m) => (
        <article className="match-row" key={m.id}>
          <time dateTime={m.played_on}>{dateLabel(m.played_on)}</time>
          <div className="match-players">
            <Link to={`/statistik/spelare/${m.player1_id}`}>
              {player(m.player1_id).name}
            </Link>
            <span className="match-divider">–</span>
            <Link to={`/statistik/spelare/${m.player2_id}`}>
              {player(m.player2_id).name}
            </Link>
          </div>
          <strong className="match-score">
            <span className={m.score1 > m.score2 ? "winner" : ""}>
              {m.score1}
            </span>
            <span className="score-dash">:</span>
            <span className={m.score2 > m.score1 ? "winner" : ""}>
              {m.score2}
            </span>
          </strong>
          {onEdit && (
            <button
              className="icon-button"
              aria-label={`Redigera ${player(m.player1_id).name} mot ${player(m.player2_id).name} ${m.played_on}`}
              onClick={() => onEdit(m)}
            >
              <Pencil size={17} />
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
