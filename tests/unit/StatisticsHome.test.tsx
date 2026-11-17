import { render, screen, fireEvent, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import {
  StatisticsHero,
  PlayerSnapshots,
  DuelSnapshot,
} from "../../src/components/StatisticsHome";
import type { BreakSession } from "../../src/lib/domain";

const rast = (id: string, a: number, b: number): BreakSession => ({
  id,
  player1_id: "adrian",
  player2_id: "dave",
  score1: a,
  score2: b,
  played_on: "2026-10-22",
  created_at: "2026-10-22T10:00:00Z",
  updated_at: "2026-10-22T10:00:00Z",
});
const example = [rast("a", 4, 1), rast("b", 2, 3)];

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
});
afterEach(() => vi.unstubAllGlobals());

describe("statistikens startsida", () => {
  it("håller isär 60 procent matchvinster och 50 procent rastvinster", () => {
    render(<StatisticsHero selected={example} range={{}} />);
    const legend = screen.getByLabelText("Välj spelare i ringdiagrammet");
    fireEvent.click(within(legend).getByRole("button", { name: /Adrian/ }));
    expect(screen.getByRole("status")).toHaveTextContent("60,0 %");
    expect(screen.getByRole("status")).toHaveTextContent(
      "6 av 10 matcher vunna",
    );
    const metric = screen.getByRole("group", {
      name: "Vinstprocentens underlag",
    });
    fireEvent.click(within(metric).getByRole("button", { name: /^Raster$/ }));
    expect(
      screen.getByRole("heading", { name: "Rastvinstprocent" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("50,0 %");
    expect(screen.getByRole("status")).toHaveTextContent("1 av 2 raster vunna");
    expect(
      screen
        .getByLabelText("Ligan i siffror")
        .querySelector(".stats-big-number strong"),
    ).toHaveTextContent("10");
  });
  it("visar saknat underlag utan påhittad vinstprocent", () => {
    render(
      <StatisticsHero
        selected={[]}
        range={{ from: "2026-11-01", to: "2026-11-30" }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Inget underlag");
    expect(screen.getByRole("status")).not.toHaveTextContent("0,0 %");
    expect(screen.getByLabelText("Ligan i siffror").textContent).not.toMatch(
      /NaN|Infinity/,
    );
  });
  it("spelarprofiler ärver översiktens datumfilter och ranking följer poäng", () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/statistik?period=custom&from=2026-10-01&to=2026-10-31",
        ]}
      >
        <PlayerSnapshots selected={example} />
      </MemoryRouter>,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    const adrian = screen.getByRole("link", { name: /Adrian/ });
    expect(adrian).toHaveAttribute(
      "href",
      "/statistik/spelare/adrian?period=custom&from=2026-10-01&to=2026-10-31",
    );
    expect(links[0]).toBe(adrian);
    expect(
      within(adrian).getByLabelText(
        "1 vunna, 0 oavgjorda och 1 förlorade raster",
      ),
    ).toBeInTheDocument();
  });
  it("duellpanelen växlar spelarpar och länkar vidare inom samma period", () => {
    const data = [
      ...example,
      {
        ...rast("c", 2, 2),
        player1_id: "dave" as const,
        player2_id: "elias" as const,
      },
    ];
    render(
      <MemoryRouter
        initialEntries={[
          "/statistik?period=custom&from=2026-10-01&to=2026-10-31",
        ]}
      >
        <DuelSnapshot selected={data} />
      </MemoryRouter>,
    );
    expect(
      screen.getByLabelText("Adrian 6, Dave 4 matchvinster"),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Spelarpar i översikten"), {
      target: { value: "dave-elias" },
    });
    expect(
      screen.getByLabelText("Dave 2, Elias 2 matchvinster"),
    ).toBeInTheDocument();
    expect(screen.getByText("1 oavgjorda")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/statistik/dueller/dave-elias?period=custom&from=2026-10-01&to=2026-10-31",
    );
  });
});
