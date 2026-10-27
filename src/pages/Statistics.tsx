import { lazy, Suspense, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CalendarDays, ArrowUpRight, ChevronDown, Info } from "lucide-react";
import { useMatches } from "../components/providers";
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
import type { DateRange, Match, PlayerId } from "../lib/domain";
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
import type { Resolution, RecordGroup } from "../lib/statistics";
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
  all: Match[];
  selected: Match[];
  range: DateRange;
}) {
  const s = summary(selected);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const res = resolution || resolutionFor(all, range);
  return (
    <>
      <Metrics
        items={[
          { label: "Matcher", value: s.matches },
          {
            label: "Oavgjort",
            value: fmtPercent(s.drawPercent),
            hint: `${s.matches} matcher`,
          },
          {
            label: "Set per match",
            value: format(s.setsPerMatch),
            hint: `${s.matches} matcher`,
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
        title="Prestationsutveckling"
        description="P/M = poäng per match i perioden. Luckor visar saknade matcher."
        data={performance(all, range, res)}
        max={3}
      />
      <div className="chart-grid">
        <Chart
          title="Matchaktivitet"
          description={`Matcher per ${res === "day" ? "dag" : res === "week" ? "vecka" : "månad"}.`}
          data={performance(all, range, res)}
          activity
        />
        <Chart
          title="Poängutveckling"
          description="Totalpoäng vid dagens slut, inklusive poäng före vald period."
          data={cumulative(all, range)}
          step
          unit="poäng"
        />
      </div>
      <ActivityCalendar matches={selected} />
    </>
  );
}
function ActivityCalendar({ matches }: { matches: Match[] }) {
  const dates = matches.map((m) => m.played_on).sort();
  const [start, setStart] = useState("");
  const month = start || dates.at(-1)?.slice(0, 7) || today().slice(0, 7);
  const first = month + "-01";
  const next = new Date(first + "T12:00:00Z");
  next.setUTCMonth(next.getUTCMonth() + 1);
  const days = Number(dayAdd(next.toISOString().slice(0, 10), -1).slice(-2));
  const counts = new Map<string, number>();
  matches.forEach((m) =>
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
              aria-label={`${date}: ${n} matcher`}
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
          ? `${chosen}: ${counts.get(chosen) || 0} matcher i urvalet.`
          : "Välj dag för antal matcher."}
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
  all: Match[];
  selected: Match[];
  range: DateRange;
  id: PlayerId;
}) {
  const s = standings(selected).find((s) => s.id === id)!;
  const [resolution, setResolution] = useState<Resolution>("week");
  const [metric, setMetric] = useState<"ppm" | "winPercent">("ppm");
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
        {s.matches > 0 && s.matches < 5 && (
          <span className="tag warning">Litet underlag</span>
        )}
      </div>
      <Metrics
        items={[
          { label: "Matcher", value: s.matches },
          { label: "Poäng", value: s.points },
          { label: "P/M", value: format(s.ppm), hint: `${s.matches} matcher` },
          {
            label: "Vinstprocent",
            value: fmtPercent(s.winPercent),
            hint: `${s.matches} matcher`,
          },
        ]}
      />
      <div className="two-column">
        <section className="card">
          <h2>Resultat</h2>
          <dl className="stat-list">
            {[
              ["Vinster", s.wins],
              ["Oavgjorda", s.draws],
              ["Förluster", s.losses],
              ["Vinstprocent", fmtPercent(s.winPercent)],
              ["Oavgjortandel", fmtPercent(s.drawPercent)],
              ["Förlustprocent", fmtPercent(s.lossPercent)],
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
            {s.matches > 0 && (
              <>
                <span
                  style={{
                    width: `${(s.wins / s.matches) * 100}%`,
                    background: "#bef26d",
                  }}
                />
                <span
                  style={{
                    width: `${(s.draws / s.matches) * 100}%`,
                    background: "#a5b7c9",
                  }}
                />
                <span
                  style={{
                    width: `${(s.losses / s.matches) * 100}%`,
                    background: "#d4a1ff",
                  }}
                />
              </>
            )}
          </div>
          <p className="fine-print">
            Fördelning V / O / F · {s.matches} matcher
          </p>
        </section>
        <section className="card">
          <h2>Setstatistik</h2>
          <dl className="stat-list">
            {[
              ["Vunna / förlorade set", `${s.setsWon} / ${s.setsLost}`],
              ["Setskillnad", s.setDifference],
              ["Setskillnad / match", format(s.setDifferencePerMatch)],
              ["Vunna set / match", format(s.setsWonPerMatch)],
              ["Förlorade set / match", format(s.setsLostPerMatch)],
              ["Set / match", format(s.setsPerMatch)],
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
            onChange={(e) => setMetric(e.target.value as "ppm" | "winPercent")}
          >
            <option value="ppm">Poäng per match</option>
            <option value="winPercent">Vinstprocent</option>
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
        description={`${metric === "ppm" ? "Poäng per match" : "Vinstprocent"}, ${resolution === "week" ? "veckovis" : "månadsvis"}.`}
        data={performance(all, range, resolution, metric)}
        players={[id]}
        unit={metric === "ppm" ? "P/M" : "%"}
        max={metric === "ppm" ? 3 : 100}
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
              label: "P/M senaste 30",
              value: format(comparison.current.ppm),
              hint: `${comparison.current.matches} matcher`,
            },
            {
              label: "P/M föregående 30",
              value: format(comparison.previous.ppm),
              hint: `${comparison.previous.matches} matcher`,
            },
            {
              label: "Förändring i P/M",
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
              <dt>Matcher med ett sets marginal</dt>
              <dd>{fmtPercent(s.closePercent)}</dd>
            </div>
            <div>
              <dt>Genomsnittlig setmarginal</dt>
              <dd>{format(s.margin)}</dd>
            </div>
          </dl>
          <p className="fine-print">
            Marginal anges utan minustecken. Underlag: {s.matches} matcher.
          </p>
          <h3>Vanligaste slutresultat</h3>
          <p className="fine-print">{player(id).name}s set visas först.</p>
          {patterns.length ? (
            <ol className="pattern-list">
              {patterns.slice(0, 8).map((r) => (
                <li key={r.label}>
                  <strong>{r.label}</strong>
                  <span>{r.count} matcher</span>
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
                <th>M</th>
                <th>P/M</th>
                <th>Vinst %</th>
              </tr>
            </thead>
            <tbody>
              {weekdays.map((d) => (
                <tr key={d.label}>
                  <th>{d.label}</th>
                  <td>{d.matches}</td>
                  <td>{format(d.ppm)}</td>
                  <td>{format(d.winPercent, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="fine-print">
            M = matcher. Färre än 5 ger litet underlag.
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
  all: Match[];
  selected: Match[];
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
            <span>inbördes matcher</span>
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
              ["Vinster", left.wins, right.wins],
              ["Oavgjorda", left.draws, right.draws],
              [
                "Vinstprocent",
                fmtPercent(left.winPercent),
                fmtPercent(right.winPercent),
              ],
              ["Poäng / match", format(left.ppm), format(right.ppm)],
              ["Vunna set", left.setsWon, right.setsWon],
              [
                "Setskillnad / match",
                format(left.setDifferencePerMatch),
                format(right.setDifferencePerMatch),
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
          Underlag: {data.length} matcher per spelare.
          {data.length > 0 && data.length < 5 ? " Litet underlag." : ""}
        </p>
      </section>
      <div className="chart-grid">
        <Chart
          title="Poäng inom duellen"
          description="Inbördes totalpoäng vid dagens slut."
          data={cumulative(allPair, range)}
          step
          players={pair}
          unit="poäng"
        />
        <Chart
          title="Månadsvis prestation"
          description="Poäng per match och månad."
          data={performance(allPair, range, "month")}
          players={pair}
          max={3}
        />
      </div>
      <section className="card">
        <h2>Vanligaste slutresultat</h2>
        <p className="muted">
          {player(a).name}s set först. Underlag: {data.length} matcher.
        </p>
        {patterns.length ? (
          <ol className="pattern-list">
            {patterns.map((r) => (
              <li key={r.label}>
                <strong>{r.label}</strong>
                <span>{r.count} matcher</span>
              </li>
            ))}
          </ol>
        ) : (
          <Empty title="Inga matcher i urvalet" />
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
              ? "Minst 5 matcher i båda månaderna"
              : "Minst 5 matcher/månad"}
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
                      ? ` · ${r.count} matcher${group.title.includes("förbättring") ? " eller fler i vardera månaden" : ""}`
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
  const all = useMatches().data || [];
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
                Prestationsrekord kräver minst 5 matcher per spelare och
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
