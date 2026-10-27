import { Link } from "react-router-dom";
import { Plus, ArrowUpRight } from "lucide-react";
import { useMatches } from "../components/providers";
import { standings } from "../lib/statistics";
import { format, newest, player, today } from "../lib/domain";
import { PageHeading, SectionHeading } from "../components/ui";
import { MatchList } from "../components/MatchList";
export default function League() {
  const matches = useMatches().data || [];
  const rows = standings(matches);
  return (
    <>
      <PageHeading eyebrow="Adrian · Dave · Elias" title="Ligan">
        <span className="small-label">3 poäng för vinst · 1 för oavgjort</span>
      </PageHeading>
      <section className="card league-card">
        <div className="league-card-heading">
          <h2>Ligatabellen</h2>
          <span className="tag">Alla matcher</span>
        </div>
        <table className="league-table">
          <caption className="sr-only">
            Ligatabell. M: matcher, V: vinster, O: oavgjorda, F: förluster, P:
            poäng, P/M: poäng per match.
          </caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Spelare</th>
              {["M", "V", "O", "F", "P", "P/M"].map((h) => (
                <th scope="col" key={h}>
                  <abbr
                    title={
                      {
                        M: "Matcher",
                        V: "Vinster",
                        O: "Oavgjorda",
                        F: "Förluster",
                        P: "Poäng",
                        "P/M": "Poäng per match",
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
                className={r.rank === 1 && matches.length ? "leader" : ""}
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
                <td>{r.matches}</td>
                <td>{r.wins}</td>
                <td>{r.draws}</td>
                <td>{r.losses}</td>
                <td className="points">{r.points}</td>
                <td>{format(r.ppm)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="table-note">
          Placering efter poäng, setskillnad och vunna set. Lika värden ger
          delad plats.
        </p>
      </section>
      <Link to="/registrera" className="button primary register-cta">
        <span>
          <Plus size={23} />
          Registrera match
        </span>
        <ArrowUpRight size={22} />
      </Link>
      <section className="card recent-card">
        <SectionHeading
          title="Senaste matcher"
          to="/matcher"
          link="Alla matcher"
        />
        <MatchList matches={[...matches].sort(newest).slice(0, 3)} />
        <p className="fine-print list-note">
          Matcher samma datum visas utan inbördes spelordning.
        </p>
      </section>
      <div className="league-summary">
        <div>
          <strong>{matches.length}</strong>
          <span>matcher totalt</span>
        </div>
        <div>
          <strong>
            {
              matches.filter((m) => m.played_on.startsWith(today().slice(0, 7)))
                .length
            }
          </strong>
          <span>den här månaden</span>
        </div>
        <Link to="/statistik">
          Utforska statistiken
          <ArrowUpRight size={17} />
        </Link>
      </div>
    </>
  );
}
