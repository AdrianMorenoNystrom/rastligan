import { describe, it, expect } from "vitest";
import {
  validateMatch,
  canonical,
  points,
  today,
  dayAdd,
  isDate,
} from "../../src/lib/domain";
import type { Match, MatchInput } from "../../src/lib/domain";
import {
  standings,
  performance,
  period,
  cumulative,
  records,
  compareThirtyDays,
  summary,
  resultPatterns,
  weekdayPerformance,
} from "../../src/lib/statistics";
let counter = 0;
const match = (values: Partial<Match> = {}): Match => ({
  id: String(++counter),
  player1_id: "adrian",
  player2_id: "dave",
  score1: 3,
  score2: 1,
  played_on: "2026-10-22",
  created_at: "2026-10-23T09:00:00Z",
  updated_at: "2026-10-23T09:00:00Z",
  ...values,
});
describe("resultat och tabell", () => {
  it.each([
    [3, 1, 3, 0],
    [2, 2, 1, 1],
    [0, 1, 0, 3],
    [3, 3, 1, 1],
  ])("%i–%i ger %i och %i poäng", (a, b, p, q) => {
    expect(points(a, b)).toBe(p);
    expect(points(b, a)).toBe(q);
    expect(validateMatch(match({ score1: a, score2: b }))).toBeNull();
  });
  it.each([
    [0, 0],
    [-1, 2],
    [1.5, 2],
    [NaN, 2],
    [Infinity, 2],
  ])("nekar ogiltigt %s–%s", (a, b) =>
    expect(validateMatch(match({ score1: a, score2: b }))).not.toBeNull(),
  );
  it("nekar samma och okänd spelare", () => {
    expect(validateMatch(match({ player2_id: "adrian" }))).not.toBeNull();
    expect(
      validateMatch({
        ...match(),
        player1_id: "other",
      } as unknown as MatchInput),
    ).not.toBeNull();
  });
  it("kanoniserar spelarpar med rätt set", () =>
    expect(
      canonical(
        match({
          player1_id: "elias",
          player2_id: "adrian",
          score1: 5,
          score2: 2,
        }),
      ),
    ).toMatchObject({
      player1_id: "adrian",
      player2_id: "elias",
      score1: 2,
      score2: 5,
    }));
  it("beräknar kvoter från matcher och totalpoäng", () => {
    const s = standings([
      match(),
      match({ score1: 2, score2: 2 }),
      match({ score1: 0, score2: 1 }),
    ]).find((s) => s.id === "adrian")!;
    expect(s).toMatchObject({
      matches: 3,
      wins: 1,
      draws: 1,
      losses: 1,
      points: 4,
      setsWon: 5,
      setsLost: 4,
      setDifference: 1,
    });
    expect(s.ppm).toBeCloseTo(4 / 3);
    expect(s.winPercent).toBeCloseTo(100 / 3);
    expect(s.setDifferencePerMatch).toBeCloseTo(1 / 3);
    expect(s.winMargin).toBe(2);
    expect(s.lossMargin).toBe(1);
  });
  it("prioriterar totalpoäng före P/M", () => {
    const data = [
      ...Array.from({ length: 4 }, () => match({ score1: 2, score2: 2 })),
      match({ player1_id: "dave", player2_id: "elias", score1: 0, score2: 1 }),
    ];
    expect(standings(data).map((s) => [s.id, s.rank])).toEqual([
      ["adrian", 1],
      ["dave", 2],
      ["elias", 3],
    ]);
  });
  it("skiljer lika poäng med setskillnad", () => {
    expect(
      standings([
        match({ score1: 2, score2: 0 }),
        match({ score1: 0, score2: 1 }),
      ]).map((s) => s.id),
    ).toEqual(["adrian", "dave", "elias"]);
  });
  it("skiljer lika poäng och setskillnad med vunna set", () => {
    const s = standings([
      match({ player2_id: "elias", score1: 3, score2: 1 }),
      match({ player1_id: "dave", player2_id: "elias", score1: 4, score2: 2 }),
    ]);
    expect(s.map((s) => s.id)).toEqual(["dave", "adrian", "elias"]);
  });
  it("ger delad placering och hoppar nästa plats", () =>
    expect(
      standings([match({ score1: 2, score2: 2 })]).map((s) => [s.id, s.rank]),
    ).toEqual([
      ["adrian", 1],
      ["dave", 1],
      ["elias", 3],
    ]));
  it("noll matcher ger null för alla kvoter", () => {
    standings([]).forEach((s) => {
      expect(s.rank).toBe(1);
      expect(s.ppm).toBeNull();
      expect(s.winPercent).toBeNull();
      expect(s.setDifferencePerMatch).toBeNull();
      expect(s.margin).toBeNull();
    });
    expect(summary([]).setsPerMatch).toBeNull();
  });
});
describe("kalender och utveckling", () => {
  it("använder svensk dag nära midnatt och sommartidsgräns", () => {
    expect(today(new Date("2026-10-22T22:30:00Z"))).toBe("2026-10-23");
    expect(today(new Date("2026-03-29T22:30:00Z"))).toBe("2026-03-30");
    expect(dayAdd("2026-03-29", 1)).toBe("2026-03-30");
  });
  it("validerar skottdatum och omöjliga datum", () => {
    expect(isDate("2024-02-29")).toBe(true);
    expect(isDate("2026-02-29")).toBe(false);
    expect(validateMatch(match({ played_on: "2026-02-30" }))).not.toBeNull();
  });
  it("veckor börjar måndag även över årsskifte", () => {
    expect(period("2027-01-03", "week")).toBe("2026-12-28");
    expect(period("2027-01-04", "week")).toBe("2027-01-04");
  });
  it("skiljer månader och år korrekt", () => {
    const rows = performance(
      [match({ played_on: "2026-12-31" }), match({ played_on: "2027-02-01" })],
      {},
      "month",
    );
    expect(rows.map((r) => r.date)).toEqual([
      "2026-12-01",
      "2027-01-01",
      "2027-02-01",
    ]);
    expect(rows[1].adrian).toBeNull();
    expect(rows[1].count).toBe(0);
  });
  it("P/M gäller den enskilda perioden, aldrig ackumulerat", () => {
    const rows = performance(
      [
        match({ played_on: "2026-10-01" }),
        match({ played_on: "2026-11-01", score1: 0, score2: 1 }),
      ],
      {},
      "month",
    );
    expect(rows.map((r) => r.adrian)).toEqual([3, 0]);
    expect(rows.map((r) => r.adrian_count)).toEqual([1, 1]);
  });
  it("saknad spelare i period är null med noll underlag", () => {
    const [row] = performance([match()], {}, "week");
    expect(row.elias).toBeNull();
    expect(row.elias_count).toBe(0);
  });
  it("tom period ger tomt diagram", () =>
    expect(performance([match()], { from: "2027-01-01" }, "day")).toEqual([]));
  it("en match ger en korrekt punkt", () =>
    expect(performance([match()], {}, "day")[0]).toMatchObject({
      adrian: 3,
      dave: 0,
      count: 1,
      adrian_count: 1,
    }));
  it("aggregerar alla matcher samma dag i en punkt oberoende av ordning", () => {
    const data = [match(), match({ score1: 0, score2: 3 })];
    expect(cumulative(data, {})).toEqual(cumulative([...data].reverse(), {}));
    expect(cumulative(data, {})).toHaveLength(1);
    expect(cumulative(data, {})[0]).toMatchObject({
      adrian: 3,
      dave: 3,
      count: 2,
    });
  });
  it("tar med korrekt historisk ingångsnivå i datumfilter", () => {
    const data = [
      match({ played_on: "2026-10-01" }),
      match({ played_on: "2026-10-22", score1: 2, score2: 2 }),
    ];
    const rows = cumulative(data, { from: "2026-10-20", to: "2026-10-25" });
    expect(rows[0]).toMatchObject({ date: "2026-10-19", adrian: 3, dave: 0 });
    expect(rows[1]).toMatchObject({ adrian: 4, dave: 1 });
  });
  it("saknat jämförelseunderlag ger ingen påhittad förändring", () =>
    expect(
      compareThirtyDays([match()], "adrian", "2026-10-27").delta,
    ).toBeNull());
  it("jämför två disjunkta 30-dagarsperioder inkl gränser", () => {
    const rows = [
      match({ played_on: "2026-10-27" }),
      match({ played_on: "2026-09-28", score1: 2, score2: 2 }),
      match({ played_on: "2026-09-27", score1: 0, score2: 1 }),
      match({ played_on: "2026-08-29", score1: 0, score2: 1 }),
      match({ played_on: "2026-08-28" }),
    ];
    const result = compareThirtyDays(rows, "adrian", "2026-10-27");
    expect(result.current.matches).toBe(2);
    expect(result.previous.matches).toBe(2);
    expect(result.delta).toBe(2);
  });
  it("resultat visas ur spelarens perspektiv", () =>
    expect(resultPatterns([match()], "dave")).toEqual([
      { label: "1–3", count: 1 },
    ]));
  it("veckodagsprestanda har rätt matchunderlag", () => {
    const days = weekdayPerformance(
      [match({ played_on: "2026-10-26" })],
      "adrian",
    );
    expect(days[0]).toMatchObject({ label: "Måndag", matches: 1, ppm: 3 });
    expect(days[1].ppm).toBeNull();
  });
});
describe("verifierbara rekord", () => {
  it("nekar prestationsrekord vid fyra matcher", () => {
    const all = records(Array.from({ length: 4 }, () => match()));
    expect(
      all.filter((g) => g.performance).every((g) => !g.entries.length),
    ).toBe(true);
  });
  it("godkänner prestationsrekord vid fem matcher", () => {
    const group = records(Array.from({ length: 5 }, () => match())).find(
      (g) => g.title === "Högst P/M per månad",
    )!;
    expect(group.entries[0]).toMatchObject({
      label: "Adrian",
      value: 3,
      count: 5,
      detail: "2026-10",
    });
  });
  it("volymrekord och enskilda matcher kräver inte fem", () => {
    const list = records([match()]);
    expect(
      list.find((g) => g.title === "Största setsegrar")!.entries[0].value,
    ).toBe(2);
    expect(
      list.find((g) => g.title === "Flest matcher per vecka")!.entries[0].value,
    ).toBe(1);
  });
  it("kräver fem matcher i båda angränsande jämförelsemånader", () => {
    const data = [
      ...Array.from({ length: 5 }, () =>
        match({ played_on: "2026-09-10", score1: 0, score2: 1 }),
      ),
      ...Array.from({ length: 4 }, () => match({ played_on: "2026-10-10" })),
    ];
    expect(records(data).at(-1)!.entries).toHaveLength(0);
    data.push(match({ played_on: "2026-10-11" }));
    expect(records(data).at(-1)!.entries[0]).toMatchObject({
      label: "Adrian",
      value: 3,
    });
  });
  it("jämför inte månader med en lucka emellan", () => {
    const data = [
      ...Array.from({ length: 5 }, () =>
        match({ played_on: "2026-08-10", score1: 0, score2: 1 }),
      ),
      ...Array.from({ length: 5 }, () => match({ played_on: "2026-10-10" })),
    ];
    expect(records(data).at(-1)!.entries).toHaveLength(0);
  });
});
