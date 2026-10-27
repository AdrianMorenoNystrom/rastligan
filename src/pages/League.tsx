import { Link } from "react-router-dom";
import { Plus, ArrowUpRight } from "lucide-react";
import { useBreaks } from "../components/providers";
import { standings } from "../lib/statistics";
import { format, newest, player, today } from "../lib/domain";
import { PageHeading, SectionHeading } from "../components/ui";
import { BreakList } from "../components/BreakList";
export default function League() {
  const breaks = useBreaks().data || [];
  const rows = standings(breaks);
  return (
    <>
      <PageHeading title="Ligan" />
      <section className="card league-card">
        <div className="league-card-heading">
          <h2>Ligatabellen</h2>
          <span className="tag">Alla raster</span>
        </div>
        <table className="league-table">
          <caption className="sr-only">
            Ligatabell. R: raster, V: vinster, O: oavgjorda, F: förluster, P:
            poäng, P/R: poäng per rast.
          </caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Spelare</th>
              {["R", "V", "O", "F", "P", "P/R"].map((h) => (
                <th scope="col" key={h}>
                  <abbr
                    title={
                      {
                        R: "Spelade raster",
                        V: "Vunna raster",
                        O: "Oavgjorda raster",
                        F: "Förlorade raster",
                        P: "Ligapoäng",
                        "P/R": "Poäng per rast",
                      }[h]
                    }
                  >
                    {h}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={r.rank === 1 && breaks.length ? "leader" : ""}
              >
                <td className="rank">{r.rank}</td>
                <th scope="row">
                  <Link to={`/statistik/spelare/${r.id}`}>
                    <span
                      className="player-dot"
                      style={{ background: player(r.id).color }}
                    />
                    {r.name}
                    <ArrowUpRight size={14} />
                  </Link>
                </th>
                <td>{r.breaks}</td>
                <td>{r.wins}</td>
                <td>{r.draws}</td>
                <td>{r.losses}</td>
                <td className="points">{r.points}</td>
                <td>{format(r.ppr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="table-note">
          P/R = poäng per rast. Placering efter poäng, matchskillnad och vunna
          matcher. Lika värden ger delad plats.
        </p>
      </section>
      <Link to="/registrera" className="button primary register-cta">
        <span>
          <Plus size={23} />
          Registrera rast
        </span>
        <ArrowUpRight size={22} />
      </Link>
      <section className="card recent-card">
        <SectionHeading
          title="Senaste raster"
          to="/raster"
          link="Alla raster"
        />
        <BreakList breaks={[...breaks].sort(newest).slice(0, 3)} />
      </section>
      <div className="league-summary">
        <div>
          <strong>{breaks.length}</strong>
          <span>raster totalt</span>
        </div>
        <div>
          <strong>
            {
              breaks.filter((m) => m.played_on.startsWith(today().slice(0, 7)))
                .length
            }
          </strong>
          <span>den här månaden</span>
        </div>
        <Link to="/statistik">
          Statistik
          <ArrowUpRight size={17} />
        </Link>
      </div>
    </>
  );
}
