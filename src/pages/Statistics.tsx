import { lazy, Suspense, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CalendarDays, ArrowUpRight, ChevronDown, Info } from "lucide-react";
import { useBreaks } from "../components/providers";
import { PageHeading, Metrics, Empty, ErrorText } from "../components/ui";
import {
  PLAYERS,
  PAIRS,
  player,
  format,
  within,
  today,
  dayAdd,
  WEEKDAYS,
  weekday,
  isPlayer,
} from "../lib/domain";
import type { DateRange, BreakSession, PlayerId } from "../lib/domain";
import {
  standings,
  summary,
  performance,
  cumulative,
  resolutionFor,
  resultPatterns,
  weekdayPerformance,
  compareThirtyDays,
  records,
} from "../lib/statistics";
import type {
  Resolution,
  RecordGroup,
  PerformanceMetric,
} from "../lib/statistics";
const Chart = lazy(() => import("../components/Charts"));
const tabs = [
  ["oversikt", "Översikt"],
  ["spelare", "Spelare"],
  ["dueller", "Dueller"],
  ["rekord", "Rekord"],
];
const fmtPercent = (n: number | null) =>
  n === null ? "–" : `${format(n, 1)} %`;
function DateFilter({
  value,
  range,
  onChange,
}: {
  value: string;
  range: DateRange;
  onChange: (v: string, r: DateRange) => void;
}) {
  return (
    <section className="card date-filter" aria-label="Statistikens datumfilter">
      <div className="filter-title">
        <CalendarDays size={18} />
        <span>Period</span>
      </div>
      <div className="period-options">
        {[
          ["all", "Totalt"],
          ["7", "7 dagar"],
          ["30", "30 dagar"],
          ["90", "90 dagar"],
          ["custom", "Eget intervall"],
        ].map(([v, label]) => (
          <button
            key={v}
            aria-pressed={value === v}
            className={value === v ? "selected" : ""}
            onClick={() =>
              onChange(
                v,
                v === "all" || v === "custom"
                  ? {}
                  : { from: dayAdd(today(), 1 - Number(v)), to: today() },
              )
            }
          >
            {label}
          </button>
        ))}
      </div>
      {value === "custom" && (
        <div className="custom-range">
          <label>
            Från
            <input
              type="date"
              value={range.from || ""}
              onChange={(e) =>
                onChange(value, { ...range, from: e.target.value })
              }
            />
          </label>
          <label>
            Till
            <input
              type="date"
              value={range.to || ""}
              onChange={(e) =>
                onChange(value, { ...range, to: e.target.value })
              }
            />
          </label>
        </div>
      )}
    </section>
  );
}
function Overview({
  all,
  selected,
  range,
}: {
  all: BreakSession[];
  selected: BreakSession[];
  range: DateRange;
}) {
  const s = summary(selected);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const res = resolution || resolutionFor(all, range);
  const [activityMetric, setActivityMetric] = useState<"breaks" | "matches">(
    "breaks",
  );
  return (
    <>
      <Metrics
        items={[
          { label: "Raster", value: s.breaks },
          { label: "Spelade matcher", value: s.matchesPlayed },
          {
            label: "Oavgjorda raster",
            value: fmtPercent(s.breakDrawPercent),
            hint: `${s.breaks} raster`,
          },
          {
            label: "Matcher per rast",
            value: format(s.matchesPerBreak),
            hint: `${s.breaks} raster`,
          },
          {
            label: "Aktiva speldagar",
            value: s.days,
          },
        ]}
      />
      <div className="resolution-bar">
        <span>Gruppera efter</span>
        <select
          aria-label="Diagrammens upplösning"
          value={resolution || "auto"}
          onChange={(e) =>
            setResolution(
              e.target.value === "auto" ? null : (e.target.value as Resolution),
            )
          }
        >
          <option value="auto">Automatiskt</option>
          <option value="day">Dag</option>
          <option value="week">Vecka</option>
          <option value="month">Månad</option>
        </select>
      </div>
      <Chart
        title="Poäng per rast över tid"
        description="P/R = poäng per rast i perioden. Luckor visar perioder utan raster."
        data={performance(all, range, res)}
        max={3}
      />
      <div className="chart-grid">
        <Chart
          title={
            activityMetric === "breaks" ? "Rastaktivitet" : "Matchaktivitet"
          }
          description={`${activityMetric === "breaks" ? "Raster" : "Individuella matcher"} per ${res === "day" ? "dag" : res === "week" ? "vecka" : "månad"}.`}
          data={performance(all, range, res)}
          activity
          activityMetric={activityMetric}
          controls={
            <label className="activity-selector">
              Aktivitet
              <select
                aria-label="Aktivitetsmått"
                value={activityMetric}
                onChange={(e) =>
                  setActivityMetric(e.target.value as "breaks" | "matches")
                }
              >
                <option value="breaks">Raster</option>
                <option value="matches">Individuella matcher</option>
              </select>
            </label>
          }
        />
        <Chart
          title="Ligapoäng över tid"
          description="Totalpoäng vid dagens slut, inklusive poäng före vald period."
          data={cumulative(all, range)}
          step
          unit="poäng"
        />
      </div>
      <ActivityCalendar breaks={selected} />
    </>
  );
}
function ActivityCalendar({ breaks }: { breaks: BreakSession[] }) {
  const dates = breaks.map((m) => m.played_on).sort();
  const [start, setStart] = useState("");
  const month = start || dates.at(-1)?.slice(0, 7) || today().slice(0, 7);
  const first = month + "-01";
  const next = new Date(first + "T12:00:00Z");
  next.setUTCMonth(next.getUTCMonth() + 1);
  const days = Number(dayAdd(next.toISOString().slice(0, 10), -1).slice(-2));
  const counts = new Map<string, number>();
  breaks.forEach((m) =>
    counts.set(m.played_on, (counts.get(m.played_on) || 0) + 1),
  );
  const [chosen, setChosen] = useState("");
  return (
    <section className="card activity-calendar">
      <div className="section-heading">
        <div>
          <h2>Speldagar</h2>
        </div>
        <label className="sr-only" htmlFor="activity-month">
          Kalendermånad
        </label>
        <input
          id="activity-month"
          type="month"
          value={month}
          onChange={(e) => {
            setStart(e.target.value);
            setChosen("");
          }}
        />
      </div>
      <div className="calendar-grid">
        {WEEKDAYS.map((d) => (
          <span className="calendar-weekday" key={d}>
            {d.slice(0, 3)}
          </span>
        ))}
        {Array.from({ length: weekday(first) }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = month + "-" + String(i + 1).padStart(2, "0");
          const n = counts.get(date) || 0;
          return (
            <button
              key={date}
              className={n ? "active-day" : ""}
              style={
                n
                  ? {
                      background: `rgb(190 242 109 / ${Math.min(0.85, 0.18 + n * 0.1)})`,
                    }
                  : undefined
              }
              aria-label={`${date}: ${n} raster`}
              aria-pressed={chosen === date}
              onClick={() => setChosen(date)}
            >
              {i + 1}
              {n > 0 && <small>{n}</small>}
            </button>
          );
        })}
      </div>
      <p className="fine-print calendar-detail" role="status">
        {chosen
          ? `${chosen}: ${counts.get(chosen) || 0} raster i urvalet.`
          : "Välj dag för antal raster."}
      </p>
    </section>
  );
}
function Profile({
  all,
  selected,
  range,
  id,
}: {
  all: BreakSession[];
  selected: BreakSession[];
  range: DateRange;
  id: PlayerId;
}) {
  const s = standings(selected).find((s) => s.id === id)!;
  const [resolution, setResolution] = useState<Resolution>("week");
  const [metric, setMetric] = useState<PerformanceMetric>("ppr");
  const metricLabels: Record<PerformanceMetric, string> = {
    ppr: "Poäng per rast",
    breakWinPercent: "Rastvinstprocent",
    matchWinPercent: "Matchvinstprocent",
    matchDifferencePerBreak: "Matchskillnad per rast",
    matchesWonPerBreak: "Vunna matcher per rast",
  };
  const patterns = resultPatterns(selected, id);
  const weekdays = weekdayPerformance(selected, id);
  const comparison = compareThirtyDays(all, id, today(), range);
  return (
    <>
      <div className="player-selector" aria-label="Välj spelare">
        {PLAYERS.map((p) => (
          <Link
            key={p.id}
            className={id === p.id ? "selected" : ""}
            to={`/statistik/spelare/${p.id}${window.location.hash.includes("?") ? "?" + window.location.hash.split("?")[1] : ""}`}
          >
            <i style={{ background: p.color }} />
            {p.name}
            <ArrowUpRight size={15} />
          </Link>
        ))}
      </div>
      <div className="profile-heading">
        <span className="player-initial" style={{ color: player(id).color }}>
          {player(id).name[0]}
        </span>
        <div>
          <h2>{player(id).name}</h2>
        </div>
        {s.breaks > 0 && s.breaks < 5 && (
          <span className="tag warning">Litet underlag</span>
        )}
      </div>
      <Metrics
        items={[
          { label: "Raster", value: s.breaks },
          { label: "Ligapoäng", value: s.points },
          { label: "P/R", value: format(s.ppr), hint: `${s.breaks} raster` },
          {
            label: "Rastvinstprocent",
            value: fmtPercent(s.breakWinPercent),
            hint: `${s.breaks} raster`,
          },
        ]}
      />
      <div className="two-column">
        <section className="card">
          <h2>Raster</h2>
          <dl className="stat-list">
            {[
              ["Vunna raster", s.wins],
              ["Oavgjorda raster", s.draws],
              ["Förlorade raster", s.losses],
              ["Rastvinstprocent", fmtPercent(s.breakWinPercent)],
              ["Oavgjortandel", fmtPercent(s.breakDrawPercent)],
              ["Förlustprocent", fmtPercent(s.breakLossPercent)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div
            className="outcome-bar"
            aria-label={`${s.wins} vinster, ${s.draws} oavgjorda, ${s.losses} förluster`}
          >
            {s.breaks > 0 && (
              <>
                <span
                  style={{
                    width: `${(s.wins / s.breaks) * 100}%`,
                    background: "#bef26d",
                  }}
                />
                <span
                  style={{
                    width: `${(s.draws / s.breaks) * 100}%`,
                    background: "#a5b7c9",
                  }}
                />
                <span
                  style={{
                    width: `${(s.losses / s.breaks) * 100}%`,
                    background: "#d4a1ff",
                  }}
                />
              </>
            )}
          </div>
          <p className="fine-print">Fördelning V / O / F · {s.breaks} raster</p>
        </section>
        <section className="card">
          <h2>Matcher</h2>
          <dl className="stat-list">
            {[
              ["Spelade matcher", s.matchesPlayed],
              ["Matchvinstprocent", fmtPercent(s.matchWinPercent)],
              [
                "Vunna / förlorade matcher",
                `${s.matchesWon} / ${s.matchesLost}`,
              ],
              ["Matchskillnad", s.matchDifference],
              ["Matchskillnad / rast", format(s.matchDifferencePerBreak)],
              ["Vunna matcher / rast", format(s.matchesWonPerBreak)],
              ["Förlorade matcher / rast", format(s.matchesLostPerBreak)],
              ["Matcher / rast", format(s.matchesPerBreak)],
              [
                "Marginal vid vinst",
                `${format(s.winMargin)} (${s.wins} vinster)`,
              ],
              [
                "Marginal vid förlust",
                `${format(s.lossMargin)} (${s.losses} förluster)`,
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
      <div className="resolution-bar">
        <label>
          Mått
          <select
            aria-label="Spelarens utvecklingsmått"
            value={metric}
            onChange={(e) => setMetric(e.target.value as PerformanceMetric)}
          >
            {Object.entries(metricLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Period
          <select
            aria-label="Spelarens utvecklingsperiod"
            value={resolution}
            onChange={(e) => setResolution(e.target.value as Resolution)}
          >
            <option value="week">Vecka</option>
            <option value="month">Månad</option>
          </select>
        </label>
      </div>
      <Chart
        title="Utveckling"
        description={`${metricLabels[metric]}, ${resolution === "week" ? "veckovis" : "månadsvis"}.`}
        data={performance(all, range, resolution, metric)}
        players={[id]}
        unit={
          metric === "ppr"
            ? "P/R"
            : metric.endsWith("Percent")
              ? "%"
              : "matcher/rast"
        }
        max={
          metric === "ppr" ? 3 : metric.endsWith("Percent") ? 100 : undefined
        }
        matchSample={metric === "matchWinPercent"}
      />
      <section className="card">
        <h2>Senaste 30 kalenderdagarna</h2>
        <p className="muted">
          {dayAdd(today(), -29)} – {today()}, jämfört med {dayAdd(today(), -59)}{" "}
          – {dayAdd(today(), -30)}. Datumfiltret gäller båda perioderna.
        </p>
        <Metrics
          items={[
            {
              label: "P/R senaste 30",
              value: format(comparison.current.ppr),
              hint: `${comparison.current.breaks} raster`,
            },
            {
              label: "P/R föregående 30",
              value: format(comparison.previous.ppr),
              hint: `${comparison.previous.breaks} raster`,
            },
            {
              label: "Förändring i P/R",
              value:
                comparison.delta === null
                  ? "–"
                  : `${comparison.delta > 0 ? "+" : ""}${format(comparison.delta)}`,
              hint:
                comparison.delta === null
                  ? "Inget jämförelseunderlag"
                  : undefined,
            },
          ]}
        />
      </section>
      <div className="two-column">
        <section className="card">
          <h2>Resultatmönster</h2>
          <dl className="stat-list">
            <div>
              <dt>Raster med en matchs marginal</dt>
              <dd>{fmtPercent(s.closePercent)}</dd>
            </div>
            <div>
              <dt>Genomsnittlig matchmarginal</dt>
              <dd>{format(s.margin)}</dd>
            </div>
          </dl>
          <p className="fine-print">
            Marginal anges utan minustecken. Underlag: {s.breaks} raster.
          </p>
          <h3>Vanligaste slutresultat</h3>
          <p className="fine-print">
            {player(id).name}s matchvinster visas först.
          </p>
          {patterns.length ? (
            <ol className="pattern-list">
              {patterns.slice(0, 8).map((r) => (
                <li key={r.label}>
                  <strong>{r.label}</strong>
                  <span>{r.count} raster</span>
                </li>
              ))}
            </ol>
          ) : (
            <Empty title="Inga resultat i urvalet" />
          )}
        </section>
        <section className="card">
          <h2>Prestation per veckodag</h2>
          <table className="compact-table">
            <thead>
              <tr>
                <th>Dag</th>
                <th>R</th>
                <th>P/R</th>
                <th>Rastvinst %</th>
              </tr>
            </thead>
            <tbody>
              {weekdays.map((d) => (
                <tr key={d.label}>
                  <th>{d.label}</th>
                  <td>{d.breaks}</td>
                  <td>{format(d.ppr)}</td>
                  <td>{format(d.breakWinPercent, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="fine-print">
            R = raster. Färre än 5 raster ger litet underlag.
          </p>
        </section>
      </div>
    </>
  );
}
function Duel({
  all,
  selected,
  range,
  pairKey,
}: {
  all: BreakSession[];
  selected: BreakSession[];
  range: DateRange;
  pairKey: string;
}) {
  const pair = PAIRS.find(([a, b]) => `${a}-${b}` === pairKey) || PAIRS[0];
  const [a, b] = pair;
  const allPair = all.filter((m) => m.player1_id === a && m.player2_id === b);
  const data = selected.filter((m) => m.player1_id === a && m.player2_id === b);
  const rows = standings(data);
  const left = rows.find((s) => s.id === a)!,
    right = rows.find((s) => s.id === b)!;
  const patterns = resultPatterns(data, a);
  return (
    <>
      <div className="duel-selector">
        {PAIRS.map(([p, q]) => (
          <Link
            className={p === a && q === b ? "selected" : ""}
            key={p + q}
            to={`/statistik/dueller/${p}-${q}${window.location.hash.includes("?") ? "?" + window.location.hash.split("?")[1] : ""}`}
          >
            {player(p).name}
            <span>mot</span>
            {player(q).name}
          </Link>
        ))}
      </div>
      <section className="card duel-card">
        <div className="duel-heading">
          <h2 style={{ color: player(a).color }}>{player(a).name}</h2>
          <div>
            <strong>{data.length}</strong>
            <span>inbördes raster</span>
          </div>
          <h2 style={{ color: player(b).color }}>{player(b).name}</h2>
        </div>
        <table className="duel-table">
          <thead className="sr-only">
            <tr>
              <th>{player(a).name}</th>
              <th>Mått</th>
              <th>{player(b).name}</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Vunna raster", left.wins, right.wins],
              ["Oavgjorda raster", left.draws, right.draws],
              [
                "Rastvinstprocent",
                fmtPercent(left.breakWinPercent),
                fmtPercent(right.breakWinPercent),
              ],
              ["Poäng / rast", format(left.ppr), format(right.ppr)],
              ["Vunna matcher", left.matchesWon, right.matchesWon],
              [
                "Matchvinstprocent",
                fmtPercent(left.matchWinPercent),
                fmtPercent(right.matchWinPercent),
              ],
              ["Spelade matcher", left.matchesPlayed, right.matchesPlayed],
              [
                "Matchskillnad / rast",
                format(left.matchDifferencePerBreak),
                format(right.matchDifferencePerBreak),
              ],
            ].map(([label, v1, v2]) => (
              <tr key={label}>
                <td>{v1}</td>
                <th>{label}</th>
                <td>{v2}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="fine-print centered">
          Underlag: {data.length} raster per spelare.
          {data.length > 0 && data.length < 5 ? " Litet underlag." : ""}
        </p>
      </section>
      <div className="chart-grid">
        <Chart
          title="Ligapoäng inom duellen"
          description="Inbördes totalpoäng vid dagens slut."
          data={cumulative(allPair, range)}
          step
          players={pair}
          unit="poäng"
        />
        <Chart
          title="Månadsvis prestation"
          description="Poäng per rast och månad."
          data={performance(allPair, range, "month")}
          players={pair}
          max={3}
        />
      </div>
      <section className="card">
        <h2>Vanligaste slutresultat</h2>
        <p className="muted">
          {player(a).name}s matchvinster först. Underlag: {data.length} raster.
        </p>
        {patterns.length ? (
          <ol className="pattern-list">
            {patterns.map((r) => (
              <li key={r.label}>
                <strong>{r.label}</strong>
                <span>{r.count} raster</span>
              </li>
            ))}
          </ol>
        ) : (
          <Empty title="Inga raster i urvalet" />
        )}
      </section>
    </>
  );
}
function RecordCard({ group }: { group: RecordGroup }) {
  const [expanded, setExpanded] = useState(false);
  const entries = expanded ? group.entries : group.entries.slice(0, 5);
  return (
    <section className="card record-card">
      <div className="record-heading">
        <h2>{group.title}</h2>
        {group.performance && (
          <span className="tag">
            {group.title.includes("förbättring")
              ? "Minst 5 raster i båda månaderna"
              : "Minst 5 raster/månad"}
          </span>
        )}
      </div>
      {entries.length ? (
        <ol className="record-list">
          {entries.map((r, i) => (
            <li key={`${r.label}-${r.detail}-${i}`}>
              <span className="record-rank">
                {group.entries.findIndex((x) => x.value === r.value) + 1}
              </span>
              <div>
                <strong>{r.label}</strong>
                {((r.detail && r.detail !== r.label) ||
                  r.count !== undefined) && (
                  <small>
                    {r.detail !== r.label ? r.detail : null}
                    {r.count !== undefined
                      ? ` · ${r.count} raster${group.title.includes("förbättring") ? " eller fler i vardera månaden" : ""}`
                      : ""}
                  </small>
                )}
                {group.entries.filter((x) => x.value === r.value).length >
                  1 && <small>Delad placering</small>}
              </div>
              <span className="record-value">
                {format(r.value, group.performance ? 2 : 0)}
                <small>{group.unit}</small>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="record-empty">
          {group.performance
            ? "Inget kvalificerat rekord."
            : "Inga rekord i urvalet."}
        </p>
      )}
      {group.entries.length > 5 && (
        <button
          className="button ghost full"
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronDown size={16} />
          {expanded ? "Visa färre" : `Visa alla ${group.entries.length}`}
        </button>
      )}
    </section>
  );
}
export default function Statistics() {
  const all = useBreaks().data || [];
  const { section = "oversikt", id = "adrian" } = useParams();
  const [search, setSearch] = useSearchParams();
  const preset = search.get("period") || "all";
  const range: DateRange = {
    from: search.get("from") || undefined,
    to: search.get("to") || undefined,
  };
  const selected = all.filter((m) => within(m, range));
  const invalid = Boolean(range.from && range.to && range.from > range.to);
  const active = tabs.some(([s]) => s === section) ? section : "oversikt";
  function changePeriod(p: string, r: DateRange) {
    const next = new URLSearchParams();
    next.set("period", p);
    if (r.from) next.set("from", r.from);
    if (r.to) next.set("to", r.to);
    setSearch(next);
  }
  return (
    <>
      <PageHeading title="Statistik" />
      <DateFilter value={preset} range={range} onChange={changePeriod} />
      <nav className="statistics-tabs" aria-label="Statistiksektioner">
        {tabs.map(([s, label]) => (
          <Link
            key={s}
            to={`/statistik/${s}${s === "spelare" ? "/adrian" : s === "dueller" ? "/adrian-dave" : ""}?${search}`}
            aria-current={active === s ? "page" : undefined}
            className={active === s ? "active" : ""}
          >
            {label}
          </Link>
        ))}
      </nav>
      <ErrorText>
        {invalid ? "Från-datum får inte vara efter till-datum." : ""}
      </ErrorText>
      {!invalid && (
        <Suspense fallback={<p role="status">Laddar diagram…</p>}>
          {active === "oversikt" && (
            <Overview all={all} selected={selected} range={range} />
          )}{" "}
          {active === "spelare" && (
            <Profile
              key={id}
              all={all}
              selected={selected}
              range={range}
              id={isPlayer(id) ? id : "adrian"}
            />
          )}{" "}
          {active === "dueller" && (
            <Duel all={all} selected={selected} range={range} pairKey={id} />
          )}{" "}
          {active === "rekord" && (
            <>
              <p className="info-note">
                <Info size={17} />
                Prestationsrekord kräver minst 5 raster per spelare och
                kalendermånad. Datumfiltret gäller även rekord.
              </p>
              <div className="records-grid">
                {records(selected).map((g) => (
                  <RecordCard group={g} key={g.title} />
                ))}
              </div>
            </>
          )}
        </Suspense>
      )}
    </>
  );
}
