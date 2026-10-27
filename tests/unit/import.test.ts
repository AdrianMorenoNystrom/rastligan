import { describe, it, expect } from "vitest";
import { planImport, parseDate } from "../../scripts/import-core";
const header = ["Speldatum", "Spelare 1", "Spelare 2", "Set 1", "Set 2"];
describe("import", () => {
  it.each([
    "2026-10-22",
    "22/10/2026",
    "22-10-2026",
    "22 okt. 2026",
    "22 oktober 2026",
  ])("tolkar datum %s", (value) => expect(parseDate(value)).toBe("2026-10-22"));
  it.each(["=TODAY()", "", "31/02/2026", "2026-02-30", "2026-10-22 00:00:00"])(
    "nekar saknat, formel eller tvetydigt datum %s",
    (v) => expect(parseDate(v)).toBeNull(),
  );
  it("importerar oavgjort och trimmar namn", () =>
    expect(
      planImport([header, ["22 okt. 2026", " Dave ", " Elias ", "2", "2"]])[0],
    ).toMatchObject({
      status: "valid",
      source_row: "row:2",
      match: {
        played_on: "2026-10-22",
        score1: 2,
        score2: 2,
        player1_id: "dave",
        player2_id: "elias",
      },
    }));
  it("bevarar koppling mellan omvänt spelarpar och set", () =>
    expect(
      planImport([header, ["2026-10-22", "Elias", "Adrian", 6, 0]])[0].match,
    ).toMatchObject({
      player1_id: "adrian",
      player2_id: "elias",
      score1: 0,
      score2: 6,
    }));
  it("kräver verifierade kolumnrubriker", () =>
    expect(() => planImport([["Datum", "A", "B", "C", "D"]])).toThrow(
      "Kolumnen",
    ));
  it("hoppar över tomma rader med formelfyllda spelarnamn", () =>
    expect(planImport([header, ["", "Adrian", "Dave"]])[0].status).toBe(
      "empty",
    ));
  it.each([
    [null, "Adrian", "Dave", 3, 1],
    ["2026-10-22", "Adrian", "Dave", 0, 0],
    ["2026-10-22", "Adrian", "Dave", -1, 2],
    ["2026-10-22", "Adrian", "Dave", 1.5, 2],
    ["2026-10-22", "Okänd", "Dave", 1, 2],
    ["2026-10-22", "Adrian", "Dave", "", 2],
  ])("rapporterar felaktig rad %j", (...row) =>
    expect(planImport([header, row])[0]).toMatchObject({
      status: "invalid",
      error: expect.any(String),
    }),
  );
  it("två identiska matcher samma dag förblir separata", () => {
    const row = ["2026-10-22", "Adrian", "Dave", 3, 1];
    const plan = planImport([header, row, row]);
    expect(plan.map((r) => r.source_row)).toEqual(["row:2", "row:3"]);
    expect(plan.every((r) => r.status === "valid")).toBe(true);
  });
  it("upprepad import är idempotent och upptäcker ändrade källrader", () => {
    const rows = [header, ["2026-10-22", "Adrian", "Dave", 3, 1]];
    const first = planImport(rows);
    const existing = [
      { source_row: first[0].source_row, match: first[0].match! },
    ];
    expect(planImport(rows, undefined, existing)[0].status).toBe(
      "already_imported",
    );
    rows[1][3] = 4;
    expect(planImport(rows, undefined, existing)[0].status).toBe(
      "source_changed",
    );
  });
});
