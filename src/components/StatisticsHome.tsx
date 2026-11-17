import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, ArrowLeftRight, Trophy } from "lucide-react";
import {
  PLAYERS,
  PAIRS,
  dateLabel,
  isDate,
  format,
  player,
} from "../lib/domain";
import type { BreakSession, DateRange, PlayerId } from "../lib/domain";
import { standings, summary } from "../lib/statistics";
import type { Standing } from "../lib/statistics";
import { easeOut, reducedMotion } from "../lib/motion";

const percentage = (value: number | null) =>
  value === null ? "–" : `${format(value, 1)} %`;
const tone = (id: PlayerId) =>
  ({ "--player-color": player(id).color }) as CSSProperties;

function Ring({
  value,
  radius,
  id,
  active,
}: {
  value: number | null;
  radius: number;
  id: PlayerId;
  active: boolean;
}) {
  const ref = useRef<SVGCircleElement>(null);
  const length = 2 * Math.PI * radius;
  const offset = length * (1 - (value ?? 0) / 100);
  const previous = useRef(length);
  useLayoutEffect(() => {
    const circle = ref.current!;
    const animation = !reducedMotion()
      ? circle.animate(
          [
            { strokeDashoffset: String(previous.current) },
            { strokeDashoffset: String(offset) },
          ],
          { duration: 900, easing: easeOut },
        )
      : null;
    previous.current = offset;
    return () => {
      if (animation) {
        const displayed = parseFloat(getComputedStyle(circle).strokeDashoffset);
        if (Number.isFinite(displayed)) previous.current = displayed;
        animation.cancel();
      }
    };
  }, [offset]);
  return (
    <g className={`stats-ring ${active ? "is-active" : ""}`} style={tone(id)}>
      <circle className="stats-ring-track" cx="150" cy="150" r={radius} />
      <circle
        ref={ref}
        className="stats-ring-value"
        cx="150"
        cy="150"
        r={radius}
        strokeDasharray={`${length} ${length}`}
        strokeDashoffset={offset}
        transform="rotate(-90 150 150)"
      />
    </g>
  );
}

function profilePath(id: PlayerId, search: URLSearchParams) {
  return `/statistik/spelare/${id}${search.size ? `?${search}` : ""}`;
}

export function StatisticsHero({
  selected,
  range,
}: {
  selected: BreakSession[];
  range: DateRange;
}) {
  const s = summary(selected);
  const draws = selected.filter((rast) => rast.score1 === rast.score2).length;
  const rows = standings(selected);
  const [metric, setMetric] = useState<"matches" | "breaks">("matches");
  const [chosen, setChosen] = useState<PlayerId | null>(null);
  const active = rows.find((row) => row.id === chosen) || rows[0];
  const rate =
    metric === "matches" ? active.matchWinPercent : active.breakWinPercent;
  const won = metric === "matches" ? active.matchesWon : active.wins;
  const played = metric === "matches" ? active.matchesPlayed : active.breaks;
  const dates = selected.map((rast) => rast.played_on).sort();
  const from = range.from || dates[0];
  const to = range.to || dates.at(-1);
  return (
    <section className="card stats-hero" aria-label="Ligan i siffror">
      <div className="stats-hero-copy">
        <span className="stats-eyebrow">
          {range.from || range.to ? "Vald period" : "Hela ligan"}
        </span>
        <h2>Ligan i siffror</h2>
        <div className="stats-big-number">
          <strong>{s.matchesPlayed}</strong>
          <span>spelade matcher</span>
        </div>
        <div className="stats-hero-totals">
          <div>
            <strong>{s.breaks}</strong>
            <span>raster</span>
          </div>
          <div>
            <strong>{s.days}</strong>
            <span>speldagar</span>
          </div>
          <div>
            <strong>{format(s.matchesPerBreak)}</strong>
            <span>matcher / rast</span>
          </div>
        </div>
        <p className="stats-period-caption">
          {from && to && isDate(from) && isDate(to)
            ? `${dateLabel(from)} – ${dateLabel(to)}`
            : "Inga raster i urvalet"}
        </p>
        <p className="stats-draw-note">
          {draws} oavgjorda raster · {percentage(s.breakDrawPercent)}
        </p>
      </div>
      <div className="stats-hero-visual">
        <div className="stats-ring-heading">
          <h3>
            {metric === "matches" ? "Matchvinstprocent" : "Rastvinstprocent"}
          </h3>
          <div
            className="stats-measure-switch"
            role="group"
            aria-label="Vinstprocentens underlag"
          >
            <button
              aria-pressed={metric === "matches"}
              onClick={() => setMetric("matches")}
            >
              Matcher
            </button>
            <button
              aria-pressed={metric === "breaks"}
              onClick={() => setMetric("breaks")}
            >
              Raster
            </button>
          </div>
        </div>
        <div className="stats-ring-layout">
          <div className="stats-rings" style={tone(active.id)}>
            <svg viewBox="0 0 300 300" aria-hidden="true">
              <circle className="stats-orbit" cx="150" cy="150" r="144" />
              {PLAYERS.map((p, index) => {
                const row = rows.find((row) => row.id === p.id)!;
                return (
                  <Ring
                    key={p.id}
                    id={p.id}
                    radius={126 - index * 18}
                    value={
                      metric === "matches"
                        ? row.matchWinPercent
                        : row.breakWinPercent
                    }
                    active={p.id === active.id}
                  />
                );
              })}
            </svg>
            <div
              className="stats-ring-center"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <span>{active.name}</span>
              <strong>{percentage(rate)}</strong>
              <small>
                {played
                  ? `${won} av ${played} ${metric === "matches" ? "matcher" : "raster"} vunna`
                  : "Inget underlag"}
              </small>
            </div>
          </div>
          <div
            className="stats-ring-legend"
            aria-label="Välj spelare i ringdiagrammet"
          >
            {PLAYERS.map((p) => {
              const row = rows.find((row) => row.id === p.id)!;
              return (
                <button
                  key={p.id}
                  style={tone(p.id)}
                  aria-pressed={p.id === active.id}
                  onClick={() => setChosen(p.id)}
                >
                  <i />
                  <span>{p.name}</span>
                  <strong>
                    {percentage(
                      metric === "matches"
                        ? row.matchWinPercent
                        : row.breakWinPercent,
                    )}
                  </strong>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export function PlayerSnapshots({ selected }: { selected: BreakSession[] }) {
  const [search] = useSearchParams();
  const rows = standings(selected);
  return (
    <section
      className="stats-player-grid"
      aria-label="Spelarnas resultat i urvalet"
    >
      {rows.map((row) => (
        <Link
          key={row.id}
          to={profilePath(row.id, search)}
          className="card stats-player-card"
          style={tone(row.id)}
        >
          <div className="stats-player-top">
            <span className="stats-player-avatar" aria-hidden="true">
              {row.name[0]}
            </span>
            <h3>{row.name}</h3>
            <span className="stats-player-rank">
              {row.breaks > 0 ? `#${row.rank}` : "–"}
            </span>
            <ArrowUpRight size={16} />
          </div>
          <div className="stats-player-numbers">
            <div>
              <strong>{row.points}</strong>
              <span>poäng</span>
            </div>
            <div>
              <strong>{format(row.ppr)}</strong>
              <span>P/R</span>
            </div>
          </div>
          <OutcomeBar row={row} />
          <div className="stats-player-outcomes">
            <span>
              <b>{row.wins}</b> <abbr title="Vunna raster">V</abbr>
            </span>
            <span>
              <b>{row.draws}</b> <abbr title="Oavgjorda raster">O</abbr>
            </span>
            <span>
              <b>{row.losses}</b> <abbr title="Förlorade raster">F</abbr>
            </span>
            <small>{row.breaks} raster</small>
          </div>
        </Link>
      ))}
    </section>
  );
}

function OutcomeBar({ row }: { row: Standing }) {
  return (
    <div
      className="stats-outcome-bar"
      aria-label={`${row.wins} vunna, ${row.draws} oavgjorda och ${row.losses} förlorade raster`}
    >
      {row.breaks > 0 && (
        <>
          <span
            className="is-win"
            style={{ width: `${(row.wins / row.breaks) * 100}%` }}
          />
          <span
            className="is-draw"
            style={{ width: `${(row.draws / row.breaks) * 100}%` }}
          />
          <span
            className="is-loss"
            style={{ width: `${(row.losses / row.breaks) * 100}%` }}
          />
        </>
      )}
    </div>
  );
}

export function DuelSnapshot({ selected }: { selected: BreakSession[] }) {
  const [search] = useSearchParams();
  const [pairKey, setPairKey] = useState("adrian-dave");
  const [a, b] = PAIRS.find(([p, q]) => `${p}-${q}` === pairKey)!;
  const data = selected.filter(
    (rast) => rast.player1_id === a && rast.player2_id === b,
  );
  const rows = standings(data);
  const left = rows.find((row) => row.id === a)!;
  const right = rows.find((row) => row.id === b)!;
  const total = left.matchesWon + right.matchesWon;
  return (
    <section className="card stats-duel-preview" aria-label="Duellöversikt">
      <div className="stats-panel-heading">
        <div>
          <span className="stats-eyebrow">Inbördes möten</span>
          <h2>Dueller</h2>
        </div>
        <ArrowLeftRight size={20} />
      </div>
      <label className="sr-only" htmlFor="overview-duel">
        Spelarpar i översikten
      </label>
      <select
        id="overview-duel"
        value={pairKey}
        onChange={(e) => setPairKey(e.target.value)}
      >
        {PAIRS.map(([p, q]) => (
          <option key={`${p}-${q}`} value={`${p}-${q}`}>
            {player(p).name} – {player(q).name}
          </option>
        ))}
      </select>
      <div className="stats-duel-score">
        <div style={tone(a)}>
          <span>{player(a).name}</span>
          <strong>{left.matchesWon}</strong>
        </div>
        <span>:</span>
        <div style={tone(b)}>
          <span>{player(b).name}</span>
          <strong>{right.matchesWon}</strong>
        </div>
      </div>
      <p className="stats-duel-score-label">Vunna individuella matcher</p>
      <div
        className="stats-duel-balance"
        aria-label={`${player(a).name} ${left.matchesWon}, ${player(b).name} ${right.matchesWon} matchvinster`}
      >
        <span
          style={{
            width: `${total ? (left.matchesWon / total) * 100 : 50}%`,
            background: total ? player(a).color : "var(--line)",
          }}
        />
        <span
          style={{
            width: `${total ? (right.matchesWon / total) * 100 : 50}%`,
            background: total ? player(b).color : "var(--line)",
          }}
        />
      </div>
      <div className="stats-duel-breaks">
        <Trophy size={14} />
        <span>
          {left.wins}–{right.wins} i rastvinster
        </span>
        <span>{left.draws} oavgjorda</span>
      </div>
      <Link
        to={`/statistik/dueller/${a}-${b}${search.size ? `?${search}` : ""}`}
        className="text-link stats-duel-link"
      >
        {data.length} raster · Visa duellen
        <ArrowUpRight size={16} />
      </Link>
    </section>
  );
}
