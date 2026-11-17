import type { BreakSession } from "./domain";
import { today } from "./domain";
import { standings } from "./statistics";

export const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T12:00:00Z`));

export function monthRange(month: string) {
  const end = new Date(`${month}-01T12:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);
  return { from: `${month}-01`, to: end.toISOString().slice(0, 10) };
}

/** Calendar months use the played date. Archived winners follow corrected results. */
export function monthlyLeagues(breaks: BreakSession[], asOf = today()) {
  const currentMonth = asOf.slice(0, 7);
  return [...new Set(breaks.map((rast) => rast.played_on.slice(0, 7)))]
    .sort((a, b) => b.localeCompare(a))
    .map((month) => {
      const selected = breaks.filter((rast) =>
        rast.played_on.startsWith(`${month}-`),
      );
      const rows = standings(selected);
      const status =
        month < currentMonth
          ? "completed"
          : month === currentMonth
            ? "current"
            : "upcoming";
      return {
        month,
        status,
        breaks: selected.length,
        matches: selected.reduce(
          (sum, rast) => sum + rast.score1 + rast.score2,
          0,
        ),
        rows,
        winners:
          status === "completed"
            ? rows.filter((row) => row.rank === 1 && row.breaks > 0)
            : [],
      };
    });
}
