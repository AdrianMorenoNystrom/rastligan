import { describe, expect, it } from "vitest";
import { monthlyLeagues, monthLabel, monthRange } from "../../src/lib/monthly";
import { standings } from "../../src/lib/statistics";
import type { BreakSession } from "../../src/lib/domain";

const rast = (id: string, date: string, a = 4, b = 1): BreakSession => ({
  id,
  played_on: date,
  player1_id: "adrian",
  player2_id: "dave",
  score1: a,
  score2: b,
  created_at: "2026-11-17T10:00:00Z",
  updated_at: "2026-11-17T10:00:00Z",
});

describe("månadsligor", () => {
  it("ger exakta månadsslut för skottår och årsskifte", () => {
    expect(monthRange("2024-02")).toEqual({
      from: "2024-02-01",
      to: "2024-02-29",
    });
    expect(monthRange("2026-02").to).toBe("2026-02-28");
    expect(monthRange("2026-12").to).toBe("2026-12-31");
    expect(monthRange("0001-10").to).toBe("0001-10-31");
  });
  it("separerar kalendermånader och använder speldatum, inte registreringsdatum", () => {
    const data = [rast("a", "2026-10-31"), rast("b", "2026-11-01", 2, 3)];
    const leagues = monthlyLeagues(data, "2026-11-17");
    expect(leagues.map((league) => league.month)).toEqual([
      "2026-11",
      "2026-10",
    ]);
    expect(leagues[0]).toMatchObject({
      breaks: 1,
      matches: 5,
      status: "current",
      winners: [],
    });
    expect(leagues[1]).toMatchObject({
      breaks: 1,
      matches: 5,
      status: "completed",
    });
    expect(leagues[0].rows[0]).toMatchObject({ id: "dave", points: 3 });
    expect(leagues[1].winners[0]).toMatchObject({ id: "adrian", points: 3 });
    expect(standings(data).find((row) => row.id === "adrian")!.breaks).toBe(2);
  });
  it("använder matchskillnad och matchvinster som utslagsregler", () => {
    const [league] = monthlyLeagues(
      [rast("a", "2026-10-01", 4, 1), rast("b", "2026-10-02", 1, 2)],
      "2026-11-17",
    );
    expect(league.winners.map((row) => row.id)).toEqual(["adrian"]);
    expect(league.rows[0]).toMatchObject({
      points: 3,
      matchDifference: 2,
      matchesWon: 5,
    });
  });
  it("delar månadsvinsten när alla utslagsvärden är lika", () => {
    const [league] = monthlyLeagues(
      [rast("a", "2026-10-01", 2, 2)],
      "2026-11-17",
    );
    expect(league.winners.map((row) => row.id)).toEqual(["adrian", "dave"]);
    expect(league.winners.every((row) => row.rank === 1)).toBe(true);
  });
  it("utser aldrig vinnare i pågående eller kommande månader", () => {
    const data = [rast("a", "2026-11-17"), rast("b", "2026-12-01")];
    expect(
      monthlyLeagues(data, "2026-11-17").every(
        (league) => league.winners.length === 0,
      ),
    ).toBe(true);
  });
  it("håller isär december och januari över årsskifte", () => {
    expect(
      monthlyLeagues(
        [rast("a", "2026-12-31"), rast("b", "2027-01-01")],
        "2027-01-02",
      ).map((league) => [league.month, league.status]),
    ).toEqual([
      ["2027-01", "current"],
      ["2026-12", "completed"],
    ]);
  });
  it("följer rättade resultat och lämnar inga lagrade månadssegrar kvar", () => {
    const original = rast("a", "2026-10-31");
    expect(monthlyLeagues([original], "2026-11-17")[0].winners[0].id).toBe(
      "adrian",
    );
    expect(
      monthlyLeagues([{ ...original, score1: 1, score2: 4 }], "2026-11-17")[0]
        .winners[0].id,
    ).toBe("dave");
    expect(
      monthlyLeagues(
        [{ ...original, played_on: "2026-11-01" }],
        "2026-11-17",
      )[0].winners,
    ).toEqual([]);
    expect(monthlyLeagues([], "2026-11-17")).toEqual([]);
  });
  it("formaterar svensk månad med år", () => {
    expect(monthLabel("2026-10")).toBe("oktober 2026");
  });
});
