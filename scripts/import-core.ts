import { canonical, isDate, validateBreak } from "../src/lib/domain";
import type { BreakInput, PlayerId } from "../src/lib/domain";
export interface ImportRow {
  source_row: string;
  status: "valid" | "empty" | "invalid" | "already_imported" | "source_changed";
  error?: string;
  break?: BreakInput;
}
export interface ImportedRow {
  source_row: string;
  break: BreakInput;
}
const names: Record<string, PlayerId> = {
  adrian: "adrian",
  dave: "dave",
  elias: "elias",
};
const monthNames: Record<string, string> = {
  jan: "01",
  januari: "01",
  feb: "02",
  februari: "02",
  mar: "03",
  mars: "03",
  apr: "04",
  april: "04",
  maj: "05",
  jun: "06",
  juni: "06",
  jul: "07",
  juli: "07",
  aug: "08",
  augusti: "08",
  sep: "09",
  sept: "09",
  september: "09",
  okt: "10",
  oktober: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};
export function parseDate(value: unknown): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value < 2958466
  )
    return new Date(Date.UTC(1899, 11, 30) + value * 86400000)
      .toISOString()
      .slice(0, 10);
  if (typeof value !== "string") return null;
  const raw = value.trim().toLowerCase().replace(/\./g, "");
  if (!raw || raw.startsWith("=")) return null;
  if (isDate(raw)) return raw;
  let date: string | undefined;
  const numeric = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (numeric)
    date = `${numeric[3]}-${numeric[2].padStart(2, "0")}-${numeric[1].padStart(2, "0")}`;
  const text = raw.match(/^(\d{1,2})\s+([a-zåäö]+)\s+(\d{4})$/);
  if (text && monthNames[text[2]])
    date = `${text[3]}-${monthNames[text[2]]}-${text[1].padStart(2, "0")}`;
  return date && isDate(date) ? date : null;
}
export type Mapping = {
  date: string;
  player1: string;
  player2: string;
  score1: string;
  score2: string;
};
export const DEFAULT_MAPPING: Mapping = {
  date: "Speldatum",
  player1: "Spelare 1",
  player2: "Spelare 2",
  // Original Sheets headers are immutable source identifiers; values are match wins.
  score1: "Set 1",
  score2: "Set 2",
};
const normalize = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase();
const isBlank = (v: unknown) =>
  v === null || v === undefined || String(v).trim() === "";
function matchWins(v: unknown): number {
  if (isBlank(v)) return NaN;
  return typeof v === "number"
    ? v
    : /^\d+$/.test(String(v).trim())
      ? Number(String(v).trim())
      : NaN;
}
export function planImport(
  rows: unknown[][],
  mapping: Mapping = DEFAULT_MAPPING,
  existing: ImportedRow[] = [],
): ImportRow[] {
  if (!rows.length) throw new Error("Källan saknar rubrikrad.");
  const header = rows[0].map(normalize);
  const indexes = Object.fromEntries(
    Object.entries(mapping).map(([key, h]) => {
      const i = header.indexOf(normalize(h));
      if (i < 0)
        throw new Error(`Kolumnen "${h}" saknas. Ange verifierad --mapping.`);
      return [key, i];
    }),
  ) as Record<keyof Mapping, number>;
  const previous = new Map(existing.map((r) => [r.source_row, r.break]));
  return rows.slice(1).map((row, i) => {
    const source_row = `row:${i + 2}`;
    const get = (key: keyof Mapping) => row[indexes[key]];
    // Formula-filled names alone do not make an empty registration a break.
    if (
      ["date", "score1", "score2"].every((k) =>
        isBlank(get(k as keyof Mapping)),
      )
    )
      return { source_row, status: "empty" };
    const p1 = names[normalize(get("player1"))],
      p2 = names[normalize(get("player2"))],
      date = parseDate(get("date"));
    if (!date)
      return {
        source_row,
        status: "invalid",
        error:
          "Saknat eller ogiltigt rastdatum (formler kräver utvärderat datum).",
      };
    if (!p1 || !p2)
      return {
        source_row,
        status: "invalid",
        error: "Okänt eller saknat spelarnamn.",
      };
    const rast = canonical({
      player1_id: p1,
      player2_id: p2,
      score1: matchWins(get("score1")),
      score2: matchWins(get("score2")),
      played_on: date,
    });
    const error = validateBreak(rast);
    if (error) return { source_row, status: "invalid", error };
    const old = previous.get(source_row);
    if (old) {
      const equal = Object.entries(rast).every(
        ([k, v]) => old[k as keyof BreakInput] === v,
      );
      return {
        source_row,
        status: equal ? "already_imported" : "source_changed",
        break: rast,
        ...(!equal
          ? {
              error:
                "Källraden har ändrats efter import. Kräver manuell granskning.",
            }
          : {}),
      };
    }
    return { source_row, status: "valid", break: rast };
  });
}
