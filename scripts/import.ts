import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_MAPPING, planImport } from "./import-core";
import type { ImportedRow, Mapping } from "./import-core";
import { standings } from "../src/lib/statistics";
const { values } = parseArgs({
  options: {
    file: { type: "string" },
    sheet: { type: "string", default: "Data" },
    spreadsheet: { type: "string" },
    source: { type: "string" },
    mapping: { type: "string" },
    report: { type: "string", default: "data/import-preview.json" },
    apply: { type: "boolean", default: false },
    offline: { type: "boolean", default: false },
  },
});
let rows: unknown[][] = [];
let source = values.source;
if (values.spreadsheet) {
  const token = process.env.GOOGLE_ACCESS_TOKEN;
  if (!token)
    throw new Error(
      "Sätt GOOGLE_ACCESS_TOKEN med read-only Sheets-behörighet.",
    );
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(values.spreadsheet)}`;
  const get = async (url: string) => {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok)
      throw new Error(
        `Sheets svarade ${response.status}. Kontrollera läsbehörighet.`,
      );
    return response.json();
  };
  const metadata = await get(base + "?fields=sheets.properties");
  const sheet = metadata.sheets.find(
    (s: { properties: { title: string } }) =>
      s.properties.title === values.sheet,
  )?.properties;
  if (!sheet) throw new Error("Fliken saknas i Sheets-metadata.");
  source ||= `google:${values.spreadsheet}:${sheet.sheetId}`;
  let n = sheet.gridProperties.columnCount,
    column = "";
  while (n > 0) {
    n--;
    column = String.fromCharCode(65 + (n % 26)) + column;
    n = Math.floor(n / 26);
  }
  for (let first = 1; first <= sheet.gridProperties.rowCount; first += 1000) {
    const last = Math.min(first + 999, sheet.gridProperties.rowCount);
    const range = `'${String(values.sheet).replace(/'/g, "''")}'!A${first}:${column}${last}`;
    const page = await get(
      base +
        `/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`,
    );
    const data = page.values || [];
    for (let i = 0; i <= last - first; i++) rows.push(data[i] || []);
  }
} else if (values.file) {
  if (values.file.endsWith(".json")) {
    const json = JSON.parse(await readFile(values.file, "utf8"));
    rows = json.values;
    source ||= json.source;
  } else if (/\.xlsx$/i.test(values.file)) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(values.file);
    const sheet = workbook.getWorksheet(values.sheet!);
    if (!sheet) throw new Error(`Fliken ${values.sheet} saknas.`);
    for (let i = 1; i <= sheet.rowCount; i++) {
      const row: unknown[] = [];
      for (let j = 1; j <= sheet.columnCount; j++) {
        const c = sheet.getCell(i, j);
        const v = c.value;
        row.push(
          v && typeof v === "object" && "formula" in v
            ? "result" in v
              ? v.result
              : "=" + v.formula
            : c.type === ExcelJS.ValueType.RichText
              ? c.text
              : v,
        );
      }
      rows.push(row);
    }
  } else {
    const raw = await readFile(values.file, "utf8");
    const first = raw.split(/\r?\n/)[0];
    const delimiter = first.includes(";")
      ? ";"
      : first.includes("\t")
        ? "\t"
        : ",";
    rows = parse(raw, {
      bom: true,
      delimiter,
      relax_column_count: true,
      skip_empty_lines: false,
    });
  }
} else throw new Error("Ange --file CSV/XLSX/JSON eller --spreadsheet ID.");
if (!source)
  throw new Error(
    "Ange ett stabilt --source, samma för alla framtida exporter av samma flik.",
  );
const mapping: Mapping = values.mapping
  ? JSON.parse(await readFile(values.mapping, "utf8"))
  : DEFAULT_MAPPING;
const url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
if (!values.offline && !db)
  throw new Error(
    "Supabase saknas. Använd --offline för en källvalidering utan kontroll mot tidigare importer.",
  );
let existing: ImportedRow[] = [];
if (!values.offline && db) {
  const { data, error } = await db.rpc("import_preview", { p_source: source });
  if (error) throw new Error(error.message);
  existing = data;
}
const plan = planImport(rows, mapping, existing);
const counts = Object.fromEntries(
  ["valid", "invalid", "empty", "already_imported", "source_changed"].map(
    (s) => [s, plan.filter((r) => r.status === s).length],
  ),
);
const report: {
  source: string;
  offline: boolean;
  counts: typeof counts;
  rows: typeof plan;
  applied?: unknown;
  standings?: unknown;
  total_matches?: number;
} = { source, offline: values.offline, counts, rows: plan };
if (values.apply) {
  if (!db || values.offline)
    throw new Error(
      "--apply kräver ansluten Supabase och får inte kombineras med --offline.",
    );
  if (counts.source_changed)
    throw new Error(
      "Ändrade källrader måste granskas innan import. Ingen ändring har gjorts.",
    );
  const { data, error } = await db.rpc("import_matches", {
    p_source: source,
    p_rows: plan,
  });
  if (error) throw new Error(error.message);
  report.applied = data;
  const snapshot = await db.rpc("league_snapshot");
  if (snapshot.error)
    throw new Error(
      "Import applicerad men efterkontrollen misslyckades. Kör förhandsgranskning igen.",
    );
  report.standings = standings(snapshot.data.matches);
  report.total_matches = snapshot.data.count;
}
await writeFile(values.report!, JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      source,
      offline: values.offline,
      counts,
      applied: values.apply,
      report: values.report,
      total_matches: report.total_matches,
      standings: report.standings,
    },
    null,
    2,
  ),
);
