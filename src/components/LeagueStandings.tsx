import { ArrowUpRight, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { format, player } from "../lib/domain";
import type { DateRange } from "../lib/domain";
import type { Standing } from "../lib/statistics";

export function MonthWinner({ winners }: { winners: Standing[] }) {
  if (!winners.length) return null;
  return (
    <div className="month-winner" role="status">
      <span className="winner-emblem">
        <Trophy size={19} />
      </span>
      <div>
        <span>
          {winners.length > 1 ? "Delad månadsvinst" : "Månadsvinnare"}
        </span>
        <strong>{winners.map((row) => row.name).join(" och ")}</strong>
      </div>
      <span className="winner-points">
        {winners[0].points}
        <small>poäng</small>
      </span>
    </div>
  );
}

export function LeagueStandings({
  rows,
  range,
}: {
  rows: Standing[];
  range?: DateRange;
}) {
  const played = rows.some((row) => row.breaks > 0);
  const params = range
    ? `?period=custom&from=${range.from}&to=${range.to}`
    : "";
  return (
    <table className="league-table">
      <caption className="sr-only">
        Ligatabell. R: raster, V: vinster, O: oavgjorda, F: förluster, P: poäng,
        P/R: poäng per rast.
      </caption>
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Spelare</th>
          {Object.entries({
            R: "Spelade raster",
            V: "Vunna raster",
            O: "Oavgjorda raster",
            F: "Förlorade raster",
            P: "Ligapoäng",
            "P/R": "Poäng per rast",
          }).map(([label, title]) => (
            <th scope="col" key={label}>
              <abbr title={title}>{label}</abbr>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className={row.rank === 1 && played ? "leader" : ""}>
            <td className="rank">{row.rank}</td>
            <th scope="row">
              <Link to={`/statistik/spelare/${row.id}${params}`}>
                <span
                  className="player-dot"
                  aria-hidden="true"
                  style={{ background: player(row.id).color }}
                >
                  {row.name[0]}
                </span>
                {row.name}
                <ArrowUpRight size={14} />
              </Link>
            </th>
            <td>{row.breaks}</td>
            <td>{row.wins}</td>
            <td>{row.draws}</td>
            <td>{row.losses}</td>
            <td className="points">{row.points}</td>
            <td>{format(row.ppr)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
