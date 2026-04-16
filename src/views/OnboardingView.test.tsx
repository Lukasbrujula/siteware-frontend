import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { OnboardingView } from "./OnboardingView";
import { useAuthStore } from "@/lib/store/auth-store";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}));

const ADMIN_USER = {
  user: { id: "1", email: "admin@test.com", role: "admin" },
  isVerified: true,
  isLoading: false,
  error: null,
};

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <OnboardingView />
    </MemoryRouter>,
  );
}

describe("OnboardingView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState(ADMIN_USER);
  });

  afterEach(() => {
    useAuthStore.setState({
      user: null,
      isVerified: false,
      isLoading: true,
      error: null,
    });
  });

  it("renders step 1 (credentials) by default", () => {
    renderWithRouter();
    expect(
      screen.getByText("Schritt 1 von 6 — Zugangsdaten"),
    ).toBeInTheDocument();
    expect(screen.getByText("E-Mail-Verbindung")).toBeInTheDocument();
  });

  it("renders IMAP/SMTP form fields", () => {
    renderWithRouter();
    expect(screen.getByLabelText("E-Mail-Adresse")).toBeInTheDocument();
    expect(screen.getByLabelText("Passwort")).toBeInTheDocument();
    expect(screen.getByLabelText("IMAP Host")).toBeInTheDocument();
    expect(screen.getByLabelText("SMTP Host")).toBeInTheDocument();
  });

  it("disables test button when email and password are empty", () => {
    renderWithRouter();
    const button = screen.getByRole("button", { name: /Verbindung testen/i });
    expect(button).toBeDisabled();
  });

  it("enables test button when email and password are filled (provider pre-fills hosts)", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.type(
      screen.getByLabelText("E-Mail-Adresse"),
      "test@example.com",
    );
    await user.type(screen.getByLabelText("Passwort"), "secret");

    const button = screen.getByRole("button", { name: /Verbindung testen/i });
    expect(button).not.toBeDisabled();
  });

  it("shows error when test-connection fetch fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network error"),
    );

    renderWithRouter();

    await user.type(
      screen.getByLabelText("E-Mail-Adresse"),
      "test@example.com",
    );
    await user.type(screen.getByLabelText("Passwort"), "secret");
    await user.click(
      screen.getByRole("button", { name: /Verbindung testen/i }),
    );

    expect(await screen.findByText(/Netzwerkfehler/)).toBeInTheDocument();
  });

  it("shows success and Weiter button on successful connection test", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderWithRouter();

    await user.type(
      screen.getByLabelText("E-Mail-Adresse"),
      "test@example.com",
    );
    await user.type(screen.getByLabelText("Passwort"), "secret");
    await user.click(
      screen.getByRole("button", { name: /Verbindung testen/i }),
    );

    expect(
      await screen.findByText(/Verbindung erfolgreich/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Weiter" })).toBeInTheDocument();
  });

  it("transitions to step 2 (Siteware config) after clicking Weiter", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderWithRouter();

    await user.type(
      screen.getByLabelText("E-Mail-Adresse"),
      "test@example.com",
    );
    await user.type(screen.getByLabelText("Passwort"), "secret");
    await user.click(
      screen.getByRole("button", { name: /Verbindung testen/i }),
    );

    await screen.findByText(/Verbindung erfolgreich/);
    await user.click(screen.getByRole("button", { name: "Weiter" }));

    expect(screen.getByText("Schritt 2 von 6 — Siteware")).toBeInTheDocument();
  });

  it("shows API error message from test-connection", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: false, error: "Invalid credentials" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    renderWithRouter();

    await user.type(
      screen.getByLabelText("E-Mail-Adresse"),
      "test@example.com",
    );
    await user.type(screen.getByLabelText("Passwort"), "secret");
    await user.click(
      screen.getByRole("button", { name: /Verbindung testen/i }),
    );

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
  });

  it("shows loading spinner and blocks wizard while auth check is in flight", () => {
    useAuthStore.setState({
      user: null,
      isVerified: false,
      isLoading: true,
      error: null,
    });
    renderWithRouter();
    expect(
      screen.queryByText("Schritt 1 von 6 — Zugangsdaten"),
    ).not.toBeInTheDocument();
  });

  it("renders nothing when user is authenticated but not admin", () => {
    useAuthStore.setState({
      user: { id: "2", email: "viewer@test.com", role: "user" },
      isVerified: true,
      isLoading: false,
      error: null,
    });
    const { container } = renderWithRouter();
    expect(container).toBeEmptyDOMElement();
  });
});
