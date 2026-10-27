import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { MatchForm } from "../../src/components/MatchForm";
const mocks = vi.hoisted(() => ({ request: vi.fn(), refresh: vi.fn() }));
vi.mock("../../src/components/providers", () => ({
  useAuth: () => ({ session: { player_id: "adrian" }, request: mocks.request }),
  useRefreshMatches: () => mocks.refresh,
}));
beforeEach(() => {
  mocks.request.mockReset();
  mocks.refresh.mockReset();
  mocks.refresh.mockResolvedValue(undefined);
});
function choose() {
  fireEvent.click(screen.getByRole("button", { name: "Adrian mot Dave" }));
}
describe("matchregistrering", () => {
  it("spärrar 0–0 och minus kan aldrig skapa negativa set", () => {
    render(<MatchForm />);
    choose();
    expect(screen.getByRole("button", { name: "Spara match" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Minska Adrian" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Öka Adrian" }));
    expect(screen.getByLabelText("Set för Adrian")).toHaveValue(1);
    fireEvent.click(screen.getByRole("button", { name: "Minska Adrian" }));
    expect(screen.getByLabelText("Set för Adrian")).toHaveValue(0);
  });
  it("sparar och återgår till spelarpar med nollställt resultat", async () => {
    mocks.request.mockResolvedValue({});
    render(<MatchForm />);
    choose();
    fireEvent.click(screen.getByRole("button", { name: "Öka Dave" }));
    fireEvent.click(screen.getByRole("button", { name: "Spara match" }));
    await screen.findByRole("status");
    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "create",
        match: expect.objectContaining({ score1: 0, score2: 1 }),
      }),
    );
    expect(screen.queryByLabelText("Set för Adrian")).not.toBeInTheDocument();
    choose();
    expect(screen.getByLabelText("Set för Dave")).toHaveValue(0);
  });
  it("behåller resultat och datum vid nätverksfel och återanvänder idempotens-ID", async () => {
    mocks.request
      .mockRejectedValueOnce(new Error("Nätverksfel"))
      .mockResolvedValueOnce({});
    render(<MatchForm />);
    choose();
    fireEvent.change(screen.getByLabelText("Set för Adrian"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText(/När spelades/), {
      target: { value: "2026-10-22" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Spara match" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Set för Adrian")).toHaveValue(5);
    expect(screen.getByLabelText(/När spelades/)).toHaveValue("2026-10-22");
    const first = mocks.request.mock.calls[0][0];
    fireEvent.click(screen.getByRole("button", { name: "Spara match" }));
    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(2));
    expect(mocks.request.mock.calls[1][0].idempotency_key).toBe(
      first.idempotency_key,
    );
  });
  it("förhindrar dubbelsparning under pågående begäran", async () => {
    let resolve: ((v: object) => void) | undefined;
    mocks.request.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    render(<MatchForm />);
    choose();
    fireEvent.click(screen.getByRole("button", { name: "Öka Adrian" }));
    const save = screen.getByRole("button", { name: "Spara match" });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(save).toBeDisabled();
    resolve?.({});
    await screen.findByRole("status");
  });
});
