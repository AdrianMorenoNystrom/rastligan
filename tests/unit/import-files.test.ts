import { it, expect } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import ExcelJS from "exceljs";
const header = ["Speldatum", "Spelare 1", "Spelare 2", "Set 1", "Set 2"];
it("CSV-kommandot förhandsgranskar alla rader utan databas", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rastligan-csv-"));
  try {
    const file = join(dir, "source.csv"),
      report = join(dir, "preview.json");
    await writeFile(
      file,
      "\ufeff" +
        header.join(";") +
        "\n22/10/2026; Dave ; Elias ;2;2\n;Adrian;Dave;3;1\n;Adrian;Dave;;\n",
    );
    execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/import.ts",
        "--file",
        file,
        "--source",
        "isolated-csv-test",
        "--offline",
        "--report",
        report,
      ],
      { stdio: "pipe" },
    );
    const result = JSON.parse(await readFile(report, "utf8"));
    expect(result.counts).toMatchObject({ valid: 1, invalid: 1 });
    expect(result.rows[0].break.played_on).toBe("2026-10-22");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 30000);
it("XLSX-kommandot använder utvärderade formelvärden och avvisar formler utan datum", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rastligan-xlsx-"));
  try {
    const file = join(dir, "source.xlsx"),
      report = join(dir, "preview.json");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Data");
    sheet.addRow(header);
    sheet.addRow([new Date("2026-10-22T00:00:00Z"), "Dave", "Elias", 2, 2]);
    sheet.addRow([
      { formula: "DATE(2026,10,23)", result: 46318 },
      "Adrian",
      "Dave",
      1,
      0,
    ]);
    sheet.addRow([{ formula: "TODAY()" }, "Adrian", "Elias", 0, 3]);
    await workbook.xlsx.writeFile(file);
    execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/import.ts",
        "--file",
        file,
        "--source",
        "isolated-xlsx-test",
        "--offline",
        "--report",
        report,
      ],
      { stdio: "pipe" },
    );
    const result = JSON.parse(await readFile(report, "utf8"));
    expect(result.counts).toMatchObject({ valid: 2, invalid: 1 });
    expect(result.rows[0].break.played_on).toBe("2026-10-22");
    expect(result.rows[2].error).toContain("datum");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 30000);
