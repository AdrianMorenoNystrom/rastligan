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
import { easeOut } from "../lib/motion";
import { StatisticsNumber, useStatisticsBuild } from "./StatisticsMotion";

const percentage = (value: number | null) =>
  value === null ? "–" : `${format(value, 1)} %`;
const tone = (id: PlayerId) =>
  ({ "--player-color": player(id).color }) as CSSProperties;

function Ring({
  value,
  radius,
  id,
  active,
  ready,
  motion,
  delay,
}: {
  value: number | null;
  radius: number;
  id: PlayerId;
  active: boolean;
  ready: boolean;
  motion: boolean;
  delay: number;
}) {
  const ref = useRef<SVGCircleElement>(null);
  const length = 2 * Math.PI * radius;
  const offset = length * (1 - (value ?? 0) / 100);
  const previous = useRef(length);
  useLayoutEffect(() => {
    if (!ready) return;
    const circle = ref.current!;
    const animation = motion
      ? circle.animate(
          [
            { strokeDashoffset: String(previous.current) },
            { strokeDashoffset: String(offset) },
          ],
          { duration: 900, delay, fill: "backwards", easing: easeOut },
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
  }, [offset, ready, motion, delay]);
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
        strokeDashoffset={ready ? offset : length}
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
  const { ref, ready, motion } = useStatisticsBuild<HTMLElement>();
  return (
    <section
      ref={ref}
      className="card stats-hero stats-build"
      data-built={ready || undefined}
      aria-label="Ligan i siffror"
    >
      <div className="stats-hero-copy">
        <span className="stats-eyebrow">
          {range.from || range.to ? "Vald period" : "Hela ligan"}
        </span>
        <h2>Ligan i siffror</h2>
        <div className="stats-big-number">
          <strong>
            <StatisticsNumber
              value={s.matchesPlayed}
              ready={ready}
              motion={motion}
              delay={60}
            />
          </strong>
          <span>spelade matcher</span>
        </div>
        <div className="stats-hero-totals">
          <div>
            <strong>
              <StatisticsNumber
                value={s.breaks}
                ready={ready}
                motion={motion}
                delay={120}
              />
            </strong>
            <span>raster</span>
          </div>
          <div>
            <strong>
              <StatisticsNumber
                value={s.days}
                ready={ready}
                motion={motion}
                delay={170}
              />
            </strong>
            <span>speldagar</span>
          </div>
          <div>
            <strong>
              <StatisticsNumber
                value={s.matchesPerBreak}
                digits={2}
                ready={ready}
                motion={motion}
                delay={220}
              />
            </strong>
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
                    ready={ready}
                    motion={motion}
                    delay={80 + index * 55}
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
              <strong>
                <StatisticsNumber
                  value={rate}
                  digits={1}
                  suffix=" %"
                  ready={ready}
                  motion={motion}
                  delay={120}
                />
              </strong>
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
            {PLAYERS.map((p, index) => {
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
                    <StatisticsNumber
                      value={
                        metric === "matches"
                          ? row.matchWinPercent
                          : row.breakWinPercent
                      }
                      digits={1}
                      suffix=" %"
                      ready={ready}
                      motion={motion}
                      delay={80 + index * 55}
                    />
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
  const rows = standings(selected);
  return (
    <section
      className="stats-player-grid"
      aria-label="Spelarnas resultat i urvalet"
    >
      {rows.map((row, index) => (
        <PlayerSnapshot key={row.id} row={row} index={index} />
      ))}
    </section>
  );
}

function PlayerSnapshot({ row, index }: { row: Standing; index: number }) {
  const [search] = useSearchParams();
  const { ref, ready, motion } = useStatisticsBuild<HTMLAnchorElement>();
  return (
    <Link
      ref={ref}
      data-built={ready || undefined}
      to={profilePath(row.id, search)}
      className="card stats-player-card stats-build"
      style={
        { ...tone(row.id), "--stats-delay": `${index * 65}ms` } as CSSProperties
      }
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
          <strong>
            <StatisticsNumber
              value={row.points}
              ready={ready}
              motion={motion}
              delay={index * 65}
            />
          </strong>
          <span>poäng</span>
        </div>
        <div>
          <strong>
            <StatisticsNumber
              value={row.ppr}
              digits={2}
              ready={ready}
              motion={motion}
              delay={index * 65 + 60}
            />
          </strong>
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
  const { ref, ready, motion } = useStatisticsBuild<HTMLElement>();
  return (
    <section
      ref={ref}
      data-built={ready || undefined}
      className="card stats-duel-preview stats-build"
      aria-label="Duellöversikt"
    >
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
          <strong>
            <StatisticsNumber
              value={left.matchesWon}
              ready={ready}
              motion={motion}
            />
          </strong>
        </div>
        <span>:</span>
        <div style={tone(b)}>
          <span>{player(b).name}</span>
          <strong>
            <StatisticsNumber
              value={right.matchesWon}
              ready={ready}
              motion={motion}
              delay={65}
            />
          </strong>
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
