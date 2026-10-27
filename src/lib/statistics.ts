import {
  PLAYERS,
  points,
  ratio,
  within,
  dayAdd,
  weekday,
  WEEKDAYS,
} from "./domain";
import type { BreakSession, PlayerId, DateRange } from "./domain";
export interface Standing {
  id: PlayerId;
  name: string;
  rank: number;
  breaks: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  matchesWon: number;
  matchesLost: number;
  matchesPlayed: number;
  matchWinPercent: number | null;
  matchDifference: number;
  ppr: number | null;
  breakWinPercent: number | null;
  breakDrawPercent: number | null;
  breakLossPercent: number | null;
  matchDifferencePerBreak: number | null;
  matchesWonPerBreak: number | null;
  matchesLostPerBreak: number | null;
  matchesPerBreak: number | null;
  winMargin: number | null;
  lossMargin: number | null;
  margin: number | null;
  closePercent: number | null;
}
export function standings(breaks: BreakSession[]): Standing[] {
  const rows = PLAYERS.map((p) => {
    let wins = 0,
      draws = 0,
      losses = 0,
      matchesWon = 0,
      matchesLost = 0,
      winMargins = 0,
      lossMargins = 0,
      close = 0,
      margins = 0;
    for (const m of breaks) {
      if (m.player1_id !== p.id && m.player2_id !== p.id) continue;
      const [a, b] =
        m.player1_id === p.id ? [m.score1, m.score2] : [m.score2, m.score1];
      matchesWon += a;
      matchesLost += b;
      margins += Math.abs(a - b);
      if (a > b) {
        wins++;
        winMargins += a - b;
      } else if (a === b) draws++;
      else {
        losses++;
        lossMargins += b - a;
      }
      if (Math.abs(a - b) === 1) close++;
    }
    const count = wins + draws + losses,
      total = 3 * wins + draws;
    return {
      ...p,
      rank: 1,
      breaks: count,
      wins,
      draws,
      losses,
      points: total,
      matchesWon,
      matchesLost,
      matchesPlayed: matchesWon + matchesLost,
      matchWinPercent: ratio(matchesWon * 100, matchesWon + matchesLost),
      matchDifference: matchesWon - matchesLost,
      ppr: ratio(total, count),
      breakWinPercent: ratio(wins * 100, count),
      breakDrawPercent: ratio(draws * 100, count),
      breakLossPercent: ratio(losses * 100, count),
      matchDifferencePerBreak: ratio(matchesWon - matchesLost, count),
      matchesWonPerBreak: ratio(matchesWon, count),
      matchesLostPerBreak: ratio(matchesLost, count),
      matchesPerBreak: ratio(matchesWon + matchesLost, count),
      winMargin: ratio(winMargins, wins),
      lossMargin: ratio(lossMargins, losses),
      margin: ratio(margins, count),
      closePercent: ratio(close * 100, count),
    };
  });
  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.matchDifference - a.matchDifference ||
      b.matchesWon - a.matchesWon ||
      a.id.localeCompare(b.id),
  );
  rows.forEach((row, i) => {
    row.rank =
      i &&
      row.points === rows[i - 1].points &&
      row.matchDifference === rows[i - 1].matchDifference &&
      row.matchesWon === rows[i - 1].matchesWon
        ? rows[i - 1].rank
        : i + 1;
  });
  return rows;
}
export type Resolution = "day" | "week" | "month";
export type PerformanceMetric =
  | "ppr"
  | "breakWinPercent"
  | "matchWinPercent"
  | "matchDifferencePerBreak"
  | "matchesWonPerBreak";
export function period(d: string, resolution: Resolution): string {
  return resolution === "month"
    ? d.slice(0, 7) + "-01"
    : resolution === "week"
      ? dayAdd(d, -weekday(d))
      : d;
}
function nextPeriod(d: string, resolution: Resolution): string {
  if (resolution !== "month") return dayAdd(d, resolution === "week" ? 7 : 1);
  const date = new Date(d + "T12:00:00Z");
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}
export function resolutionFor(
  breaks: BreakSession[],
  range: DateRange,
): Resolution {
  const dates = breaks.map((m) => m.played_on).sort();
  const from = range.from || dates[0],
    to = range.to || dates.at(-1);
  if (!from || !to) return "week";
  const days = (Date.parse(to) - Date.parse(from)) / 86400000;
  return days <= 180 ? "week" : "month";
}
export interface ChartRow {
  date: string;
  count: number;
  matchesPlayed: number;
  adrian: number | null;
  dave: number | null;
  elias: number | null;
  adrian_count: number;
  dave_count: number;
  elias_count: number;
  adrian_matches: number;
  dave_matches: number;
  elias_matches: number;
}
const blank = (date: string): ChartRow => ({
  date,
  count: 0,
  matchesPlayed: 0,
  adrian: null,
  dave: null,
  elias: null,
  adrian_count: 0,
  dave_count: 0,
  elias_count: 0,
  adrian_matches: 0,
  dave_matches: 0,
  elias_matches: 0,
});
export function performance(
  breaks: BreakSession[],
  range: DateRange,
  resolution: Resolution,
  metric: PerformanceMetric = "ppr",
): ChartRow[] {
  const selected = breaks.filter((m) => within(m, range));
  if (!selected.length) return [];
  const dates = selected.map((m) => m.played_on).sort();
  const from = period(range.from || dates[0], resolution),
    to = period(range.to || dates.at(-1)!, resolution);
  const groups = new Map<string, BreakSession[]>();
  selected.forEach((m) => {
    const key = period(m.played_on, resolution);
    groups.set(key, [...(groups.get(key) || []), m]);
  });
  const result: ChartRow[] = [];
  for (let d = from; d <= to; d = nextPeriod(d, resolution)) {
    const group = groups.get(d) || [],
      row = blank(d);
    row.count = group.length;
    row.matchesPlayed = group.reduce((n, m) => n + m.score1 + m.score2, 0);
    standings(group).forEach((s) => {
      row[s.id] = s[metric];
      row[`${s.id}_count`] = s.breaks;
      row[`${s.id}_matches`] = s.matchesPlayed;
    });
    result.push(row);
  }
  return result;
}
export function cumulative(
  breaks: BreakSession[],
  range: DateRange,
): ChartRow[] {
  if (!breaks.length) return [];
  const totals: Record<PlayerId, number> = { adrian: 0, dave: 0, elias: 0 };
  const counts: Record<PlayerId, number> = { adrian: 0, dave: 0, elias: 0 };
  const matchCounts: Record<PlayerId, number> = {
    adrian: 0,
    dave: 0,
    elias: 0,
  };
  const groups = new Map<string, BreakSession[]>();
  for (const m of breaks) {
    if (!range.to || m.played_on <= range.to)
      groups.set(m.played_on, [...(groups.get(m.played_on) || []), m]);
  }
  const result: ChartRow[] = [];
  const push = (d: string, n: number) =>
    result.push({
      date: d,
      count: n,
      matchesPlayed: (groups.get(d) || []).reduce(
        (n, m) => n + m.score1 + m.score2,
        0,
      ),
      ...totals,
      adrian_count: counts.adrian,
      dave_count: counts.dave,
      elias_count: counts.elias,
      adrian_matches: matchCounts.adrian,
      dave_matches: matchCounts.dave,
      elias_matches: matchCounts.elias,
    });
  const dates = [...groups.keys()].sort();
  const lastBefore = range.from
    ? dates.filter((d) => d < range.from!).at(-1)
    : undefined;
  for (const date of dates) {
    for (const m of groups.get(date)!) {
      totals[m.player1_id] += points(m.score1, m.score2);
      totals[m.player2_id] += points(m.score2, m.score1);
      counts[m.player1_id]++;
      counts[m.player2_id]++;
      matchCounts[m.player1_id] += m.score1 + m.score2;
      matchCounts[m.player2_id] += m.score1 + m.score2;
    }
    if (!range.from || date >= range.from) push(date, groups.get(date)!.length);
    else if (date === lastBefore) push(dayAdd(range.from!, -1), 0);
  }
  return result;
}
export function summary(breaks: BreakSession[]) {
  return {
    breaks: breaks.length,
    matchesPlayed: breaks.reduce((n, m) => n + m.score1 + m.score2, 0),
    breakDrawPercent: ratio(
      breaks.filter((m) => m.score1 === m.score2).length * 100,
      breaks.length,
    ),
    matchesPerBreak: ratio(
      breaks.reduce((n, m) => n + m.score1 + m.score2, 0),
      breaks.length,
    ),
    days: new Set(breaks.map((m) => m.played_on)).size,
  };
}
export function resultPatterns(breaks: BreakSession[], id?: PlayerId) {
  const counts = new Map<string, number>();
  for (const m of breaks) {
    if (id && m.player1_id !== id && m.player2_id !== id) continue;
    const [a, b] = id
      ? m.player1_id === id
        ? [m.score1, m.score2]
        : [m.score2, m.score1]
      : [Math.max(m.score1, m.score2), Math.min(m.score1, m.score2)];
    const key = `${a}–${b}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
export function weekdayPerformance(breaks: BreakSession[], id: PlayerId) {
  return WEEKDAYS.map((label, i) => ({
    label,
    ...standings(breaks.filter((m) => weekday(m.played_on) === i)).find(
      (s) => s.id === id,
    )!,
  }));
}
export function compareThirtyDays(
  breaks: BreakSession[],
  id: PlayerId,
  end: string,
  range: DateRange = {},
) {
  const filtered = breaks.filter((m) => within(m, range));
  const current = standings(
    filtered.filter((m) => within(m, { from: dayAdd(end, -29), to: end })),
  ).find((s) => s.id === id)!;
  const previous = standings(
    filtered.filter((m) =>
      within(m, { from: dayAdd(end, -59), to: dayAdd(end, -30) }),
    ),
  ).find((s) => s.id === id)!;
  return {
    current,
    previous,
    delta:
      current.ppr === null || previous.ppr === null
        ? null
        : current.ppr - previous.ppr,
  };
}
export interface RecordEntry {
  label: string;
  value: number;
  detail: string;
  count?: number;
  breakId?: string;
}
export interface RecordGroup {
  title: string;
  unit: string;
  performance?: boolean;
  entries: RecordEntry[];
}
export function records(breaks: BreakSession[]): RecordGroup[] {
  const activity = (resolution: Resolution): RecordEntry[] => {
    const groups = new Map<string, number>();
    breaks.forEach((m) => {
      const k = period(m.played_on, resolution);
      groups.set(k, (groups.get(k) || 0) + 1);
    });
    return [...groups]
      .map(([label, value]) => ({
        label,
        value,
        detail: resolution === "week" ? `Veckan från ${label}` : label,
      }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  };
  const monthly = [...new Set(breaks.map((m) => m.played_on.slice(0, 7)))]
    .sort()
    .flatMap((month) =>
      standings(breaks.filter((m) => m.played_on.startsWith(month)))
        .filter((s) => s.breaks >= 5)
        .map((s) => ({ ...s, month })),
    );
  const perf = (key: PerformanceMetric): RecordEntry[] =>
    monthly
      .map((s) => ({
        label: s.name,
        value: s[key]!,
        detail: s.month,
        count: s.breaks,
      }))
      .sort((a, b) => b.value - a.value || a.detail.localeCompare(b.detail));
  const improvement: RecordEntry[] = [];
  monthly.forEach((s) => {
    const prevDate = new Date(s.month + "-01T12:00:00Z");
    prevDate.setUTCMonth(prevDate.getUTCMonth() - 1);
    const prev = monthly.find(
      (p) => p.id === s.id && p.month === prevDate.toISOString().slice(0, 7),
    );
    if (prev && s.ppr! > prev.ppr!)
      improvement.push({
        label: s.name,
        value: s.ppr! - prev.ppr!,
        detail: `${prev.month} → ${s.month}`,
        count: Math.min(prev.breaks, s.breaks),
      });
  });
  return [
    {
      title: "Flest vunna raster",
      unit: "raster",
      entries: standings(breaks)
        .filter((s) => s.wins > 0)
        .map((s) => ({ label: s.name, value: s.wins, detail: "" }))
        .sort((a, b) => b.value - a.value),
    },
    {
      title: "Flest matchvinster under en rast",
      unit: "matcher",
      entries: breaks
        .map((m) => ({
          label:
            m.score1 === m.score2
              ? `${PLAYERS.find((p) => p.id === m.player1_id)!.name} och ${PLAYERS.find((p) => p.id === m.player2_id)!.name}`
              : PLAYERS.find(
                  (p) =>
                    p.id ===
                    (m.score1 > m.score2 ? m.player1_id : m.player2_id),
                )!.name,
          value: Math.max(m.score1, m.score2),
          detail: `${m.played_on} · ${m.score1}–${m.score2} · ${m.player1_id}–${m.player2_id}`,
          breakId: m.id,
        }))
        .sort((a, b) => b.value - a.value || a.detail.localeCompare(b.detail)),
    },
    {
      title: "Största matchskillnad under en rast",
      unit: "matchers marginal",
      entries: breaks
        .filter((m) => m.score1 !== m.score2)
        .map((m) => ({
          label: `${PLAYERS.find((p) => p.id === (m.score1 > m.score2 ? m.player1_id : m.player2_id))!.name}`,
          value: Math.abs(m.score1 - m.score2),
          detail: `${m.played_on} · ${m.score1}–${m.score2} · ${m.player1_id}–${m.player2_id}`,
          breakId: m.id,
        }))
        .sort((a, b) => b.value - a.value || a.detail.localeCompare(b.detail)),
    },
    {
      title: "Flest matcher under en rast",
      unit: "matcher",
      entries: breaks
        .map((m) => ({
          label: `${m.player1_id}–${m.player2_id}`,
          value: m.score1 + m.score2,
          detail: `${m.played_on} · ${m.score1}–${m.score2}`,
          breakId: m.id,
        }))
        .sort((a, b) => b.value - a.value || a.detail.localeCompare(b.detail)),
    },
    {
      title: "Vanligaste slutresultat",
      unit: "raster",
      entries: resultPatterns(breaks).map((r) => ({
        label: r.label,
        value: r.count,
        detail: "Flest matchvinster först",
      })),
    },
    {
      title: "Flest raster per dag",
      unit: "raster",
      entries: activity("day"),
    },
    {
      title: "Flest raster per vecka",
      unit: "raster",
      entries: activity("week"),
    },
    {
      title: "Flest raster per månad",
      unit: "raster",
      entries: activity("month"),
    },
    {
      title: "Mest aktiva veckodagar",
      unit: "raster",
      entries: WEEKDAYS.map((label, i) => ({
        label,
        value: breaks.filter((m) => weekday(m.played_on) === i).length,
        detail: "",
      }))
        .filter((r) => r.value > 0)
        .sort((a, b) => b.value - a.value),
    },
    {
      title: "Högst P/R per månad",
      unit: "P/R",
      performance: true,
      entries: perf("ppr"),
    },
    {
      title: "Högst rastvinstprocent per månad",
      unit: "%",
      performance: true,
      entries: perf("breakWinPercent"),
    },
    {
      title: "Högst matchvinstprocent per månad",
      unit: "%",
      performance: true,
      entries: perf("matchWinPercent"),
    },
    {
      title: "Bäst matchskillnad per rast och månad",
      unit: "matcher/rast",
      performance: true,
      entries: perf("matchDifferencePerBreak"),
    },
    {
      title: "Störst förbättring mellan månader",
      unit: "P/R i ökning",
      performance: true,
      entries: improvement.sort((a, b) => b.value - a.value),
    },
  ];
}
