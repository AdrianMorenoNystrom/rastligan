import {
  PLAYERS,
  points,
  ratio,
  within,
  dayAdd,
  weekday,
  WEEKDAYS,
} from "./domain";
import type { Match, PlayerId, DateRange } from "./domain";
export interface Standing {
  id: PlayerId;
  name: string;
  rank: number;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  setsWon: number;
  setsLost: number;
  setDifference: number;
  ppm: number | null;
  winPercent: number | null;
  drawPercent: number | null;
  lossPercent: number | null;
  setDifferencePerMatch: number | null;
  setsWonPerMatch: number | null;
  setsLostPerMatch: number | null;
  setsPerMatch: number | null;
  winMargin: number | null;
  lossMargin: number | null;
  margin: number | null;
  closePercent: number | null;
}
export function standings(matches: Match[]): Standing[] {
  const rows = PLAYERS.map((p) => {
    let wins = 0,
      draws = 0,
      losses = 0,
      setsWon = 0,
      setsLost = 0,
      winMargins = 0,
      lossMargins = 0,
      close = 0,
      margins = 0;
    for (const m of matches) {
      if (m.player1_id !== p.id && m.player2_id !== p.id) continue;
      const [a, b] =
        m.player1_id === p.id ? [m.score1, m.score2] : [m.score2, m.score1];
      setsWon += a;
      setsLost += b;
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
      matches: count,
      wins,
      draws,
      losses,
      points: total,
      setsWon,
      setsLost,
      setDifference: setsWon - setsLost,
      ppm: ratio(total, count),
      winPercent: ratio(wins * 100, count),
      drawPercent: ratio(draws * 100, count),
      lossPercent: ratio(losses * 100, count),
      setDifferencePerMatch: ratio(setsWon - setsLost, count),
      setsWonPerMatch: ratio(setsWon, count),
      setsLostPerMatch: ratio(setsLost, count),
      setsPerMatch: ratio(setsWon + setsLost, count),
      winMargin: ratio(winMargins, wins),
      lossMargin: ratio(lossMargins, losses),
      margin: ratio(margins, count),
      closePercent: ratio(close * 100, count),
    };
  });
  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.setDifference - a.setDifference ||
      b.setsWon - a.setsWon ||
      a.id.localeCompare(b.id),
  );
  rows.forEach((row, i) => {
    row.rank =
      i &&
      row.points === rows[i - 1].points &&
      row.setDifference === rows[i - 1].setDifference &&
      row.setsWon === rows[i - 1].setsWon
        ? rows[i - 1].rank
        : i + 1;
  });
  return rows;
}
export type Resolution = "day" | "week" | "month";
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
export function resolutionFor(matches: Match[], range: DateRange): Resolution {
  const dates = matches.map((m) => m.played_on).sort();
  const from = range.from || dates[0],
    to = range.to || dates.at(-1);
  if (!from || !to) return "week";
  const days = (Date.parse(to) - Date.parse(from)) / 86400000;
  return days <= 31 ? "day" : days <= 180 ? "week" : "month";
}
export interface ChartRow {
  date: string;
  count: number;
  adrian: number | null;
  dave: number | null;
  elias: number | null;
  adrian_count: number;
  dave_count: number;
  elias_count: number;
}
const blank = (date: string): ChartRow => ({
  date,
  count: 0,
  adrian: null,
  dave: null,
  elias: null,
  adrian_count: 0,
  dave_count: 0,
  elias_count: 0,
});
export function performance(
  matches: Match[],
  range: DateRange,
  resolution: Resolution,
  metric: "ppm" | "winPercent" = "ppm",
): ChartRow[] {
  const selected = matches.filter((m) => within(m, range));
  if (!selected.length) return [];
  const dates = selected.map((m) => m.played_on).sort();
  const from = period(range.from || dates[0], resolution),
    to = period(range.to || dates.at(-1)!, resolution);
  const groups = new Map<string, Match[]>();
  selected.forEach((m) => {
    const key = period(m.played_on, resolution);
    groups.set(key, [...(groups.get(key) || []), m]);
  });
  const result: ChartRow[] = [];
  for (let d = from; d <= to; d = nextPeriod(d, resolution)) {
    const group = groups.get(d) || [],
      row = blank(d);
    row.count = group.length;
    standings(group).forEach((s) => {
      row[s.id] = s[metric];
      row[`${s.id}_count`] = s.matches;
    });
    result.push(row);
  }
  return result;
}
export function cumulative(matches: Match[], range: DateRange): ChartRow[] {
  if (!matches.length) return [];
  const totals: Record<PlayerId, number> = { adrian: 0, dave: 0, elias: 0 };
  const counts: Record<PlayerId, number> = { adrian: 0, dave: 0, elias: 0 };
  const groups = new Map<string, Match[]>();
  for (const m of matches) {
    if (!range.to || m.played_on <= range.to)
      groups.set(m.played_on, [...(groups.get(m.played_on) || []), m]);
  }
  const result: ChartRow[] = [];
  const push = (d: string, n: number) =>
    result.push({
      date: d,
      count: n,
      ...totals,
      adrian_count: counts.adrian,
      dave_count: counts.dave,
      elias_count: counts.elias,
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
    }
    if (!range.from || date >= range.from) push(date, groups.get(date)!.length);
    else if (date === lastBefore) push(dayAdd(range.from!, -1), 0);
  }
  return result;
}
export function summary(matches: Match[]) {
  return {
    matches: matches.length,
    drawPercent: ratio(
      matches.filter((m) => m.score1 === m.score2).length * 100,
      matches.length,
    ),
    setsPerMatch: ratio(
      matches.reduce((n, m) => n + m.score1 + m.score2, 0),
      matches.length,
    ),
    days: new Set(matches.map((m) => m.played_on)).size,
  };
}
export function resultPatterns(matches: Match[], id?: PlayerId) {
  const counts = new Map<string, number>();
  for (const m of matches) {
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
export function weekdayPerformance(matches: Match[], id: PlayerId) {
  return WEEKDAYS.map((label, i) => ({
    label,
    ...standings(matches.filter((m) => weekday(m.played_on) === i)).find(
      (s) => s.id === id,
    )!,
  }));
}
export function compareThirtyDays(
  matches: Match[],
  id: PlayerId,
  end: string,
  range: DateRange = {},
) {
  const filtered = matches.filter((m) => within(m, range));
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
      current.ppm === null || previous.ppm === null
        ? null
        : current.ppm - previous.ppm,
  };
}
export interface RecordEntry {
  label: string;
  value: number;
  detail: string;
  count?: number;
  matchId?: string;
}
export interface RecordGroup {
  title: string;
  unit: string;
  performance?: boolean;
  entries: RecordEntry[];
}
export function records(matches: Match[]): RecordGroup[] {
  const activity = (resolution: Resolution): RecordEntry[] => {
    const groups = new Map<string, number>();
    matches.forEach((m) => {
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
  const monthly = [...new Set(matches.map((m) => m.played_on.slice(0, 7)))]
    .sort()
    .flatMap((month) =>
      standings(matches.filter((m) => m.played_on.startsWith(month)))
        .filter((s) => s.matches >= 5)
        .map((s) => ({ ...s, month })),
    );
  const perf = (
    key: "ppm" | "winPercent" | "setDifferencePerMatch",
  ): RecordEntry[] =>
    monthly
      .map((s) => ({
        label: s.name,
        value: s[key]!,
        detail: s.month,
        count: s.matches,
      }))
      .sort((a, b) => b.value - a.value || a.detail.localeCompare(b.detail));
  const improvement: RecordEntry[] = [];
  monthly.forEach((s) => {
    const prevDate = new Date(s.month + "-01T12:00:00Z");
    prevDate.setUTCMonth(prevDate.getUTCMonth() - 1);
    const prev = monthly.find(
      (p) => p.id === s.id && p.month === prevDate.toISOString().slice(0, 7),
    );
    if (prev && s.ppm! > prev.ppm!)
      improvement.push({
        label: s.name,
        value: s.ppm! - prev.ppm!,
        detail: `${prev.month} → ${s.month}`,
        count: Math.min(prev.matches, s.matches),
      });
  });
  return [
    {
      title: "Största setsegrar",
      unit: "sets marginal",
      entries: matches
        .filter((m) => m.score1 !== m.score2)
        .map((m) => ({
          label: `${PLAYERS.find((p) => p.id === (m.score1 > m.score2 ? m.player1_id : m.player2_id))!.name}`,
          value: Math.abs(m.score1 - m.score2),
          detail: `${m.played_on} · ${m.score1}–${m.score2} · ${m.player1_id}–${m.player2_id}`,
          matchId: m.id,
        }))
        .sort((a, b) => b.value - a.value || a.detail.localeCompare(b.detail)),
    },
    {
      title: "Mest set i en match",
      unit: "set",
      entries: matches
        .map((m) => ({
          label: `${m.player1_id}–${m.player2_id}`,
          value: m.score1 + m.score2,
          detail: `${m.played_on} · ${m.score1}–${m.score2}`,
          matchId: m.id,
        }))
        .sort((a, b) => b.value - a.value || a.detail.localeCompare(b.detail)),
    },
    {
      title: "Vanligaste slutresultat",
      unit: "matcher",
      entries: resultPatterns(matches).map((r) => ({
        label: r.label,
        value: r.count,
        detail: "Högsta setantalet först",
      })),
    },
    {
      title: "Flest matcher per dag",
      unit: "matcher",
      entries: activity("day"),
    },
    {
      title: "Flest matcher per vecka",
      unit: "matcher",
      entries: activity("week"),
    },
    {
      title: "Flest matcher per månad",
      unit: "matcher",
      entries: activity("month"),
    },
    {
      title: "Mest aktiva veckodagar",
      unit: "matcher",
      entries: WEEKDAYS.map((label, i) => ({
        label,
        value: matches.filter((m) => weekday(m.played_on) === i).length,
        detail: "Samtliga datum i urvalet",
      }))
        .filter((r) => r.value > 0)
        .sort((a, b) => b.value - a.value),
    },
    {
      title: "Högst P/M per månad",
      unit: "P/M",
      performance: true,
      entries: perf("ppm"),
    },
    {
      title: "Högst vinstprocent per månad",
      unit: "%",
      performance: true,
      entries: perf("winPercent"),
    },
    {
      title: "Bäst setskillnad/match per månad",
      unit: "set/match",
      performance: true,
      entries: perf("setDifferencePerMatch"),
    },
    {
      title: "Störst förbättring mellan månader",
      unit: "P/M i ökning",
      performance: true,
      entries: improvement.sort((a, b) => b.value - a.value),
    },
  ];
}
