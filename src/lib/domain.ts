export const PLAYERS = [
  { id: "adrian", name: "Adrian", color: "#bef26d" },
  { id: "dave", name: "Dave", color: "#6cbcff" },
  { id: "elias", name: "Elias", color: "#d4a1ff" },
] as const;
export type PlayerId = (typeof PLAYERS)[number]["id"];
export const PAIRS: [PlayerId, PlayerId][] = [
  ["adrian", "dave"],
  ["adrian", "elias"],
  ["dave", "elias"],
];
export const player = (id: string) => PLAYERS.find((p) => p.id === id)!;
export const isPlayer = (id: unknown): id is PlayerId =>
  PLAYERS.some((p) => p.id === id);
export interface BreakInput {
  player1_id: PlayerId;
  player2_id: PlayerId;
  /** Individual match wins during this break. No set data or match order is stored. */
  score1: number;
  score2: number;
  played_on: string;
}
export interface BreakSession extends BreakInput {
  id: string;
  created_at: string;
  updated_at: string;
}
export interface DateRange {
  from?: string;
  to?: string;
}
export function isDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value
  );
}
export function validateBreak(m: BreakInput): string | null {
  if (
    !isPlayer(m.player1_id) ||
    !isPlayer(m.player2_id) ||
    m.player1_id === m.player2_id
  )
    return "Välj två olika spelare.";
  if (![m.score1, m.score2].every((n) => Number.isSafeInteger(n) && n >= 0))
    return "Ange antal vunna matcher som heltal, minst 0.";
  if (m.score1 === 0 && m.score2 === 0) return "Ange minst en spelad match.";
  if (!isDate(m.played_on)) return "Ange ett giltigt rastdatum.";
  return null;
}
export function canonical(m: BreakInput): BreakInput {
  return m.player1_id < m.player2_id
    ? m
    : {
        ...m,
        player1_id: m.player2_id,
        player2_id: m.player1_id,
        score1: m.score2,
        score2: m.score1,
      };
}
export const points = (own: number, opponent: number) =>
  own > opponent ? 3 : own === opponent ? 1 : 0;
export const ratio = (n: number, d: number) => (d ? n / d : null);
export const format = (n: number | null, digits = 2) =>
  n === null
    ? "–"
    : new Intl.NumberFormat("sv-SE", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(n);
export function today(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export const dayAdd = (d: string, n: number) => {
  const date = new Date(d + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
};
export const dateLabel = (d: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(d + "T12:00:00Z"));
export const within = (m: BreakSession, r: DateRange) =>
  (!r.from || m.played_on >= r.from) && (!r.to || m.played_on <= r.to);
export const newest = (a: BreakSession, b: BreakSession) =>
  b.played_on.localeCompare(a.played_on) || a.id.localeCompare(b.id);
export const weekday = (d: string) =>
  (new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7;
export const WEEKDAYS = [
  "Måndag",
  "Tisdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lördag",
  "Söndag",
];
