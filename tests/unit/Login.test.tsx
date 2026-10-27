import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { it, expect, vi, beforeEach } from "vitest";
import { Login } from "../../src/components/Login";
const mocks = vi.hoisted(() => ({ login: vi.fn() }));
vi.mock("../../src/components/providers", () => ({
  useAuth: () => ({ session: null, login: mocks.login }),
}));
beforeEach(() => {
  mocks.login.mockReset();
  mocks.login.mockResolvedValue(undefined);
});
it.each(["7", "1234", "å🎾".repeat(10000)])(
  "skickar hela koden utan längdkrav (%#)",
  async (code) => {
    render(<Login />);
    const input = screen.getByLabelText("Personlig kod");
    expect(input).not.toHaveAttribute("maxlength");
    fireEvent.change(input, { target: { value: code } });
    fireEvent.click(screen.getByRole("button", { name: "Logga in" }));
    await waitFor(() =>
      expect(mocks.login).toHaveBeenCalledWith("adrian", code),
    );
  },
);
it("tom kod kan inte skickas", () => {
  render(<Login />);
  expect(screen.getByRole("button", { name: "Logga in" })).toBeDisabled();
});
