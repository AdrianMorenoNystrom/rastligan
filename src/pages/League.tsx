import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Plus,
  ArrowUpRight,
  CalendarDays,
  Trophy,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useBreaks } from "../components/providers";
import { standings } from "../lib/statistics";
import { newest, today } from "../lib/domain";
import { PageHeading, SectionHeading, Modal } from "../components/ui";
import { SelectionIndicator } from "../components/SelectionIndicator";
import { LeagueStandings, MonthWinner } from "../components/LeagueStandings";
import { BreakList } from "../components/BreakList";
import { monthLabel, monthRange, monthlyLeagues } from "../lib/monthly";
export default function League() {
  const breaks = useBreaks().data || [];
  const [search, setSearch] = useSearchParams();
  const leagues = monthlyLeagues(breaks);
  const currentMonth = today().slice(0, 7);
  const months = [
    ...new Set([currentMonth, ...leagues.map((league) => league.month)]),
  ].sort((a, b) => b.localeCompare(a));
  const monthly = search.get("liga") === "manad";
  const requested = search.get("manad");
  const selectedMonth =
    requested && months.includes(requested)
      ? requested
      : leagues.find((league) => league.month <= currentMonth)?.month ||
        currentMonth;
  const selected = monthly
    ? breaks.filter((rast) => rast.played_on.startsWith(`${selectedMonth}-`))
    : breaks;
  const rows = standings(selected);
  const archived = leagues.filter((league) => league.status === "completed");
  const index = months.indexOf(selectedMonth);
  const [archiveOrigin, setArchiveOrigin] = useState<HTMLElement | null>(null);
  const openedArchive = archived.find(
    (league) => league.month === search.get("arkiv"),
  );
  const archiveBreaks = openedArchive
    ? breaks
        .filter((rast) => rast.played_on.startsWith(`${openedArchive.month}-`))
        .sort(newest)
    : [];
  const selectedRange = monthRange(selectedMonth);
  const completed =
    monthly && selectedMonth < currentMonth && selected.length > 0;
  const winners = completed
    ? rows.filter((row) => row.rank === 1 && row.breaks > 0)
    : [];
  function chooseMonth(month: string) {
    setSearch({ liga: "manad", manad: month });
  }
  return (
    <>
      <PageHeading title="Ligan">
        <span className="league-kicker">Adrian · Dave · Elias</span>
      </PageHeading>
      <div className="league-controls">
        <div className="league-mode segmented" role="group" aria-label="Liga">
          <SelectionIndicator value={monthly ? "month" : "total"} />
          <button
            aria-pressed={!monthly}
            className={!monthly ? "selected" : ""}
            onClick={() => setSearch({})}
          >
            Totalt
          </button>
          <button
            aria-pressed={monthly}
            className={monthly ? "selected" : ""}
            onClick={() => chooseMonth(selectedMonth)}
          >
            Månadsliga
          </button>
        </div>
        {monthly && (
          <div className="month-picker">
            <button
              className="icon-button"
              aria-label="Äldre månad"
              disabled={index === months.length - 1}
              onClick={() => chooseMonth(months[index + 1])}
            >
              <ChevronLeft size={18} />
            </button>
            <label className="sr-only" htmlFor="league-month">
              Ligamånad
            </label>
            <CalendarDays size={17} aria-hidden="true" />
            <select
              id="league-month"
              value={selectedMonth}
              onChange={(e) => chooseMonth(e.target.value)}
            >
              {months.map((month) => (
                <option value={month} key={month}>
                  {monthLabel(month)}
                </option>
              ))}
            </select>
            <button
              className="icon-button"
              aria-label="Nyare månad"
              disabled={index === 0}
              onClick={() => chooseMonth(months[index - 1])}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
      <section className="card league-card">
        <div className="league-card-heading">
          <div className="league-card-title">
            {monthly && <span className="eyebrow">Månadsliga</span>}
            <h2>{monthly ? monthLabel(selectedMonth) : "Ligatabellen"}</h2>
          </div>
          <span className="tag">
            {monthly
              ? completed
                ? "Avslutad"
                : selectedMonth === currentMonth
                  ? "Pågår"
                  : "Kommande"
              : "Alla raster"}
          </span>
        </div>
        <MonthWinner winners={winners} />
        <LeagueStandings
          rows={rows}
          range={monthly ? selectedRange : undefined}
        />
        {monthly && selected.length === 0 && (
          <p className="month-empty">
            Inga raster registrerade i {monthLabel(selectedMonth)}.
          </p>
        )}
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
          title={monthly ? "Månadens senaste raster" : "Senaste raster"}
          to="/raster"
          link="Alla raster"
        />
        <BreakList breaks={[...selected].sort(newest).slice(0, 3)} />
      </section>
      <div className="league-summary">
        <div>
          <strong>{selected.length}</strong>
          <span>{monthly ? "raster i månaden" : "raster totalt"}</span>
        </div>
        <div>
          <strong>
            {selected.reduce((sum, rast) => sum + rast.score1 + rast.score2, 0)}
          </strong>
          <span>spelade matcher</span>
        </div>
        <Link to="/statistik">
          Statistik
          <ArrowUpRight size={17} />
        </Link>
      </div>
      {archived.length > 0 && (
        <section
          className="month-archive"
          aria-labelledby="month-archive-title"
        >
          <div className="section-heading">
            <h2 id="month-archive-title">Tidigare månadsligor</h2>
            <span className="archive-count">{archived.length}</span>
          </div>
          <div className="month-archive-grid">
            {archived.map((league) => (
              <button
                key={league.month}
                className={`card archive-month ${monthly && selectedMonth === league.month ? "is-selected" : ""}`}
                aria-label={`Visa ${monthLabel(league.month)}`}
                aria-haspopup="dialog"
                aria-expanded={openedArchive?.month === league.month}
                onClick={(event) => {
                  setArchiveOrigin(event.currentTarget);
                  const next = new URLSearchParams(search);
                  next.set("arkiv", league.month);
                  setSearch(next);
                }}
              >
                <span className="archive-month-label">
                  <CalendarDays size={15} />
                  {monthLabel(league.month)}
                  <ArrowUpRight size={16} />
                </span>
                <span className="archive-winner">
                  <Trophy size={21} />
                  <strong>
                    {league.winners.map((row) => row.name).join(" och ")}
                  </strong>
                </span>
                <span className="archive-detail">
                  {league.winners.length > 1 ? "Delad vinst · " : ""}
                  {league.rows[0].points} poäng · {league.breaks} raster
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      {openedArchive && (
        <Modal
          title={monthLabel(openedArchive.month)}
          className="month-modal"
          origin={archiveOrigin}
          onClose={() => {
            const next = new URLSearchParams(search);
            next.delete("arkiv");
            setSearch(next, { replace: true });
          }}
        >
          <div className="month-modal-content">
            <MonthWinner winners={openedArchive.winners} />
            <LeagueStandings
              rows={openedArchive.rows}
              range={monthRange(openedArchive.month)}
            />
            <div className="month-modal-summary">
              <span>
                <strong>{openedArchive.breaks}</strong> raster
              </span>
              <span>
                <strong>{openedArchive.matches}</strong> matcher
              </span>
              <span>Avslutad månadsliga</span>
            </div>
            <p className="table-note">
              Placering efter poäng, matchskillnad och vunna matcher. Lika
              värden ger delad plats.
            </p>
            <section
              className="month-modal-history"
              aria-label="Månadens raster"
            >
              <h3>Raster</h3>
              <BreakList breaks={archiveBreaks} />
            </section>
          </div>
        </Modal>
      )}
    </>
  );
}
