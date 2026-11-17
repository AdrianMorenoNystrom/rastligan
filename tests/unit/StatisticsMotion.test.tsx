import { render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatisticsNumber } from "../../src/components/StatisticsMotion";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const visual = () => document.querySelector(".stats-count-visual")!;

describe("statistiksiffrornas uppbyggnad", () => {
  it("ger skärmläsaren slutvärdet direkt och räknar bara upp den visuella kopian", () => {
    render(<StatisticsNumber value={33} ready motion />);
    expect(
      screen.getByText("33", { selector: ".sr-only" }),
    ).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(16));
    expect(Number(visual().textContent)).toBeLessThan(33);
    act(() => vi.advanceTimersByTime(1200));
    expect(visual()).toHaveTextContent(/^33$/);
  });

  it("avbryter gamla mål vid ändrat filter och vid saknat underlag", () => {
    const view = render(<StatisticsNumber value={33} ready motion />);
    act(() => vi.advanceTimersByTime(200));
    view.rerender(<StatisticsNumber value={7} ready motion />);
    act(() => vi.advanceTimersByTime(1200));
    expect(visual()).toHaveTextContent(/^7$/);
    view.rerender(<StatisticsNumber value={null} ready motion />);
    act(() => vi.advanceTimersByTime(1200));
    expect(visual()).toHaveTextContent(/^–$/);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("väntar på synlighet och visar värdet direkt med minskad rörelse", () => {
    const view = render(
      <StatisticsNumber
        value={73.7}
        digits={1}
        suffix=" %"
        ready={false}
        motion
      />,
    );
    act(() => vi.advanceTimersByTime(1200));
    expect(visual()).toHaveTextContent(/^0,0 %$/);
    view.rerender(
      <StatisticsNumber
        value={73.7}
        digits={1}
        suffix=" %"
        ready
        motion={false}
      />,
    );
    expect(visual()).toHaveTextContent(/^73,7 %$/);
    expect(vi.getTimerCount()).toBe(0);
  });
});
